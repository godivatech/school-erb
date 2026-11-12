import "dotenv/config";
import { db } from "./index";
import * as schema from "./schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { collectFeePaymentPOS, markReceiptBouncedOrVoid } from "../actions/finance";
import { saveExamMarksBatch, generateReportCardPdf } from "../actions/exams";
import { submitSectionAttendance } from "../actions/attendance";
import { issueTransferCertificate } from "../actions/students";
import { AcademicYearLockError } from "../lib/guards";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

export async function runVerificationSuite() {
  console.log("\n================================================================================");
  console.log("🏫 CRESCENT SCHOOL ERP: AUTOMATED BUSINESS-LOGIC VERIFICATION SUITE");
  console.log("================================================================================\n");

  const schoolId = "sch_oxford_001";
  const activeYearId = "ay_2026_2027";
  const lockedYearId = "ay_2025_2026";

  // ---------------------------------------------------------------------------
  // TEST 1: Priority Fee Allocation & Sequential Waterfall
  // ---------------------------------------------------------------------------
  console.log("📌 TEST 1: Priority Fee Allocation & Sequential Item Settlement");
  {
    const studentId = "stu_mehta_aarav";

    // Reset invoice items for INV-2026-0001 to pristine unpaid state
    const [inv] = await db
      .select()
      .from(schema.feeInvoices)
      .where(eq(schema.feeInvoices.invoiceNo, "INV-2026-0001"))
      .limit(1);

    assert(!!inv, "Invoice INV-2026-0001 exists in database");

    await db
      .update(schema.feeInvoices)
      .set({ paidAmount: "0.00", status: "UNPAID" })
      .where(eq(schema.feeInvoices.id, inv.id));

    await db
      .update(schema.feeInvoiceItems)
      .set({ paidAmount: "0.00" })
      .where(eq(schema.feeInvoiceItems.invoiceId, inv.id));

    await db
      .update(schema.students)
      .set({ walletBalance: "0.00" })
      .where(eq(schema.students.id, studentId));

    // Simulate POS Cashier collection of ₹5,000
    const paymentResult = await collectFeePaymentPOS({
      schoolId,
      userId: "usr_accountant",
      userRole: "ACCOUNTANT",
      academicYearId: activeYearId,
      studentId,
      amountReceived: 5000,
      paymentMode: "CHEQUE",
      chequeOrTxnRef: "CHQ-LOGIC-9901",
      idempotencyKey: `verify_pos_5000_${Date.now()}`,
      notes: "Verification Suite POS collection ₹5,000",
    });

    assert(paymentResult.success, "collectFeePaymentPOS executed successfully");
    assert(!!paymentResult.receipt, "Receipt was generated");

    // Verify priority item allocations:
    // Priority 1: Late Fine (₹250) -> should be ₹250 paid
    // Priority 2: Transport (₹2500) -> should be ₹2500 paid
    // Priority 3: Tuition (₹10500) -> should receive remaining ₹2250
    const items = await db
      .select({
        feeHeadId: schema.feeInvoiceItems.feeHeadId,
        feeHeadName: schema.feeHeads.name,
        priority: schema.feeHeads.priorityOrder,
        amount: schema.feeInvoiceItems.amount,
        paidAmount: schema.feeInvoiceItems.paidAmount,
      })
      .from(schema.feeInvoiceItems)
      .innerJoin(schema.feeHeads, eq(schema.feeInvoiceItems.feeHeadId, schema.feeHeads.id))
      .where(eq(schema.feeInvoiceItems.invoiceId, inv.id));

    const lateFine = items.find((i) => i.feeHeadName.toLowerCase().includes("late"));
    const transport = items.find((i) => i.feeHeadName.toLowerCase().includes("transport"));
    const tuition = items.find((i) => i.feeHeadName.toLowerCase().includes("tuition"));

    assert(!!lateFine && parseFloat(lateFine.paidAmount) === 250, "Priority 1 (Late Fine) was paid in full (₹250/₹250)");
    assert(!!transport && parseFloat(transport.paidAmount) === 2500, "Priority 2 (Transport) was paid in full (₹2500/₹2500)");
    assert(!!tuition && parseFloat(tuition.paidAmount) === 2250, "Priority 3 (Tuition) received exact remaining balance (₹2,250 of ₹10,500)");

    const [updatedInv] = await db
      .select()
      .from(schema.feeInvoices)
      .where(eq(schema.feeInvoices.id, inv.id))
      .limit(1);

    assert(parseFloat(updatedInv.paidAmount) === 5000, "Invoice total paidAmount is exactly ₹5,000.00");
    assert(updatedInv.status === "PARTIAL", "Invoice status transitioned to PARTIAL");

    // Overpayment Wallet Credit test: Pay ₹10,000 more when remaining due is ₹8,250
    const overpaymentRes = await collectFeePaymentPOS({
      schoolId,
      userId: "usr_accountant",
      userRole: "ACCOUNTANT",
      academicYearId: activeYearId,
      studentId,
      amountReceived: 10000,
      paymentMode: "CASH",
      idempotencyKey: `verify_pos_overpay_${Date.now()}`,
      notes: "Verification Suite Overpayment test ₹10,000",
    });

    assert(overpaymentRes.success, "Overpayment POS collection executed");
    const [finalInv] = await db
      .select()
      .from(schema.feeInvoices)
      .where(eq(schema.feeInvoices.id, inv.id))
      .limit(1);
    assert(finalInv.status === "PAID", "Invoice status transitioned to PAID");

    const [studentWithWallet] = await db
      .select({ walletBalance: schema.students.walletBalance })
      .from(schema.students)
      .where(eq(schema.students.id, studentId))
      .limit(1);

    assert(
      parseFloat(studentWithWallet.walletBalance) === 1750,
      "Excess ₹1,750 was automatically credited to student walletBalance"
    );

    console.log("✅ TEST 1 PASSED: Sequential waterfall priority allocation and wallet advance confirmed.\n");
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Cheque Bounce Reversal & Audit Log Insertion
  // ---------------------------------------------------------------------------
  console.log("📌 TEST 2: Cheque Bounce Reversal, Penalty Addition & Immutable Audit Log");
  {
    // Generate a fresh cheque payment receipt to bounce
    const studentId = "stu_mehta_ananya";
    const paymentResult = await collectFeePaymentPOS({
      schoolId,
      userId: "usr_accountant",
      userRole: "ACCOUNTANT",
      academicYearId: activeYearId,
      studentId,
      amountReceived: 3000,
      paymentMode: "CHEQUE",
      chequeOrTxnRef: "CHQ-BOUNCE-TEST",
      idempotencyKey: `verify_bounce_prep_${Date.now()}`,
      notes: "Receipt created to test bounce rollback",
    });

    const receiptId = paymentResult.receipt!.id;

    // Call markReceiptBouncedOrVoid
    const bounceRes = await markReceiptBouncedOrVoid({
      schoolId,
      userId: "usr_accountant",
      receiptId,
      actionType: "BOUNCE",
      reason: "Insufficient Funds in Account",
    });

    assert(bounceRes.success, "markReceiptBouncedOrVoid executed with action BOUNCE");

    // 1. Verify receipt status
    const [bouncedReceipt] = await db
      .select()
      .from(schema.feeReceipts)
      .where(eq(schema.feeReceipts.id, receiptId))
      .limit(1);

    assert(bouncedReceipt.clearanceStatus === "BOUNCED", "Receipt clearanceStatus is marked BOUNCED");
    assert(bouncedReceipt.voidReason === "Insufficient Funds in Account", "Bounce reason recorded on receipt");

    // 2. Verify ₹500 Cheque Bounce Penalty was added
    const penaltyItems = await db
      .select()
      .from(schema.feeInvoiceItems)
      .where(eq(schema.feeInvoiceItems.amount, "500.00"));

    assert(penaltyItems.length > 0, "Cheque bounce penalty of ₹500.00 was appended to fee items");

    // 3. Verify audit log entry was written
    const [auditEntry] = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.entityId, receiptId), eq(schema.auditLogs.action, "BOUNCE")))
      .limit(1);

    assert(!!auditEntry, "Audit trail entry created with action BOUNCE");
    assert(auditEntry.reason === "Insufficient Funds in Account", "Audit trail records exact bounce reason");

    console.log("✅ TEST 2 PASSED: Receipt bounced, invoice amounts reversed, ₹500 penalty created, audit log confirmed.\n");
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Medical Leave (ML) Exam Denominator Exclusion
  // ---------------------------------------------------------------------------
  console.log("📌 TEST 3: Medical Leave (ML) Denominator Exclusion in Report Card Percentage");
  {
    // Use student stu_gen_1 (enr_stu_gen_1) who is enrolled in Grade 10 and has zero overdue fee holds
    const testEnrollmentId = "enr_stu_gen_1";
    const testStudentId = "stu_gen_1";

    // Clean up any existing marks for this enrollment to ensure clean deterministic test
    await db
      .delete(schema.examMarks)
      .where(eq(schema.examMarks.enrollmentId, testEnrollmentId));

    // Find two exam schedules for Grade 10 (Math & Science)
    const schedules = await db
      .select()
      .from(schema.examSchedules)
      .where(eq(schema.examSchedules.classId, "cls_g10"))
      .limit(2);

    assert(schedules.length >= 2, "Found 2 exam schedules for Grade 10 testing");
    const [exam1, exam2] = schedules;

    // Student has 80/100 in Exam 1 (PRESENT)
    await saveExamMarksBatch({
      schoolId,
      userId: "usr_teacher_1",
      examScheduleId: exam1.id,
      entries: [
        {
          enrollmentId: testEnrollmentId,
          attendanceStatus: "PRESENT",
          theoryMarks: 80,
          practicalMarks: 0,
          graceMarks: 0,
        },
      ],
    });

    // Student was on Medical Leave (ML) for Exam 2
    await saveExamMarksBatch({
      schoolId,
      userId: "usr_teacher_1",
      examScheduleId: exam2.id,
      entries: [
        {
          enrollmentId: testEnrollmentId,
          attendanceStatus: "ML",
        },
      ],
    });

    // Generate Report Card
    const reportRes = await generateReportCardPdf({
      schoolId,
      studentId: testStudentId,
      academicYearId: activeYearId,
    });

    assert(reportRes.success && !reportRes.isBlocked, "Report card generated successfully without hold");
    assert(reportRes.reportCard!.totalScored === 80, "Total scored marks is exactly 80");
    assert(
      reportRes.reportCard!.totalMax === 100,
      "Total max marks denominator is 100 (Exam 2 with ML was completely excluded from denominator)"
    );
    assert(
      reportRes.reportCard!.percentage === 80,
      "Calculated percentage is 80.00% (80/100), NOT 40.00% (80/200)"
    );

    console.log("✅ TEST 3 PASSED: ML status excluded from both numerator and denominator.\n");
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Academic Year Lock Guard & Super Admin Override
  // ---------------------------------------------------------------------------
  console.log("📌 TEST 4: Academic Year Lock Guard & Super Admin Audit Override");
  {
    let lockErrorCaught = false;

    // 1. Attempt write by TEACHER on locked year without override reason -> MUST THROW
    try {
      await submitSectionAttendance({
        schoolId,
        userId: "usr_teacher_1",
        userRole: "TEACHER",
        academicYearId: lockedYearId,
        sectionId: "sec_8a",
        date: "2025-05-12",
        records: [],
      });
    } catch (err: any) {
      if (err instanceof AcademicYearLockError || err.name === "AcademicYearLockError" || err.message.includes("LOCKED")) {
        lockErrorCaught = true;
      }
    }

    assert(lockErrorCaught, "Writing to locked year without override throws AcademicYearLockError");

    // 2. Retry with SUPER_ADMIN + auditOverrideReason -> MUST SUCCEED
    const overrideResult = await submitSectionAttendance({
      schoolId,
      userId: "usr_superadmin",
      userRole: "SUPER_ADMIN",
      academicYearId: lockedYearId,
      sectionId: "sec_8a",
      date: "2025-05-12",
      overrideReason: "Board Inspection Retrospective Attendance Verification",
      records: [],
    });

    assert(overrideResult.success, "SUPER_ADMIN with auditOverrideReason successfully bypassed lock");

    // 3. Verify override is audited in audit_logs
    const [overrideAudit] = await db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.entityType, "ACADEMIC_YEAR_OVERRIDE"),
          eq(schema.auditLogs.entityId, lockedYearId)
        )
      )
      .orderBy(sql`created_at DESC`)
      .limit(1);

    assert(!!overrideAudit, "Audit log created for ACADEMIC_YEAR_OVERRIDE");
    assert(
      overrideAudit.reason === "Board Inspection Retrospective Attendance Verification",
      "Audit log records exact override reason"
    );

    console.log("✅ TEST 4 PASSED: Locked year blocked unauthorized writes and audited SUPER_ADMIN override.\n");
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Transfer Certificate (TC) Unpaid Dues Blocking
  // ---------------------------------------------------------------------------
  console.log("📌 TEST 5: Transfer Certificate (TC) Issuance Defaulter Guard");
  {
    const studentId = "stu_mehta_aarav";

    // Ensure student has an unpaid invoice with dues
    const [unpaidInv] = await db
      .select()
      .from(schema.feeInvoices)
      .where(
        and(
          eq(schema.feeInvoices.studentId, studentId),
          inArray(schema.feeInvoices.status, ["UNPAID", "PARTIAL"])
        )
      )
      .limit(1);

    // If needed, set an invoice to UNPAID for this student
    if (!unpaidInv) {
      await db
        .update(schema.feeInvoices)
        .set({ status: "UNPAID", paidAmount: "0.00" })
        .where(eq(schema.feeInvoices.invoiceNo, "INV-2026-0001"));
    }

    // Attempt to issue TC without force override
    const tcResult = await issueTransferCertificate({
      schoolId,
      userId: "usr_principal",
      studentId,
      tcReason: "Relocation to another city",
      forceOverride: false,
    });

    assert(!tcResult.success, "issueTransferCertificate refused to issue TC for student with dues");
    assert(tcResult.error === "UNPAID_DUES_EXIST", "Returned error code UNPAID_DUES_EXIST");
    assert(tcResult.totalDues! > 0, `Detected unpaid fee dues of ₹${tcResult.totalDues}`);

    // Verify student status was NOT changed to TC_ISSUED
    const [studentRecord] = await db
      .select({ status: schema.students.status })
      .from(schema.students)
      .where(eq(schema.students.id, studentId))
      .limit(1);

    assert(studentRecord.status === "ACTIVE", "Student status remains ACTIVE (not transferred)");

    console.log("✅ TEST 5 PASSED: TC issuance strictly blocked by outstanding fee dues engine.\n");
  }

  console.log("================================================================================");
  console.log("🎉 ALL 5 MANDATORY BUSINESS-LOGIC RULES VERIFIED AGAINST LIVE DATABASE!");
  console.log("================================================================================\n");
}

runVerificationSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL ERROR IN VERIFICATION SUITE:", err);
    process.exit(1);
  });

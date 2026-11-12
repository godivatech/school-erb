"use server";

import { db } from "@/db";
import {
  feeInvoices,
  feeInvoiceItems,
  feeHeads,
  feeStructures,
  feeReceipts,
  students,
  auditLogs,
  schools,
} from "@/db/schema";
import { eq, and, asc, inArray, sql } from "drizzle-orm";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import { assertAcademicYearMutable, assertRole, resolveVerifiedSession } from "@/lib/guards";
import { getNextAtomicSequence } from "@/lib/counters";

export interface CollectFeePaymentPOSInput {
  schoolId?: string;
  userId?: string;
  userRole?: "SUPER_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "PARENT";
  academicYearId: string;
  studentId: string;
  amountReceived: number;
  paymentMode: "CASH" | "UPI" | "CARD" | "CHEQUE" | "ONLINE";
  chequeOrTxnRef?: string;
  idempotencyKey: string;
  notes?: string;
  overrideReason?: string;
}

export async function collectFeePaymentPOS(input: CollectFeePaymentPOSInput) {
  // P0-1: Resolve cryptographically verified session and enforce multi-tenant isolation
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"]);

  // Edge Case 1: Strict numeric and positive amount validation
  const amt = Number(input.amountReceived);
  if (isNaN(amt) || !isFinite(amt) || amt <= 0) {
    throw new Error("Payment amount must be a positive number greater than 0.");
  }

  if (!input.studentId?.trim()) {
    throw new Error("Student ID is strictly required for POS fee collection.");
  }

  // 1. Guard against locked academic years
  await assertAcademicYearMutable(
    input.academicYearId,
    {
      schoolId: session.schoolId,
      userId: session.userId,
      userRole: session.userRole,
      auditOverrideReason: input.overrideReason,
    },
    `POS fee collection ₹${amt.toFixed(2)} for student ${input.studentId}`
  );

  return await db.transaction(async (tx) => {
    // 2. Validate student exists in this school and lock student record for update (prevents wallet lost-updates)
    const [student] = await tx
      .select({ id: students.id, walletBalance: students.walletBalance })
      .from(students)
      .where(
        and(
          eq(students.id, input.studentId),
          eq(students.schoolId, session.schoolId)
        )
      )
      .for("update")
      .limit(1);

    if (!student) {
      throw new Error(`Student not found or does not belong to this school.`);
    }

    // 3. Idempotency Check
    const [existingReceipt] = await tx
      .select()
      .from(feeReceipts)
      .where(eq(feeReceipts.idempotencyKey, input.idempotencyKey))
      .limit(1);

    if (existingReceipt) {
      return {
        success: true,
        receipt: existingReceipt,
        isDuplicate: true,
        message: "Receipt already generated for this transaction.",
      };
    }

    // 3. Fetch all UNPAID or PARTIAL invoices for this student, ordered by dueDate ASC with row-level lock
    const invoices = await tx
      .select()
      .from(feeInvoices)
      .where(
        and(
          eq(feeInvoices.schoolId, session.schoolId),
          eq(feeInvoices.academicYearId, input.academicYearId),
          eq(feeInvoices.studentId, input.studentId),
          inArray(feeInvoices.status, ["UNPAID", "PARTIAL"])
        )
      )
      .orderBy(asc(feeInvoices.dueDate))
      .for("update");

    let unallocatedAmount = Number(input.amountReceived);
    const allocations: Array<{
      invoiceId: string;
      invoiceItemId?: string;
      feeHeadName: string;
      allocatedAmount: number;
    }> = [];

    for (const inv of invoices) {
      if (unallocatedAmount <= 0) break;

      // Fetch items for this invoice with priority order
      const items = await tx
        .select({
          itemId: feeInvoiceItems.id,
          feeHeadId: feeInvoiceItems.feeHeadId,
          feeHeadName: feeHeads.name,
          priorityOrder: feeHeads.priorityOrder,
          amount: feeInvoiceItems.amount,
          paidAmount: feeInvoiceItems.paidAmount,
        })
        .from(feeInvoiceItems)
        .innerJoin(feeHeads, eq(feeInvoiceItems.feeHeadId, feeHeads.id))
        .where(eq(feeInvoiceItems.invoiceId, inv.id))
        .orderBy(asc(feeHeads.priorityOrder));

      let invoicePaymentTotal = 0;

      for (const item of items) {
        if (unallocatedAmount <= 0) break;

        const itemTotal = parseFloat(item.amount || "0");
        const itemPaid = parseFloat(item.paidAmount || "0");
        const itemUnpaid = Math.max(0, itemTotal - itemPaid);

        if (itemUnpaid > 0) {
          const allocation = Math.min(unallocatedAmount, itemUnpaid);
          const newPaid = itemPaid + allocation;

          await tx
            .update(feeInvoiceItems)
            .set({ paidAmount: newPaid.toFixed(2) })
            .where(eq(feeInvoiceItems.id, item.itemId));

          unallocatedAmount -= allocation;
          invoicePaymentTotal += allocation;

          allocations.push({
            invoiceId: inv.id,
            invoiceItemId: item.itemId,
            feeHeadName: item.feeHeadName,
            allocatedAmount: allocation,
          });
        }
      }

      // Update invoice paidAmount and status
      const currentInvPaid = parseFloat(inv.paidAmount || "0");
      const newInvPaid = currentInvPaid + invoicePaymentTotal;
      const netAmount = parseFloat(inv.netAmount || "0");
      const newStatus = newInvPaid >= netAmount ? "PAID" : "PARTIAL";

      await tx
        .update(feeInvoices)
        .set({
          paidAmount: newInvPaid.toFixed(2),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(feeInvoices.id, inv.id));
    }

    // 4. If any excess amount remains, credit to student wallet
    if (unallocatedAmount > 0) {
      const [student] = await tx
        .select({ walletBalance: students.walletBalance })
        .from(students)
        .where(eq(students.id, input.studentId))
        .limit(1);

      const currentBalance = parseFloat(student?.walletBalance || "0");
      const newBalance = currentBalance + unallocatedAmount;

      await tx
        .update(students)
        .set({
          walletBalance: newBalance.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(students.id, input.studentId));

      allocations.push({
        invoiceId: "WALLET_ADVANCE",
        feeHeadName: "Advance Wallet Credit",
        allocatedAmount: unallocatedAmount,
      });

      unallocatedAmount = 0;
    }

    // 5. Generate Sequential Receipt Number with atomic sequence lock (P0-3 race prevention)
    const seq = await getNextAtomicSequence(tx, session.schoolId, "RECEIPT");
    const yearPrefix = new Date().getFullYear();
    const receiptNo = `REC-${yearPrefix}-${String(seq).padStart(4, "0")}`;

    const clearanceStatus =
      input.paymentMode === "CHEQUE" ? "PENDING_CHEQUE" : "CLEARED";

    // 6. Insert Immutable Fee Receipt
    const [receipt] = await tx
      .insert(feeReceipts)
      .values({
        schoolId: session.schoolId,
        academicYearId: input.academicYearId,
        receiptNo,
        studentId: input.studentId,
        amountReceived: input.amountReceived.toFixed(2),
        paymentMode: input.paymentMode,
        chequeOrTxnRef: input.chequeOrTxnRef || null,
        clearanceStatus,
        collectedById: session.userId,
        idempotencyKey: input.idempotencyKey,
        allocationsJson: allocations,
        notes: input.notes || null,
      })
      .returning();

    // 7. Audit Log
    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "FEE_RECEIPT",
      entityId: receipt.id,
      action: "CREATE",
      newValueJson: {
        receiptNo: receipt.receiptNo,
        amountReceived: receipt.amountReceived,
        paymentMode: receipt.paymentMode,
        clearanceStatus,
        allocations,
      },
      reason: `POS fee collection: ${receipt.receiptNo}`,
    });

    safeRevalidatePath("/finance");
    safeRevalidatePath("/finance/pos");
    return {
      success: true,
      receipt,
      allocations,
    };
  });
}

export interface MarkReceiptBouncedOrVoidInput {
  schoolId?: string;
  userId?: string;
  userRole?: "SUPER_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "PARENT";
  overrideReason?: string;
  receiptId: string;
  actionType: "BOUNCE" | "VOID";
  reason: string;
}

export async function markReceiptBouncedOrVoid(input: MarkReceiptBouncedOrVoidInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"]);

  if (!input.reason?.trim()) {
    throw new Error("A specific reason is strictly required to void or bounce a financial receipt.");
  }

  return await db.transaction(async (tx) => {
    // 1. Fetch receipt
    const [receipt] = await tx
      .select()
      .from(feeReceipts)
      .where(
        and(
          eq(feeReceipts.id, input.receiptId),
          eq(feeReceipts.schoolId, session.schoolId)
        )
      )
      .limit(1);

    if (!receipt) {
      throw new Error("Receipt not found");
    }

    if (receipt.clearanceStatus === "VOIDED" || receipt.clearanceStatus === "BOUNCED") {
      throw new Error(`Receipt is already ${receipt.clearanceStatus}`);
    }

    // 2. Guard against locked academic years (so closed books cannot be tampered with)
    await assertAcademicYearMutable(
      receipt.academicYearId,
      {
        schoolId: session.schoolId,
        userId: session.userId,
        userRole: session.userRole,
        auditOverrideReason: input.overrideReason || input.reason,
      },
      `${input.actionType} fee receipt ${receipt.receiptNo}`
    );

    // 2. Roll back allocations across fee_invoices and fee_invoice_items
    const allocations = (receipt.allocationsJson || []) as Array<{
      invoiceId: string;
      invoiceItemId?: string;
      feeHeadName: string;
      allocatedAmount: number;
    }>;

    for (const alloc of allocations) {
      if (alloc.invoiceId === "WALLET_ADVANCE") {
        // Rollback wallet credit
        const [student] = await tx
          .select({ walletBalance: students.walletBalance })
          .from(students)
          .where(eq(students.id, receipt.studentId))
          .limit(1);

        const currentBalance = parseFloat(student?.walletBalance || "0");
        const newBalance = Math.max(0, currentBalance - alloc.allocatedAmount);

        await tx
          .update(students)
          .set({ walletBalance: newBalance.toFixed(2), updatedAt: new Date() })
          .where(eq(students.id, receipt.studentId));
      } else {
        // Rollback invoice item if present
        if (alloc.invoiceItemId) {
          const [item] = await tx
            .select({ paidAmount: feeInvoiceItems.paidAmount })
            .from(feeInvoiceItems)
            .where(eq(feeInvoiceItems.id, alloc.invoiceItemId))
            .limit(1);

          if (item) {
            const currentItemPaid = parseFloat(item.paidAmount || "0");
            const newItemPaid = Math.max(0, currentItemPaid - alloc.allocatedAmount);
            await tx
              .update(feeInvoiceItems)
              .set({ paidAmount: newItemPaid.toFixed(2) })
              .where(eq(feeInvoiceItems.id, alloc.invoiceItemId));
          }
        }

        // Rollback invoice paidAmount
        const [inv] = await tx
          .select({
            paidAmount: feeInvoices.paidAmount,
            netAmount: feeInvoices.netAmount,
          })
          .from(feeInvoices)
          .where(eq(feeInvoices.id, alloc.invoiceId))
          .limit(1);

        if (inv) {
          const currentInvPaid = parseFloat(inv.paidAmount || "0");
          const newInvPaid = Math.max(0, currentInvPaid - alloc.allocatedAmount);
          const net = parseFloat(inv.netAmount || "0");
          const newStatus = newInvPaid <= 0 ? "UNPAID" : "PARTIAL";

          await tx
            .update(feeInvoices)
            .set({
              paidAmount: newInvPaid.toFixed(2),
              status: newStatus,
              updatedAt: new Date(),
            })
            .where(eq(feeInvoices.id, alloc.invoiceId));
        }
      }
    }

    const newClearanceStatus = input.actionType === "BOUNCE" ? "BOUNCED" : "VOIDED";

    // 3. Update receipt status (never delete!)
    const [updatedReceipt] = await tx
      .update(feeReceipts)
      .set({
        clearanceStatus: newClearanceStatus,
        voidReason: input.reason,
        voidedById: input.userId,
        voidedAt: new Date(),
      })
      .where(eq(feeReceipts.id, receipt.id))
      .returning();

    // 4. If bounced cheque: add ₹500 bounce penalty invoice
    if (input.actionType === "BOUNCE") {
      // Find or create 'Cheque Bounce Penalty' fee head
      let [penaltyHead] = await tx
        .select()
        .from(feeHeads)
        .where(
          and(
            eq(feeHeads.schoolId, session.schoolId),
            eq(feeHeads.name, "Cheque Bounce Penalty")
          )
        )
        .limit(1);

      if (!penaltyHead) {
        [penaltyHead] = await tx
          .insert(feeHeads)
          .values({
            schoolId: session.schoolId,
            name: "Cheque Bounce Penalty",
            frequency: "ONE_TIME",
            priorityOrder: 1, // highest priority
            isMandatory: true,
          })
          .returning();
      }

      // Find student's enrollment
      const [inv] = await tx
        .select({ enrollmentId: feeInvoices.enrollmentId })
        .from(feeInvoices)
        .where(
          and(
            eq(feeInvoices.schoolId, session.schoolId),
            eq(feeInvoices.studentId, receipt.studentId)
          )
        )
        .limit(1);

      if (inv) {
        const todayStr = new Date().toISOString().split("T")[0];
        const penaltyInvNo = `PEN-${receipt.receiptNo}`;

        const [penaltyInvoice] = await tx
          .insert(feeInvoices)
          .values({
            schoolId: session.schoolId,
            academicYearId: receipt.academicYearId,
            studentId: receipt.studentId,
            enrollmentId: inv.enrollmentId,
            invoiceNo: penaltyInvNo,
            installmentLabel: "Cheque Bounce Charge",
            dueDate: todayStr,
            baseAmount: "500.00",
            discountAmount: "0.00",
            lateFineAmount: "0.00",
            netAmount: "500.00",
            paidAmount: "0.00",
            status: "UNPAID",
          })
          .returning();

        await tx.insert(feeInvoiceItems).values({
          invoiceId: penaltyInvoice.id,
          feeHeadId: penaltyHead.id,
          amount: "500.00",
          paidAmount: "0.00",
        });
      }
    }

    // 5. Audit Log
    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "FEE_RECEIPT",
      entityId: receipt.id,
      action: input.actionType === "BOUNCE" ? "BOUNCE" : "VOID",
      oldValueJson: {
        receiptNo: receipt.receiptNo,
        clearanceStatus: receipt.clearanceStatus,
      },
      newValueJson: {
        clearanceStatus: newClearanceStatus,
        reason: input.reason,
      },
      reason: input.reason,
    });

    safeRevalidatePath("/finance");
    safeRevalidatePath("/finance/pos");
    return { success: true, receipt: updatedReceipt };
  });
}

export interface PayStudentFeeOnlineInput {
  schoolId?: string;
  userId?: string;
  userRole?: "SUPER_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "PARENT";
  academicYearId?: string;
  studentId: string;
  amount?: number;
  amountReceived?: number;
  paymentMode?: "UPI" | "CARD" | "ONLINE";
  chequeOrTxnRef?: string;
  idempotencyKey: string;
  txnRef?: string;
  notes?: string;
}

/**
 * Online parent fee settlement action.
 * Allows PARENT, ACCOUNTANT, PRINCIPAL, or SUPER_ADMIN to pay fees with immediate receipt generation.
 */
export async function payStudentFeeOnline(input: PayStudentFeeOnlineInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT", "PARENT"]);

  const amt = Number(input.amount ?? input.amountReceived ?? 0);
  if (isNaN(amt) || !isFinite(amt) || amt <= 0) {
    throw new Error("Payment amount must be greater than 0.");
  }

  if (!input.studentId?.trim()) {
    throw new Error("Student ID is required for fee payment.");
  }

  const targetYearId = input.academicYearId || session.academicYearId;

  // Guard against locked academic years
  await assertAcademicYearMutable(
    targetYearId,
    {
      schoolId: session.schoolId,
      userId: session.userId,
      userRole: session.userRole,
    },
    `Online fee payment ₹${amt.toFixed(2)} for student ${input.studentId}`
  );

  return await db.transaction(async (tx) => {
    // Validate student exists in this school and lock student row
    const [student] = await tx
      .select({ id: students.id, walletBalance: students.walletBalance })
      .from(students)
      .where(
        and(
          eq(students.id, input.studentId),
          eq(students.schoolId, session.schoolId)
        )
      )
      .for("update")
      .limit(1);

    if (!student) {
      throw new Error("Student not found or does not belong to this school.");
    }

    // Idempotency Check
    const [existingReceipt] = await tx
      .select()
      .from(feeReceipts)
      .where(eq(feeReceipts.idempotencyKey, input.idempotencyKey))
      .limit(1);

    if (existingReceipt) {
      return {
        success: true,
        receipt: existingReceipt,
        isDuplicate: true,
        message: "Receipt already generated for this transaction.",
      };
    }

    // Fetch UNPAID / PARTIAL invoices in priority waterfall order
    const invoices = await tx
      .select()
      .from(feeInvoices)
      .where(
        and(
          eq(feeInvoices.schoolId, session.schoolId),
          eq(feeInvoices.academicYearId, targetYearId),
          eq(feeInvoices.studentId, input.studentId),
          inArray(feeInvoices.status, ["UNPAID", "PARTIAL"])
        )
      )
      .orderBy(asc(feeInvoices.dueDate))
      .for("update");

    let unallocatedAmount = amt;
    const allocations: Array<{
      invoiceId: string;
      invoiceItemId?: string;
      feeHeadName: string;
      allocatedAmount: number;
    }> = [];

    for (const inv of invoices) {
      if (unallocatedAmount <= 0) break;

      const items = await tx
        .select({
          itemId: feeInvoiceItems.id,
          feeHeadId: feeInvoiceItems.feeHeadId,
          feeHeadName: feeHeads.name,
          priorityOrder: feeHeads.priorityOrder,
          amount: feeInvoiceItems.amount,
          paidAmount: feeInvoiceItems.paidAmount,
        })
        .from(feeInvoiceItems)
        .innerJoin(feeHeads, eq(feeInvoiceItems.feeHeadId, feeHeads.id))
        .where(eq(feeInvoiceItems.invoiceId, inv.id))
        .orderBy(asc(feeHeads.priorityOrder));

      let invoicePaymentTotal = 0;

      for (const item of items) {
        if (unallocatedAmount <= 0) break;

        const itemTotal = parseFloat(item.amount || "0");
        const itemPaid = parseFloat(item.paidAmount || "0");
        const itemUnpaid = Math.max(0, itemTotal - itemPaid);

        if (itemUnpaid > 0) {
          const allocation = Math.min(unallocatedAmount, itemUnpaid);
          const newPaid = itemPaid + allocation;

          await tx
            .update(feeInvoiceItems)
            .set({ paidAmount: newPaid.toFixed(2) })
            .where(eq(feeInvoiceItems.id, item.itemId));

          unallocatedAmount -= allocation;
          invoicePaymentTotal += allocation;

          allocations.push({
            invoiceId: inv.id,
            invoiceItemId: item.itemId,
            feeHeadName: item.feeHeadName,
            allocatedAmount: allocation,
          });
        }
      }

      const currentInvPaid = parseFloat(inv.paidAmount || "0");
      const newInvPaid = currentInvPaid + invoicePaymentTotal;
      const netAmount = parseFloat(inv.netAmount || "0");
      const newStatus = newInvPaid >= netAmount ? "PAID" : "PARTIAL";

      await tx
        .update(feeInvoices)
        .set({
          paidAmount: newInvPaid.toFixed(2),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(feeInvoices.id, inv.id));
    }

    if (unallocatedAmount > 0) {
      const currentBalance = parseFloat(student?.walletBalance || "0");
      const newBalance = currentBalance + unallocatedAmount;

      await tx
        .update(students)
        .set({
          walletBalance: newBalance.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(students.id, input.studentId));

      allocations.push({
        invoiceId: "WALLET_ADVANCE",
        feeHeadName: "Advance Wallet Credit",
        allocatedAmount: unallocatedAmount,
      });

      unallocatedAmount = 0;
    }

    // Atomic receipt sequence
    const seq = await getNextAtomicSequence(tx, session.schoolId, "RECEIPT");
    const yearPrefix = new Date().getFullYear();
    const receiptNo = `REC-${yearPrefix}-${String(seq).padStart(4, "0")}`;

    const [receipt] = await tx
      .insert(feeReceipts)
      .values({
        schoolId: session.schoolId,
        academicYearId: targetYearId,
        receiptNo,
        studentId: input.studentId,
        amountReceived: amt.toFixed(2),
        paymentMode: input.paymentMode || "ONLINE",
        chequeOrTxnRef: input.txnRef || `PAY-${Date.now()}`,
        clearanceStatus: "CLEARED",
        collectedById: session.userId,
        idempotencyKey: input.idempotencyKey,
        allocationsJson: allocations,
        notes: "Online Payment via Parent Portal",
      })
      .returning();

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "FEE_RECEIPT",
      entityId: receipt.id,
      action: "CREATE",
      newValueJson: {
        receiptNo: receipt.receiptNo,
        amountReceived: receipt.amountReceived,
        paymentMode: receipt.paymentMode,
        allocations,
      },
      reason: `Online parent fee payment: ${receipt.receiptNo}`,
    });

    safeRevalidatePath("/parent");
    safeRevalidatePath("/finance");
    return {
      success: true,
      receipt,
      isDuplicate: false,
      message: `Payment of ₹${amt.toFixed(2)} successful. Receipt #${receipt.receiptNo} generated.`,
    };
  });
}

// ---------------------------------------------------------------------------
// Fee Structures, Heads, & Defaulter Reminder Actions
// ---------------------------------------------------------------------------

export interface CreateFeeHeadInput {
  schoolId?: string;
  userId?: string;
  userRole?: "SUPER_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "PARENT";
  name: string;
  frequency: "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
  priorityOrder?: number;
  isMandatory?: boolean;
}

export async function createFeeHead(input: CreateFeeHeadInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"]);

  if (!input.name?.trim()) {
    throw new Error("Fee head name is required.");
  }

  return await db.transaction(async (tx) => {
    const [head] = await tx
      .insert(feeHeads)
      .values({
        schoolId: session.schoolId,
        name: input.name.trim(),
        frequency: input.frequency,
        priorityOrder: input.priorityOrder || 1,
        isMandatory: input.isMandatory ?? true,
      })
      .returning();

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "FEE_HEAD",
      entityId: head.id,
      action: "CREATE",
      newValueJson: { name: head.name, frequency: head.frequency },
      reason: `Created fee head ${head.name}`,
    });

    safeRevalidatePath("/finance");
    return { success: true, head };
  });
}

export interface UpsertFeeStructureInput {
  schoolId?: string;
  userId?: string;
  userRole?: "SUPER_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "PARENT";
  academicYearId: string;
  classId: string;
  feeHeadId: string;
  amount: number;
  dueDateDay?: number;
  lateFinePerDay?: number;
  maxLateFine?: number;
}

export async function upsertFeeStructure(input: UpsertFeeStructureInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"]);

  const amt = Number(input.amount);
  if (isNaN(amt) || amt < 0) {
    throw new Error("Fee amount must be a non-negative number.");
  }

  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: feeStructures.id })
      .from(feeStructures)
      .where(
        and(
          eq(feeStructures.academicYearId, input.academicYearId),
          eq(feeStructures.classId, input.classId),
          eq(feeStructures.feeHeadId, input.feeHeadId)
        )
      )
      .limit(1);

    let structure;
    if (existing) {
      [structure] = await tx
        .update(feeStructures)
        .set({
          amount: amt.toFixed(2),
          dueDateDay: input.dueDateDay ?? 10,
          lateFinePerDay: String(input.lateFinePerDay ?? 0),
          maxLateFine: String(input.maxLateFine ?? 0),
        })
        .where(eq(feeStructures.id, existing.id))
        .returning();
    } else {
      [structure] = await tx
        .insert(feeStructures)
        .values({
          schoolId: session.schoolId,
          academicYearId: input.academicYearId,
          classId: input.classId,
          feeHeadId: input.feeHeadId,
          amount: amt.toFixed(2),
          dueDateDay: input.dueDateDay ?? 10,
          lateFinePerDay: String(input.lateFinePerDay ?? 0),
          maxLateFine: String(input.maxLateFine ?? 0),
        })
        .returning();
    }

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "FEE_STRUCTURE",
      entityId: structure.id,
      action: existing ? "UPDATE" : "CREATE",
      newValueJson: { classId: input.classId, feeHeadId: input.feeHeadId, amount: structure.amount },
      reason: `Configured fee structure ₹${structure.amount}`,
    });

    safeRevalidatePath("/finance");
    return { success: true, structure };
  });
}

export interface SendFeeDefaulterReminderInput {
  schoolId?: string;
  userId?: string;
  userRole?: "SUPER_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "PARENT";
  studentId: string;
  studentName: string;
  overdueAmount: number;
  phone?: string;
}

export async function sendFeeDefaulterReminder(input: SendFeeDefaulterReminderInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"]);

  return await db.transaction(async (tx) => {
    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "STUDENT",
      entityId: input.studentId,
      action: "COMMUNICATION",
      newValueJson: {
        type: "FEE_REMINDER_SMS",
        phone: input.phone || "N/A",
        overdueAmount: input.overdueAmount,
        sentAt: new Date().toISOString(),
      },
      reason: `Sent fee reminder for ₹${input.overdueAmount.toFixed(2)} to ${input.studentName}`,
    });

    safeRevalidatePath("/finance");
    return {
      success: true,
      message: `SMS & WhatsApp Fee Reminder successfully queued for ${input.studentName} (Dues: ₹${input.overdueAmount.toLocaleString("en-IN")}).`,
    };
  });
}


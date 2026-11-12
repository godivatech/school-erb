import * as React from "react";
import { db } from "@/db";
import {
  feeReceipts,
  feeInvoices,
  feeHeads,
  feeStructures,
  students,
  families,
  classes,
  sections,
  enrollments,
  academicYears,
  schools,
} from "@/db/schema";
import { eq, and, or, desc, sql, asc } from "drizzle-orm";
import {
  FinanceClient,
  ReceiptRow,
  FeeHeadRow,
  FeeStructureRow,
  DefaulterRow,
} from "./finance-client";

export const dynamic = "force-dynamic";

import { getActiveContext } from "@/lib/context";

export default async function FinancePage() {
  // 1. Fetch active context from cookies
  const context = await getActiveContext();
  const yearId = context.academicYearId;
  const schoolId = context.schoolId;

  // 2. Fetch receipts with student, enrollment, and class info
  const rawReceipts = await db
    .select({
      id: feeReceipts.id,
      receiptNo: feeReceipts.receiptNo,
      amountReceived: feeReceipts.amountReceived,
      paymentMode: feeReceipts.paymentMode,
      chequeOrTxnRef: feeReceipts.chequeOrTxnRef,
      clearanceStatus: feeReceipts.clearanceStatus,
      createdAt: feeReceipts.createdAt,
      allocationsJson: feeReceipts.allocationsJson,
      notes: feeReceipts.notes,
      studentId: students.id,
      admissionNo: students.admissionNo,
      firstName: students.firstName,
      lastName: students.lastName,
      className: classes.name,
      sectionName: sections.name,
    })
    .from(feeReceipts)
    .innerJoin(students, eq(feeReceipts.studentId, students.id))
    .leftJoin(enrollments, eq(students.id, enrollments.studentId))
    .leftJoin(classes, eq(enrollments.classId, classes.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(eq(feeReceipts.schoolId, schoolId))
    .orderBy(desc(feeReceipts.createdAt));

  // Deduplicate by receipt id in case of multiple enrollments
  const seenReceipts = new Set<string>();
  const receipts: ReceiptRow[] = [];

  let totalCollection = 0;
  let activeCount = 0;
  let bouncedCount = 0;

  for (const r of rawReceipts) {
    if (!seenReceipts.has(r.id)) {
      seenReceipts.add(r.id);
      const amt = parseFloat(r.amountReceived);

      if (r.clearanceStatus === "CLEARED") {
        totalCollection += amt;
        activeCount++;
      } else if (r.clearanceStatus === "BOUNCED" || r.clearanceStatus === "VOIDED") {
        bouncedCount++;
      }

      receipts.push({
        id: r.id,
        receiptNo: r.receiptNo,
        studentName: `${r.firstName} ${r.lastName}`,
        admissionNo: r.admissionNo,
        className: r.className ? `${r.className} - ${r.sectionName}` : "General",
        amountReceived: amt,
        paymentMode: r.paymentMode as any,
        clearanceStatus: r.clearanceStatus as any,
        chequeOrTxnRef: r.chequeOrTxnRef,
        allocationsJson: r.allocationsJson,
        notes: r.notes,
        date: r.createdAt.toISOString().split("T")[0],
      });
    }
  }

  // 3. Fetch Fee Heads
  const rawHeads = await db
    .select()
    .from(feeHeads)
    .where(eq(feeHeads.schoolId, schoolId))
    .orderBy(asc(feeHeads.priorityOrder));

  const headsList: FeeHeadRow[] = rawHeads.map((h) => ({
    id: h.id,
    name: h.name,
    frequency: h.frequency,
    priorityOrder: h.priorityOrder,
    isMandatory: h.isMandatory,
  }));

  // 4. Fetch Classes
  const rawClasses = await db
    .select({
      id: classes.id,
      name: classes.name,
    })
    .from(classes)
    .where(eq(classes.schoolId, schoolId))
    .orderBy(asc(classes.numericOrder));

  // 5. Fetch Fee Structures for current academic year
  const rawStructures = await db
    .select({
      id: feeStructures.id,
      classId: feeStructures.classId,
      feeHeadId: feeStructures.feeHeadId,
      amount: feeStructures.amount,
      dueDateDay: feeStructures.dueDateDay,
      className: classes.name,
      feeHeadName: feeHeads.name,
    })
    .from(feeStructures)
    .innerJoin(classes, eq(feeStructures.classId, classes.id))
    .innerJoin(feeHeads, eq(feeStructures.feeHeadId, feeHeads.id))
    .where(
      and(
        eq(feeStructures.schoolId, schoolId),
        eq(feeStructures.academicYearId, yearId)
      )
    );

  const structuresList: FeeStructureRow[] = rawStructures.map((s) => ({
    id: s.id,
    classId: s.classId,
    className: s.className,
    feeHeadId: s.feeHeadId,
    feeHeadName: s.feeHeadName,
    amount: parseFloat(s.amount),
    dueDateDay: s.dueDateDay,
  }));

  // 6. Fetch Overdue Defaulters (invoices UNPAID or PARTIAL)
  const rawInvoices = await db
    .select({
      invoiceId: feeInvoices.id,
      invoiceNo: feeInvoices.invoiceNo,
      installmentLabel: feeInvoices.installmentLabel,
      studentId: feeInvoices.studentId,
      dueDate: feeInvoices.dueDate,
      netAmount: feeInvoices.netAmount,
      paidAmount: feeInvoices.paidAmount,
      status: feeInvoices.status,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNo: students.admissionNo,
      phone: families.primaryPhone,
      className: classes.name,
      sectionName: sections.name,
    })
    .from(feeInvoices)
    .innerJoin(students, eq(feeInvoices.studentId, students.id))
    .leftJoin(families, eq(students.familyId, families.id))
    .leftJoin(enrollments, eq(feeInvoices.enrollmentId, enrollments.id))
    .leftJoin(classes, eq(enrollments.classId, classes.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(
      and(
        eq(feeInvoices.schoolId, schoolId),
        eq(feeInvoices.academicYearId, yearId),
        or(eq(feeInvoices.status, "UNPAID"), eq(feeInvoices.status, "PARTIAL"))
      )
    )
    .orderBy(asc(feeInvoices.dueDate));

  const today = new Date();
  const defaulters: DefaulterRow[] = rawInvoices.map((inv) => {
    const due = new Date(inv.dueDate);
    const overdueDays = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
    const pendingAmount = Math.max(0, parseFloat(inv.netAmount) - parseFloat(inv.paidAmount));

    return {
      invoiceId: inv.invoiceId,
      invoiceNo: inv.invoiceNo,
      installmentLabel: inv.installmentLabel,
      studentId: inv.studentId,
      studentName: `${inv.firstName} ${inv.lastName}`,
      admissionNo: inv.admissionNo,
      className: inv.className ? `${inv.className} - ${inv.sectionName}` : "General",
      phone: inv.phone || null,
      dueDate: inv.dueDate,
      pendingAmount,
      overdueDays,
      status: inv.status,
    };
  });

  return (
    <FinanceClient
      receipts={receipts}
      totalCollectionToday={totalCollection}
      activeReceiptsCount={activeCount}
      bouncedCount={bouncedCount}
      feeHeads={headsList}
      classes={rawClasses}
      feeStructures={structuresList}
      defaulters={defaulters}
      isLocked={context.isLocked}
      schoolId={schoolId}
      academicYearId={yearId}
    />
  );
}

import * as React from "react";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  students,
  families,
  enrollments,
  classes,
  sections,
  feeInvoices,
  feeInvoiceItems,
  feeHeads,
  feeReceipts,
  academicYears,
} from "@/db/schema";
import { eq, and, or, desc, asc } from "drizzle-orm";
import { getActiveContext } from "@/lib/context";
import { StudentLedgerClient, StudentLedgerData } from "./student-ledger-client";

export const dynamic = "force-dynamic";

export default async function StudentLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getActiveContext();
  const schoolId = context.schoolId;
  const yearId = context.academicYearId;

  // 1. Fetch Student with family, enrollment, class, section
  const [studentRow] = await db
    .select({
      id: students.id,
      admissionNo: students.admissionNo,
      firstName: students.firstName,
      lastName: students.lastName,
      dob: students.dob,
      gender: students.gender,
      bloodGroup: students.bloodGroup,
      status: students.status,
      emergencyContact: students.emergencyContact,
      parentName: families.primaryParentName,
      parentPhone: families.primaryPhone,
      address: families.address,
      className: classes.name,
      sectionName: sections.name,
      rollNo: enrollments.rollNo,
    })
    .from(students)
    .innerJoin(families, eq(students.familyId, families.id))
    .leftJoin(
      enrollments,
      and(
        eq(students.id, enrollments.studentId),
        eq(enrollments.academicYearId, yearId)
      )
    )
    .leftJoin(classes, eq(enrollments.classId, classes.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(
      and(
        eq(students.schoolId, schoolId),
        or(eq(students.id, id), eq(students.admissionNo, id))
      )
    )
    .limit(1);

  if (!studentRow) {
    notFound();
  }

  // 2. Fetch Invoices for this student with line items
  const rawInvoices = await db
    .select({
      id: feeInvoices.id,
      invoiceNo: feeInvoices.invoiceNo,
      installmentLabel: feeInvoices.installmentLabel,
      dueDate: feeInvoices.dueDate,
      baseAmount: feeInvoices.baseAmount,
      discountAmount: feeInvoices.discountAmount,
      lateFineAmount: feeInvoices.lateFineAmount,
      netAmount: feeInvoices.netAmount,
      paidAmount: feeInvoices.paidAmount,
      status: feeInvoices.status,
      createdAt: feeInvoices.createdAt,
    })
    .from(feeInvoices)
    .where(
      and(
        eq(feeInvoices.schoolId, schoolId),
        eq(feeInvoices.studentId, studentRow.id),
        eq(feeInvoices.academicYearId, yearId)
      )
    )
    .orderBy(desc(feeInvoices.dueDate), desc(feeInvoices.createdAt));

  // Fetch items for each invoice
  const invoicesWithItems = await Promise.all(
    rawInvoices.map(async (inv) => {
      const items = await db
        .select({
          id: feeInvoiceItems.id,
          feeHeadName: feeHeads.name,
          amount: feeInvoiceItems.amount,
          paidAmount: feeInvoiceItems.paidAmount,
        })
        .from(feeInvoiceItems)
        .innerJoin(feeHeads, eq(feeInvoiceItems.feeHeadId, feeHeads.id))
        .where(eq(feeInvoiceItems.invoiceId, inv.id))
        .orderBy(asc(feeHeads.priorityOrder));

      return {
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        installmentLabel: inv.installmentLabel,
        dueDate: inv.dueDate,
        baseAmount: parseFloat(inv.baseAmount || "0"),
        discountAmount: parseFloat(inv.discountAmount || "0"),
        lateFineAmount: parseFloat(inv.lateFineAmount || "0"),
        netAmount: parseFloat(inv.netAmount || "0"),
        paidAmount: parseFloat(inv.paidAmount || "0"),
        balanceDue: Math.max(0, parseFloat(inv.netAmount || "0") - parseFloat(inv.paidAmount || "0")),
        status: inv.status,
        createdAt: inv.createdAt.toISOString(),
        items: items.map((it) => ({
          id: it.id,
          feeHeadName: it.feeHeadName,
          amount: parseFloat(it.amount || "0"),
          paidAmount: parseFloat(it.paidAmount || "0"),
        })),
      };
    })
  );

  // 3. Fetch all Receipts for this student
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
    })
    .from(feeReceipts)
    .where(
      and(
        eq(feeReceipts.schoolId, schoolId),
        eq(feeReceipts.studentId, studentRow.id)
      )
    )
    .orderBy(desc(feeReceipts.createdAt));

  const receiptsList = rawReceipts.map((r) => ({
    id: r.id,
    receiptNo: r.receiptNo,
    amountReceived: parseFloat(r.amountReceived || "0"),
    paymentMode: r.paymentMode,
    chequeOrTxnRef: r.chequeOrTxnRef,
    clearanceStatus: r.clearanceStatus,
    createdAt: r.createdAt.toISOString(),
    allocations: Array.isArray(r.allocationsJson) ? r.allocationsJson : [],
    notes: r.notes,
  }));

  // 4. Compute Totals
  const totalInvoiced = invoicesWithItems.reduce((sum, inv) => sum + inv.netAmount, 0);
  const totalPaid = invoicesWithItems.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const pendingDues = Math.max(0, totalInvoiced - totalPaid);

  const data: StudentLedgerData = {
    student: {
      id: studentRow.id,
      admissionNo: studentRow.admissionNo,
      name: `${studentRow.firstName} ${studentRow.lastName}`.trim(),
      className: studentRow.className ? `${studentRow.className} - ${studentRow.sectionName || "A"}` : "Unassigned",
      rollNo: studentRow.rollNo,
      dob: studentRow.dob,
      gender: studentRow.gender,
      bloodGroup: studentRow.bloodGroup,
      parentName: studentRow.parentName,
      parentPhone: studentRow.parentPhone,
      address: studentRow.address || "",
      emergencyContact: studentRow.emergencyContact || studentRow.parentPhone,
      status: studentRow.status,
    },
    yearName: context.academicYearName,
    financialSummary: {
      totalInvoiced,
      totalPaid,
      pendingDues,
      status: pendingDues > 0 ? "PENDING" : totalInvoiced > 0 ? "CLEARED" : "NO_INVOICE",
    },
    invoices: invoicesWithItems,
    receipts: receiptsList,
  };

  return <StudentLedgerClient initialData={data} />;
}

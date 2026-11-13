import * as React from "react";
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
  academicYears,
} from "@/db/schema";
import { eq, and, or, inArray, asc } from "drizzle-orm";
import { CashierPosClient, PosStudentInfo, PosFeeItem } from "./pos-client";
import { getActiveContext } from "@/lib/context";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CashierPosPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; studentId?: string }>;
}) {
  const params = await searchParams;

  // 1. Fetch active context from cookies
  const context = await getActiveContext();

  // Role guard: Only Accountants and Admins can collect fees
  if (context.user.role === "PARENT") {
    redirect("/parent");
  }
  if (context.user.role === "TEACHER") {
    redirect("/attendance");
  }

  const yearId = context.academicYearId;
  const schoolId = context.schoolId;
  const isLocked = context.isLocked;

  // Query: studentId or query string or default Aarav Mehta
  const query = params.query?.trim() || params.studentId?.trim() || "ADM-2026-0801";

  // 2. Look up student by admissionNo, phone, or name
  const [foundStudent] = await db
    .select({
      id: students.id,
      admissionNo: students.admissionNo,
      firstName: students.firstName,
      lastName: students.lastName,
      familyId: students.familyId,
      walletBalance: students.walletBalance,
      className: classes.name,
      sectionName: sections.name,
      parentName: families.primaryParentName,
      parentPhone: families.primaryPhone,
    })
    .from(students)
    .innerJoin(families, eq(students.familyId, families.id))
    .leftJoin(enrollments, eq(students.id, enrollments.studentId))
    .leftJoin(classes, eq(enrollments.classId, classes.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(
      and(
        eq(students.schoolId, schoolId),
        or(
          eq(students.admissionNo, query),
          eq(families.primaryPhone, query),
          eq(students.firstName, query)
        )
      )
    )
    .limit(1);

  let studentInfo: PosStudentInfo | null = null;
  const posFeeItems: PosFeeItem[] = [];

  if (foundStudent) {
    // 3. Check if there are siblings in the same family with unpaid dues!
    const siblings = await db
      .select({
        id: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        className: classes.name,
        sectionName: sections.name,
      })
      .from(students)
      .leftJoin(enrollments, eq(students.id, enrollments.studentId))
      .leftJoin(classes, eq(enrollments.classId, classes.id))
      .leftJoin(sections, eq(enrollments.sectionId, sections.id))
      .where(
        and(
          eq(students.schoolId, schoolId),
          eq(students.familyId, foundStudent.familyId),
        )
      );

    let siblingDuesInfo: { siblingName: string; dueAmount: number } | null = null;

    for (const sib of siblings) {
      if (sib.id !== foundStudent.id) {
        const sibInvoices = await db
          .select({
            netAmount: feeInvoices.netAmount,
            paidAmount: feeInvoices.paidAmount,
          })
          .from(feeInvoices)
          .where(
            and(
              eq(feeInvoices.schoolId, schoolId),
              eq(feeInvoices.studentId, sib.id),
              inArray(feeInvoices.status, ["UNPAID", "PARTIAL"])
            )
          );

        const sibDue = sibInvoices.reduce((sum, inv) => {
          const net = parseFloat(inv.netAmount || "0");
          const paid = parseFloat(inv.paidAmount || "0");
          return sum + Math.max(0, net - paid);
        }, 0);

        if (sibDue > 0) {
          siblingDuesInfo = {
            siblingName: `${sib.firstName} (${sib.className || "Class"} - ${sib.sectionName || "A"})`,
            dueAmount: sibDue,
          };
          break;
        }
      }
    }

    studentInfo = {
      id: foundStudent.id,
      admissionNo: foundStudent.admissionNo,
      name: `${foundStudent.firstName} ${foundStudent.lastName}`,
      className: foundStudent.className ? `${foundStudent.className} - ${foundStudent.sectionName}` : "General",
      parentName: foundStudent.parentName,
      parentPhone: foundStudent.parentPhone,
      walletBalance: parseFloat(foundStudent.walletBalance || "0"),
      siblingDues: siblingDuesInfo,
    };

    // 4. Fetch unpaid/partial invoices and their items
    const invoices = await db
      .select({
        invoiceId: feeInvoices.id,
        itemId: feeInvoiceItems.id,
        feeHeadName: feeHeads.name,
        priorityOrder: feeHeads.priorityOrder,
        amount: feeInvoiceItems.amount,
        paidAmount: feeInvoiceItems.paidAmount,
      })
      .from(feeInvoices)
      .innerJoin(feeInvoiceItems, eq(feeInvoices.id, feeInvoiceItems.invoiceId))
      .innerJoin(feeHeads, eq(feeInvoiceItems.feeHeadId, feeHeads.id))
      .where(
        and(
          eq(feeInvoices.schoolId, schoolId),
          eq(feeInvoices.studentId, foundStudent.id),
          eq(feeInvoices.academicYearId, yearId),
          inArray(feeInvoices.status, ["UNPAID", "PARTIAL"])
        )
      )
      .orderBy(asc(feeHeads.priorityOrder));

    for (const it of invoices) {
      posFeeItems.push({
        id: it.itemId,
        invoiceId: it.invoiceId,
        feeHeadName: it.feeHeadName,
        priorityOrder: it.priorityOrder,
        amount: parseFloat(it.amount),
        alreadyPaid: parseFloat(it.paidAmount || "0"),
        allocatedNow: Math.max(0, parseFloat(it.amount) - parseFloat(it.paidAmount || "0")),
      });
    }
  }

  return (
    <CashierPosClient
      initialStudent={studentInfo}
      initialFeeItems={posFeeItems}
      schoolId={schoolId}
      academicYearId={yearId}
      isLocked={isLocked}
      yearName={context.academicYearName}
    />
  );
}

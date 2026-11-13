import * as React from "react";
import { db } from "@/db";
import {
  students,
  families,
  enrollments,
  classes,
  sections,
  academicYears,
  feeInvoices,
} from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { StudentsClient, StudentListItem } from "./students-client";

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/context";

export default async function StudentsDirectoryPage() {
  // 1. Fetch active context from cookies
  const context = await getActiveContext();

  // Role guard: Parents have their own children in Parent Portal
  if (context.user.role === "PARENT") {
    redirect("/parent");
  }

  const yearId = context.academicYearId;
  const schoolId = context.schoolId;

  // 2. Fetch all students joined with families, enrollments, classes, sections
  const rows = await db
    .select({
      id: students.id,
      admissionNo: students.admissionNo,
      firstName: students.firstName,
      lastName: students.lastName,
      dob: students.dob,
      gender: students.gender,
      bloodGroup: students.bloodGroup,
      medicalFlags: students.medicalFlags,
      emergencyContact: students.emergencyContact,
      status: students.status,
      walletBalance: students.walletBalance,
      familyId: students.familyId,
      photoUrl: students.photoUrl,
      nationalId: students.nationalId,
      parentName: families.primaryParentName,
      parentPhone: families.primaryPhone,
      address: families.address,
      classId: classes.id,
      className: classes.name,
      sectionId: sections.id,
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
    .where(eq(students.schoolId, schoolId))
    .orderBy(classes.numericOrder, sections.name, asc(enrollments.rollNo), asc(students.firstName));

  // 3. Count siblings per family
  const familyCountRes = await db
    .select({
      familyId: students.familyId,
      count: sql<number>`count(*)`,
    })
    .from(students)
    .where(eq(students.schoolId, schoolId))
    .groupBy(students.familyId);

  const siblingCountMap = new Map<string, number>();
  for (const f of familyCountRes) {
    siblingCountMap.set(f.familyId, Math.max(0, Number(f.count) - 1));
  }

  // 3b. Fetch Fee Invoices summary per student for active academic year
  const invoiceSummaries = await db
    .select({
      studentId: feeInvoices.studentId,
      totalInvoiced: sql<number>`coalesce(sum(${feeInvoices.netAmount}), 0)`,
      totalPaid: sql<number>`coalesce(sum(${feeInvoices.paidAmount}), 0)`,
    })
    .from(feeInvoices)
    .where(
      and(
        eq(feeInvoices.schoolId, schoolId),
        eq(feeInvoices.academicYearId, yearId)
      )
    )
    .groupBy(feeInvoices.studentId);

  const studentFeeMap = new Map<string, { totalInvoiced: number; totalPaid: number; pendingDues: number }>();
  for (const inv of invoiceSummaries) {
    const invoiced = Number(inv.totalInvoiced) || 0;
    const paid = Number(inv.totalPaid) || 0;
    studentFeeMap.set(inv.studentId, {
      totalInvoiced: invoiced,
      totalPaid: paid,
      pendingDues: Math.max(0, invoiced - paid),
    });
  }

  // 4. Fetch Classes and Sections for filtering & section transfers
  const allClasses = await db
    .select({ id: classes.id, name: classes.name, order: classes.numericOrder })
    .from(classes)
    .where(eq(classes.schoolId, schoolId))
    .orderBy(classes.numericOrder);

  const allSections = await db
    .select({ id: sections.id, classId: sections.classId, name: sections.name, capacity: sections.capacity })
    .from(sections)
    .where(eq(sections.schoolId, schoolId));

  const studentList: StudentListItem[] = rows.map((r) => {
    const feeInfo = studentFeeMap.get(r.id) || { totalInvoiced: 0, totalPaid: 0, pendingDues: 0 };
    return {
      id: r.id,
      admissionNo: r.admissionNo,
      firstName: r.firstName,
      lastName: r.lastName,
      classId: r.classId || "",
      className: r.className || "Unassigned",
      sectionId: r.sectionId || "",
      sectionName: r.sectionName || "A",
      rollNo: r.rollNo || 0,
      gender: r.gender,
      bloodGroup: r.bloodGroup,
      medicalFlags: r.medicalFlags,
      emergencyContact: r.emergencyContact,
      parentName: r.parentName,
      parentPhone: r.parentPhone,
      address: r.address || "",
      walletBalance: parseFloat(r.walletBalance || "0"),
      totalInvoiced: feeInfo.totalInvoiced,
      totalPaid: feeInfo.totalPaid,
      pendingDues: feeInfo.pendingDues,
      status: r.status as any,
      familyId: r.familyId,
      photoUrl: r.photoUrl,
      nationalId: r.nationalId,
      siblingCount: siblingCountMap.get(r.familyId) || 0,
      dob: r.dob,
    };
  });

  return (
    <StudentsClient
      students={studentList}
      classes={allClasses}
      sections={allSections}
      academicYearId={yearId}
      schoolId={schoolId}
    />
  );
}

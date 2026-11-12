import * as React from "react";
import { db } from "@/db";
import {
  families,
  students,
  enrollments,
  classes,
  sections,
  feeInvoices,
  feeInvoiceItems,
  feeReceipts,
  attendance,
  schools,
  academicYears,
  studentLeaves,
  dailyHomework,
  subjects,
  users,
} from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { ParentPortalClient } from "./parent-client";
import { getActiveContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function ParentPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string; familyPhone?: string; familyId?: string }>;
}) {
  const params = await searchParams;
  const context = await getActiveContext();

  // 1. Fetch Family by familyId or phone within active school
  const phone = params.familyPhone || "9876543210";
  const [family] = await db
    .select()
    .from(families)
    .where(
      and(
        eq(families.schoolId, context.schoolId),
        params.familyId
          ? eq(families.id, params.familyId)
          : eq(families.primaryPhone, phone)
      )
    )
    .limit(1);

  if (!family) {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-lg">
        <h2 className="text-lg font-bold text-slate-800">Family Profile Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">
          No family profile linked with phone number {phone} in this school.
        </p>
      </div>
    );
  }

  // 2. Fetch all children belonging to this family
  const children = await db
    .select({
      id: students.id,
      admissionNo: students.admissionNo,
      firstName: students.firstName,
      lastName: students.lastName,
      dob: students.dob,
      gender: students.gender,
      bloodGroup: students.bloodGroup,
      walletBalance: students.walletBalance,
      status: students.status,
      enrollmentId: enrollments.id,
      classId: enrollments.classId,
      className: classes.name,
      sectionId: enrollments.sectionId,
      sectionName: sections.name,
      rollNo: enrollments.rollNo,
    })
    .from(students)
    .innerJoin(enrollments, eq(students.id, enrollments.studentId))
    .innerJoin(classes, eq(enrollments.classId, classes.id))
    .innerJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(
      and(
        eq(students.schoolId, context.schoolId),
        eq(students.familyId, family.id),
        eq(enrollments.academicYearId, context.academicYearId)
      )
    )
    .orderBy(classes.numericOrder);

  const selectedStudentId =
    params.studentId || children[0]?.id || "";

  // 3. For all children in family, fetch their outstanding dues to populate the Sibling Dues Banner
  const studentIds = children.map((c) => c.id);
  const allInvoices = studentIds.length > 0
    ? await db
        .select({
          id: feeInvoices.id,
          studentId: feeInvoices.studentId,
          invoiceNo: feeInvoices.invoiceNo,
          installmentLabel: feeInvoices.installmentLabel,
          dueDate: feeInvoices.dueDate,
          netAmount: feeInvoices.netAmount,
          paidAmount: feeInvoices.paidAmount,
          status: feeInvoices.status,
        })
        .from(feeInvoices)
        .where(
          and(
            eq(feeInvoices.schoolId, context.schoolId),
            inArray(feeInvoices.studentId, studentIds),
            inArray(feeInvoices.status, ["UNPAID", "PARTIAL"])
          )
        )
    : [];

  // Group invoices by student
  const duesByStudent: Record<string, { totalDue: number; invoices: typeof allInvoices }> = {};
  for (const stu of children) {
    const stuInvs = allInvoices.filter((inv) => inv.studentId === stu.id);
    const total = stuInvs.reduce((acc, inv) => {
      const net = parseFloat(inv.netAmount || "0");
      const paid = parseFloat(inv.paidAmount || "0");
      return acc + Math.max(0, net - paid);
    }, 0);
    duesByStudent[stu.id] = { totalDue: total, invoices: stuInvs };
  }

  // 4. Fetch recent attendance for the selected student using their actual enrollmentId
  const selectedChild = children.find((c) => c.id === selectedStudentId);
  const recentAttendance = selectedChild?.enrollmentId
    ? await db
        .select({
          date: attendance.date,
          status: attendance.status,
          remarks: attendance.remarks,
        })
        .from(attendance)
        .where(
          and(
            eq(attendance.schoolId, context.schoolId),
            eq(attendance.enrollmentId, selectedChild.enrollmentId),
            eq(attendance.academicYearId, context.academicYearId)
          )
        )
        .orderBy(desc(attendance.date))
        .limit(10)
    : [];

  // 5. Fetch recent receipts
  const receipts = selectedStudentId
    ? await db
        .select({
          receiptNo: feeReceipts.receiptNo,
          amountReceived: feeReceipts.amountReceived,
          paymentMode: feeReceipts.paymentMode,
          clearanceStatus: feeReceipts.clearanceStatus,
          createdAt: feeReceipts.createdAt,
        })
        .from(feeReceipts)
        .where(
          and(
            eq(feeReceipts.schoolId, context.schoolId),
            eq(feeReceipts.studentId, selectedStudentId)
          )
        )
        .orderBy(desc(feeReceipts.createdAt))
        .limit(5)
    : [];

  // 6. Fetch Student Leaves applied by parent for this child
  const appliedLeaves = selectedStudentId
    ? await db
        .select({
          id: studentLeaves.id,
          studentId: studentLeaves.studentId,
          startDate: studentLeaves.startDate,
          endDate: studentLeaves.endDate,
          leaveType: studentLeaves.leaveType,
          reason: studentLeaves.reason,
          status: studentLeaves.status,
          createdAt: studentLeaves.createdAt,
        })
        .from(studentLeaves)
        .where(
          and(
            eq(studentLeaves.schoolId, context.schoolId),
            eq(studentLeaves.studentId, selectedStudentId)
          )
        )
        .orderBy(desc(studentLeaves.createdAt))
        .limit(6)
    : [];

  // 7. Fetch Daily Homework for this child's section
  const homeworkList = selectedChild?.sectionId
    ? await db
        .select({
          id: dailyHomework.id,
          title: dailyHomework.title,
          description: dailyHomework.description,
          assignedDate: dailyHomework.assignedDate,
          dueDate: dailyHomework.dueDate,
          attachmentUrl: dailyHomework.attachmentUrl,
          subjectName: subjects.name,
          subjectCode: subjects.code,
          teacherName: users.name,
        })
        .from(dailyHomework)
        .innerJoin(subjects, eq(dailyHomework.subjectId, subjects.id))
        .leftJoin(users, eq(dailyHomework.teacherId, users.id))
        .where(
          and(
            eq(dailyHomework.schoolId, context.schoolId),
            eq(dailyHomework.academicYearId, context.academicYearId),
            eq(dailyHomework.sectionId, selectedChild.sectionId)
          )
        )
        .orderBy(desc(dailyHomework.assignedDate))
        .limit(10)
    : [];

  return (
    <ParentPortalClient
      family={family}
      children={children}
      selectedStudentId={selectedStudentId}
      duesByStudent={duesByStudent}
      recentAttendance={recentAttendance}
      receipts={receipts}
      appliedLeaves={appliedLeaves}
      homeworkList={homeworkList}
    />
  );
}

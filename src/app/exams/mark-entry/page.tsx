import * as React from "react";
import { db } from "@/db";
import {
  examSchedules,
  exams,
  classes,
  subjects,
  enrollments,
  students,
  examMarks,
  feeInvoices,
  academicYears,
} from "@/db/schema";
import { eq, and, asc, inArray, lte } from "drizzle-orm";
import {
  SpreadsheetMarkEntryClient,
  ScheduleOption,
  StudentMarkEntryRow,
} from "./mark-entry-client";
import { getActiveContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function SpreadsheetMarkEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ scheduleId?: string }>;
}) {
  const params = await searchParams;

  // 1. Fetch active context from cookies
  const context = await getActiveContext();
  const yearId = context.academicYearId;
  const schoolId = context.schoolId;

  // 2. Fetch available exam schedules
  const rawSchedules = await db
    .select({
      id: examSchedules.id,
      className: classes.name,
      classId: examSchedules.classId,
      subjectName: subjects.name,
      maxTheory: examSchedules.maxTheoryMarks,
      maxPractical: examSchedules.maxPracticalMarks,
      passMarks: examSchedules.passMarks,
      isLocked: examSchedules.isLocked,
    })
    .from(examSchedules)
    .innerJoin(classes, eq(examSchedules.classId, classes.id))
    .innerJoin(subjects, eq(examSchedules.subjectId, subjects.id))
    .where(eq(classes.schoolId, schoolId))
    .orderBy(classes.numericOrder, subjects.name);

  const schedules: ScheduleOption[] = rawSchedules.map((s) => ({
    id: s.id,
    className: s.className,
    subjectName: s.subjectName,
    maxTheory: parseFloat(s.maxTheory),
    maxPractical: parseFloat(s.maxPractical || "0"),
    passMarks: parseFloat(s.passMarks),
  }));

  const selectedScheduleId = params.scheduleId || schedules[0]?.id || "";
  const currentSchedule = rawSchedules.find((s) => s.id === selectedScheduleId) || rawSchedules[0];

  // 3. Fetch enrolled students in this class for the active year
  const studentRows = currentSchedule
    ? await db
        .select({
          enrollmentId: enrollments.id,
          studentId: students.id,
          rollNo: enrollments.rollNo,
          admissionNo: students.admissionNo,
          firstName: students.firstName,
          lastName: students.lastName,
        })
        .from(enrollments)
        .innerJoin(students, eq(enrollments.studentId, students.id))
        .where(
          and(
            eq(students.schoolId, schoolId),
            eq(enrollments.classId, currentSchedule.classId),
            eq(enrollments.academicYearId, yearId)
          )
        )
        .orderBy(asc(enrollments.rollNo), asc(students.firstName))
    : [];

  // 4. Fetch existing marks for this schedule
  const existingMarks = selectedScheduleId
    ? await db
        .select()
        .from(examMarks)
        .where(eq(examMarks.examScheduleId, selectedScheduleId))
    : [];

  const marksMap = new Map(existingMarks.map((m) => [m.enrollmentId, m]));

  // 5. Fetch overdue fee defaulters (due <= today)
  const todayStr = new Date().toISOString().split("T")[0];
  const overdueInvoices = await db
    .select({
      studentId: feeInvoices.studentId,
      netAmount: feeInvoices.netAmount,
      paidAmount: feeInvoices.paidAmount,
    })
    .from(feeInvoices)
    .where(
      and(
        eq(feeInvoices.schoolId, schoolId),
        inArray(feeInvoices.status, ["UNPAID", "PARTIAL"]),
        lte(feeInvoices.dueDate, todayStr)
      )
    );

  const defaulterMap = new Map<string, number>();
  for (const inv of overdueInvoices) {
    const due = Math.max(0, parseFloat(inv.netAmount || "0") - parseFloat(inv.paidAmount || "0"));
    if (due > 0) {
      defaulterMap.set(inv.studentId, (defaulterMap.get(inv.studentId) || 0) + due);
    }
  }

  // 6. Assemble mark entry rows
  const initialMarks: StudentMarkEntryRow[] = studentRows.map((stu, idx) => {
    const m = marksMap.get(stu.enrollmentId);
    const overdueAmt = defaulterMap.get(stu.studentId) || 0;

    return {
      enrollmentId: stu.enrollmentId,
      studentId: stu.studentId,
      rollNo: stu.rollNo || idx + 1,
      admissionNo: stu.admissionNo,
      name: `${stu.firstName} ${stu.lastName}`,
      theory: m?.theoryMarks ?? (m?.attendanceStatus === "AB" ? "AB" : m?.attendanceStatus === "ML" ? "ML" : m?.attendanceStatus === "EX" ? "EX" : ""),
      practical: m?.practicalMarks ?? (m?.attendanceStatus === "AB" ? "AB" : m?.attendanceStatus === "ML" ? "ML" : m?.attendanceStatus === "EX" ? "EX" : "0"),
      grace: parseFloat(m?.graceMarks || "0"),
      attendanceStatus: (m?.attendanceStatus as any) || "PRESENT",
      hasOverdueFee: overdueAmt > 0,
      overdueAmount: overdueAmt,
    };
  });

  return (
    <SpreadsheetMarkEntryClient
      schedules={schedules}
      selectedScheduleId={selectedScheduleId}
      initialMarks={initialMarks}
      maxTheory={currentSchedule ? parseFloat(currentSchedule.maxTheory) : 100}
      maxPractical={currentSchedule ? parseFloat(currentSchedule.maxPractical || "0") : 0}
      isLocked={context.isLocked}
      isScheduleLocked={!!currentSchedule?.isLocked}
      classId={currentSchedule?.classId || ""}
      schoolId={schoolId}
      academicYearId={yearId}
      userRole={context.user?.role}
    />
  );
}

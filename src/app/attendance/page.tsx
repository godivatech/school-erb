import * as React from "react";
import { db } from "@/db";
import {
  sections,
  classes,
  enrollments,
  students,
  families,
  attendance,
  users,
  studentLeaves,
} from "@/db/schema";
import { eq, and, asc, inArray, sql } from "drizzle-orm";
import {
  AttendanceClient,
  StudentAttendanceRow,
  ClassAttendanceSummary,
  DailyAbsenteeStudent,
} from "./attendance-client";
import { getActiveContext } from "@/lib/context";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ sectionId?: string; date?: string; view?: "grid" | "register" }>;
}) {
  const params = await searchParams;

  // 1. Fetch active context from cookies
  const context = await getActiveContext();

  // Role guard: Parents have attendance in their Parent Portal
  if (context.user.role === "PARENT") {
    redirect("/parent");
  }

  const yearId = context.academicYearId;
  const schoolId = context.schoolId;
  const isLocked = context.isLocked;
  const userRole = context.user.role;
  const todayStr = params.date || new Date().toISOString().split("T")[0];

  // 2. Fetch all sections
  const allSectionsRaw = await db
    .select({
      id: sections.id,
      name: sections.name,
      className: classes.name,
      teacherName: users.name,
    })
    .from(sections)
    .innerJoin(classes, eq(sections.classId, classes.id))
    .leftJoin(users, eq(sections.classTeacherId, users.id))
    .where(eq(classes.schoolId, schoolId))
    .orderBy(classes.numericOrder, sections.name);

  const selectedSectionId =
    params.sectionId || allSectionsRaw[0]?.id || "sec_10a";

  // 3. Fetch enrollments for the currently selected section
  const studentEnrollments = await db
    .select({
      enrollmentId: enrollments.id,
      studentId: students.id,
      rollNo: enrollments.rollNo,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNo: students.admissionNo,
      parentPhone: families.primaryPhone,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(families, eq(students.familyId, families.id))
    .where(
      and(
        eq(students.schoolId, schoolId),
        eq(enrollments.sectionId, selectedSectionId),
        eq(enrollments.academicYearId, yearId)
      )
    )
    .orderBy(asc(enrollments.rollNo), asc(students.firstName));

  // 4. Fetch existing attendance records for today across the entire school
  const existingRecords = await db
    .select({
      enrollmentId: attendance.enrollmentId,
      status: attendance.status,
      arrivalMinutesLate: attendance.arrivalMinutesLate,
      remarks: attendance.remarks,
    })
    .from(attendance)
    .where(
      and(
        eq(attendance.schoolId, schoolId),
        eq(attendance.academicYearId, yearId),
        eq(attendance.date, todayStr)
      )
    );

  const recordMap = new Map(existingRecords.map((r) => [r.enrollmentId, r]));

  // 4b. Fetch parent-applied student leaves for this date for the selected section
  const studentIds = studentEnrollments.map((e) => e.studentId);
  let activeLeaves: Array<{
    id: string;
    studentId: string;
    leaveType: string;
    reason: string;
  }> = [];

  if (studentIds.length > 0) {
    activeLeaves = await db
      .select({
        id: studentLeaves.id,
        studentId: studentLeaves.studentId,
        leaveType: studentLeaves.leaveType,
        reason: studentLeaves.reason,
      })
      .from(studentLeaves)
      .where(
        and(
          eq(studentLeaves.schoolId, schoolId),
          inArray(studentLeaves.studentId, studentIds),
          sql`${studentLeaves.startDate} <= ${todayStr} AND ${studentLeaves.endDate} >= ${todayStr}`
        )
      );
  }

  // 5. Merge into current section roster
  const rosterData: StudentAttendanceRow[] = studentEnrollments.map((e, index) => {
    const existing = recordMap.get(e.enrollmentId);
    return {
      enrollmentId: e.enrollmentId,
      studentId: e.studentId,
      rollNo: e.rollNo || index + 1,
      name: `${e.firstName} ${e.lastName}`,
      admissionNo: e.admissionNo,
      parentPhone: e.parentPhone,
      status: existing ? (existing.status as any) : "PRESENT",
      arrivalMinutesLate: existing?.arrivalMinutesLate || 0,
      remarks: existing?.remarks || undefined,
    };
  });

  // 6. Fetch ALL active enrollments across the ENTIRE SCHOOL for the class-wise register
  const allSchoolEnrollments = await db
    .select({
      enrollmentId: enrollments.id,
      sectionId: enrollments.sectionId,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNo: students.admissionNo,
      parentPhone: families.primaryPhone,
      className: classes.name,
      sectionName: sections.name,
      classOrder: classes.numericOrder,
      teacherName: users.name,
      capacity: sections.capacity,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(sections, eq(enrollments.sectionId, sections.id))
    .innerJoin(classes, eq(sections.classId, classes.id))
    .innerJoin(families, eq(students.familyId, families.id))
    .leftJoin(users, eq(sections.classTeacherId, users.id))
    .where(
      and(
        eq(students.schoolId, schoolId),
        eq(enrollments.academicYearId, yearId),
        eq(students.status, "ACTIVE")
      )
    )
    .orderBy(classes.numericOrder, sections.name, asc(students.firstName));

  // 7. Fetch all school parent-applied leaves for today
  const allSchoolLeaves = await db
    .select({
      id: studentLeaves.id,
      studentId: studentLeaves.studentId,
      leaveType: studentLeaves.leaveType,
      reason: studentLeaves.reason,
    })
    .from(studentLeaves)
    .where(
      and(
        eq(studentLeaves.schoolId, schoolId),
        sql`${studentLeaves.startDate} <= ${todayStr} AND ${studentLeaves.endDate} >= ${todayStr}`
      )
    );

  const leavesByStudent = new Map(allSchoolLeaves.map((l) => [l.studentId, l]));

  // 8. Build class-wise daily attendance summaries & absentee directory
  const classSummariesMap = new Map<string, ClassAttendanceSummary>();
  for (const sec of allSectionsRaw) {
    classSummariesMap.set(sec.id, {
      sectionId: sec.id,
      className: sec.className,
      sectionName: sec.name,
      teacherName: sec.teacherName || null,
      capacity: 40,
      totalEnrolled: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      mlCount: 0,
      halfDayCount: 0,
      isSubmitted: false,
      attendancePct: "N/A",
    });
  }

  const allSchoolAbsentees: DailyAbsenteeStudent[] = [];

  for (const enr of allSchoolEnrollments) {
    const summary = classSummariesMap.get(enr.sectionId);
    if (summary) {
      summary.totalEnrolled += 1;
      summary.capacity = enr.capacity;
    }

    const att = recordMap.get(enr.enrollmentId);
    if (att) {
      if (summary) summary.isSubmitted = true;
      if (att.status === "PRESENT") {
        if (summary) summary.presentCount += 1;
      } else if (att.status === "ABSENT") {
        if (summary) summary.absentCount += 1;
        const leave = leavesByStudent.get(enr.studentId);
        allSchoolAbsentees.push({
          studentId: enr.studentId,
          enrollmentId: enr.enrollmentId,
          admissionNo: enr.admissionNo,
          name: `${enr.firstName} ${enr.lastName}`,
          className: enr.className,
          sectionName: enr.sectionName,
          parentPhone: enr.parentPhone,
          status: "ABSENT",
          remarks: att.remarks || undefined,
          appliedLeaveType: leave?.leaveType,
          appliedLeaveReason: leave?.reason,
        });
      } else if (att.status === "LATE") {
        if (summary) summary.lateCount += 1;
      } else if (att.status === "MEDICAL_LEAVE") {
        if (summary) summary.mlCount += 1;
        const leave = leavesByStudent.get(enr.studentId);
        allSchoolAbsentees.push({
          studentId: enr.studentId,
          enrollmentId: enr.enrollmentId,
          admissionNo: enr.admissionNo,
          name: `${enr.firstName} ${enr.lastName}`,
          className: enr.className,
          sectionName: enr.sectionName,
          parentPhone: enr.parentPhone,
          status: "MEDICAL_LEAVE",
          remarks: att.remarks || undefined,
          appliedLeaveType: leave?.leaveType,
          appliedLeaveReason: leave?.reason,
        });
      } else if (att.status === "HALF_DAY") {
        if (summary) summary.halfDayCount += 1;
      }
    }
  }

  for (const summary of classSummariesMap.values()) {
    if (summary.isSubmitted) {
      const activeMarked =
        summary.presentCount +
        summary.absentCount +
        summary.lateCount +
        summary.halfDayCount +
        summary.mlCount;
      summary.attendancePct =
        activeMarked > 0
          ? ((summary.presentCount / activeMarked) * 100).toFixed(1)
          : "100.0";
    }
  }

  const classSummaries = Array.from(classSummariesMap.values());

  const initialTab: "grid" | "register" =
    params.view === "grid"
      ? "grid"
      : params.view === "register"
      ? "register"
      : params.sectionId
      ? "grid"
      : userRole === "SUPER_ADMIN" || userRole === "PRINCIPAL"
      ? "register"
      : "grid";

  return (
    <AttendanceClient
      sections={allSectionsRaw}
      selectedSectionId={selectedSectionId}
      currentDate={todayStr}
      rosterData={rosterData}
      activeLeaves={activeLeaves}
      isLocked={isLocked}
      academicYearId={yearId}
      schoolId={schoolId}
      classSummaries={classSummaries}
      allSchoolAbsentees={allSchoolAbsentees}
      userRole={userRole}
      initialTab={initialTab}
    />
  );
}

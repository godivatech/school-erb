import * as React from "react";
import { db } from "@/db";
import {
  timetableSlots,
  classes,
  sections,
  subjects,
  users,
  substitutions,
  staffLeaves,
  academicYears,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { TimetableClient } from "./timetable-client";
import { getActiveContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ sectionId?: string; day?: string }>;
}) {
  const params = await searchParams;

  // 1. Fetch active context from cookies
  const context = await getActiveContext();
  const yearId = context.academicYearId;
  const schoolId = context.schoolId;

  // 2. Fetch all sections
  const allSections = await db
    .select({
      id: sections.id,
      name: sections.name,
      className: classes.name,
    })
    .from(sections)
    .innerJoin(classes, eq(sections.classId, classes.id))
    .where(eq(classes.schoolId, schoolId))
    .orderBy(classes.numericOrder, sections.name);

  const selectedSectionId = params.sectionId || allSections[0]?.id || "sec_10a";

  // 3. Fetch timetable slots for the active year with class & section details
  const rawSlots = await db
    .select({
      id: timetableSlots.id,
      sectionId: timetableSlots.sectionId,
      sectionName: sections.name,
      className: classes.name,
      dayOfWeek: timetableSlots.dayOfWeek,
      periodNo: timetableSlots.periodNo,
      roomNo: timetableSlots.roomNo,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      teacherId: timetableSlots.teacherId,
      teacherName: users.name,
    })
    .from(timetableSlots)
    .innerJoin(sections, eq(timetableSlots.sectionId, sections.id))
    .innerJoin(classes, eq(sections.classId, classes.id))
    .innerJoin(subjects, eq(timetableSlots.subjectId, subjects.id))
    .leftJoin(users, eq(timetableSlots.teacherId, users.id))
    .where(
      and(
        eq(subjects.schoolId, schoolId),
        eq(timetableSlots.academicYearId, yearId)
      )
    );

  // 4. Clash Detection: Find any teacher assigned to more than 1 section in the same day and period
  // Key = teacherId_d_p -> Array of slot objects
  const teacherSlotIndex: Record<string, typeof rawSlots> = {};
  for (const s of rawSlots) {
    if (s.teacherId) {
      const key = `${s.teacherId}_d${s.dayOfWeek}_p${s.periodNo}`;
      if (!teacherSlotIndex[key]) {
        teacherSlotIndex[key] = [];
      }
      teacherSlotIndex[key].push(s);
    }
  }

  // Clash map with exact colliding class & section details
  const clashesMap: Record<
    string,
    Array<{
      otherClass: string;
      otherSection: string;
      otherSubject: string;
      otherRoom: string | null;
      teacherName: string;
    }>
  > = {};

  for (const group of Object.values(teacherSlotIndex)) {
    if (group.length > 1) {
      for (const slot of group) {
        const others = group.filter((o) => o.id !== slot.id);
        clashesMap[slot.id] = others.map((o) => ({
          otherClass: o.className,
          otherSection: o.sectionName,
          otherSubject: o.subjectName,
          otherRoom: o.roomNo,
          teacherName: o.teacherName || "Teacher",
        }));
      }
    }
  }

  const slots = rawSlots.map((s) => ({
    id: s.id,
    sectionId: s.sectionId,
    dayOfWeek: s.dayOfWeek,
    periodNo: s.periodNo,
    roomNo: s.roomNo,
    subjectName: s.subjectName,
    subjectCode: s.subjectCode,
    teacherId: s.teacherId,
    teacherName: s.teacherName,
    className: s.className,
    sectionName: s.sectionName,
  }));

  // 5. Daily Substitution Recommender:
  // Fetch teachers on approved leave today
  const todayStr = new Date().toISOString().split("T")[0];
  const leavesToday = await db
    .select({
      leaveId: staffLeaves.id,
      staffId: staffLeaves.staffId,
      reason: staffLeaves.reason,
      leaveType: staffLeaves.leaveType,
    })
    .from(staffLeaves)
    .where(
      and(
        eq(staffLeaves.schoolId, schoolId),
        eq(staffLeaves.status, "APPROVED"),
        sql`${staffLeaves.startDate} <= ${todayStr} AND ${staffLeaves.endDate} >= ${todayStr}`
      )
    );

  // Fetch active teachers
  const allTeachers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(
      and(
        eq(users.schoolId, schoolId),
        eq(users.role, "TEACHER")
      )
    );

  // Fetch today's substitutions
  const activeSubs = await db
    .select({
      id: substitutions.id,
      date: substitutions.date,
      timetableSlotId: substitutions.timetableSlotId,
      absentTeacherName: sql<string>`(SELECT name FROM users WHERE id = ${substitutions.absentTeacherId})`,
      substituteTeacherName: sql<string>`(SELECT name FROM users WHERE id = ${substitutions.substituteTeacherId})`,
      status: substitutions.status,
      notes: substitutions.notes,
    })
    .from(substitutions)
    .where(
      and(
        eq(substitutions.schoolId, schoolId),
        eq(substitutions.date, todayStr)
      )
    );

  // Fetch master subjects
  const allSubjects = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      code: subjects.code,
    })
    .from(subjects)
    .where(eq(subjects.schoolId, schoolId))
    .orderBy(subjects.name);

  return (
    <TimetableClient
      allSections={allSections}
      selectedSectionId={selectedSectionId}
      slots={slots}
      clashesMap={clashesMap}
      activeSubs={activeSubs}
      allTeachers={allTeachers}
      allSubjects={allSubjects}
      academicYearId={yearId}
      schoolId={schoolId}
      todayStr={todayStr}
      isYearLocked={context.isLocked}
    />
  );
}

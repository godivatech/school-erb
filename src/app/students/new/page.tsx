import * as React from "react";
import { db } from "@/db";
import { classes, sections, academicYears, students, enrollments, schoolCounters } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { NewStudentAdmissionClient, ClassOption } from "./admission-client";
import { getActiveContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function NewStudentAdmissionPage() {
  // 1. Fetch active context from cookies
  const context = await getActiveContext();
  const yearId = context.academicYearId;
  const schoolId = context.schoolId;

  // 2. Fetch classes with their sections and enrollment counts
  const allClasses = await db
    .select()
    .from(classes)
    .where(eq(classes.schoolId, schoolId))
    .orderBy(classes.numericOrder);

  const allSections = await db
    .select()
    .from(sections)
    .where(eq(sections.schoolId, schoolId));

  const enrollmentCounts = await db
    .select({
      sectionId: enrollments.sectionId,
      count: sql<number>`count(*)`,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.schoolId, schoolId),
        eq(enrollments.academicYearId, yearId),
        eq(enrollments.promotionStatus, "ACTIVE")
      )
    )
    .groupBy(enrollments.sectionId);

  const countMap = new Map(enrollmentCounts.map((e) => [e.sectionId, Number(e.count)]));

  const classOptions: ClassOption[] = allClasses.map((cls) => {
    const secList = allSections
      .filter((s) => s.classId === cls.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        capacity: s.capacity || 40,
        enrolledCount: countMap.get(s.id) || 0,
      }));
    return {
      id: cls.id,
      name: cls.name,
      sections: secList,
    };
  });

  // 3. Generate sequential next admission number using atomic counter
  const [counter] = await db
    .select({ currentVal: schoolCounters.currentVal })
    .from(schoolCounters)
    .where(
      and(
        eq(schoolCounters.schoolId, schoolId),
        eq(schoolCounters.entityType, "ADMISSION")
      )
    )
    .limit(1);

  let nextSeq = (counter?.currentVal || 0) + 1;
  if (!counter) {
    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .where(eq(students.schoolId, schoolId));
    nextSeq = Number(countRes[0]?.count || 0) + 1;
  }
  const defaultAdmNo = `ADM-2026-${String(nextSeq).padStart(4, "0")}`;

  return (
    <NewStudentAdmissionClient
      classes={classOptions}
      academicYearId={yearId}
      academicYearName={context.academicYearName}
      isLocked={context.isLocked}
      schoolId={schoolId}
      defaultAdmNo={defaultAdmNo}
    />
  );
}

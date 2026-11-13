import * as React from "react";
import { db } from "@/db";
import {
  examTerms,
  exams,
  examSchedules,
  classes,
  subjects,
} from "@/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { getActiveContext } from "@/lib/context";
import {
  ExamsClient,
  TermItem,
  ExamItem,
  ScheduleItem,
  ClassOption,
  SubjectOption,
} from "./exams-client";

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default async function ExamsOverviewPage() {
  const context = await getActiveContext();

  // Role guard: Parents have marks in their Parent Portal
  if (context.user.role === "PARENT") {
    redirect("/parent");
  }
  if (context.user.role === "ACCOUNTANT") {
    redirect("/finance");
  }

  const yearId = context.academicYearId;
  const schoolId = context.schoolId;

  // 1. Fetch terms
  const terms = await db
    .select({
      id: examTerms.id,
      name: examTerms.name,
      weightagePercent: examTerms.weightagePercent,
      orderIndex: examTerms.orderIndex,
    })
    .from(examTerms)
    .where(
      and(
        eq(examTerms.schoolId, schoolId),
        eq(examTerms.academicYearId, yearId)
      )
    )
    .orderBy(asc(examTerms.orderIndex));

  // 2. Fetch all exams
  const allExams = await db
    .select({
      id: exams.id,
      termId: exams.termId,
      name: exams.name,
      aggregationRule: exams.aggregationRule,
      weightage: exams.weightage,
    })
    .from(exams)
    .where(eq(exams.schoolId, schoolId));

  // 3. Fetch scheduled papers with class & subject names
  const rawSchedules = await db
    .select({
      id: examSchedules.id,
      examId: examSchedules.examId,
      className: classes.name,
      subjectName: subjects.name,
      examDate: examSchedules.examDate,
      maxTheory: examSchedules.maxTheoryMarks,
      maxPractical: examSchedules.maxPracticalMarks,
      passMarks: examSchedules.passMarks,
    })
    .from(examSchedules)
    .innerJoin(classes, eq(examSchedules.classId, classes.id))
    .innerJoin(subjects, eq(examSchedules.subjectId, subjects.id))
    .where(eq(classes.schoolId, schoolId))
    .orderBy(desc(examSchedules.examDate));

  const schedulesCount = await db
    .select({
      examId: examSchedules.examId,
    })
    .from(examSchedules)
    .innerJoin(classes, eq(examSchedules.classId, classes.id))
    .where(eq(classes.schoolId, schoolId));

  const scheduleCountsMap: Record<string, number> = {};
  for (const s of schedulesCount) {
    scheduleCountsMap[s.examId] = (scheduleCountsMap[s.examId] || 0) + 1;
  }

  // 4. Fetch classes and subjects for scheduling form
  const rawClasses = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(eq(classes.schoolId, schoolId))
    .orderBy(classes.name);

  const rawSubjects = await db
    .select({ id: subjects.id, name: subjects.name, code: subjects.code })
    .from(subjects)
    .where(eq(subjects.schoolId, schoolId))
    .orderBy(subjects.name);

  return (
    <ExamsClient
      schoolId={schoolId}
      academicYearId={yearId}
      academicYearName={context.academicYearName}
      isLocked={context.isLocked}
      terms={terms}
      allExams={allExams}
      schedules={rawSchedules}
      scheduleCountsMap={scheduleCountsMap}
      classesList={rawClasses}
      subjectsList={rawSubjects}
    />
  );
}

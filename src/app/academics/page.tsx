import * as React from "react";
import { db } from "@/db";
import {
  academicYears,
  classes,
  sections,
  subjects,
  classSubjects,
  holidays,
  dailyHomework,
} from "@/db/schema";
import { eq, asc, desc, and } from "drizzle-orm";
import {
  AcademicsClient,
  AcademicYearData,
  ClassData,
  SubjectData,
  HolidayData,
} from "./academics-client";

export const dynamic = "force-dynamic";

export default async function AcademicsPage() {
  // 1. Fetch all academic years
  const rawYears = await db
    .select()
    .from(academicYears)
    .orderBy(asc(academicYears.startDate));

  const years: AcademicYearData[] = rawYears.map((y) => ({
    id: y.id,
    name: y.name,
    startDate: y.startDate,
    endDate: y.endDate,
    status: y.status as any,
  }));

  const activeYear: AcademicYearData = years.find((y) => y.status === "ACTIVE") || years[0] || {
    id: "ay_2026_2027",
    name: "2026-2027",
    startDate: "2026-06-01",
    endDate: "2027-04-30",
    status: "ACTIVE",
  };
  const schoolId = rawYears[0]?.schoolId || "sch_oxford_001";

  // 2. Fetch classes with their sections and subjects count
  const rawClasses = await db
    .select()
    .from(classes)
    .where(eq(classes.schoolId, schoolId))
    .orderBy(classes.numericOrder);

  const rawSections = await db
    .select()
    .from(sections)
    .where(eq(sections.schoolId, schoolId));

  const rawClassSubjects = activeYear.id
    ? await db
        .select()
        .from(classSubjects)
        .where(eq(classSubjects.academicYearId, activeYear.id))
    : [];

  const classesList: ClassData[] = rawClasses.map((cls) => {
    const classSecs = rawSections.filter((s) => s.classId === cls.id);
    const secIds = new Set(classSecs.map((s) => s.id));
    const matchingClassSubjects = rawClassSubjects.filter((cs) => secIds.has(cs.sectionId));
    const assignedSubjectIds = Array.from(new Set(matchingClassSubjects.map((cs) => cs.subjectId)));

    return {
      id: cls.id,
      name: cls.name,
      order: cls.numericOrder,
      stream: cls.stream,
      sections: classSecs.map((s) => ({
        id: s.id,
        name: s.name,
        capacity: s.capacity,
      })),
      subjectsCount: assignedSubjectIds.length,
      assignedSubjectIds,
    };
  });

  // 3. Fetch Master Subjects
  const rawSubjects = await db
    .select()
    .from(subjects)
    .where(eq(subjects.schoolId, schoolId))
    .orderBy(subjects.code);

  const subjectsList: SubjectData[] = rawSubjects.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    type: s.type,
    includeInCgpa: s.includeInCgpa,
  }));

  // 4. Fetch Holidays
  const rawHolidays = activeYear.id
    ? await db
        .select()
        .from(holidays)
        .where(eq(holidays.academicYearId, activeYear.id))
        .orderBy(asc(holidays.date))
    : [];

  const holidaysList: HolidayData[] = rawHolidays.map((h) => ({
    id: h.id,
    date: h.date,
    title: h.title,
    isEmergency: h.isEmergencyHoliday,
  }));

  // 5. Fetch Daily Homework
  const rawHomework = activeYear.id
    ? await db
        .select({
          id: dailyHomework.id,
          title: dailyHomework.title,
          description: dailyHomework.description,
          assignedDate: dailyHomework.assignedDate,
          dueDate: dailyHomework.dueDate,
          attachmentUrl: dailyHomework.attachmentUrl,
          createdAt: dailyHomework.createdAt,
          subjectName: subjects.name,
          subjectCode: subjects.code,
          sectionName: sections.name,
          className: classes.name,
        })
        .from(dailyHomework)
        .innerJoin(subjects, eq(dailyHomework.subjectId, subjects.id))
        .innerJoin(sections, eq(dailyHomework.sectionId, sections.id))
        .innerJoin(classes, eq(sections.classId, classes.id))
        .where(
          and(
            eq(dailyHomework.schoolId, schoolId),
            eq(dailyHomework.academicYearId, activeYear.id)
          )
        )
        .orderBy(desc(dailyHomework.assignedDate))
        .limit(50)
    : [];

  const homeworkList = rawHomework.map((h) => ({
    id: h.id,
    title: h.title,
    description: h.description,
    assignedDate: h.assignedDate,
    dueDate: h.dueDate,
    attachmentUrl: h.attachmentUrl,
    subjectName: h.subjectName,
    subjectCode: h.subjectCode,
    sectionName: `${h.className} - Sec ${h.sectionName}`,
    createdAt: h.createdAt.toISOString(),
  }));

  return (
    <AcademicsClient
      academicYears={years}
      classes={classesList}
      subjects={subjectsList}
      holidays={holidaysList}
      homeworkList={homeworkList}
      activeYear={activeYear}
      schoolId={schoolId}
    />
  );
}

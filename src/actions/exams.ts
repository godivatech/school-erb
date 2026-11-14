"use server";

import { db } from "@/db";
import {
  examMarks,
  examSchedules,
  exams,
  examTerms,
  enrollments,
  students,
  feeInvoices,
  schools,
  auditLogs,
  classes,
  sections,
  subjects,
} from "@/db/schema";
import { eq, and, inArray, lte, sql, asc } from "drizzle-orm";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import { assertAcademicYearMutable, assertRole, resolveVerifiedSession } from "@/lib/guards";

export interface StudentMarkBatchEntry {
  enrollmentId: string;
  theoryMarks?: number | null;
  practicalMarks?: number | null;
  graceMarks?: number;
  attendanceStatus: "PRESENT" | "AB" | "ML" | "EX";
  remarks?: string;
}

export interface SaveExamMarksBatchInput {
  schoolId?: string;
  userId?: string;
  userRole?: "SUPER_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "PARENT";
  examScheduleId: string;
  entries: StudentMarkBatchEntry[];
  overrideReason?: string;
}

export async function saveExamMarksBatch(input: SaveExamMarksBatchInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "TEACHER"]);

  if (!input.entries || input.entries.length === 0) {
    return { success: true, count: 0, message: "No student entries to save." };
  }

  return await db.transaction(async (tx) => {
    // 1. Fetch schedule rules and academic year
    const [sched] = await tx
      .select({
        id: examSchedules.id,
        maxTheoryMarks: examSchedules.maxTheoryMarks,
        maxPracticalMarks: examSchedules.maxPracticalMarks,
        passMarks: examSchedules.passMarks,
        academicYearId: examTerms.academicYearId,
        isLocked: examSchedules.isLocked,
      })
      .from(examSchedules)
      .innerJoin(exams, eq(examSchedules.examId, exams.id))
      .innerJoin(examTerms, eq(exams.termId, examTerms.id))
      .where(
        and(
          eq(examSchedules.id, input.examScheduleId),
          eq(exams.schoolId, session.schoolId)
        )
      )
      .limit(1);

    if (!sched) {
      throw new Error("Exam schedule not found");
    }

    if (sched.isLocked) {
      throw new Error("Marks for this exam schedule are frozen and locked. Modifications require Principal sign-off to unlock.");
    }

    // 2. Guard against locked academic years
    await assertAcademicYearMutable(
      sched.academicYearId,
      {
        schoolId: session.schoolId,
        userId: session.userId,
        userRole: session.userRole,
        auditOverrideReason: input.overrideReason,
      },
      `Enter marks batch for exam schedule ${input.examScheduleId}`
    );

    const maxTheory = parseFloat(sched.maxTheoryMarks);
    const maxPractical = parseFloat(sched.maxPracticalMarks || "0");

    const savedMarks = [];

    for (const entry of input.entries) {
      // Validate marks bounds if PRESENT
      if (entry.attendanceStatus === "PRESENT") {
        const theory = Number(entry.theoryMarks ?? 0);
        const practical = Number(entry.practicalMarks ?? 0);
        const grace = Number(entry.graceMarks ?? 0);

        if (isNaN(theory) || theory < 0 || theory > maxTheory) {
          throw new Error(
            `Theory marks ${entry.theoryMarks} out of valid range (0 - ${maxTheory}) for enrollment ${entry.enrollmentId}`
          );
        }

        if (isNaN(practical) || practical < 0 || practical > maxPractical) {
          throw new Error(
            `Practical marks ${entry.practicalMarks} out of valid range (0 - ${maxPractical}) for enrollment ${entry.enrollmentId}`
          );
        }

        if (isNaN(grace) || grace < 0) {
          throw new Error(
            `Grace marks cannot be negative for enrollment ${entry.enrollmentId}`
          );
        }

        if (theory + practical + grace > maxTheory + maxPractical) {
          throw new Error(
            `Total marks (${theory + practical} + ${grace} grace) exceeds maximum possible (${maxTheory + maxPractical}) for enrollment ${entry.enrollmentId}`
          );
        }
      }

      const theoryStr =
        entry.attendanceStatus === "PRESENT" && entry.theoryMarks != null
          ? Number(entry.theoryMarks).toFixed(2)
          : null;
      const practicalStr =
        entry.attendanceStatus === "PRESENT" && entry.practicalMarks != null
          ? Number(entry.practicalMarks).toFixed(2)
          : null;
      const graceStr = Math.max(0, Number(entry.graceMarks || 0)).toFixed(2);

      const [record] = await tx
        .insert(examMarks)
        .values({
          examScheduleId: input.examScheduleId,
          enrollmentId: entry.enrollmentId,
          theoryMarks: theoryStr,
          practicalMarks: practicalStr,
          graceMarks: graceStr,
          attendanceStatus: entry.attendanceStatus,
          enteredById: session.userId,
          remarks: entry.remarks || null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [examMarks.examScheduleId, examMarks.enrollmentId],
          set: {
            theoryMarks: theoryStr,
            practicalMarks: practicalStr,
            graceMarks: graceStr,
            attendanceStatus: entry.attendanceStatus,
            enteredById: session.userId,
            remarks: entry.remarks || null,
            updatedAt: new Date(),
          },
        })
        .returning();

      savedMarks.push(record);
    }

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "EXAM_MARKS",
      entityId: input.examScheduleId,
      action: "UPDATE",
      newValueJson: { count: savedMarks.length },
      reason: `Saved marks batch for ${savedMarks.length} students`,
    });

    safeRevalidatePath("/exams");
    safeRevalidatePath("/exams/mark-entry");
    return { success: true, count: savedMarks.length };
  });
}

export interface GenerateReportCardPdfInput {
  schoolId?: string;
  userId?: string;
  userRole?: "SUPER_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "PARENT";
  studentId: string;
  academicYearId?: string;
  termId?: string;
}

export async function generateReportCardPdf(input: GenerateReportCardPdfInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT", "TEACHER", "PARENT"]);

  const academicYearId = input.academicYearId || session.academicYearId;

  // 1. Fetch School Settings
  const [school] = await db
    .select({
      id: schools.id,
      name: schools.name,
      settingsJson: schools.settingsJson,
    })
    .from(schools)
    .where(eq(schools.id, session.schoolId))
    .limit(1);

  const holdResults = school?.settingsJson?.holdResultsForDefaulters ?? true;

  // 2. Check Overdue Defaulter Status if holdResults is enabled
  if (holdResults) {
    const todayStr = new Date().toISOString().split("T")[0];
    const overdueInvoices = await db
      .select({
        id: feeInvoices.id,
        invoiceNo: feeInvoices.invoiceNo,
        netAmount: feeInvoices.netAmount,
        paidAmount: feeInvoices.paidAmount,
      })
      .from(feeInvoices)
      .where(
        and(
          eq(feeInvoices.schoolId, session.schoolId),
          eq(feeInvoices.studentId, input.studentId),
          inArray(feeInvoices.status, ["UNPAID", "PARTIAL"]),
          lte(feeInvoices.dueDate, todayStr)
        )
      );

    const totalOverdue = overdueInvoices.reduce((acc, inv) => {
      const net = parseFloat(inv.netAmount || "0");
      const paid = parseFloat(inv.paidAmount || "0");
      return acc + Math.max(0, net - paid);
    }, 0);

    if (totalOverdue > 0) {
      return {
        success: false,
        isBlocked: true,
        reason: "FEE_DEFAULTER_HOLD",
        totalOverdue,
        message: `Report card download is on hold due to ₹${totalOverdue.toFixed(2)} in overdue fee dues. Please contact the accounts office to clear dues.`,
      };
    }
  }

  // 3. Fetch Student & Enrollment
  const [stu] = await db
    .select({
      id: students.id,
      admissionNo: students.admissionNo,
      firstName: students.firstName,
      lastName: students.lastName,
      enrollmentId: enrollments.id,
      classId: enrollments.classId,
      sectionId: enrollments.sectionId,
      rollNo: enrollments.rollNo,
    })
    .from(students)
    .innerJoin(enrollments, eq(students.id, enrollments.studentId))
    .where(
      and(
        eq(students.id, input.studentId),
        eq(students.schoolId, session.schoolId),
        eq(enrollments.academicYearId, academicYearId)
      )
    )
    .limit(1);

  if (!stu) {
    return { success: false, error: "STUDENT_NOT_ENROLLED", message: "Student enrollment not found" };
  }

  // 4. Fetch Marks and aggregate percentage excluding ML/EX from numerator & denominator
  const marksData = await db
    .select({
      subjectId: examSchedules.subjectId,
      theoryMarks: examMarks.theoryMarks,
      practicalMarks: examMarks.practicalMarks,
      graceMarks: examMarks.graceMarks,
      attendanceStatus: examMarks.attendanceStatus,
      maxTheoryMarks: examSchedules.maxTheoryMarks,
      maxPracticalMarks: examSchedules.maxPracticalMarks,
      passMarks: examSchedules.passMarks,
    })
    .from(examMarks)
    .innerJoin(examSchedules, eq(examMarks.examScheduleId, examSchedules.id))
    .where(eq(examMarks.enrollmentId, stu.enrollmentId));

  let totalScored = 0;
  let totalMax = 0;

  const subjectResults = marksData.map((m) => {
    const isExemptOrMedical =
      m.attendanceStatus === "ML" || m.attendanceStatus === "EX";
    const isAbsent = m.attendanceStatus === "AB";

    const maxT = parseFloat(m.maxTheoryMarks);
    const maxP = parseFloat(m.maxPracticalMarks || "0");
    const subjMax = maxT + maxP;

    let scored = 0;
    if (m.attendanceStatus === "PRESENT") {
      const t = parseFloat(m.theoryMarks || "0");
      const p = parseFloat(m.practicalMarks || "0");
      const g = parseFloat(m.graceMarks || "0");
      scored = t + p + g;
      totalScored += scored;
      totalMax += subjMax;
    } else if (isAbsent) {
      // Absent: scored 0, but included in denominator
      totalMax += subjMax;
    }
    // Note: If ML or EX, both scored and subjMax are excluded from overall percentage

    return {
      subjectId: m.subjectId,
      status: m.attendanceStatus,
      scored: isExemptOrMedical ? m.attendanceStatus : scored,
      maxMarks: subjMax,
    };
  });

  const percentage = totalMax > 0 ? (totalScored / totalMax) * 100 : 0;

  return {
    success: true,
    isBlocked: false,
    reportCard: {
      student: {
        admissionNo: stu.admissionNo,
        name: `${stu.firstName} ${stu.lastName}`,
        rollNo: stu.rollNo,
      },
      schoolName: school?.name || "School ERP",
      subjectResults,
      totalScored,
      totalMax,
      percentage: Number(percentage.toFixed(2)),
    },
  };
}

export interface CreateExamTermInput {
  schoolId: string;
  userId?: string;
  academicYearId: string;
  termName: string;
  weightagePercent?: number;
  orderIndex?: number;
  examName?: string;
  aggregationRule?: "SUM" | "WEIGHTED" | "BEST_OF_N";
}

export async function createExamTermAndExam(input: CreateExamTermInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  if (!input.termName?.trim()) {
    throw new Error("Term name cannot be blank.");
  }

  // Guard against locked academic year
  await assertAcademicYearMutable(
    input.academicYearId,
    {
      schoolId: session.schoolId,
      userId: session.userId,
      userRole: session.userRole,
    },
    `Create exam term ${input.termName}`
  );

  return await db.transaction(async (tx) => {
    const weightage = Math.max(0, Math.min(100, input.weightagePercent || 50));
    const [term] = await tx
      .insert(examTerms)
      .values({
        schoolId: session.schoolId,
        academicYearId: input.academicYearId,
        name: input.termName.trim(),
        weightagePercent: weightage.toFixed(2),
        orderIndex: Math.max(1, input.orderIndex || 1),
      })
      .returning();

    const [exam] = await tx
      .insert(exams)
      .values({
        schoolId: session.schoolId,
        termId: term.id,
        name: (input.examName || `${input.termName} Examinations`).trim(),
        aggregationRule: input.aggregationRule || "SUM",
        weightage: "100.00",
      })
      .returning();

    safeRevalidatePath("/exams");
    safeRevalidatePath("/exams/mark-entry");
    return { success: true, term, exam };
  });
}

export interface CreateExamScheduleInput {
  schoolId?: string;
  userId?: string;
  examId: string;
  classId: string;
  subjectId: string;
  examDate: string;
  maxTheoryMarks: number;
  maxPracticalMarks?: number;
  passMarks?: number;
}

export async function createExamSchedule(input: CreateExamScheduleInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  const maxTheory = Number(input.maxTheoryMarks);
  const maxPractical = Math.max(0, Number(input.maxPracticalMarks || 0));
  const passMarks = Math.max(0, Number(input.passMarks || 35));

  if (isNaN(maxTheory) || maxTheory <= 0) {
    throw new Error("Maximum theory marks must be greater than zero.");
  }

  const totalPossible = maxTheory + maxPractical;
  if (passMarks > totalPossible) {
    throw new Error(
      `Pass marks (${passMarks}) cannot exceed total possible marks (${totalPossible}).`
    );
  }

  return await db.transaction(async (tx) => {
    // Fetch exam and term to check academic year
    const [exam] = await tx
      .select({
        academicYearId: examTerms.academicYearId,
        schoolId: exams.schoolId,
      })
      .from(exams)
      .innerJoin(examTerms, eq(exams.termId, examTerms.id))
      .where(
        and(
          eq(exams.id, input.examId),
          eq(exams.schoolId, session.schoolId)
        )
      )
      .limit(1);

    if (exam) {
      await assertAcademicYearMutable(
        exam.academicYearId,
        {
          schoolId: session.schoolId,
          userId: session.userId,
          userRole: session.userRole,
        },
        `Create exam schedule for subject ${input.subjectId}`
      );
    }

    const [sched] = await tx
      .insert(examSchedules)
      .values({
        examId: input.examId,
        classId: input.classId,
        subjectId: input.subjectId,
        examDate: input.examDate,
        maxTheoryMarks: maxTheory.toFixed(2),
        maxPracticalMarks: maxPractical.toFixed(2),
        passMarks: passMarks.toFixed(2),
      })
      .returning();

    safeRevalidatePath("/exams");
    safeRevalidatePath("/exams/mark-entry");
    return { success: true, schedule: sched };
  });
}

// ---------------------------------------------------------------------------
// Freeze / Unlock Marks Schedule (Feature 7)
// ---------------------------------------------------------------------------

export interface ToggleLockExamScheduleInput {
  schoolId?: string;
  userId?: string;
  userRole?: "SUPER_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "PARENT";
  examScheduleId: string;
  isLocked: boolean;
  reason?: string;
}

export async function toggleLockExamSchedule(input: ToggleLockExamScheduleInput) {
  const session = await resolveVerifiedSession(input);

  // If unlocking, strictly require SUPER_ADMIN or PRINCIPAL
  if (!input.isLocked) {
    assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);
  } else {
    // Locking can be done by TEACHER, PRINCIPAL, or SUPER_ADMIN
    assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "TEACHER"]);
  }

  const [sched] = await db
    .select({
      id: examSchedules.id,
      isLocked: examSchedules.isLocked,
      maxTheoryMarks: examSchedules.maxTheoryMarks,
      maxPracticalMarks: examSchedules.maxPracticalMarks,
    })
    .from(examSchedules)
    .innerJoin(exams, eq(examSchedules.examId, exams.id))
    .where(
      and(
        eq(examSchedules.id, input.examScheduleId),
        eq(exams.schoolId, session.schoolId)
      )
    )
    .limit(1);

  if (!sched) {
    throw new Error("Exam schedule not found.");
  }

  return await db.transaction(async (tx) => {
    if (input.isLocked) {
      // Validate that all saved marks for this schedule are within valid limits before freezing
      const existingMarks = await tx
        .select({
          theoryMarks: examMarks.theoryMarks,
          practicalMarks: examMarks.practicalMarks,
          graceMarks: examMarks.graceMarks,
          attendanceStatus: examMarks.attendanceStatus,
        })
        .from(examMarks)
        .where(eq(examMarks.examScheduleId, input.examScheduleId));

      const maxT = parseFloat(sched.maxTheoryMarks || "0");
      const maxP = parseFloat(sched.maxPracticalMarks || "0");

      for (const m of existingMarks) {
        if (m.attendanceStatus === "PRESENT") {
          const th = parseFloat(m.theoryMarks || "0");
          const pr = parseFloat(m.practicalMarks || "0");
          const gr = parseFloat(m.graceMarks || "0");
          if (th > maxT || pr > maxP || (th + pr + gr > maxT + maxP)) {
            throw new Error(
              `Cannot freeze exam schedule: One or more saved student marks exceed maximum allowed marks (Theory Max: ${maxT}, Practical Max: ${maxP}).`
            );
          }
        }
      }
    }

    await tx
      .update(examSchedules)
      .set({
        isLocked: input.isLocked,
        lockedById: input.isLocked ? session.userId : null,
        lockedAt: input.isLocked ? new Date() : null,
      })
      .where(eq(examSchedules.id, input.examScheduleId));

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "EXAM_SCHEDULE",
      entityId: input.examScheduleId,
      action: input.isLocked ? "LOCK" : "UNLOCK",
      oldValueJson: { isLocked: sched.isLocked },
      newValueJson: { isLocked: input.isLocked },
      reason: input.reason || (input.isLocked ? "Marks submitted & frozen" : "Principal unlocked marks for edit"),
    });

    safeRevalidatePath("/exams");
    safeRevalidatePath("/exams/mark-entry");

    return {
      success: true,
      isLocked: input.isLocked,
      message: input.isLocked
        ? "Marks submitted & frozen. Modifications now require Principal sign-off."
        : "Exam schedule unlocked successfully for mark revisions.",
    };
  });
}

// ---------------------------------------------------------------------------
// 1-Click Bulk Report Card Batch for Section (Feature 6)
// ---------------------------------------------------------------------------

export interface SectionReportCardStudent {
  admissionNo: string;
  name: string;
  rollNo: number;
  className: string;
  sectionName: string;
  hasOverdueFee: boolean;
  overdueAmount: number;
  subjects: Array<{
    name: string;
    code: string;
    theoryScored: string;
    practicalScored: string;
    maxMarks: number;
    totalScored: number;
    grade: string;
    status: string;
  }>;
  totalScored: number;
  totalMax: number;
  percentage: number;
  result: "PASS" | "FAIL" | "WITHHELD";
}

export async function getSectionReportCardsBatch(input: {
  schoolId?: string;
  academicYearId: string;
  classId: string;
  sectionId?: string;
}) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "TEACHER"]);

  // 1. Fetch class details
  const [cls] = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(and(eq(classes.id, input.classId), eq(classes.schoolId, session.schoolId)))
    .limit(1);

  // 2. Fetch all students in this class for the academic year
  const studentEnrollments = await db
    .select({
      enrollmentId: enrollments.id,
      studentId: students.id,
      admissionNo: students.admissionNo,
      firstName: students.firstName,
      lastName: students.lastName,
      rollNo: enrollments.rollNo,
      sectionId: enrollments.sectionId,
      sectionName: sections.name,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(
      and(
        eq(enrollments.schoolId, session.schoolId),
        eq(enrollments.classId, input.classId),
        eq(enrollments.academicYearId, input.academicYearId),
        input.sectionId ? eq(enrollments.sectionId, input.sectionId) : sql`1=1`
      )
    )
    .orderBy(asc(enrollments.rollNo), asc(students.firstName));

  // 3. Fetch all exam schedules for this class in this academic year
  const schedules = await db
    .select({
      scheduleId: examSchedules.id,
      subjectId: examSchedules.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      maxTheory: examSchedules.maxTheoryMarks,
      maxPractical: examSchedules.maxPracticalMarks,
      passMarks: examSchedules.passMarks,
    })
    .from(examSchedules)
    .innerJoin(subjects, eq(examSchedules.subjectId, subjects.id))
    .innerJoin(exams, eq(examSchedules.examId, exams.id))
    .innerJoin(examTerms, eq(exams.termId, examTerms.id))
    .where(
      and(
        eq(examSchedules.classId, input.classId),
        eq(examTerms.academicYearId, input.academicYearId)
      )
    );

  const scheduleIds = schedules.map((s) => s.scheduleId);
  const allMarks = scheduleIds.length > 0
    ? await db
        .select()
        .from(examMarks)
        .where(inArray(examMarks.examScheduleId, scheduleIds))
    : [];

  const marksLookup = new Map<string, Map<string, typeof allMarks[0]>>();
  for (const m of allMarks) {
    if (!marksLookup.has(m.enrollmentId)) {
      marksLookup.set(m.enrollmentId, new Map());
    }
    marksLookup.get(m.enrollmentId)!.set(m.examScheduleId, m);
  }

  // Check overdue fees
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
        eq(feeInvoices.schoolId, session.schoolId),
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

  const reportCards: SectionReportCardStudent[] = studentEnrollments.map((stu, idx) => {
    const overdueAmt = defaulterMap.get(stu.studentId) || 0;
    const hasOverdue = overdueAmt > 0;

    let totalScored = 0;
    let totalMax = 0;
    let anyFailed = false;

    const subjectsData = schedules.map((sched) => {
      const mark = marksLookup.get(stu.enrollmentId)?.get(sched.scheduleId);
      const maxT = parseFloat(sched.maxTheory);
      const maxP = parseFloat(sched.maxPractical || "0");
      const subjMax = maxT + maxP;
      const pass = parseFloat(sched.passMarks);

      const status = mark?.attendanceStatus || "AB";
      let scored = 0;
      let theoryScored = "0";
      let practicalScored = "0";

      if (status === "PRESENT") {
        const th = parseFloat(mark?.theoryMarks || "0");
        const pr = parseFloat(mark?.practicalMarks || "0");
        const gr = parseFloat(mark?.graceMarks || "0");
        scored = th + pr + gr;
        theoryScored = String(th);
        practicalScored = String(pr);
        totalScored += scored;
        totalMax += subjMax;
        if (scored < pass) anyFailed = true;
      } else if (status === "AB") {
        theoryScored = "AB";
        practicalScored = "AB";
        totalMax += subjMax;
        anyFailed = true;
      } else {
        theoryScored = status;
        practicalScored = status;
      }

      const pct = subjMax > 0 ? (scored / subjMax) * 100 : 0;
      let grade = "E";
      if (pct >= 90) grade = "A1";
      else if (pct >= 80) grade = "A2";
      else if (pct >= 70) grade = "B1";
      else if (pct >= 60) grade = "B2";
      else if (pct >= 50) grade = "C";
      else if (pct >= 35) grade = "D";

      return {
        name: sched.subjectName,
        code: sched.subjectCode,
        theoryScored,
        practicalScored,
        maxMarks: subjMax,
        totalScored: scored,
        grade,
        status,
      };
    });

    const percentage = totalMax > 0 ? Number(((totalScored / totalMax) * 100).toFixed(1)) : 0;
    const result = hasOverdue ? "WITHHELD" : anyFailed ? "FAIL" : "PASS";

    return {
      admissionNo: stu.admissionNo,
      name: `${stu.firstName} ${stu.lastName}`,
      rollNo: stu.rollNo || idx + 1,
      className: cls?.name || "Class",
      sectionName: stu.sectionName,
      hasOverdueFee: hasOverdue,
      overdueAmount: overdueAmt,
      subjects: subjectsData,
      totalScored,
      totalMax,
      percentage,
      result,
    };
  });

  return {
    success: true,
    className: cls?.name || "Class",
    studentsCount: reportCards.length,
    reportCards,
  };
}

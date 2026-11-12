"use server";

import { db } from "@/db";
import {
  attendance,
  enrollments,
  students,
  families,
  sections,
  classes,
  holidays,
  auditLogs,
  outboxEvents,
  notificationOutbox,
  studentLeaves,
} from "@/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import { assertAcademicYearMutable, assertRole, resolveVerifiedSession } from "@/lib/guards";
import { enqueueAbsentAlert, enqueueLateArrivalUpdate } from "@/lib/queue";

export interface AttendanceRecordInput {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  parentPhone?: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "MEDICAL_LEAVE";
  arrivalMinutesLate?: number;
  remarks?: string;
}

export interface SubmitSectionAttendanceInput {
  schoolId?: string;
  userId?: string;
  userRole?: "SUPER_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "PARENT";
  academicYearId: string;
  sectionId: string;
  date: string; // YYYY-MM-DD
  records: AttendanceRecordInput[];
  overrideReason?: string;
  sendWhatsAppAlerts?: boolean;
}

export async function submitSectionAttendance(input: SubmitSectionAttendanceInput) {
  // P0-1: Resolve verified session & enforce tenant boundary
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "TEACHER"]);

  // Edge Case 1: Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD.");
  }

  // Edge Case 2: Guard against future dates
  const today = new Date().toISOString().split("T")[0];
  if (input.date > today) {
    throw new Error(
      `Cannot submit attendance for a future date (${input.date}). Maximum allowable date is today (${today}).`
    );
  }

  // 1. Guard against locked academic years (must execute before processing records)
  await assertAcademicYearMutable(
    input.academicYearId,
    {
      schoolId: session.schoolId,
      userId: session.userId,
      userRole: session.userRole,
      auditOverrideReason: input.overrideReason,
    },
    `Submit attendance for section ${input.sectionId} on ${input.date}`
  );

  // Edge Case 3: Handle empty records payload
  if (!input.records || input.records.length === 0) {
    return {
      success: true,
      count: 0,
      date: input.date,
      message: "No student records to update.",
      whatsAppAlertsCount: 0,
    };
  }

  return await db.transaction(async (tx) => {
    // Fetch section name & class for validation and notifications
    const [sec] = await tx
      .select({
        sectionName: sections.name,
        className: classes.name,
        classId: sections.classId,
      })
      .from(sections)
      .innerJoin(classes, eq(sections.classId, classes.id))
      .where(eq(sections.id, input.sectionId))
      .limit(1);

    // Edge Case 4: Guard against marking attendance on declared school or emergency holidays
    const [declaredHoliday] = await tx
      .select()
      .from(holidays)
      .where(
        and(
          eq(holidays.schoolId, session.schoolId),
          eq(holidays.academicYearId, input.academicYearId),
          eq(holidays.date, input.date)
        )
      )
      .limit(1);

    if (declaredHoliday) {
      const appliesToClass =
        !declaredHoliday.applicableClassIds ||
        (sec && declaredHoliday.applicableClassIds.includes(sec.classId));

      if (appliesToClass) {
        throw new Error(
          `Cannot mark attendance: Date ${input.date} is declared as a holiday (${declaredHoliday.title}).`
        );
      }
    }

    const fullSectionName = sec ? `${sec.className} - ${sec.sectionName}` : "Section";

    const savedRecords = [];

    let whatsAppAlertsCount = 0;

    for (const rec of input.records) {
      // Check existing status before upsert to detect late reversal
      const [existing] = await tx
        .select({
          id: attendance.id,
          status: attendance.status,
        })
        .from(attendance)
        .where(
          and(
            eq(attendance.enrollmentId, rec.enrollmentId),
            eq(attendance.date, input.date)
          )
        )
        .limit(1);

      const arrivalMins = Math.max(0, rec.arrivalMinutesLate || 0);

      // Upsert attendance record using ON CONFLICT (enrollment_id, date) DO UPDATE
      const [saved] = await tx
        .insert(attendance)
        .values({
          schoolId: session.schoolId,
          academicYearId: input.academicYearId,
          enrollmentId: rec.enrollmentId,
          date: input.date,
          status: rec.status,
          remarks: rec.remarks || null,
          arrivalMinutesLate: arrivalMins,
          markedById: session.userId,
        })
        .onConflictDoUpdate({
          target: [attendance.enrollmentId, attendance.date],
          set: {
            status: rec.status,
            remarks: rec.remarks || null,
            arrivalMinutesLate: arrivalMins,
            markedById: session.userId,
            updatedAt: new Date(),
          },
        })
        .returning();

      savedRecords.push(saved);

      if (input.sendWhatsAppAlerts && rec.status === "ABSENT") {
        await tx.insert(notificationOutbox).values({
          schoolId: session.schoolId,
          channel: "WHATSAPP",
          recipientPhone: rec.parentPhone || "+91 98765 43210",
          recipientName: rec.studentName,
          message: `Dear Parent, your ward ${rec.studentName} was marked ABSENT today (${input.date}) in ${fullSectionName} at Crescent Matriculation School. If unexpected, please contact the school office immediately.`,
          status: "SENT",
        });
        whatsAppAlertsCount++;
      }

      // P0-2 Remediation: Transactional Outbox Pattern
      // Enqueue alerts into outbox_events table inside the active database transaction.
      // If transaction aborts, outbox event is rolled back atomically, preventing phantom SMS.
      if (
        rec.status === "ABSENT" &&
        rec.parentPhone &&
        existing?.status !== "ABSENT"
      ) {
        // Enqueue absent alert with 15-minute grace window
        const scheduledFor = new Date(Date.now() + 15 * 60 * 1000);
        await tx.insert(outboxEvents).values({
          schoolId: session.schoolId,
          eventType: "STUDENT_ABSENT",
          payloadJson: {
            schoolId: session.schoolId,
            studentId: rec.studentId,
            studentName: rec.studentName,
            parentPhone: rec.parentPhone,
            sectionName: fullSectionName,
            date: input.date,
          },
          status: "PENDING",
          scheduledFor,
        });
      } else if (
        rec.status === "LATE" &&
        existing?.status === "ABSENT" &&
        rec.parentPhone
      ) {
        // Late arrival reversal: cancel pending absent outbox event inside the same transaction
        await tx
          .update(outboxEvents)
          .set({
            status: "CANCELLED",
            errorMessage: `Late arrival recorded (${arrivalMins || 15} mins late)`,
          })
          .where(
            and(
              eq(outboxEvents.schoolId, session.schoolId),
              eq(outboxEvents.eventType, "STUDENT_ABSENT"),
              eq(outboxEvents.status, "PENDING"),
              sql`payload_json->>'studentId' = ${rec.studentId}`,
              sql`payload_json->>'date' = ${input.date}`
            )
          );

        // Enqueue safe arrival notice
        await tx.insert(outboxEvents).values({
          schoolId: session.schoolId,
          eventType: "STUDENT_LATE",
          payloadJson: {
            schoolId: session.schoolId,
            studentId: rec.studentId,
            studentName: rec.studentName,
            parentPhone: rec.parentPhone,
            arrivalTime: `${arrivalMins || 15} mins late`,
            date: input.date,
          },
          status: "PENDING",
        });
      }
    }

    safeRevalidatePath("/attendance");
    return {
      success: true,
      count: savedRecords.length,
      date: input.date,
      whatsAppAlertsCount,
    };
  });
}

// ---------------------------------------------------------------------------
// Student Leaves & Parent Applications
// ---------------------------------------------------------------------------

export interface ApplyStudentLeaveInput {
  schoolId?: string;
  studentId: string;
  startDate: string;
  endDate: string;
  leaveType: "MEDICAL" | "PLANNED" | "CASUAL";
  reason: string;
  appliedBy?: string;
}

export async function applyStudentLeave(input: ApplyStudentLeaveInput) {
  const session = await resolveVerifiedSession(input);

  if (!input.reason?.trim()) {
    throw new Error("Reason for leave is required.");
  }
  if (input.startDate > input.endDate) {
    throw new Error("Start date cannot be after end date.");
  }

  const [leave] = await db
    .insert(studentLeaves)
    .values({
      schoolId: session.schoolId,
      studentId: input.studentId,
      startDate: input.startDate,
      endDate: input.endDate,
      leaveType: input.leaveType,
      reason: input.reason.trim(),
      status: "PENDING",
      appliedBy: input.appliedBy || "Parent",
    })
    .returning();

  await db.insert(auditLogs).values({
    schoolId: session.schoolId,
    userId: session.userId || "usr_parent",
    entityType: "STUDENT_LEAVE",
    entityId: leave.id,
    action: "CREATE",
    newValueJson: { studentId: input.studentId, startDate: input.startDate, endDate: input.endDate, leaveType: input.leaveType },
    reason: `Parent applied student leave: ${input.reason}`,
  });

  safeRevalidatePath("/attendance");
  safeRevalidatePath("/parent");
  return { success: true, leave };
}

export async function getStudentLeaves(input: { schoolId?: string; studentId: string }) {
  const session = await resolveVerifiedSession(input);
  return await db
    .select()
    .from(studentLeaves)
    .where(
      and(
        eq(studentLeaves.schoolId, session.schoolId),
        eq(studentLeaves.studentId, input.studentId)
      )
    )
    .orderBy(desc(studentLeaves.createdAt));
}

export async function getActiveLeavesForSectionDate(input: {
  schoolId?: string;
  academicYearId: string;
  sectionId: string;
  date: string;
}) {
  const session = await resolveVerifiedSession(input);

  // Find all active enrollments in this section
  const sectionEnrollments = await db
    .select({
      studentId: enrollments.studentId,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.schoolId, session.schoolId),
        eq(enrollments.academicYearId, input.academicYearId),
        eq(enrollments.sectionId, input.sectionId)
      )
    );

  const studentIds = sectionEnrollments.map((e) => e.studentId);
  if (studentIds.length === 0) return [];

  return await db
    .select({
      id: studentLeaves.id,
      studentId: studentLeaves.studentId,
      startDate: studentLeaves.startDate,
      endDate: studentLeaves.endDate,
      leaveType: studentLeaves.leaveType,
      reason: studentLeaves.reason,
      status: studentLeaves.status,
      appliedBy: studentLeaves.appliedBy,
    })
    .from(studentLeaves)
    .where(
      and(
        eq(studentLeaves.schoolId, session.schoolId),
        inArray(studentLeaves.studentId, studentIds),
        sql`${studentLeaves.startDate} <= ${input.date} AND ${studentLeaves.endDate} >= ${input.date}`
      )
    );
}

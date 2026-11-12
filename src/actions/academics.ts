"use server";

import { db } from "@/db";
import {
  academicYears,
  classes,
  sections,
  subjects,
  classSubjects,
  feeStructures,
  holidays,
  attendance,
  auditLogs,
  outboxEvents,
  enrollments,
  students,
  dailyHomework,
  users,
} from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getQueueBoss } from "@/lib/queue";
import { assertRole, resolveVerifiedSession, type Role } from "@/lib/guards";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Graceful no-op when executed in CLI/verification scripts
  }
}

export interface CreateAcademicYearInput {
  schoolId: string;
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  status?: "UPCOMING" | "ACTIVE" | "LOCKED";
}

export async function createAcademicYear(input: CreateAcademicYearInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  // Edge Case: Validate date chronology
  if (new Date(input.startDate) >= new Date(input.endDate)) {
    throw new Error("Academic year start date must precede end date.");
  }

  if (!input.name?.trim()) {
    throw new Error("Academic year name cannot be blank.");
  }

  return await db.transaction(async (tx) => {
    // Edge Case: Prevent duplicate academic year names in same school
    const [existing] = await tx
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(
        and(
          eq(academicYears.schoolId, input.schoolId),
          eq(academicYears.name, input.name.trim())
        )
      )
      .limit(1);

    if (existing) {
      throw new Error(`Academic year "${input.name.trim()}" already exists in this school.`);
    }

    // If activating, lock other active years
    if (input.status === "ACTIVE") {
      await tx
        .update(academicYears)
        .set({ status: "LOCKED", updatedAt: new Date() })
        .where(
          and(
            eq(academicYears.schoolId, input.schoolId),
            eq(academicYears.status, "ACTIVE")
          )
        );
    }

    const [year] = await tx
      .insert(academicYears)
      .values({
        schoolId: input.schoolId,
        name: input.name.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status || "UPCOMING",
      })
      .returning();

    await tx.insert(auditLogs).values({
      schoolId: input.schoolId,
      userId: input.userId,
      entityType: "ACADEMIC_YEAR",
      entityId: year.id,
      action: "CREATE",
      newValueJson: { name: year.name, status: year.status },
      reason: "Created new academic year",
    });

    safeRevalidate("/academics");
    return { success: true, academicYear: year };
  });
}

export interface CloneAcademicYearStructureInput {
  schoolId: string;
  userId: string;
  sourceYearId: string;
  targetYearId: string;
}

export async function cloneAcademicYearStructure(input: CloneAcademicYearStructureInput) {
  return await db.transaction(async (tx) => {
    // Fetch source class_subjects
    const sourceClassSubjects = await tx
      .select()
      .from(classSubjects)
      .where(
        and(
          eq(classSubjects.schoolId, input.schoolId),
          eq(classSubjects.academicYearId, input.sourceYearId)
        )
      );

    let clonedSubjectsCount = 0;
    for (const cs of sourceClassSubjects) {
      // Check if already cloned
      const [existing] = await tx
        .select({ id: classSubjects.id })
        .from(classSubjects)
        .where(
          and(
            eq(classSubjects.academicYearId, input.targetYearId),
            eq(classSubjects.sectionId, cs.sectionId),
            eq(classSubjects.subjectId, cs.subjectId)
          )
        )
        .limit(1);

      if (!existing) {
        await tx.insert(classSubjects).values({
          schoolId: input.schoolId,
          academicYearId: input.targetYearId,
          sectionId: cs.sectionId,
          subjectId: cs.subjectId,
          teacherId: cs.teacherId,
        });
        clonedSubjectsCount++;
      }
    }

    // Fetch source fee_structures
    const sourceFeeStructures = await tx
      .select()
      .from(feeStructures)
      .where(
        and(
          eq(feeStructures.schoolId, input.schoolId),
          eq(feeStructures.academicYearId, input.sourceYearId)
        )
      );

    let clonedFeesCount = 0;
    for (const fs of sourceFeeStructures) {
      const [existingFee] = await tx
        .select({ id: feeStructures.id })
        .from(feeStructures)
        .where(
          and(
            eq(feeStructures.academicYearId, input.targetYearId),
            eq(feeStructures.classId, fs.classId),
            eq(feeStructures.feeHeadId, fs.feeHeadId)
          )
        )
        .limit(1);

      if (!existingFee) {
        await tx.insert(feeStructures).values({
          schoolId: input.schoolId,
          academicYearId: input.targetYearId,
          classId: fs.classId,
          feeHeadId: fs.feeHeadId,
          amount: fs.amount,
          dueDateDay: fs.dueDateDay,
          lateFinePerDay: fs.lateFinePerDay,
          maxLateFine: fs.maxLateFine,
        });
        clonedFeesCount++;
      }
    }

    await tx.insert(auditLogs).values({
      schoolId: input.schoolId,
      userId: input.userId,
      entityType: "ACADEMIC_YEAR_STRUCTURE",
      entityId: input.targetYearId,
      action: "CREATE",
      oldValueJson: { sourceYearId: input.sourceYearId },
      newValueJson: { clonedSubjectsCount, clonedFeesCount },
      reason: `Cloned structure from ${input.sourceYearId} to ${input.targetYearId}`,
    });

    safeRevalidate("/academics");
    return { success: true, clonedSubjectsCount, clonedFeesCount };
  });
}

export interface ToggleAcademicYearLockInput {
  schoolId: string;
  userId: string;
  academicYearId: string;
  newStatus: "ACTIVE" | "LOCKED" | "UPCOMING";
  reason?: string;
}

export async function toggleAcademicYearLock(input: ToggleAcademicYearLockInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(academicYears)
      .where(
        and(
          eq(academicYears.id, input.academicYearId),
          eq(academicYears.schoolId, input.schoolId)
        )
      )
      .limit(1);

    if (!current) {
      throw new Error("Academic year not found");
    }

    // If activating, lock others
    if (input.newStatus === "ACTIVE") {
      await tx
        .update(academicYears)
        .set({ status: "LOCKED", updatedAt: new Date() })
        .where(
          and(
            eq(academicYears.schoolId, input.schoolId),
            eq(academicYears.status, "ACTIVE")
          )
        );
    }

    const [updated] = await tx
      .update(academicYears)
      .set({ status: input.newStatus, updatedAt: new Date() })
      .where(eq(academicYears.id, input.academicYearId))
      .returning();

    await tx.insert(auditLogs).values({
      schoolId: input.schoolId,
      userId: input.userId,
      entityType: "ACADEMIC_YEAR",
      entityId: input.academicYearId,
      action: input.newStatus === "LOCKED" ? "UPDATE" : "OVERRIDE",
      oldValueJson: { status: current.status },
      newValueJson: { status: input.newStatus },
      reason: input.reason || `Status toggled to ${input.newStatus}`,
    });

    safeRevalidate("/academics");
    return { success: true, academicYear: updated };
  });
}

export interface CreateClassAndSectionInput {
  schoolId: string;
  userId: string;
  className: string;
  numericOrder: number;
  stream?: "SCIENCE" | "COMMERCE" | "ARTS" | "GENERAL";
  sectionName: string;
  capacity?: number;
  classTeacherId?: string | null;
}

export async function createClassAndSection(input: CreateClassAndSectionInput) {
  if (!input.className?.trim()) {
    throw new Error("Class name cannot be blank.");
  }
  if (!input.sectionName?.trim()) {
    throw new Error("Section name cannot be blank.");
  }

  const numericOrder = Math.max(1, Number(input.numericOrder || 1));
  const capacity = Math.max(1, Number(input.capacity || 40));

  return await db.transaction(async (tx) => {
    // Find or create class
    let [cls] = await tx
      .select()
      .from(classes)
      .where(
        and(
          eq(classes.schoolId, input.schoolId),
          eq(classes.name, input.className.trim())
        )
      )
      .limit(1);

    if (!cls) {
      [cls] = await tx
        .insert(classes)
        .values({
          schoolId: input.schoolId,
          name: input.className.trim(),
          numericOrder,
          stream: input.stream || "GENERAL",
        })
        .returning();
    }

    // Check if section already exists
    let [sec] = await tx
      .select()
      .from(sections)
      .where(
        and(
          eq(sections.schoolId, input.schoolId),
          eq(sections.classId, cls.id),
          eq(sections.name, input.sectionName.trim())
        )
      )
      .limit(1);

    if (!sec) {
      [sec] = await tx
        .insert(sections)
        .values({
          schoolId: input.schoolId,
          classId: cls.id,
          name: input.sectionName.trim(),
          capacity,
          classTeacherId: input.classTeacherId || null,
        })
        .returning();
    }

    safeRevalidate("/academics");
    return { success: true, class: cls, section: sec };
  });
}

export interface DeclareEmergencyHolidayInput {
  schoolId: string;
  userId: string;
  academicYearId: string;
  date: string;
  title: string;
  applicableClassIds?: string[] | null;
}

export async function declareEmergencyHoliday(input: DeclareEmergencyHolidayInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error("Invalid holiday date format. Expected YYYY-MM-DD.");
  }
  if (!input.title?.trim()) {
    throw new Error("Holiday title or reason is required.");
  }

  return await db.transaction(async (tx) => {
    // 1. Idempotent Upsert for holiday
    const [existingHoliday] = await tx
      .select()
      .from(holidays)
      .where(
        and(
          eq(holidays.schoolId, input.schoolId),
          eq(holidays.academicYearId, input.academicYearId),
          eq(holidays.date, input.date)
        )
      )
      .limit(1);

    let holiday;
    if (existingHoliday) {
      [holiday] = await tx
        .update(holidays)
        .set({
          title: input.title.trim(),
          applicableClassIds: input.applicableClassIds || null,
          isEmergencyHoliday: true,
        })
        .where(eq(holidays.id, existingHoliday.id))
        .returning();
    } else {
      [holiday] = await tx
        .insert(holidays)
        .values({
          schoolId: input.schoolId,
          academicYearId: input.academicYearId,
          date: input.date,
          title: input.title.trim(),
          applicableClassIds: input.applicableClassIds || null,
          isEmergencyHoliday: true,
        })
        .returning();
    }

    // 2. Delete attendance records for that date
    const deletedAttendance = await tx
      .delete(attendance)
      .where(
        and(
          eq(attendance.schoolId, input.schoolId),
          eq(attendance.academicYearId, input.academicYearId),
          eq(attendance.date, input.date)
        )
      )
      .returning({ id: attendance.id });

    // 3. Atomically cancel all pending outbox absent/late notification events for this holiday date
    await tx
      .update(outboxEvents)
      .set({
        status: "CANCELLED",
        errorMessage: `Cancelled due to emergency holiday: ${input.title.trim()}`,
      })
      .where(
        and(
          eq(outboxEvents.schoolId, input.schoolId),
          inArray(outboxEvents.eventType, ["STUDENT_ABSENT", "STUDENT_LATE"]),
          eq(outboxEvents.status, "PENDING"),
          sql`payload_json->>'date' = ${input.date}`
        )
      );

    // 4. Audit log
    await tx.insert(auditLogs).values({
      schoolId: input.schoolId,
      userId: input.userId,
      entityType: "HOLIDAY",
      entityId: holiday.id,
      action: "CREATE",
      newValueJson: {
        date: input.date,
        title: input.title,
        attendanceRecordsRemoved: deletedAttendance.length,
      },
      reason: `Emergency holiday declared: ${input.title}`,
    });

    safeRevalidate("/attendance");
    safeRevalidate("/academics");
    return { success: true, holiday, removedAttendanceCount: deletedAttendance.length };
  });
}

// ---------------------------------------------------------------------------
// Class Management Actions
// ---------------------------------------------------------------------------

export interface UpdateClassInput {
  schoolId: string;
  userId?: string;
  classId: string;
  className: string;
  numericOrder: number;
  stream?: "SCIENCE" | "COMMERCE" | "ARTS" | "GENERAL";
}

export async function updateClass(input: UpdateClassInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  if (!input.className?.trim()) {
    throw new Error("Class name cannot be blank.");
  }

  const numericOrder = Math.max(1, Number(input.numericOrder || 1));

  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(classes)
      .where(and(eq(classes.id, input.classId), eq(classes.schoolId, session.schoolId)))
      .limit(1);

    if (!existing) {
      throw new Error("Class not found.");
    }

    const [updated] = await tx
      .update(classes)
      .set({
        name: input.className.trim(),
        numericOrder,
        stream: input.stream || "GENERAL",
      })
      .where(eq(classes.id, input.classId))
      .returning();

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "CLASS",
      entityId: input.classId,
      action: "UPDATE",
      oldValueJson: { name: existing.name, numericOrder: existing.numericOrder, stream: existing.stream },
      newValueJson: { name: updated.name, numericOrder: updated.numericOrder, stream: updated.stream },
      reason: `Updated class details for ${updated.name}`,
    });

    safeRevalidate("/academics");
    return { success: true, class: updated };
  });
}

export interface DeleteClassInput {
  schoolId: string;
  userId?: string;
  classId: string;
}

export async function deleteClass(input: DeleteClassInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    // Edge case check: active student enrollments
    const [enrolled] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .where(and(eq(enrollments.schoolId, session.schoolId), eq(enrollments.classId, input.classId)));

    const studentCount = Number(enrolled?.count || 0);
    if (studentCount > 0) {
      throw new Error(`Cannot delete class: ${studentCount} active student enrollment(s) are linked to this class. Reassign students first.`);
    }

    const [deleted] = await tx
      .delete(classes)
      .where(and(eq(classes.id, input.classId), eq(classes.schoolId, session.schoolId)))
      .returning();

    if (!deleted) {
      throw new Error("Class not found or already deleted.");
    }

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "CLASS",
      entityId: input.classId,
      action: "DELETE",
      oldValueJson: { name: deleted.name, stream: deleted.stream },
      reason: `Deleted class ${deleted.name}`,
    });

    safeRevalidate("/academics");
    return { success: true, deletedClass: deleted };
  });
}

// ---------------------------------------------------------------------------
// Section Management Actions
// ---------------------------------------------------------------------------

export interface AddSectionInput {
  schoolId: string;
  userId?: string;
  classId: string;
  name: string;
  capacity?: number;
  classTeacherId?: string | null;
}

export async function addSection(input: AddSectionInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  if (!input.name?.trim()) {
    throw new Error("Section name cannot be blank.");
  }

  const capacity = Math.max(1, Number(input.capacity || 40));

  return await db.transaction(async (tx) => {
    // Check for duplicate section name in same class
    const [existing] = await tx
      .select()
      .from(sections)
      .where(
        and(
          eq(sections.schoolId, session.schoolId),
          eq(sections.classId, input.classId),
          eq(sections.name, input.name.trim().toUpperCase())
        )
      )
      .limit(1);

    if (existing) {
      throw new Error(`Section "${input.name.trim().toUpperCase()}" already exists in this class.`);
    }

    const [section] = await tx
      .insert(sections)
      .values({
        schoolId: session.schoolId,
        classId: input.classId,
        name: input.name.trim().toUpperCase(),
        capacity,
        classTeacherId: input.classTeacherId || null,
      })
      .returning();

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "SECTION",
      entityId: section.id,
      action: "CREATE",
      newValueJson: { name: section.name, capacity: section.capacity, classId: section.classId },
      reason: `Created Section ${section.name}`,
    });

    safeRevalidate("/academics");
    return { success: true, section };
  });
}

export interface UpdateSectionInput {
  schoolId: string;
  userId?: string;
  sectionId: string;
  name: string;
  capacity: number;
  classTeacherId?: string | null;
}

export async function updateSection(input: UpdateSectionInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  if (!input.name?.trim()) {
    throw new Error("Section name cannot be blank.");
  }

  const capacity = Math.max(1, Number(input.capacity || 40));

  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(sections)
      .where(and(eq(sections.id, input.sectionId), eq(sections.schoolId, session.schoolId)))
      .limit(1);

    if (!existing) {
      throw new Error("Section not found.");
    }

    // Capacity guard: capacity cannot be lower than currently enrolled students
    const [enrolled] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .where(and(eq(enrollments.schoolId, session.schoolId), eq(enrollments.sectionId, input.sectionId)));

    const currentStudents = Number(enrolled?.count || 0);
    if (capacity < currentStudents) {
      throw new Error(`Cannot reduce capacity to ${capacity}. Section currently has ${currentStudents} enrolled students.`);
    }

    const [updated] = await tx
      .update(sections)
      .set({
        name: input.name.trim().toUpperCase(),
        capacity,
        classTeacherId: input.classTeacherId || null,
      })
      .where(eq(sections.id, input.sectionId))
      .returning();

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "SECTION",
      entityId: input.sectionId,
      action: "UPDATE",
      oldValueJson: { name: existing.name, capacity: existing.capacity },
      newValueJson: { name: updated.name, capacity: updated.capacity },
      reason: `Updated section details for Sec ${updated.name}`,
    });

    safeRevalidate("/academics");
    return { success: true, section: updated };
  });
}

export interface DeleteSectionInput {
  schoolId: string;
  userId?: string;
  sectionId: string;
}

export async function deleteSection(input: DeleteSectionInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    const [enrolled] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .where(and(eq(enrollments.schoolId, session.schoolId), eq(enrollments.sectionId, input.sectionId)));

    const count = Number(enrolled?.count || 0);
    if (count > 0) {
      throw new Error(`Cannot delete section: ${count} student(s) currently enrolled. Reassign them first.`);
    }

    const [deleted] = await tx
      .delete(sections)
      .where(and(eq(sections.id, input.sectionId), eq(sections.schoolId, session.schoolId)))
      .returning();

    if (!deleted) {
      throw new Error("Section not found or already deleted.");
    }

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "SECTION",
      entityId: input.sectionId,
      action: "DELETE",
      oldValueJson: { name: deleted.name },
      reason: `Deleted section ${deleted.name}`,
    });

    safeRevalidate("/academics");
    return { success: true, deletedSection: deleted };
  });
}

// ---------------------------------------------------------------------------
// Master Subjects Actions
// ---------------------------------------------------------------------------

export interface CreateMasterSubjectInput {
  schoolId: string;
  userId?: string;
  name: string;
  code: string;
  type?: "CORE" | "ELECTIVE" | "CO_SCHOLASTIC";
  includeInCgpa?: boolean;
}

export async function createMasterSubject(input: CreateMasterSubjectInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  if (!input.name?.trim()) throw new Error("Subject name cannot be blank.");
  if (!input.code?.trim()) throw new Error("Subject code cannot be blank.");

  const normalizedCode = input.code.trim().toUpperCase();

  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(subjects)
      .where(and(eq(subjects.schoolId, session.schoolId), eq(subjects.code, normalizedCode)))
      .limit(1);

    if (existing) {
      throw new Error(`Subject with code "${normalizedCode}" already exists.`);
    }

    const [sub] = await tx
      .insert(subjects)
      .values({
        schoolId: session.schoolId,
        name: input.name.trim(),
        code: normalizedCode,
        type: input.type || "CORE",
        includeInCgpa: input.includeInCgpa ?? true,
      })
      .returning();

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "SUBJECT",
      entityId: sub.id,
      action: "CREATE",
      newValueJson: { name: sub.name, code: sub.code, type: sub.type },
      reason: `Created master subject ${sub.name}`,
    });

    safeRevalidate("/academics");
    return { success: true, subject: sub };
  });
}

export interface UpdateMasterSubjectInput {
  schoolId: string;
  userId?: string;
  subjectId: string;
  name: string;
  code: string;
  type?: "CORE" | "ELECTIVE" | "CO_SCHOLASTIC";
  includeInCgpa?: boolean;
}

export async function updateMasterSubject(input: UpdateMasterSubjectInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  if (!input.name?.trim()) throw new Error("Subject name cannot be blank.");
  if (!input.code?.trim()) throw new Error("Subject code cannot be blank.");

  const normalizedCode = input.code.trim().toUpperCase();

  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(subjects)
      .where(and(eq(subjects.id, input.subjectId), eq(subjects.schoolId, session.schoolId)))
      .limit(1);

    if (!existing) {
      throw new Error("Subject not found.");
    }

    const [updated] = await tx
      .update(subjects)
      .set({
        name: input.name.trim(),
        code: normalizedCode,
        type: input.type || "CORE",
        includeInCgpa: input.includeInCgpa ?? true,
      })
      .where(eq(subjects.id, input.subjectId))
      .returning();

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "SUBJECT",
      entityId: input.subjectId,
      action: "UPDATE",
      oldValueJson: { name: existing.name, code: existing.code },
      newValueJson: { name: updated.name, code: updated.code },
      reason: `Updated master subject ${updated.name}`,
    });

    safeRevalidate("/academics");
    return { success: true, subject: updated };
  });
}

export interface DeleteMasterSubjectInput {
  schoolId: string;
  userId?: string;
  subjectId: string;
}

export async function deleteMasterSubject(input: DeleteMasterSubjectInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    // Check if assigned in class_subjects
    const [assigned] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(classSubjects)
      .where(and(eq(classSubjects.schoolId, session.schoolId), eq(classSubjects.subjectId, input.subjectId)));

    const count = Number(assigned?.count || 0);
    if (count > 0) {
      throw new Error(`Cannot delete subject: assigned to ${count} active class section(s). Remove from classes first.`);
    }

    const [deleted] = await tx
      .delete(subjects)
      .where(and(eq(subjects.id, input.subjectId), eq(subjects.schoolId, session.schoolId)))
      .returning();

    if (!deleted) {
      throw new Error("Subject not found or already deleted.");
    }

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "SUBJECT",
      entityId: input.subjectId,
      action: "DELETE",
      oldValueJson: { name: deleted.name, code: deleted.code },
      reason: `Deleted master subject ${deleted.name}`,
    });

    safeRevalidate("/academics");
    return { success: true, deletedSubject: deleted };
  });
}

// ---------------------------------------------------------------------------
// Class-to-Subject Mapping Actions
// ---------------------------------------------------------------------------

export interface AssignClassSubjectsInput {
  schoolId: string;
  userId?: string;
  academicYearId?: string;
  sectionId: string;
  subjectIds: string[];
}

export async function assignClassSubjects(input: AssignClassSubjectsInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    let targetYearId = input.academicYearId;
    if (!targetYearId) {
      const [activeYear] = await tx
        .select({ id: academicYears.id })
        .from(academicYears)
        .where(and(eq(academicYears.schoolId, session.schoolId), eq(academicYears.status, "ACTIVE")))
        .limit(1);
      targetYearId = activeYear?.id;
    }

    if (!targetYearId) {
      throw new Error("Active academic year not found.");
    }

    // 1. Remove existing subject mappings for this section in the active year
    await tx
      .delete(classSubjects)
      .where(
        and(
          eq(classSubjects.schoolId, session.schoolId),
          eq(classSubjects.academicYearId, targetYearId),
          eq(classSubjects.sectionId, input.sectionId)
        )
      );

    // 2. Insert new mappings
    if (input.subjectIds.length > 0) {
      const inserts = input.subjectIds.map((subId) => ({
        schoolId: session.schoolId,
        academicYearId: targetYearId!,
        sectionId: input.sectionId,
        subjectId: subId,
      }));

      await tx.insert(classSubjects).values(inserts);
    }

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "CLASS_SUBJECT",
      entityId: input.sectionId,
      action: "UPDATE",
      newValueJson: { sectionId: input.sectionId, mappedSubjectCount: input.subjectIds.length },
      reason: `Updated class-subject mapping (${input.subjectIds.length} subjects)`,
    });

    safeRevalidate("/academics");
    return { success: true, count: input.subjectIds.length };
  });
}

// ---------------------------------------------------------------------------
// Scheduled Holiday Actions (Date Range Support)
// ---------------------------------------------------------------------------

export interface CreateScheduledHolidayInput {
  schoolId: string;
  userId?: string;
  academicYearId: string;
  startDate: string;
  endDate?: string;
  title: string;
  applicableClassIds?: string[] | null;
}

export async function createScheduledHoliday(input: CreateScheduledHolidayInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  if (!input.title?.trim()) {
    throw new Error("Holiday title is required.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    throw new Error("Invalid start date format. Expected YYYY-MM-DD.");
  }

  const startDateObj = new Date(input.startDate);
  const endDateObj = input.endDate ? new Date(input.endDate) : startDateObj;

  if (endDateObj < startDateObj) {
    throw new Error("End date cannot precede start date.");
  }

  // Generate all dates in the range
  const dates: string[] = [];
  const curr = new Date(startDateObj);
  while (curr <= endDateObj) {
    dates.push(curr.toISOString().split("T")[0]);
    curr.setDate(curr.getDate() + 1);
  }

  return await db.transaction(async (tx) => {
    let createdCount = 0;
    for (const d of dates) {
      const [existing] = await tx
        .select()
        .from(holidays)
        .where(
          and(
            eq(holidays.schoolId, session.schoolId),
            eq(holidays.academicYearId, input.academicYearId),
            eq(holidays.date, d)
          )
        )
        .limit(1);

      if (existing) {
        await tx
          .update(holidays)
          .set({
            title: input.title.trim(),
            applicableClassIds: input.applicableClassIds || null,
            isEmergencyHoliday: false,
          })
          .where(eq(holidays.id, existing.id));
      } else {
        await tx.insert(holidays).values({
          schoolId: session.schoolId,
          academicYearId: input.academicYearId,
          date: d,
          title: input.title.trim(),
          applicableClassIds: input.applicableClassIds || null,
          isEmergencyHoliday: false,
        });
      }
      createdCount++;
    }

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "HOLIDAY",
      entityId: input.academicYearId,
      action: "CREATE",
      newValueJson: { title: input.title, dateRange: `${input.startDate} to ${input.endDate || input.startDate}`, daysCount: createdCount },
      reason: `Scheduled holiday added: ${input.title} (${createdCount} days)`,
    });

    safeRevalidate("/academics");
    return { success: true, daysCreated: createdCount };
  });
}

export interface DeleteHolidayInput {
  schoolId: string;
  userId?: string;
  holidayId: string;
}

export async function deleteHoliday(input: DeleteHolidayInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(holidays)
      .where(and(eq(holidays.id, input.holidayId), eq(holidays.schoolId, session.schoolId)))
      .returning();

    if (!deleted) {
      throw new Error("Holiday not found or already deleted.");
    }

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "HOLIDAY",
      entityId: input.holidayId,
      action: "DELETE",
      oldValueJson: { title: deleted.title, date: deleted.date },
      reason: `Deleted holiday: ${deleted.title}`,
    });

    safeRevalidate("/academics");
    return { success: true, deletedHoliday: deleted };
  });
}

export interface GetSectionEnrollmentsInput {
  schoolId?: string;
  academicYearId: string;
  sectionId: string;
}

export async function getSectionEnrollmentsForPromotion(input: GetSectionEnrollmentsInput) {
  const session = await resolveVerifiedSession(input);
  return await db
    .select({
      enrollmentId: enrollments.id,
      studentId: enrollments.studentId,
      admissionNo: students.admissionNo,
      firstName: students.firstName,
      lastName: students.lastName,
      rollNo: enrollments.rollNo,
      promotionStatus: enrollments.promotionStatus,
      status: students.status,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(
      and(
        eq(enrollments.schoolId, session.schoolId),
        eq(enrollments.academicYearId, input.academicYearId),
        eq(enrollments.sectionId, input.sectionId),
        eq(students.status, "ACTIVE")
      )
    )
    .orderBy(enrollments.rollNo, students.firstName);
}

export interface PromoteSectionStudentsInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  fromAcademicYearId: string;
  fromSectionId: string;
  toAcademicYearId: string;
  toClassId: string;
  toSectionId: string;
  studentDecisions: Array<{
    studentId: string;
    enrollmentId: string;
    decision: "PROMOTED" | "DETAINED";
  }>;
}

export async function promoteSectionStudents(input: PromoteSectionStudentsInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  if (!input.studentDecisions || input.studentDecisions.length === 0) {
    throw new Error("No students provided for section promotion.");
  }

  if (input.fromSectionId === input.toSectionId && input.fromAcademicYearId === input.toAcademicYearId) {
    throw new Error("Target section and academic year cannot be identical to the source.");
  }

  return await db.transaction(async (tx) => {
    // 1. Fetch target section to verify capacity
    const [targetSection] = await tx
      .select({
        id: sections.id,
        name: sections.name,
        capacity: sections.capacity,
        className: classes.name,
      })
      .from(sections)
      .innerJoin(classes, eq(sections.classId, classes.id))
      .where(and(eq(sections.id, input.toSectionId), eq(sections.schoolId, session.schoolId)))
      .limit(1);

    if (!targetSection) {
      throw new Error("Target section not found.");
    }

    // 2. Count existing enrollments in target section for target academic year
    const [existingCountRes] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.schoolId, session.schoolId),
          eq(enrollments.academicYearId, input.toAcademicYearId),
          eq(enrollments.sectionId, input.toSectionId)
        )
      );
    const currentEnrolled = Number(existingCountRes?.count || 0);

    const promoteCount = input.studentDecisions.filter((d) => d.decision === "PROMOTED").length;
    if (currentEnrolled + promoteCount > targetSection.capacity) {
      throw new Error(
        `Target Section capacity exceeded: ${targetSection.className} Sec ${targetSection.name} has max ${targetSection.capacity} seats (${currentEnrolled} already enrolled, attempting to add ${promoteCount} students).`
      );
    }

    // 3. Process each student
    let promotedTotal = 0;
    let detainedTotal = 0;

    for (let i = 0; i < input.studentDecisions.length; i++) {
      const decisionItem = input.studentDecisions[i];

      // Update source enrollment status
      await tx
        .update(enrollments)
        .set({
          promotionStatus: decisionItem.decision,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(enrollments.id, decisionItem.enrollmentId),
            eq(enrollments.schoolId, session.schoolId)
          )
        );

      if (decisionItem.decision === "PROMOTED") {
        promotedTotal++;
        // Check if already enrolled in target year
        const [alreadyEnrolled] = await tx
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.studentId, decisionItem.studentId),
              eq(enrollments.academicYearId, input.toAcademicYearId)
            )
          )
          .limit(1);

        if (!alreadyEnrolled) {
          await tx.insert(enrollments).values({
            schoolId: session.schoolId,
            studentId: decisionItem.studentId,
            academicYearId: input.toAcademicYearId,
            classId: input.toClassId,
            sectionId: input.toSectionId,
            rollNo: currentEnrolled + promotedTotal,
            promotionStatus: "ACTIVE",
          });
        }
      } else {
        detainedTotal++;
      }
    }

    // 4. Audit Log
    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "SECTION",
      entityId: input.toSectionId,
      action: "UPDATE",
      newValueJson: {
        fromSectionId: input.fromSectionId,
        toSectionId: input.toSectionId,
        fromYear: input.fromAcademicYearId,
        toYear: input.toAcademicYearId,
        promoted: promotedTotal,
        detained: detainedTotal,
      },
      reason: `Promoted section: ${promotedTotal} passed to ${targetSection.className} Sec ${targetSection.name}, ${detainedTotal} detained.`,
    });

    safeRevalidate("/academics");
    safeRevalidate("/students");

    return {
      success: true,
      promotedCount: promotedTotal,
      detainedCount: detainedTotal,
      targetSectionName: `${targetSection.className} - Sec ${targetSection.name}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Daily Homework Diary (Feature 11)
// ---------------------------------------------------------------------------

export interface CreateDailyHomeworkInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  academicYearId: string;
  sectionId: string;
  subjectId: string;
  assignedDate: string;
  dueDate: string;
  title: string;
  description: string;
  attachmentUrl?: string;
}

export async function createDailyHomework(input: CreateDailyHomeworkInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "TEACHER"]);

  // 1. Verify year lock
  const [year] = await db
    .select({ status: academicYears.status })
    .from(academicYears)
    .where(eq(academicYears.id, input.academicYearId))
    .limit(1);

  if (year?.status === "LOCKED") {
    throw new Error("Academic year is locked. Cannot post homework in archived sessions.");
  }

  // 2. Validate chronology
  if (new Date(input.dueDate) < new Date(input.assignedDate)) {
    throw new Error("Due date cannot precede the assigned date.");
  }

  if (!input.title?.trim() || !input.description?.trim()) {
    throw new Error("Homework title and description are required.");
  }

  return await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(dailyHomework)
      .values({
        schoolId: session.schoolId,
        academicYearId: input.academicYearId,
        sectionId: input.sectionId,
        subjectId: input.subjectId,
        teacherId: session.userId,
        assignedDate: input.assignedDate,
        dueDate: input.dueDate,
        title: input.title.trim(),
        description: input.description.trim(),
        attachmentUrl: input.attachmentUrl || null,
      })
      .returning();

    // Audit log
    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "HOMEWORK",
      entityId: inserted.id,
      action: "CREATE",
      newValueJson: inserted,
      reason: `Subject teacher posted homework: ${input.title}`,
    });

    safeRevalidate("/academics");
    safeRevalidate("/parent");

    return {
      success: true,
      homework: inserted,
    };
  });
}

export interface DeleteDailyHomeworkInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  homeworkId: string;
}

export async function deleteDailyHomework(input: DeleteDailyHomeworkInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "TEACHER"]);

  const [hw] = await db
    .select()
    .from(dailyHomework)
    .where(
      and(
        eq(dailyHomework.id, input.homeworkId),
        eq(dailyHomework.schoolId, session.schoolId)
      )
    )
    .limit(1);

  if (!hw) {
    throw new Error("Homework entry not found or unauthorized.");
  }

  // Non-admins can only delete their own posted homework
  if (session.userRole === "TEACHER" && hw.teacherId && hw.teacherId !== session.userId) {
    throw new Error("Teachers can only delete their own posted homework assignments.");
  }

  await db.transaction(async (tx) => {
    await tx.delete(dailyHomework).where(eq(dailyHomework.id, input.homeworkId));

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "HOMEWORK",
      entityId: input.homeworkId,
      action: "DELETE",
      oldValueJson: hw,
      reason: `Deleted homework assignment: ${hw.title}`,
    });
  });

  safeRevalidate("/academics");
  safeRevalidate("/parent");

  return { success: true };
}

export async function getSectionHomeworkList(input: {
  schoolId?: string;
  academicYearId: string;
  sectionId?: string;
}) {
  const session = await resolveVerifiedSession(input);

  const conditions = [
    eq(dailyHomework.schoolId, session.schoolId),
    eq(dailyHomework.academicYearId, input.academicYearId),
  ];

  if (input.sectionId) {
    conditions.push(eq(dailyHomework.sectionId, input.sectionId));
  }

  const list = await db
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
      teacherName: users.name,
    })
    .from(dailyHomework)
    .innerJoin(subjects, eq(dailyHomework.subjectId, subjects.id))
    .innerJoin(sections, eq(dailyHomework.sectionId, sections.id))
    .innerJoin(classes, eq(sections.classId, classes.id))
    .leftJoin(users, eq(dailyHomework.teacherId, users.id))
    .where(and(...conditions))
    .orderBy(sql`daily_homework.assigned_date DESC`, sql`daily_homework.created_at DESC`);

  return list;
}

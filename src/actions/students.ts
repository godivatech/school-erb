"use server";

import { db } from "@/db";
import {
  families,
  students,
  enrollments,
  classes,
  sections,
  academicYears,
  feeStructures,
  feeInvoices,
  feeInvoiceItems,
  auditLogs,
  studentDocuments,
  studentConcessions,
  feeHeads,
} from "@/db/schema";
import { eq, and, inArray, gt, desc, sql } from "drizzle-orm";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import { getNextAtomicSequence } from "@/lib/counters";
import { assertRole, resolveVerifiedSession, type Role } from "@/lib/guards";

export interface AdmitStudentInput {
  schoolId?: string;
  userId?: string;
  userRole?: "SUPER_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "PARENT";
  academicYearId: string;
  classId: string;
  sectionId: string;
  rollNo?: number;
  admissionNo: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  bloodGroup?: string;
  medicalFlags?: string;
  nationalId?: string;
  emergencyContact?: string;
  concessionCategory?: "NONE" | "RTE_100" | "STAFF_WARD_50" | "SIBLING_15" | "MERIT_25";
  // Family Information
  primaryParentName: string;
  primaryPhone: string;
  secondaryParentName?: string;
  secondaryPhone?: string;
  email?: string;
  address?: string;
  occupation?: string;
}

export async function admitStudentWithFamilyLink(input: AdmitStudentInput) {
  // P0-1: Resolve cryptographically verified session and enforce multi-tenant isolation
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"]);

  return await db.transaction(async (tx) => {
    // 1. Edge Case: Verify Academic Year is ACTIVE (cannot enroll in LOCKED year)
    const [ay] = await tx
      .select({ id: academicYears.id, name: academicYears.name, status: academicYears.status })
      .from(academicYears)
      .where(and(eq(academicYears.id, input.academicYearId), eq(academicYears.schoolId, session.schoolId)))
      .limit(1);

    if (!ay) {
      throw new Error("Specified academic year does not exist.");
    }
    if (ay.status === "LOCKED") {
      throw new Error(`Academic year ${ay.name} is LOCKED. Historical records cannot be modified.`);
    }

    // 2. Edge Case: Admission Number Uniqueness (case-insensitive & trimmed)
    const cleanAdmissionNo = input.admissionNo.trim();
    if (!cleanAdmissionNo) {
      throw new Error("Admission number cannot be empty.");
    }

    const [existingAdm] = await tx
      .select({ id: students.id })
      .from(students)
      .where(
        and(
          eq(students.schoolId, session.schoolId),
          sql`lower(${students.admissionNo}) = lower(${cleanAdmissionNo})`
        )
      )
      .limit(1);

    if (existingAdm) {
      throw new Error(`Admission number '${cleanAdmissionNo}' is already registered to another student in this school.`);
    }

    // 3. Edge Case: Date of Birth & Age Sanity Validation
    const dobDate = new Date(input.dob);
    const today = new Date();
    if (isNaN(dobDate.getTime())) {
      throw new Error("Invalid date of birth provided.");
    }
    if (dobDate >= today) {
      throw new Error("Date of birth must be a past date.");
    }
    const ageYears = (today.getTime() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 2) {
      throw new Error("Student must be at least 2 years old for school enrollment.");
    }
    if (ageYears > 25) {
      throw new Error("Student age exceeds school enrollment guidelines (>25 years).");
    }

    // 4. Edge Case: Section Validation & Capacity Enforcement with Row Lock (P0-4 prevention)
    const [sec] = await tx
      .select({
        id: sections.id,
        name: sections.name,
        classId: sections.classId,
        capacity: sections.capacity,
      })
      .from(sections)
      .where(and(eq(sections.id, input.sectionId), eq(sections.schoolId, session.schoolId)))
      .for("update")
      .limit(1);

    if (!sec || sec.classId !== input.classId) {
      throw new Error("The selected Section does not belong to the selected Grade/Class.");
    }

    const [currentEnrolled] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.schoolId, session.schoolId),
          eq(enrollments.academicYearId, input.academicYearId),
          eq(enrollments.sectionId, input.sectionId),
          eq(enrollments.promotionStatus, "ACTIVE")
        )
      );

    const activeCount = Number(currentEnrolled?.count || 0);
    if (sec.capacity && activeCount >= sec.capacity) {
      throw new Error(
        `Section ${sec.name} is currently at maximum capacity (${sec.capacity} seats). Please select another section or expand seat capacity.`
      );
    }

    // 5. Edge Case: Phone Number Normalization & Family Sibling Linking
    const cleanPhone = input.primaryPhone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length < 10) {
      throw new Error("Primary parent phone number must contain a valid 10-digit mobile number.");
    }

    let [family] = await tx
      .select()
      .from(families)
      .where(
        and(
          eq(families.schoolId, session.schoolId),
          sql`regexp_replace(${families.primaryPhone}, '\\D', '', 'g') LIKE ${'%' + cleanPhone}`
        )
      )
      .limit(1);

    if (!family) {
      [family] = await tx
        .insert(families)
        .values({
          schoolId: session.schoolId,
          primaryParentName: input.primaryParentName.trim(),
          primaryPhone: cleanPhone,
          secondaryParentName: input.secondaryParentName?.trim() || null,
          secondaryPhone: input.secondaryPhone?.replace(/\D/g, "").slice(-10) || null,
          email: input.email?.trim() || null,
          address: input.address?.trim() || null,
          occupation: input.occupation?.trim() || null,
        })
        .returning();
    }

    // 6. Edge Case: Roll Number Auto-Assignment if omitted or duplicate
    let assignedRollNo = input.rollNo;
    if (!assignedRollNo || assignedRollNo <= 0) {
      const [maxRoll] = await tx
        .select({ max: sql<number>`coalesce(max(${enrollments.rollNo}), 0)` })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.sectionId, input.sectionId),
            eq(enrollments.academicYearId, input.academicYearId)
          )
        );
      assignedRollNo = Number(maxRoll?.max || 0) + 1;
    }

    // 7. Insert Student record
    const [student] = await tx
      .insert(students)
      .values({
        schoolId: session.schoolId,
        familyId: family.id,
        admissionNo: cleanAdmissionNo,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        dob: input.dob,
        gender: input.gender,
        bloodGroup: input.bloodGroup?.trim() || null,
        medicalFlags: input.medicalFlags?.trim() || null,
        nationalId: input.nationalId?.trim() || null,
        emergencyContact: input.emergencyContact?.trim() || cleanPhone,
        status: "ACTIVE",
        walletBalance: "0.00",
      })
      .returning();

    // 8. Insert Enrollment
    const [enrollment] = await tx
      .insert(enrollments)
      .values({
        schoolId: session.schoolId,
        studentId: student.id,
        academicYearId: input.academicYearId,
        classId: input.classId,
        sectionId: input.sectionId,
        rollNo: assignedRollNo,
        promotionStatus: "ACTIVE",
        enrollmentDate: new Date().toISOString().split("T")[0],
      })
      .returning();

    // 9. Edge Case: Auto-generate Initial Term / Admission Fee Invoice if fee structure exists
    const structures = await tx
      .select({
        id: feeStructures.id,
        feeHeadId: feeStructures.feeHeadId,
        amount: feeStructures.amount,
      })
      .from(feeStructures)
      .where(
        and(
          eq(feeStructures.schoolId, session.schoolId),
          eq(feeStructures.academicYearId, input.academicYearId),
          eq(feeStructures.classId, input.classId)
        )
      );

    let generatedInvoice = null;
    if (structures.length > 0) {
      const seq = await getNextAtomicSequence(tx, session.schoolId, "INVOICE");
      const yearPrefix = new Date().getFullYear();
      const invoiceNo = `INV-${yearPrefix}-${String(seq).padStart(4, "0")}`;

      const totalBase = structures.reduce((sum, s) => sum + parseFloat(s.amount), 0);

      // Handle Concession Category
      let discountRate = 0;
      let concessionReason: "SCHOLARSHIP" | "STAFF_WARD" | "SIBLING" | "PRINCIPAL_WAIVER" = "SCHOLARSHIP";
      let concessionRemarks = "";

      if (input.concessionCategory && input.concessionCategory !== "NONE") {
        if (input.concessionCategory === "RTE_100") {
          discountRate = 1.0;
          concessionReason = "SCHOLARSHIP";
          concessionRemarks = "RTE 100% Free Education Quota";
        } else if (input.concessionCategory === "STAFF_WARD_50") {
          discountRate = 0.5;
          concessionReason = "STAFF_WARD";
          concessionRemarks = "Staff Ward 50% Tuition Discount";
        } else if (input.concessionCategory === "SIBLING_15") {
          discountRate = 0.15;
          concessionReason = "SIBLING";
          concessionRemarks = "Sibling 15% Tuition Discount";
        } else if (input.concessionCategory === "MERIT_25") {
          discountRate = 0.25;
          concessionReason = "SCHOLARSHIP";
          concessionRemarks = "Merit Scholarship 25% Discount";
        }
      }

      const calculatedDiscount = totalBase * discountRate;
      const netTotal = Math.max(0, totalBase - calculatedDiscount);

      const [invoice] = await tx
        .insert(feeInvoices)
        .values({
          schoolId: session.schoolId,
          academicYearId: input.academicYearId,
          studentId: student.id,
          enrollmentId: enrollment.id,
          invoiceNo,
          installmentLabel: "Admission & Term 1 Fees",
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          baseAmount: totalBase.toFixed(2),
          discountAmount: calculatedDiscount.toFixed(2),
          lateFineAmount: "0.00",
          netAmount: netTotal.toFixed(2),
          paidAmount: "0.00",
          status: netTotal === 0 ? "PAID" : "UNPAID",
        })
        .returning();

      for (const st of structures) {
        await tx.insert(feeInvoiceItems).values({
          invoiceId: invoice.id,
          feeHeadId: st.feeHeadId,
          amount: st.amount,
          paidAmount: "0.00",
        });
      }

      // Record student concession if applicable
      if (discountRate > 0 && structures[0]?.feeHeadId) {
        await tx.insert(studentConcessions).values({
          schoolId: session.schoolId,
          academicYearId: input.academicYearId,
          studentId: student.id,
          feeHeadId: structures[0].feeHeadId,
          discountType: "PERCENTAGE",
          discountValue: (discountRate * 100).toFixed(2),
          reason: concessionReason,
          remarks: concessionRemarks,
          approvedById: session.userId,
        });
      }

      generatedInvoice = invoice;
    }

    // 10. Audit Log
    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "STUDENT",
      entityId: student.id,
      action: "CREATE",
      newValueJson: {
        admissionNo: student.admissionNo,
        name: `${student.firstName} ${student.lastName}`,
        familyId: family.id,
        classId: input.classId,
        sectionId: input.sectionId,
        rollNo: assignedRollNo,
        initialInvoiceNo: generatedInvoice?.invoiceNo || null,
      },
      reason: `Admitted student ${student.firstName} ${student.lastName} with family linking & initial fee generation`,
    });

    safeRevalidatePath("/students");
    safeRevalidatePath("/finance");
    return {
      success: true,
      student,
      family,
      enrollment,
      invoice: generatedInvoice,
    };
  });
}

export interface BulkImportStudentRow {
  admissionNo: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  primaryParentName: string;
  primaryPhone: string;
  email?: string;
  address?: string;
  rollNo?: number;
}

export interface BulkImportStudentsInput {
  schoolId: string;
  userId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  students: BulkImportStudentRow[];
}

export async function bulkImportStudentsCsv(input: BulkImportStudentsInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"]);

  return await db.transaction(async (tx) => {
    const insertedStudents = [];

    for (const row of input.students) {
      // Find or create family
      let [family] = await tx
        .select()
        .from(families)
        .where(
          and(
            eq(families.schoolId, session.schoolId),
            eq(families.primaryPhone, row.primaryPhone)
          )
        )
        .limit(1);

      if (!family) {
        [family] = await tx
          .insert(families)
          .values({
            schoolId: session.schoolId,
            primaryParentName: row.primaryParentName,
            primaryPhone: row.primaryPhone,
            email: row.email,
            address: row.address,
          })
          .returning();
      }

      // Insert student
      const [stu] = await tx
        .insert(students)
        .values({
          schoolId: session.schoolId,
          familyId: family.id,
          admissionNo: row.admissionNo,
          firstName: row.firstName,
          lastName: row.lastName,
          dob: row.dob,
          gender: row.gender,
          status: "ACTIVE",
          walletBalance: "0.00",
        })
        .returning();

      // Insert enrollment
      await tx.insert(enrollments).values({
        schoolId: session.schoolId,
        studentId: stu.id,
        academicYearId: input.academicYearId,
        classId: input.classId,
        sectionId: input.sectionId,
        rollNo: row.rollNo || null,
        promotionStatus: "ACTIVE",
        enrollmentDate: new Date().toISOString().split("T")[0],
      });

      insertedStudents.push(stu);
    }

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "STUDENT_IMPORT",
      entityId: input.sectionId,
      action: "CREATE",
      newValueJson: { count: insertedStudents.length },
      reason: `Batch imported ${insertedStudents.length} students via CSV`,
    });

    safeRevalidatePath("/students");
    return { success: true, count: insertedStudents.length };
  });
}

export interface PromoteOrDetainDecision {
  studentId: string;
  currentEnrollmentId: string;
  status: "PROMOTED" | "DETAINED";
  targetClassId?: string;
  targetSectionId?: string;
  rollNo?: number;
}

export interface PromoteOrDetainInput {
  schoolId: string;
  userId: string;
  targetAcademicYearId: string;
  decisions: PromoteOrDetainDecision[];
}

export async function promoteOrDetainStudents(input: PromoteOrDetainInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    let processedCount = 0;

    for (const d of input.decisions) {
      // 1. Update current enrollment
      await tx
        .update(enrollments)
        .set({ promotionStatus: d.status, updatedAt: new Date() })
        .where(eq(enrollments.id, d.currentEnrollmentId));

      // 2. If promoted or detained into target year
      if (d.targetClassId && d.targetSectionId) {
        // Check if already enrolled in target year
        const [existing] = await tx
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.academicYearId, input.targetAcademicYearId),
              eq(enrollments.studentId, d.studentId)
            )
          )
          .limit(1);

        if (!existing) {
          await tx.insert(enrollments).values({
            schoolId: session.schoolId,
            studentId: d.studentId,
            academicYearId: input.targetAcademicYearId,
            classId: d.targetClassId,
            sectionId: d.targetSectionId,
            rollNo: d.rollNo || null,
            promotionStatus: "ACTIVE",
            enrollmentDate: new Date().toISOString().split("T")[0],
          });
        }
      }
      processedCount++;
    }

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "STUDENT_PROMOTION",
      entityId: input.targetAcademicYearId,
      action: "PROMOTE",
      newValueJson: { count: processedCount },
      reason: `Processed promotion/detention for ${processedCount} students`,
    });

    safeRevalidatePath("/students");
    return { success: true, count: processedCount };
  });
}

export interface IssueTransferCertificateInput {
  schoolId?: string;
  userId?: string;
  userRole?: "SUPER_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "PARENT";
  studentId: string;
  tcReason: string;
  forceOverride?: boolean;
}

export async function issueTransferCertificate(input: IssueTransferCertificateInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"]);

  return await db.transaction(async (tx) => {
    // 1. Check unpaid fee invoices
    const unpaidInvoices = await tx
      .select({
        id: feeInvoices.id,
        invoiceNo: feeInvoices.invoiceNo,
        netAmount: feeInvoices.netAmount,
        paidAmount: feeInvoices.paidAmount,
        status: feeInvoices.status,
      })
      .from(feeInvoices)
      .where(
        and(
          eq(feeInvoices.schoolId, session.schoolId),
          eq(feeInvoices.studentId, input.studentId),
          inArray(feeInvoices.status, ["UNPAID", "PARTIAL"])
        )
      );

    const totalUnpaidDues = unpaidInvoices.reduce((acc, inv) => {
      const net = parseFloat(inv.netAmount || "0");
      const paid = parseFloat(inv.paidAmount || "0");
      return acc + Math.max(0, net - paid);
    }, 0);

    if (totalUnpaidDues > 0 && !input.forceOverride) {
      return {
        success: false,
        error: "UNPAID_DUES_EXIST",
        totalDues: totalUnpaidDues,
        invoices: unpaidInvoices,
        message: `Student has ₹${totalUnpaidDues.toFixed(2)} in outstanding fees across ${unpaidInvoices.length} invoices. Clear dues or obtain Principal override to proceed.`,
      };
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // 2. Mark student as TC_ISSUED
    const [updatedStudent] = await tx
      .update(students)
      .set({
        status: "TC_ISSUED",
        tcIssuedDate: todayStr,
        tcReason: input.tcReason,
        updatedAt: new Date(),
      })
      .where(eq(students.id, input.studentId))
      .returning();

    // 3. Cancel future unbilled installments (due date > today with status UNPAID)
    const cancelledInvoices = await tx
      .update(feeInvoices)
      .set({
        status: "CANCELLED",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(feeInvoices.schoolId, session.schoolId),
          eq(feeInvoices.studentId, input.studentId),
          eq(feeInvoices.status, "UNPAID"),
          gt(feeInvoices.dueDate, todayStr)
        )
      )
      .returning({ id: feeInvoices.id, invoiceNo: feeInvoices.invoiceNo });

    // 4. Audit Log
    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "STUDENT_TC",
      entityId: input.studentId,
      action: "UPDATE",
      newValueJson: {
        status: "TC_ISSUED",
        tcDate: todayStr,
        reason: input.tcReason,
        cancelledFutureInvoices: cancelledInvoices.length,
        hadDuesOverridden: totalUnpaidDues > 0 && input.forceOverride,
      },
      reason: `Issued Transfer Certificate: ${input.tcReason}`,
    });

    safeRevalidatePath("/students");
    safeRevalidatePath("/finance");
    return {
      success: true,
      student: updatedStudent,
      cancelledInvoicesCount: cancelledInvoices.length,
    };
  });
}

export async function lookupFamilyByPhone(schoolId: string, phone: string) {
  const session = await resolveVerifiedSession({ schoolId });
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  if (cleanPhone.length < 7) return null;

  const [family] = await db
    .select()
    .from(families)
    .where(
      and(
        eq(families.schoolId, session.schoolId),
        sql`regexp_replace(${families.primaryPhone}, '\\D', '', 'g') LIKE ${'%' + cleanPhone}`
      )
    )
    .limit(1);

  if (!family) return null;

  const existingChildren = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNo: students.admissionNo,
      className: classes.name,
      sectionName: sections.name,
    })
    .from(students)
    .leftJoin(enrollments, eq(students.id, enrollments.studentId))
    .leftJoin(classes, eq(enrollments.classId, classes.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(
      and(
        eq(students.familyId, family.id),
        eq(students.schoolId, session.schoolId)
      )
    );

  return {
    family,
    children: existingChildren,
  };
}

// ---------------------------------------------------------------------------
// Student Profile Management & Section Transfer Actions
// ---------------------------------------------------------------------------

export interface UpdateStudentProfileInput {
  schoolId?: string;
  userId?: string;
  studentId: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  bloodGroup?: string | null;
  medicalFlags?: string | null;
  emergencyContact?: string | null;
  photoUrl?: string | null;
  primaryParentName: string;
  primaryPhone: string;
  address?: string | null;
}

export async function updateStudentProfile(input: UpdateStudentProfileInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"]);

  if (!input.firstName?.trim() || !input.lastName?.trim()) {
    throw new Error("Student first and last names are required.");
  }
  if (!input.primaryParentName?.trim() || !input.primaryPhone?.trim()) {
    throw new Error("Parent name and mobile phone are required.");
  }

  return await db.transaction(async (tx) => {
    const [student] = await tx
      .select()
      .from(students)
      .where(and(eq(students.id, input.studentId), eq(students.schoolId, session.schoolId)))
      .limit(1);

    if (!student) {
      throw new Error("Student record not found.");
    }

    // 1. Update Student Table
    const [updatedStudent] = await tx
      .update(students)
      .set({
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        dob: input.dob,
        gender: input.gender,
        bloodGroup: input.bloodGroup?.trim() || null,
        medicalFlags: input.medicalFlags?.trim() || null,
        emergencyContact: input.emergencyContact?.trim() || null,
        photoUrl: input.photoUrl !== undefined ? (input.photoUrl?.trim() || null) : student.photoUrl,
        updatedAt: new Date(),
      })
      .where(eq(students.id, input.studentId))
      .returning();

    // 2. Update Linked Family Record
    await tx
      .update(families)
      .set({
        primaryParentName: input.primaryParentName.trim(),
        primaryPhone: input.primaryPhone.trim(),
        address: input.address?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(families.id, student.familyId));

    // 3. Audit log
    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "STUDENT",
      entityId: input.studentId,
      action: "UPDATE",
      oldValueJson: { firstName: student.firstName, lastName: student.lastName },
      newValueJson: { firstName: updatedStudent.firstName, lastName: updatedStudent.lastName },
      reason: `Updated student profile & family details for ${updatedStudent.firstName} ${updatedStudent.lastName}`,
    });

    safeRevalidatePath("/students");
    safeRevalidatePath("/parent");
    return { success: true, student: updatedStudent };
  });
}

export interface TransferStudentSectionInput {
  schoolId?: string;
  userId?: string;
  studentId: string;
  academicYearId: string;
  targetClassId: string;
  targetSectionId: string;
  newRollNo?: number;
}

export async function transferStudentSection(input: TransferStudentSectionInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    // 1. Verify Target Section and check seat capacity
    const [targetSection] = await tx
      .select()
      .from(sections)
      .where(and(eq(sections.id, input.targetSectionId), eq(sections.schoolId, session.schoolId)))
      .limit(1);

    if (!targetSection) {
      throw new Error("Target section does not exist.");
    }

    const [enrolledCountRes] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.schoolId, session.schoolId),
          eq(enrollments.academicYearId, input.academicYearId),
          eq(enrollments.sectionId, input.targetSectionId)
        )
      );

    const currentCount = Number(enrolledCountRes?.count || 0);
    if (currentCount >= targetSection.capacity) {
      throw new Error(`Cannot transfer student: Target Section ${targetSection.name} is full (${currentCount}/${targetSection.capacity} capacity).`);
    }

    // 2. Update Enrollment
    const [updatedEnrollment] = await tx
      .update(enrollments)
      .set({
        classId: input.targetClassId,
        sectionId: input.targetSectionId,
        rollNo: input.newRollNo || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(enrollments.schoolId, session.schoolId),
          eq(enrollments.academicYearId, input.academicYearId),
          eq(enrollments.studentId, input.studentId)
        )
      )
      .returning();

    // 3. Audit log
    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "STUDENT_TRANSFER",
      entityId: input.studentId,
      action: "UPDATE",
      newValueJson: { targetClassId: input.targetClassId, targetSectionId: input.targetSectionId },
      reason: `Transferred student to Section ${targetSection.name}`,
    });

    safeRevalidatePath("/students");
    safeRevalidatePath("/academics");
    return { success: true, enrollment: updatedEnrollment };
  });
}

// ---------------------------------------------------------------------------
// Student Documents & Official Certificates
// ---------------------------------------------------------------------------

export interface UploadStudentDocumentInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  studentId: string;
  documentType: string;
  title: string;
  fileUrl: string;
  fileSize?: string;
}

export async function uploadStudentDocument(input: UploadStudentDocumentInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT", "TEACHER"]);

  if (!input.title?.trim()) {
    throw new Error("Document title is required.");
  }

  const [doc] = await db
    .insert(studentDocuments)
    .values({
      schoolId: session.schoolId,
      studentId: input.studentId,
      documentType: input.documentType,
      title: input.title.trim(),
      fileUrl: input.fileUrl,
      fileSize: input.fileSize || "1.2 MB",
      verificationStatus: "VERIFIED",
      uploadedById: session.userId,
    })
    .returning();

  await db.insert(auditLogs).values({
    schoolId: session.schoolId,
    userId: session.userId,
    entityType: "STUDENT",
    entityId: input.studentId,
    action: "UPDATE",
    newValueJson: { documentId: doc.id, title: doc.title, documentType: doc.documentType },
    reason: `Uploaded official certificate: ${doc.title} (${doc.documentType})`,
  });

  safeRevalidatePath("/students");
  return { success: true, document: doc };
}

export async function getStudentDocuments(input: { schoolId?: string; studentId: string }) {
  const session = await resolveVerifiedSession(input);
  return await db
    .select()
    .from(studentDocuments)
    .where(
      and(
        eq(studentDocuments.schoolId, session.schoolId),
        eq(studentDocuments.studentId, input.studentId)
      )
    )
    .orderBy(desc(studentDocuments.createdAt));
}

export async function deleteStudentDocument(input: {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  documentId: string;
  studentId: string;
}) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  const [deleted] = await db
    .delete(studentDocuments)
    .where(
      and(
        eq(studentDocuments.id, input.documentId),
        eq(studentDocuments.schoolId, session.schoolId)
      )
    )
    .returning();

  if (deleted) {
    await db.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "STUDENT",
      entityId: input.studentId,
      action: "DELETE",
      oldValueJson: { documentId: deleted.id, title: deleted.title },
      reason: `Deleted certificate: ${deleted.title}`,
    });
    safeRevalidatePath("/students");
  }
  return { success: true, deleted };
}

// ---------------------------------------------------------------------------
// Student Concession Management
// ---------------------------------------------------------------------------

export interface UpdateStudentConcessionInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  academicYearId: string;
  studentId: string;
  concessionCategory: "NONE" | "RTE_100" | "STAFF_WARD_50" | "SIBLING_15" | "MERIT_25";
}

export async function updateStudentConcession(input: UpdateStudentConcessionInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"]);

  return await db.transaction(async (tx) => {
    // Delete existing concession for student in this academic year
    await tx
      .delete(studentConcessions)
      .where(
        and(
          eq(studentConcessions.schoolId, session.schoolId),
          eq(studentConcessions.academicYearId, input.academicYearId),
          eq(studentConcessions.studentId, input.studentId)
        )
      );

    if (input.concessionCategory === "NONE") {
      safeRevalidatePath("/students");
      safeRevalidatePath("/finance");
      return { success: true, concession: null };
    }

    // Find primary fee head
    const [feeHead] = await tx
      .select({ id: feeHeads.id })
      .from(feeHeads)
      .where(eq(feeHeads.schoolId, session.schoolId))
      .orderBy(feeHeads.priorityOrder)
      .limit(1);

    if (!feeHead) {
      throw new Error("No fee head configured for concessions.");
    }

    const configMap = {
      RTE_100: { discountValue: "100.00", reason: "SCHOLARSHIP" as const, remarks: "RTE 100% Free Education Quota" },
      STAFF_WARD_50: { discountValue: "50.00", reason: "STAFF_WARD" as const, remarks: "Staff Ward 50% Tuition Discount" },
      SIBLING_15: { discountValue: "15.00", reason: "SIBLING" as const, remarks: "Sibling 15% Tuition Discount" },
      MERIT_25: { discountValue: "25.00", reason: "SCHOLARSHIP" as const, remarks: "Merit Scholarship 25% Discount" },
    };

    const cfg = configMap[input.concessionCategory];

    const [concession] = await tx
      .insert(studentConcessions)
      .values({
        schoolId: session.schoolId,
        academicYearId: input.academicYearId,
        studentId: input.studentId,
        feeHeadId: feeHead.id,
        discountType: "PERCENTAGE",
        discountValue: cfg.discountValue,
        reason: cfg.reason,
        remarks: cfg.remarks,
        approvedById: session.userId,
      })
      .returning();

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "CONCESSION",
      entityId: concession.id,
      action: "CREATE",
      newValueJson: { studentId: input.studentId, concessionCategory: input.concessionCategory, discountValue: cfg.discountValue },
      reason: `Applied fee concession: ${cfg.remarks}`,
    });

    safeRevalidatePath("/students");
    safeRevalidatePath("/finance");
    return { success: true, concession };
  });
}

export async function getStudentConcession(input: { schoolId?: string; academicYearId: string; studentId: string }) {
  const session = await resolveVerifiedSession(input);
  const [concession] = await db
    .select()
    .from(studentConcessions)
    .where(
      and(
        eq(studentConcessions.schoolId, session.schoolId),
        eq(studentConcessions.academicYearId, input.academicYearId),
        eq(studentConcessions.studentId, input.studentId)
      )
    )
    .limit(1);
  return concession || null;
}


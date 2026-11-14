"use server";

import { db } from "@/db";
import {
  staffProfiles,
  staffLeaves,
  staffAdvances,
  payrollRuns,
  timetableSlots,
  substitutions,
  transportRoutes,
  transportStops,
  studentTransport,
  students,
  users,
  auditLogs,
  classes,
  sections,
  subjects,
} from "@/db/schema";
import { eq, and, ne, gte, lte, sql } from "drizzle-orm";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import { assertRole, resolveVerifiedSession, type Role } from "@/lib/guards";

export interface ApproveLeaveAndSubstituteInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  leaveId: string;
  substitutionsMap?: Array<{
    timetableSlotId: string;
    substituteTeacherId: string;
    date: string;
  }>;
}

export async function approveStaffLeaveAndCreateSubstitutions(
  input: ApproveLeaveAndSubstituteInput
) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    // 1. Fetch leave record
    const [leave] = await tx
      .select()
      .from(staffLeaves)
      .where(
        and(
          eq(staffLeaves.id, input.leaveId),
          eq(staffLeaves.schoolId, session.schoolId)
        )
      )
      .limit(1);

    if (!leave) {
      throw new Error("Leave application not found");
    }

    // 2. Fetch staff profile & user
    const [staff] = await tx
      .select({
        profileId: staffProfiles.id,
        userId: staffProfiles.userId,
        clBalance: staffProfiles.casualLeaveBalance,
        slBalance: staffProfiles.sickLeaveBalance,
      })
      .from(staffProfiles)
      .where(eq(staffProfiles.id, leave.staffId))
      .limit(1);

    if (!staff) {
      throw new Error("Staff profile not found");
    }

    // 3. Update staff leave balance if CL or SL
    const days = parseFloat(leave.daysCount || "1.0");
    if (leave.leaveType === "CL") {
      const cur = parseFloat(staff.clBalance || "0");
      await tx
        .update(staffProfiles)
        .set({ casualLeaveBalance: Math.max(0, cur - days).toFixed(1) })
        .where(eq(staffProfiles.id, staff.profileId));
    } else if (leave.leaveType === "SL") {
      const cur = parseFloat(staff.slBalance || "0");
      await tx
        .update(staffProfiles)
        .set({ sickLeaveBalance: Math.max(0, cur - days).toFixed(1) })
        .where(eq(staffProfiles.id, staff.profileId));
    }

    // 4. Mark leave approved
    const [updatedLeave] = await tx
      .update(staffLeaves)
      .set({
        status: "APPROVED",
        approvedById: input.userId,
      })
      .where(eq(staffLeaves.id, leave.id))
      .returning();

    // 5. Create substitutions if provided or auto-assign available teachers
    let createdSubsCount = 0;
    if (input.substitutionsMap && input.substitutionsMap.length > 0) {
      for (const sub of input.substitutionsMap) {
        await tx.insert(substitutions).values({
          schoolId: session.schoolId,
          date: sub.date,
          timetableSlotId: sub.timetableSlotId,
          absentTeacherId: staff.userId,
          substituteTeacherId: sub.substituteTeacherId,
          status: "ACCEPTED",
          notes: `Auto-assigned for approved ${leave.leaveType} leave`,
        });
        createdSubsCount++;
      }
    } else {
      // Find timetable slots taught by this teacher
      const slots = await tx
        .select()
        .from(timetableSlots)
        .where(
          and(
            eq(timetableSlots.schoolId, session.schoolId),
            eq(timetableSlots.teacherId, staff.userId)
          )
        );

      // Find any other active teacher in the school to stand in
      const [alternateTeacher] = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.schoolId, session.schoolId),
            eq(users.role, "TEACHER"),
            sql`${users.id} != ${staff.userId}`
          )
        )
        .limit(1);

      if (alternateTeacher) {
        for (const slot of slots) {
          await tx.insert(substitutions).values({
            schoolId: session.schoolId,
            date: leave.startDate,
            timetableSlotId: slot.id,
            absentTeacherId: staff.userId,
            substituteTeacherId: alternateTeacher.id,
            status: "ACCEPTED",
            notes: `Standing substitution for approved ${leave.leaveType} leave`,
          });
          createdSubsCount++;
        }
      }
    }

    // 6. Audit Log
    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "STAFF_LEAVE",
      entityId: leave.id,
      action: "UPDATE",
      newValueJson: {
        status: "APPROVED",
        substitutionsCount: createdSubsCount,
      },
      reason: `Approved leave and arranged ${createdSubsCount} substitutions`,
    });

    safeRevalidatePath("/payroll");
    safeRevalidatePath("/timetable");
    return { success: true, leave: updatedLeave, substitutionsCount: createdSubsCount };
  });
}

export interface RunMonthlyPayrollInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  monthYear: string; // e.g. "2026-10"
}

export async function runMonthlyPayroll(input: RunMonthlyPayrollInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"]);

  return await db.transaction(async (tx) => {
    // 1. Fetch all staff profiles
    const profiles = await tx
      .select()
      .from(staffProfiles)
      .where(eq(staffProfiles.schoolId, session.schoolId));

    const processedRuns = [];

    for (const p of profiles) {
      const basic = parseFloat(p.basicSalary);
      const hra = parseFloat(p.hra || "0");
      const allowances = parseFloat(p.allowances || "0");
      const grossPay = basic + hra + allowances;

      // 2. Calculate LOP days for this month
      const [year, month] = input.monthYear.split("-").map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const startOfMonth = `${input.monthYear}-01`;
      const endOfMonth = `${input.monthYear}-${String(lastDay).padStart(2, "0")}`;

      const leaves = await tx
        .select({ daysCount: staffLeaves.daysCount })
        .from(staffLeaves)
        .where(
          and(
            eq(staffLeaves.schoolId, session.schoolId),
            eq(staffLeaves.staffId, p.id),
            eq(staffLeaves.leaveType, "LOP"),
            eq(staffLeaves.status, "APPROVED"),
            gte(staffLeaves.startDate, startOfMonth),
            lte(staffLeaves.startDate, endOfMonth)
          )
        );

      const lopDays = leaves.reduce((sum, l) => sum + parseFloat(l.daysCount || "0"), 0);
      const perDaySalary = grossPay / 30;
      const lopDeduction = perDaySalary * lopDays;

      // 3. Fetch active staff advance EMI
      const [advance] = await tx
        .select()
        .from(staffAdvances)
        .where(
          and(
            eq(staffAdvances.schoolId, session.schoolId),
            eq(staffAdvances.staffId, p.id),
            sql`CAST(${staffAdvances.remainingBalance} AS NUMERIC) > 0`
          )
        )
        .limit(1);

      let advanceEmiDeduction = 0;
      if (advance) {
        const remaining = parseFloat(advance.remainingBalance);
        const emi = parseFloat(advance.monthlyEmi);
        advanceEmiDeduction = Math.min(remaining, emi);

        // Deduct advance balance
        const newBalance = Math.max(0, remaining - advanceEmiDeduction);
        await tx
          .update(staffAdvances)
          .set({ remainingBalance: newBalance.toFixed(2) })
          .where(eq(staffAdvances.id, advance.id));
      }

      // Statutory Deductions (Features 8 & 9)
      // 1. EPF: 12% of Basic salary, statutory cap at ₹1,800/mo (₹15,000 wage ceiling per EPFO)
      const calculatedEpf = Math.min(1800, basic * 0.12);
      const epfDeduction = p.pfDeduction ? parseFloat(p.pfDeduction) : calculatedEpf;

      // 2. ESI: 0.75% of Gross pay if gross <= ₹21,000/mo (ESIC statutory wage threshold)
      const esiDeduction = grossPay <= 21000 ? Math.round(grossPay * 0.0075) : 0;

      // 3. Tamil Nadu Professional Tax (TN PT slabs per month):
      let professionalTax = 0;
      if (grossPay > 60000) {
        professionalTax = 417; // Max half-yearly ₹2,500
      } else if (grossPay > 45000) {
        professionalTax = 333;
      } else if (grossPay > 30000) {
        professionalTax = 250;
      } else if (grossPay > 21000) {
        professionalTax = 167;
      }

      const totalDeductions =
        lopDeduction + advanceEmiDeduction + epfDeduction + esiDeduction + professionalTax;
      const netPay = Math.max(0, grossPay - totalDeductions);

      // 4. Upsert Payroll Run
      const [existingRun] = await tx
        .select({ id: payrollRuns.id })
        .from(payrollRuns)
        .where(
          and(
            eq(payrollRuns.schoolId, session.schoolId),
            eq(payrollRuns.monthYear, input.monthYear),
            eq(payrollRuns.staffId, p.id)
          )
        )
        .limit(1);

      let run;
      if (existingRun) {
        [run] = await tx
          .update(payrollRuns)
          .set({
            grossPay: grossPay.toFixed(2),
            lopDays: lopDays.toFixed(1),
            lopDeduction: lopDeduction.toFixed(2),
            advanceEmiDeduction: advanceEmiDeduction.toFixed(2),
            pfDeduction: epfDeduction.toFixed(2),
            epfDeduction: epfDeduction.toFixed(2),
            esiDeduction: esiDeduction.toFixed(2),
            professionalTax: professionalTax.toFixed(2),
            netPay: netPay.toFixed(2),
            status: "APPROVED",
            processedById: session.userId,
          })
          .where(eq(payrollRuns.id, existingRun.id))
          .returning();
      } else {
        [run] = await tx
          .insert(payrollRuns)
          .values({
            schoolId: session.schoolId,
            monthYear: input.monthYear,
            staffId: p.id,
            grossPay: grossPay.toFixed(2),
            lopDays: lopDays.toFixed(1),
            lopDeduction: lopDeduction.toFixed(2),
            advanceEmiDeduction: advanceEmiDeduction.toFixed(2),
            pfDeduction: epfDeduction.toFixed(2),
            epfDeduction: epfDeduction.toFixed(2),
            esiDeduction: esiDeduction.toFixed(2),
            professionalTax: professionalTax.toFixed(2),
            otherDeductions: "0.00",
            netPay: netPay.toFixed(2),
            status: "APPROVED",
            processedById: session.userId,
          })
          .returning();
      }

      processedRuns.push(run);
    }

    // 5. Audit Log
    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "PAYROLL_RUN",
      entityId: input.monthYear,
      action: "CREATE",
      newValueJson: { count: processedRuns.length, monthYear: input.monthYear },
      reason: `Processed automated monthly payroll for ${processedRuns.length} staff members`,
    });

    safeRevalidatePath("/payroll");
    return { success: true, count: processedRuns.length, monthYear: input.monthYear };
  });
}

export interface AssignStudentTransportInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  academicYearId: string;
  studentId: string;
  pickupStopId?: string | null;
  dropStopId?: string | null;
  startDate: string;
  endDate?: string | null;
}

export async function assignStudentTransport(input: AssignStudentTransportInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"]);

  // Edge Case 1: Date chronology
  if (input.endDate && new Date(input.startDate) > new Date(input.endDate)) {
    throw new Error("Transport assignment start date cannot be after end date.");
  }

  return await db.transaction(async (tx) => {
    // Verify student belongs to this school
    const [student] = await tx
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.id, input.studentId), eq(students.schoolId, session.schoolId)))
      .limit(1);

    if (!student) {
      throw new Error("Student not found in your school.");
    }

    // Edge Case 2: If neither pickup nor drop stop provided, clear/unassign transport
    if (!input.pickupStopId && !input.dropStopId) {
      await tx
        .delete(studentTransport)
        .where(
          and(
            eq(studentTransport.academicYearId, input.academicYearId),
            eq(studentTransport.studentId, input.studentId)
          )
        );

      safeRevalidatePath("/transport");
      return {
        success: true,
        assignment: null,
        appliedMonthlyFee: 0,
        message: "Transport unassigned successfully.",
      };
    }

    // Edge Case 3: Vehicle Route Capacity Check
    const stopIdToCheck = input.pickupStopId || input.dropStopId;
    if (stopIdToCheck) {
      const [stopInfo] = await tx
        .select({
          routeId: transportStops.routeId,
          routeName: transportRoutes.routeName,
          capacity: transportRoutes.capacity,
        })
        .from(transportStops)
        .innerJoin(transportRoutes, eq(transportStops.routeId, transportRoutes.id))
        .where(and(eq(transportStops.id, stopIdToCheck), eq(transportRoutes.schoolId, session.schoolId)))
        .limit(1);

      if (!stopInfo) {
        throw new Error("Selected transport stop does not belong to your school.");
      }

      if (stopInfo && stopInfo.capacity) {
        // Lock route row to prevent concurrent overbooking (P0-4 prevention)
        await tx
          .select({ id: transportRoutes.id })
          .from(transportRoutes)
          .where(and(eq(transportRoutes.id, stopInfo.routeId), eq(transportRoutes.schoolId, session.schoolId)))
          .for("update");

        // Count active passengers excluding current student
        const countRes = await tx
          .select({ count: sql<number>`count(distinct ${studentTransport.studentId})` })
          .from(studentTransport)
          .innerJoin(
            transportStops,
            sql`${studentTransport.pickupStopId} = ${transportStops.id} OR ${studentTransport.dropStopId} = ${transportStops.id}`
          )
          .where(
            and(
              eq(studentTransport.academicYearId, input.academicYearId),
              eq(transportStops.routeId, stopInfo.routeId),
              sql`${studentTransport.studentId} != ${input.studentId}`
            )
          );

        const currentActive = Number(countRes[0]?.count || 0);
        if (currentActive >= stopInfo.capacity) {
          throw new Error(
            `Route "${stopInfo.routeName}" has reached its maximum capacity (${currentActive}/${stopInfo.capacity} seats). Cannot assign additional students.`
          );
        }
      }
    }

    let maxMonthlyFee = 0;


    let finalPopup = 12;
    let arr2 = () => {
      finalPopup.toFixed(12)
    }

    /* 

    let initialPop = 11;

    let arr = ()=>{
      initialPop.toFixed(0)
    } 
      
    
*/


    if (input.pickupStopId) {
      const [pickup] = await tx
        .select({ monthlyFee: transportStops.monthlyFee })
        .from(transportStops)
        .innerJoin(transportRoutes, eq(transportStops.routeId, transportRoutes.id))
        .where(and(eq(transportStops.id, input.pickupStopId), eq(transportRoutes.schoolId, session.schoolId)))
        .limit(1);
      if (pickup) {
        maxMonthlyFee = Math.max(maxMonthlyFee, parseFloat(pickup.monthlyFee || "0"));
      }
    }

    if (input.dropStopId) {
      const [drop] = await tx
        .select({ monthlyFee: transportStops.monthlyFee })
        .from(transportStops)
        .innerJoin(transportRoutes, eq(transportStops.routeId, transportRoutes.id))
        .where(and(eq(transportStops.id, input.dropStopId), eq(transportRoutes.schoolId, session.schoolId)))
        .limit(1);
      if (drop) {
        maxMonthlyFee = Math.max(maxMonthlyFee, parseFloat(drop.monthlyFee || "0"));
      }
    }

    // Upsert student_transport
    const [existingAssignment] = await tx
      .select({ id: studentTransport.id })
      .from(studentTransport)
      .where(
        and(
          eq(studentTransport.academicYearId, input.academicYearId),
          eq(studentTransport.studentId, input.studentId)
        )
      )
      .limit(1);

    let assigned;
    if (existingAssignment) {
      [assigned] = await tx
        .update(studentTransport)
        .set({
          pickupStopId: input.pickupStopId || null,
          dropStopId: input.dropStopId || null,
          startDate: input.startDate,
          endDate: input.endDate || null,
        })
        .where(eq(studentTransport.id, existingAssignment.id))
        .returning();
    } else {
      [assigned] = await tx
        .insert(studentTransport)
        .values({
          academicYearId: input.academicYearId,
          studentId: input.studentId,
          pickupStopId: input.pickupStopId || null,
          dropStopId: input.dropStopId || null,
          startDate: input.startDate,
          endDate: input.endDate || null,
        })
        .returning();
    }

    safeRevalidatePath("/transport");
    return {
      success: true,
      assignment: assigned,
      appliedMonthlyFee: maxMonthlyFee,
    };
  });
}

export interface CreateTransportRouteInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  routeName: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  capacity?: number;
}

export async function createTransportRoute(input: CreateTransportRouteInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  if (!input.routeName?.trim()) {
    throw new Error("Route name is required.");
  }
  if (!input.vehicleNo?.trim()) {
    throw new Error("Vehicle registration number is required.");
  }

  const capacity = Math.max(1, Number(input.capacity || 30));

  return await db.transaction(async (tx) => {
    const [route] = await tx
      .insert(transportRoutes)
      .values({
        schoolId: session.schoolId,
        routeName: input.routeName.trim(),
        vehicleNo: input.vehicleNo.trim().toUpperCase(),
        driverName: input.driverName.trim(),
        driverPhone: input.driverPhone.trim(),
        capacity,
      })
      .returning();

    safeRevalidatePath("/transport");
    return { success: true, route };
  });
}

export interface CreateTransportStopInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  routeId: string;
  stopName: string;
  pickupTime: string;
  dropTime: string;
  monthlyFee: number;
  orderIndex?: number;
}

export async function createTransportStop(input: CreateTransportStopInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  if (!input.stopName?.trim()) {
    throw new Error("Stop name is required.");
  }

  const fee = Math.max(0, Number(input.monthlyFee || 0));

  return await db.transaction(async (tx) => {
    // Verify route belongs to session.schoolId
    const [route] = await tx
      .select({ id: transportRoutes.id })
      .from(transportRoutes)
      .where(and(eq(transportRoutes.id, input.routeId), eq(transportRoutes.schoolId, session.schoolId)))
      .limit(1);

    if (!route) {
      throw new Error("Transport route not found in your school.");
    }

    const [stop] = await tx
      .insert(transportStops)
      .values({
        routeId: input.routeId,
        stopName: input.stopName.trim(),
        pickupTime: input.pickupTime || "07:30",
        dropTime: input.dropTime || "15:30",
        monthlyFee: fee.toFixed(2),
        orderIndex: Math.max(1, Number(input.orderIndex || 1)),
      })
      .returning();

    safeRevalidatePath("/transport");
    return { success: true, stop };
  });
}

// ---------------------------------------------------------------------------
// Interactive Timetable & Substitution Server Actions
// ---------------------------------------------------------------------------

export interface AssignTimetableSlotInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  academicYearId: string;
  sectionId: string;
  dayOfWeek: number;
  periodNo: number;
  subjectId: string;
  teacherId?: string | null;
  roomNo?: string | null;
}

export async function assignTimetableSlot(input: AssignTimetableSlotInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    // 1. Conflict Check: is the teacher already booked for another section on the same period?
    let clashWarning: string | null = null;
    if (input.teacherId) {
      const [conflict] = await tx
        .select({
          slotId: timetableSlots.id,
          roomNo: timetableSlots.roomNo,
          sectionName: sections.name,
          className: classes.name,
          subjectName: subjects.name,
        })
        .from(timetableSlots)
        .innerJoin(sections, eq(timetableSlots.sectionId, sections.id))
        .innerJoin(classes, eq(sections.classId, classes.id))
        .innerJoin(subjects, eq(timetableSlots.subjectId, subjects.id))
        .where(
          and(
            eq(timetableSlots.schoolId, session.schoolId),
            eq(timetableSlots.academicYearId, input.academicYearId),
            eq(timetableSlots.dayOfWeek, input.dayOfWeek),
            eq(timetableSlots.periodNo, input.periodNo),
            eq(timetableSlots.teacherId, input.teacherId),
            sql`${timetableSlots.sectionId} != ${input.sectionId}`
          )
        )
        .limit(1);

      if (conflict) {
        clashWarning = `Faculty Conflict Alert: This teacher is already scheduled in ${conflict.className} - Section ${conflict.sectionName} for "${conflict.subjectName}" (Room ${conflict.roomNo || "General"}) during Day ${input.dayOfWeek}, Period ${input.periodNo}!`;
      }
    }

    // 2. Check if slot exists for this section & period
    const [existing] = await tx
      .select({ id: timetableSlots.id })
      .from(timetableSlots)
      .where(
        and(
          eq(timetableSlots.schoolId, session.schoolId),
          eq(timetableSlots.academicYearId, input.academicYearId),
          eq(timetableSlots.sectionId, input.sectionId),
          eq(timetableSlots.dayOfWeek, input.dayOfWeek),
          eq(timetableSlots.periodNo, input.periodNo)
        )
      )
      .limit(1);

    let slot;
    if (existing) {
      [slot] = await tx
        .update(timetableSlots)
        .set({
          subjectId: input.subjectId,
          teacherId: input.teacherId || null,
          roomNo: input.roomNo?.trim() || null,
        })
        .where(eq(timetableSlots.id, existing.id))
        .returning();
    } else {
      [slot] = await tx
        .insert(timetableSlots)
        .values({
          schoolId: session.schoolId,
          academicYearId: input.academicYearId,
          sectionId: input.sectionId,
          dayOfWeek: input.dayOfWeek,
          periodNo: input.periodNo,
          subjectId: input.subjectId,
          teacherId: input.teacherId || null,
          roomNo: input.roomNo?.trim() || null,
        })
        .returning();
    }

    safeRevalidatePath("/timetable");
    return { success: true, slot, clashWarning };
  });
}

export interface ClearTimetableSlotInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  slotId: string;
}

export async function clearTimetableSlot(input: ClearTimetableSlotInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    await tx
      .delete(timetableSlots)
      .where(and(eq(timetableSlots.id, input.slotId), eq(timetableSlots.schoolId, session.schoolId)));

    safeRevalidatePath("/timetable");
    return { success: true };
  });
}

export interface CreateManualSubstitutionInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  date: string;
  timetableSlotId: string;
  absentTeacherId: string;
  substituteTeacherId: string;
  notes?: string | null;
}

export async function createManualSubstitution(input: CreateManualSubstitutionInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    const [sub] = await tx
      .insert(substitutions)
      .values({
        schoolId: session.schoolId,
        date: input.date,
        timetableSlotId: input.timetableSlotId,
        absentTeacherId: input.absentTeacherId,
        substituteTeacherId: input.substituteTeacherId,
        status: "ACCEPTED",
        notes: input.notes?.trim() || "Manual substitution assigned by Principal",
      })
      .returning();

    safeRevalidatePath("/timetable");
    return { success: true, substitution: sub };
  });
}

// ---------------------------------------------------------------------------
// Staff & HR Management Actions
// ---------------------------------------------------------------------------

export interface CreateStaffMemberInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  name: string;
  email: string;
  phone: string;
  role: Role;
  employeeCode: string;
  designation: string;
  basicSalary: number;
  hra?: number;
  casualLeaveBalance?: number;
  sickLeaveBalance?: number;
}

export async function createStaffMember(input: CreateStaffMemberInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  if (!input.name?.trim() || !input.email?.trim() || !input.phone?.trim()) {
    throw new Error("Staff name, email, and phone are required.");
  }
  if (!input.employeeCode?.trim() || !input.designation?.trim()) {
    throw new Error("Employee code and designation are required.");
  }

  const cleanEmail = input.email.trim().toLowerCase();
  const cleanEmpCode = input.employeeCode.trim().toUpperCase();

  return await db.transaction(async (tx) => {
    // 1. Create or find User
    const [user] = await tx
      .insert(users)
      .values({
        schoolId: session.schoolId,
        name: input.name.trim(),
        email: cleanEmail,
        phone: input.phone.trim(),
        role: input.role || "TEACHER",
        isActive: true,
      })
      .returning();

    // 2. Create Staff Profile
    const [profile] = await tx
      .insert(staffProfiles)
      .values({
        userId: user.id,
        schoolId: session.schoolId,
        employeeCode: cleanEmpCode,
        designation: input.designation.trim(),
        basicSalary: String(input.basicSalary || 25000),
        hra: String(input.hra || 5000),
        casualLeaveBalance: String(input.casualLeaveBalance ?? 12.0),
        sickLeaveBalance: String(input.sickLeaveBalance ?? 10.0),
      })
      .returning();

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "STAFF",
      entityId: profile.id,
      action: "CREATE",
      newValueJson: { name: user.name, employeeCode: profile.employeeCode, designation: profile.designation },
      reason: `Created staff member ${user.name} (${profile.designation})`,
    });

    safeRevalidatePath("/hr");
    safeRevalidatePath("/payroll");
    return { success: true, user, profile };
  });
}

export interface SubmitStaffLeaveInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  staffId: string;
  startDate: string;
  endDate: string;
  leaveType: "CL" | "SL" | "LOP";
  reason?: string;
}

export async function submitStaffLeave(input: SubmitStaffLeaveInput) {
  const session = await resolveVerifiedSession(input);

  if (session.userRole === "TEACHER") {
    const [profile] = await db
      .select({ id: staffProfiles.id })
      .from(staffProfiles)
      .where(and(eq(staffProfiles.id, input.staffId), eq(staffProfiles.userId, session.userId)))
      .limit(1);
    if (!profile) {
      throw new Error("You are only authorized to submit leave applications for your own profile.");
    }
  }

  const startObj = new Date(input.startDate);
  const endObj = new Date(input.endDate);
  if (endObj < startObj) {
    throw new Error("End date cannot precede start date.");
  }
  const diffDays = Math.max(1, Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  return await db.transaction(async (tx) => {
    const [leave] = await tx
      .insert(staffLeaves)
      .values({
        schoolId: session.schoolId,
        staffId: input.staffId,
        startDate: input.startDate,
        endDate: input.endDate,
        leaveType: input.leaveType,
        daysCount: String(diffDays),
        reason: input.reason?.trim() || null,
        status: "PENDING",
      })
      .returning();

    safeRevalidatePath("/hr");
    safeRevalidatePath("/payroll");
    safeRevalidatePath("/attendance");
    return { success: true, leave };
  });
}

export interface RejectStaffLeaveInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  leaveId: string;
  rejectionReason?: string;
}

export async function rejectStaffLeave(input: RejectStaffLeaveInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    const [leave] = await tx
      .select()
      .from(staffLeaves)
      .where(and(eq(staffLeaves.id, input.leaveId), eq(staffLeaves.schoolId, session.schoolId)))
      .limit(1);

    if (!leave) {
      throw new Error("Leave application not found.");
    }

    const annotatedReason = input.rejectionReason?.trim()
      ? `${leave.reason ? leave.reason + " " : ""}[Rejected by ${session.userRole}: ${input.rejectionReason.trim()}]`
      : leave.reason;

    const [updatedLeave] = await tx
      .update(staffLeaves)
      .set({
        status: "REJECTED",
        approvedById: session.userId,
        reason: annotatedReason,
      })
      .where(eq(staffLeaves.id, leave.id))
      .returning();

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "STAFF_LEAVE",
      entityId: leave.id,
      action: "REJECT",
      newValueJson: {
        staffId: leave.staffId,
        leaveType: leave.leaveType,
        daysCount: leave.daysCount,
        status: "REJECTED",
      },
      reason: input.rejectionReason?.trim() || "Leave request rejected by administration.",
    });

    safeRevalidatePath("/hr");
    safeRevalidatePath("/payroll");
    safeRevalidatePath("/attendance");
    return { success: true, leave: updatedLeave };
  });
}

// ---------------------------------------------------------------------------
// Transport Route Edit & Student Unassign Actions
// ---------------------------------------------------------------------------

export interface UpdateTransportRouteInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  routeId: string;
  routeName: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  capacity: number;
}

export async function updateTransportRoute(input: UpdateTransportRouteInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(transportRoutes)
      .set({
        routeName: input.routeName.trim(),
        vehicleNo: input.vehicleNo.trim().toUpperCase(),
        driverName: input.driverName.trim(),
        driverPhone: input.driverPhone.trim(),
        capacity: Math.max(1, input.capacity),
      })
      .where(and(eq(transportRoutes.id, input.routeId), eq(transportRoutes.schoolId, session.schoolId)))
      .returning();

    safeRevalidatePath("/transport");
    return { success: true, route: updated };
  });
}

export interface UnassignStudentTransportInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  assignmentId: string;
}

export async function unassignStudentTransport(input: UnassignStudentTransportInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    await tx.delete(studentTransport).where(eq(studentTransport.id, input.assignmentId));
    safeRevalidatePath("/transport");
    return { success: true };
  });
}

// ---------------------------------------------------------------------------
// Staff Member Update & Salary Appraisal Action
// ---------------------------------------------------------------------------

export interface UpdateStaffMemberInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  staffId: string; // staffProfiles.id
  name: string;
  email: string;
  phone: string;
  role: Role;
  employeeCode: string;
  designation: string;
  basicSalary: number;
  hra: number;
  casualLeaveBalance?: number;
  sickLeaveBalance?: number;
  bankAccountNumber?: string;
  bankIfsc?: string;
  isActive?: boolean;
  appraisalReason?: string;
}

export async function updateStaffMember(input: UpdateStaffMemberInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  if (!input.staffId) {
    throw new Error("Staff ID is required.");
  }
  if (!input.name?.trim() || !input.email?.trim() || !input.phone?.trim()) {
    throw new Error("Staff name, email, and phone are required.");
  }
  if (!input.employeeCode?.trim() || !input.designation?.trim()) {
    throw new Error("Employee code and designation are required.");
  }
  if (isNaN(input.basicSalary) || input.basicSalary < 0) {
    throw new Error("Basic salary must be a valid positive amount.");
  }
  if (isNaN(input.hra) || input.hra < 0) {
    throw new Error("HRA must be a valid positive amount.");
  }

  const cleanEmail = input.email.trim().toLowerCase();
  const cleanEmpCode = input.employeeCode.trim().toUpperCase();

  return await db.transaction(async (tx) => {
    // 1. Fetch current profile
    const [existingProfile] = await tx
      .select({
        id: staffProfiles.id,
        userId: staffProfiles.userId,
        employeeCode: staffProfiles.employeeCode,
        basicSalary: staffProfiles.basicSalary,
        hra: staffProfiles.hra,
        designation: staffProfiles.designation,
        casualLeaveBalance: staffProfiles.casualLeaveBalance,
        sickLeaveBalance: staffProfiles.sickLeaveBalance,
      })
      .from(staffProfiles)
      .where(
        and(
          eq(staffProfiles.id, input.staffId),
          eq(staffProfiles.schoolId, session.schoolId)
        )
      )
      .limit(1);

    if (!existingProfile) {
      throw new Error("Staff profile not found.");
    }

    // 2. Check employee code uniqueness (excluding current profile)
    const [duplicateCode] = await tx
      .select({ id: staffProfiles.id })
      .from(staffProfiles)
      .where(
        and(
          eq(staffProfiles.schoolId, session.schoolId),
          eq(staffProfiles.employeeCode, cleanEmpCode),
          ne(staffProfiles.id, input.staffId)
        )
      )
      .limit(1);

    if (duplicateCode) {
      throw new Error(`Employee Code '${cleanEmpCode}' is already assigned to another staff member.`);
    }

    // 3. Check email uniqueness (excluding current user)
    const [duplicateEmail] = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.schoolId, session.schoolId),
          eq(users.email, cleanEmail),
          ne(users.id, existingProfile.userId)
        )
      )
      .limit(1);

    if (duplicateEmail) {
      throw new Error(`Email '${cleanEmail}' is already used by another user in this school.`);
    }

    // 4. Update User record
    const [updatedUser] = await tx
      .update(users)
      .set({
        name: input.name.trim(),
        email: cleanEmail,
        phone: input.phone.trim(),
        role: input.role || "TEACHER",
        isActive: input.isActive ?? true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.id, existingProfile.userId),
          eq(users.schoolId, session.schoolId)
        )
      )
      .returning();

    // 5. Update Staff Profile (including leave quotas)
    const [updatedProfile] = await tx
      .update(staffProfiles)
      .set({
        employeeCode: cleanEmpCode,
        designation: input.designation.trim(),
        basicSalary: String(input.basicSalary),
        hra: String(input.hra),
        ...(input.casualLeaveBalance !== undefined && !isNaN(input.casualLeaveBalance)
          ? { casualLeaveBalance: String(input.casualLeaveBalance.toFixed(1)) }
          : {}),
        ...(input.sickLeaveBalance !== undefined && !isNaN(input.sickLeaveBalance)
          ? { sickLeaveBalance: String(input.sickLeaveBalance.toFixed(1)) }
          : {}),
        bankAccountNumber: input.bankAccountNumber?.trim() || null,
        bankIfsc: input.bankIfsc?.trim() || null,
      })
      .where(
        and(
          eq(staffProfiles.id, input.staffId),
          eq(staffProfiles.schoolId, session.schoolId)
        )
      )
      .returning();

    // 6. Audit Trail with Salary Increment & Leave Quota detection
    const oldTotal = parseFloat(existingProfile.basicSalary) + parseFloat(existingProfile.hra || "0");
    const newTotal = input.basicSalary + input.hra;
    const diff = newTotal - oldTotal;

    let auditReason = input.appraisalReason?.trim();
    if (!auditReason) {
      if (diff > 0) {
        auditReason = `Salary Appraisal (+₹${diff.toLocaleString()}): Basic ₹${input.basicSalary.toLocaleString()}, HRA ₹${input.hra.toLocaleString()}`;
      } else if (diff < 0) {
        auditReason = `Salary Adjustment (-₹${Math.abs(diff).toLocaleString()}): Basic ₹${input.basicSalary.toLocaleString()}, HRA ₹${input.hra.toLocaleString()}`;
      } else if (input.casualLeaveBalance !== undefined || input.sickLeaveBalance !== undefined) {
        auditReason = `Updated leave quotas for ${updatedUser.name} (${cleanEmpCode}): CL ${updatedProfile.casualLeaveBalance}, SL ${updatedProfile.sickLeaveBalance}`;
      } else {
        auditReason = `Updated staff profile for ${updatedUser.name} (${cleanEmpCode})`;
      }
    }

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "STAFF",
      entityId: updatedProfile.id,
      action: "UPDATE",
      newValueJson: {
        name: updatedUser.name,
        employeeCode: cleanEmpCode,
        designation: updatedProfile.designation,
        basicSalary: updatedProfile.basicSalary,
        hra: updatedProfile.hra,
        casualLeaveBalance: updatedProfile.casualLeaveBalance,
        sickLeaveBalance: updatedProfile.sickLeaveBalance,
        oldTotal,
        newTotal,
        diff,
        isActive: updatedUser.isActive,
      },
      reason: auditReason,
    });

    safeRevalidatePath("/payroll");
    safeRevalidatePath("/academics");
    safeRevalidatePath("/timetable");

    return {
      success: true,
      user: updatedUser,
      profile: updatedProfile,
      salaryDiff: diff,
    };
  });
}

import * as React from "react";
import { db } from "@/db";
import {
  staffProfiles,
  staffLeaves,
  staffAdvances,
  payrollRuns,
  users,
  academicYears,
} from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  PayrollClient,
  PayrollStaffItem,
  LeaveRequestItem,
  StaffDirectoryItem,
} from "./payroll-client";

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/context";

export default async function PayrollPage() {
  const context = await getActiveContext();

  // Role guard: Only Super Admin, Principal, and Accountant can access payroll
  if (context.user.role === "PARENT") {
    redirect("/parent");
  }
  if (context.user.role === "TEACHER") {
    redirect("/attendance");
  }

  // 1. Fetch active academic year
  const [activeYear] = await db
    .select()
    .from(academicYears)
    .where(eq(academicYears.status, "ACTIVE"))
    .limit(1);

  const schoolId = activeYear?.schoolId || "sch_oxford_001";
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 2. Fetch staff profiles joined with users
  const staff = await db
    .select({
      profileId: staffProfiles.id,
      employeeCode: staffProfiles.employeeCode,
      designation: staffProfiles.designation,
      basicSalary: staffProfiles.basicSalary,
      hra: staffProfiles.hra,
      allowances: staffProfiles.allowances,
      pfDeduction: staffProfiles.pfDeduction,
      casualLeaveBalance: staffProfiles.casualLeaveBalance,
      sickLeaveBalance: staffProfiles.sickLeaveBalance,
      bankAccountNumber: staffProfiles.bankAccountNumber,
      bankIfsc: staffProfiles.bankIfsc,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      userId: users.id,
    })
    .from(staffProfiles)
    .innerJoin(users, eq(staffProfiles.userId, users.id))
    .where(eq(staffProfiles.schoolId, schoolId))
    .orderBy(staffProfiles.employeeCode);

  // 3. Fetch payroll runs for current month if already executed
  const existingRuns = await db
    .select()
    .from(payrollRuns)
    .where(
      and(
        eq(payrollRuns.schoolId, schoolId),
        eq(payrollRuns.monthYear, monthYear)
      )
    );

  const runMap = new Map(existingRuns.map((r) => [r.staffId, r]));

  // 4. Fetch advances
  const advances = await db
    .select()
    .from(staffAdvances)
    .where(
      and(
        eq(staffAdvances.schoolId, schoolId),
        sql`CAST(${staffAdvances.remainingBalance} AS NUMERIC) > 0`
      )
    );

  const advanceMap = new Map(advances.map((a) => [a.staffId, a]));

  const staffDirectory: StaffDirectoryItem[] = staff.map((s) => ({
    id: s.profileId,
    userId: s.userId,
    name: s.name,
    email: s.email,
    phone: s.phone,
    role: s.role,
    employeeCode: s.employeeCode,
    designation: s.designation,
    basicSalary: parseFloat(s.basicSalary),
    hra: parseFloat(s.hra || "0"),
    casualLeaveBalance: parseFloat(s.casualLeaveBalance || "12"),
    sickLeaveBalance: parseFloat(s.sickLeaveBalance || "10"),
    bankAccountNumber: s.bankAccountNumber,
    bankIfsc: s.bankIfsc,
  }));

  const staffList: PayrollStaffItem[] = staff.map((s) => {
    const run = runMap.get(s.profileId);
    const basic = parseFloat(s.basicSalary);
    const hra = parseFloat(s.hra || "0");
    const allowances = parseFloat(s.allowances || "0");
    const gross = basic + hra + allowances;

    const epf = run?.epfDeduction
      ? parseFloat(run.epfDeduction)
      : Math.min(1800, basic * 0.12);
    const esi = run?.esiDeduction
      ? parseFloat(run.esiDeduction)
      : gross <= 21000
      ? Math.round(gross * 0.0075)
      : 0;
    let pt = 0;
    if (run?.professionalTax) {
      pt = parseFloat(run.professionalTax);
    } else {
      if (gross > 60000) pt = 417;
      else if (gross > 45000) pt = 333;
      else if (gross > 30000) pt = 250;
      else if (gross > 21000) pt = 167;
    }

    if (run) {
      return {
        staffId: s.profileId,
        empCode: s.employeeCode,
        name: s.name,
        designation: s.designation,
        basicSalary: basic,
        hra,
        allowances,
        grossPay: parseFloat(run.grossPay || String(gross)),
        lopDays: parseFloat(run.lopDays),
        lopDeduction: parseFloat(run.lopDeduction),
        advanceEmi: parseFloat(run.advanceEmiDeduction),
        epfDeduction: epf,
        esiDeduction: esi,
        professionalTax: pt,
        netPay: parseFloat(run.netPay),
        status: run.status as any,
        bankAccount: s.bankAccountNumber,
        bankIfsc: s.bankIfsc,
      };
    }

    const adv = advanceMap.get(s.profileId);
    const emi = adv ? Math.min(parseFloat(adv.remainingBalance), parseFloat(adv.monthlyEmi)) : 0;
    const totalDeductions = epf + esi + pt + emi;
    const net = Math.max(0, gross - totalDeductions);

    return {
      staffId: s.profileId,
      empCode: s.employeeCode,
      name: s.name,
      designation: s.designation,
      basicSalary: basic,
      hra,
      allowances,
      grossPay: gross,
      lopDays: 0,
      lopDeduction: 0,
      advanceEmi: emi,
      epfDeduction: epf,
      esiDeduction: esi,
      professionalTax: pt,
      netPay: net,
      status: "DRAFT",
      bankAccount: s.bankAccountNumber,
      bankIfsc: s.bankIfsc,
    };
  });

  // 5. Fetch leaves (both pending and recent)
  const rawLeaves = await db
    .select({
      id: staffLeaves.id,
      staffId: staffLeaves.staffId,
      leaveType: staffLeaves.leaveType,
      startDate: staffLeaves.startDate,
      endDate: staffLeaves.endDate,
      daysCount: staffLeaves.daysCount,
      reason: staffLeaves.reason,
      status: staffLeaves.status,
      name: users.name,
      empCode: staffProfiles.employeeCode,
    })
    .from(staffLeaves)
    .innerJoin(staffProfiles, eq(staffLeaves.staffId, staffProfiles.id))
    .innerJoin(users, eq(staffProfiles.userId, users.id))
    .where(eq(staffLeaves.schoolId, schoolId))
    .orderBy(desc(staffLeaves.createdAt))
    .limit(30);

  const leaves: LeaveRequestItem[] = rawLeaves.map((l) => ({
    id: l.id,
    staffId: l.staffId,
    staffName: l.name,
    empCode: l.empCode,
    leaveType: l.leaveType,
    startDate: l.startDate,
    endDate: l.endDate,
    daysCount: l.daysCount,
    reason: l.reason,
    status: l.status,
  }));

  return (
    <PayrollClient
      staffDirectory={staffDirectory}
      staffList={staffList}
      leaves={leaves}
      monthYear={monthYear}
      schoolId={schoolId}
      isLocked={activeYear?.status === "LOCKED"}
    />
  );
}

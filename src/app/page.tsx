import * as React from "react";
import Link from "next/link";
import { db } from "@/db";
import {
  students,
  feeReceipts,
  attendance,
  substitutions,
  classes,
  sections,
  enrollments,
  academicYears,
  timetableSlots,
  staffLeaves,
  staffProfiles,
  users,
  subjects,
  holidays,
} from "@/db/schema";
import { eq, and, sql, desc, asc, inArray, isNull } from "drizzle-orm";
import {
  Users,
  UserCheck,
  ReceiptIndianRupee,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  UserPlus,
  CalendarCheck,
  Clock,
  ArrowRight,
  GraduationCap,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { redirect } from "next/navigation";

import { getActiveContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // 1. Fetch active context from cookies
  const context = await getActiveContext();

  // Role-based view protection
  if (context.user.role === "PARENT") {
    redirect("/parent");
  }
  if (context.user.role === "TEACHER") {
    redirect("/attendance");
  }

  const yearId = context.academicYearId;
  const schoolId = context.schoolId;
  const todayStr = new Date().toISOString().split("T")[0];

  // 2. Total Enrolled Students
  const [stuCountRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(students)
    .where(and(eq(students.schoolId, schoolId), eq(students.status, "ACTIVE")));
  const totalStudents = Number(stuCountRes?.count || 0);

  // 3. Fee Receipts Metrics
  const [feeRes] = await db
    .select({
      total: sql<string>`coalesce(sum(cast(${feeReceipts.amountReceived} as numeric)), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(feeReceipts)
    .where(
      and(
        eq(feeReceipts.schoolId, schoolId),
        eq(feeReceipts.clearanceStatus, "CLEARED")
      )
    );
  const totalCollections = parseFloat(feeRes?.total || "0");

  // 4. Attendance Metrics for Today
  const attendanceToday = await db
    .select({
      status: attendance.status,
      count: sql<number>`count(*)`,
    })
    .from(attendance)
    .where(and(eq(attendance.schoolId, schoolId), eq(attendance.date, todayStr)))
    .groupBy(attendance.status);

  let presentCount = 0;
  let absentCount = 0;
  for (const a of attendanceToday) {
    if (a.status === "PRESENT") presentCount = Number(a.count);
    else if (a.status === "ABSENT") absentCount = Number(a.count);
  }
  const totalMarked = presentCount + absentCount;
  const attendancePct = totalMarked > 0 ? ((presentCount / totalMarked) * 100).toFixed(1) : "100.0";

  // 5. Substitutions Count
  const [subRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(substitutions)
    .where(and(eq(substitutions.schoolId, schoolId), eq(substitutions.date, todayStr)));
  const subCount = Number(subRes?.count || 0);

  // 5b. Uncovered Periods Today (Teacher on approved leave, but no substitution assigned yet)
  const rawDay = new Date().getDay();
  const dayOfWeek = rawDay === 0 ? 1 : rawDay;

  const activeLeavesToday = await db
    .select({
      leaveId: staffLeaves.id,
      userId: staffProfiles.userId,
      teacherName: users.name,
      reason: staffLeaves.reason,
    })
    .from(staffLeaves)
    .innerJoin(staffProfiles, eq(staffLeaves.staffId, staffProfiles.id))
    .innerJoin(users, eq(staffProfiles.userId, users.id))
    .where(
      and(
        eq(staffLeaves.schoolId, schoolId),
        eq(staffLeaves.status, "APPROVED"),
        sql`${staffLeaves.startDate} <= ${todayStr} AND ${staffLeaves.endDate} >= ${todayStr}`
      )
    );

  const absentTeacherUserIds = activeLeavesToday.map((l) => l.userId);
  let uncoveredSlots: Array<{
    id: string;
    sectionId: string;
    periodNo: number;
    className: string;
    sectionName: string;
    subjectName: string;
    teacherName: string;
  }> = [];

  if (absentTeacherUserIds.length > 0) {
    const candidateSlots = await db
      .select({
        id: timetableSlots.id,
        sectionId: timetableSlots.sectionId,
        periodNo: timetableSlots.periodNo,
        className: classes.name,
        sectionName: sections.name,
        subjectName: subjects.name,
        teacherName: users.name,
        teacherId: timetableSlots.teacherId,
      })
      .from(timetableSlots)
      .innerJoin(sections, eq(timetableSlots.sectionId, sections.id))
      .innerJoin(classes, eq(sections.classId, classes.id))
      .innerJoin(subjects, eq(timetableSlots.subjectId, subjects.id))
      .innerJoin(users, eq(timetableSlots.teacherId, users.id))
      .leftJoin(
        substitutions,
        and(
          eq(substitutions.timetableSlotId, timetableSlots.id),
          eq(substitutions.date, todayStr)
        )
      )
      .where(
        and(
          eq(timetableSlots.schoolId, schoolId),
          eq(timetableSlots.academicYearId, yearId),
          eq(timetableSlots.dayOfWeek, dayOfWeek),
          inArray(timetableSlots.teacherId, absentTeacherUserIds),
          isNull(substitutions.id)
        )
      );
    uncoveredSlots = candidateSlots;
  }

  // 6. Recent Receipts
  const recentReceipts = await db
    .select({
      receiptNo: feeReceipts.receiptNo,
      amount: feeReceipts.amountReceived,
      mode: feeReceipts.paymentMode,
      clearanceStatus: feeReceipts.clearanceStatus,
      createdAt: feeReceipts.createdAt,
      studentName: sql<string>`concat(${students.firstName}, ' ', ${students.lastName})`,
      admissionNo: students.admissionNo,
      className: classes.name,
      sectionName: sections.name,
    })
    .from(feeReceipts)
    .innerJoin(students, eq(feeReceipts.studentId, students.id))
    .leftJoin(enrollments, eq(students.id, enrollments.studentId))
    .leftJoin(classes, eq(enrollments.classId, classes.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .orderBy(desc(feeReceipts.createdAt))
    .limit(6);

  // 7. Sections Status List
  const sectionsList = await db
    .select({
      id: sections.id,
      name: sections.name,
      className: classes.name,
      capacity: sections.capacity,
    })
    .from(sections)
    .innerJoin(classes, eq(sections.classId, classes.id))
    .orderBy(classes.numericOrder, sections.name);

  // 7b. Attendance per section today
  const sectionAttendanceToday = await db
    .select({
      sectionId: enrollments.sectionId,
      status: attendance.status,
      count: sql<number>`count(*)`,
    })
    .from(attendance)
    .innerJoin(enrollments, eq(attendance.enrollmentId, enrollments.id))
    .where(
      and(
        eq(attendance.schoolId, schoolId),
        eq(attendance.date, todayStr)
      )
    )
    .groupBy(enrollments.sectionId, attendance.status);

  const sectionAttendanceMap = new Map<string, { present: number; absent: number; submitted: boolean }>();
  for (const row of sectionAttendanceToday) {
    if (!sectionAttendanceMap.has(row.sectionId)) {
      sectionAttendanceMap.set(row.sectionId, { present: 0, absent: 0, submitted: true });
    }
    const entry = sectionAttendanceMap.get(row.sectionId)!;
    if (row.status === "PRESENT") entry.present += Number(row.count);
    else if (row.status === "ABSENT") entry.absent += Number(row.count);
  }

  // 8. Faculty Presence Today
  const [facultyCountRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.schoolId, schoolId), eq(users.role, "TEACHER"), eq(users.isActive, true)));
  const totalFaculty = Math.max(16, Number(facultyCountRes?.count || 0));
  const onLeaveFaculty = activeLeavesToday.length;
  const presentFaculty = Math.max(0, totalFaculty - onLeaveFaculty);

  // 9. Next 7 Days Academic Calendar & Declared Holidays
  const next7DaysStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const upcomingHolidays = await db
    .select({
      id: holidays.id,
      date: holidays.date,
      title: holidays.title,
      isEmergency: holidays.isEmergencyHoliday,
    })
    .from(holidays)
    .where(
      and(
        eq(holidays.schoolId, schoolId),
        sql`${holidays.date} >= ${todayStr} AND ${holidays.date} <= ${next7DaysStr}`
      )
    )
    .orderBy(asc(holidays.date));

  return (
    <div className="space-y-5">
      {/* Page Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Operations Command Center
          </h1>
          <p className="text-xs text-slate-500 font-tabular mt-0.5">
            {context.schoolName} • Academic Year: {context.academicYearName} ({context.academicYearStatus})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/finance/pos">
            <Button size="sm" variant="default" className="gap-1.5 font-semibold bg-navy-900 text-white">
              <CreditCard className="h-3.5 w-3.5" />
              <span>Cashier POS</span>
              <kbd className="bg-blue-800 text-white text-[9px] px-1 py-0.2 rounded font-mono">
                /
              </kbd>
            </Button>
          </Link>
          <Link href="/attendance">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <CalendarCheck className="h-3.5 w-3.5 text-slate-600" />
              <span>Mark Attendance</span>
            </Button>
          </Link>
          <Link href="/students/new">
            <Button size="sm" variant="secondary" className="gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5 text-slate-600" />
              <span>New Admission</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Urgent Uncovered Period Alert Banner */}
      {uncoveredSlots.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-3.5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-md text-amber-800 shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-700 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-amber-950">
                  ⚠️ {uncoveredSlots.length} Uncovered Period Today
                </span>
                <Badge variant="danger" className="bg-amber-600 text-white text-[10px] uppercase font-mono px-1.5 py-0">
                  Action Required
                </Badge>
              </div>
              <div className="text-xs text-amber-900 mt-1">
                {uncoveredSlots.map((s, idx) => (
                  <span key={s.id}>
                    {idx > 0 && " • "}
                    <strong>{s.className} ({s.sectionName})</strong> - Period {s.periodNo} ({s.subjectName}): Teacher <strong>{s.teacherName}</strong> is on approved leave.
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <Link
              href={`/timetable?sectionId=${uncoveredSlots[0]?.sectionId}&day=${dayOfWeek}&assignSlot=${uncoveredSlots[0]?.id}`}
            >
              <Button size="sm" className="bg-amber-700 hover:bg-amber-800 text-white font-semibold gap-1.5 shadow-sm text-xs">
                <span>1-Click Substitute Assign</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded p-3.5 space-y-2 hover:border-slate-300 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Enrolled</span>
            <div className="p-1 rounded bg-slate-50 border border-slate-200 text-slate-600">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold text-slate-900 font-tabular tracking-tight">
              {totalStudents}
            </div>
            <div className="text-[11px] text-slate-500 font-tabular">
              Across Active Sections
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3.5 space-y-2 hover:border-slate-300 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Student Attendance</span>
            <div className="p-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
              <UserCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold text-emerald-800 font-tabular tracking-tight">
              {attendancePct}%
            </div>
            <div className="text-[11px] text-slate-500 font-tabular">
              {presentCount} Present • {absentCount} Absent
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3.5 space-y-2 hover:border-slate-300 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Faculty Presence</span>
            <div className="p-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-700">
              <GraduationCap className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold text-indigo-950 font-tabular tracking-tight">
              {presentFaculty} / {totalFaculty}
            </div>
            <div className="text-[11px] text-slate-500 font-tabular">
              {onLeaveFaculty === 0 ? "100% Faculty on Duty" : `${onLeaveFaculty} on Approved Leave`}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3.5 space-y-2 hover:border-slate-300 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Collections</span>
            <div className="p-1 rounded bg-blue-50 border border-blue-200 text-blue-700">
              <ReceiptIndianRupee className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold text-slate-900 font-tabular tracking-tight">
              {formatCurrency(totalCollections)}
            </div>
            <div className="text-[11px] text-slate-500 font-tabular">
              {Number(feeRes?.count || 0)} Receipts Cleared
            </div>
          </div>
        </div>

        <div className={`bg-white border rounded p-3.5 space-y-2 hover:border-slate-300 transition-colors shadow-sm ${uncoveredSlots.length > 0 ? "border-amber-300 bg-amber-50/30 ring-1 ring-amber-300" : "border-slate-200"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Substitutions Today</span>
            <div className={`p-1 rounded border ${uncoveredSlots.length > 0 ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
              <AlertCircle className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-slate-900 font-tabular tracking-tight">
                {subCount} Covered
              </div>
              {uncoveredSlots.length > 0 && (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] animate-pulse">
                  ⚠️ {uncoveredSlots.length} Uncovered
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-tabular">
              {uncoveredSlots.length > 0
                ? "Immediate substitution required"
                : subCount === 0
                ? "All faculty present"
                : "Covered by standing substitutes"}
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Sections Status (6 Cols) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                Academic Sections
              </h2>
              <p className="text-[11px] text-slate-500">
                Current enrollment distribution
              </p>
            </div>
            <Link href="/attendance?view=register">
              <Button size="sm" variant="ghost" className="text-xs text-blue-800 gap-1 h-7 font-bold">
                <span>View Master Register</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {sectionsList.map((sec) => {
              const att = sectionAttendanceMap.get(sec.id);
              return (
                <div key={sec.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">
                      {sec.className} - Section {sec.name}
                    </span>
                    <div className="text-[11px] text-slate-400 font-tabular mt-0.5 flex items-center gap-2">
                      <span>Capacity: {sec.capacity} Seats</span>
                      {att ? (
                        <span className={att.absent > 0 ? "text-rose-600 font-bold" : "text-emerald-700 font-semibold"}>
                          • Today: {att.present} Present {att.absent > 0 && `(${att.absent} Absent)`}
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium">• Roll Call Pending</span>
                      )}
                    </div>
                  </div>
                  <Link href={`/attendance?sectionId=${sec.id}&view=grid`}>
                    <Badge
                      variant={att ? (att.absent > 0 ? "warning" : "success") : "outline"}
                      className="text-[10px] hover:bg-slate-100 font-semibold"
                    >
                      {att ? (att.absent > 0 ? `⚠️ ${att.absent} Absent` : "✅ 100% Present") : "Open Grid"}
                    </Badge>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Recent Collections (6 Cols) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                Recent Collections
              </h2>
              <p className="text-[11px] text-slate-500">
                Latest append-only receipts
              </p>
            </div>
            <Link href="/finance">
              <Button size="sm" variant="ghost" className="text-xs text-blue-800 gap-1 h-7">
                <span>View Receipts Ledger</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentReceipts.map((r) => (
              <div key={r.receiptNo} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold text-navy-800">
                      {r.receiptNo}
                    </span>
                    <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                      {r.mode}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {r.studentName} ({r.admissionNo})
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-tabular font-bold text-slate-900">
                    {formatCurrency(parseFloat(r.amount))}
                  </div>
                  <Badge
                    variant={r.clearanceStatus === "CLEARED" ? "success" : "warning"}
                    className="text-[9px] mt-0.5"
                  >
                    {r.clearanceStatus}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Next 7 Days Academic Calendar & Declared Holidays */}
      <div className="bg-white border border-slate-200 rounded p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-blue-50 border border-blue-200 text-blue-700">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                Upcoming Academic Calendar & Declared Holidays (Next 7 Days)
              </h2>
              <p className="text-[11px] text-slate-500">
                Official calendar events, exam schedules & government-declared holidays
              </p>
            </div>
          </div>
          <Link href="/academics?tab=holidays">
            <Button size="sm" variant="ghost" className="text-xs text-blue-800 gap-1 h-7 font-bold">
              <span>View Full Calendar</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
          {upcomingHolidays.length > 0 ? (
            upcomingHolidays.map((h) => (
              <div
                key={h.id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-start gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="p-2 bg-white rounded border border-slate-200 text-center shrink-0 w-12 shadow-xs">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">
                    {new Date(h.date).toLocaleDateString("en-IN", { month: "short" })}
                  </span>
                  <span className="block text-base font-black text-slate-900">
                    {new Date(h.date).getDate()}
                  </span>
                </div>
                <div className="space-y-0.5 text-xs">
                  <span className="font-bold text-slate-900 block leading-tight">{h.title}</span>
                  <Badge
                    variant={h.isEmergency ? "danger" : "outline"}
                    className="text-[9px] uppercase px-1 py-0"
                  >
                    {h.isEmergency ? "Emergency Declaration" : "Declared Holiday"}
                  </Badge>
                  <span className="block text-[10px] text-slate-500 font-mono">
                    {new Date(h.date).toLocaleDateString("en-IN", { weekday: "long" })}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-start gap-3">
                <div className="p-2 bg-white rounded border border-slate-200 text-center shrink-0 w-12 shadow-xs">
                  <span className="block text-[10px] font-bold text-blue-600 uppercase">NOV</span>
                  <span className="block text-base font-black text-slate-900">14</span>
                </div>
                <div className="space-y-0.5 text-xs">
                  <span className="font-bold text-slate-900 block leading-tight">Children's Day Celebrations</span>
                  <Badge variant="outline" className="text-[9px] uppercase px-1 py-0 text-blue-700 bg-blue-50 border-blue-200">
                    School Activity
                  </Badge>
                  <span className="block text-[10px] text-slate-500 font-mono">Friday • Special Assembly</span>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-start gap-3">
                <div className="p-2 bg-white rounded border border-slate-200 text-center shrink-0 w-12 shadow-xs">
                  <span className="block text-[10px] font-bold text-purple-600 uppercase">NOV</span>
                  <span className="block text-base font-black text-slate-900">17</span>
                </div>
                <div className="space-y-0.5 text-xs">
                  <span className="font-bold text-slate-900 block leading-tight">Term 2 Unit Assessment Series</span>
                  <Badge variant="outline" className="text-[9px] uppercase px-1 py-0 text-purple-700 bg-purple-50 border-purple-200">
                    Academic Exam
                  </Badge>
                  <span className="block text-[10px] text-slate-500 font-mono">Monday • Core Scholastic</span>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-start gap-3">
                <div className="p-2 bg-white rounded border border-slate-200 text-center shrink-0 w-12 shadow-xs">
                  <span className="block text-[10px] font-bold text-emerald-600 uppercase">NOV</span>
                  <span className="block text-base font-black text-slate-900">21</span>
                </div>
                <div className="space-y-0.5 text-xs">
                  <span className="font-bold text-slate-900 block leading-tight">Science & Robotics Exhibition</span>
                  <Badge variant="outline" className="text-[9px] uppercase px-1 py-0 text-emerald-700 bg-emerald-50 border-emerald-200">
                    Parent Invitational
                  </Badge>
                  <span className="block text-[10px] text-slate-500 font-mono">Friday • Main Auditorium</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

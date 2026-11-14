"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarCheck,
  CalendarPlus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  User,
  ShieldCheck,
  UsersRound,
  ArrowRight,
  Info,
  RefreshCw,
  Printer,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActionBanner } from "@/components/ui/action-banner";
import { submitStaffLeave } from "@/actions/hr-transport";
import { cn } from "@/lib/utils";

export interface TeacherProfile {
  id: string; // staffProfiles.id
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  employeeCode: string;
  designation: string;
  casualLeaveBalance: number;
  sickLeaveBalance: number;
}

export interface TeacherLeaveItem {
  id: string;
  startDate: string;
  endDate: string;
  leaveType: "CL" | "SL" | "LOP";
  daysCount: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approvedByName?: string | null;
  createdAt: string;
}

export interface TeacherSubstitutionItem {
  id: string;
  date: string;
  slotName?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  className?: string;
  sectionName?: string;
  subjectName?: string;
  otherTeacherName: string;
  isCovering: boolean; // true if this teacher is covering for someone else; false if someone is covering for this teacher
  status: string;
}

interface TeacherLeavePortalClientProps {
  teacher: TeacherProfile;
  leaves: TeacherLeaveItem[];
  substitutions: TeacherSubstitutionItem[];
  schoolId: string;
}

export function TeacherLeavePortalClient({
  teacher,
  leaves,
  substitutions,
  schoolId,
}: TeacherLeavePortalClientProps) {
  const router = useRouter();

  const [notification, setNotification] = React.useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const [isApplyModalOpen, setIsApplyModalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [leaveForm, setLeaveForm] = React.useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    leaveType: "CL" as "CL" | "SL" | "LOP",
    reason: "",
  });

  // Calculate requested days
  const diffDays = React.useMemo(() => {
    try {
      const s = new Date(leaveForm.startDate);
      const e = new Date(leaveForm.endDate);
      if (e < s) return 0;
      return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    } catch {
      return 1;
    }
  }, [leaveForm.startDate, leaveForm.endDate]);

  // Compute LOP days taken so far
  const totalLopDays = React.useMemo(() => {
    return leaves
      .filter((l) => l.leaveType === "LOP" && l.status === "APPROVED")
      .reduce((acc, l) => acc + parseFloat(l.daysCount || "0"), 0);
  }, [leaves]);

  const pendingLeavesCount = React.useMemo(() => {
    return leaves.filter((l) => l.status === "PENDING").length;
  }, [leaves]);

  // Check if requested days exceed balance
  const isOverdrawing = React.useMemo(() => {
    if (leaveForm.leaveType === "CL") {
      return diffDays > teacher.casualLeaveBalance;
    }
    if (leaveForm.leaveType === "SL") {
      return diffDays > teacher.sickLeaveBalance;
    }
    return false;
  }, [leaveForm.leaveType, diffDays, teacher.casualLeaveBalance, teacher.sickLeaveBalance]);

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (diffDays <= 0) {
      setNotification({ type: "error", message: "End date cannot precede start date." });
      return;
    }
    if (!leaveForm.reason.trim()) {
      setNotification({ type: "error", message: "Please provide a valid reason for this leave request." });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitStaffLeave({
        schoolId,
        staffId: teacher.id,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        leaveType: leaveForm.leaveType,
        reason: leaveForm.reason.trim(),
      });

      if (res.success) {
        setNotification({
          type: "success",
          message: `Leave application for ${diffDays} day(s) submitted successfully. Awaiting Principal review & timetable substitution.`,
        });
        setIsApplyModalOpen(false);
        setLeaveForm({
          startDate: new Date().toISOString().split("T")[0],
          endDate: new Date().toISOString().split("T")[0],
          leaveType: "CL",
          reason: "",
        });
        router.refresh();
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to submit leave application." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Notification Banner */}
      {notification && (
        <ActionBanner
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {teacher.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{teacher.name}</h1>
              <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-800 border-blue-200 font-bold">
                {teacher.employeeCode}
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700">
                {teacher.role}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {teacher.designation} • Crescent Matriculation Higher Secondary School
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsApplyModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-1.5 h-9 px-4 shadow-sm"
          >
            <CalendarPlus className="h-4 w-4" />
            <span>Apply for Leave</span>
          </Button>
        </div>
      </div>

      {/* 360° Leave Balance Hero Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Casual Leave */}
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-emerald-950 uppercase text-[11px] tracking-wider">
              Casual Leave (CL)
            </span>
            <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-800 border-emerald-200">
              Paid Leave
            </Badge>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-extrabold text-emerald-700 font-tabular font-mono">
              {teacher.casualLeaveBalance}
            </span>
            <span className="text-xs text-slate-500 font-medium">/ 12.0 Days Available</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (teacher.casualLeaveBalance / 12) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Standard annual entitlement for personal and family affairs.
          </p>
        </div>

        {/* Card 2: Sick Leave */}
        <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-blue-950 uppercase text-[11px] tracking-wider">
              Sick Leave (SL)
            </span>
            <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-800 border-blue-200">
              Medical Paid
            </Badge>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-extrabold text-blue-700 font-tabular font-mono">
              {teacher.sickLeaveBalance}
            </span>
            <span className="text-xs text-slate-500 font-medium">/ 10.0 Days Available</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (teacher.sickLeaveBalance / 10) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Requires medical prescription for extended absences &gt; 2 days.
          </p>
        </div>

        {/* Card 3: Loss of Pay (LOP) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-slate-700 uppercase text-[11px] tracking-wider">
              Loss of Pay (LOP)
            </span>
            <Badge variant="outline" className="text-[9px] bg-slate-100 text-slate-600">
              Salary Cut
            </Badge>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-extrabold text-slate-800 font-tabular font-mono">
              {totalLopDays.toFixed(1)}
            </span>
            <span className="text-xs text-slate-500 font-medium">Days Taken</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-rose-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (totalLopDays / 10) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Applies when leave exceeds paid CL and SL quotas.
          </p>
        </div>

        {/* Card 4: Substitutions & Coverages */}
        <div className="bg-white border border-purple-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-purple-950 uppercase text-[11px] tracking-wider">
              Class Coverages
            </span>
            <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-800 border-purple-200">
              Timetable
            </Badge>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-extrabold text-purple-700 font-tabular font-mono">
              {substitutions.filter((s) => s.isCovering).length}
            </span>
            <span className="text-xs text-slate-500 font-medium">Covering Assigned</span>
          </div>
          <div className="text-[11px] text-slate-600 mt-3 font-medium flex items-center justify-between">
            <span>When Absent:</span>
            <span className="font-bold text-slate-900">{substitutions.filter((s) => !s.isCovering).length} covered</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Automated conflict-free teacher timetable arrangement.
          </p>
        </div>
      </div>

      {/* Main Content Grid: Leave History & Active Timetable Substitutions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Leave History (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span>My Leave Application Register & Status</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track your leave requests, approval decisions, and authorized reviewer notes.
                </p>
              </div>

              {pendingLeavesCount > 0 && (
                <Badge variant="warning" className="text-[10px] gap-1 font-bold">
                  <span>{pendingLeavesCount} Pending Review</span>
                </Badge>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <TableHead className="text-xs">Leave Period</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Duration</TableHead>
                  <TableHead className="text-xs">Reason</TableHead>
                  <TableHead className="text-xs text-right">Review Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-slate-400 text-xs">
                      No leave requests submitted yet. Click &quot;Apply for Leave&quot; above to submit one.
                    </TableCell>
                  </TableRow>
                ) : (
                  leaves.map((l) => (
                    <TableRow key={l.id} className="hover:bg-slate-50/50 text-xs">
                      <TableCell className="font-tabular font-semibold text-slate-900">
                        <div>
                          <span>{l.startDate}</span>
                          {l.startDate !== l.endDate && (
                            <span className="text-slate-400 font-normal"> to {l.endDate}</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">
                          Submitted {new Date(l.createdAt).toLocaleDateString("en-IN")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={l.leaveType === "LOP" ? "danger" : l.leaveType === "SL" ? "warning" : "primary"}
                          className="text-[10px]"
                        >
                          {l.leaveType === "CL" ? "Casual (CL)" : l.leaveType === "SL" ? "Sick (SL)" : "Loss of Pay"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-tabular font-bold text-slate-700">
                        {l.daysCount} Day{parseFloat(l.daysCount) > 1 ? "s" : ""}
                      </TableCell>
                      <TableCell className="max-w-xs text-slate-600 truncate">
                        {l.reason || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {l.status === "APPROVED" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Approved</span>
                          </span>
                        ) : l.status === "REJECTED" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            <XCircle className="h-3 w-3" />
                            <span>Rejected</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <Clock className="h-3 w-3 text-amber-600" />
                            <span>Pending Review</span>
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Right Column: Timetable Substitutions (1 col) */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-purple-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Timetable Coverages
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">Class Substitutions</span>
            </div>

            {substitutions.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                No active substitutions recorded for your timetable.
              </div>
            ) : (
              <div className="space-y-2.5">
                {substitutions.map((sub) => (
                  <div
                    key={sub.id}
                    className={cn(
                      "p-3 rounded-lg border text-xs space-y-1.5",
                      sub.isCovering
                        ? "bg-purple-50/50 border-purple-200"
                        : "bg-blue-50/50 border-blue-200"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {sub.isCovering ? "Covering Class" : "Covered By Colleague"}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] font-bold",
                          sub.isCovering ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                        )}
                      >
                        {sub.date}
                      </Badge>
                    </div>

                    <div className="text-[11px] text-slate-600">
                      {sub.isCovering ? (
                        <span>
                          Covering for <strong>{sub.otherTeacherName}</strong>
                        </span>
                      ) : (
                        <span>
                          <strong>{sub.otherTeacherName}</strong> covered your class
                        </span>
                      )}
                    </div>

                    {(sub.className || sub.slotName) && (
                      <div className="text-[10px] font-mono text-slate-500">
                        {sub.className ? `${sub.className} ${sub.sectionName || ""}` : ""} • {sub.slotName || "Period"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* School Leave Policy Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2 text-slate-600">
            <div className="flex items-center gap-1.5 text-slate-900 font-bold">
              <Info className="h-4 w-4 text-blue-600" />
              <span>Leave Policy Guidelines</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600">
              <li>Casual Leave (CL) must be submitted 24 hours in advance whenever possible.</li>
              <li>Sick Leave (SL) exceeding 2 continuous days requires a doctor&apos;s medical certificate.</li>
              <li>Leaves exceeding paid quotas are automatically converted to Loss of Pay (LOP).</li>
              <li>Timetable substitutions are auto-arranged upon Principal approval.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 1-CLICK APPLY FOR LEAVE MODAL                                           */}
      {/* ======================================================================= */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Submit Leave Application</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-4">
              {/* Leave Type Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Leave Category *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaveForm({ ...leaveForm, leaveType: "CL" })}
                    className={cn(
                      "p-2.5 rounded-lg border text-xs font-bold text-left transition-all",
                      leaveForm.leaveType === "CL"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs ring-1 ring-emerald-500"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <div>Casual (CL)</div>
                    <div className="text-[10px] font-normal text-emerald-700 font-mono mt-0.5">
                      {teacher.casualLeaveBalance} Days left
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeaveForm({ ...leaveForm, leaveType: "SL" })}
                    className={cn(
                      "p-2.5 rounded-lg border text-xs font-bold text-left transition-all",
                      leaveForm.leaveType === "SL"
                        ? "bg-blue-50 border-blue-500 text-blue-950 shadow-xs ring-1 ring-blue-500"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <div>Sick (SL)</div>
                    <div className="text-[10px] font-normal text-blue-700 font-mono mt-0.5">
                      {teacher.sickLeaveBalance} Days left
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeaveForm({ ...leaveForm, leaveType: "LOP" })}
                    className={cn(
                      "p-2.5 rounded-lg border text-xs font-bold text-left transition-all",
                      leaveForm.leaveType === "LOP"
                        ? "bg-rose-50 border-rose-500 text-rose-950 shadow-xs ring-1 ring-rose-500"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <div>Loss of Pay</div>
                    <div className="text-[10px] font-normal text-rose-700 font-mono mt-0.5">
                      Salary Deducted
                    </div>
                  </button>
                </div>
              </div>

              {/* Date Pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">From Date *</label>
                  <Input
                    type="date"
                    required
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">To Date *</label>
                  <Input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Duration Summary */}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600">Calculated Leave Duration:</span>
                <span className="font-bold text-slate-900 font-mono">
                  {diffDays} Working Day{diffDays > 1 ? "s" : ""}
                </span>
              </div>

              {/* Overdraw Smart Warning */}
              {isOverdrawing && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Insufficient Paid Leave Balance</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    You have requested <strong>{diffDays} days</strong> of {leaveForm.leaveType}, but you only have{" "}
                    <strong>
                      {leaveForm.leaveType === "CL" ? teacher.casualLeaveBalance : teacher.sickLeaveBalance} days
                    </strong>{" "}
                    available. If approved, excess days will be processed as <strong>Loss of Pay (LOP)</strong> and
                    deducted in monthly payroll.
                  </p>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Reason for Leave *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Attending sister's wedding ceremony in Madurai..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-600 focus:outline-none resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || diffDays <= 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-8 gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <CalendarCheck className="h-3.5 w-3.5" />
                      <span>Submit Application</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


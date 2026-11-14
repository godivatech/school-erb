"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  UserCheck,
  CheckCircle2,
  Clock,
  WifiOff,
  RefreshCw,
  Send,
  AlertTriangle,
  Lock,
  ChevronDown,
  BellRing,
  HeartPulse,
  MessageSquare,
  Calendar,
  BarChart3,
  ClipboardList,
  Search,
  Printer,
  Users,
  Phone,
  ArrowRight,
  X,
  Building2,
  ShieldAlert,
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
import { submitSectionAttendance } from "@/actions/attendance";
import { LockOverrideDialog } from "@/components/layout/lock-override-dialog";
import { SearchableSelect, SearchOption } from "@/components/ui/searchable-select";
import { ActionBanner } from "@/components/ui/action-banner";

export interface StudentAttendanceRow {
  enrollmentId: string;
  studentId: string;
  rollNo: number;
  name: string;
  admissionNo: string;
  parentPhone?: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "MEDICAL_LEAVE";
  arrivalTime?: string;
  arrivalMinutesLate?: number;
  remarks?: string;
}

export interface SectionMeta {
  id: string;
  name: string;
  className: string;
  teacherName?: string | null;
}

export interface ClassAttendanceSummary {
  sectionId: string;
  className: string;
  sectionName: string;
  teacherName: string | null;
  capacity: number;
  totalEnrolled: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  mlCount: number;
  halfDayCount: number;
  isSubmitted: boolean;
  attendancePct: string;
}

export interface DailyAbsenteeStudent {
  studentId: string;
  enrollmentId: string;
  admissionNo: string;
  name: string;
  className: string;
  sectionName: string;
  parentPhone?: string | null;
  status: "ABSENT" | "MEDICAL_LEAVE" | "HALF_DAY" | "LATE";
  remarks?: string;
  appliedLeaveType?: string;
  appliedLeaveReason?: string;
}

interface AttendanceClientProps {
  sections: SectionMeta[];
  selectedSectionId: string;
  currentDate: string;
  rosterData: StudentAttendanceRow[];
  activeLeaves?: Array<{
    id: string;
    studentId: string;
    leaveType: string;
    reason: string;
  }>;
  isLocked: boolean;
  academicYearId: string;
  schoolId: string;
  classSummaries?: ClassAttendanceSummary[];
  allSchoolAbsentees?: DailyAbsenteeStudent[];
  userRole?: string;
  initialTab?: "grid" | "register";
}

export function AttendanceClient({
  sections,
  selectedSectionId,
  currentDate,
  rosterData,
  activeLeaves = [],
  isLocked,
  academicYearId,
  schoolId,
  classSummaries = [],
  allSchoolAbsentees = [],
  userRole = "SUPER_ADMIN",
  initialTab = "register",
}: AttendanceClientProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState<"register" | "grid">(initialTab);
  const [roster, setRoster] = React.useState<StudentAttendanceRow[]>(rosterData);
  const [sendWhatsAppAlerts, setSendWhatsAppAlerts] = React.useState(true);
  const [isOffline, setIsOffline] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [lateReversalAlert, setLateReversalAlert] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = React.useState(false);
  const [activeRemarkId, setActiveRemarkId] = React.useState<string | null>(null);

  // Search & Filter for Master Register
  const [classFilter, setClassFilter] = React.useState("");
  const [absenteeSearch, setAbsenteeSearch] = React.useState("");
  const [absenteeStatusFilter, setAbsenteeStatusFilter] = React.useState<"ALL" | "ABSENT" | "MEDICAL_LEAVE">("ALL");
  const [showPrintRegisterModal, setShowPrintRegisterModal] = React.useState(false);

  const activeLeavesMap = React.useMemo(() => {
    return new Map(activeLeaves.map((l) => [l.studentId, l]));
  }, [activeLeaves]);

  const sectionOptions: SearchOption[] = React.useMemo(() => {
    return sections.map((sec) => ({
      value: sec.id,
      label: `${sec.className} - Section ${sec.name}`,
      sublabel: sec.teacherName ? `Class Teacher: ${sec.teacherName}` : undefined,
    }));
  }, [sections]);

  // Sync state if rosterData changes from server component re-render
  React.useEffect(() => {
    setRoster(rosterData);
  }, [rosterData]);

  // Offline network detection
  React.useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      const queued = localStorage.getItem("queued_attendance");
      if (queued) {
        try {
          const parsed = JSON.parse(queued);
          await submitSectionAttendance(parsed);
          localStorage.removeItem("queued_attendance");
          setSyncStatus("Connection restored! Automatically synchronized queued attendance.");
          setTimeout(() => setSyncStatus(null), 4000);
          router.refresh();
        } catch (e) {
          console.error("Failed to sync offline attendance", e);
        }
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [router]);

  // Status Counts for current section
  const presentCount = roster.filter((r) => r.status === "PRESENT").length;
  const absentCount = roster.filter((r) => r.status === "ABSENT").length;
  const lateCount = roster.filter((r) => r.status === "LATE").length;
  const mlCount = roster.filter((r) => r.status === "MEDICAL_LEAVE").length;
  const halfDayCount = roster.filter((r) => r.status === "HALF_DAY").length;

  // School-Wide Roll Call Aggregates for Master Register
  const totalEnrolledSchool = classSummaries.reduce((sum, c) => sum + c.totalEnrolled, 0);
  const totalPresentSchool = classSummaries.reduce((sum, c) => sum + c.presentCount, 0);
  const totalAbsentSchool = classSummaries.reduce((sum, c) => sum + c.absentCount, 0);
  const totalLateSchool = classSummaries.reduce((sum, c) => sum + c.lateCount, 0);
  const totalMlSchool = classSummaries.reduce((sum, c) => sum + c.mlCount, 0);
  const submittedClassesCount = classSummaries.filter((c) => c.isSubmitted).length;
  const pendingClassesCount = classSummaries.length - submittedClassesCount;

  const overallSchoolPct =
    totalPresentSchool + totalAbsentSchool + totalLateSchool + totalMlSchool > 0
      ? (
          (totalPresentSchool /
            (totalPresentSchool + totalAbsentSchool + totalLateSchool + totalMlSchool)) *
          100
        ).toFixed(1)
      : "100.0";

  // Filtered Class Summaries
  const filteredClassSummaries = React.useMemo(() => {
    if (!classFilter.trim()) return classSummaries;
    const q = classFilter.toLowerCase();
    return classSummaries.filter(
      (c) =>
        c.className.toLowerCase().includes(q) ||
        c.sectionName.toLowerCase().includes(q) ||
        (c.teacherName && c.teacherName.toLowerCase().includes(q))
    );
  }, [classSummaries, classFilter]);

  // Filtered Absentees List
  const filteredAbsentees = React.useMemo(() => {
    return allSchoolAbsentees.filter((s) => {
      if (absenteeStatusFilter !== "ALL" && s.status !== absenteeStatusFilter) return false;
      if (!absenteeSearch.trim()) return true;
      const q = absenteeSearch.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q) ||
        s.sectionName.toLowerCase().includes(q) ||
        (s.parentPhone && s.parentPhone.includes(q))
      );
    });
  }, [allSchoolAbsentees, absenteeSearch, absenteeStatusFilter]);

  const handleStatusChange = (
    enrollmentId: string,
    newStatus: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "MEDICAL_LEAVE"
  ) => {
    setRoster((prev) =>
      prev.map((student) => {
        if (student.enrollmentId !== enrollmentId) return student;

        if (student.status === "LATE" && newStatus === "PRESENT") {
          setLateReversalAlert(
            `Late arrival reversed to Present for ${student.name}. Gate log updated.`
          );
          setTimeout(() => setLateReversalAlert(null), 4000);
        }

        let arrivalMinutesLate = student.arrivalMinutesLate;
        if (newStatus === "LATE" && (!arrivalMinutesLate || arrivalMinutesLate === 0)) {
          arrivalMinutesLate = 15;
        } else if (newStatus !== "LATE") {
          arrivalMinutesLate = 0;
        }

        return {
          ...student,
          status: newStatus,
          arrivalMinutesLate,
        };
      })
    );
  };

  const handleLateMinutesChange = (enrollmentId: string, minutes: number) => {
    setRoster((prev) =>
      prev.map((student) => {
        if (student.enrollmentId !== enrollmentId) return student;
        return {
          ...student,
          arrivalMinutesLate: minutes,
        };
      })
    );
  };

  const handleRemarkChange = (enrollmentId: string, remarks: string) => {
    setRoster((prev) =>
      prev.map((student) => {
        if (student.enrollmentId !== enrollmentId) return student;
        return {
          ...student,
          remarks,
        };
      })
    );
  };

  const handleMarkAllPresent = () => {
    if (isLocked) return;
    setRoster((prev) =>
      prev.map((student) => ({
        ...student,
        status: "PRESENT",
        arrivalMinutesLate: 0,
      }))
    );
  };

  const handleSaveAttendance = async () => {
    if (isLocked) {
      setOverrideModalOpen(true);
      return;
    }

    const payload = {
      sectionId: selectedSectionId,
      academicYearId,
      date: currentDate,
      sendWhatsAppAlerts,
      records: roster.map((s) => ({
        enrollmentId: s.enrollmentId,
        studentId: s.studentId,
        studentName: s.name,
        parentPhone: s.parentPhone,
        status: s.status,
        arrivalMinutesLate: s.arrivalMinutesLate || 0,
        remarks: s.remarks,
      })),
    };

    if (isOffline) {
      localStorage.setItem("queued_attendance", JSON.stringify(payload));
      setSyncStatus("Offline Mode: Attendance stored locally. Will auto-sync when back online.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitSectionAttendance(payload);
      if (res.success) {
        setSyncStatus(
          `Attendance successfully submitted & saved (${presentCount} Present, ${absentCount} Absent, ${lateCount} Late, ${mlCount} ML).${
            res.whatsAppAlertsCount
              ? ` WhatsApp SMS alerts sent to ${res.whatsAppAlertsCount} absent parents.`
              : ""
          }`
        );
        setTimeout(() => setSyncStatus(null), 5000);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit attendance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmOverride = async (reason: string) => {
    const payload = {
      sectionId: selectedSectionId,
      academicYearId,
      date: currentDate,
      overrideReason: reason,
      sendWhatsAppAlerts: false,
      records: roster.map((s) => ({
        enrollmentId: s.enrollmentId,
        studentId: s.studentId,
        studentName: s.name,
        parentPhone: s.parentPhone,
        status: s.status,
        arrivalMinutesLate: s.arrivalMinutesLate || 0,
        remarks: s.remarks,
      })),
    };

    setIsSubmitting(true);
    try {
      const res = await submitSectionAttendance(payload);
      if (res.success) {
        setSyncStatus(`Audited attendance override saved successfully.`);
        setTimeout(() => setSyncStatus(null), 4000);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Override submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Attendance Command Center
            </h1>
            <Badge variant="outline" className="text-[10px] font-mono bg-white">
              CMS-CHENNAI
            </Badge>
          </div>
          <p className="text-xs text-slate-500 font-tabular mt-0.5">
            Class-Wise Roll Call Register • School-Wide Absentee Tracking • Section Attendance Grid
          </p>
        </div>

        {/* Global Date Picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded px-2 h-8 shadow-sm">
            <Calendar className="h-3.5 w-3.5 text-blue-700" />
            <span className="text-[11px] font-semibold text-slate-500">Date:</span>
            <input
              type="date"
              value={currentDate}
              onChange={(e) =>
                router.push(`/attendance?sectionId=${selectedSectionId}&date=${e.target.value}&view=${activeTab}`)
              }
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            />
          </div>

          {activeTab === "register" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPrintRegisterModal(true)}
              className="text-xs h-8 gap-1.5 border-slate-300 font-semibold"
            >
              <Printer className="h-3.5 w-3.5 text-slate-700" />
              <span>Print Master Register</span>
            </Button>
          )}
        </div>
      </div>

      {/* Primary Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("register")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors shrink-0 whitespace-nowrap ${
            activeTab === "register"
              ? "bg-navy-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Daily School Master Register</span>
          {allSchoolAbsentees.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-tabular ${
                activeTab === "register"
                  ? "bg-rose-500 text-white"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              {allSchoolAbsentees.length} Absent
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("grid")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors shrink-0 whitespace-nowrap ${
            activeTab === "grid"
              ? "bg-navy-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          <span>Section Roll Call Grid</span>
          {isOffline && (
            <span className="text-[10px] bg-amber-500 text-white px-1.5 rounded">Offline</span>
          )}
        </button>
      </div>

      {/* Sync / Error / Late Reversal Banners */}
      {errorMessage && (
        <ActionBanner type="error" message={errorMessage} onClose={() => setErrorMessage(null)} />
      )}
      {lateReversalAlert && (
        <ActionBanner type="info" message={lateReversalAlert} onClose={() => setLateReversalAlert(null)} />
      )}
      {syncStatus && (
        <ActionBanner type="success" message={syncStatus} onClose={() => setSyncStatus(null)} />
      )}

      {/* ======================================================================= */}
      {/* TAB 1: DAILY SCHOOL MASTER REGISTER (For Principal & Super Admin)       */}
      {/* ======================================================================= */}
      {activeTab === "register" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* 4 Executive Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total School Enrolled
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-tabular text-slate-900">
                  {totalEnrolledSchool}
                </span>
                <span className="text-xs text-slate-400 font-tabular">
                  Across {classSummaries.length} Classes
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Today's Present Rate
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-tabular text-emerald-700">
                  {overallSchoolPct}%
                </span>
                <span className="text-xs text-emerald-800 font-semibold font-tabular">
                  {totalPresentSchool} Present
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Absentees Today
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-tabular text-rose-600">
                  {totalAbsentSchool + totalMlSchool}
                </span>
                <div className="text-[10px] text-slate-500 font-tabular">
                  <span className="text-rose-600 font-bold">{totalAbsentSchool} Unexcused</span>
                  {totalMlSchool > 0 && <span> • {totalMlSchool} Medical</span>}
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Roll Call Submissions
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-tabular text-slate-900">
                  {submittedClassesCount} / {classSummaries.length}
                </span>
                {pendingClassesCount > 0 ? (
                  <Badge variant="warning" className="text-[10px] bg-amber-500 text-white font-bold">
                    ⚠️ {pendingClassesCount} Pending
                  </Badge>
                ) : (
                  <Badge variant="success" className="text-[10px] bg-emerald-600 text-white font-bold">
                    ✅ 100% Submitted
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Section A: Class-Wise Daily Submission & Attendance Register */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Class-Wise Roll Call Breakdown ({classSummaries.length} Sections)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-2" />
                  <Input
                    placeholder="Filter classes..."
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="h-7 w-44 pl-7 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-100/50 text-[11px]">
                  <TableHead className="font-bold">Class & Section</TableHead>
                  <TableHead className="font-bold">Class Teacher</TableHead>
                  <TableHead className="font-bold text-center">Enrolled</TableHead>
                  <TableHead className="font-bold text-center text-emerald-800">Present (P)</TableHead>
                  <TableHead className="font-bold text-center text-rose-700">Absent (A)</TableHead>
                  <TableHead className="font-bold text-center text-amber-700">Late (L)</TableHead>
                  <TableHead className="font-bold text-center text-purple-700">Medical (ML)</TableHead>
                  <TableHead className="font-bold text-center">Rate (%)</TableHead>
                  <TableHead className="font-bold text-center">Roll Call Status</TableHead>
                  <TableHead className="font-bold text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClassSummaries.map((c) => (
                  <TableRow key={c.sectionId} className="hover:bg-slate-50/70 border-b border-slate-100 text-xs">
                    <TableCell className="font-bold text-slate-900">
                      {c.className} - Section {c.sectionName}
                    </TableCell>
                    <TableCell className="text-slate-600 font-medium">
                      {c.teacherName || <span className="text-slate-400 italic">Not Assigned</span>}
                    </TableCell>
                    <TableCell className="text-center font-tabular font-semibold text-slate-800">
                      {c.totalEnrolled}
                    </TableCell>
                    <TableCell className="text-center font-tabular font-bold text-emerald-700">
                      {c.isSubmitted ? c.presentCount : "-"}
                    </TableCell>
                    <TableCell className="text-center font-tabular font-bold text-rose-600">
                      {c.isSubmitted ? c.absentCount : "-"}
                    </TableCell>
                    <TableCell className="text-center font-tabular text-amber-700">
                      {c.isSubmitted ? c.lateCount : "-"}
                    </TableCell>
                    <TableCell className="text-center font-tabular text-purple-700">
                      {c.isSubmitted ? c.mlCount : "-"}
                    </TableCell>
                    <TableCell className="text-center font-tabular font-bold">
                      {c.isSubmitted ? `${c.attendancePct}%` : <span className="text-slate-400">-</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.isSubmitted ? (
                        <Badge variant="success" className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          ✅ Submitted
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="text-[10px] bg-amber-100 text-amber-900 border-amber-300 font-bold">
                          ⚠️ Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          router.push(`/attendance?sectionId=${c.sectionId}&date=${currentDate}&view=grid`);
                          setActiveTab("grid");
                        }}
                        className="h-6 text-[11px] gap-1 px-2 border-slate-300 hover:bg-slate-100 font-semibold"
                      >
                        <span>Open Grid</span>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Section B: All-School Absentee & Leave Register for Today */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-rose-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Today's All-School Absentee & Medical Leave List ({allSchoolAbsentees.length} Students)
                </h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Filter */}
                <div className="flex items-center rounded border border-slate-300 bg-white p-0.5 text-[10px]">
                  <button
                    onClick={() => setAbsenteeStatusFilter("ALL")}
                    className={`px-2 py-0.5 rounded font-bold ${
                      absenteeStatusFilter === "ALL" ? "bg-slate-800 text-white" : "text-slate-600"
                    }`}
                  >
                    All ({allSchoolAbsentees.length})
                  </button>
                  <button
                    onClick={() => setAbsenteeStatusFilter("ABSENT")}
                    className={`px-2 py-0.5 rounded font-bold ${
                      absenteeStatusFilter === "ABSENT" ? "bg-rose-600 text-white" : "text-slate-600"
                    }`}
                  >
                    Absent ({allSchoolAbsentees.filter((s) => s.status === "ABSENT").length})
                  </button>
                  <button
                    onClick={() => setAbsenteeStatusFilter("MEDICAL_LEAVE")}
                    className={`px-2 py-0.5 rounded font-bold ${
                      absenteeStatusFilter === "MEDICAL_LEAVE" ? "bg-purple-700 text-white" : "text-slate-600"
                    }`}
                  >
                    Medical ({allSchoolAbsentees.filter((s) => s.status === "MEDICAL_LEAVE").length})
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-2" />
                  <Input
                    placeholder="Search student or phone..."
                    value={absenteeSearch}
                    onChange={(e) => setAbsenteeSearch(e.target.value)}
                    className="h-7 w-48 pl-7 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {filteredAbsentees.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                {allSchoolAbsentees.length === 0 ? (
                  <div className="space-y-1">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                    <span className="font-bold text-slate-800 text-sm block">100% Attendance Recorded!</span>
                    <span className="text-[11px] text-slate-400">No students are marked absent on {currentDate}.</span>
                  </div>
                ) : (
                  <span>No absentees match the selected filter.</span>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200 bg-slate-100/50 text-[11px]">
                    <TableHead className="font-bold">Admission No</TableHead>
                    <TableHead className="font-bold">Student Name</TableHead>
                    <TableHead className="font-bold">Class & Section</TableHead>
                    <TableHead className="font-bold">Parent Contact</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="font-bold">Reason / Leave Details</TableHead>
                    <TableHead className="font-bold text-right">Quick Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAbsentees.map((s) => (
                    <TableRow key={s.enrollmentId} className="hover:bg-slate-50/70 border-b border-slate-100 text-xs">
                      <TableCell className="font-mono text-slate-700 font-semibold">
                        {s.admissionNo}
                      </TableCell>
                      <TableCell className="font-bold text-slate-900">
                        {s.name}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {s.className} - {s.sectionName}
                      </TableCell>
                      <TableCell className="font-mono text-slate-600">
                        {s.parentPhone || "No Phone Registered"}
                      </TableCell>
                      <TableCell className="text-center">
                        {s.status === "MEDICAL_LEAVE" ? (
                          <Badge variant="outline" className="text-[10px] bg-purple-100 text-purple-800 border-purple-300 font-bold">
                            Medical Leave
                          </Badge>
                        ) : (
                          <Badge variant="danger" className="text-[10px] bg-rose-100 text-rose-800 border-rose-300 font-bold">
                            Absent (A)
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-600">
                        {s.appliedLeaveType ? (
                          <span className="text-purple-800 font-medium">
                            🏖️ Parent Leave ({s.appliedLeaveType}): {s.appliedLeaveReason}
                          </span>
                        ) : s.remarks ? (
                          <span>{s.remarks}</span>
                        ) : (
                          <span className="text-slate-400 italic">No remark recorded</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {s.parentPhone ? (
                          <a
                            href={`https://wa.me/91${s.parentPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                              `Dear Parent, this is an automated attendance notice from Crescent Matriculation School. Your ward ${s.name} (${s.admissionNo}) of ${s.className} - ${s.sectionName} was marked ABSENT today (${currentDate}). Please contact the school office.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-bold">
                              <MessageSquare className="h-3 w-3" />
                              <span>WhatsApp</span>
                            </Button>
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 2: SECTION ROLL CALL GRID (Teacher's Interactive Daily Grid)         */}
      {/* ======================================================================= */}
      {activeTab === "grid" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Section Picker Subheader */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Select Section:</span>
              <div className="w-64 sm:w-72">
                <SearchableSelect
                  options={sectionOptions}
                  value={selectedSectionId}
                  onChange={(val) =>
                    router.push(`/attendance?sectionId=${val}&date=${currentDate}&view=grid`)
                  }
                  placeholder="Search section..."
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkAllPresent}
                disabled={isLocked}
                className="text-xs h-8 gap-1.5 font-semibold"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Mark All Present</span>
              </Button>
            </div>
          </div>

          {/* Stats 5-KPI Strip for Current Section */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded p-2 text-center">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide block">
                Present (P)
              </span>
              <div className="text-base font-bold text-emerald-950 font-tabular">{presentCount}</div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded p-2 text-center">
              <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wide block">
                Absent (A)
              </span>
              <div className="text-base font-bold text-rose-950 font-tabular">{absentCount}</div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded p-2 text-center">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block">
                Late (L)
              </span>
              <div className="text-base font-bold text-amber-950 font-tabular">{lateCount}</div>
            </div>

            <div className="bg-purple-50/70 border border-purple-200 rounded p-2 text-center">
              <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wide block">
                Medical (ML)
              </span>
              <div className="text-base font-bold text-purple-950 font-tabular">{mlCount}</div>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 rounded p-2 text-center">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide block">
                Half Day (HD)
              </span>
              <div className="text-base font-bold text-blue-950 font-tabular">{halfDayCount}</div>
            </div>
          </div>

          {/* Interactive Student Roster Grid */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 shadow-sm">
            {roster.map((student) => {
              let rowBg = "bg-white hover:bg-slate-50";
              if (student.status === "ABSENT") rowBg = "bg-rose-50/50 hover:bg-rose-50";
              else if (student.status === "LATE") rowBg = "bg-amber-50/50 hover:bg-amber-50";
              else if (student.status === "MEDICAL_LEAVE") rowBg = "bg-purple-50/50 hover:bg-purple-50";
              else if (student.status === "HALF_DAY") rowBg = "bg-blue-50/50 hover:bg-blue-50";

              return (
                <div key={student.enrollmentId} className={`p-3 transition-colors ${rowBg}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-tabular text-xs font-bold text-slate-400 w-6">
                        #{String(student.rollNo).padStart(2, "0")}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{student.name}</span>
                          {activeLeavesMap.has(student.studentId) && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-purple-100 text-purple-800 border-purple-300 font-bold flex items-center gap-1">
                              <span>🏖️ Parent Leave Applied</span>
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-tabular flex items-center gap-2 mt-0.5">
                          <span>{student.admissionNo}</span>
                          {student.parentPhone && (
                            <span>• Parent: {student.parentPhone}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 5-State Selector Buttons */}
                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      {(["PRESENT", "ABSENT", "LATE", "MEDICAL_LEAVE", "HALF_DAY"] as const).map(
                        (st) => {
                          const isSelected = student.status === st;
                          let btnStyle = "border-slate-200 text-slate-600 hover:bg-slate-100";
                          let label = "P";
                          if (st === "PRESENT") {
                            label = "P";
                            if (isSelected) btnStyle = "bg-emerald-600 text-white font-bold border-emerald-600";
                          } else if (st === "ABSENT") {
                            label = "A";
                            if (isSelected) btnStyle = "bg-rose-600 text-white font-bold border-rose-600";
                          } else if (st === "LATE") {
                            label = "L";
                            if (isSelected) btnStyle = "bg-amber-600 text-white font-bold border-amber-600";
                          } else if (st === "MEDICAL_LEAVE") {
                            label = "ML";
                            if (isSelected) btnStyle = "bg-purple-600 text-white font-bold border-purple-600";
                          } else if (st === "HALF_DAY") {
                            label = "HD";
                            if (isSelected) btnStyle = "bg-blue-600 text-white font-bold border-blue-600";
                          }

                          return (
                            <button
                              key={st}
                              disabled={isLocked}
                              onClick={() => handleStatusChange(student.enrollmentId, st)}
                              className={`h-7 px-2 text-[11px] rounded border transition-colors ${btnStyle}`}
                            >
                              {label}
                            </button>
                          );
                        }
                      )}

                      <button
                        onClick={() =>
                          setActiveRemarkId(
                            activeRemarkId === student.enrollmentId ? null : student.enrollmentId
                          )
                        }
                        className={`p-1.5 rounded border text-slate-400 hover:text-slate-600 ${
                          student.remarks ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200"
                        }`}
                        title="Add Remark"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Late Minutes Counter if LATE */}
                  {student.status === "LATE" && (
                    <div className="mt-2 pt-2 border-t border-amber-100 flex items-center gap-2 text-xs">
                      <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="text-amber-900 font-medium">Arrival Minutes Late:</span>
                      <Input
                        type="number"
                        min={1}
                        max={300}
                        value={student.arrivalMinutesLate || 15}
                        onChange={(e) =>
                          handleLateMinutesChange(student.enrollmentId, parseInt(e.target.value) || 0)
                        }
                        className="h-6 w-16 text-xs bg-white text-center font-bold"
                      />
                      <span className="text-slate-400 text-[10px]">mins</span>
                    </div>
                  )}

                  {/* Remarks Input */}
                  {activeRemarkId === student.enrollmentId && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                      <Input
                        placeholder="Add teacher attendance remark..."
                        value={student.remarks || ""}
                        onChange={(e) => handleRemarkChange(student.enrollmentId, e.target.value)}
                        className="h-7 text-xs bg-white flex-1"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* WhatsApp Alert Checkbox & Submit Button */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendWhatsAppAlerts}
                onChange={(e) => setSendWhatsAppAlerts(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-semibold">
                Send WhatsApp SMS alerts to absent parents immediately upon submission
              </span>
            </label>

            <Button
              onClick={handleSaveAttendance}
              disabled={isSubmitting}
              className="bg-navy-900 hover:bg-navy-800 text-white font-bold text-xs gap-1.5 h-8 px-4"
            >
              {isSubmitting ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : isLocked ? (
                <Lock className="h-3.5 w-3.5 text-amber-300" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>
                {isSubmitting
                  ? "Saving Attendance..."
                  : isLocked
                  ? "Locked Academic Year: Override Prompt"
                  : `Submit & Lock Attendance (${presentCount} Present, ${absentCount} Absent)`}
              </span>
            </Button>
          </div>
        </div>
      )}

      {/* Lock Override Dialog */}
      <LockOverrideDialog
        open={overrideModalOpen}
        onOpenChange={setOverrideModalOpen}
        title="Attendance Write Lock Override"
        operationDescription={`Submit Section Attendance for Section on ${currentDate}`}
        onConfirmOverride={handleConfirmOverride}
      />

      {/* ======================================================================= */}
      {/* OFFICIAL DAILY MASTER ATTENDANCE PRINT / PDF MODAL                      */}
      {/* ======================================================================= */}
      {showPrintRegisterModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 p-2 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full mx-auto my-auto flex flex-col overflow-hidden max-h-[95vh]">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-emerald-400" />
                <span className="font-bold text-xs">
                  Official Daily Attendance Register ({currentDate})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-8 px-3"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Register</span>
                </Button>
                <button
                  onClick={() => setShowPrintRegisterModal(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Content */}
            <div className="p-8 overflow-y-auto space-y-6 print:p-0">
              {/* Official School Letterhead */}
              <div className="text-center border-b-2 border-slate-900 pb-4">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                  Crescent Matriculation Higher Secondary School
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  Recognized by the Director of School Education, Tamil Nadu (Code: CMS-CHENNAI)
                </p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  124/1, Grand Southern Trunk Road, Chromepet, Chennai - 600044
                </p>
                <div className="mt-3 inline-block bg-slate-100 border border-slate-300 px-4 py-1 rounded">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Daily Master Attendance Register — Date: {currentDate}
                  </span>
                </div>
              </div>

              {/* Summary Totals Table */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="border border-slate-300 p-2 rounded">
                  <span className="text-slate-500 text-[10px] block font-semibold">TOTAL ENROLLED</span>
                  <span className="font-bold text-base">{totalEnrolledSchool}</span>
                </div>
                <div className="border border-slate-300 p-2 rounded bg-emerald-50/50">
                  <span className="text-emerald-800 text-[10px] block font-semibold">TOTAL PRESENT</span>
                  <span className="font-bold text-base text-emerald-800">{totalPresentSchool} ({overallSchoolPct}%)</span>
                </div>
                <div className="border border-slate-300 p-2 rounded bg-rose-50/50">
                  <span className="text-rose-800 text-[10px] block font-semibold">TOTAL ABSENT</span>
                  <span className="font-bold text-base text-rose-800">{totalAbsentSchool + totalMlSchool}</span>
                </div>
                <div className="border border-slate-300 p-2 rounded">
                  <span className="text-slate-500 text-[10px] block font-semibold">SUBMISSION</span>
                  <span className="font-bold text-base">{submittedClassesCount} / {classSummaries.length} Classes</span>
                </div>
              </div>

              {/* Class-by-Class Table */}
              <table className="w-full text-xs border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-left font-bold text-[11px]">
                    <th className="p-2 border-r border-slate-300">Class & Section</th>
                    <th className="p-2 border-r border-slate-300">Class Teacher</th>
                    <th className="p-2 text-center border-r border-slate-300">Strength</th>
                    <th className="p-2 text-center border-r border-slate-300">Present</th>
                    <th className="p-2 text-center border-r border-slate-300">Absent</th>
                    <th className="p-2 text-center border-r border-slate-300">Late / ML</th>
                    <th className="p-2 text-center border-r border-slate-300">Attendance %</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {classSummaries.map((c) => (
                    <tr key={c.sectionId} className="border-b border-slate-200">
                      <td className="p-2 font-bold border-r border-slate-200">
                        {c.className} - {c.sectionName}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-700">
                        {c.teacherName || "-"}
                      </td>
                      <td className="p-2 text-center font-tabular border-r border-slate-200">{c.totalEnrolled}</td>
                      <td className="p-2 text-center font-tabular font-bold border-r border-slate-200">{c.isSubmitted ? c.presentCount : "-"}</td>
                      <td className="p-2 text-center font-tabular font-bold border-r border-slate-200">{c.isSubmitted ? c.absentCount : "-"}</td>
                      <td className="p-2 text-center font-tabular border-r border-slate-200">{c.isSubmitted ? `${c.lateCount + c.mlCount}` : "-"}</td>
                      <td className="p-2 text-center font-tabular font-bold border-r border-slate-200">{c.isSubmitted ? `${c.attendancePct}%` : "-"}</td>
                      <td className="p-2 text-center font-semibold">{c.isSubmitted ? "Submitted" : "Pending"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signatures */}
              <div className="pt-10 flex justify-between text-xs text-slate-700">
                <div className="text-center">
                  <div className="border-b border-slate-400 w-44 h-8 mb-1"></div>
                  <span className="font-semibold">Attendance Officer</span>
                </div>
                <div className="text-center">
                  <div className="border-b border-slate-400 w-44 h-8 mb-1"></div>
                  <span className="font-semibold">School Principal</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

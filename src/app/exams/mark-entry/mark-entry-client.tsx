"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  ArrowLeft,
  Save,
  Printer,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Download,
  ShieldAlert,
  X,
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
import { formatCurrency } from "@/lib/utils";
import {
  saveExamMarksBatch,
  generateReportCardPdf,
  toggleLockExamSchedule,
  getSectionReportCardsBatch,
  type SectionReportCardStudent,
} from "@/actions/exams";
import { ActionBanner } from "@/components/ui/action-banner";
import { cn } from "@/lib/utils";
import { SearchableSelect, SearchOption } from "@/components/ui/searchable-select";
import { Pagination, usePagination } from "@/components/ui/pagination";

export interface StudentMarkEntryRow {
  enrollmentId: string;
  studentId: string;
  rollNo: number;
  admissionNo: string;
  name: string;
  theory: string;
  practical: string;
  grace: number;
  attendanceStatus: "PRESENT" | "AB" | "ML" | "EX";
  hasOverdueFee: boolean;
  overdueAmount?: number;
}

export interface ScheduleOption {
  id: string;
  className: string;
  subjectName: string;
  maxTheory: number;
  maxPractical: number;
  passMarks: number;
}

interface MarkEntryClientProps {
  schedules: ScheduleOption[];
  selectedScheduleId: string;
  initialMarks: StudentMarkEntryRow[];
  maxTheory: number;
  maxPractical: number;
  passMarks?: number;
  isLocked: boolean;
  isScheduleLocked?: boolean;
  classId?: string;
  schoolId: string;
  academicYearId: string;
  userRole?: string;
}

export function SpreadsheetMarkEntryClient({
  schedules,
  selectedScheduleId,
  initialMarks,
  maxTheory,
  maxPractical,
  passMarks = 35,
  isLocked,
  isScheduleLocked = false,
  classId = "",
  schoolId,
  academicYearId,
  userRole = "SUPER_ADMIN",
}: MarkEntryClientProps) {
  const router = useRouter();

  const [marks, setMarks] = React.useState<StudentMarkEntryRow[]>(initialMarks);
  const [saveStatus, setSaveStatus] = React.useState<string>("All marks up to date");
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedDefaulter, setSelectedDefaulter] = React.useState<StudentMarkEntryRow | null>(null);
  const [reportCardAlert, setReportCardAlert] = React.useState<string | null>(null);
  const [notification, setNotification] = React.useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);

  // Freeze / Unlock & Bulk Report Card States
  const [scheduleLocked, setScheduleLocked] = React.useState<boolean>(isScheduleLocked);
  React.useEffect(() => {
    setScheduleLocked(isScheduleLocked);
  }, [isScheduleLocked]);

  const [isLocking, setIsLocking] = React.useState(false);
  const [showUnlockModal, setShowUnlockModal] = React.useState(false);
  const [unlockReason, setUnlockReason] = React.useState("");
  const [batchCards, setBatchCards] = React.useState<SectionReportCardStudent[] | null>(null);
  const [isLoadingBatch, setIsLoadingBatch] = React.useState(false);
  const [showBatchModal, setShowBatchModal] = React.useState(false);

  const notify = (type: "success" | "error" | "warning", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 6000);
  };

  // Check if mark input is valid (within [0, max] or one of AB, ML, EX)
  const getRowErrors = React.useCallback(
    (row: StudentMarkEntryRow) => {
      const errors: { theory?: string; practical?: string; grace?: string } = {};

      // 1. Theory Validation
      if (row.theory && row.theory.trim() !== "") {
        const val = row.theory.trim().toUpperCase();
        if (!["AB", "ML", "EX"].includes(val)) {
          const num = Number(val);
          if (isNaN(num)) {
            errors.theory = "Must be a number or AB/ML/EX";
          } else if (num < 0) {
            errors.theory = "Cannot be negative";
          } else if (num > maxTheory) {
            errors.theory = `Exceeds max (${maxTheory})`;
          }
        }
      }

      // 2. Practical Validation
      if (maxPractical > 0 && row.practical && row.practical.trim() !== "") {
        const val = row.practical.trim().toUpperCase();
        if (!["AB", "ML", "EX"].includes(val)) {
          const num = Number(val);
          if (isNaN(num)) {
            errors.practical = "Must be a number or AB/ML/EX";
          } else if (num < 0) {
            errors.practical = "Cannot be negative";
          } else if (num > maxPractical) {
            errors.practical = `Exceeds max (${maxPractical})`;
          }
        }
      }

      // 3. Grace Validation
      if (row.grace !== undefined && row.grace !== null) {
        const g = Number(row.grace);
        if (isNaN(g) || g < 0) {
          errors.grace = "Grace cannot be negative";
        } else {
          const th = parseFloat(row.theory) || 0;
          const pr = parseFloat(row.practical) || 0;
          const isCode = ["AB", "ML", "EX"].includes(row.theory?.trim().toUpperCase() || "");
          if (!isCode && th + pr + g > maxTheory + maxPractical) {
            errors.grace = `Total with grace exceeds max (${maxTheory + maxPractical})`;
          }
        }
      }

      return errors;
    },
    [maxTheory, maxPractical]
  );

  const validationErrors = React.useMemo(() => {
    const map = new Map<string, { theory?: string; practical?: string; grace?: string }>();
    let count = 0;

    for (const m of marks) {
      const errs = getRowErrors(m);
      if (errs.theory || errs.practical || errs.grace) {
        map.set(m.enrollmentId, errs);
        count++;
      }
    }

    return { map, count };
  }, [marks, getRowErrors]);

  const scheduleOptions: SearchOption[] = React.useMemo(() => {
    return schedules.map((s) => ({
      value: s.id,
      label: `${s.className} — ${s.subjectName}`,
      sublabel: `Max: ${s.maxTheory + s.maxPractical} (Th: ${s.maxTheory}, Pr: ${s.maxPractical})`,
    }));
  }, [schedules]);

  const { paginatedItems: paginatedMarks, paginationProps: marksPagination } = usePagination(marks, 15);

  React.useEffect(() => {
    setMarks(initialMarks);
  }, [initialMarks]);

  // Compute percentage using the non-penalizing ML/EX denominator exclusion algorithm
  const computeStudentStats = (row: StudentMarkEntryRow) => {
    const rowErr = validationErrors.map.get(row.enrollmentId);
    if (rowErr && (rowErr.theory || rowErr.practical || rowErr.grace)) {
      return {
        totalScore: "Exceeds Max",
        percentage: "Invalid",
        isPass: false,
        hasError: true,
        errorMessage: rowErr.theory || rowErr.practical || rowErr.grace || "Invalid marks entered",
      };
    }

    let numerator = 0;
    let denominator = 0;

    // Theory
    if (row.theory === "ML" || row.theory === "EX") {
      // Excluded from numerator & denominator
    } else if (row.theory === "AB") {
      numerator += 0;
      denominator += maxTheory;
    } else {
      numerator += (parseFloat(row.theory) || 0) + (row.grace || 0);
      denominator += maxTheory;
    }

    // Practical
    if (row.practical === "ML" || row.practical === "EX") {
      // Excluded
    } else if (row.practical === "AB") {
      numerator += 0;
      denominator += maxPractical;
    } else {
      numerator += parseFloat(row.practical) || 0;
      denominator += maxPractical;
    }

    if (denominator === 0) {
      return { totalScore: "ML", percentage: "N/A (Exempted)", isPass: true, hasError: false };
    }

    const pct = ((numerator / denominator) * 100).toFixed(1);
    const isPass = parseFloat(pct) >= 33.0;

    return {
      totalScore: `${numerator} / ${denominator}`,
      percentage: `${pct}%`,
      isPass,
      hasError: false,
    };
  };

  // Dynamic Class Rank Calculation (Dense Ranks)
  const rankMap = React.useMemo(() => {
    const studentScores = marks.map((m) => {
      const stats = computeStudentStats(m);
      const isErr = stats.hasError;
      const numericPct = isErr ? -1 : parseFloat(stats.percentage) || 0;
      return { enrollmentId: m.enrollmentId, numericPct, isErr };
    });

    const validScores = studentScores.filter((s) => !s.isErr);
    validScores.sort((a, b) => b.numericPct - a.numericPct);

    const map = new Map<string, number | null>();
    let currentRank = 1;
    for (let i = 0; i < validScores.length; i++) {
      if (i > 0 && validScores[i].numericPct < validScores[i - 1].numericPct) {
        currentRank = i + 1;
      }
      map.set(validScores[i].enrollmentId, currentRank);
    }

    for (const s of studentScores) {
      if (s.isErr) {
        map.set(s.enrollmentId, null);
      }
    }

    return map;
  }, [marks, maxTheory, maxPractical, validationErrors]);

  // Subject Performance Distribution
  const performanceDistribution = React.useMemo(() => {
    let high = 0; // >= 80%
    let avg = 0; // 50% - 79%
    let remedial = 0; // < 50%
    let validCount = 0;

    for (const m of marks) {
      const stats = computeStudentStats(m);
      if (stats.hasError) continue;
      validCount++;
      const pct = parseFloat(stats.percentage) || 0;
      if (pct >= 80) high++;
      else if (pct >= 50) avg++;
      else remedial++;
    }

    const total = validCount || 1;
    return {
      high,
      avg,
      remedial,
      highPct: Math.round((high / total) * 100),
      avgPct: Math.round((avg / total) * 100),
      remedialPct: Math.round((remedial / total) * 100),
    };
  }, [marks, maxTheory, maxPractical, validationErrors]);

  const handleCellChange = (
    enrollmentId: string,
    field: "theory" | "practical" | "grace",
    value: string
  ) => {
    if (isLocked) {
      notify("error", "Academic year is LOCKED.");
      return;
    }

    const upper = value.trim().toUpperCase();
    let attStatus: "PRESENT" | "AB" | "ML" | "EX" = "PRESENT";
    if (upper === "AB") attStatus = "AB";
    else if (upper === "ML") attStatus = "ML";
    else if (upper === "EX") attStatus = "EX";

    const num = parseFloat(value);
    if (!isNaN(num)) {
      if (field === "theory" && num > maxTheory) {
        notify("warning", `Entered theory mark (${num}) exceeds maximum allowed (${maxTheory}).`);
      } else if (field === "practical" && num > maxPractical) {
        notify("warning", `Entered practical mark (${num}) exceeds maximum allowed (${maxPractical}).`);
      }
    }

    setMarks((prev) =>
      prev.map((item) => {
        if (item.enrollmentId !== enrollmentId) return item;
        return {
          ...item,
          attendanceStatus: attStatus,
          [field]: field === "grace" ? parseInt(value) || 0 : value.trim().toUpperCase(),
        };
      })
    );
    setSaveStatus("Unsaved changes...");
  };

  const handleAutoClampAll = () => {
    setMarks((prev) =>
      prev.map((row) => {
        let th = row.theory;
        let pr = row.practical;
        let gr = row.grace;

        if (th && !["AB", "ML", "EX"].includes(th.trim().toUpperCase())) {
          const thNum = parseFloat(th);
          if (!isNaN(thNum)) {
            if (thNum > maxTheory) th = String(maxTheory);
            else if (thNum < 0) th = "0";
          }
        }

        if (maxPractical > 0 && pr && !["AB", "ML", "EX"].includes(pr.trim().toUpperCase())) {
          const prNum = parseFloat(pr);
          if (!isNaN(prNum)) {
            if (prNum > maxPractical) pr = String(maxPractical);
            else if (prNum < 0) pr = "0";
          }
        }

        if (gr < 0) gr = 0;
        const finalTh = parseFloat(th) || 0;
        const finalPr = parseFloat(pr) || 0;
        if (finalTh + finalPr + gr > maxTheory + maxPractical) {
          gr = Math.max(0, maxTheory + maxPractical - (finalTh + finalPr));
        }

        return {
          ...row,
          theory: th,
          practical: pr,
          grace: gr,
        };
      })
    );
    notify("success", `Clamped all out-of-bounds marks to maximum limits (Theory: ${maxTheory}, Practical: ${maxPractical}).`);
  };

  const handleSaveMarks = async () => {
    if (isLocked) {
      notify("error", "Academic year is LOCKED.");
      return;
    }

    if (validationErrors.count > 0) {
      notify(
        "error",
        `Cannot save marks: ${validationErrors.count} student ${
          validationErrors.count === 1 ? "entry has" : "entries have"
        } marks exceeding maximum allowed limits (Max Theory: ${maxTheory}, Max Practical: ${maxPractical}).`
      );
      return;
    }

    setIsSaving(true);
    setSaveStatus("Saving marks...");

    try {
      const entries = marks.map((m) => {
        const isCode = m.theory === "AB" || m.theory === "ML" || m.theory === "EX";
        const th = isCode ? null : parseFloat(m.theory) || 0;
        const pr = isCode ? null : parseFloat(m.practical) || 0;

        return {
          enrollmentId: m.enrollmentId,
          theoryMarks: th,
          practicalMarks: pr,
          graceMarks: m.grace,
          attendanceStatus: m.attendanceStatus,
        };
      });

      const res = await saveExamMarksBatch({
        examScheduleId: selectedScheduleId,
        entries,
      });

      if (res.success) {
        setSaveStatus(`Saved at ${new Date().toLocaleTimeString()}`);
        notify("success", "Exam marks saved successfully.");
        router.refresh();
      }
    } catch (err: any) {
      notify("error", "Save failed: " + err.message);
      setSaveStatus("Save error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDefaulterCheck = async (stu: StudentMarkEntryRow) => {
    const rowErr = validationErrors.map.get(stu.enrollmentId);
    if (rowErr && (rowErr.theory || rowErr.practical || rowErr.grace)) {
      notify("error", `Cannot download report card: ${stu.name} has invalid marks exceeding maximum limits.`);
      return;
    }

    try {
      const res = await generateReportCardPdf({
        schoolId,
        studentId: stu.studentId,
        academicYearId,
      });

      if (res.isBlocked) {
        setSelectedDefaulter(stu);
        setReportCardAlert(res.message || "Results withheld due to overdue fees.");
      } else {
        setSelectedDefaulter(null);
        notify("success", `Report card for ${stu.name} generated successfully! Overall Score: ${res.reportCard?.percentage}%`);
      }
    } catch (err: any) {
      notify("error", "Error checking report card: " + err.message);
    }
  };

  // Submit & Freeze Marks
  const handleFreezeMarks = async () => {
    if (isLocked) {
      notify("error", "Academic year is locked.");
      return;
    }
    if (validationErrors.count > 0) {
      notify("error", "Cannot freeze schedule: Please correct out-of-bounds marks before submitting.");
      return;
    }

    setIsLocking(true);
    try {
      if (saveStatus === "Unsaved changes...") {
        const entries = marks.map((m) => {
          const isCode = m.theory === "AB" || m.theory === "ML" || m.theory === "EX";
          const th = isCode ? null : parseFloat(m.theory) || 0;
          const pr = isCode ? null : parseFloat(m.practical) || 0;

          return {
            enrollmentId: m.enrollmentId,
            theoryMarks: th,
            practicalMarks: pr,
            graceMarks: m.grace,
            attendanceStatus: m.attendanceStatus,
          };
        });

        const saveRes = await saveExamMarksBatch({
          examScheduleId: selectedScheduleId,
          entries,
        });

        if (!saveRes.success) {
          notify("error", "Failed to save marks before freezing: " + (saveRes as any).message);
          setIsLocking(false);
          return;
        }
      }

      const res = await toggleLockExamSchedule({
        schoolId,
        userRole: (userRole as any) || "PRINCIPAL",
        userId: "usr_principal",
        examScheduleId: selectedScheduleId,
        isLocked: true,
      });
      if (res.success) {
        setScheduleLocked(true);
        notify("success", "Marks successfully submitted & frozen. Principal sign-off required to unlock.");
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to freeze marks.");
    } finally {
      setIsLocking(false);
    }
  };

  // Principal Unlock Sign-off
  const handleUnlockMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockReason.trim()) {
      notify("error", "Please provide a valid Principal sign-off reason to unlock marks.");
      return;
    }
    setIsLocking(true);
    try {
      const res = await toggleLockExamSchedule({
        schoolId,
        userRole: (userRole as any) || "PRINCIPAL",
        userId: "usr_principal",
        examScheduleId: selectedScheduleId,
        isLocked: false,
        reason: unlockReason.trim(),
      });
      if (res.success) {
        setScheduleLocked(false);
        setShowUnlockModal(false);
        setUnlockReason("");
        notify("success", "Marks schedule unlocked successfully for modifications.");
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to unlock marks.");
    } finally {
      setIsLocking(false);
    }
  };

  // 1-Click Bulk Report Card Batch
  const handleDownloadBatchReportCards = async () => {
    if (validationErrors.count > 0) {
      notify("error", "Cannot generate bulk report cards: Please resolve invalid mark entries first.");
      return;
    }
    if (!classId) {
      notify("error", "Class information missing for report cards.");
      return;
    }
    setIsLoadingBatch(true);
    try {
      const res = await getSectionReportCardsBatch({
        schoolId,
        academicYearId,
        classId,
      });
      if (res.success && res.reportCards) {
        setBatchCards(res.reportCards);
        setShowBatchModal(true);
        notify("success", `Generated ${res.reportCards.length} official student report cards in 1 click!`);
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to generate bulk report cards.");
    } finally {
      setIsLoadingBatch(false);
    }
  };

  const handlePrintBatch = () => {
    const originalTitle = document.title;
    document.title = `Report_Cards_${classId || "Section"}_Term_Exams`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  return (
    <>
      <div className={cn("space-y-4", showBatchModal && "print:hidden")}>
      {/* Action Notification Banner */}
      {notification && (
        <ActionBanner
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <Link href="/exams">
            <Button size="icon" variant="outline" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-navy-800" />
              Spreadsheet Mark Entry & Grace Moderation
            </h1>
            <p className="text-xs text-slate-500 font-tabular">
              Accepts 0-{maxTheory} or string codes: <code className="font-mono font-bold text-red-600">AB</code> (Absent),{" "}
              <code className="font-mono font-bold text-amber-600">ML</code> (Medical Leave),{" "}
              <code className="font-mono font-bold text-blue-600">EX</code> (Exempted)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 1-Click Bulk Report Card Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadBatchReportCards}
            disabled={isLoadingBatch}
            className="gap-1.5 text-xs font-semibold text-slate-700 border-slate-300 hover:bg-slate-100"
          >
            <Printer className="h-3.5 w-3.5 text-blue-700" />
            <span>{isLoadingBatch ? "Generating All Cards..." : "Download All Report Cards (PDF)"}</span>
          </Button>

          {/* Freeze / Unlock Marks Workflow */}
          {scheduleLocked ? (
            <div className="flex items-center gap-1.5">
              <Badge variant="danger" className="text-xs px-2.5 py-1 font-bold flex items-center gap-1">
                <Lock className="h-3 w-3" /> Marks Frozen
              </Badge>
              {(userRole === "SUPER_ADMIN" || userRole === "PRINCIPAL") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowUnlockModal(true)}
                  className="gap-1 text-xs border-amber-500 text-amber-800 hover:bg-amber-50 font-semibold"
                >
                  <Unlock className="h-3 w-3 text-amber-600" /> Unlock Marks
                </Button>
              )}
            </div>
          ) : (
            <Button
              size="sm"
              onClick={handleFreezeMarks}
              disabled={isLocked || isSaving || isLocking || validationErrors.count > 0}
              className={cn(
                "gap-1.5 text-xs text-white font-bold transition-all",
                validationErrors.count > 0
                  ? "bg-slate-400 cursor-not-allowed opacity-60"
                  : "bg-amber-600 hover:bg-amber-700"
              )}
              title={validationErrors.count > 0 ? "Correct invalid marks to submit and freeze" : undefined}
            >
              <Lock className="h-3.5 w-3.5" />
              <span>{isLocking ? "Freezing..." : "Submit & Freeze Marks"}</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleSaveMarks}
            disabled={isLocked || isSaving || scheduleLocked || validationErrors.count > 0}
            className={cn(
              "gap-1.5 text-xs text-white font-bold transition-all",
              validationErrors.count > 0
                ? "bg-slate-400 cursor-not-allowed opacity-60"
                : "bg-navy-900 hover:bg-navy-800"
            )}
            title={validationErrors.count > 0 ? "Correct invalid marks before saving" : undefined}
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaving ? "Saving..." : "Save Marks"}</span>
          </Button>
        </div>
      </div>

      {/* Persistent Frozen Schedule Notice */}
      {scheduleLocked && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-950 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-700 shrink-0" />
            <span>
              <strong>🔒 MARKS SUBMITTED & FROZEN:</strong> Modifications to this exam schedule are strictly locked. Principal approval & sign-off is required to unlock changes.
            </span>
          </div>
          {(userRole === "SUPER_ADMIN" || userRole === "PRINCIPAL") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowUnlockModal(true)}
              className="text-xs h-7 border-amber-600 text-amber-900 hover:bg-amber-100 font-semibold shrink-0"
            >
              <Unlock className="h-3 w-3 mr-1 text-amber-700" /> Principal Sign-Off
            </Button>
          )}
        </div>
      )}

      {/* Schedule Picker Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-72 sm:w-80">
            <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">
              Select Exam Schedule
            </label>
            <SearchableSelect
              options={scheduleOptions}
              value={selectedScheduleId}
              onChange={(val) => router.push(`/exams/mark-entry?scheduleId=${val}`)}
              placeholder="Search exam schedule..."
            />
          </div>

          <div className="border-l border-slate-200 pl-3">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">
              Max Theory / Practical
            </span>
            <span className="text-xs font-bold font-tabular text-slate-800">
              {maxTheory} / {maxPractical} (Pass: {passMarks})
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 block uppercase font-semibold">
            Enrolled Students
          </span>
          <span className="text-xs font-bold font-tabular text-slate-800">
            {marks.length} Records
          </span>
        </div>
      </div>

      {/* Real-time Out-of-Bounds Marks Validation Alert Banner */}
      {validationErrors.count > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-xs text-red-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <div>
              <span className="font-bold text-red-900">
                ⚠️ INVALID MARKS DETECTED:
              </span>{" "}
              <span>
                {validationErrors.count} student {validationErrors.count === 1 ? "entry has" : "entries have"} marks exceeding maximum allowed limits (Theory max: <strong>{maxTheory}</strong>, Practical max: <strong>{maxPractical}</strong>). Save and Freeze actions are suspended until corrected.
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAutoClampAll}
            className="h-7 text-xs bg-white border-red-300 text-red-700 hover:bg-red-100 font-semibold gap-1 shrink-0"
          >
            <span>Auto-Clamp to Max Limits</span>
          </Button>
        </div>
      )}

      {/* Fee Defaulter Alert Modal/Banner */}
      {selectedDefaulter && (
        <div className="p-3.5 bg-red-50 border border-red-300 rounded text-xs text-red-900 flex items-start justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">
                HOLD ACTIVE: Report Card Withheld for {selectedDefaulter.name} ({selectedDefaulter.admissionNo})
              </span>
              <p className="text-[11px] text-red-700 mt-0.5">
                {reportCardAlert || "Student has overdue fee invoices. Access to digital marks card is suspended per school policy."}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedDefaulter(null)}
            className="h-7 text-[10px] bg-white border-red-300 text-red-800"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Subject Performance Distribution Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>Performance Distribution & Pacing Analysis</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Evaluated across all {marks.length} enrolled candidates in this assessment schedule.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-800">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              High Achievers (≥80%): {performanceDistribution.high} ({performanceDistribution.highPct}%)
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-blue-800">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Average (50–79%): {performanceDistribution.avg} ({performanceDistribution.avgPct}%)
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-amber-800">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Remedial (&lt;50%): {performanceDistribution.remedial} ({performanceDistribution.remedialPct}%)
            </span>
          </div>
        </div>

        {/* Multi-segment progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-2.5 flex overflow-hidden border border-slate-200">
          <div
            className="bg-emerald-500 h-2.5 transition-all duration-300"
            style={{ width: `${performanceDistribution.highPct}%` }}
            title={`High Achievers: ${performanceDistribution.high} (${performanceDistribution.highPct}%)`}
          />
          <div
            className="bg-blue-500 h-2.5 transition-all duration-300"
            style={{ width: `${performanceDistribution.avgPct}%` }}
            title={`Average: ${performanceDistribution.avg} (${performanceDistribution.avgPct}%)`}
          />
          <div
            className="bg-amber-500 h-2.5 transition-all duration-300"
            style={{ width: `${performanceDistribution.remedialPct}%` }}
            title={`Remedial: ${performanceDistribution.remedial} (${performanceDistribution.remedialPct}%)`}
          />
        </div>
      </div>

      {/* Interactive TanStack Spreadsheet Grid */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200 bg-slate-50">
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead className="w-24 text-center font-bold text-slate-700">Class Rank</TableHead>
              <TableHead className="w-28">Admission No</TableHead>
              <TableHead>Student Name</TableHead>
              <TableHead className="w-24 text-center">
                Theory ({maxTheory})
              </TableHead>
              <TableHead className="w-24 text-center">
                Practical ({maxPractical})
              </TableHead>
              <TableHead className="w-20 text-center">Grace (+)</TableHead>
              <TableHead className="w-24 text-right">Computed Score</TableHead>
              <TableHead className="w-20 text-right">Percentage</TableHead>
              <TableHead className="w-20 text-center">Status</TableHead>
              <TableHead className="text-right">Report Card</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedMarks.map((row) => {
              const stats = computeStudentStats(row);
              const rank = rankMap.get(row.enrollmentId);
              const rowErr = validationErrors.map.get(row.enrollmentId);

              return (
                <TableRow
                  key={row.enrollmentId}
                  className={cn(
                    "hover:bg-slate-50/70 border-b border-slate-100 transition-colors",
                    stats.hasError && "bg-red-50/30"
                  )}
                >
                  <TableCell className="text-center font-tabular text-xs font-bold text-slate-400">
                    {row.rollNo}
                  </TableCell>
                  <TableCell className="text-center font-bold text-xs">
                    {stats.hasError || rank == null ? (
                      <span className="text-slate-400 font-mono text-xs" title="Rank unavailable due to invalid marks">
                        —
                      </span>
                    ) : rank === 1 ? (
                      <Badge className="bg-amber-400 text-amber-950 font-black text-[10px] border-amber-500 shadow-xs">
                        🥇 1st
                      </Badge>
                    ) : rank === 2 ? (
                      <Badge className="bg-slate-200 text-slate-900 font-bold text-[10px] border-slate-300">
                        🥈 2nd
                      </Badge>
                    ) : rank === 3 ? (
                      <Badge className="bg-amber-700 text-white font-bold text-[10px]">
                        🥉 3rd
                      </Badge>
                    ) : (
                      <span className="font-mono text-slate-500 text-xs">#{rank}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">
                    {row.admissionNo}
                  </TableCell>
                  <TableCell className="font-medium text-xs text-slate-900">
                    {row.name}
                    {row.hasOverdueFee && (
                      <span className="ml-2 inline-flex items-center text-[10px] text-red-600 font-semibold">
                        (Fee Defaulter)
                      </span>
                    )}
                  </TableCell>

                  {/* Theory Input Cell */}
                  <TableCell className="p-1 text-center">
                    <div className="flex flex-col items-center">
                      <input
                        type="text"
                        value={row.theory}
                        onChange={(e) => handleCellChange(row.enrollmentId, "theory", e.target.value)}
                        disabled={isLocked || scheduleLocked}
                        placeholder="0"
                        title={rowErr?.theory ? `Error: ${rowErr.theory}` : `Theory marks (Max: ${maxTheory})`}
                        className={cn(
                          "w-16 h-7 text-center font-tabular font-bold text-xs rounded transition-all",
                          rowErr?.theory
                            ? "border-2 border-red-500 bg-red-50 text-red-800 ring-2 ring-red-200 focus:outline-none focus:ring-red-400"
                            : "border border-slate-300 focus:border-navy-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                        )}
                      />
                      {rowErr?.theory && (
                        <span className="text-[9px] font-bold text-red-600 leading-tight mt-0.5 whitespace-nowrap" title={rowErr.theory}>
                          Max: {maxTheory}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Practical Input Cell */}
                  <TableCell className="p-1 text-center">
                    <div className="flex flex-col items-center">
                      <input
                        type="text"
                        value={row.practical}
                        onChange={(e) => handleCellChange(row.enrollmentId, "practical", e.target.value)}
                        disabled={isLocked || scheduleLocked || maxPractical === 0}
                        placeholder="0"
                        title={rowErr?.practical ? `Error: ${rowErr.practical}` : `Practical marks (Max: ${maxPractical})`}
                        className={cn(
                          "w-16 h-7 text-center font-tabular font-bold text-xs rounded transition-all",
                          rowErr?.practical
                            ? "border-2 border-red-500 bg-red-50 text-red-800 ring-2 ring-red-200 focus:outline-none focus:ring-red-400"
                            : "border border-slate-300 focus:border-navy-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                        )}
                      />
                      {rowErr?.practical && (
                        <span className="text-[9px] font-bold text-red-600 leading-tight mt-0.5 whitespace-nowrap" title={rowErr.practical}>
                          Max: {maxPractical}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Grace Input Cell */}
                  <TableCell className="p-1 text-center">
                    <div className="flex flex-col items-center">
                      <input
                        type="number"
                        min="0"
                        value={row.grace}
                        onChange={(e) => handleCellChange(row.enrollmentId, "grace", e.target.value)}
                        disabled={isLocked || scheduleLocked}
                        title={rowErr?.grace ? `Error: ${rowErr.grace}` : "Grace Marks (non-negative)"}
                        className={cn(
                          "w-14 h-7 text-center font-tabular text-xs rounded font-bold transition-all",
                          rowErr?.grace
                            ? "border-2 border-red-500 bg-red-50 text-red-800 ring-2 ring-red-200 focus:outline-none focus:ring-red-400"
                            : "border border-amber-300 bg-amber-50/40 text-amber-900 focus:border-navy-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                        )}
                      />
                      {rowErr?.grace && (
                        <span className="text-[9px] font-bold text-red-600 leading-tight mt-0.5 whitespace-nowrap" title={rowErr.grace}>
                          Invalid
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Computed Score */}
                  <TableCell className="text-right font-tabular text-xs font-semibold">
                    {stats.hasError ? (
                      <span className="text-red-600 font-bold" title={stats.errorMessage}>
                        ⚠️ Exceeds Max
                      </span>
                    ) : (
                      <span className="text-slate-800">{stats.totalScore}</span>
                    )}
                  </TableCell>

                  {/* Percentage */}
                  <TableCell className="text-right font-tabular text-xs font-bold">
                    {stats.hasError ? (
                      <span className="text-red-600 font-bold">Invalid</span>
                    ) : (
                      <span className="text-slate-900">{stats.percentage}</span>
                    )}
                  </TableCell>

                  {/* Pass / Fail */}
                  <TableCell className="text-center">
                    {stats.hasError ? (
                      <Badge variant="danger" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-800 border-red-300 font-bold">
                        Error
                      </Badge>
                    ) : (
                      <Badge variant={stats.isPass ? "success" : "danger"} className="text-[10px] px-1.5 py-0">
                        {stats.isPass ? "Pass" : "Fail"}
                      </Badge>
                    )}
                  </TableCell>

                  {/* Report Card Button */}
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDefaulterCheck(row)}
                      disabled={stats.hasError}
                      className={cn(
                        "h-6 text-[10px] px-2 gap-1",
                        stats.hasError
                          ? "text-slate-400 border-slate-200 cursor-not-allowed"
                          : "text-navy-800 hover:bg-slate-100"
                      )}
                      title={stats.hasError ? "Resolve mark error before viewing report card" : undefined}
                    >
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Pagination {...marksPagination} />
      </div>

      {/* Principal Unlock Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Unlock className="h-4 w-4 text-amber-600" />
                <span>Principal Sign-Off: Unlock Marks</span>
              </div>
              <button
                onClick={() => setShowUnlockModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              This schedule is frozen. Unlocking it will allow teachers to edit submitted grades. Provide a formal audit justification.
            </p>
            <form onSubmit={handleUnlockMarks} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Reason for Unlocking *
                </label>
                <textarea
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="e.g. Approved re-evaluation request for Student roll #12 following paper review..."
                  className="w-full text-xs border border-slate-300 rounded p-2 focus:border-amber-600 focus:outline-none h-20 resize-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => setShowUnlockModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  disabled={isLocking}
                  className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  {isLocking ? "Authorizing..." : "Authorize Unlock"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      </div>

      {/* 1-Click Bulk Report Card Batch Printable Modal */}
      {showBatchModal && batchCards && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 p-2 sm:p-6 overflow-y-auto print:static print:inset-auto print:p-0 print:m-0 print:bg-white print:overflow-visible print:block print:w-full">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full mx-auto my-auto flex flex-col overflow-hidden max-h-[95vh] print:max-w-none print:w-full print:shadow-none print:border-none print:rounded-none print:p-0 print:m-0 print:overflow-visible">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-emerald-400" />
                <span className="font-bold text-xs">
                  Section Batch Report Cards ({batchCards.length} Students)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handlePrintBatch}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-8 px-3"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print / Save All to PDF (1-Click)</span>
                </Button>
                <button
                  onClick={() => setShowBatchModal(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Cards Scroll Container */}
            <div className="p-6 overflow-y-auto space-y-8 bg-slate-100 print:bg-white print:p-0 print:space-y-0">
              {batchCards.map((card, idx) => (
                <div
                  key={card.admissionNo}
                  className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-8 report-card-page print:break-after-page"
                  style={{ pageBreakAfter: "always" }}
                >
                  {/* School Letterhead */}
                  <div className="text-center border-b-2 border-slate-900 pb-4 mb-4">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <div className="h-7 w-7 rounded bg-navy-900 text-white font-bold text-xs flex items-center justify-center font-mono">
                        CMS
                      </div>
                      <h2 className="text-lg font-black tracking-wider text-slate-900 uppercase">
                        Crescent Matriculation Higher Secondary School
                      </h2>
                    </div>
                    <p className="text-[10px] text-slate-600 font-medium">
                      Recognized by Govt. of Tamil Nadu • Kodambakkam, Chennai - 600024 • Phone: 044-24830000
                    </p>
                    <div className="inline-block mt-2 px-3 py-0.5 bg-slate-900 text-white text-[10px] font-bold tracking-widest uppercase rounded">
                      Official Term Progress Report Card
                    </div>
                  </div>

                  {/* Student Info Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200 text-xs mb-4">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Student Name</span>
                      <strong className="text-slate-900">{card.name}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Admission / Roll</span>
                      <strong className="text-slate-900">{card.admissionNo} • Roll #{card.rollNo}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Class & Section</span>
                      <strong className="text-slate-900">{card.className} - {card.sectionName}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Overall Result</span>
                      <strong className={card.result === "PASS" ? "text-emerald-700" : card.result === "FAIL" ? "text-rose-700" : "text-amber-700"}>
                        {card.result} ({card.percentage}%)
                      </strong>
                    </div>
                  </div>

                  {/* Marks Table */}
                  <table className="w-full text-xs border-collapse border border-slate-300 mb-4">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800">
                        <th className="border border-slate-300 px-3 py-1.5 text-left">Subject</th>
                        <th className="border border-slate-300 px-3 py-1.5 text-center font-mono">Code</th>
                        <th className="border border-slate-300 px-3 py-1.5 text-center">Max Marks</th>
                        <th className="border border-slate-300 px-3 py-1.5 text-center">Theory</th>
                        <th className="border border-slate-300 px-3 py-1.5 text-center">Practical</th>
                        <th className="border border-slate-300 px-3 py-1.5 text-center">Total Scored</th>
                        <th className="border border-slate-300 px-3 py-1.5 text-center font-bold">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {card.subjects.map((sub, sIdx) => (
                        <tr key={sIdx} className="hover:bg-slate-50">
                          <td className="border border-slate-300 px-3 py-1 font-medium text-slate-900">{sub.name}</td>
                          <td className="border border-slate-300 px-3 py-1 text-center font-mono text-[11px] text-slate-600">{sub.code}</td>
                          <td className="border border-slate-300 px-3 py-1 text-center font-mono">{sub.maxMarks}</td>
                          <td className="border border-slate-300 px-3 py-1 text-center font-mono font-semibold">{sub.theoryScored}</td>
                          <td className="border border-slate-300 px-3 py-1 text-center font-mono">{sub.practicalScored}</td>
                          <td className="border border-slate-300 px-3 py-1 text-center font-mono font-bold text-slate-900">{sub.totalScored}</td>
                          <td className="border border-slate-300 px-3 py-1 text-center font-bold text-slate-900">{sub.grade}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold">
                        <td colSpan={2} className="border border-slate-300 px-3 py-1.5 text-right">TOTAL SUMMARY:</td>
                        <td className="border border-slate-300 px-3 py-1.5 text-center font-mono">{card.totalMax}</td>
                        <td colSpan={2} className="border border-slate-300 px-3 py-1.5"></td>
                        <td className="border border-slate-300 px-3 py-1.5 text-center font-mono text-emerald-800 font-bold">{card.totalScored}</td>
                        <td className="border border-slate-300 px-3 py-1.5 text-center font-bold text-emerald-800">{card.percentage}%</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Overdue Warning Watermark if applicable */}
                  {card.hasOverdueFee && (
                    <div className="bg-amber-50 border border-amber-300 rounded p-2 text-center text-xs text-amber-900 font-bold mb-4">
                      ⚠️ Note: Outstanding term fees (₹{card.overdueAmount.toFixed(2)}) pending at accounts office.
                    </div>
                  )}

                  {/* Signatures */}
                  <div className="grid grid-cols-3 gap-8 pt-8 mt-4 border-t border-slate-200 text-center text-xs text-slate-600">
                    <div>
                      <div className="border-b border-slate-400 h-8 mb-1"></div>
                      <span>Class Teacher</span>
                    </div>
                    <div>
                      <div className="border-b border-slate-400 h-8 mb-1"></div>
                      <span>Examination Controller</span>
                    </div>
                    <div>
                      <div className="border-b border-slate-400 h-8 mb-1"></div>
                      <span>Principal Sign & Seal</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

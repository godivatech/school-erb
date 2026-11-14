"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  Clock,
  AlertTriangle,
  AlertCircle,
  UserCheck,
  CheckCircle2,
  Users,
  ShieldAlert,
  ArrowRight,
  Filter,
  Plus,
  Pencil,
  Trash2,
  X,
  Layers,
  Printer,
  Download,
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
import { SearchableSelect, SearchOption } from "@/components/ui/searchable-select";
import { ActionBanner } from "@/components/ui/action-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  assignTimetableSlot,
  clearTimetableSlot,
  createManualSubstitution,
} from "@/actions/hr-transport";

export interface ClashDetail {
  otherClass: string;
  otherSection: string;
  otherSubject: string;
  otherRoom: string | null;
  teacherName: string;
}

interface SectionOption {
  id: string;
  name: string;
  className: string;
}

interface TimetableSlotData {
  id: string;
  sectionId: string;
  dayOfWeek: number;
  periodNo: number;
  roomNo: string | null;
  subjectName: string;
  subjectCode: string;
  teacherId: string | null;
  teacherName: string | null;
  className?: string;
  sectionName?: string;
}

interface SubstitutionData {
  id: string;
  date: string;
  timetableSlotId: string;
  absentTeacherName: string;
  substituteTeacherName: string;
  status: string;
  notes: string | null;
}

interface TeacherOption {
  id: string;
  name: string;
  email: string;
}

interface SubjectOption {
  id: string;
  name: string;
  code: string;
}

interface TimetableClientProps {
  allSections: SectionOption[];
  selectedSectionId: string;
  slots: TimetableSlotData[];
  clashesMap: Record<string, ClashDetail[]>;
  activeSubs: SubstitutionData[];
  allTeachers: TeacherOption[];
  allSubjects: SubjectOption[];
  academicYearId: string;
  schoolId: string;
  todayStr: string;
  isYearLocked: boolean;
}

const DAYS = [
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
];

const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export function TimetableClient({
  allSections,
  selectedSectionId,
  slots,
  clashesMap,
  activeSubs,
  allTeachers,
  allSubjects,
  academicYearId,
  schoolId,
  todayStr,
  isYearLocked,
}: TimetableClientProps) {
  const router = useRouter();
  const [notification, setNotification] = React.useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Modal: Assign / Edit Period Slot
  const [editingSlotCoord, setEditingSlotCoord] = React.useState<{
    day: number;
    period: number;
    existingSlot?: TimetableSlotData;
  } | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = React.useState(allSubjects[0]?.id || "");
  const [selectedTeacherId, setSelectedTeacherId] = React.useState(allTeachers[0]?.id || "");
  const [roomNumber, setRoomNumber] = React.useState("Room 101");

  // Confirm Clear Slot Dialog
  const [clearingSlot, setClearingSlot] = React.useState<TimetableSlotData | null>(null);

  // Modal: Manual Substitution
  const searchParams = useSearchParams();
  const assignSlotParam = searchParams ? searchParams.get("assignSlot") : null;

  const [showSubModal, setShowSubModal] = React.useState(false);
  const [subAbsentTeacherId, setSubAbsentTeacherId] = React.useState(allTeachers[0]?.id || "");
  const [subSubstituteTeacherId, setSubSubstituteTeacherId] = React.useState(
    allTeachers[1]?.id || allTeachers[0]?.id || ""
  );
  const [subPeriodSlotId, setSubPeriodSlotId] = React.useState(slots[0]?.id || "");
  const [subNotes, setSubNotes] = React.useState("Emergency coverage requested by Principal");

  React.useEffect(() => {
    if (assignSlotParam) {
      const targetSlot = slots.find((s) => s.id === assignSlotParam);
      if (targetSlot) {
        setSubPeriodSlotId(targetSlot.id);
        if (targetSlot.teacherId) {
          setSubAbsentTeacherId(targetSlot.teacherId);
        }
        setShowSubModal(true);
      }
    }
  }, [assignSlotParam, slots]);

  const notify = (type: "success" | "error" | "warning", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 7000);
  };

  // View Mode: By Class vs By Teacher
  const [viewMode, setViewMode] = React.useState<"CLASS" | "TEACHER">("CLASS");
  const [selectedTeacherViewId, setSelectedTeacherViewId] = React.useState<string>(allTeachers[0]?.id || "");
  const [showPrintModal, setShowPrintModal] = React.useState(false);

  const sectionSlots = slots.filter((s) => s.sectionId === selectedSectionId);

  const activeSlots = React.useMemo(() => {
    if (viewMode === "TEACHER") {
      return slots.filter((s) => s.teacherId === selectedTeacherViewId);
    }
    return sectionSlots;
  }, [viewMode, selectedTeacherViewId, sectionSlots, slots]);

  // Group by dayOfWeek and periodNo
  const slotGrid: Record<string, TimetableSlotData> = {};
  for (const s of activeSlots) {
    slotGrid[`${s.dayOfWeek}_${s.periodNo}`] = s;
  }

  // Free Teachers for current substitution target period
  const targetSubSlot = slots.find((s) => s.id === subPeriodSlotId);
  const freeTeachersForSub = React.useMemo(() => {
    if (!targetSubSlot) return [];
    const busyIds = new Set(
      slots
        .filter(
          (s) =>
            s.dayOfWeek === targetSubSlot.dayOfWeek &&
            s.periodNo === targetSubSlot.periodNo &&
            s.teacherId
        )
        .map((s) => s.teacherId!)
    );
    return allTeachers.filter((t) => !busyIds.has(t.id) && t.id !== subAbsentTeacherId);
  }, [targetSubSlot, slots, allTeachers, subAbsentTeacherId]);

  const totalClashes = Object.keys(clashesMap).length;

  // Active section clashes with exact details
  const activeSectionClashes = React.useMemo(() => {
    const list: Array<{
      slot: TimetableSlotData;
      dayName: string;
      period: number;
      teacherName: string;
      otherClass: string;
      otherSection: string;
      otherSubject: string;
      otherRoom: string | null;
    }> = [];

    for (const s of sectionSlots) {
      const details = clashesMap[s.id];
      if (details && details.length > 0) {
        const dayObj = DAYS.find((d) => d.id === s.dayOfWeek);
        for (const d of details) {
          list.push({
            slot: s,
            dayName: dayObj?.name || `Day ${s.dayOfWeek}`,
            period: s.periodNo,
            teacherName: s.teacherName || "Teacher",
            otherClass: d.otherClass,
            otherSection: d.otherSection,
            otherSubject: d.otherSubject,
            otherRoom: d.otherRoom,
          });
        }
      }
    }
    return list;
  }, [sectionSlots, clashesMap]);

  // Options for SearchableSelect
  const sectionOptions: SearchOption[] = allSections.map((sec) => ({
    value: sec.id,
    label: `${sec.className} - Section ${sec.name}`,
    badge: "Class",
  }));

  const subjectOptions: SearchOption[] = allSubjects.map((s) => ({
    value: s.id,
    label: s.name,
    sublabel: s.code,
    badge: s.code,
  }));

  const teacherOptions: SearchOption[] = [
    { value: "", label: "Unassigned (No Teacher)" },
    ...allTeachers.map((t) => ({
      value: t.id,
      label: t.name,
      sublabel: t.email,
      badge: "Faculty",
    })),
  ];

  // Live conflict warning inside the modal when selecting a teacher
  const modalClashWarning = React.useMemo(() => {
    if (!editingSlotCoord || !selectedTeacherId) return null;
    // Check if this teacher is assigned in any other section during this day & period
    const collidingSlot = slots.find(
      (s) =>
        s.teacherId === selectedTeacherId &&
        s.dayOfWeek === editingSlotCoord.day &&
        s.periodNo === editingSlotCoord.period &&
        s.sectionId !== selectedSectionId
    );
    if (collidingSlot) {
      const teacher = allTeachers.find((t) => t.id === selectedTeacherId);
      return {
        teacherName: teacher?.name || "Teacher",
        className: collidingSlot.className || "Another Class",
        sectionName: collidingSlot.sectionName || "Section",
        subject: collidingSlot.subjectName,
        room: collidingSlot.roomNo,
      };
    }
    return null;
  }, [editingSlotCoord, selectedTeacherId, slots, selectedSectionId, allTeachers]);

  // Open Period Assignment Modal
  const handleOpenSlotModal = (day: number, period: number) => {
    if (isYearLocked) {
      notify("error", "Academic year is LOCKED. Timetable cannot be modified.");
      return;
    }
    const slot = slotGrid[`${day}_${period}`];
    setEditingSlotCoord({ day, period, existingSlot: slot });

    if (slot) {
      const matchingSub = allSubjects.find((s) => s.name === slot.subjectName);
      setSelectedSubjectId(matchingSub?.id || allSubjects[0]?.id || "");
      setSelectedTeacherId(slot.teacherId || "");
      setRoomNumber(slot.roomNo || "Room 101");
    } else {
      setSelectedSubjectId(allSubjects[0]?.id || "");
      setSelectedTeacherId(allTeachers[0]?.id || "");
      setRoomNumber("Room 101");
    }
  };

  // Save Period Slot Assignment
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlotCoord) return;
    setIsProcessing(true);
    try {
      const res = await assignTimetableSlot({
        schoolId,
        academicYearId,
        sectionId: selectedSectionId,
        dayOfWeek: editingSlotCoord.day,
        periodNo: editingSlotCoord.period,
        subjectId: selectedSubjectId,
        teacherId: selectedTeacherId || null,
        roomNo: roomNumber.trim() || null,
      });

      if (res.success) {
        setEditingSlotCoord(null);
        if (res.clashWarning) {
          notify("warning", res.clashWarning);
        } else {
          notify("success", `Period ${editingSlotCoord.period} on Day ${editingSlotCoord.day} saved successfully!`);
        }
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to assign period.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear Period Slot
  const handleConfirmClearSlot = async () => {
    if (!clearingSlot) return;
    setIsProcessing(true);
    try {
      const res = await clearTimetableSlot({
        schoolId,
        slotId: clearingSlot.id,
      });
      if (res.success) {
        setClearingSlot(null);
        setEditingSlotCoord(null);
        notify("success", "Period slot cleared successfully.");
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to clear slot.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit Manual Substitution
  const handleSaveSubstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const res = await createManualSubstitution({
        schoolId,
        timetableSlotId: subPeriodSlotId,
        absentTeacherId: subAbsentTeacherId,
        substituteTeacherId: subSubstituteTeacherId,
        date: todayStr,
        notes: subNotes,
      });

      if (res.success) {
        setShowSubModal(false);
        notify("success", "Period substitution arranged and registered!");
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to create substitution.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintTimetable = () => {
    const originalTitle = document.title;
    const targetLabel =
      viewMode === "CLASS"
        ? `Class_${allSections.find((s) => s.id === selectedSectionId)?.className}_Sec_${allSections.find((s) => s.id === selectedSectionId)?.name}`
        : `Faculty_${allTeachers.find((t) => t.id === selectedTeacherViewId)?.name || "Teacher"}`;
    document.title = `Timetable_${targetLabel.replace(/[^a-zA-Z0-9]/g, "_")}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  return (
    <>
      <div className={cn("space-y-5 animate-in fade-in duration-150", showPrintModal && "print:hidden")}>
      {/* Top Header & Section Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Timetable & Period Workspace
            </h1>
            {totalClashes > 0 ? (
              <Badge variant="danger" className="gap-1 text-[10px] font-bold">
                <AlertTriangle className="h-3 w-3" />
                <span>{totalClashes} Conflict(s) System-Wide</span>
              </Badge>
            ) : (
              <Badge variant="success" className="gap-1 text-[10px] font-bold">
                <CheckCircle2 className="h-3 w-3" />
                <span>Conflict Free</span>
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any cell to configure subjects, faculty, and room allocations with real-time clash protection.
          </p>
        </div>

        {/* Selector & View Toggle */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("CLASS")}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                viewMode === "CLASS"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Class Timetable
            </button>
            <button
              type="button"
              onClick={() => setViewMode("TEACHER")}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                viewMode === "TEACHER"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Teacher Schedule
            </button>
          </div>

          {/* Conditional Dropdown */}
          {viewMode === "CLASS" ? (
            <div className="flex items-center gap-1.5 min-w-[200px]">
              <SearchableSelect
                options={sectionOptions}
                value={selectedSectionId}
                onChange={(val) => {
                  if (val) router.push(`/timetable?sectionId=${val}`);
                }}
                placeholder="Select section..."
                searchPlaceholder="Search class/section..."
                className="w-full"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-[200px]">
              <SearchableSelect
                options={teacherOptions.filter((t) => t.value !== "")}
                value={selectedTeacherViewId}
                onChange={(val) => val && setSelectedTeacherViewId(val)}
                placeholder="Select faculty member..."
                searchPlaceholder="Search teacher..."
                className="w-full"
              />
            </div>
          )}

          {/* Print Timetable Action Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPrintModal(true)}
            className="text-xs h-9 bg-white border-slate-300 gap-1.5 font-semibold text-slate-700 shadow-xs"
          >
            <Printer className="h-3.5 w-3.5 text-blue-600" />
            <span>Print Timetable</span>
          </Button>
        </div>
      </div>

      {/* In-App Notification Banner */}
      {notification && (
        <ActionBanner
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {/* MODAL: Configure Period Slot */}
      {editingSlotCoord && (
        <form onSubmit={handleSaveSlot} className="p-4 bg-blue-50/60 border border-blue-200 rounded-lg space-y-3 animate-in fade-in shadow-sm">
          <div className="flex items-center justify-between border-b border-blue-100 pb-2">
            <div className="text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-700" />
              <span>
                Configure Period {editingSlotCoord.period} ({DAYS.find((d) => d.id === editingSlotCoord.day)?.name})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setEditingSlotCoord(null)}
              className="text-xs text-slate-400 hover:text-slate-700 p-1"
            >
              ✕
            </button>
          </div>

          {/* Real-time Conflict Warning in Modal */}
          {modalClashWarning && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-300 text-xs text-rose-900 flex items-start gap-2 animate-in fade-in">
              <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Faculty Collision Warning: </span>
                {modalClashWarning.teacherName} is ALREADY scheduled in{" "}
                <strong>
                  {modalClashWarning.className} - Section {modalClashWarning.sectionName}
                </strong>{" "}
                for <em>"{modalClashWarning.subject}"</em> (Room {modalClashWarning.room || "General"}) during this exact period!
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Subject</label>
              <SearchableSelect
                options={subjectOptions}
                value={selectedSubjectId}
                onChange={setSelectedSubjectId}
                placeholder="Search subject..."
                searchPlaceholder="Type subject code or name..."
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Faculty / Teacher</label>
              <SearchableSelect
                options={teacherOptions}
                value={selectedTeacherId}
                onChange={setSelectedTeacherId}
                placeholder="Search faculty..."
                searchPlaceholder="Type teacher name or email..."
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Classroom / Room No</label>
              <Input
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                className="text-xs bg-white h-9"
                placeholder="e.g. Room 204 or Lab 1"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-blue-100">
            {editingSlotCoord.existingSlot ? (
              <Button
                size="sm"
                variant="destructive"
                type="button"
                onClick={() => setClearingSlot(editingSlotCoord.existingSlot!)}
                disabled={isProcessing}
                className="text-xs h-8"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear Slot
              </Button>
            ) : <div />}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => setEditingSlotCoord(null)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                disabled={isProcessing}
                className="text-xs h-8 bg-blue-700 hover:bg-blue-800 text-white font-semibold"
              >
                {isProcessing ? "Saving..." : "Save Period Slot"}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Detailed Clash Alert Banner showing EXACT conflicting class and section */}
      {activeSectionClashes.length > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-lg p-3.5 text-xs text-rose-950 shadow-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-rose-900">
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
            <span>Faculty Scheduling Conflict(s) in this Section ({activeSectionClashes.length}):</span>
          </div>
          <div className="space-y-1.5 pl-6">
            {activeSectionClashes.map((c, idx) => (
              <div key={idx} className="flex items-center gap-2 text-rose-900">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600 shrink-0" />
                <div>
                  <strong>{c.teacherName}</strong> is assigned here in <strong>Period {c.period} ({c.dayName})</strong>, but is also assigned to{" "}
                  <strong className="underline underline-offset-2">
                    {c.otherClass} - Section {c.otherSection}
                  </strong>{" "}
                  for <em>"{c.otherSubject}"</em> (Room {c.otherRoom || "General"}).
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Master Period Grid */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Calendar className="h-4 w-4 text-blue-700" />
            <span>Weekly Master Period Grid</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            7 Periods Daily • Click Any Cell to Assign/Edit
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-50/80">
                <TableHead className="w-28 font-bold text-slate-700">Day</TableHead>
                {PERIODS.map((p) => (
                  <TableHead key={p} className="text-center font-bold text-slate-700 min-w-[130px]">
                    <div>Period {p}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {p === 1 && "08:00 - 08:45"}
                      {p === 2 && "08:45 - 09:30"}
                      {p === 3 && "09:45 - 10:30"}
                      {p === 4 && "10:30 - 11:15"}
                      {p === 5 && "11:45 - 12:30"}
                      {p === 6 && "12:30 - 01:15"}
                      {p === 7 && "01:15 - 02:00"}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {DAYS.map((d) => (
                <TableRow key={d.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                  <TableCell className="font-bold text-xs text-slate-900 bg-slate-50/50">
                    {d.name}
                  </TableCell>
                  {PERIODS.map((p) => {
                    const slot = slotGrid[`${d.id}_${p}`];
                    const clashDetails = slot ? clashesMap[slot.id] : null;
                    const hasClash = clashDetails && clashDetails.length > 0;

                    if (!slot) {
                      return (
                        <TableCell
                          key={p}
                          onClick={() => handleOpenSlotModal(d.id, p)}
                          className="text-center p-2.5 border-r border-slate-100 cursor-pointer hover:bg-blue-50/50 transition-colors"
                        >
                          <span className="text-[11px] text-slate-300 font-medium italic">
                            Free Slot
                          </span>
                        </TableCell>
                      );
                    }

                    return (
                      <TableCell
                        key={p}
                        onClick={() => handleOpenSlotModal(d.id, p)}
                        className={`text-center p-2 border-r border-slate-100 transition-colors cursor-pointer ${
                          hasClash
                            ? "bg-rose-50/90 border-rose-300 hover:bg-rose-100/90"
                            : "bg-white hover:bg-blue-50/50"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="font-bold text-xs text-slate-900 leading-tight">
                            {slot.subjectName}
                          </div>
                          {viewMode === "TEACHER" ? (
                            <div className="text-[11px] font-bold text-emerald-800 flex items-center justify-center gap-1 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                              <span>{slot.className} ({slot.sectionName})</span>
                            </div>
                          ) : (
                            <div className="text-[11px] font-semibold text-blue-900 flex items-center justify-center gap-1">
                              <span>{slot.teacherName || "Unassigned"}</span>
                            </div>
                          )}
                          {slot.roomNo && (
                            <div className="text-[10px] text-slate-400 font-tabular font-mono">
                              {slot.roomNo}
                            </div>
                          )}

                          {/* Explicit Conflicting Class Tag */}
                          {hasClash && clashDetails && (
                            <div className="mt-1 space-y-0.5">
                              <Badge
                                variant="danger"
                                className="text-[9px] py-0.5 px-1 font-bold block truncate"
                                title={`Collides with ${clashDetails[0].otherClass} - Sec ${clashDetails[0].otherSection} (${clashDetails[0].otherSubject})`}
                              >
                                ⚠️ Clash: {clashDetails[0].otherClass}-{clashDetails[0].otherSection}
                              </Badge>
                              <div className="text-[9px] text-rose-700 font-medium truncate">
                                Room: {clashDetails[0].otherRoom || "General"}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Daily Substitution Manager */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-700" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Daily Faculty Substitution Engine
              </h2>
              <p className="text-xs text-slate-500">
                Real-time proxy teacher arrangement for faculty on leave today ({todayStr}).
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setShowSubModal(true)}
            disabled={isYearLocked}
            className="text-xs bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white font-semibold gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Arrange Substitution</span>
          </Button>
        </div>

        {/* Modal: Manual Substitution */}
        {showSubModal && (
          <form onSubmit={handleSaveSubstitution} className="p-4 bg-slate-50 border border-slate-300 rounded-lg space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Assign Emergency Substitution
              </h3>
              <button
                type="button"
                onClick={() => setShowSubModal(false)}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Absent Teacher
                </label>
                <SearchableSelect
                  options={teacherOptions.filter((t) => t.value !== "")}
                  value={subAbsentTeacherId}
                  onChange={setSubAbsentTeacherId}
                  placeholder="Select absent faculty..."
                  searchPlaceholder="Search absent teacher..."
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Substitute Teacher
                </label>
                <SearchableSelect
                  options={teacherOptions.filter((t) => t.value !== "" && t.value !== subAbsentTeacherId)}
                  value={subSubstituteTeacherId}
                  onChange={setSubSubstituteTeacherId}
                  placeholder="Select substitute faculty..."
                  searchPlaceholder="Search substitute teacher..."
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Target Period Slot
                </label>
                <SearchableSelect
                  options={slots.map((s) => ({
                    value: s.id,
                    label: `Day ${s.dayOfWeek}, Period ${s.periodNo}: ${s.subjectName}`,
                    sublabel: s.teacherName ? `Teacher: ${s.teacherName}` : "Unassigned",
                    badge: `P${s.periodNo}`,
                  }))}
                  value={subPeriodSlotId}
                  onChange={setSubPeriodSlotId}
                  placeholder="Select period slot..."
                  searchPlaceholder="Search period..."
                />
              </div>
            </div>

            {/* Free Teacher Availability Finder */}
            {targetSubSlot && (
              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Available Faculty in Day {targetSubSlot.dayOfWeek}, Period {targetSubSlot.periodNo}
                  </span>
                  <Badge variant="success" className="text-[10px]">
                    {freeTeachersForSub.length} Teachers Free
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {freeTeachersForSub.length > 0 ? (
                    freeTeachersForSub.slice(0, 8).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSubSubstituteTeacherId(t.id)}
                        className={`text-xs px-2.5 py-1 rounded-md border text-left transition-all flex items-center gap-1.5 ${
                          subSubstituteTeacherId === t.id
                            ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-500"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>{t.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">Available</span>
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      All teaching faculty have classes assigned in this period.
                    </span>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block">
                Administrative Notes
              </label>
              <Input
                value={subNotes}
                onChange={(e) => setSubNotes(e.target.value)}
                className="text-xs mt-1 bg-white h-8"
                placeholder="Reason or instructions for substitute"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => setShowSubModal(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                disabled={isProcessing}
                className="text-xs h-8 bg-blue-700 hover:bg-blue-800 text-white font-semibold"
              >
                {isProcessing ? "Confirming..." : "Confirm Substitution"}
              </Button>
            </div>
          </form>
        )}

        {/* Existing Active Substitutions Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-50">
                <TableHead className="font-bold text-slate-700">Date</TableHead>
                <TableHead className="font-bold text-slate-700">Absent Faculty</TableHead>
                <TableHead className="font-bold text-slate-700">Substitute Faculty</TableHead>
                <TableHead className="font-bold text-slate-700">Status</TableHead>
                <TableHead className="font-bold text-slate-700">Coverage Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeSubs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-slate-400 text-xs italic">
                    No faculty substitutions active for today. All scheduled teachers are present.
                  </TableCell>
                </TableRow>
              ) : (
                activeSubs.map((sub) => (
                  <TableRow key={sub.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-xs text-slate-800">
                      {sub.date}
                    </TableCell>
                    <TableCell className="font-semibold text-xs text-rose-700">
                      {sub.absentTeacherName}
                    </TableCell>
                    <TableCell className="font-semibold text-xs text-emerald-700">
                      {sub.substituteTeacherName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="warning" className="text-[10px]">
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {sub.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Reusable Confirm Dialog for Clearing Slot */}
      <ConfirmDialog
        isOpen={!!clearingSlot}
        onClose={() => setClearingSlot(null)}
        onConfirm={handleConfirmClearSlot}
        title="Clear Period Slot"
        description={
          clearingSlot ? (
            <span>
              Are you sure you want to clear Period {clearingSlot.periodNo} ({clearingSlot.subjectName})? The assigned faculty and classroom allocation will be removed.
            </span>
          ) : ""
        }
        confirmText="Clear Slot"
        variant="danger"
        isLoading={isProcessing}
      />
      </div>

      {/* Printable Weekly Timetable Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:static print:inset-auto print:p-0 print:m-0 print:bg-white print:overflow-visible print:block print:w-full">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 print:max-w-none print:w-full print:shadow-none print:border-none print:rounded-none print:p-0 print:m-0 print:overflow-visible">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Printer className="h-4 w-4 text-blue-400" />
                  Official Weekly Timetable (Classroom Wall Post)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {viewMode === "CLASS"
                    ? `Master Timetable for ${allSections.find((s) => s.id === selectedSectionId)?.className} - Section ${allSections.find((s) => s.id === selectedSectionId)?.name}`
                    : `Faculty Schedule for ${allTeachers.find((t) => t.id === selectedTeacherViewId)?.name || "Faculty"}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handlePrintTimetable}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs h-8 gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print / Save PDF
                </Button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Document Body */}
            <div className="p-8 overflow-y-auto space-y-6 text-slate-800 bg-white print:p-0 print:m-0 print:overflow-visible">
              {/* School Letterhead */}
              <div className="text-center border-b-2 border-slate-900 pb-4">
                <h2 className="text-lg font-black tracking-wide uppercase text-slate-900">
                  CRESCENT MATRICULATION HIGHER SECONDARY SCHOOL
                </h2>
                <p className="text-[11px] text-slate-600">
                  Affiliated to Tamil Nadu State Board • Chromepet, Chennai - 600045
                </p>
                <div className="mt-2 inline-block px-4 py-1 bg-slate-100 border border-slate-300 rounded font-bold text-xs uppercase tracking-wider text-slate-900">
                  {viewMode === "CLASS"
                    ? `WEEKLY CLASS TIMETABLE — ${allSections.find((s) => s.id === selectedSectionId)?.className} (SECTION ${allSections.find((s) => s.id === selectedSectionId)?.name})`
                    : `FACULTY WORKLOAD SCHEDULE — ${allTeachers.find((t) => t.id === selectedTeacherViewId)?.name || "Faculty"}`}
                </div>
              </div>

              {/* Timetable Matrix */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="p-2 border-r border-slate-300 font-bold text-left w-24">Day / Period</th>
                      {PERIODS.map((p) => (
                        <th key={p} className="p-2 border-r border-slate-300 font-bold text-center">
                          Period {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((d) => (
                      <tr key={d.id} className="border-b border-slate-200">
                        <td className="p-2.5 font-bold bg-slate-50 border-r border-slate-300">
                          {d.name}
                        </td>
                        {PERIODS.map((p) => {
                          const slot = slotGrid[`${d.id}_${p}`];
                          if (!slot) {
                            return (
                              <td key={p} className="p-2 text-center border-r border-slate-200 text-slate-300 italic">
                                —
                              </td>
                            );
                          }
                          return (
                            <td key={p} className="p-2 text-center border-r border-slate-200">
                              <div className="font-bold text-slate-900">{slot.subjectName}</div>
                              <div className="text-[11px] text-slate-600">
                                {viewMode === "TEACHER"
                                  ? `${slot.className} - ${slot.sectionName}`
                                  : slot.teacherName || "Faculty"}
                              </div>
                              {slot.roomNo && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {slot.roomNo}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-12 pt-8">
                <div className="border-t border-slate-400 pt-1 text-center">
                  <span className="block font-semibold text-slate-800 text-[11px]">Academic Timetable Coordinator</span>
                </div>
                <div className="border-t border-slate-400 pt-1 text-center">
                  <span className="block font-serif italic font-bold text-slate-900 text-[12px]">Dr. K. R. Ramanathan</span>
                  <span className="block font-semibold text-slate-800 text-[11px]">Principal / Head of Institution</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end print:hidden">
              <Button size="sm" variant="outline" onClick={() => setShowPrintModal(false)} className="text-xs h-8">
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

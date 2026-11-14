"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Plus,
  Copy,
  Layers,
  BookOpen,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Lock,
  Unlock,
  ShieldAlert,
  Pencil,
  Trash2,
  Check,
  X,
  BookmarkCheck,
  GraduationCap,
  Paperclip,
  FileSpreadsheet,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  cloneAcademicYearStructure,
  toggleAcademicYearLock,
  createClassAndSection,
  updateClass,
  deleteClass,
  addSection,
  updateSection,
  deleteSection,
  createMasterSubject,
  updateMasterSubject,
  deleteMasterSubject,
  assignClassSubjects,
  createScheduledHoliday,
  deleteHoliday,
  declareEmergencyHoliday,
  createAcademicYear,
  getSectionEnrollmentsForPromotion,
  promoteSectionStudents,
  createDailyHomework,
  deleteDailyHomework,
} from "@/actions/academics";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionBanner } from "@/components/ui/action-banner";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { SearchableSelect, SearchOption } from "@/components/ui/searchable-select";

export interface AcademicYearData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "UPCOMING" | "ACTIVE" | "LOCKED";
}

export interface SectionItem {
  id: string;
  name: string;
  capacity: number;
}

export interface ClassData {
  id: string;
  name: string;
  order: number;
  stream: string;
  sections: SectionItem[];
  subjectsCount: number;
  assignedSubjectIds: string[];
}

export interface SubjectData {
  id: string;
  code: string;
  name: string;
  type: string;
  includeInCgpa: boolean;
}

export interface HolidayData {
  id: string;
  date: string;
  title: string;
  isEmergency: boolean;
}

export interface HomeworkItem {
  id: string;
  title: string;
  description: string;
  assignedDate: string;
  dueDate: string;
  attachmentUrl: string | null;
  subjectName: string;
  subjectCode: string;
  sectionName: string;
  createdAt: string;
}

interface AcademicsClientProps {
  academicYears: AcademicYearData[];
  classes: ClassData[];
  subjects: SubjectData[];
  holidays: HolidayData[];
  homeworkList?: HomeworkItem[];
  activeYear: AcademicYearData;
  schoolId: string;
}

export function AcademicsClient({
  academicYears,
  classes,
  subjects,
  holidays,
  homeworkList = [],
  activeYear,
  schoolId,
}: AcademicsClientProps) {
  const router = useRouter();
  const [notification, setNotification] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // In-app Sleek Confirmation Dialog State
  const [confirmAction, setConfirmAction] = React.useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    confirmText?: string;
    variant?: "danger" | "warning" | "primary";
    action: () => Promise<void>;
  } | null>(null);

  // Pagination for Master Subjects & Holidays
  const { paginatedItems: paginatedSubjects, paginationProps: subjectPagination } = usePagination(subjects, 6);
  const { paginatedItems: paginatedHolidays, paginationProps: holidayPagination } = usePagination(holidays, 6);

  // Active Tab
  const [currentTab, setCurrentTab] = React.useState("classes");

  // Lock status
  const isLocked = activeYear.status === "LOCKED";

  // --- Modals / Forms States ---
  // 1. Add Class & Initial Section
  const [showAddClass, setShowAddClass] = React.useState(false);
  const [newClassName, setNewClassName] = React.useState("");
  const [newClassOrder, setNewClassOrder] = React.useState("11");
  const [newClassStream, setNewClassStream] = React.useState<"GENERAL" | "SCIENCE" | "COMMERCE" | "ARTS">("GENERAL");
  const [newSectionName, setNewSectionName] = React.useState("A");
  const [newSectionCapacity, setNewSectionCapacity] = React.useState("40");

  // 2. Edit Class
  const [editingClass, setEditingClass] = React.useState<ClassData | null>(null);
  const [editClassName, setEditClassName] = React.useState("");
  const [editClassOrder, setEditClassOrder] = React.useState(1);
  const [editClassStream, setEditClassStream] = React.useState<"GENERAL" | "SCIENCE" | "COMMERCE" | "ARTS">("GENERAL");

  // 3. Add Section to existing class
  const [addingSectionToClass, setAddingSectionToClass] = React.useState<ClassData | null>(null);
  const [subSectionName, setSubSectionName] = React.useState("B");
  const [subSectionCap, setSubSectionCap] = React.useState("40");

  // 4. Edit Section Capacity
  const [editingSection, setEditingSection] = React.useState<SectionItem | null>(null);
  const [editSecName, setEditSecName] = React.useState("");
  const [editSecCapacity, setEditSecCapacity] = React.useState("40");

  // 5. Add / Edit Master Subject
  const [showAddSubject, setShowAddSubject] = React.useState(false);
  const [editingSubject, setEditingSubject] = React.useState<SubjectData | null>(null);
  const [subCode, setSubCode] = React.useState("");
  const [subName, setSubName] = React.useState("");
  const [subType, setSubType] = React.useState<"CORE" | "ELECTIVE" | "CO_SCHOLASTIC">("CORE");
  const [subIncludeCgpa, setSubIncludeCgpa] = React.useState(true);

  // 6. Class-Subject Mapping
  const [mappingClassId, setMappingClassId] = React.useState<string>(classes[0]?.id || "");
  const selectedClassForMapping = classes.find((c) => c.id === mappingClassId) || classes[0];
  const [selectedSubjectIds, setSelectedSubjectIds] = React.useState<string[]>(
    selectedClassForMapping?.assignedSubjectIds || []
  );

  React.useEffect(() => {
    if (selectedClassForMapping) {
      setSelectedSubjectIds(selectedClassForMapping.assignedSubjectIds || []);
    }
  }, [mappingClassId, classes]);

  // 7. Holidays (Scheduled vs Emergency)
  const [showScheduledHolidayModal, setShowScheduledHolidayModal] = React.useState(false);
  const [holidayStartDate, setHolidayStartDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [holidayEndDate, setHolidayEndDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [holidayTitle, setHolidayTitle] = React.useState("Pongal Festival Holidays");

  const [showEmergencyModal, setShowEmergencyModal] = React.useState(false);
  const [emergencyDate, setEmergencyDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [emergencyReason, setEmergencyReason] = React.useState("Heavy Rain / Cyclone Warning declared by District Collector");

  // 8. Add Academic Year
  const [showAddYearModal, setShowAddYearModal] = React.useState(false);
  const [newYearName, setNewYearName] = React.useState("2027-2028");
  const [newYearStartDate, setNewYearStartDate] = React.useState("2027-06-01");
  const [newYearEndDate, setNewYearEndDate] = React.useState("2028-04-30");

  // 9. Promote Section Wizard
  const [showPromoteModal, setShowPromoteModal] = React.useState(false);
  const allSectionsList = React.useMemo(() => {
    const list: Array<{ id: string; label: string; classId: string; className: string; name: string; capacity: number }> = [];
    for (const c of classes) {
      for (const s of c.sections) {
        list.push({
          id: s.id,
          label: `${c.name} - Sec ${s.name}`,
          classId: c.id,
          className: c.name,
          name: s.name,
          capacity: s.capacity,
        });
      }
    }
    return list;
  }, [classes]);

  const [promoteFromSectionId, setPromoteFromSectionId] = React.useState(allSectionsList[0]?.id || "");
  const [promoteToYearId, setPromoteToYearId] = React.useState(activeYear.id);
  const [promoteToClassId, setPromoteToClassId] = React.useState(classes[0]?.id || "");
  const [promoteToSectionId, setPromoteToSectionId] = React.useState(classes[0]?.sections[0]?.id || "");
  const [promoteStudents, setPromoteStudents] = React.useState<
    Array<{
      enrollmentId: string;
      studentId: string;
      admissionNo: string;
      name: string;
      rollNo: number | null;
      decision: "PROMOTED" | "DETAINED";
    }>
  >([]);
  const [isLoadingStudents, setIsLoadingStudents] = React.useState(false);
  const [isPromoting, setIsPromoting] = React.useState(false);

  const loadSectionStudents = async (sectionId: string) => {
    setIsLoadingStudents(true);
    try {
      const res = await getSectionEnrollmentsForPromotion({
        schoolId,
        academicYearId: activeYear.id,
        sectionId,
      });
      setPromoteStudents(
        res.map((s) => ({
          enrollmentId: s.enrollmentId,
          studentId: s.studentId,
          admissionNo: s.admissionNo,
          name: `${s.firstName} ${s.lastName}`,
          rollNo: s.rollNo,
          decision: "PROMOTED",
        }))
      );
    } catch (err: any) {
      notify("error", err.message || "Failed to load section students.");
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const openPromoteModal = () => {
    const defaultSecId = allSectionsList[0]?.id || "";
    setPromoteFromSectionId(defaultSecId);
    setPromoteToYearId(activeYear.id);
    if (classes.length > 0) {
      setPromoteToClassId(classes[0].id);
      setPromoteToSectionId(classes[0].sections[0]?.id || "");
    }
    setShowPromoteModal(true);
    if (defaultSecId) {
      loadSectionStudents(defaultSecId);
    }
  };

  const handleToggleDecision = (enrollmentId: string) => {
    setPromoteStudents((prev) =>
      prev.map((s) =>
        s.enrollmentId === enrollmentId
          ? { ...s, decision: s.decision === "PROMOTED" ? "DETAINED" : "PROMOTED" }
          : s
      )
    );
  };

  const handleBulkDecision = (decision: "PROMOTED" | "DETAINED") => {
    setPromoteStudents((prev) => prev.map((s) => ({ ...s, decision })));
  };

  const handleExecutePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (promoteStudents.length === 0) {
      notify("error", "No students available to promote in selected section.");
      return;
    }
    if (!promoteToSectionId) {
      notify("error", "Please select a target section.");
      return;
    }
    setIsPromoting(true);
    try {
      const res = await promoteSectionStudents({
        schoolId,
        fromAcademicYearId: activeYear.id,
        fromSectionId: promoteFromSectionId,
        toAcademicYearId: promoteToYearId,
        toClassId: promoteToClassId,
        toSectionId: promoteToSectionId,
        studentDecisions: promoteStudents.map((s) => ({
          studentId: s.studentId,
          enrollmentId: s.enrollmentId,
          decision: s.decision,
        })),
      });
      if (res.success) {
        notify(
          "success",
          `Section promotion completed: ${res.promotedCount} students promoted to ${res.targetSectionName}, ${res.detainedCount} detained.`
        );
        setShowPromoteModal(false);
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Section promotion failed.");
    } finally {
      setIsPromoting(false);
    }
  };

  // 10. Daily Homework Diary State (Feature 11)
  const [homeworkData, setHomeworkData] = React.useState<HomeworkItem[]>(homeworkList);
  React.useEffect(() => {
    setHomeworkData(homeworkList);
  }, [homeworkList]);

  const [showHomeworkModal, setShowHomeworkModal] = React.useState(false);
  const [hwSectionId, setHwSectionId] = React.useState(allSectionsList[0]?.id || "");
  const [hwSubjectId, setHwSubjectId] = React.useState(subjects[0]?.id || "");
  const [hwTitle, setHwTitle] = React.useState("");
  const [hwDescription, setHwDescription] = React.useState("");
  const [hwAssignedDate, setHwAssignedDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [hwDueDate, setHwDueDate] = React.useState(new Date(Date.now() + 86400000).toISOString().split("T")[0]);
  const [hwAttachmentUrl, setHwAttachmentUrl] = React.useState("");

  const handleSaveHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hwTitle.trim() || !hwDescription.trim()) {
      notify("error", "Please enter both homework title and description.");
      return;
    }
    if (!hwSectionId || !hwSubjectId) {
      notify("error", "Please select both target section and subject.");
      return;
    }
    setIsProcessing(true);
    try {
      const res = await createDailyHomework({
        schoolId,
        userId: "usr_principal",
        userRole: "PRINCIPAL",
        academicYearId: activeYear.id,
        sectionId: hwSectionId,
        subjectId: hwSubjectId,
        assignedDate: hwAssignedDate,
        dueDate: hwDueDate,
        title: hwTitle.trim(),
        description: hwDescription.trim(),
        attachmentUrl: hwAttachmentUrl.trim() || undefined,
      });
      if (res.success) {
        notify("success", `Homework "${hwTitle}" posted successfully!`);
        setShowHomeworkModal(false);
        setHwTitle("");
        setHwDescription("");
        setHwAttachmentUrl("");
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to post homework.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteHw = (hwId: string, title: string) => {
    setConfirmAction({
      isOpen: true,
      title: `Delete Homework Assignment: "${title}"`,
      description: "Are you sure you want to delete this homework entry? Parents will no longer see it in their diary feed.",
      confirmText: "Delete Homework",
      variant: "danger",
      action: async () => {
        setIsProcessing(true);
        try {
          const res = await deleteDailyHomework({
            schoolId,
            userId: "usr_principal",
            userRole: "PRINCIPAL",
            homeworkId: hwId,
          });
          if (res.success) {
            notify("success", "Homework entry deleted.");
            router.refresh();
          }
        } catch (err: any) {
          notify("error", err.message || "Failed to delete homework.");
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  // 11. Syllabus Completion Tracker State
  const [syllabusClassId, setSyllabusClassId] = React.useState(classes[0]?.id || "");
  const [syllabusSubjectId, setSyllabusSubjectId] = React.useState(subjects[0]?.id || "");
  const [syllabusUnits, setSyllabusUnits] = React.useState<
    Array<{
      id: string;
      unitNo: number;
      title: string;
      plannedPeriods: number;
      completedPeriods: number;
      targetDate: string;
      status: "COMPLETED" | "IN_PROGRESS" | "NOT_STARTED";
      remarks: string;
    }>
  >([
    {
      id: "u1",
      unitNo: 1,
      title: "Unit 1: Relations, Functions & Sets",
      plannedPeriods: 14,
      completedPeriods: 14,
      targetDate: "2026-08-15",
      status: "COMPLETED",
      remarks: "Completed with unit assessment and remediation",
    },
    {
      id: "u2",
      unitNo: 2,
      title: "Unit 2: Numbers, Sequences & Arithmetic Progressions",
      plannedPeriods: 18,
      completedPeriods: 18,
      targetDate: "2026-09-30",
      status: "COMPLETED",
      remarks: "Covered all textbook exercises and quarterly revision",
    },
    {
      id: "u3",
      unitNo: 3,
      title: "Unit 3: Algebra, Quadratic Equations & Matrices",
      plannedPeriods: 24,
      completedPeriods: 19,
      targetDate: "2026-11-20",
      status: "IN_PROGRESS",
      remarks: "Currently covering matrix determinants and inverse",
    },
    {
      id: "u4",
      unitNo: 4,
      title: "Unit 4: Coordinate Geometry & Straight Lines",
      plannedPeriods: 16,
      completedPeriods: 4,
      targetDate: "2026-12-18",
      status: "IN_PROGRESS",
      remarks: "Introduced slope formula and section formula",
    },
    {
      id: "u5",
      unitNo: 5,
      title: "Unit 5: Trigonometry & Heights and Distances",
      plannedPeriods: 18,
      completedPeriods: 0,
      targetDate: "2027-01-25",
      status: "NOT_STARTED",
      remarks: "Scheduled after winter term evaluation",
    },
    {
      id: "u6",
      unitNo: 6,
      title: "Unit 6: Practical Laboratory Experiments & Record Note",
      plannedPeriods: 12,
      completedPeriods: 8,
      targetDate: "2027-02-15",
      status: "IN_PROGRESS",
      remarks: "Experiments 1-4 completed; observation verified",
    },
  ]);

  const handleIncrementPeriod = (unitId: string) => {
    setSyllabusUnits((prev) =>
      prev.map((u) => {
        if (u.id !== unitId) return u;
        const nextCompleted = Math.min(u.plannedPeriods, u.completedPeriods + 1);
        const nextStatus = nextCompleted >= u.plannedPeriods ? "COMPLETED" : "IN_PROGRESS";
        return {
          ...u,
          completedPeriods: nextCompleted,
          status: nextStatus,
        };
      })
    );
    notify("success", "Incremented taught periods (+1). Syllabus completion updated!");
  };

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const notify = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 6000);
  };

  // Clone Structure
  const handleCloneStructure = () => {
    if (isLocked) {
      notify("error", "Academic year is LOCKED. Unlock first.");
      return;
    }
    const fromYear = academicYears.find((y) => y.id !== activeYear.id);
    if (!fromYear) {
      notify("error", "No other academic year exists to clone from.");
      return;
    }
    setConfirmAction({
      isOpen: true,
      title: "Clone Academic Structure",
      description: `Clone complete class structure, subjects, and fee rules from "${fromYear.name}" into "${activeYear.name}"? Existing duplicates will be safely skipped.`,
      confirmText: "Clone Structure",
      variant: "primary",
      action: async () => {
        setIsProcessing(true);
        try {
          const res = await cloneAcademicYearStructure({
            schoolId,
            userId: "usr_principal",
            sourceYearId: fromYear.id,
            targetYearId: activeYear.id,
          });
          if (res.success) {
            notify("success", `Cloned ${res.clonedSubjectsCount} subject mappings and ${res.clonedFeesCount} fee structures into ${activeYear.name}!`);
            router.refresh();
          }
        } catch (err: any) {
          notify("error", err.message || "Failed to clone structure.");
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  // Toggle Year Lock
  const handleToggleLock = (year: AcademicYearData) => {
    const newStatus = year.status === "LOCKED" ? "ACTIVE" : "LOCKED";
    setConfirmAction({
      isOpen: true,
      title: newStatus === "LOCKED" ? `Lock Academic Year: ${year.name}` : `Activate Academic Year: ${year.name}`,
      description:
        newStatus === "LOCKED"
          ? `Locking ${year.name} puts historical attendance, fee receipts, and marks in strict read-only mode.`
          : `Activating ${year.name} sets it as the primary operating year for daily attendance and fee collections.`,
      confirmText: newStatus === "LOCKED" ? "Lock Year" : "Activate Year",
      variant: newStatus === "LOCKED" ? "warning" : "primary",
      action: async () => {
        try {
          const res = await toggleAcademicYearLock({
            schoolId,
            userId: "usr_principal",
            academicYearId: year.id,
            newStatus,
            reason: `Status toggled to ${newStatus} by administration`,
          });
          if (res.success) {
            notify("success", `Academic Year status updated to ${newStatus}.`);
            router.refresh();
          }
        } catch (err: any) {
          notify("error", "Failed to update status: " + err.message);
        }
      },
    });
  };

  // 1. Create Class & Initial Section
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      notify("error", "Academic year is locked.");
      return;
    }
    setIsProcessing(true);
    try {
      const res = await createClassAndSection({
        schoolId,
        userId: "usr_principal",
        className: newClassName.trim(),
        numericOrder: parseInt(newClassOrder) || 1,
        stream: newClassStream,
        sectionName: newSectionName.trim().toUpperCase(),
        capacity: parseInt(newSectionCapacity) || 40,
      });
      if (res.success) {
        setShowAddClass(false);
        setNewClassName("");
        notify("success", `Class "${newClassName}" & Section "${newSectionName}" created successfully!`);
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to create class.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Update Class
  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    setIsProcessing(true);
    try {
      const res = await updateClass({
        schoolId,
        userId: "usr_principal",
        classId: editingClass.id,
        className: editClassName.trim(),
        numericOrder: Number(editClassOrder),
        stream: editClassStream,
      });
      if (res.success) {
        setEditingClass(null);
        notify("success", `Class "${editClassName}" updated successfully!`);
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to update class.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Delete Class
  const handleDeleteClass = (cls: ClassData) => {
    if (isLocked) {
      notify("error", "Academic year is locked.");
      return;
    }
    setConfirmAction({
      isOpen: true,
      title: `Delete Class: "${cls.name}"`,
      description: `Are you sure you want to delete "${cls.name}"? Active student enrollments will prevent deletion. This action cannot be undone.`,
      confirmText: "Delete Class",
      variant: "danger",
      action: async () => {
        setIsProcessing(true);
        try {
          const res = await deleteClass({
            schoolId,
            userId: "usr_principal",
            classId: cls.id,
          });
          if (res.success) {
            notify("success", `Class "${cls.name}" deleted.`);
            router.refresh();
          }
        } catch (err: any) {
          notify("error", err.message || "Failed to delete class.");
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  // 4. Add Section to Existing Class
  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingSectionToClass) return;
    setIsProcessing(true);
    try {
      const res = await addSection({
        schoolId,
        userId: "usr_principal",
        classId: addingSectionToClass.id,
        name: subSectionName.trim().toUpperCase(),
        capacity: parseInt(subSectionCap) || 40,
      });
      if (res.success) {
        setAddingSectionToClass(null);
        setSubSectionName("B");
        notify("success", `Section "${subSectionName.toUpperCase()}" added to ${addingSectionToClass.name}!`);
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to add section.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Update Section Capacity
  const handleUpdateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection) return;
    setIsProcessing(true);
    try {
      const res = await updateSection({
        schoolId,
        userId: "usr_principal",
        sectionId: editingSection.id,
        name: editSecName.trim().toUpperCase(),
        capacity: parseInt(editSecCapacity) || 40,
      });
      if (res.success) {
        setEditingSection(null);
        notify("success", `Section "${editSecName}" capacity updated to ${editSecCapacity}!`);
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to update section.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. Delete Section
  const handleDeleteSection = (secId: string, secName: string) => {
    if (isLocked) {
      notify("error", "Academic year is locked.");
      return;
    }
    setConfirmAction({
      isOpen: true,
      title: `Delete Section: ${secName}`,
      description: `Are you sure you want to delete Section ${secName}? Enrolled students will prevent deletion.`,
      confirmText: "Delete Section",
      variant: "danger",
      action: async () => {
        setIsProcessing(true);
        try {
          const res = await deleteSection({
            schoolId,
            userId: "usr_principal",
            sectionId: secId,
          });
          if (res.success) {
            setEditingSection(null);
            notify("success", `Section ${secName} deleted.`);
            router.refresh();
          }
        } catch (err: any) {
          notify("error", err.message || "Failed to delete section.");
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  // 7. Master Subjects CRUD
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (editingSubject) {
        const res = await updateMasterSubject({
          schoolId,
          userId: "usr_principal",
          subjectId: editingSubject.id,
          name: subName.trim(),
          code: subCode.trim().toUpperCase(),
          type: subType,
          includeInCgpa: subIncludeCgpa,
        });
        if (res.success) {
          setEditingSubject(null);
          notify("success", `Subject "${subName}" updated!`);
          router.refresh();
        }
      } else {
        const res = await createMasterSubject({
          schoolId,
          userId: "usr_principal",
          name: subName.trim(),
          code: subCode.trim().toUpperCase(),
          type: subType,
          includeInCgpa: subIncludeCgpa,
        });
        if (res.success) {
          setShowAddSubject(false);
          setSubName("");
          setSubCode("");
          notify("success", `New Subject "${subName}" created!`);
          router.refresh();
        }
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to save subject.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSubject = (sub: SubjectData) => {
    if (isLocked) {
      notify("error", "Academic year is locked.");
      return;
    }
    setConfirmAction({
      isOpen: true,
      title: `Delete Master Subject: ${sub.name}`,
      description: `Are you sure you want to delete "${sub.name}" (${sub.code})? It cannot be deleted if currently assigned in any class curriculum.`,
      confirmText: "Delete Subject",
      variant: "danger",
      action: async () => {
        setIsProcessing(true);
        try {
          const res = await deleteMasterSubject({
            schoolId,
            userId: "usr_principal",
            subjectId: sub.id,
          });
          if (res.success) {
            notify("success", `Subject "${sub.name}" deleted.`);
            router.refresh();
          }
        } catch (err: any) {
          notify("error", err.message || "Failed to delete subject.");
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  // 8. Class-Subject Mapping Save
  const handleSaveSubjectMapping = async () => {
    if (!selectedClassForMapping) return;
    if (selectedClassForMapping.sections.length === 0) {
      notify("error", "Class has no sections. Add a section first.");
      return;
    }

    setIsProcessing(true);
    try {
      // Map to each section of this class
      for (const sec of selectedClassForMapping.sections) {
        await assignClassSubjects({
          schoolId,
          userId: "usr_principal",
          academicYearId: activeYear.id,
          sectionId: sec.id,
          subjectIds: selectedSubjectIds,
        });
      }
      notify("success", `Successfully mapped ${selectedSubjectIds.length} subjects to ${selectedClassForMapping.name}!`);
      router.refresh();
    } catch (err: any) {
      notify("error", err.message || "Failed to map subjects.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSubjectForMapping = (subId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subId) ? prev.filter((id) => id !== subId) : [...prev, subId]
    );
  };

  // 9. Scheduled Holiday (Date Range)
  const handleCreateScheduledHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const res = await createScheduledHoliday({
        schoolId,
        userId: "usr_principal",
        academicYearId: activeYear.id,
        startDate: holidayStartDate,
        endDate: holidayEndDate,
        title: holidayTitle.trim(),
      });
      if (res.success) {
        setShowScheduledHolidayModal(false);
        setHolidayTitle("");
        notify("success", `Scheduled holiday "${holidayTitle}" (${res.daysCreated} day(s)) saved to academic calendar!`);
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to schedule holiday.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 10. Emergency Holiday
  const handleDeclareEmergencyHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      notify("error", "Academic year is locked.");
      return;
    }
    setConfirmAction({
      isOpen: true,
      title: `Declare Emergency Holiday: ${emergencyDate}`,
      description: `Declare emergency closure on ${emergencyDate}? Any existing attendance for this date will be permanently deleted and official parent circulars will be queued.`,
      confirmText: "Declare Emergency",
      variant: "danger",
      action: async () => {
        setIsProcessing(true);
        try {
          const res = await declareEmergencyHoliday({
            schoolId,
            userId: "usr_principal",
            academicYearId: activeYear.id,
            date: emergencyDate,
            title: emergencyReason.trim(),
          });
          if (res.success) {
            setShowEmergencyModal(false);
            notify("success", `Emergency holiday declared! Removed ${res.removedAttendanceCount} attendance records for ${emergencyDate}.`);
            router.refresh();
          }
        } catch (err: any) {
          notify("error", err.message || "Failed to declare emergency holiday.");
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  // 11. Delete Holiday
  const handleDeleteHoliday = (h: HolidayData) => {
    setConfirmAction({
      isOpen: true,
      title: `Delete Holiday: "${h.title}"`,
      description: `Remove holiday "${h.title}" on ${h.date}? The day will revert to an instructional school day.`,
      confirmText: "Delete Holiday",
      variant: "warning",
      action: async () => {
        setIsProcessing(true);
        try {
          const res = await deleteHoliday({
            schoolId,
            userId: "usr_principal",
            holidayId: h.id,
          });
          if (res.success) {
            notify("success", `Holiday "${h.title}" deleted.`);
            router.refresh();
          }
        } catch (err: any) {
          notify("error", err.message || "Failed to delete holiday.");
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  // 12. Add Academic Year
  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const res = await createAcademicYear({
        schoolId,
        userId: "usr_principal",
        name: newYearName.trim(),
        startDate: newYearStartDate,
        endDate: newYearEndDate,
        status: "UPCOMING",
      });
      if (res.success) {
        setShowAddYearModal(false);
        notify("success", `Academic Year "${newYearName}" created with status UPCOMING.`);
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to create academic year.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Academic Structure & Setup
            </h1>
            <Badge
              variant={activeYear.status === "ACTIVE" ? "success" : activeYear.status === "LOCKED" ? "warning" : "neutral"}
              className="text-[10px]"
            >
              {activeYear.name} ({activeYear.status})
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure classes, sections, seat capacities, master subjects, subject-to-class curriculum mapping, and calendar holidays.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={openPromoteModal}
            disabled={isProcessing}
            className="gap-1.5 text-xs h-8 font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm shrink-0"
          >
            <GraduationCap className="h-3.5 w-3.5 text-indigo-600" />
            <span>Promote Section Wizard</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCloneStructure}
            disabled={isLocked || isProcessing}
            className="gap-1.5 text-xs h-8 shrink-0"
          >
            <Copy className="h-3.5 w-3.5 text-slate-600" />
            <span>Clone Structure</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setShowAddClass(true)}
            disabled={isLocked}
            className="gap-1.5 text-xs h-8 bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Add Class & Section</span>
          </Button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-3 rounded-md border text-xs flex items-center justify-between gap-2 animate-in fade-in ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-medium"
              : "bg-rose-50 border-rose-300 text-rose-900 font-medium"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* MODAL 1: Add Class & Section */}
      {showAddClass && (
        <form onSubmit={handleCreateClass} className="p-4 bg-slate-50 border border-slate-300 rounded-lg space-y-3 animate-in fade-in shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-blue-600" />
              <span>Create New Class & Initial Section</span>
            </h3>
            <Button size="sm" variant="ghost" type="button" onClick={() => setShowAddClass(false)} className="text-xs h-6 w-6 p-0">
              ✕
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700 block">Class Name</label>
              <Input
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="e.g. Grade 11 Science or Class V"
                className="text-xs mt-1 bg-white"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block">Order (1–12)</label>
              <Input
                type="number"
                value={newClassOrder}
                onChange={(e) => setNewClassOrder(e.target.value)}
                className="text-xs mt-1 bg-white font-tabular"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block">Stream</label>
              <select
                value={newClassStream}
                onChange={(e: any) => setNewClassStream(e.target.value)}
                className="text-xs mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-slate-800"
              >
                <option value="GENERAL">General</option>
                <option value="SCIENCE">Science</option>
                <option value="COMMERCE">Commerce</option>
                <option value="ARTS">Arts</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block">Initial Section</label>
              <Input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="A"
                className="text-xs mt-1 bg-white uppercase font-bold"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="outline" type="button" onClick={() => setShowAddClass(false)} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={isProcessing} className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold">
              {isProcessing ? "Saving..." : "Save Class & Section"}
            </Button>
          </div>
        </form>
      )}

      {/* MODAL 1B: Promote Section Wizard */}
      {showPromoteModal && (
        <form onSubmit={handleExecutePromotion} className="p-5 bg-white border-2 border-indigo-200 rounded-xl space-y-4 shadow-lg animate-in fade-in">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-700">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Promote Section Wizard
                </h3>
                <p className="text-xs text-slate-500">
                  Bulk transition students between academic years and sections with Pass/Repeat toggles
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setShowPromoteModal(false)}
              className="text-xs h-7 w-7 p-0 rounded-full"
            >
              ✕
            </Button>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            {/* Source Section */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Source Section (Active Year)
              </label>
              <select
                value={promoteFromSectionId}
                onChange={(e) => {
                  setPromoteFromSectionId(e.target.value);
                  loadSectionStudents(e.target.value);
                }}
                className="w-full text-xs h-8 border border-slate-300 rounded px-2 bg-white font-semibold text-slate-800"
              >
                {allSectionsList.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.label} (Cap: {sec.capacity})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Academic Year */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Target Academic Year
              </label>
              <select
                value={promoteToYearId}
                onChange={(e) => setPromoteToYearId(e.target.value)}
                className="w-full text-xs h-8 border border-slate-300 rounded px-2 bg-white text-slate-800"
              >
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.name} ({ay.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Class */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Target Class
              </label>
              <select
                value={promoteToClassId}
                onChange={(e) => {
                  setPromoteToClassId(e.target.value);
                  const targetCls = classes.find((c) => c.id === e.target.value);
                  if (targetCls && targetCls.sections.length > 0) {
                    setPromoteToSectionId(targetCls.sections[0].id);
                  }
                }}
                className="w-full text-xs h-8 border border-slate-300 rounded px-2 bg-white text-slate-800"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Section */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Target Section
              </label>
              <select
                value={promoteToSectionId}
                onChange={(e) => setPromoteToSectionId(e.target.value)}
                className="w-full text-xs h-8 border border-slate-300 rounded px-2 bg-white font-semibold text-slate-800"
              >
                {classes
                  .find((c) => c.id === promoteToClassId)
                  ?.sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      Section {sec.name} (Max: {sec.capacity} seats)
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Students Promotion Review Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-800">
                  Enrolled Students ({promoteStudents.length})
                </span>
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                  Pass (Promote): {promoteStudents.filter((s) => s.decision === "PROMOTED").length}
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                  Repeat (Detain): {promoteStudents.filter((s) => s.decision === "DETAINED").length}
                </Badge>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => handleBulkDecision("PROMOTED")}
                  className="text-[11px] h-7 text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                >
                  ✓ Mark All Pass
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => handleBulkDecision("DETAINED")}
                  className="text-[11px] h-7 text-amber-700 hover:bg-amber-50 border-amber-200"
                >
                  ↺ Mark All Repeat
                </Button>
              </div>
            </div>

            {isLoadingStudents ? (
              <div className="p-8 text-center text-xs text-slate-500 italic bg-slate-50 rounded border">
                Loading students for promotion review...
              </div>
            ) : promoteStudents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic bg-slate-50 rounded border">
                No active students currently enrolled in the selected source section.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0">
                    <TableRow>
                      <TableHead className="w-16 text-[11px]">Roll</TableHead>
                      <TableHead className="w-32 text-[11px]">Admission No</TableHead>
                      <TableHead className="text-[11px]">Student Name</TableHead>
                      <TableHead className="w-48 text-right text-[11px]">Promotion Decision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promoteStudents.map((s) => (
                      <TableRow key={s.enrollmentId} className="hover:bg-slate-50/50">
                        <TableCell className="font-mono text-xs text-slate-600">
                          {s.rollNo ?? "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-slate-900">
                          {s.admissionNo}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-900">
                          {s.name}
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleDecision(s.enrollmentId)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-all ${
                              s.decision === "PROMOTED"
                                ? "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-xs"
                                : "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200"
                            }`}
                          >
                            {s.decision === "PROMOTED" ? "✓ Pass (Promote)" : "↺ Repeat (Detain)"}
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <div className="text-xs text-slate-500">
              Target Section Capacity:{" "}
              <strong>
                {classes
                  .find((c) => c.id === promoteToClassId)
                  ?.sections.find((s) => s.id === promoteToSectionId)?.capacity ?? 40}{" "}
                Seats
              </strong>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => setShowPromoteModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                disabled={isPromoting || isLoadingStudents || promoteStudents.length === 0}
                className="text-xs bg-indigo-700 hover:bg-indigo-800 text-white font-semibold gap-1.5 shadow-sm"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                <span>{isPromoting ? "Promoting..." : "Execute Section Promotion"}</span>
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* MODAL 2: Edit Class Modal */}
      {editingClass && (
        <form onSubmit={handleUpdateClass} className="p-4 bg-blue-50/50 border border-blue-200 rounded-lg space-y-3 animate-in fade-in shadow-sm">
          <div className="flex items-center justify-between border-b border-blue-100 pb-2">
            <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
              <Pencil className="h-3.5 w-3.5 text-blue-700" />
              <span>Edit Class: {editingClass.name}</span>
            </h3>
            <Button size="sm" variant="ghost" type="button" onClick={() => setEditingClass(null)} className="text-xs h-6 w-6 p-0">
              ✕
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block">Class Name</label>
              <Input
                value={editClassName}
                onChange={(e) => setEditClassName(e.target.value)}
                className="text-xs mt-1 bg-white"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block">Numeric Order</label>
              <Input
                type="number"
                value={editClassOrder}
                onChange={(e) => setEditClassOrder(parseInt(e.target.value) || 1)}
                className="text-xs mt-1 bg-white font-tabular"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block">Academic Stream</label>
              <select
                value={editClassStream}
                onChange={(e: any) => setEditClassStream(e.target.value)}
                className="text-xs mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-slate-800"
              >
                <option value="GENERAL">General</option>
                <option value="SCIENCE">Science</option>
                <option value="COMMERCE">Commerce</option>
                <option value="ARTS">Arts</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="outline" type="button" onClick={() => setEditingClass(null)} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={isProcessing} className="text-xs bg-blue-700 hover:bg-blue-800 text-white font-semibold">
              {isProcessing ? "Updating..." : "Update Class"}
            </Button>
          </div>
        </form>
      )}

      {/* MODAL 3: Add Section to Existing Class */}
      {addingSectionToClass && (
        <form onSubmit={handleAddSection} className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-3 animate-in fade-in shadow-sm">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
            <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-emerald-700" />
              <span>Add New Section to {addingSectionToClass.name}</span>
            </h3>
            <Button size="sm" variant="ghost" type="button" onClick={() => setAddingSectionToClass(null)} className="text-xs h-6 w-6 p-0">
              ✕
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block">Section Name (e.g. B, C, Rose)</label>
              <Input
                value={subSectionName}
                onChange={(e) => setSubSectionName(e.target.value)}
                className="text-xs mt-1 bg-white uppercase font-bold"
                placeholder="B"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block">Maximum Student Capacity</label>
              <Input
                type="number"
                value={subSectionCap}
                onChange={(e) => setSubSectionCap(e.target.value)}
                className="text-xs mt-1 bg-white font-tabular"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="outline" type="button" onClick={() => setAddingSectionToClass(null)} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={isProcessing} className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
              {isProcessing ? "Adding..." : "Add Section"}
            </Button>
          </div>
        </form>
      )}

      {/* MODAL 4: Edit Section Capacity */}
      {editingSection && (
        <form onSubmit={handleUpdateSection} className="p-4 bg-purple-50/50 border border-purple-200 rounded-lg space-y-3 animate-in fade-in shadow-sm">
          <div className="flex items-center justify-between border-b border-purple-100 pb-2">
            <h3 className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
              <Pencil className="h-3.5 w-3.5 text-purple-700" />
              <span>Edit Section Details: Section {editingSection.name}</span>
            </h3>
            <Button size="sm" variant="ghost" type="button" onClick={() => setEditingSection(null)} className="text-xs h-6 w-6 p-0">
              ✕
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block">Section Name</label>
              <Input
                value={editSecName}
                onChange={(e) => setEditSecName(e.target.value)}
                className="text-xs mt-1 bg-white uppercase font-bold"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block">Max Seat Capacity</label>
              <Input
                type="number"
                value={editSecCapacity}
                onChange={(e) => setEditSecCapacity(e.target.value)}
                className="text-xs mt-1 bg-white font-tabular"
                required
              />
            </div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <Button
              size="sm"
              variant="destructive"
              type="button"
              onClick={() => handleDeleteSection(editingSection.id, editingSection.name)}
              className="text-xs h-7"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete Section
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" type="button" onClick={() => setEditingSection(null)} className="text-xs">
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={isProcessing} className="text-xs bg-purple-700 hover:bg-purple-800 text-white font-semibold">
                {isProcessing ? "Saving..." : "Update Section"}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* TABS CONTAINER */}
      <Tabs defaultValue="classes" value={currentTab} onValueChange={setCurrentTab} className="w-full">
        <div className="overflow-x-auto no-scrollbar pb-1">
          <TabsList className="bg-slate-100 p-1 border border-slate-200 inline-flex flex-nowrap whitespace-nowrap min-w-max">
            <TabsTrigger value="classes" className="gap-1.5 text-xs shrink-0">
              <Layers className="h-3.5 w-3.5" /> Classes & Sections ({classes.length})
            </TabsTrigger>
            <TabsTrigger value="mapping" className="gap-1.5 text-xs shrink-0">
              <BookmarkCheck className="h-3.5 w-3.5" /> Class-Subject Mapping
            </TabsTrigger>
            <TabsTrigger value="subjects" className="gap-1.5 text-xs shrink-0">
              <BookOpen className="h-3.5 w-3.5" /> Master Subjects ({subjects.length})
            </TabsTrigger>
            <TabsTrigger value="homework" className="gap-1.5 text-xs shrink-0">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Daily Homework Diary ({homeworkData.length})
            </TabsTrigger>
            <TabsTrigger value="holidays" className="gap-1.5 text-xs shrink-0">
              <Calendar className="h-3.5 w-3.5" /> Holidays ({holidays.length})
            </TabsTrigger>
            <TabsTrigger value="syllabus" className="gap-1.5 text-xs shrink-0">
              <GraduationCap className="h-3.5 w-3.5" /> Syllabus Tracker
            </TabsTrigger>
            <TabsTrigger value="years" className="gap-1.5 text-xs shrink-0">
              <CalendarDays className="h-3.5 w-3.5" /> Academic Years ({academicYears.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: Classes & Sections */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="classes" className="space-y-4 pt-2">
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50">
                  <TableHead className="font-bold text-slate-700">Class Name</TableHead>
                  <TableHead isNumeric className="font-bold text-slate-700">Order</TableHead>
                  <TableHead className="font-bold text-slate-700">Stream</TableHead>
                  <TableHead className="font-bold text-slate-700">Sections & Capacities</TableHead>
                  <TableHead isNumeric className="font-bold text-slate-700">Mapped Subjects</TableHead>
                  <TableHead className="font-bold text-slate-700">Status</TableHead>
                  <TableHead className="text-right font-bold text-slate-700 pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((cls) => (
                  <TableRow key={cls.id} className="hover:bg-slate-50/70 border-b border-slate-100">
                    <TableCell className="font-bold text-slate-900 text-xs">
                      {cls.name}
                    </TableCell>
                    <TableCell isNumeric className="font-tabular text-xs">{cls.order}</TableCell>
                    <TableCell>
                      <Badge variant="neutral" className="text-[10px] uppercase font-mono">
                        {cls.stream}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5 flex-wrap items-center">
                        {cls.sections.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setEditingSection(s);
                              setEditSecName(s.name);
                              setEditSecCapacity(String(s.capacity));
                            }}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 text-slate-800 rounded text-[11px] font-mono flex items-center gap-1 transition-colors"
                            title={`Section ${s.name} (Max Capacity: ${s.capacity}). Click to edit.`}
                          >
                            <span className="font-bold">Sec {s.name}</span>
                            <span className="text-[10px] text-slate-500">({s.capacity})</span>
                            <Pencil className="h-2.5 w-2.5 text-slate-400 hover:text-blue-600" />
                          </button>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAddingSectionToClass(cls);
                            setSubSectionName("B");
                            setSubSectionCap("40");
                          }}
                          className="h-6 px-1.5 text-[10px] text-blue-700 hover:bg-blue-50 border border-dashed border-blue-200"
                        >
                          <Plus className="h-3 w-3 mr-0.5" />
                          Add Sec
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell isNumeric className="font-tabular text-xs">
                      <span className="font-bold text-blue-900">{cls.subjectsCount}</span>
                      <span className="text-[10px] text-slate-400 ml-1">subjects</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success" className="text-[10px]">
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingClass(cls);
                            setEditClassName(cls.name);
                            setEditClassOrder(cls.order);
                            setEditClassStream(cls.stream as any);
                          }}
                          className="h-7 text-xs px-2 gap-1 text-slate-700 hover:text-blue-700"
                          title="Edit Class details"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteClass(cls)}
                          className="h-7 text-xs px-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50"
                          title="Delete Class"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: Class-Subject Mapping */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="mapping" className="space-y-4 pt-2">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Curriculum Mapping: Assign Master Subjects to Class
                </h3>
                <p className="text-xs text-slate-500">
                  Select a grade level and check off which master subjects form its curriculum for academic year {activeYear.name}.
                </p>
              </div>

              {/* Class Selector SearchableSelect */}
              <div className="flex items-center gap-2 min-w-[260px]">
                <span className="text-xs font-semibold text-slate-700 shrink-0">Select Class:</span>
                <SearchableSelect
                  options={classes.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.stream})`,
                    badge: `Order ${c.order}`,
                  }))}
                  value={mappingClassId}
                  onChange={setMappingClassId}
                  placeholder="Select class..."
                  searchPlaceholder="Search grade..."
                  className="w-full"
                />
              </div>
            </div>

            {/* Checkbox Matrix of Subjects */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {subjects.map((sub) => {
                const isAssigned = selectedSubjectIds.includes(sub.id);
                return (
                  <div
                    key={sub.id}
                    onClick={() => toggleSubjectForMapping(sub.id)}
                    className={`p-3 rounded-lg border cursor-pointer select-none transition-all flex items-start gap-3 ${
                      isAssigned
                        ? "bg-blue-50/70 border-blue-400 shadow-sm"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div
                      className={`h-5 w-5 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                        isAssigned
                          ? "bg-blue-700 border-blue-700 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isAssigned && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </div>

                    <div className="space-y-1 overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-slate-900">
                          {sub.code}
                        </span>
                        <Badge
                          variant={sub.type === "CORE" ? "primary" : "neutral"}
                          className="text-[9px] py-0 px-1"
                        >
                          {sub.type}
                        </Badge>
                      </div>
                      <div className="font-medium text-xs text-slate-800 truncate">
                        {sub.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {sub.includeInCgpa ? "Counts in CGPA" : "Graded Only"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-600">
                <strong>{selectedSubjectIds.length}</strong> of {subjects.length} subjects selected for{" "}
                <strong>{selectedClassForMapping?.name}</strong>.
              </div>
              <Button
                size="sm"
                onClick={handleSaveSubjectMapping}
                disabled={isLocked || isProcessing}
                className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-4"
              >
                {isProcessing ? "Saving Mappings..." : "Save Assigned Subjects"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: Master Subjects Catalog */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="subjects" className="space-y-4 pt-2">
          {/* Header & Add Button */}
          <div className="flex items-center justify-between bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
            <div className="text-xs text-slate-600">
              Universal subject catalog. Define academic courses with curriculum classification and CGPA calculation rules.
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingSubject(null);
                setSubCode("");
                setSubName("");
                setSubType("CORE");
                setSubIncludeCgpa(true);
                setShowAddSubject(true);
              }}
              disabled={isLocked}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold gap-1.5 h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Add Master Subject</span>
            </Button>
          </div>

          {/* Add / Edit Subject Form */}
          {(showAddSubject || editingSubject) && (
            <form onSubmit={handleSaveSubject} className="p-4 bg-slate-50 border border-slate-300 rounded-lg space-y-3 animate-in fade-in shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                  <span>{editingSubject ? `Edit Subject: ${editingSubject.name}` : "Create Master Subject"}</span>
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setShowAddSubject(false);
                    setEditingSubject(null);
                  }}
                  className="text-xs h-6 w-6 p-0"
                >
                  ✕
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">Subject Code</label>
                  <Input
                    value={subCode}
                    onChange={(e) => setSubCode(e.target.value)}
                    placeholder="e.g. FREN-01 or ROB-01"
                    className="text-xs mt-1 bg-white font-mono uppercase"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-700 block">Subject Name</label>
                  <Input
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    placeholder="e.g. French Language / Robotics & AI"
                    className="text-xs mt-1 bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">Classification</label>
                  <select
                    value={subType}
                    onChange={(e: any) => setSubType(e.target.value)}
                    className="text-xs mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-slate-800"
                  >
                    <option value="CORE">CORE</option>
                    <option value="ELECTIVE">ELECTIVE</option>
                    <option value="CO_SCHOLASTIC">CO_SCHOLASTIC</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="includeCgpa"
                  checked={subIncludeCgpa}
                  onChange={(e) => setSubIncludeCgpa(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <label htmlFor="includeCgpa" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Include marks in Cumulative Grade Point Average (CGPA) / Percentage calculation
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setShowAddSubject(false);
                    setEditingSubject(null);
                  }}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={isProcessing} className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold">
                  {isProcessing ? "Saving..." : editingSubject ? "Update Subject" : "Create Subject"}
                </Button>
              </div>
            </form>
          )}

          {/* Subjects Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50">
                  <TableHead className="font-bold text-slate-700">Subject Code</TableHead>
                  <TableHead className="font-bold text-slate-700">Subject Name</TableHead>
                  <TableHead className="font-bold text-slate-700">Type</TableHead>
                  <TableHead className="font-bold text-slate-700">CGPA Inclusion</TableHead>
                  <TableHead className="text-right font-bold text-slate-700 pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSubjects.map((sub) => (
                  <TableRow key={sub.id} className="hover:bg-slate-50/70 border-b border-slate-100">
                    <TableCell className="font-mono text-xs font-bold text-blue-950">
                      {sub.code}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900 text-xs">{sub.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          sub.type === "CORE"
                            ? "primary"
                            : sub.type === "ELECTIVE"
                            ? "interactive"
                            : "neutral"
                        }
                        className="text-[10px]"
                      >
                        {sub.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sub.includeInCgpa ? (
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <Check className="h-3 w-3" /> Yes (Weighted)
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Graded Only</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingSubject(sub);
                            setSubCode(sub.code);
                            setSubName(sub.name);
                            setSubType(sub.type as any);
                            setSubIncludeCgpa(sub.includeInCgpa);
                            setShowAddSubject(false);
                          }}
                          className="h-7 text-xs px-2 gap-1 text-slate-700 hover:text-blue-700"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteSubject(sub)}
                          className="h-7 text-xs px-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination {...subjectPagination} />
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: Daily Homework Diary (Feature 11) */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="homework" className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Subject teachers post daily homework assignments directly synchronized with the Parent Portal Diary.
            </p>
            <Button
              size="sm"
              onClick={() => setShowHomeworkModal(!showHomeworkModal)}
              disabled={isLocked}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Post Daily Homework
            </Button>
          </div>

          {showHomeworkModal && (
            <form onSubmit={handleSaveHomework} className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 space-y-3">
              <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                Assign Daily Subject Homework
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">Class & Section *</label>
                  <select
                    value={hwSectionId}
                    onChange={(e) => setHwSectionId(e.target.value)}
                    className="w-full text-xs h-8 border border-slate-300 rounded px-2 bg-white mt-1"
                    required
                  >
                    {allSectionsList.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">Subject *</label>
                  <select
                    value={hwSubjectId}
                    onChange={(e) => setHwSubjectId(e.target.value)}
                    className="w-full text-xs h-8 border border-slate-300 rounded px-2 bg-white mt-1"
                    required
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code} - {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">Assigned Date *</label>
                  <Input
                    type="date"
                    value={hwAssignedDate}
                    onChange={(e) => setHwAssignedDate(e.target.value)}
                    className="text-xs mt-1 bg-white font-tabular"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">Due Date *</label>
                  <Input
                    type="date"
                    value={hwDueDate}
                    onChange={(e) => setHwDueDate(e.target.value)}
                    className="text-xs mt-1 bg-white font-tabular"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">Homework Title / Exercise *</label>
                  <Input
                    placeholder="e.g. Exercise 4.2 - Quadratic Equations (Q1 to Q10)"
                    value={hwTitle}
                    onChange={(e) => setHwTitle(e.target.value)}
                    className="text-xs mt-1 bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">Attachment Link (Optional)</label>
                  <Input
                    placeholder="https://drive.google.com/... or worksheet link"
                    value={hwAttachmentUrl}
                    onChange={(e) => setHwAttachmentUrl(e.target.value)}
                    className="text-xs mt-1 bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block">Instructions & Notes *</label>
                <textarea
                  placeholder="Detail instructions for students and parents..."
                  value={hwDescription}
                  onChange={(e) => setHwDescription(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded p-2 bg-white mt-1 h-18 resize-none"
                  rows={2}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="outline" type="button" onClick={() => setShowHomeworkModal(false)} className="text-xs">
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={isProcessing} className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                  {isProcessing ? "Publishing..." : "Publish Homework to Parents"}
                </Button>
              </div>
            </form>
          )}

          {/* Homework Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50">
                  <TableHead className="font-bold text-slate-700">Assigned</TableHead>
                  <TableHead className="font-bold text-slate-700">Due Date</TableHead>
                  <TableHead className="font-bold text-slate-700">Class & Section</TableHead>
                  <TableHead className="font-bold text-slate-700">Subject</TableHead>
                  <TableHead className="font-bold text-slate-700">Homework Task</TableHead>
                  <TableHead className="font-bold text-slate-700">Attachment</TableHead>
                  <TableHead className="text-right font-bold text-slate-700 pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {homeworkData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-500">
                      No daily homework posted yet for this academic year. Click "Post Daily Homework" above to assign.
                    </TableCell>
                  </TableRow>
                ) : (
                  homeworkData.map((hw) => (
                    <TableRow key={hw.id} className="hover:bg-slate-50 border-b border-slate-100">
                      <TableCell className="font-mono text-xs text-slate-700">{hw.assignedDate}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-rose-700">{hw.dueDate}</TableCell>
                      <TableCell className="text-xs font-bold text-slate-900">{hw.sectionName}</TableCell>
                      <TableCell>
                        <Badge variant="neutral" className="text-[10px] font-mono mr-1">
                          {hw.subjectCode}
                        </Badge>
                        <span className="text-xs text-slate-700">{hw.subjectName}</span>
                      </TableCell>
                      <TableCell className="text-xs max-w-xs">
                        <div className="font-semibold text-slate-900 truncate">{hw.title}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">{hw.description}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {hw.attachmentUrl ? (
                          <a
                            href={hw.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 text-[11px]"
                          >
                            <Paperclip className="h-3 w-3" /> View Doc
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteHw(hw.id, hw.title)}
                          disabled={isLocked || isProcessing}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: Holidays (Scheduled vs Emergency) */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="holidays" className="space-y-4 pt-2">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
            <div className="text-xs text-slate-600">
              Declare planned calendar holidays (with date ranges) or official emergency storm/closure mandates.
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowScheduledHolidayModal(true)}
                disabled={isLocked}
                className="text-xs text-emerald-800 border-emerald-300 hover:bg-emerald-50 gap-1.5 h-8 font-semibold"
              >
                <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                <span>+ Add Scheduled Holiday</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEmergencyModal(true)}
                disabled={isLocked}
                className="text-xs text-red-700 border-red-300 hover:bg-red-50 gap-1.5 h-8 font-semibold"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                <span>+ Declare Emergency Closure</span>
              </Button>
            </div>
          </div>

          {/* Form: Scheduled Holiday with Date Range */}
          {showScheduledHolidayModal && (
            <form onSubmit={handleCreateScheduledHoliday} className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-3 animate-in fade-in shadow-sm">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs uppercase tracking-wider">
                  <Calendar className="h-4 w-4 text-emerald-700" />
                  <span>Schedule Planned Holiday / Vacation Range</span>
                </div>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowScheduledHolidayModal(false)} className="text-xs h-6 w-6 p-0">
                  ✕
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">Start Date</label>
                  <Input
                    type="date"
                    value={holidayStartDate}
                    onChange={(e) => setHolidayStartDate(e.target.value)}
                    className="text-xs mt-1 bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">End Date (Optional)</label>
                  <Input
                    type="date"
                    value={holidayEndDate}
                    onChange={(e) => setHolidayEndDate(e.target.value)}
                    className="text-xs mt-1 bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">Holiday Title</label>
                  <Input
                    value={holidayTitle}
                    onChange={(e) => setHolidayTitle(e.target.value)}
                    placeholder="e.g. Pongal & Makar Sankranti"
                    className="text-xs mt-1 bg-white"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="outline" type="button" onClick={() => setShowScheduledHolidayModal(false)} className="text-xs">
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={isProcessing} className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
                  {isProcessing ? "Saving..." : "Save Scheduled Holiday"}
                </Button>
              </div>
            </form>
          )}

          {/* Form: Emergency Holiday Modal */}
          {showEmergencyModal && (
            <form onSubmit={handleDeclareEmergencyHoliday} className="p-4 bg-red-50 border border-red-300 rounded-lg space-y-3 animate-in fade-in shadow-sm">
              <div className="flex items-center justify-between border-b border-red-200 pb-2">
                <div className="flex items-center gap-2 text-red-900 font-bold text-xs uppercase tracking-wider">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  <span>Declare Emergency Holiday & Cancel Attendance</span>
                </div>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowEmergencyModal(false)} className="text-xs h-6 w-6 p-0">
                  ✕
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">Date</label>
                  <Input
                    type="date"
                    value={emergencyDate}
                    onChange={(e) => setEmergencyDate(e.target.value)}
                    className="text-xs mt-1 bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">Emergency Reason / Title</label>
                  <Input
                    value={emergencyReason}
                    onChange={(e) => setEmergencyReason(e.target.value)}
                    placeholder="e.g. Heavy Rain / Cyclone Alert"
                    className="text-xs mt-1 bg-white"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="outline" type="button" onClick={() => setShowEmergencyModal(false)} className="text-xs">
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={isProcessing} className="text-xs bg-red-700 hover:bg-red-800 text-white font-bold">
                  {isProcessing ? "Processing..." : "Confirm & Purge Attendance"}
                </Button>
              </div>
            </form>
          )}

          {/* Holidays Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50">
                  <TableHead className="font-bold text-slate-700">Date</TableHead>
                  <TableHead className="font-bold text-slate-700">Holiday Title</TableHead>
                  <TableHead className="font-bold text-slate-700">Classification</TableHead>
                  <TableHead className="text-right font-bold text-slate-700 pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedHolidays.length > 0 ? (
                  paginatedHolidays.map((h) => (
                    <TableRow key={h.id} className="hover:bg-slate-50/70 border-b border-slate-100">
                      <TableCell className="font-mono font-semibold text-slate-900 font-tabular text-xs">
                        {h.date}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800 text-xs">{h.title}</TableCell>
                      <TableCell>
                        {h.isEmergency ? (
                          <Badge variant="danger" className="text-[10px]">
                            Emergency Holiday
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">
                            Scheduled Holiday
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteHoliday(h)}
                          className="h-7 text-xs px-2 text-slate-400 hover:text-rose-700 hover:bg-rose-50"
                          title="Delete Holiday"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-xs text-slate-400">
                      No holidays registered for this academic year yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Pagination {...holidayPagination} />
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: Academic Years */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="years" className="space-y-4 pt-2">
          {/* Header & Add Button */}
          <div className="flex items-center justify-between bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
            <div className="text-xs text-slate-600">
              Manage school session lifecycles, start/end dates, and enforce write-locks on past sessions.
            </div>
            <Button
              size="sm"
              onClick={() => setShowAddYearModal(true)}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold gap-1.5 h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Add Academic Year</span>
            </Button>
          </div>

          {/* Add Year Form */}
          {showAddYearModal && (
            <form onSubmit={handleCreateYear} className="p-4 bg-slate-50 border border-slate-300 rounded-lg space-y-3 animate-in fade-in shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
                  <span>Create Academic Year</span>
                </h3>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowAddYearModal(false)} className="text-xs h-6 w-6 p-0">
                  ✕
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">Session Name</label>
                  <Input
                    value={newYearName}
                    onChange={(e) => setNewYearName(e.target.value)}
                    placeholder="e.g. 2027-2028"
                    className="text-xs mt-1 bg-white font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">Start Date</label>
                  <Input
                    type="date"
                    value={newYearStartDate}
                    onChange={(e) => setNewYearStartDate(e.target.value)}
                    className="text-xs mt-1 bg-white font-tabular"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block">End Date</label>
                  <Input
                    type="date"
                    value={newYearEndDate}
                    onChange={(e) => setNewYearEndDate(e.target.value)}
                    className="text-xs mt-1 bg-white font-tabular"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="outline" type="button" onClick={() => setShowAddYearModal(false)} className="text-xs">
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={isProcessing} className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold">
                  {isProcessing ? "Creating..." : "Save Academic Year"}
                </Button>
              </div>
            </form>
          )}

          {/* Academic Years Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50">
                  <TableHead className="font-bold text-slate-700">Academic Year</TableHead>
                  <TableHead className="font-bold text-slate-700">Start Date</TableHead>
                  <TableHead className="font-bold text-slate-700">End Date</TableHead>
                  <TableHead className="font-bold text-slate-700">Status</TableHead>
                  <TableHead className="text-right font-bold text-slate-700 pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {academicYears.map((ay) => (
                  <TableRow key={ay.id} className="hover:bg-slate-50/70 border-b border-slate-100">
                    <TableCell className="font-bold text-slate-900 font-mono text-xs">
                      {ay.name}
                    </TableCell>
                    <TableCell className="font-tabular text-xs text-slate-600">{ay.startDate}</TableCell>
                    <TableCell className="font-tabular text-xs text-slate-600">{ay.endDate}</TableCell>
                    <TableCell>
                      <Badge
                        variant={ay.status === "ACTIVE" ? "success" : ay.status === "LOCKED" ? "warning" : "neutral"}
                        className="text-[10px]"
                      >
                        {ay.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleLock(ay)}
                        className="h-7 text-xs px-2.5 gap-1.5"
                      >
                        {ay.status === "LOCKED" ? (
                          <>
                            <Unlock className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Unlock Year</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-3.5 w-3.5 text-amber-600" />
                            <span>Lock Year</span>
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 7: Syllabus Completion Tracker */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="syllabus" className="space-y-4 pt-2">
          {/* Header & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 border border-slate-200 rounded-lg shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-blue-700" />
                Syllabus & Curriculum Completion Tracker
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitor chapter-by-chapter lesson progression, planned vs taught periods, and state board milestone pacing.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={syllabusClassId}
                onChange={(e) => setSyllabusClassId(e.target.value)}
                className="h-8 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-800 font-medium"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.stream})
                  </option>
                ))}
              </select>

              <select
                value={syllabusSubjectId}
                onChange={(e) => setSyllabusSubjectId(e.target.value)}
                className="h-8 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-800 font-medium"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Curriculum Completion KPI Overview */}
          {(() => {
            const totPlanned = syllabusUnits.reduce((acc, u) => acc + u.plannedPeriods, 0);
            const totDone = syllabusUnits.reduce((acc, u) => acc + u.completedPeriods, 0);
            const pct = totPlanned > 0 ? Math.round((totDone / totPlanned) * 100) : 0;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 block">Total Curriculum Units</span>
                  <span className="text-xl font-bold text-slate-900">{syllabusUnits.length} Chapters</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 block">Planned Teaching Periods</span>
                  <span className="text-xl font-bold text-slate-900">{totPlanned} Periods</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 block">Completed Periods</span>
                  <span className="text-xl font-bold text-emerald-700">{totDone} Periods</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-500">Overall Coverage</span>
                    <span className="font-bold text-blue-900">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Units / Chapters Tracker Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50">
                  <TableHead className="w-12 text-center font-bold text-slate-700">#</TableHead>
                  <TableHead className="font-bold text-slate-700">Chapter / Unit Title</TableHead>
                  <TableHead isNumeric className="font-bold text-slate-700">Planned</TableHead>
                  <TableHead isNumeric className="font-bold text-slate-700">Taught</TableHead>
                  <TableHead className="font-bold text-slate-700 w-44">Pacing & Completion</TableHead>
                  <TableHead className="font-bold text-slate-700">Target Date</TableHead>
                  <TableHead className="font-bold text-slate-700">Status</TableHead>
                  <TableHead className="font-bold text-slate-700">Faculty Remarks</TableHead>
                  <TableHead className="text-right font-bold text-slate-700 pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syllabusUnits.map((u) => {
                  const unitPct = u.plannedPeriods > 0 ? Math.round((u.completedPeriods / u.plannedPeriods) * 100) : 0;
                  return (
                    <TableRow key={u.id} className="hover:bg-slate-50/70 border-b border-slate-100">
                      <TableCell className="text-center font-bold text-slate-500 text-xs">
                        {u.unitNo}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900 text-xs">
                        {u.title}
                      </TableCell>
                      <TableCell isNumeric className="font-mono text-xs font-semibold text-slate-600">
                        {u.plannedPeriods}
                      </TableCell>
                      <TableCell isNumeric className="font-mono text-xs font-bold text-blue-900">
                        {u.completedPeriods}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-mono text-slate-500">{u.completedPeriods}/{u.plannedPeriods}</span>
                            <span className="font-bold text-slate-800">{unitPct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                unitPct >= 100
                                  ? "bg-emerald-600"
                                  : unitPct >= 50
                                  ? "bg-blue-600"
                                  : "bg-amber-500"
                              }`}
                              style={{ width: `${Math.min(100, unitPct)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-600">
                        {u.targetDate}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            u.status === "COMPLETED"
                              ? "success"
                              : u.status === "IN_PROGRESS"
                              ? "interactive"
                              : "neutral"
                          }
                          className="text-[10px]"
                        >
                          {u.status === "COMPLETED"
                            ? "Completed"
                            : u.status === "IN_PROGRESS"
                            ? "In Progress"
                            : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 max-w-xs truncate" title={u.remarks}>
                        {u.remarks}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={u.status === "COMPLETED"}
                          onClick={() => handleIncrementPeriod(u.id)}
                          className="text-[11px] h-7 bg-white hover:bg-emerald-50 hover:text-emerald-800 border-slate-300 font-semibold gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          <span>+1 Period Taught</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Global Sleek Confirmation Modal */}
      <ConfirmDialog
        isOpen={!!confirmAction?.isOpen}
        onClose={() => setConfirmAction(null)}
        onConfirm={async () => {
          if (confirmAction) {
            await confirmAction.action();
            setConfirmAction(null);
          }
        }}
        title={confirmAction?.title || "Confirm Action"}
        description={confirmAction?.description || "Are you sure you want to proceed?"}
        confirmText={confirmAction?.confirmText || "Confirm"}
        variant={confirmAction?.variant || "danger"}
        isLoading={isProcessing}
      />
    </div>
  );
}

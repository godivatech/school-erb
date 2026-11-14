"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Filter,
  Plus,
  Upload,
  Phone,
  FileText,
  CreditCard,
  Clock,
  ArrowUpDown,
  FileCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  ArrowRightLeft,
  X,
  MapPin,
  HeartPulse,
  Trash2,
  ExternalLink,
  Percent,
  UploadCloud,
  Download,
  Printer,
  Receipt,
  Image as ImageIcon,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatPhone } from "@/lib/utils";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { SearchableSelect, SearchOption } from "@/components/ui/searchable-select";
import { ActionBanner } from "@/components/ui/action-banner";
import {
  issueTransferCertificate,
  updateStudentProfile,
  transferStudentSection,
  uploadStudentDocument,
  getStudentDocuments,
  deleteStudentDocument,
  updateStudentConcession,
  getStudentConcession,
} from "@/actions/students";

export interface StudentListItem {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  classId?: string;
  className: string;
  sectionId?: string;
  sectionName: string;
  rollNo: number;
  gender: string;
  bloodGroup: string | null;
  medicalFlags?: string | null;
  emergencyContact?: string | null;
  parentName: string;
  parentPhone: string;
  address?: string;
  walletBalance: number;
  totalInvoiced: number;
  totalPaid: number;
  pendingDues: number;
  status: "ACTIVE" | "TC_ISSUED" | "ALUMNI" | "DROPOUT";
  siblingCount: number;
  dob: string;
  familyId?: string;
  photoUrl?: string | null;
  nationalId?: string | null;
}

export interface ClassOption {
  id: string;
  name: string;
  order: number;
}

export interface SectionOption {
  id: string;
  classId: string;
  name: string;
  capacity: number;
}

interface StudentsClientProps {
  students: StudentListItem[];
  classes: ClassOption[];
  sections: SectionOption[];
  academicYearId: string;
  schoolId: string;
}

export function StudentsClient({
  students,
  classes,
  sections,
  academicYearId,
  schoolId,
}: StudentsClientProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [classFilter, setClassFilter] = React.useState<string>("ALL");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");

  const [selectedStudent, setSelectedStudent] = React.useState<StudentListItem | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [tcResult, setTcResult] = React.useState<any | null>(null);
  const [notification, setNotification] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Edit Profile Modal state
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);
  const [editFirstName, setEditFirstName] = React.useState("");
  const [editLastName, setEditLastName] = React.useState("");
  const [editDob, setEditDob] = React.useState("");
  const [editGender, setEditGender] = React.useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [editBloodGroup, setEditBloodGroup] = React.useState("");
  const [editEmergencyPhone, setEditEmergencyPhone] = React.useState("");
  const [editParentName, setEditParentName] = React.useState("");
  const [editParentPhone, setEditParentPhone] = React.useState("");
  const [editAddress, setEditAddress] = React.useState("");
  const [editPhotoUrl, setEditPhotoUrl] = React.useState("");

  // Batch Multi-Select State
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [showIdCardModal, setShowIdCardModal] = React.useState(false);

  // Transfer Section Modal state
  const [isTransferring, setIsTransferring] = React.useState(false);
  const [targetClassId, setTargetClassId] = React.useState("");
  const [targetSectionId, setTargetSectionId] = React.useState("");

  // Document Management State
  const [studentDocs, setStudentDocs] = React.useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = React.useState(false);
  const [uploadDocType, setUploadDocType] = React.useState("BIRTH_CERTIFICATE");
  const [uploadDocTitle, setUploadDocTitle] = React.useState("Birth Certificate");
  const [uploadFileUrl, setUploadFileUrl] = React.useState("https://s3.ap-south-1.amazonaws.com/crescent-docs/birth_cert.pdf");
  const [isUploadingDoc, setIsUploadingDoc] = React.useState(false);

  // Fee Concession State
  const [selectedConcessionCategory, setSelectedConcessionCategory] = React.useState<
    "NONE" | "RTE_100" | "STAFF_WARD_50" | "SIBLING_15" | "MERIT_25"
  >("NONE");
  const [activeConcession, setActiveConcession] = React.useState<any | null>(null);
  const [isSavingConcession, setIsSavingConcession] = React.useState(false);

  React.useEffect(() => {
    if (selectedStudent) {
      setLoadingDocs(true);
      getStudentDocuments({ schoolId, studentId: selectedStudent.id })
        .then((docs) => setStudentDocs(docs))
        .catch(() => setStudentDocs([]))
        .finally(() => setLoadingDocs(false));

      getStudentConcession({ schoolId, academicYearId, studentId: selectedStudent.id })
        .then((conc) => {
          setActiveConcession(conc);
          if (!conc) {
            setSelectedConcessionCategory("NONE");
          } else if (conc.discountValue === "100.00") {
            setSelectedConcessionCategory("RTE_100");
          } else if (conc.discountValue === "50.00") {
            setSelectedConcessionCategory("STAFF_WARD_50");
          } else if (conc.discountValue === "15.00") {
            setSelectedConcessionCategory("SIBLING_15");
          } else if (conc.discountValue === "25.00") {
            setSelectedConcessionCategory("MERIT_25");
          } else {
            setSelectedConcessionCategory("NONE");
          }
        })
        .catch(() => {
          setActiveConcession(null);
          setSelectedConcessionCategory("NONE");
        });
    }
  }, [selectedStudent, schoolId, academicYearId]);

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setIsUploadingDoc(true);
    try {
      const res = await uploadStudentDocument({
        schoolId,
        studentId: selectedStudent.id,
        documentType: uploadDocType,
        title: uploadDocTitle || "Official Certificate",
        fileUrl: uploadFileUrl,
        fileSize: "1.4 MB",
      });
      if (res.success) {
        notify("success", `Certificate "${uploadDocTitle}" attached and verified!`);
        setStudentDocs((prev) => [res.document, ...prev]);
        setUploadDocTitle("Transfer Certificate");
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to upload document.");
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId: string, title: string) => {
    if (!selectedStudent) return;
    try {
      const res = await deleteStudentDocument({
        schoolId,
        studentId: selectedStudent.id,
        documentId: docId,
      });
      if (res.success) {
        notify("success", `Removed certificate: ${title}`);
        setStudentDocs((prev) => prev.filter((d) => d.id !== docId));
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to delete document.");
    }
  };

  const handleApplyConcession = async () => {
    if (!selectedStudent) return;
    setIsSavingConcession(true);
    try {
      const res = await updateStudentConcession({
        schoolId,
        academicYearId,
        studentId: selectedStudent.id,
        concessionCategory: selectedConcessionCategory,
      });
      if (res.success) {
        setActiveConcession(res.concession);
        notify(
          "success",
          selectedConcessionCategory === "NONE"
            ? "Concession removed. Standard fees apply."
            : `Fee discount updated: ${selectedConcessionCategory} applied to invoices.`
        );
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to update concession.");
    } finally {
      setIsSavingConcession(false);
    }
  };

  const notify = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 6000);
  };

  // Open Edit Profile
  const handleOpenEdit = (student: StudentListItem) => {
    setEditFirstName(student.firstName);
    setEditLastName(student.lastName);
    setEditDob(student.dob);
    setEditGender(student.gender as any);
    setEditBloodGroup(student.bloodGroup || "");
    setEditEmergencyPhone(student.emergencyContact || "");
    setEditParentName(student.parentName);
    setEditParentPhone(student.parentPhone);
    setEditAddress(student.address || "");
    setEditPhotoUrl(student.photoUrl || "");
    setIsEditingProfile(true);
    setIsTransferring(false);
  };

  // Save Edit Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setIsProcessing(true);
    try {
      const res = await updateStudentProfile({
        schoolId,
        userId: "usr_principal",
        studentId: selectedStudent.id,
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        dob: editDob,
        gender: editGender,
        bloodGroup: editBloodGroup.trim() || null,
        emergencyContact: editEmergencyPhone.trim() || null,
        photoUrl: editPhotoUrl.trim() || null,
        primaryParentName: editParentName.trim(),
        primaryPhone: editParentPhone.trim(),
        address: editAddress.trim() || null,
      });
      if (res.success) {
        setIsEditingProfile(false);
        notify("success", `Updated student profile for ${editFirstName} ${editLastName}!`);
        // Update local selection
        setSelectedStudent((prev) =>
          prev
            ? {
                ...prev,
                firstName: editFirstName.trim(),
                lastName: editLastName.trim(),
                dob: editDob,
                gender: editGender,
                bloodGroup: editBloodGroup.trim() || null,
                emergencyContact: editEmergencyPhone.trim() || null,
                photoUrl: editPhotoUrl.trim() || null,
                parentName: editParentName.trim(),
                parentPhone: editParentPhone.trim(),
                address: editAddress.trim() || "",
              }
            : null
        );
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to update profile.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Sibling lookup
  const siblings = React.useMemo(() => {
    if (!selectedStudent?.familyId) return [];
    return students.filter(
      (s) => s.familyId === selectedStudent.familyId && s.id !== selectedStudent.id
    );
  }, [selectedStudent, students]);

  // Batch Selection Handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedStudents.length && paginatedStudents.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedStudents.map((s) => s.id)));
    }
  };

  const toggleSelectStudent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportSelectedCsv = () => {
    const targetStudents = students.filter((s) => selectedIds.has(s.id));
    if (targetStudents.length === 0) return;

    const headers = [
      "Roll No",
      "Admission No",
      "First Name",
      "Last Name",
      "Class",
      "Section",
      "Gender",
      "DOB",
      "Blood Group",
      "Parent Name",
      "Parent Phone",
      "Emergency Contact",
      "Address",
      "Total Invoiced (INR)",
      "Total Paid (INR)",
      "Pending Dues (INR)",
      "Status",
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [
      headers.join(","),
      ...targetStudents.map((s) =>
        [
          s.rollNo,
          s.admissionNo,
          s.firstName,
          s.lastName,
          s.className,
          s.sectionName,
          s.gender,
          s.dob,
          s.bloodGroup || "",
          s.parentName,
          s.parentPhone,
          s.emergencyContact || "",
          s.address || "",
          s.totalInvoiced.toFixed(2),
          s.totalPaid.toFixed(2),
          s.pendingDues.toFixed(2),
          s.status,
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Crescent_Students_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify("success", `Exported ${targetStudents.length} student records to CSV!`);
  };

  // Open Transfer Section
  const handleOpenTransfer = (student: StudentListItem) => {
    setTargetClassId(student.classId || classes[0]?.id || "");
    const matchingSecs = sections.filter((s) => s.classId === (student.classId || classes[0]?.id));
    setTargetSectionId(matchingSecs[0]?.id || "");
    setIsTransferring(true);
    setIsEditingProfile(false);
  };

  // Submit Section Transfer
  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !targetSectionId) return;
    setIsProcessing(true);
    try {
      const res = await transferStudentSection({
        schoolId,
        userId: "usr_principal",
        studentId: selectedStudent.id,
        academicYearId,
        targetClassId,
        targetSectionId,
      });
      if (res.success) {
        setIsTransferring(false);
        const targetSec = sections.find((s) => s.id === targetSectionId);
        const targetCls = classes.find((c) => c.id === targetClassId);
        notify("success", `Transferred ${selectedStudent.firstName} to ${targetCls?.name} - Sec ${targetSec?.name}!`);
        setSelectedStudent((prev) =>
          prev
            ? {
                ...prev,
                classId: targetClassId,
                className: targetCls?.name || prev.className,
                sectionId: targetSectionId,
                sectionName: targetSec?.name || prev.sectionName,
              }
            : null
        );
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to transfer student.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered List
  const filtered = React.useMemo(() => {
    return students.filter((s) => {
      const matchQuery =
        s.firstName.toLowerCase().includes(search.toLowerCase()) ||
        s.lastName.toLowerCase().includes(search.toLowerCase()) ||
        s.admissionNo.toLowerCase().includes(search.toLowerCase()) ||
        s.parentPhone.includes(search);

      const matchClass = classFilter === "ALL" ? true : s.className === classFilter;
      const matchStatus = statusFilter === "ALL" ? true : s.status === statusFilter;

      return matchQuery && matchClass && matchStatus;
    });
  }, [students, search, classFilter, statusFilter]);

  const { paginatedItems: paginatedStudents, paginationProps: studentPagination } = usePagination(filtered, 12);

  const handleIssueTC = async (forceOverride = false) => {
    if (!selectedStudent) return;
    setIsProcessing(true);
    setTcResult(null);

    try {
      const res = await issueTransferCertificate({
        studentId: selectedStudent.id,
        tcReason: "Parent relocation / Course completion",
        forceOverride,
      });

      if (res.success) {
        notify("success", `Transfer Certificate successfully issued for ${selectedStudent.firstName} ${selectedStudent.lastName}!`);
        setSelectedStudent(null);
        router.refresh();
      } else if (res.error === "UNPAID_DUES_EXIST") {
        setTcResult(res);
      }
    } catch (err: any) {
      notify("error", "Failed to issue TC: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Student Information System (SIS)
          </h1>
          <p className="text-xs text-slate-500 font-tabular mt-0.5">
            Active Directory • {students.length} Enrolled Students • Real-Time Capacity & Dues Protected
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/students/import" className="shrink-0">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <Upload className="h-3.5 w-3.5 text-slate-600" />
              <span>Bulk CSV Wizard</span>
            </Button>
          </Link>
          <Link href="/students/new" className="shrink-0">
            <Button size="sm" className="gap-1.5 text-xs h-8 bg-slate-900 hover:bg-slate-800 text-white font-semibold">
              <Plus className="h-3.5 w-3.5" />
              <span>New Admission</span>
            </Button>
          </Link>
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
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
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

      {/* Filter / Search Bar with Class & Section Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5 bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student name, admission number, or parent mobile phone..."
            className="pl-8 text-xs h-9 bg-slate-50"
          />
        </div>

        {/* Class Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 font-medium w-full sm:w-auto"
          >
            <option value="ALL">All Grades / Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 font-medium w-full sm:w-auto"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="TC_ISSUED">TC Issued</option>
            <option value="ALUMNI">Alumni</option>
          </select>
        </div>
      </div>

      {/* TanStack Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200 bg-slate-50">
              <TableHead className="w-10 text-center">
                <input
                  type="checkbox"
                  checked={paginatedStudents.length > 0 && paginatedStudents.every((s) => selectedIds.has(s.id))}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  title="Select / Deselect all on page"
                />
              </TableHead>
              <TableHead className="w-12 text-center font-bold text-slate-700">#</TableHead>
              <TableHead className="font-bold text-slate-700">Admission No</TableHead>
              <TableHead className="font-bold text-slate-700">Student Name</TableHead>
              <TableHead className="font-bold text-slate-700">Class & Section</TableHead>
              <TableHead className="font-bold text-slate-700">Primary Parent & Phone</TableHead>
              <TableHead className="font-bold text-slate-700">Siblings</TableHead>
              <TableHead isNumeric className="font-bold text-slate-700">Fee Status</TableHead>
              <TableHead className="font-bold text-slate-700">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                  No students found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              paginatedStudents.map((student, idx) => (
                <TableRow
                  key={student.id}
                  onClick={() => {
                    setSelectedStudent(student);
                    setIsEditingProfile(false);
                    setIsTransferring(false);
                    setTcResult(null);
                  }}
                  className={`cursor-pointer border-b border-slate-100 transition-colors ${
                    selectedIds.has(student.id) ? "bg-blue-50/60 hover:bg-blue-50" : "hover:bg-slate-50/70"
                  }`}
                >
                  <TableCell className="text-center" onClick={(e) => toggleSelectStudent(student.id, e)}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(student.id)}
                      onChange={() => {}}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </TableCell>
                  <TableCell className="text-center font-tabular text-xs text-slate-400">
                    {student.rollNo || idx + 1}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-blue-950">
                    {student.admissionNo}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900 text-xs">
                    {student.firstName} {student.lastName}
                    {student.bloodGroup && (
                      <span className="ml-1.5 text-[10px] text-slate-500 font-normal">
                        ({student.bloodGroup})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-slate-800">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 font-mono text-[11px]">
                      {student.className} - {student.sectionName}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium text-slate-900">
                      {student.parentName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-tabular flex items-center gap-1">
                      <Phone className="h-2.5 w-2.5 text-slate-400" />
                      {formatPhone(student.parentPhone)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {student.siblingCount > 0 ? (
                      <Badge variant="interactive" className="text-[10px] font-semibold">
                        {student.siblingCount} Sibling{student.siblingCount > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </TableCell>
                  <TableCell isNumeric className="text-xs">
                    <Link
                      href={`/students/${student.id}/ledger`}
                      onClick={(e) => e.stopPropagation()}
                      className="group inline-block text-right hover:underline"
                      title="View Student Transaction History & Receipts"
                    >
                      {student.pendingDues > 0 ? (
                        <div>
                          <span className="font-tabular font-bold text-rose-700 block group-hover:text-rose-900">
                            {formatCurrency(student.pendingDues)}
                          </span>
                          <span className="text-[10px] text-rose-500 font-medium flex items-center justify-end gap-0.5">
                            Pending Due &rarr;
                          </span>
                        </div>
                      ) : student.totalInvoiced > 0 ? (
                        <div>
                          <span className="font-tabular font-bold text-emerald-700 block group-hover:text-emerald-900">
                            {formatCurrency(student.totalPaid)}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-medium flex items-center justify-end gap-0.5">
                            All Paid &rarr;
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] font-tabular">No Invoices</span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        student.status === "ACTIVE"
                          ? "success"
                          : student.status === "TC_ISSUED"
                          ? "warning"
                          : "neutral"
                      }
                      className="text-[10px]"
                    >
                      {student.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination {...studentPagination} />
      </div>

      {/* 480px Slide-Over Drawer */}
      <Sheet
        open={!!selectedStudent}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStudent(null);
            setIsEditingProfile(false);
            setIsTransferring(false);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-[480px] p-6 overflow-y-auto space-y-5">
          {selectedStudent && (
            <>
              <SheetHeader className="border-b border-slate-200 pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-xs font-bold">
                    {selectedStudent.admissionNo}
                  </Badge>
                  <Badge
                    variant={selectedStudent.status === "ACTIVE" ? "success" : "warning"}
                    className="text-xs font-semibold"
                  >
                    {selectedStudent.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  {selectedStudent.photoUrl ? (
                    <img
                      src={selectedStudent.photoUrl}
                      alt={selectedStudent.firstName}
                      className="h-12 w-12 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-slate-700 text-base shadow-sm">
                      {selectedStudent.firstName[0]}
                      {selectedStudent.lastName[0]}
                    </div>
                  )}
                  <div>
                    <SheetTitle className="text-xl font-bold text-slate-900 leading-tight">
                      {selectedStudent.firstName} {selectedStudent.lastName}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-slate-500 font-tabular mt-0.5">
                      {selectedStudent.className} - Section {selectedStudent.sectionName} • Roll #{selectedStudent.rollNo}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              {/* Tabs Navigation */}
              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid grid-cols-3 w-full h-8 mb-3 bg-slate-100">
                  <TabsTrigger value="profile" className="text-[11px] font-semibold data-[state=active]:bg-white">
                    Profile
                  </TabsTrigger>
                  <TabsTrigger value="docs" className="text-[11px] font-semibold data-[state=active]:bg-white">
                    Certificates ({studentDocs.length})
                  </TabsTrigger>
                  <TabsTrigger value="concession" className="text-[11px] font-semibold data-[state=active]:bg-white">
                    Concessions
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: Profile & Operational Actions */}
                <TabsContent value="profile" className="space-y-4">
                  {/* Siblings Enrolled in School Card */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-bold text-slate-900">Siblings Enrolled in School</span>
                      </div>
                      <Badge variant={siblings.length > 0 ? "interactive" : "outline"} className="text-[10px]">
                        {siblings.length} Sibling{siblings.length === 1 ? "" : "s"}
                      </Badge>
                    </div>

                    {siblings.length > 0 ? (
                      <div className="space-y-2 pt-1">
                        {siblings.map((sib) => (
                          <div
                            key={sib.id}
                            className="p-2.5 bg-white border border-slate-200 rounded flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-semibold text-slate-900">
                                {sib.firstName} {sib.lastName}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {sib.className} - {sib.sectionName} • Roll #{sib.rollNo} • Adm: {sib.admissionNo}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] bg-slate-50 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => {
                                setSelectedStudent(sib);
                                setIsEditingProfile(false);
                                setIsTransferring(false);
                              }}
                            >
                              Open Profile
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic py-1">
                        Single child enrolled • No school siblings registered under this family account.
                      </div>
                    )}
                  </div>

              {/* FORM: Edit Student Profile */}
              {isEditingProfile ? (
                <form onSubmit={handleSaveProfile} className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-lg space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                    <span className="text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Pencil className="h-3 w-3 text-blue-700" />
                      Edit Student Demographics
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="text-xs text-slate-400 hover:text-slate-700"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2">
                      <label className="text-[10px] font-semibold text-slate-600 block">Student Photo / Avatar URL</label>
                      <div className="flex items-center gap-2 mt-0.5">
                        {editPhotoUrl ? (
                          <img
                            src={editPhotoUrl}
                            alt="Preview"
                            className="h-8 w-8 rounded-full object-cover border border-slate-300"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold">
                            {editFirstName?.[0] || "?"}
                          </div>
                        )}
                        <Input
                          value={editPhotoUrl}
                          onChange={(e) => setEditPhotoUrl(e.target.value)}
                          placeholder="https://example.com/photos/student.jpg"
                          className="text-xs h-8 bg-white flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block">First Name</label>
                      <Input
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        className="text-xs h-8 bg-white mt-0.5"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block">Last Name</label>
                      <Input
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        className="text-xs h-8 bg-white mt-0.5"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block">Date of Birth</label>
                      <Input
                        type="date"
                        value={editDob}
                        onChange={(e) => setEditDob(e.target.value)}
                        className="text-xs h-8 bg-white mt-0.5"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block">Blood Group</label>
                      <Input
                        value={editBloodGroup}
                        onChange={(e) => setEditBloodGroup(e.target.value)}
                        placeholder="O+, B+, etc."
                        className="text-xs h-8 bg-white mt-0.5"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-semibold text-slate-600 block">Primary Parent Name</label>
                      <Input
                        value={editParentName}
                        onChange={(e) => setEditParentName(e.target.value)}
                        className="text-xs h-8 bg-white mt-0.5"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block">Parent Mobile Phone</label>
                      <Input
                        value={editParentPhone}
                        onChange={(e) => setEditParentPhone(e.target.value)}
                        className="text-xs h-8 bg-white mt-0.5"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block">Emergency Phone</label>
                      <Input
                        value={editEmergencyPhone}
                        onChange={(e) => setEditEmergencyPhone(e.target.value)}
                        className="text-xs h-8 bg-white mt-0.5"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-semibold text-slate-600 block">Residential Address</label>
                      <Input
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="text-xs h-8 bg-white mt-0.5"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-blue-100">
                    <Button size="sm" variant="outline" type="button" onClick={() => setIsEditingProfile(false)} className="text-xs h-7">
                      Cancel
                    </Button>
                    <Button size="sm" type="submit" disabled={isProcessing} className="text-xs h-7 bg-blue-700 text-white font-semibold">
                      {isProcessing ? "Saving..." : "Save Profile"}
                    </Button>
                  </div>
                </form>
              ) : isTransferring ? (
                /* FORM: Transfer Section */
                <form onSubmit={handleSaveTransfer} className="p-3.5 bg-purple-50/50 border border-purple-200 rounded-lg space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                    <span className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowRightLeft className="h-3 w-3 text-purple-700" />
                      Transfer Class / Section
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsTransferring(false)}
                      className="text-xs text-slate-400 hover:text-slate-700"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-700 block">Target Grade / Class</label>
                      <select
                        value={targetClassId}
                        onChange={(e) => {
                          setTargetClassId(e.target.value);
                          const matchingSecs = sections.filter((s) => s.classId === e.target.value);
                          setTargetSectionId(matchingSecs[0]?.id || "");
                        }}
                        className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2 mt-0.5"
                      >
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-slate-700 block">Target Section</label>
                      <select
                        value={targetSectionId}
                        onChange={(e) => setTargetSectionId(e.target.value)}
                        className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2 mt-0.5"
                      >
                        {sections
                          .filter((s) => s.classId === targetClassId)
                          .map((sec) => (
                            <option key={sec.id} value={sec.id}>
                              Section {sec.name} (Max: {sec.capacity} seats)
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-purple-100">
                    <Button size="sm" variant="outline" type="button" onClick={() => setIsTransferring(false)} className="text-xs h-7">
                      Cancel
                    </Button>
                    <Button size="sm" type="submit" disabled={isProcessing} className="text-xs h-7 bg-purple-700 text-white font-semibold">
                      {isProcessing ? "Transferring..." : "Confirm Transfer"}
                    </Button>
                  </div>
                </form>
              ) : (
                /* Profile Display */
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex items-center justify-between pb-1.5">
                      <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                        Demographics & Medical
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(selectedStudent)}
                        className="h-6 text-[10px] px-2 gap-1 text-blue-700 border-blue-200 hover:bg-blue-50"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                        Edit Profile
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Date of Birth</span>
                        <span className="font-semibold text-slate-800">{selectedStudent.dob}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Gender</span>
                        <span className="font-semibold text-slate-800">{selectedStudent.gender}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Blood Group</span>
                        <span className="font-semibold text-slate-800">{selectedStudent.bloodGroup || "Not Recorded"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Emergency Contact</span>
                        <span className="font-semibold text-slate-800 font-tabular">
                          {selectedStudent.emergencyContact || selectedStudent.parentPhone}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fee & Dues Status */}
                  <div>
                    <div className="flex items-center justify-between pb-1.5">
                      <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                        Fee & Dues Status
                      </h3>
                      {selectedStudent.pendingDues > 0 ? (
                        <Badge variant="danger" className="text-[10px]">
                          Pending Dues
                        </Badge>
                      ) : selectedStudent.totalInvoiced > 0 ? (
                        <Badge variant="success" className="text-[10px]">
                          All Fees Paid
                        </Badge>
                      ) : (
                        <Badge variant="neutral" className="text-[10px]">
                          No Invoices
                        </Badge>
                      )}
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-white rounded border border-slate-200">
                          <span className="text-slate-500 text-[10px] font-medium block">Total Fees</span>
                          <span className="font-tabular font-bold text-slate-900 text-xs">
                            {formatCurrency(selectedStudent.totalInvoiced)}
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded border border-slate-200">
                          <span className="text-slate-500 text-[10px] font-medium block">Total Paid</span>
                          <span className="font-tabular font-bold text-emerald-700 text-xs">
                            {formatCurrency(selectedStudent.totalPaid)}
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded border border-slate-200">
                          <span className="text-slate-500 text-[10px] font-medium block">Pending Due</span>
                          <span className={`font-tabular font-bold text-xs ${selectedStudent.pendingDues > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                            {formatCurrency(selectedStudent.pendingDues)}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                        <Link
                          href={`/students/${selectedStudent.id}/ledger`}
                          className="text-[11px] font-semibold text-navy-800 hover:text-navy-950 hover:underline flex items-center gap-1.5"
                        >
                          <Receipt className="h-3.5 w-3.5 text-navy-700" />
                          <span>View Full Transaction History & Receipts &rarr;</span>
                        </Link>
                        {selectedStudent.pendingDues > 0 && (
                          <Link
                            href={`/finance/pos?query=${encodeURIComponent(selectedStudent.admissionNo)}`}
                            className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
                          >
                            <CreditCard className="h-3 w-3" />
                            <span>Collect at POS &rarr;</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Parent / Guardian Information */}
                  <div>
                    <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1.5">
                      Parent / Guardian
                    </h3>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                      <div className="font-semibold text-slate-900">{selectedStudent.parentName}</div>
                      <div className="text-slate-600 font-tabular flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {selectedStudent.parentPhone}
                      </div>
                      {selectedStudent.address && (
                        <div className="text-slate-600 text-[11px] flex items-start gap-1.5 pt-1 border-t border-slate-200">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                          <span>{selectedStudent.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Dues Warning if blocked on TC */}
              {tcResult && (
                <div className="p-3.5 bg-red-50 border border-red-300 rounded text-xs text-red-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-red-900">
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                    <span>Unpaid Dues Prevent TC Issuance</span>
                  </div>
                  <p className="text-[11px] text-red-700">
                    {tcResult.message}
                  </p>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleIssueTC(true)}
                    className="w-full text-xs font-semibold h-7"
                  >
                    Principal Override & Issue TC Anyway
                  </Button>
                </div>
              )}

              {/* Quick Action Buttons */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <Link href={`/students/${selectedStudent.id}/ledger`} className="block">
                  <Button variant="outline" className="w-full text-xs font-semibold gap-1.5 h-8 border-slate-300 text-slate-800 hover:bg-slate-50">
                    <Receipt className="h-3.5 w-3.5 text-navy-800" />
                    <span>View Financial Ledger & Print Receipts</span>
                  </Button>
                </Link>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleOpenTransfer(selectedStudent)}
                    className="text-xs font-semibold gap-1.5 h-8 border-slate-300 hover:bg-slate-50"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5 text-purple-600" />
                    <span>Transfer Section</span>
                  </Button>

                  <Link href={`/finance/pos?query=${selectedStudent.admissionNo}`} className="block">
                    <Button variant="default" className="w-full text-xs font-semibold gap-1.5 h-8 bg-slate-900 text-white">
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>Collect Fee POS</span>
                    </Button>
                  </Link>
                </div>

                {selectedStudent.status === "ACTIVE" && (
                  <Button
                    variant="outline"
                    onClick={() => handleIssueTC(false)}
                    disabled={isProcessing}
                    className="w-full text-xs font-semibold text-rose-700 hover:bg-rose-50 border-rose-200 gap-1.5 h-8"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Issue Transfer Certificate (TC)</span>
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* TAB 2: Certificates & Official Documents */}
            <TabsContent value="docs" className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <UploadCloud className="h-3.5 w-3.5 text-blue-600" />
                    <span>Attach Certificate / S3 Document</span>
                  </h4>
                </div>

                <form onSubmit={handleUploadDoc} className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block">Certificate Type</label>
                      <select
                        value={uploadDocType}
                        onChange={(e) => {
                          setUploadDocType(e.target.value);
                          if (e.target.value === "BIRTH_CERTIFICATE") setUploadDocTitle("Official Birth Certificate");
                          else if (e.target.value === "TRANSFER_CERTIFICATE") setUploadDocTitle("Previous School TC");
                          else if (e.target.value === "AADHAAR_CARD") setUploadDocTitle("Aadhaar National ID");
                          else if (e.target.value === "COMMUNITY_CERTIFICATE") setUploadDocTitle("Community / Caste Certificate");
                          else setUploadDocTitle("Medical / Conduct Certificate");
                        }}
                        className="w-full h-7 text-xs border border-slate-300 rounded px-2 bg-white"
                      >
                        <option value="BIRTH_CERTIFICATE">Birth Certificate</option>
                        <option value="TRANSFER_CERTIFICATE">Previous School TC</option>
                        <option value="AADHAAR_CARD">Aadhaar Card (UIDAI)</option>
                        <option value="COMMUNITY_CERTIFICATE">Community Certificate</option>
                        <option value="MEDICAL_RECORD">Medical Record / Immunization</option>
                        <option value="OTHER">Other Certificate</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block">Document Title</label>
                      <Input
                        value={uploadDocTitle}
                        onChange={(e) => setUploadDocTitle(e.target.value)}
                        placeholder="e.g. Birth Certificate"
                        className="text-xs h-7 bg-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block">S3 / Secure File URL</label>
                    <Input
                      value={uploadFileUrl}
                      onChange={(e) => setUploadFileUrl(e.target.value)}
                      placeholder="https://s3.ap-south-1.amazonaws.com/crescent-docs/..."
                      className="text-xs h-7 font-mono bg-white"
                      required
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      type="submit"
                      disabled={isUploadingDoc}
                      className="text-xs h-7 bg-blue-700 hover:bg-blue-800 text-white font-semibold gap-1.5"
                    >
                      <FileCheck className="h-3 w-3" />
                      <span>{isUploadingDoc ? "Attaching..." : "Attach Certificate"}</span>
                    </Button>
                  </div>
                </form>
              </div>

              {/* List of Certificates */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                  Archived Official Certificates ({studentDocs.length})
                </h4>

                {loadingDocs ? (
                  <div className="p-4 text-center text-xs text-slate-400 italic">
                    Loading documents from repository...
                  </div>
                ) : studentDocs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 italic bg-slate-50 border rounded-lg">
                    No official certificates attached yet. Use form above to upload.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {studentDocs.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs hover:border-slate-300 transition-colors shadow-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-blue-600" />
                            <span>{doc.title}</span>
                            <Badge variant="success" className="text-[9px] py-0 px-1 font-semibold">
                              {doc.verificationStatus || "VERIFIED"}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-slate-500 font-tabular">
                            Type: {doc.documentType} • Size: {doc.fileSize || "1.2 MB"} • Date: {new Date(doc.createdAt).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline px-2 py-1 rounded bg-blue-50 border border-blue-200"
                          >
                            <span>View</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc.id, doc.title)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="Delete Document"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 3: Fee Concession */}
            <TabsContent value="concession" className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5 text-amber-600" />
                    <span>Pre-Configured Fee Concession Category</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Applies standard discount rule automatically to upcoming fee invoice calculations.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-slate-700 block">
                    Select Concession Scheme
                  </label>
                  <select
                    value={selectedConcessionCategory}
                    onChange={(e) => setSelectedConcessionCategory(e.target.value as any)}
                    className="w-full text-xs h-8 border border-slate-300 rounded px-2.5 bg-white font-medium text-slate-800"
                  >
                    <option value="NONE">Standard Fee (0% Discount / Full Tuition)</option>
                    <option value="RTE_100">RTE 100% Free Education Quota (100% Fee Waiver)</option>
                    <option value="STAFF_WARD_50">Staff Ward Concession (50% Tuition Discount)</option>
                    <option value="SIBLING_15">Sibling Concession (15% Tuition Discount)</option>
                    <option value="MERIT_25">Merit Scholarship (25% Tuition Discount)</option>
                  </select>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-md text-xs space-y-1">
                  <span className="font-semibold text-slate-800 block text-[11px]">Applied Discount Rule:</span>
                  <span className="text-slate-600 font-mono text-[11px]">
                    {selectedConcessionCategory === "RTE_100" && "✓ 100% Full Waiver under Right to Education (Govt Quota)"}
                    {selectedConcessionCategory === "STAFF_WARD_50" && "✓ 50% Tuition Discount applied to term fee invoices"}
                    {selectedConcessionCategory === "SIBLING_15" && "✓ 15% Sibling Discount auto-applied to term fee invoices"}
                    {selectedConcessionCategory === "MERIT_25" && "✓ 25% Academic Merit Scholarship applied to term fee invoices"}
                    {selectedConcessionCategory === "NONE" && "• Standard school fee structure without special concession"}
                  </span>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    onClick={handleApplyConcession}
                    disabled={isSavingConcession}
                    className="text-xs h-8 bg-slate-900 hover:bg-slate-800 text-white font-semibold gap-1.5"
                  >
                    <Percent className="h-3 w-3" />
                    <span>{isSavingConcession ? "Saving..." : "Apply Concession Scheme"}</span>
                  </Button>
                </div>
              </div>

              {activeConcession && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Active Concession on Record</span>
                  </div>
                  <div className="text-emerald-800 font-mono text-[11px]">
                    Discount: {activeConcession.discountValue}% ({activeConcession.reason})
                  </div>
                  <div className="text-[10px] text-emerald-700">
                    {activeConcession.remarks}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
        </SheetContent>
      </Sheet>

      {/* Floating Batch Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-white tracking-wide">
              {selectedIds.size} student{selectedIds.size > 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportSelectedCsv}
            className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700 hover:text-white gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setShowIdCardModal(true)}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print ID Cards ({selectedIds.size})</span>
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-slate-400 hover:text-white transition-colors ml-1"
          >
            Clear
          </button>
        </div>
      )}

      {/* Official Student Identity Cards Print Modal */}
      {showIdCardModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-400" />
                  Official Student Identity Cards (Batch Print)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedIds.size} Identity Cards formatted for Crescent Matriculation School official standard
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs h-8 gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print ID Cards
                </Button>
                <button
                  onClick={() => setShowIdCardModal(false)}
                  className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body - ID Cards Grid */}
            <div className="p-6 overflow-y-auto space-y-6 bg-slate-100 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                {students
                  .filter((s) => selectedIds.has(s.id))
                  .map((stu) => (
                    <div
                      key={stu.id}
                      className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between print:border-black print:break-inside-avoid"
                      style={{ minHeight: "260px" }}
                    >
                      {/* School Letterhead Header */}
                      <div className="bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900 text-white px-4 py-2.5 text-center border-b border-blue-950">
                        <div className="text-[12px] font-black tracking-wide uppercase">
                          CRESCENT MATRICULATION HIGHER SECONDARY SCHOOL
                        </div>
                        <div className="text-[9px] text-blue-200">
                          Affiliated to Tamil Nadu State Board • Chennai - 600045
                        </div>
                        <div className="text-[9px] font-bold text-amber-300 tracking-wider mt-0.5">
                          STUDENT IDENTITY CARD • 2026-2027
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 flex gap-4 items-center">
                        {/* Student Photo */}
                        <div className="flex flex-col items-center gap-1.5 shrink-0">
                          {stu.photoUrl ? (
                            <img
                              src={stu.photoUrl}
                              alt={stu.firstName}
                              className="h-24 w-20 rounded border border-slate-300 object-cover shadow-xs"
                            />
                          ) : (
                            <div className="h-24 w-20 rounded border border-slate-300 bg-slate-100 flex flex-col items-center justify-center text-slate-400">
                              <ImageIcon className="h-6 w-6 stroke-1" />
                              <span className="text-[9px] font-medium mt-1">PHOTO</span>
                            </div>
                          )}
                          <span className="text-[9px] font-mono font-bold text-slate-700 bg-slate-100 px-1 rounded border">
                            {stu.bloodGroup ? `BG: ${stu.bloodGroup}` : "BG: —"}
                          </span>
                        </div>

                        {/* Student Details */}
                        <div className="flex-1 space-y-1 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                              Student Name
                            </span>
                            <span className="font-bold text-slate-900 text-sm">
                              {stu.firstName} {stu.lastName}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1 text-[11px] pt-1">
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Admission No</span>
                              <span className="font-mono font-bold text-blue-900">{stu.admissionNo}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Class & Sec</span>
                              <span className="font-bold text-slate-800">
                                {stu.className} - {stu.sectionName} (#{stu.rollNo})
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Date of Birth</span>
                              <span className="font-medium text-slate-700">{stu.dob}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Parent Contact</span>
                              <span className="font-medium text-slate-700 font-mono">{stu.parentPhone}</span>
                            </div>
                          </div>

                          {stu.emergencyContact && (
                            <div className="text-[10px] text-rose-700 pt-0.5">
                              <strong>Emergency:</strong> {stu.emergencyContact}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer with Barcode & Sign */}
                      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-[9px]">
                        <div className="font-mono text-slate-500 tracking-widest text-[10px]">
                          ||| | |||| | ||| {stu.admissionNo}
                        </div>
                        <div className="text-right">
                          <span className="font-serif italic font-bold text-slate-800 text-[10px] block">
                            Dr. K. R. Ramanathan
                          </span>
                          <span className="text-slate-400 text-[8px] uppercase">Principal Signature</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Standard 85.60 × 53.98 mm printable dimensions</span>
              <Button size="sm" variant="outline" onClick={() => setShowIdCardModal(false)} className="text-xs h-7">
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

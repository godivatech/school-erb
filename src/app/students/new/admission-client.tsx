"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Users,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  UserCheck,
  CreditCard,
  ChevronRight,
  X,
  RefreshCw,
  FileText,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { admitStudentWithFamilyLink, lookupFamilyByPhone } from "@/actions/students";

export interface OccupiedRoll {
  rollNo: number;
  studentName: string;
}

export interface SectionOption {
  id: string;
  name: string;
  capacity?: number;
  enrolledCount?: number;
  occupiedRolls?: OccupiedRoll[];
}

export interface ClassOption {
  id: string;
  name: string;
  sections: SectionOption[];
}

function computeNextAvailableRoll(occupiedRolls?: OccupiedRoll[]): number {
  if (!occupiedRolls || occupiedRolls.length === 0) return 1;
  const taken = new Set(occupiedRolls.map((r) => r.rollNo));
  let candidate = 1;
  while (taken.has(candidate)) {
    candidate++;
  }
  return candidate;
}

interface AdmissionClientProps {
  classes: ClassOption[];
  academicYearId: string;
  academicYearName: string;
  isLocked: boolean;
  schoolId: string;
  defaultAdmNo: string;
}

export function NewStudentAdmissionClient({
  classes,
  academicYearId,
  academicYearName,
  isLocked,
  schoolId,
  defaultAdmNo,
}: AdmissionClientProps) {
  const router = useRouter();

  const defaultClass = classes[0];
  const defaultSection = defaultClass?.sections[0];
  const initialRollNo = String(computeNextAvailableRoll(defaultSection?.occupiedRolls));

  const [formData, setFormData] = React.useState({
    admissionNo: defaultAdmNo,
    firstName: "",
    lastName: "",
    dob: "2013-06-15",
    gender: "MALE" as "MALE" | "FEMALE" | "OTHER",
    bloodGroup: "O+",
    medicalFlags: "",
    nationalId: "",
    emergencyContact: "",
    primaryParentName: "",
    primaryPhone: "",
    secondaryParentName: "",
    secondaryPhone: "",
    email: "",
    address: "",
    occupation: "",
    classId: defaultClass?.id || "",
    sectionId: defaultSection?.id || "",
    rollNo: initialRollNo,
    concessionCategory: "NONE" as "NONE" | "RTE_100" | "STAFF_WARD_50" | "SIBLING_15" | "MERIT_25",
  });

  const [siblingMatch, setSiblingMatch] = React.useState<{
    parentName: string;
    existingStudents: Array<{
      id: string;
      firstName: string;
      lastName: string;
      admissionNo?: string | null;
      className?: string | null;
      sectionName?: string | null;
    }>;
  } | null>(null);

  const [isSearchingSibling, setIsSearchingSibling] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    type: "error" | "success";
    title: string;
    message: string;
    invoiceNo?: string | null;
    studentId?: string;
  } | null>(null);
  const [showAdmissionSlip, setShowAdmissionSlip] = React.useState(false);

  const phoneSearchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Available sections for chosen class
  const selectedClass = classes.find((c) => c.id === formData.classId) || classes[0];
  const selectedSection = selectedClass?.sections.find((s) => s.id === formData.sectionId) || selectedClass?.sections[0];

  // Live Age Calculation Helper
  const ageInfo = React.useMemo(() => {
    if (!formData.dob) return null;
    const dob = new Date(formData.dob);
    const today = new Date();
    if (isNaN(dob.getTime()) || dob >= today) return null;

    let years = today.getFullYear() - dob.getFullYear();
    let months = today.getMonth() - dob.getMonth();
    if (months < 0) {
      years--;
      months += 12;
    }
    return { years, months, text: `${years} yrs, ${months} mos` };
  }, [formData.dob]);

  // Section Capacity Stats
  const sectionCapacity = selectedSection?.capacity || 40;
  const sectionEnrolled = selectedSection?.enrolledCount || 0;
  const isSectionFull = sectionEnrolled >= sectionCapacity;
  const availableSeats = Math.max(0, sectionCapacity - sectionEnrolled);

  // Roll Number Availability & Duplicate Detection
  const rollOccupant = React.useMemo(() => {
    const rNo = parseInt(formData.rollNo);
    if (!rNo || !selectedSection?.occupiedRolls) return null;
    return selectedSection.occupiedRolls.find((r) => r.rollNo === rNo) || null;
  }, [formData.rollNo, selectedSection]);

  const nextAvailableRoll = React.useMemo(() => {
    return computeNextAvailableRoll(selectedSection?.occupiedRolls);
  }, [selectedSection]);

  // Handle Class Change with Roll Number Auto-Suggestion
  const handleClassChange = (classId: string) => {
    const cls = classes.find((c) => c.id === classId);
    const firstSec = cls?.sections[0];
    const nextRoll = String(computeNextAvailableRoll(firstSec?.occupiedRolls));

    setFormData((prev) => ({
      ...prev,
      classId,
      sectionId: firstSec?.id || "",
      rollNo: nextRoll,
    }));
  };

  // Handle Section Change with Roll Number Auto-Suggestion
  const handleSectionChange = (sectionId: string) => {
    const sec = selectedClass?.sections.find((s) => s.id === sectionId);
    const nextRoll = String(computeNextAvailableRoll(sec?.occupiedRolls));

    setFormData((prev) => ({
      ...prev,
      sectionId,
      rollNo: nextRoll,
    }));
  };

  // Debounced Sibling Lookup
  const handlePhoneChange = (inputVal: string) => {
    setFormData((prev) => ({ ...prev, primaryPhone: inputVal }));
    setFeedback(null);

    if (phoneSearchTimeoutRef.current) {
      clearTimeout(phoneSearchTimeoutRef.current);
    }

    const clean = inputVal.replace(/\D/g, "").slice(-10);
    if (clean.length === 10) {
      setIsSearchingSibling(true);
      phoneSearchTimeoutRef.current = setTimeout(async () => {
        try {
          const match = await lookupFamilyByPhone(schoolId, clean);
          if (match && match.children.length > 0) {
            setSiblingMatch({
              parentName: match.family.primaryParentName,
              existingStudents: match.children,
            });

            // Auto-fill family contact details if currently empty
            setFormData((prev) => ({
              ...prev,
              primaryParentName: prev.primaryParentName || match.family.primaryParentName,
              secondaryParentName: prev.secondaryParentName || match.family.secondaryParentName || "",
              email: prev.email || match.family.email || "",
              address: prev.address || match.family.address || "",
              occupation: prev.occupation || match.family.occupation || "",
            }));
          } else {
            setSiblingMatch(null);
          }
        } catch (e) {
          console.error("Sibling lookup error:", e);
        } finally {
          setIsSearchingSibling(false);
        }
      }, 350);
    } else {
      setSiblingMatch(null);
      setIsSearchingSibling(false);
    }
  };

  // Comprehensive Pre-Submission Validation
  const validateForm = (): string | null => {
    if (isLocked) {
      return `Academic Year ${academicYearName} is LOCKED. Historical records are strictly read-only.`;
    }

    if (!formData.admissionNo.trim()) {
      return "Admission number is required.";
    }

    if (!formData.firstName.trim() || formData.firstName.trim().length < 2) {
      return "First name must be at least 2 characters.";
    }

    if (!formData.lastName.trim()) {
      return "Last name is required.";
    }

    if (!formData.dob) {
      return "Date of birth is required.";
    }

    const dob = new Date(formData.dob);
    const today = new Date();
    if (dob >= today) {
      return "Date of birth cannot be in the future or today.";
    }

    if (ageInfo && (ageInfo.years < 2 || ageInfo.years > 25)) {
      return `Student age (${ageInfo.text}) is outside standard enrollment guidelines (must be between 2 and 25 years).`;
    }

    if (formData.nationalId && formData.nationalId.trim()) {
      const cleanAadhaar = formData.nationalId.replace(/[\s-]/g, "");
      if (!/^\d{12}$/.test(cleanAadhaar)) {
        return "Student Aadhaar Number must be exactly 12 digits (e.g. 1234 5678 9012).";
      }
    }

    const cleanPhone = formData.primaryPhone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length < 10) {
      return "Primary parent phone number must be a valid 10-digit mobile number.";
    }

    if (!formData.primaryParentName.trim()) {
      return "Primary parent / guardian name is required.";
    }

    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        return "Please provide a valid email address format (e.g. parent@example.com).";
      }
    }

    if (!formData.classId || !formData.sectionId) {
      return "Please select a valid Grade and Section.";
    }

    if (isSectionFull) {
      return `Selected Section ${selectedSection?.name} is full (${sectionCapacity}/${sectionCapacity} seats). Please select another section.`;
    }

    if (rollOccupant) {
      return `Roll Number #${formData.rollNo} is already assigned to ${rollOccupant.studentName} in Section ${selectedSection?.name}. Next available roll number is #${nextAvailableRoll}.`;
    }

    return null;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const validationError = validateForm();
    if (validationError) {
      setFeedback({
        type: "error",
        title: "Validation Error",
        message: validationError,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await admitStudentWithFamilyLink({
        academicYearId,
        classId: formData.classId,
        sectionId: formData.sectionId,
        rollNo: parseInt(formData.rollNo) || undefined,
        admissionNo: formData.admissionNo.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        dob: formData.dob,
        gender: formData.gender,
        bloodGroup: formData.bloodGroup.trim() || undefined,
        medicalFlags: formData.medicalFlags.trim() || undefined,
        nationalId: formData.nationalId.trim() || undefined,
        emergencyContact: formData.emergencyContact.trim() || undefined,
        concessionCategory: formData.concessionCategory,
        primaryParentName: formData.primaryParentName.trim(),
        primaryPhone: formData.primaryPhone,
        secondaryParentName: formData.secondaryParentName.trim() || undefined,
        secondaryPhone: formData.secondaryPhone.trim() || undefined,
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        occupation: formData.occupation.trim() || undefined,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          title: "Admission Successfully Completed!",
          message: `${formData.firstName} ${formData.lastName} (${res.student.admissionNo}) has been formally enrolled in ${selectedClass?.name} - Section ${selectedSection?.name}.`,
          invoiceNo: res.invoice?.invoiceNo || null,
          studentId: res.student.id,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        title: "Admission Failed",
        message: err.message || "An unexpected error occurred during enrollment. Please try again.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintAdmissionSlip = () => {
    const originalTitle = document.title;
    const cleanName = `${formData.firstName}_${formData.lastName}`.replace(/[^a-zA-Z0-9]/g, "_");
    document.title = `Admission_Record_${formData.admissionNo}_${cleanName}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  return (
    <>
      <div className={cn("max-w-4xl mx-auto space-y-5", showAdmissionSlip && "print:hidden")}>
      {/* Back button & Page Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <Link href="/students">
            <Button size="icon" variant="outline" className="h-8 w-8 hover:bg-slate-100">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              New Student Admission
            </h1>
            <p className="text-xs text-slate-500 font-tabular mt-0.5">
              Atomic enrollment • Phone-based sibling auto-linking • Automated fee invoice setup
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={isLocked ? "warning" : "success"} className="text-xs font-mono">
            {academicYearName} {isLocked ? "[LOCKED]" : "[ACTIVE]"}
          </Badge>
          <Button
            type="submit"
            form="admission-form"
            disabled={isLocked || isSubmitting || isSectionFull}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5 h-8 px-3 shadow-xs disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Submit Admission</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Dynamic Feedback Banner (Success / Error) */}
      {feedback && (
        <div
          className={`p-4 rounded-lg border text-xs space-y-2 animate-in fade-in zoom-in-95 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : "bg-red-50 border-red-300 text-red-900"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 font-bold text-sm">
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              )}
              <span>{feedback.title}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="leading-relaxed pl-7">{feedback.message}</p>

          {feedback.type === "success" && (
            <div className="pt-2 pl-7 flex flex-wrap items-center gap-3 border-t border-emerald-200 mt-2">
              {feedback.invoiceNo && (
                <span className="font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-semibold">
                  Invoice Created: {feedback.invoiceNo}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => setShowAdmissionSlip(true)}
                className="bg-white border-emerald-400 text-emerald-950 hover:bg-emerald-100 text-xs h-7 font-bold gap-1.5 shadow-xs"
              >
                <FileText className="h-3.5 w-3.5 text-emerald-700" />
                <span>Download Admission Form (PDF)</span>
              </Button>
              <Link href="/finance/pos">
                <Button size="sm" className="bg-navy-900 text-white font-bold text-xs gap-1.5 h-7">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Collect Admission Fee at POS</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link href="/students">
                <Button size="sm" variant="outline" className="text-xs h-7">
                  View in Student Directory
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Sibling Auto-Link Match Banner */}
      {siblingMatch && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-3 animate-in fade-in">
          <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-blue-950">
                Existing Family Profile Detected ({siblingMatch.parentName})
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">
                SIBLING LINK ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-blue-800">
              This mobile number matches enrolled sibling(s):{" "}
              <strong>
                {siblingMatch.existingStudents
                  .map(
                    (c) =>
                      `${c.firstName} ${c.lastName}${
                        c.className ? ` (${c.className} ${c.sectionName || ""})` : ""
                      }`
                  )
                  .join(", ")}
              </strong>
              . This student will be automatically linked under the same family account.
            </p>
          </div>
        </div>
      )}

      {/* Main Admission Form */}
      <form id="admission-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Academic & Admission Details */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy-900 text-[11px] text-white font-bold">
                1
              </span>
              <span>Admission & Academic Assignment</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-tabular">
              Mandatory academic routing
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block">
                Admission No <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.admissionNo}
                onChange={(e) => setFormData({ ...formData, admissionNo: e.target.value })}
                className="font-mono text-xs font-bold text-navy-800 mt-1"
                placeholder="ADM-2026-0001"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Unique serial identifier
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block">
                Grade / Class <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.classId}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full h-8 text-xs font-medium border border-slate-300 rounded px-2.5 mt-1 bg-white focus:outline-none focus:ring-1 focus:ring-navy-800"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 block">
                  Section <span className="text-red-500">*</span>
                </label>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                    isSectionFull
                      ? "bg-red-100 text-red-800"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {isSectionFull ? "FULL" : `${availableSeats} seats open`}
                </span>
              </div>
              <select
                value={formData.sectionId}
                onChange={(e) => handleSectionChange(e.target.value)}
                className="w-full h-8 text-xs font-medium border border-slate-300 rounded px-2.5 mt-1 bg-white focus:outline-none focus:ring-1 focus:ring-navy-800"
              >
                {selectedClass?.sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    Section {sec.name} ({sec.enrolledCount || 0}/{sec.capacity || 40} seats)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Student Personal Info */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy-900 text-[11px] text-white font-bold">
                2
              </span>
              <span>Student Personal Details</span>
            </h2>
            {ageInfo && (
              <span className="text-[11px] font-semibold text-navy-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Calculated Age: {ageInfo.text}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block">
                First Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="text-xs mt-1"
                placeholder="e.g. Kavin"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block">
                Last Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="text-xs mt-1"
                placeholder="e.g. Kumar / Sundaram"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formData.dob}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                className="text-xs mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                className="w-full h-8 text-xs font-medium border border-slate-300 rounded px-2.5 mt-1 bg-white focus:outline-none focus:ring-1 focus:ring-navy-800"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block">Blood Group</label>
              <select
                value={formData.bloodGroup}
                onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                className="w-full h-8 text-xs font-medium border border-slate-300 rounded px-2.5 mt-1 bg-white focus:outline-none focus:ring-1 focus:ring-navy-800"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 block">
                  Roll Number in Section
                </label>
                {rollOccupant && (
                  <Badge variant="danger" className="text-[9px] px-1.5 py-0">
                    Already Assigned
                  </Badge>
                )}
              </div>
              <Input
                type="number"
                min={1}
                value={formData.rollNo}
                onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                className={`text-xs mt-1 font-tabular ${
                  rollOccupant
                    ? "border-red-400 bg-red-50/40 text-red-900 focus-visible:ring-red-400"
                    : ""
                }`}
              />
              {rollOccupant ? (
                <div className="mt-1 space-y-1">
                  <div className="text-[10px] text-red-600 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0 text-red-600" />
                    <span>Assigned to {rollOccupant.studentName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, rollNo: String(nextAvailableRoll) })}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 transition-colors"
                  >
                    <span>Use Next Free (#{nextAvailableRoll})</span>
                  </button>
                </div>
              ) : (
                <span className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                  <span>Available (Next free: #{nextAvailableRoll})</span>
                </span>
              )}
            </div>

            <div className="sm:col-span-3">
              <label className="text-xs font-semibold text-slate-700 block">
                Medical Notes & Allergy Flags (Optional)
              </label>
              <Input
                value={formData.medicalFlags}
                onChange={(e) => setFormData({ ...formData, medicalFlags: e.target.value })}
                className="text-xs mt-1"
                placeholder="e.g. Mild asthma (uses inhaler); allergic to peanuts"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Family Information & Sibling Linking */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy-900 text-[11px] text-white font-bold">
                3
              </span>
              <span>Parent / Family Profile & Sibling Linking</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-tabular">
              Primary mobile connects siblings under 1 family ID
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 block">
                  Primary Mobile Phone <span className="text-red-500">* (Sibling Key)</span>
                </label>
                {isSearchingSibling && (
                  <span className="text-[10px] text-blue-600 flex items-center gap-1 font-mono">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Looking up...
                  </span>
                )}
              </div>
              <Input
                value={formData.primaryPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="10-digit mobile (e.g. 9876543210)..."
                className="text-xs font-tabular mt-1"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Matches existing family accounts automatically.
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block">
                Primary Parent / Guardian Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.primaryParentName}
                onChange={(e) => setFormData({ ...formData, primaryParentName: e.target.value })}
                className="text-xs mt-1"
                placeholder="e.g. S. Karthikeyan / Murugan"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block">
                Secondary Parent Name (Optional)
              </label>
              <Input
                value={formData.secondaryParentName}
                onChange={(e) => setFormData({ ...formData, secondaryParentName: e.target.value })}
                className="text-xs mt-1"
                placeholder="e.g. Deepa Sundaram"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block">
                Email Address (For Portal & Receipts)
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="text-xs mt-1"
                placeholder="e.g. karthik.sundaram@gmail.com"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Residential Street Address
              </label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="text-xs mt-1"
                placeholder="e.g. 14/2, 4th Main Road, Anna Nagar West, Chennai - 600040"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Fee Concession & Scholarship Scheme */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy-900 text-[11px] text-white font-bold">
                4
              </span>
              <span>Fee Concession & Scholarship Scheme</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-tabular">
              Pre-configured percentage discounts automatically applied to generated invoice
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block">
                Concession Category
              </label>
              <select
                value={formData.concessionCategory}
                onChange={(e) => setFormData({ ...formData, concessionCategory: e.target.value as any })}
                className="w-full h-8 text-xs font-medium border border-slate-300 rounded px-2.5 mt-1 bg-white focus:outline-none focus:ring-1 focus:ring-navy-800"
              >
                <option value="NONE">Standard Fee (0% Discount / Full Tuition)</option>
                <option value="RTE_100">RTE 100% Free Education Quota (100% Fee Waiver)</option>
                <option value="STAFF_WARD_50">Staff Ward Concession (50% Tuition Discount)</option>
                <option value="SIBLING_15">Sibling Concession (15% Tuition Discount)</option>
                <option value="MERIT_25">Merit Scholarship (25% Tuition Discount)</option>
              </select>
            </div>

            <div className="flex items-center">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full space-y-1">
                <span className="font-semibold text-slate-800 block">Applied Discount Rule:</span>
                <span className="text-slate-600 font-mono text-[11px]">
                  {formData.concessionCategory === "RTE_100" && "✓ 100% Full Waiver under Right to Education (Govt Quota)"}
                  {formData.concessionCategory === "STAFF_WARD_50" && "✓ 50% Tuition Discount applied to term fee invoices"}
                  {formData.concessionCategory === "SIBLING_15" && "✓ 15% Sibling Discount auto-applied to term fee invoices"}
                  {formData.concessionCategory === "MERIT_25" && "✓ 25% Academic Merit Scholarship applied to term fee invoices"}
                  {formData.concessionCategory === "NONE" && "• Standard school fee structure without special concession"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 bg-slate-50 p-4 rounded-lg border shadow-xs">
          <Link href="/students">
            <Button type="button" variant="outline" className="text-xs">
              Cancel & Return
            </Button>
          </Link>

          <Button
            type="submit"
            disabled={isLocked || isSubmitting || isSectionFull}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 px-6 h-9 shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Processing Enrollment...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Submit & Complete Admission</span>
              </>
            )}
          </Button>
        </div>
      </form>
      </div>

      {/* Official Admission Application Record / Form Modal */}
      {showAdmissionSlip && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:static print:inset-auto print:p-0 print:m-0 print:bg-white print:overflow-visible print:block print:w-full">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 print:max-w-none print:w-full print:shadow-none print:border-none print:rounded-none print:p-0 print:m-0 print:overflow-visible">
            {/* Modal Header Actions */}
            <div className="px-6 py-3 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <span className="font-bold text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                Official Student Admission Form & Enrollment Record
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handlePrintAdmissionSlip}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-8 gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print / Save PDF
                </Button>
                <button
                  onClick={() => setShowAdmissionSlip(false)}
                  className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Document Body */}
            <div className="p-8 overflow-y-auto space-y-6 text-slate-800 bg-white print:p-0 print:m-0 print:overflow-visible">
              {/* Letterhead */}
              <div className="text-center border-b-2 border-slate-900 pb-4">
                <h2 className="text-lg font-black tracking-wide uppercase text-slate-900">
                  CRESCENT MATRICULATION HIGHER SECONDARY SCHOOL
                </h2>
                <p className="text-[11px] text-slate-600">
                  Affiliated to Tamil Nadu State Board • GSTIN: 33AAAAA0000A1Z5
                </p>
                <p className="text-[11px] text-slate-500">
                  Grand Southern Trunk Road, Chromepet, Chennai - 600045 • Ph: 044-22419000
                </p>
                <div className="mt-2 inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded font-bold text-xs uppercase tracking-wider text-slate-900">
                  STUDENT ADMISSION APPLICATION & ENROLLMENT RECORD
                </div>
              </div>

              {/* Enrollment Meta */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Admission Number</span>
                  <span className="font-mono font-bold text-base text-blue-900">{formData.admissionNo}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Enrolled Class & Section</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedClass?.name} — Section {selectedSection?.name} (Roll #{formData.rollNo})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Academic Session</span>
                  <span className="font-medium text-slate-800">{academicYearName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Date of Admission</span>
                  <span className="font-medium text-slate-800 font-mono">{new Date().toLocaleDateString("en-IN")}</span>
                </div>
              </div>

              {/* Student Demographics */}
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b pb-1">
                  1. Student Demographic Particulars
                </h4>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Full Name</span>
                    <span className="font-bold text-slate-900">{formData.firstName} {formData.lastName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Date of Birth</span>
                    <span className="font-medium text-slate-800">{formData.dob}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Gender</span>
                    <span className="font-medium text-slate-800">{formData.gender}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Blood Group</span>
                    <span className="font-medium text-slate-800">{formData.bloodGroup || "Not Specified"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Aadhaar / National ID</span>
                    <span className="font-mono font-medium text-slate-800">{formData.nationalId || "On File"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Emergency Phone</span>
                    <span className="font-mono font-medium text-slate-800">{formData.emergencyContact || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Family & Guardian Information */}
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b pb-1">
                  2. Parent / Guardian Particulars
                </h4>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Primary Parent / Guardian</span>
                    <span className="font-bold text-slate-900">{formData.primaryParentName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Mobile Contact</span>
                    <span className="font-mono font-bold text-slate-900">{formData.primaryPhone}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Occupation / Designation</span>
                    <span className="text-slate-800">{formData.occupation || "Not Specified"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Secondary Parent</span>
                    <span className="text-slate-800">{formData.secondaryParentName || "—"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[10px]">Residential Address</span>
                    <span className="text-slate-800">{formData.address || "As per submitted address proof"}</span>
                  </div>
                </div>
              </div>

              {/* Concession & Fee Category */}
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded text-xs space-y-1">
                <div className="font-bold text-amber-950 text-[11px]">Enrolled Concession Category:</div>
                <div className="text-amber-900">
                  {formData.concessionCategory === "NONE" && "Standard General Admission (Full Fee)"}
                  {formData.concessionCategory === "RTE_100" && "100% Full Waiver under Right to Education (Govt Quota)"}
                  {formData.concessionCategory === "STAFF_WARD_50" && "50% Tuition Fee Concession (Staff Ward Benefit)"}
                  {formData.concessionCategory === "SIBLING_15" && "15% Sibling Enrollment Discount"}
                  {formData.concessionCategory === "MERIT_25" && "25% Academic Merit Scholarship"}
                </div>
              </div>

              {/* Declaration and Signature */}
              <div className="pt-4 border-t border-slate-300 space-y-8 text-xs">
                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                  I hereby declare that the particulars furnished above are authentic and accurate to the best of my knowledge.
                  I agree to abide by all the academic rules, attendance codes, and fee schedules of Crescent Matriculation School.
                </p>

                <div className="grid grid-cols-2 gap-12 pt-6">
                  <div className="border-t border-slate-400 pt-1 text-center">
                    <span className="block font-semibold text-slate-800 text-[11px]">Signature of Parent / Guardian</span>
                    <span className="text-[10px] text-slate-400">Date: _______________</span>
                  </div>
                  <div className="border-t border-slate-400 pt-1 text-center">
                    <span className="block font-serif italic font-bold text-slate-900 text-[12px]">Dr. K. R. Ramanathan</span>
                    <span className="block font-semibold text-slate-800 text-[11px]">Principal / Head of Institution</span>
                    <span className="text-[10px] text-slate-400">Institutional Seal & Sign</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end print:hidden">
              <Button size="sm" variant="outline" onClick={() => setShowAdmissionSlip(false)} className="text-xs h-8">
                Close Record
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

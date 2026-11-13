"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  CreditCard,
  Calendar,
  Award,
  AlertTriangle,
  CheckCircle2,
  Download,
  ShieldAlert,
  ChevronRight,
  Clock,
  Sparkles,
  BookOpen,
  CalendarPlus,
  FileText,
  Phone,
  Mail,
  School,
  MapPin,
  UserCheck,
  Receipt,
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
import { formatCurrency, formatDate } from "@/lib/utils";
import { payStudentFeeOnline } from "@/actions/finance";
import { generateReportCardPdf } from "@/actions/exams";
import { applyStudentLeave } from "@/actions/attendance";
import { ActionBanner } from "@/components/ui/action-banner";

interface ChildData {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  bloodGroup: string | null;
  walletBalance: string;
  status: string;
  enrollmentId: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  rollNo: number | null;
}

interface InvoiceSummary {
  id: string;
  studentId: string;
  invoiceNo: string;
  installmentLabel: string;
  dueDate: string;
  netAmount: string;
  paidAmount: string;
  status: string;
}

interface ParentPortalClientProps {
  family: {
    id: string;
    primaryParentName: string;
    primaryPhone: string;
    email: string | null;
    address: string | null;
  };
  children: ChildData[];
  selectedStudentId: string;
  duesByStudent: Record<string, { totalDue: number; invoices: InvoiceSummary[] }>;
  recentAttendance: Array<{
    date: string;
    status: string;
    remarks: string | null;
  }>;
  receipts: Array<{
    receiptNo: string;
    amountReceived: string;
    paymentMode: string;
    clearanceStatus: string;
    createdAt: Date;
  }>;
  appliedLeaves?: Array<{
    id: string;
    studentId: string;
    startDate: string;
    endDate: string;
    leaveType: string;
    reason: string;
    status: string;
    createdAt: Date;
  }>;
  homeworkList?: Array<{
    id: string;
    title: string;
    description: string;
    assignedDate: string;
    dueDate: string;
    attachmentUrl?: string | null;
    subjectName: string;
    subjectCode: string;
    teacherName?: string | null;
  }>;
}

export function ParentPortalClient({
  family,
  children,
  selectedStudentId,
  duesByStudent,
  recentAttendance,
  receipts,
  appliedLeaves = [],
  homeworkList = [],
}: ParentPortalClientProps) {
  const router = useRouter();

  const currentStudent =
    children.find((c) => c.id === selectedStudentId) || children[0];

  // Sibling dues: look for other children in family with pending dues
  const otherSiblingsWithDues = children.filter(
    (c) => c.id !== currentStudent?.id && (duesByStudent[c.id]?.totalDue || 0) > 0
  );

  const currentDues = duesByStudent[currentStudent?.id || ""] || { totalDue: 0, invoices: [] };

  const [paymentProcessing, setPaymentProcessing] = React.useState(false);
  const [paymentNotification, setPaymentNotification] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const [reportCardStatus, setReportCardStatus] = React.useState<{
    loading: boolean;
    message?: string;
    isBlocked?: boolean;
  }>({ loading: false });

  // Apply Student Leave Form State
  const [showLeaveForm, setShowLeaveForm] = React.useState(false);
  const [leaveStartDate, setLeaveStartDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [leaveEndDate, setLeaveEndDate] = React.useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0]
  );
  const [leaveType, setLeaveType] = React.useState<"MEDICAL" | "PLANNED" | "CASUAL">("MEDICAL");
  const [leaveReason, setLeaveReason] = React.useState("Severe fever and cough, doctor advised 2 days bed rest");
  const [isApplyingLeave, setIsApplyingLeave] = React.useState(false);
  const [leaveFeedback, setLeaveFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudent) return;
    setIsApplyingLeave(true);
    setLeaveFeedback(null);
    try {
      const res = await applyStudentLeave({
        studentId: currentStudent.id,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        leaveType,
        reason: leaveReason,
        appliedBy: family.primaryParentName,
      });
      if (res.success) {
        setLeaveFeedback({
          type: "success",
          message: `Leave application successfully submitted for ${currentStudent.firstName}! Teacher attendance grid has been notified.`,
        });
        setShowLeaveForm(false);
        router.refresh();
      }
    } catch (err: any) {
      setLeaveFeedback({ type: "error", message: err.message || "Failed to submit leave." });
    } finally {
      setIsApplyingLeave(false);
    }
  };

  // 1-Click Fee Payment
  const handlePayNow = async (invoiceId: string, amount: number) => {
    if (!currentStudent) return;
    setPaymentProcessing(true);
    setPaymentNotification(null);

    try {
      const paymentKey = `pay_online_${currentStudent.id}_${invoiceId}_${amount}_${Date.now()}`;
      const res = await payStudentFeeOnline({
        studentId: currentStudent.id,
        amountReceived: amount,
        paymentMode: "UPI",
        chequeOrTxnRef: `UPI-PARENT-${Date.now().toString().slice(-6)}`,
        idempotencyKey: paymentKey,
        notes: `Online Parent Portal 1-click payment for ${currentStudent.firstName}`,
      });

      if (res.success && res.receipt) {
        setPaymentNotification({
          type: "success",
          message: `Payment of ₹${amount.toLocaleString()} successful! Generated official receipt ${res.receipt.receiptNo}`,
        });
        router.refresh();
      } else {
        setPaymentNotification({
          type: "error",
          message: "Payment failed: " + (res.message || "Unknown error"),
        });
      }
    } catch (err: any) {
      setPaymentNotification({
        type: "error",
        message: "Payment error: " + err.message,
      });
    } finally {
      setPaymentProcessing(false);
    }
  };

  // Report Card Generation & Defaulter Check
  const handleDownloadReportCard = async () => {
    if (!currentStudent) return;
    setReportCardStatus({ loading: true });

    try {
      const res = await generateReportCardPdf({
        studentId: currentStudent.id,
      });

      if (res.isBlocked) {
        setReportCardStatus({
          loading: false,
          isBlocked: true,
          message: res.message,
        });
      } else if (res.success && res.reportCard) {
        setReportCardStatus({
          loading: false,
          isBlocked: false,
          message: `Report card ready: Overall score ${res.reportCard.percentage}% (${res.reportCard.subjectResults.length} subjects evaluated).`,
        });
      } else {
        setReportCardStatus({
          loading: false,
          message: res.message || "Failed to generate report card",
        });
      }
    } catch (err: any) {
      setReportCardStatus({ loading: false, message: err.message });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      {/* Top Header */}
      <div className="bg-navy-900 text-white rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-navy-800 pb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-navy-300 font-semibold">
              Parent Mobile Portal
            </div>
            <h1 className="text-xl font-bold mt-0.5">{family.primaryParentName}</h1>
            <p className="text-xs text-navy-200 mt-0.5">
              Phone: {family.primaryPhone} | Family ID: {family.id}
            </p>
          </div>
          <Badge variant="outline" className="border-navy-400 text-navy-100 self-start sm:self-auto text-xs">
            Crescent Matriculation Higher Secondary School, Chennai
          </Badge>
        </div>

        {/* TOP-BAR SIBLING SWITCHER */}
        <div>
          <div className="text-[11px] font-semibold text-navy-300 font-red mb-2 uppercase tracking-wide">
            Switch Child / Student:
          </div>
          <div className="flex flex-wrap gap-2">
            {children.map((child) => {
              const isSelected = child.id === currentStudent?.id;
              const childDues = duesByStudent[child.id]?.totalDue || 0;

              return (
                <button
                  key={child.id}
                  onClick={() => router.push(`/parent?studentId=${child.id}`)}
                  className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all ${isSelected
                    ? "bg-white text-navy-900 shadow-md ring-2 ring-navy-400"
                    : "bg-navy-800 text-navy-200 hover:bg-navy-700 hover:text-white"
                    }`}
                >
                  <Users className="h-4 w-4" />
                  <div className="text-left">
                    <div>
                      {child.firstName} {child.lastName}
                    </div>
                    <div className="text-[10px] opacity-80">
                      {child.className} - {child.sectionName}
                    </div>
                  </div>
                  {childDues > 0 && (
                    <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-tabular">
                      ₹{childDues.toLocaleString()} due
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SIBLING DUES WARNING BANNER */}
      {otherSiblingsWithDues.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <div className="font-bold">Sibling Pending Fee Notice</div>
            <div>
              {otherSiblingsWithDues.map((s) => (
                <span key={s.id}>
                  Your other child, <span className="font-semibold">{s.firstName}</span> ({s.className} - {s.sectionName}), has an outstanding balance of{" "}
                  <span className="font-bold font-tabular text-red-700">
                    ₹{duesByStudent[s.id]?.totalDue.toLocaleString()}
                  </span>
                  .
                </span>
              ))}
            </div>
            <div className="text-[11px] text-amber-700">
              You can switch to their profile above to settle all dues in one place.
            </div>
          </div>
        </div>
      )}

      {/* Payment Action Banner */}
      {paymentNotification && (
        <ActionBanner
          type={paymentNotification.type}
          message={paymentNotification.message}
          onClose={() => setPaymentNotification(null)}
        />
      )}

      {/* Main Selected Student Content */}
      {currentStudent && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Fee & Invoices Column (Span 2) */}
          <div className="md:col-span-2 space-y-5">
            {/* Fee Dues Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-navy-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Fee Statement & 1-Click Payment
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/students/${currentStudent.id}/ledger`}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 hover:underline"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span>Receipt History & Statement &rarr;</span>
                  </Link>
                  <div className="text-xs font-semibold text-slate-700">
                    Total Pending:{" "}
                    <span className="text-red-700 font-tabular font-bold">
                      ₹{currentDues.totalDue.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {currentDues.invoices.length > 0 ? (
                <div className="space-y-3">
                  {currentDues.invoices.map((inv) => {
                    const net = parseFloat(inv.netAmount);
                    const paid = parseFloat(inv.paidAmount);
                    const due = Math.max(0, net - paid);

                    return (
                      <div
                        key={inv.id}
                        className="p-3.5 border border-slate-200 rounded-lg bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-800">{inv.installmentLabel}</span>
                            <Badge variant={inv.status === "UNPAID" ? "danger" : "warning"} className="text-[10px]">
                              {inv.status}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Invoice: {inv.invoiceNo} | Due Date: {inv.dueDate}
                          </div>
                          <div className="text-xs font-tabular mt-1 text-slate-700">
                            Net: ₹{net.toLocaleString()} | Paid: ₹{paid.toLocaleString()} |{" "}
                            <span className="font-bold text-red-700">Due: ₹{due.toLocaleString()}</span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handlePayNow(inv.id, due)}
                          disabled={paymentProcessing}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 self-start sm:self-auto"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          <span>Pay ₹{due.toLocaleString()}</span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>All fees are fully paid for {currentStudent.firstName}. No outstanding dues!</span>
                </div>
              )}
            </div>

            {/* Attendance & Academics Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-navy-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Recent Attendance Log
                  </h2>
                </div>
                <Badge variant="success" className="text-[10px]">
                  Good Standing (92%)
                </Badge>
              </div>

              {recentAttendance.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
                  {recentAttendance.map((att, i) => (
                    <div key={i} className="p-2.5 flex items-center justify-between text-xs">
                      <span className="font-tabular text-slate-700">{att.date}</span>
                      <Badge
                        variant={att.status === "PRESENT" ? "success" : att.status === "LATE" ? "warning" : "danger"}
                        className="text-[10px]"
                      >
                        {att.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-3 text-center">
                  No attendance records logged for current term yet.
                </div>
              )}
            </div>

            {/* Daily Homework Diary Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Daily Homework Diary
                  </h2>
                </div>
                <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                  {homeworkList.length} Assigned Task{homeworkList.length === 1 ? "" : "s"}
                </Badge>
              </div>

              {homeworkList.length > 0 ? (
                <div className="space-y-3">
                  {homeworkList.map((hw) => (
                    <div
                      key={hw.id}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-900 text-xs">{hw.title}</span>
                          <div className="text-[11px] text-indigo-700 font-semibold mt-0.5">
                            {hw.subjectName} ({hw.subjectCode}) • Teacher: {hw.teacherName || "Subject Teacher"}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono bg-white">
                          Due: {hw.dueDate}
                        </Badge>
                      </div>

                      <p className="text-slate-600 leading-relaxed text-[11px] pt-1">
                        {hw.description}
                      </p>

                      <div className="text-[10px] text-slate-400 font-tabular pt-1 border-t border-slate-200 flex items-center justify-between">
                        <span>Assigned: {hw.assignedDate}</span>
                        {hw.attachmentUrl && (
                          <a
                            href={hw.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline font-semibold"
                          >
                            Download Worksheet 📎
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 py-4 text-center italic bg-slate-50 rounded border">
                  No pending homework tasks posted for {currentStudent.className} - {currentStudent.sectionName} today.
                </div>
              )}
            </div>

            {/* Apply Student Leave Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarPlus className="h-4 w-4 text-amber-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Apply Student Leave
                  </h2>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowLeaveForm(!showLeaveForm)}
                  className="text-xs h-7 gap-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  <span>{showLeaveForm ? "Close Form" : "+ Apply for Leave"}</span>
                </Button>
              </div>

              {leaveFeedback && (
                <ActionBanner
                  type={leaveFeedback.type}
                  message={leaveFeedback.message}
                  onClose={() => setLeaveFeedback(null)}
                />
              )}

              {/* Leave Application Form */}
              {showLeaveForm && (
                <form
                  onSubmit={handleApplyLeave}
                  className="p-4 bg-amber-50/50 border border-amber-200 rounded-lg space-y-3 animate-in fade-in"
                >
                  <div className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                    New Leave Notice for {currentStudent.firstName}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block">Leave Category</label>
                      <select
                        value={leaveType}
                        onChange={(e) => setLeaveType(e.target.value as any)}
                        className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2 mt-0.5"
                      >
                        <option value="MEDICAL">Medical Leave (Doctor Advised)</option>
                        <option value="PLANNED">Planned (Family Function / Travel)</option>
                        <option value="CASUAL">Casual / Personal</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block">From Date</label>
                      <Input
                        type="date"
                        value={leaveStartDate}
                        onChange={(e) => setLeaveStartDate(e.target.value)}
                        className="text-xs h-8 bg-white mt-0.5"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block">To Date</label>
                      <Input
                        type="date"
                        value={leaveEndDate}
                        onChange={(e) => setLeaveEndDate(e.target.value)}
                        className="text-xs h-8 bg-white mt-0.5"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block">Detailed Reason</label>
                    <Input
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      placeholder="e.g. High fever with doctor rest advised..."
                      className="text-xs h-8 bg-white mt-0.5"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t border-amber-200">
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => setShowLeaveForm(false)}
                      className="text-xs h-7"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      type="submit"
                      disabled={isApplyingLeave}
                      className="text-xs h-7 bg-amber-700 hover:bg-amber-800 text-white font-semibold"
                    >
                      {isApplyingLeave ? "Submitting..." : "Notify Class Teacher"}
                    </Button>
                  </div>
                </form>
              )}

              {/* History of Applied Leaves */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Submitted Leave Requests
                </h3>

                {appliedLeaves.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {appliedLeaves.map((l) => (
                      <div key={l.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900">
                            {l.leaveType} Leave: {l.reason}
                          </div>
                          <div className="text-[10px] text-slate-500 font-tabular">
                            Duration: {l.startDate} to {l.endDate}
                          </div>
                        </div>
                        <Badge
                          variant={l.status === "APPROVED" ? "success" : l.status === "REJECTED" ? "danger" : "warning"}
                          className="text-[10px]"
                        >
                          {l.status === "PENDING" ? "Teacher Review Pending" : l.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 py-3 text-center italic bg-slate-50 rounded border">
                    No active leave requests on file for {currentStudent.firstName}.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Column: Student Info & Report Card Download */}
          <div className="space-y-5">
            {/* Student Profile Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Student Details
              </h3>
              <div className="space-y-2 text-xs">
                <div>
                  <div className="text-slate-400 text-[11px]">Full Name</div>
                  <div className="font-semibold text-slate-900">
                    {currentStudent.firstName} {currentStudent.lastName}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">Admission No</div>
                  <div className="font-tabular font-semibold text-slate-900">
                    {currentStudent.admissionNo}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">Class & Section</div>
                  <div className="font-semibold text-slate-900">
                    {currentStudent.className} - {currentStudent.sectionName} (Roll #{currentStudent.rollNo})
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">Date of Birth</div>
                  <div className="font-tabular text-slate-700">{currentStudent.dob}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">Blood Group</div>
                  <div className="font-tabular font-medium text-slate-700">
                    {currentStudent.bloodGroup || "Not Recorded"}
                  </div>
                </div>
              </div>
            </div>

            {/* Report Card Download Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-navy-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Academic Report Card
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Official digital grade card for Term 1 examinations.
              </p>

              {reportCardStatus.isBlocked && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-800 flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Result Withheld: </span>
                    {reportCardStatus.message}
                  </div>
                </div>
              )}

              {reportCardStatus.message && !reportCardStatus.isBlocked && (
                <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-xs text-emerald-800">
                  {reportCardStatus.message}
                </div>
              )}

              <Button
                onClick={handleDownloadReportCard}
                disabled={reportCardStatus.loading}
                variant="outline"
                className="w-full text-xs font-semibold gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{reportCardStatus.loading ? "Generating..." : "View / Download Report Card"}</span>
              </Button>
            </div>

            {/* Upcoming School Events & Holidays Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-navy-800" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    School Events & Holidays
                  </h3>
                </div>
                <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 font-mono">
                  Term 2
                </Badge>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 rounded-md bg-purple-50/60 border border-purple-200 flex items-start gap-2.5">
                  <div className="bg-purple-600 text-white rounded px-1.5 py-1 text-center shrink-0 min-w-9">
                    <div className="text-[9px] font-bold uppercase leading-none">Nov</div>
                    <div className="text-xs font-bold font-tabular leading-none mt-0.5">14</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-purple-950 text-xs truncate">Children's Day Cultural Fest</div>
                    <div className="text-[10px] text-purple-700">Special assembly & costume parade</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-md bg-blue-50/60 border border-blue-200 flex items-start gap-2.5">
                  <div className="bg-blue-600 text-white rounded px-1.5 py-1 text-center shrink-0 min-w-9">
                    <div className="text-[9px] font-bold uppercase leading-none">Nov</div>
                    <div className="text-xs font-bold font-tabular leading-none mt-0.5">17</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-blue-950 text-xs truncate">Term 2 Mid-Semester Exams</div>
                    <div className="text-[10px] text-blue-700">Detailed timetable published on notice board</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-md bg-emerald-50/60 border border-emerald-200 flex items-start gap-2.5">
                  <div className="bg-emerald-600 text-white rounded px-1.5 py-1 text-center shrink-0 min-w-9">
                    <div className="text-[9px] font-bold uppercase leading-none">Nov</div>
                    <div className="text-xs font-bold font-tabular leading-none mt-0.5">19</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-emerald-950 text-xs truncate">Science & Robotics Expo</div>
                    <div className="text-[10px] text-emerald-700">Parents welcome from 10:00 AM</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-md bg-amber-50/60 border border-amber-200 flex items-start gap-2.5">
                  <div className="bg-amber-600 text-white rounded px-1.5 py-1 text-center shrink-0 min-w-9">
                    <div className="text-[9px] font-bold uppercase leading-none">Nov</div>
                    <div className="text-xs font-bold font-tabular leading-none mt-0.5">26</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-amber-950 text-xs truncate">Constitution Day (Assembly)</div>
                    <div className="text-[10px] text-amber-700">Preamble pledge & civic awareness</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact School & Class Teacher Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <School className="h-4 w-4 text-navy-800" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Contact School & Faculty
                </h3>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                    <UserCheck className="h-3.5 w-3.5 text-navy-700" />
                    <span>Class Teacher Desk</span>
                  </div>
                  <div className="text-slate-600 text-[11px] pl-5">
                    {currentStudent.className} - {currentStudent.sectionName} (V. Ananthi)
                  </div>
                  <div className="text-[10px] text-slate-400 pl-5">
                    Available during parent visiting hours: 3:30 PM - 4:15 PM
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href="tel:+914422419000"
                    className="p-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center gap-1.5 text-slate-700 hover:text-navy-900 font-semibold text-[11px] transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Call Reception</span>
                  </a>
                  <a
                    href="mailto:info@crescent.edu"
                    className="p-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center gap-1.5 text-slate-700 hover:text-navy-900 font-semibold text-[11px] transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5 text-blue-600" />
                    <span>Email Office</span>
                  </a>
                </div>

                <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-2 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>Office: Mon–Fri (8:00 AM – 4:30 PM) | Sat (8:30 AM – 1:00 PM)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

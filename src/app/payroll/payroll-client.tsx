"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  UsersRound,
  Calculator,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Send,
  UserCheck,
  UserPlus,
  Plus,
  Search,
  Building,
  CreditCard,
  Briefcase,
  Phone,
  Mail,
  CalendarPlus,
  X,
  Printer,
  Download,
  Pencil,
  TrendingUp,
  TrendingDown,
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
import { formatCurrency, cn } from "@/lib/utils";
import {
  runMonthlyPayroll,
  approveStaffLeaveAndCreateSubstitutions,
  createStaffMember,
  updateStaffMember,
  submitStaffLeave,
} from "@/actions/hr-transport";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionBanner } from "@/components/ui/action-banner";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { SearchableSelect, SearchOption } from "@/components/ui/searchable-select";

export interface StaffDirectoryItem {
  id: string; // staff profile id
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  employeeCode: string;
  designation: string;
  basicSalary: number;
  hra: number;
  casualLeaveBalance: number;
  sickLeaveBalance: number;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  isActive?: boolean;
}

export interface PayrollStaffItem {
  staffId: string;
  empCode: string;
  name: string;
  designation: string;
  basicSalary: number;
  hra: number;
  allowances?: number;
  grossPay: number;
  lopDays: number;
  lopDeduction: number;
  advanceEmi: number;
  epfDeduction: number;
  esiDeduction: number;
  professionalTax: number;
  netPay: number;
  status: "DRAFT" | "APPROVED" | "PAID";
  bankAccount?: string | null;
  bankIfsc?: string | null;
}

export interface LeaveRequestItem {
  id: string;
  staffId: string;
  staffName: string;
  empCode: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysCount: string;
  reason: string | null;
  status: string;
}

interface PayrollClientProps {
  staffDirectory: StaffDirectoryItem[];
  staffList: PayrollStaffItem[];
  leaves: LeaveRequestItem[];
  monthYear: string;
  schoolId: string;
  isLocked: boolean;
}

export function PayrollClient({
  staffDirectory,
  staffList,
  leaves,
  monthYear,
  schoolId,
  isLocked,
}: PayrollClientProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState<"directory" | "payroll" | "leaves">("directory");
  const [searchQuery, setSearchQuery] = React.useState("");

  const [staffRows, setStaffRows] = React.useState<StaffDirectoryItem[]>(staffDirectory);
  React.useEffect(() => {
    setStaffRows(staffDirectory);
  }, [staffDirectory]);

  // Modals
  const [isAddStaffOpen, setIsAddStaffOpen] = React.useState(false);
  const [isEditStaffOpen, setIsEditStaffOpen] = React.useState(false);
  const [isSavingStaff, setIsSavingStaff] = React.useState(false);
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = React.useState(false);
  const [selectedStaffForLeave, setSelectedStaffForLeave] = React.useState<string>("");

  // Form states
  const [addStaffForm, setAddStaffForm] = React.useState({
    name: "",
    email: "",
    phone: "",
    role: "TEACHER" as "TEACHER" | "ACCOUNTANT" | "PRINCIPAL",
    employeeCode: "",
    designation: "",
    basicSalary: 30000,
    hra: 6000,
    casualLeaveBalance: 12,
    sickLeaveBalance: 10,
  });

  const [editStaffForm, setEditStaffForm] = React.useState({
    staffId: "",
    name: "",
    email: "",
    phone: "",
    role: "TEACHER" as "SUPER_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "PARENT",
    employeeCode: "",
    designation: "",
    basicSalary: 30000,
    hra: 6000,
    bankAccountNumber: "",
    bankIfsc: "",
    isActive: true,
    appraisalReason: "",
    originalBasic: 30000,
    originalHra: 6000,
    hikeMode: "AMOUNT" as "AMOUNT" | "PERCENT",
    hikeValue: "",
  });

  const handleOpenEditStaff = (staff: StaffDirectoryItem) => {
    setEditStaffForm({
      staffId: staff.id,
      name: staff.name,
      email: staff.email || "",
      phone: staff.phone || "",
      role: (staff.role as any) || "TEACHER",
      employeeCode: staff.employeeCode,
      designation: staff.designation,
      basicSalary: staff.basicSalary,
      hra: staff.hra,
      bankAccountNumber: staff.bankAccountNumber || "",
      bankIfsc: staff.bankIfsc || "",
      isActive: staff.isActive ?? true,
      appraisalReason: "",
      originalBasic: staff.basicSalary,
      originalHra: staff.hra,
      hikeMode: "AMOUNT",
      hikeValue: "",
    });
    setIsEditStaffOpen(true);
  };

  const handleHikeChange = (val: string, mode: "AMOUNT" | "PERCENT" = editStaffForm.hikeMode) => {
    const num = parseFloat(val);
    let newBasic = editStaffForm.originalBasic;

    if (!isNaN(num)) {
      if (mode === "AMOUNT") {
        newBasic = Math.max(0, Math.round(editStaffForm.originalBasic + num));
      } else {
        newBasic = Math.max(0, Math.round(editStaffForm.originalBasic + (editStaffForm.originalBasic * num) / 100));
      }
    }

    const calculatedHike = newBasic - editStaffForm.originalBasic;
    setEditStaffForm((prev) => ({
      ...prev,
      hikeMode: mode,
      hikeValue: val,
      basicSalary: newBasic,
      appraisalReason:
        calculatedHike > 0
          ? `Annual Appraisal: +₹${calculatedHike.toLocaleString()}/month hike to Basic Salary`
          : prev.appraisalReason,
    }));
  };

  const handleHikeModeChange = (newMode: "AMOUNT" | "PERCENT") => {
    const currentDiff = editStaffForm.basicSalary - editStaffForm.originalBasic;
    let newHikeVal = "";
    if (currentDiff !== 0) {
      if (newMode === "AMOUNT") {
        newHikeVal = String(currentDiff);
      } else {
        newHikeVal = ((currentDiff / editStaffForm.originalBasic) * 100).toFixed(1);
      }
    }
    setEditStaffForm((prev) => ({
      ...prev,
      hikeMode: newMode,
      hikeValue: newHikeVal,
    }));
  };

  const handleBasicSalaryChange = (newBasicVal: number) => {
    const safeVal = Math.max(0, isNaN(newBasicVal) ? 0 : newBasicVal);
    const diff = safeVal - editStaffForm.originalBasic;
    setEditStaffForm((prev) => ({
      ...prev,
      basicSalary: safeVal,
      hikeValue:
        diff !== 0
          ? prev.hikeMode === "AMOUNT"
            ? String(diff)
            : ((diff / prev.originalBasic) * 100).toFixed(1)
          : "",
    }));
  };

  const handleResetHike = () => {
    setEditStaffForm((prev) => ({
      ...prev,
      basicSalary: prev.originalBasic,
      hra: prev.originalHra,
      hikeValue: "",
      appraisalReason: "",
    }));
  };

  const handleSaveStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaffForm.name || !editStaffForm.email || !editStaffForm.phone || !editStaffForm.employeeCode || !editStaffForm.designation) {
      notify("error", "Name, email, phone, employee code, and designation are required.");
      return;
    }
    if (isNaN(editStaffForm.basicSalary) || editStaffForm.basicSalary < 0) {
      notify("error", "Basic salary must be a valid positive amount.");
      return;
    }
    if (isNaN(editStaffForm.hra) || editStaffForm.hra < 0) {
      notify("error", "HRA must be a valid positive amount.");
      return;
    }

    setIsSavingStaff(true);
    try {
      const res = await updateStaffMember({
        staffId: editStaffForm.staffId,
        name: editStaffForm.name.trim(),
        email: editStaffForm.email.trim(),
        phone: editStaffForm.phone.trim(),
        role: editStaffForm.role,
        employeeCode: editStaffForm.employeeCode.trim(),
        designation: editStaffForm.designation.trim(),
        basicSalary: editStaffForm.basicSalary,
        hra: editStaffForm.hra,
        bankAccountNumber: editStaffForm.bankAccountNumber.trim() || undefined,
        bankIfsc: editStaffForm.bankIfsc.trim() || undefined,
        isActive: editStaffForm.isActive,
        appraisalReason: editStaffForm.appraisalReason.trim() || undefined,
      });

      if (res.success) {
        // Update local state for instant reactivity
        setStaffRows((prev) =>
          prev.map((s) =>
            s.id === editStaffForm.staffId
              ? {
                  ...s,
                  name: editStaffForm.name.trim(),
                  email: editStaffForm.email.trim(),
                  phone: editStaffForm.phone.trim(),
                  role: editStaffForm.role,
                  employeeCode: editStaffForm.employeeCode.trim().toUpperCase(),
                  designation: editStaffForm.designation.trim(),
                  basicSalary: editStaffForm.basicSalary,
                  hra: editStaffForm.hra,
                  bankAccountNumber: editStaffForm.bankAccountNumber.trim() || null,
                  bankIfsc: editStaffForm.bankIfsc.trim() || null,
                  isActive: editStaffForm.isActive,
                }
              : s
          )
        );

        setIsEditStaffOpen(false);
        const diff = res.salaryDiff;
        let msg = `Staff member ${editStaffForm.name} updated successfully!`;
        if (diff > 0) {
          msg += ` Salary increment (+₹${diff.toLocaleString()}/month) applied.`;
        } else if (diff < 0) {
          msg += ` Salary adjusted (-₹${Math.abs(diff).toLocaleString()}/month).`;
        }
        notify("success", msg);
        router.refresh();
      }
    } catch (err: any) {
      notify("error", err.message || "Failed to update staff member.");
    } finally {
      setIsSavingStaff(false);
    }
  };

  const [applyLeaveForm, setApplyLeaveForm] = React.useState({
    staffId: "",
    leaveType: "CL" as "CL" | "SL" | "LOP",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    reason: "",
  });

  const [payrollRows, setPayrollRows] = React.useState<PayrollStaffItem[]>(staffList);
  const [notification, setNotification] = React.useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [selectedPayslipStaff, setSelectedPayslipStaff] = React.useState<PayrollStaffItem | null>(null);
  const [showForm16Modal, setShowForm16Modal] = React.useState(false);
  const [selectedForm16Staff, setSelectedForm16Staff] = React.useState<PayrollStaffItem | null>(null);

  const handleExportBankTransferCsv = () => {
    const headers = [
      "Beneficiary_Code",
      "Beneficiary_Name",
      "Bank_Name",
      "Account_Number",
      "IFSC_Code",
      "Payment_Amount",
      "Currency",
      "Value_Date",
      "Narration",
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const todayDate = new Date().toISOString().split("T")[0];
    const rows = payrollRows.map((s) => [
      s.empCode,
      s.name,
      "HDFC BANK LTD",
      s.bankAccount || "50100452391024",
      s.bankIfsc || "HDFC0000240",
      s.netPay.toFixed(2),
      "INR",
      todayDate,
      `Salary Disbursal CMS Chennai ${monthYear}`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Crescent_Bank_Transfer_Batch_${monthYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify("success", `Corporate NetBanking NEFT/RTGS batch exported for ${payrollRows.length} staff!`);
  };

  // In-app Confirmation Dialog
  const [confirmAction, setConfirmAction] = React.useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    confirmText?: string;
    variant?: "danger" | "warning" | "primary";
    action: () => Promise<void>;
  } | null>(null);

  const notify = (type: "success" | "error" | "warning", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 6000);
  };

  React.useEffect(() => {
    setPayrollRows(staffList);
  }, [staffList]);

  const totalDisbursement = payrollRows.reduce((acc, row) => acc + row.netPay, 0);
  const totalRecoveries = payrollRows.reduce(
    (acc, row) => acc + row.lopDeduction + row.advanceEmi,
    0
  );

  const pendingLeaves = leaves.filter((l) => l.status === "PENDING");

  const filteredStaff = React.useMemo(() => {
    if (!searchQuery.trim()) return staffRows;
    const q = searchQuery.toLowerCase();
    return staffRows.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.employeeCode.toLowerCase().includes(q) ||
        s.designation.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q))
    );
  }, [staffRows, searchQuery]);

  // Client-side pagination hooks
  const { paginatedItems: paginatedStaff, paginationProps: staffPagination } = usePagination(filteredStaff, 8);
  const { paginatedItems: paginatedLeaves, paginationProps: leavesPagination } = usePagination(leaves, 6);

  const handle1ClickRun = () => {
    if (isLocked) {
      notify("error", "Academic year is LOCKED.");
      return;
    }

    setConfirmAction({
      isOpen: true,
      title: `Run 1-Click Monthly Payroll (${monthYear})`,
      description: `Run automatic payroll processing for ${payrollRows.length} staff members? This will calculate LOP deductions from unexcused leaves, deduct active advance EMIs, and record official disbursements totaling ${formatCurrency(totalDisbursement)}.`,
      confirmText: "Run Payroll",
      variant: "primary",
      action: async () => {
        setIsProcessing(true);
        try {
          const res = await runMonthlyPayroll({
            monthYear,
          });

          if (res.success) {
            notify(
              "success",
              `1-Click Payroll Run Complete for ${monthYear}: Auto-deducted LOP and Advance EMIs for ${res.count} staff members. Total disbursement of ${formatCurrency(totalDisbursement)} approved & processed successfully.`
            );
            router.refresh();
          }
        } catch (err: any) {
          notify("error", "Payroll run failed: " + err.message);
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const handleApproveLeave = (leaveId: string, staffName: string) => {
    setConfirmAction({
      isOpen: true,
      title: `Approve Leave for ${staffName}`,
      description: `Approve this leave request? The timetable engine will automatically check and arrange period substitutions for any affected classes.`,
      confirmText: "Approve & Substitute",
      variant: "primary",
      action: async () => {
        setIsProcessing(true);
        try {
          const res = await approveStaffLeaveAndCreateSubstitutions({
            leaveId,
          });

          if (res.success) {
            notify(
              "success",
              `Leave approved for ${staffName}! Automatically arranged ${res.substitutionsCount} period substitution(s) on the timetable.`
            );
            router.refresh();
          }
        } catch (err: any) {
          notify("error", "Failed to approve leave: " + err.message);
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStaffForm.name || !addStaffForm.email || !addStaffForm.phone || !addStaffForm.employeeCode || !addStaffForm.designation) {
      notify("error", "Please fill in all required fields.");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await createStaffMember(addStaffForm);
      if (res.success) {
        setIsAddStaffOpen(false);
        setAddStaffForm({
          name: "",
          email: "",
          phone: "",
          role: "TEACHER",
          employeeCode: "",
          designation: "",
          basicSalary: 30000,
          hra: 6000,
          casualLeaveBalance: 12,
          sickLeaveBalance: 10,
        });
        notify("success", `Staff member ${res.user.name} added successfully!`);
        router.refresh();
      }
    } catch (err: any) {
      notify("error", "Failed to add staff member: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const staffId = applyLeaveForm.staffId || selectedStaffForLeave;
    if (!staffId) {
      notify("error", "Please select a staff member.");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await submitStaffLeave({
        staffId,
        leaveType: applyLeaveForm.leaveType,
        startDate: applyLeaveForm.startDate,
        endDate: applyLeaveForm.endDate,
        reason: applyLeaveForm.reason,
      });

      if (res.success) {
        setIsApplyLeaveOpen(false);
        setApplyLeaveForm({
          staffId: "",
          leaveType: "CL",
          startDate: new Date().toISOString().split("T")[0],
          endDate: new Date().toISOString().split("T")[0],
          reason: "",
        });
        notify("success", "Leave application submitted successfully!");
        router.refresh();
      }
    } catch (err: any) {
      notify("error", "Failed to apply for leave: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const staffOptions: SearchOption[] = React.useMemo(() => {
    return staffDirectory.map((s) => ({
      value: s.id,
      label: s.name,
      sublabel: `${s.employeeCode} • ${s.designation}`,
      badge: s.role,
    }));
  }, [staffDirectory]);

  const isPrintingModalOpen = Boolean(selectedPayslipStaff || showForm16Modal);

  const handlePrintPayslip = (staffName: string, empCode: string, period: string) => {
    const originalTitle = document.title;
    document.title = `Payslip_${empCode}_${staffName.replace(/[^a-zA-Z0-9]/g, "_")}_${period}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handlePrintForm16 = (staffName: string, empCode: string) => {
    const originalTitle = document.title;
    document.title = `Form16_${empCode}_${staffName.replace(/[^a-zA-Z0-9]/g, "_")}_FY2026-27`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  return (
    <>
      <div className={cn("space-y-5", isPrintingModalOpen && "print:hidden")}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Staff Directory & 1-Click Monthly Payroll
          </h1>
          <p className="text-xs text-slate-500 font-tabular mt-0.5">
            Manage employee profiles, leave allowances, timetable substitutions, and automated monthly salary disbursements
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => setIsAddStaffOpen(true)}
            className="gap-1.5 font-semibold bg-navy-900 hover:bg-navy-800 text-white text-xs"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>+ Add Staff Member</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedStaffForLeave(staffDirectory[0]?.id || "");
              setIsApplyLeaveOpen(true);
            }}
            className="gap-1.5 font-semibold border-slate-300 text-slate-700 hover:bg-slate-50 text-xs"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            <span>+ Apply Leave</span>
          </Button>

          <Button
            size="sm"
            variant="default"
            onClick={handle1ClickRun}
            disabled={isLocked || isProcessing}
            className="gap-1.5 font-semibold bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>{isProcessing ? "Computing..." : `1-Click ${monthYear} Payroll`}</span>
          </Button>
        </div>
      </div>

      {notification && (
        <ActionBanner
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-1">
          <span className="text-slate-400 block text-[10px] uppercase font-semibold">
            Active Staff Roster
          </span>
          <div className="text-xl font-bold text-slate-900 font-tabular">
            {staffDirectory.length} Employees
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-1">
          <span className="text-slate-400 block text-[10px] uppercase font-semibold">
            Net Monthly Disbursement
          </span>
          <div className="text-xl font-bold text-slate-900 font-tabular">
            {formatCurrency(totalDisbursement)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-1">
          <span className="text-slate-400 block text-[10px] uppercase font-semibold">
            Advance EMI & LOP Deducted
          </span>
          <div className="text-xl font-bold text-emerald-700 font-tabular">
            {formatCurrency(totalRecoveries)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-1">
          <span className="text-slate-400 block text-[10px] uppercase font-semibold">
            Pending Leave Requests
          </span>
          <div className="text-xl font-bold text-amber-600 font-tabular">
            {pendingLeaves.length} Applications
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-1 sm:gap-2 overflow-x-auto no-scrollbar pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("directory")}
          className={`py-2 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
            activeTab === "directory"
              ? "border-navy-900 text-navy-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <UsersRound className="h-4 w-4 shrink-0" />
          <span>Staff Directory ({staffDirectory.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payroll")}
          className={`py-2 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
            activeTab === "payroll"
              ? "border-navy-900 text-navy-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <DollarSign className="h-4 w-4 shrink-0" />
          <span>Monthly Payroll Run ({monthYear})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("leaves")}
          className={`py-2 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
            activeTab === "leaves"
              ? "border-navy-900 text-navy-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CalendarCheck className="h-4 w-4 shrink-0" />
          <span>Leave Register & Substitutions</span>
          {pendingLeaves.length > 0 && (
            <Badge variant="warning" className="h-4 px-1.5 text-[9px] shrink-0">
              {pendingLeaves.length}
            </Badge>
          )}
        </button>
      </div>

      {/* TAB 1: Staff Directory */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search name, code, designation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing {filteredStaff.length} of {staffDirectory.length} employees
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50">
                  <TableHead>Code</TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Designation & Role</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead isNumeric>Basic + HRA</TableHead>
                  <TableHead isNumeric>Leave Balance</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                      No staff members found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedStaff.map((staff) => (
                    <TableRow key={staff.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-xs font-semibold text-navy-900">
                        {staff.employeeCode}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-900 text-xs">{staff.name}</span>
                          {staff.isActive === false && (
                            <Badge variant="danger" className="text-[9px] px-1 py-0">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {staff.id.slice(0, 8)}...</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium text-slate-800">{staff.designation}</div>
                        <Badge variant="neutral" className="text-[10px] uppercase font-mono mt-0.5">
                          {staff.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-[11px] text-slate-600 flex items-center gap-1">
                          <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{staff.email || "—"}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{staff.phone || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell isNumeric>
                        <div className="font-mono font-medium text-slate-900 text-xs">
                          {formatCurrency(staff.basicSalary + staff.hra)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          B: {formatCurrency(staff.basicSalary)} • H: {formatCurrency(staff.hra)}
                        </div>
                      </TableCell>
                      <TableCell isNumeric>
                        <div className="text-xs font-mono">
                          <span className="text-emerald-700 font-semibold">{staff.casualLeaveBalance} CL</span>
                          {" / "}
                          <span className="text-blue-700 font-semibold">{staff.sickLeaveBalance} SL</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEditStaff(staff)}
                            disabled={isLocked}
                            className="h-7 text-xs border-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 font-semibold gap-1 px-2"
                          >
                            <Pencil className="h-3 w-3 text-blue-600" />
                            <span>Edit / Appraise</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedStaffForLeave(staff.id);
                              setIsApplyLeaveOpen(true);
                            }}
                            className="h-7 text-xs border-slate-200 hover:bg-slate-50 text-slate-600 px-2"
                          >
                            Apply Leave
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Pagination {...staffPagination} />
          </div>
        </div>
      )}

      {/* TAB 2: Monthly Payroll Runs */}
      {activeTab === "payroll" && (
        <div className="space-y-3">
          {/* Payroll Toolbar Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-800">
                Payroll Cycle: {monthYear} • {payrollRows.length} Salaried Staff Disbursed
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportBankTransferCsv}
                className="text-xs h-8 bg-white border-slate-300 text-slate-700 font-semibold gap-1.5 shadow-xs hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5 text-blue-600" />
                <span>Export Bank Transfer Batch (CSV)</span>
              </Button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50">
                  <TableHead>Employee</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead isNumeric>Basic / Gross</TableHead>
                  <TableHead isNumeric className="text-slate-700">EPF (12%)</TableHead>
                  <TableHead isNumeric className="text-slate-700">ESI (0.75%)</TableHead>
                  <TableHead isNumeric className="text-slate-700">TN Prof Tax</TableHead>
                  <TableHead isNumeric>LOP & Advances</TableHead>
                  <TableHead isNumeric className="font-bold text-navy-900">
                    Net Disbursable
                  </TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-6 text-slate-400 text-xs">
                      No payroll entries generated for this cycle. Click "1-Click Payroll Run" above to calculate.
                    </TableCell>
                  </TableRow>
                ) : (
                  payrollRows.map((row) => (
                    <TableRow key={row.staffId} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="font-semibold text-slate-900 text-xs">{row.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{row.empCode}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">{row.designation}</TableCell>
                      <TableCell isNumeric className="font-mono text-xs">
                        <div className="font-semibold text-slate-900">{formatCurrency(row.grossPay)}</div>
                        <div className="text-[10px] text-slate-400">Basic: {formatCurrency(row.basicSalary)}</div>
                      </TableCell>
                      <TableCell isNumeric className="font-mono text-xs text-slate-700">
                        {formatCurrency(row.epfDeduction)}
                      </TableCell>
                      <TableCell isNumeric className="font-mono text-xs text-slate-700">
                        {row.esiDeduction > 0 ? formatCurrency(row.esiDeduction) : <span className="text-slate-400 text-[10px]">Exempt</span>}
                      </TableCell>
                      <TableCell isNumeric className="font-mono text-xs text-slate-700">
                        {row.professionalTax > 0 ? formatCurrency(row.professionalTax) : <span className="text-slate-400 text-[10px]">₹0</span>}
                      </TableCell>
                      <TableCell isNumeric className="font-mono text-xs text-rose-600">
                        {row.lopDeduction > 0 || row.advanceEmi > 0 ? (
                          <div>
                            {row.lopDeduction > 0 && <div>LOP: -{formatCurrency(row.lopDeduction)}</div>}
                            {row.advanceEmi > 0 && <div className="text-amber-700">Adv: -{formatCurrency(row.advanceEmi)}</div>}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell isNumeric className="font-mono font-bold text-navy-900 text-xs">
                        {formatCurrency(row.netPay)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            row.status === "PAID"
                              ? "neutral"
                              : row.status === "APPROVED"
                              ? "primary"
                              : "warning"
                          }
                          className="text-[10px]"
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-4 space-x-1.5 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedPayslipStaff(row)}
                          className="h-7 text-[11px] px-2 gap-1 font-semibold text-blue-700 hover:bg-blue-50 border-blue-200"
                        >
                          <Printer className="h-3 w-3" />
                          <span>Payslip PDF</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedForm16Staff(row);
                            setShowForm16Modal(true);
                          }}
                          className="h-7 text-[11px] px-2 gap-1 font-semibold text-purple-700 hover:bg-purple-50 border-purple-200"
                        >
                          <FileText className="h-3 w-3" />
                          <span>Form 16</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* TAB 3: Leave Register & Substitutions */}
      {activeTab === "leaves" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Staff Leave Applications & Automated Substitution Arranger
              </h2>
              <p className="text-xs text-slate-500">
                Approving a leave automatically arranges conflict-free substitute teachers for scheduled timetable periods.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setSelectedStaffForLeave(staffDirectory[0]?.id || "");
                setIsApplyLeaveOpen(true);
              }}
              className="gap-1.5 text-xs bg-navy-900 text-white"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              <span>+ Apply Leave</span>
            </Button>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50">
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                      No leave records recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLeaves.map((l) => (
                    <TableRow key={l.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <span className="font-bold text-slate-900 text-xs">{l.staffName}</span>
                        <span className="text-slate-400 ml-1.5 font-mono text-[10px]">({l.empCode})</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={l.leaveType === "LOP" ? "danger" : l.leaveType === "SL" ? "warning" : "primary"}
                          className="text-[10px]"
                        >
                          {l.leaveType === "CL" ? "Casual (CL)" : l.leaveType === "SL" ? "Sick (SL)" : "Loss of Pay (LOP)"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-tabular text-xs text-slate-700">
                        {l.startDate} to {l.endDate}
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-slate-900">
                        {l.daysCount} days
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 max-w-xs truncate">
                        {l.reason || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={l.status === "APPROVED" ? "neutral" : l.status === "REJECTED" ? "danger" : "warning"}
                          className="text-[10px]"
                        >
                          {l.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {l.status === "PENDING" && (
                          <Button
                            size="sm"
                            onClick={() => handleApproveLeave(l.id, l.staffName)}
                            disabled={isProcessing}
                            className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1"
                          >
                            <UserCheck className="h-3 w-3" />
                            <span>Approve & Substitute</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Pagination {...leavesPagination} />
          </div>
        </div>
      )}

      {/* MODAL: + Add Staff Member */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <UserPlus className="h-4 w-4 text-navy-800" />
                <h3 className="text-sm font-bold text-slate-900">Add New Staff Member</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Full Name *</label>
                  <Input
                    required
                    placeholder="e.g. S. Meenakshi"
                    value={addStaffForm.name}
                    onChange={(e) => setAddStaffForm({ ...addStaffForm, name: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Employee Code *</label>
                  <Input
                    required
                    placeholder="e.g. EMP-088"
                    value={addStaffForm.employeeCode}
                    onChange={(e) => setAddStaffForm({ ...addStaffForm, employeeCode: e.target.value })}
                    className="h-8 text-xs uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Email Address *</label>
                  <Input
                    type="email"
                    required
                    placeholder="meenakshi@crescent.edu"
                    value={addStaffForm.email}
                    onChange={(e) => setAddStaffForm({ ...addStaffForm, email: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Phone Number *</label>
                  <Input
                    type="tel"
                    required
                    placeholder="9840123456"
                    value={addStaffForm.phone}
                    onChange={(e) => setAddStaffForm({ ...addStaffForm, phone: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Designation *</label>
                  <Input
                    required
                    placeholder="e.g. PGT Biology / Bus Driver"
                    value={addStaffForm.designation}
                    onChange={(e) => setAddStaffForm({ ...addStaffForm, designation: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">System Role</label>
                  <select
                    value={addStaffForm.role}
                    onChange={(e) => setAddStaffForm({ ...addStaffForm, role: e.target.value as any })}
                    className="w-full h-8 text-xs border border-slate-300 rounded px-2 bg-white"
                  >
                    <option value="TEACHER">TEACHER</option>
                    <option value="ACCOUNTANT">ACCOUNTANT</option>
                    <option value="PRINCIPAL">PRINCIPAL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Basic Monthly Salary (₹) *</label>
                  <Input
                    type="number"
                    min="5000"
                    step="500"
                    required
                    value={addStaffForm.basicSalary}
                    onChange={(e) => setAddStaffForm({ ...addStaffForm, basicSalary: Number(e.target.value) })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">HRA Allowance (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    step="500"
                    value={addStaffForm.hra}
                    onChange={(e) => setAddStaffForm({ ...addStaffForm, hra: Number(e.target.value) })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Casual Leave (CL) Balance</label>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    value={addStaffForm.casualLeaveBalance}
                    onChange={(e) => setAddStaffForm({ ...addStaffForm, casualLeaveBalance: Number(e.target.value) })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Sick Leave (SL) Balance</label>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    value={addStaffForm.sickLeaveBalance}
                    onChange={(e) => setAddStaffForm({ ...addStaffForm, sickLeaveBalance: Number(e.target.value) })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isProcessing}
                  className="h-8 text-xs bg-navy-900 text-white font-semibold"
                >
                  {isProcessing ? "Adding..." : "Add Staff Member"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Staff & Salary Appraisal */}
      {isEditStaffOpen && (() => {
        const oldTotal = editStaffForm.originalBasic + editStaffForm.originalHra;
        const newTotal = (Number(editStaffForm.basicSalary) || 0) + (Number(editStaffForm.hra) || 0);
        const diff = newTotal - oldTotal;
        const pct = oldTotal > 0 ? ((diff / oldTotal) * 100).toFixed(1) : "0.0";

        return (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl p-5 space-y-4 my-auto animate-in fade-in zoom-in-95 max-h-[95vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="h-7 w-7 rounded-md bg-blue-100 text-blue-900 flex items-center justify-center">
                    <Pencil className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Edit Staff & Compensation Appraisal
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Update profile, revise salary package, or adjust employment status.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditStaffOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveStaffSubmit} className="space-y-4">
                {/* 1. Core Profile Details */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    1. Basic Profile & Role
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700">Full Name *</label>
                      <Input
                        required
                        value={editStaffForm.name}
                        onChange={(e) => setEditStaffForm({ ...editStaffForm, name: e.target.value })}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700">Employee Code *</label>
                      <Input
                        required
                        value={editStaffForm.employeeCode}
                        onChange={(e) => setEditStaffForm({ ...editStaffForm, employeeCode: e.target.value })}
                        className="h-8 text-xs font-mono uppercase bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700">Email Address *</label>
                      <Input
                        type="email"
                        required
                        value={editStaffForm.email}
                        onChange={(e) => setEditStaffForm({ ...editStaffForm, email: e.target.value })}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700">Phone Number *</label>
                      <Input
                        type="tel"
                        required
                        value={editStaffForm.phone}
                        onChange={(e) => setEditStaffForm({ ...editStaffForm, phone: e.target.value })}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700">Designation / Title *</label>
                      <Input
                        required
                        placeholder="e.g. Senior PGT Mathematics"
                        value={editStaffForm.designation}
                        onChange={(e) => setEditStaffForm({ ...editStaffForm, designation: e.target.value })}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700">System Role</label>
                      <select
                        value={editStaffForm.role}
                        onChange={(e) => setEditStaffForm({ ...editStaffForm, role: e.target.value as any })}
                        className="w-full h-8 text-xs border border-slate-300 rounded px-2 bg-white"
                      >
                        <option value="TEACHER">TEACHER</option>
                        <option value="ACCOUNTANT">ACCOUNTANT</option>
                        <option value="PRINCIPAL">PRINCIPAL</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">Employment Status</label>
                    <select
                      value={editStaffForm.isActive ? "ACTIVE" : "INACTIVE"}
                      onChange={(e) => setEditStaffForm({ ...editStaffForm, isActive: e.target.value === "ACTIVE" })}
                      className="w-full h-8 text-xs border border-slate-300 rounded px-2 bg-white font-medium"
                    >
                      <option value="ACTIVE">✅ ACTIVE (Currently Employed & on Roster)</option>
                      <option value="INACTIVE">⛔ INACTIVE / RELIEVED (Resigned or on extended leave)</option>
                    </select>
                  </div>
                </div>

                {/* 2. Compensation & Salary Appraisal Calculator */}
                <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-blue-700" />
                      <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                        2. Salary Structure & Appraisal
                      </span>
                    </div>

                    {/* Live Diff Badge */}
                    {diff > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                        <TrendingUp className="h-3 w-3 text-emerald-700" />
                        <span>+₹{diff.toLocaleString()} (+{pct}% Hike)</span>
                      </span>
                    ) : diff < 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-full">
                        <TrendingDown className="h-3 w-3 text-rose-700" />
                        <span>-₹{Math.abs(diff).toLocaleString()} Adjustment</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded">
                        No Change
                      </span>
                    )}
                  </div>

                  {/* Dedicated Appraisal / Hike Amount Entry */}
                  <div className="bg-white p-3 rounded-lg border border-blue-200/90 shadow-2xs space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-blue-700" />
                        <span>Enter Appraisal Hike Amount / %</span>
                      </label>
                      <div className="flex items-center rounded border border-slate-300 p-0.5 bg-slate-100 text-[10px]">
                        <button
                          type="button"
                          onClick={() => handleHikeModeChange("AMOUNT")}
                          className={`px-2.5 py-0.5 rounded font-bold transition-colors ${
                            editStaffForm.hikeMode === "AMOUNT"
                              ? "bg-blue-900 text-white shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Hike Amount (₹)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHikeModeChange("PERCENT")}
                          className={`px-2.5 py-0.5 rounded font-bold transition-colors ${
                            editStaffForm.hikeMode === "PERCENT"
                              ? "bg-blue-900 text-white shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Percentage (%)
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-500">
                          {editStaffForm.hikeMode === "AMOUNT" ? "+ ₹" : "+"}
                        </span>
                        <Input
                          type="number"
                          step={editStaffForm.hikeMode === "AMOUNT" ? "500" : "0.5"}
                          placeholder={editStaffForm.hikeMode === "AMOUNT" ? "e.g. 5000" : "e.g. 10"}
                          value={editStaffForm.hikeValue}
                          onChange={(e) => handleHikeChange(e.target.value)}
                          className="h-8 pl-9 pr-6 text-xs font-mono font-bold bg-white border-blue-300 focus:border-blue-500"
                        />
                        {editStaffForm.hikeMode === "PERCENT" && (
                          <span className="absolute right-2.5 top-2 text-xs font-bold text-slate-400">
                            %
                          </span>
                        )}
                      </div>

                      {diff !== 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleResetHike}
                          className="h-8 text-xs border-slate-300 hover:bg-slate-100 text-slate-600 px-2.5 shrink-0"
                          title="Reset to original salary"
                        >
                          Reset
                        </Button>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-500 leading-tight">
                      {editStaffForm.hikeMode === "AMOUNT"
                        ? `Typing a hike amount (e.g. 5,000) automatically increases Basic Salary from ₹${editStaffForm.originalBasic.toLocaleString()} to ₹${editStaffForm.basicSalary.toLocaleString()}.`
                        : `Typing a hike % (e.g. 10%) automatically computes the increment on Basic Salary (₹${editStaffForm.originalBasic.toLocaleString()}).`}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700">Basic Salary (₹) *</label>
                      <Input
                        type="number"
                        min="0"
                        step="500"
                        required
                        value={editStaffForm.basicSalary}
                        onChange={(e) => handleBasicSalaryChange(Number(e.target.value))}
                        className="h-8 text-xs font-mono font-bold bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700">HRA Allowance (₹) *</label>
                      <Input
                        type="number"
                        min="0"
                        step="500"
                        required
                        value={editStaffForm.hra}
                        onChange={(e) => setEditStaffForm({ ...editStaffForm, hra: Number(e.target.value) })}
                        className="h-8 text-xs font-mono font-bold bg-white"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded border border-blue-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Previous Package:</span>
                      <span className="font-mono text-slate-600 font-semibold">₹{oldTotal.toLocaleString()}</span>
                    </div>
                    {diff !== 0 && (
                      <div className="text-center">
                        <span className="text-slate-400 text-[10px] block">Appraisal Hike:</span>
                        <span className={`font-mono font-bold ${diff > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {diff > 0 ? `+₹${diff.toLocaleString()}` : `-₹${Math.abs(diff).toLocaleString()}`} ({pct}%)
                        </span>
                      </div>
                    )}
                    <div className="text-right">
                      <span className="text-slate-400 text-[10px] block">New Monthly Gross:</span>
                      <span className="font-mono text-blue-900 font-bold text-sm">₹{newTotal.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Appraisal / Increment Reason (for Audit Log)
                    </label>
                    <Input
                      placeholder="e.g. Annual Appraisal 2026-27 approved by Correspondent"
                      value={editStaffForm.appraisalReason}
                      onChange={(e) => setEditStaffForm({ ...editStaffForm, appraisalReason: e.target.value })}
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>

                {/* 3. Banking Details */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    3. Banking Details (for Direct Deposit)
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700">Bank Account Number</label>
                      <Input
                        placeholder="e.g. 50100234567890"
                        value={editStaffForm.bankAccountNumber}
                        onChange={(e) => setEditStaffForm({ ...editStaffForm, bankAccountNumber: e.target.value })}
                        className="h-8 text-xs font-mono bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700">Bank IFSC Code</label>
                      <Input
                        placeholder="e.g. HDFC0001024"
                        value={editStaffForm.bankIfsc}
                        onChange={(e) => setEditStaffForm({ ...editStaffForm, bankIfsc: e.target.value })}
                        className="h-8 text-xs font-mono uppercase bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditStaffOpen(false)}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSavingStaff}
                    className="h-8 text-xs bg-navy-900 hover:bg-navy-800 text-white font-semibold gap-1.5 px-4"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{isSavingStaff ? "Saving..." : "Save & Update Profile"}</span>
                  </Button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL: + Apply for Leave */}
      {isApplyLeaveOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <CalendarPlus className="h-4 w-4 text-navy-800" />
                <h3 className="text-sm font-bold text-slate-900">Apply for Staff Leave</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsApplyLeaveOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleApplyLeaveSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Staff Member *</label>
                <SearchableSelect
                  options={staffOptions}
                  value={applyLeaveForm.staffId || selectedStaffForLeave}
                  onChange={(val) => {
                    setApplyLeaveForm({ ...applyLeaveForm, staffId: val });
                    setSelectedStaffForLeave(val);
                  }}
                  placeholder="Search staff by name, code or designation..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Leave Type</label>
                <select
                  value={applyLeaveForm.leaveType}
                  onChange={(e) => setApplyLeaveForm({ ...applyLeaveForm, leaveType: e.target.value as any })}
                  className="w-full h-8 text-xs border border-slate-300 rounded px-2 bg-white"
                >
                  <option value="CL">Casual Leave (CL - Paid)</option>
                  <option value="SL">Sick Leave (SL - Medical)</option>
                  <option value="LOP">Loss of Pay (LOP - Auto-deducts from Payroll)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Start Date *</label>
                  <Input
                    type="date"
                    required
                    value={applyLeaveForm.startDate}
                    onChange={(e) => setApplyLeaveForm({ ...applyLeaveForm, startDate: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">End Date *</label>
                  <Input
                    type="date"
                    required
                    value={applyLeaveForm.endDate}
                    onChange={(e) => setApplyLeaveForm({ ...applyLeaveForm, endDate: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Reason for Leave</label>
                <Input
                  placeholder="e.g. Family function / Medical consultation"
                  value={applyLeaveForm.reason}
                  onChange={(e) => setApplyLeaveForm({ ...applyLeaveForm, reason: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsApplyLeaveOpen(false)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isProcessing}
                  className="h-8 text-xs bg-navy-900 text-white font-semibold"
                >
                  {isProcessing ? "Submitting..." : "Submit Application"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modern In-App Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!confirmAction?.isOpen}
        title={confirmAction?.title || ""}
        description={confirmAction?.description || ""}
        confirmText={confirmAction?.confirmText}
        variant={confirmAction?.variant}
        onConfirm={async () => {
          if (confirmAction) {
            await confirmAction.action();
            setConfirmAction(null);
          }
        }}
        onCancel={() => setConfirmAction(null)}
      />
      </div>

      {/* Official Crescent Matriculation School Payslip Modal (Features 8 & 9) */}
      {selectedPayslipStaff && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 p-2 sm:p-6 overflow-y-auto print:static print:inset-auto print:p-0 print:m-0 print:bg-white print:overflow-visible print:block print:w-full">
          <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full mx-auto my-auto flex flex-col overflow-hidden max-h-[95vh] print:max-w-none print:w-full print:shadow-none print:border-none print:rounded-none print:p-0 print:m-0 print:overflow-visible">
            {/* Top Toolbar - HIDDEN IN PRINT/PDF */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white shrink-0 print:hidden">
              <div className="flex items-center gap-2 flex-wrap">
                <Printer className="h-4 w-4 text-emerald-400" />
                <span className="font-bold text-xs">
                  Official Salary Payslip — {selectedPayslipStaff.name} ({monthYear})
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={() =>
                    handlePrintPayslip(
                      selectedPayslipStaff.name,
                      selectedPayslipStaff.empCode,
                      monthYear
                    )
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-8 px-3"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print / Save Payslip PDF</span>
                </Button>
                <button
                  onClick={() => setSelectedPayslipStaff(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Payslip Container */}
            <div className="p-8 overflow-y-auto bg-white print:p-0 print:m-0 print:overflow-visible">
              {/* School Letterhead */}
              <div className="text-center border-b-2 border-slate-900 pb-4 mb-5">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="h-8 w-8 rounded bg-navy-900 text-white font-bold text-sm flex items-center justify-center font-mono">
                    CMS
                  </div>
                  <h1 className="text-xl font-black tracking-wider text-slate-900 uppercase">
                    Crescent Matriculation Higher Secondary School
                  </h1>
                </div>
                <p className="text-[11px] text-slate-600 font-medium">
                  Recognized by Govt. of Tamil Nadu • Kodambakkam, Chennai - 600024 • Phone: 044-24830000
                </p>
                <div className="inline-block mt-2 px-3 py-0.5 bg-slate-900 text-white text-[11px] font-bold tracking-widest uppercase rounded">
                  Salary Payslip — {monthYear}
                </div>
              </div>

              {/* Employee Particulars Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs mb-5">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Employee Name</span>
                  <strong className="text-slate-900 text-sm">{selectedPayslipStaff.name}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Employee Code</span>
                  <strong className="text-slate-900 font-mono text-sm">{selectedPayslipStaff.empCode}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Designation</span>
                  <strong className="text-slate-900">{selectedPayslipStaff.designation}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Payment Status</span>
                  <strong className="text-emerald-700">{selectedPayslipStaff.status}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Bank Account</span>
                  <span className="text-slate-800 font-mono text-[11px]">{selectedPayslipStaff.bankAccount || "A/C on file"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Bank IFSC</span>
                  <span className="text-slate-800 font-mono text-[11px]">{selectedPayslipStaff.bankIfsc || "CMSB0001024"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">LOP Days</span>
                  <span className="text-slate-800 font-semibold">{selectedPayslipStaff.lopDays} Days</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Pay Period</span>
                  <span className="text-slate-800 font-semibold">30 Days</span>
                </div>
              </div>

              {/* Earnings & Deductions Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                {/* Earnings Column */}
                <div className="border border-slate-300 rounded overflow-hidden">
                  <div className="bg-slate-100 px-3 py-1.5 font-bold text-xs text-slate-800 border-b border-slate-300">
                    EARNINGS & ALLOWANCES
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-1.5 text-slate-700">Basic Salary</td>
                        <td className="px-3 py-1.5 text-right font-mono font-semibold">{formatCurrency(selectedPayslipStaff.basicSalary)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-1.5 text-slate-700">House Rent Allowance (HRA)</td>
                        <td className="px-3 py-1.5 text-right font-mono font-semibold">{formatCurrency(selectedPayslipStaff.hra)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-1.5 text-slate-700">Special / Conveyance Allowances</td>
                        <td className="px-3 py-1.5 text-right font-mono font-semibold">{formatCurrency(selectedPayslipStaff.allowances || 0)}</td>
                      </tr>
                      <tr className="bg-slate-50 font-bold border-t border-slate-300">
                        <td className="px-3 py-2 text-slate-900">GROSS EARNINGS</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-800 font-bold">{formatCurrency(selectedPayslipStaff.grossPay)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Deductions Column */}
                <div className="border border-slate-300 rounded overflow-hidden">
                  <div className="bg-slate-100 px-3 py-1.5 font-bold text-xs text-slate-800 border-b border-slate-300">
                    STATUTORY & OTHER DEDUCTIONS
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-1.5 text-slate-700">Employee Provident Fund (EPF 12%)</td>
                        <td className="px-3 py-1.5 text-right font-mono text-rose-700">-{formatCurrency(selectedPayslipStaff.epfDeduction)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-1.5 text-slate-700">Employee State Insurance (ESI 0.75%)</td>
                        <td className="px-3 py-1.5 text-right font-mono text-rose-700">
                          {selectedPayslipStaff.esiDeduction > 0 ? `-${formatCurrency(selectedPayslipStaff.esiDeduction)}` : "₹0.00 (Exempt)"}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-1.5 text-slate-700">Tamil Nadu Professional Tax (TN PT)</td>
                        <td className="px-3 py-1.5 text-right font-mono text-rose-700">
                          {selectedPayslipStaff.professionalTax > 0 ? `-${formatCurrency(selectedPayslipStaff.professionalTax)}` : "₹0.00"}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-1.5 text-slate-700">Loss of Pay (LOP Deduction)</td>
                        <td className="px-3 py-1.5 text-right font-mono text-rose-700">
                          {selectedPayslipStaff.lopDeduction > 0 ? `-${formatCurrency(selectedPayslipStaff.lopDeduction)}` : "₹0.00"}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-1.5 text-slate-700">Staff Advance Recovery EMI</td>
                        <td className="px-3 py-1.5 text-right font-mono text-amber-700">
                          {selectedPayslipStaff.advanceEmi > 0 ? `-${formatCurrency(selectedPayslipStaff.advanceEmi)}` : "₹0.00"}
                        </td>
                      </tr>
                      <tr className="bg-slate-50 font-bold border-t border-slate-300">
                        <td className="px-3 py-2 text-slate-900">TOTAL DEDUCTIONS</td>
                        <td className="px-3 py-2 text-right font-mono text-rose-800 font-bold">
                          -{formatCurrency(
                            selectedPayslipStaff.epfDeduction +
                              selectedPayslipStaff.esiDeduction +
                              selectedPayslipStaff.professionalTax +
                              selectedPayslipStaff.lopDeduction +
                              selectedPayslipStaff.advanceEmi
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Net Disbursable Highlight Bar */}
              <div className="bg-navy-900 text-white p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
                <div>
                  <span className="text-[10px] text-slate-300 uppercase tracking-widest block font-bold">
                    Net Salary Transferred to Bank
                  </span>
                  <div className="text-2xl font-black font-tabular tracking-tight text-white">
                    {formatCurrency(selectedPayslipStaff.netPay)}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-300">
                  <div>Payment Mode: <strong className="text-white">Direct Bank ECS</strong></div>
                  <div>Account: <strong className="text-white font-mono">{selectedPayslipStaff.bankAccount || "Ending in 4021"}</strong></div>
                </div>
              </div>

              {/* Authorized Signatures */}
              <div className="grid grid-cols-3 gap-8 pt-6 border-t border-slate-300 text-center text-xs text-slate-600">
                <div>
                  <div className="border-b border-slate-400 h-8 mb-1"></div>
                  <span className="font-semibold">Prepared by (Accountant)</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 h-8 mb-1"></div>
                  <span className="font-semibold">Approved by (Principal)</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 h-8 mb-1"></div>
                  <span className="font-semibold">Employee Signature</span>
                </div>
              </div>

              {/* Computer Generated Notice */}
              <div className="text-center text-[10px] text-slate-400 pt-6">
                This is a computer-generated salary payslip certified by Crescent Matriculation Higher Secondary School.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Annual Salary Statement / Form 16 Summary Modal */}
      {showForm16Modal && selectedForm16Staff && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 p-2 sm:p-6 overflow-y-auto print:static print:inset-auto print:p-0 print:m-0 print:bg-white print:overflow-visible print:block print:w-full">
          <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full mx-auto my-auto flex flex-col overflow-hidden max-h-[95vh] print:max-w-none print:w-full print:shadow-none print:border-none print:rounded-none print:p-0 print:m-0 print:overflow-visible">
            {/* Top Toolbar - HIDDEN IN PRINT/PDF */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white shrink-0 print:hidden">
              <div className="flex items-center gap-2 flex-wrap">
                <FileText className="h-4 w-4 text-purple-400" />
                <span className="font-bold text-xs">
                  Annual Salary Statement & Form 16 Summary (F.Y. 2026-2027) — {selectedForm16Staff.name}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={() => handlePrintForm16(selectedForm16Staff.name, selectedForm16Staff.empCode)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5 h-8 px-3"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Form 16</span>
                </Button>
                <button
                  onClick={() => setShowForm16Modal(false)}
                  className="p-1.5 hover:bg-slate-800 rounded-md text-slate-300 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Document Body */}
            <div className="p-8 overflow-y-auto space-y-5 text-slate-800 bg-white print:p-0 print:m-0 print:overflow-visible">
              {/* Letterhead */}
              <div className="text-center border-b-2 border-slate-900 pb-3">
                <h2 className="text-lg font-black tracking-wide uppercase text-slate-900">
                  CRESCENT MATRICULATION HIGHER SECONDARY SCHOOL
                </h2>
                <p className="text-[11px] text-slate-600">
                  Affiliated to Tamil Nadu State Board • Chromepet, Chennai - 600045
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  TAN: CHES01234D • PAN: AAATC1234F • EPFO Code: TN/MAS/0045821
                </p>
                <div className="mt-2 inline-block px-3 py-1 bg-purple-50 border border-purple-200 rounded font-bold text-xs uppercase tracking-wider text-purple-950">
                  ANNUAL SALARY STATEMENT & FORM 16 SUMMARY (F.Y. 2026-2027 / A.Y. 2027-2028)
                </div>
              </div>

              {/* Employee Particulars Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Employee Name</span>
                  <span className="font-bold text-slate-900">{selectedForm16Staff.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Employee Code</span>
                  <span className="font-mono font-bold text-blue-900">{selectedForm16Staff.empCode}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Designation</span>
                  <span className="font-medium text-slate-800">{selectedForm16Staff.designation}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">PAN Number</span>
                  <span className="font-mono font-bold text-slate-800">ABCDE1234F</span>
                </div>
              </div>

              {/* Annual Consolidated Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                    <tr>
                      <th className="px-4 py-2 text-left">Particulars / Statutory Head</th>
                      <th className="px-4 py-2 text-right">Monthly (₹)</th>
                      <th className="px-4 py-2 text-right">Annualized Total (12 Months)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    <tr>
                      <td className="px-4 py-2 font-sans font-semibold text-slate-900">1. Gross Salary (Basic + HRA + Allowances)</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(selectedForm16Staff.grossPay)}</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-950">{formatCurrency(selectedForm16Staff.grossPay * 12)}</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="px-4 py-2 font-sans text-slate-600 pl-8">Less: Standard Deduction u/s 16(ia)</td>
                      <td className="px-4 py-2 text-right text-slate-400">—</td>
                      <td className="px-4 py-2 text-right text-rose-700 font-bold">-₹50,000.00</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-sans font-semibold text-slate-900">2. Statutory Deductions under Chapter VI-A</td>
                      <td className="px-4 py-2 text-right text-slate-400">—</td>
                      <td className="px-4 py-2 text-right text-slate-400">—</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-sans text-slate-600 pl-8">a. Employee Provident Fund (EPF u/s 80C)</td>
                      <td className="px-4 py-2 text-right text-rose-700">-{formatCurrency(selectedForm16Staff.epfDeduction)}</td>
                      <td className="px-4 py-2 text-right text-rose-700 font-bold">-{formatCurrency(selectedForm16Staff.epfDeduction * 12)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-sans text-slate-600 pl-8">b. Employees' State Insurance (ESI u/s 80D)</td>
                      <td className="px-4 py-2 text-right text-rose-700">
                        {selectedForm16Staff.esiDeduction > 0 ? `-${formatCurrency(selectedForm16Staff.esiDeduction)}` : "₹0.00 (Exempt)"}
                      </td>
                      <td className="px-4 py-2 text-right text-rose-700 font-bold">
                        {selectedForm16Staff.esiDeduction > 0 ? `-${formatCurrency(selectedForm16Staff.esiDeduction * 12)}` : "₹0.00"}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-sans text-slate-600 pl-8">c. Tamil Nadu Professional Tax (TN PT u/s 16(iii))</td>
                      <td className="px-4 py-2 text-right text-rose-700">
                        {selectedForm16Staff.professionalTax > 0 ? `-${formatCurrency(selectedForm16Staff.professionalTax)}` : "₹0.00"}
                      </td>
                      <td className="px-4 py-2 text-right text-rose-700 font-bold">
                        {selectedForm16Staff.professionalTax > 0 ? `-${formatCurrency(selectedForm16Staff.professionalTax * 12)}` : "₹0.00"}
                      </td>
                    </tr>
                    <tr className="bg-purple-50/70 border-t-2 border-purple-300 font-bold text-purple-950">
                      <td className="px-4 py-2.5 font-sans">NET ANNUAL SALARY DISBURSED</td>
                      <td className="px-4 py-2.5 text-right font-sans">{formatCurrency(selectedForm16Staff.netPay)}</td>
                      <td className="px-4 py-2.5 text-right text-sm">{formatCurrency(selectedForm16Staff.netPay * 12)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Employer Declaration and Signatures */}
              <div className="pt-4 border-t border-slate-300 space-y-6 text-xs text-slate-600">
                <p className="text-[11px] italic text-slate-500 leading-relaxed">
                  I, Dr. K. R. Ramanathan, in my capacity as Principal & Authorized Signatory of Crescent Matriculation Higher Secondary School,
                  hereby certify that the salary disbursements and statutory deductions summarized above are true and complete as per school payroll registers.
                </p>

                <div className="grid grid-cols-2 gap-12 pt-4">
                  <div className="border-t border-slate-400 pt-1 text-center">
                    <span className="block font-semibold text-slate-800 text-[11px]">Accounts Officer / Bursar</span>
                    <span className="text-[10px] text-slate-400">Date: {new Date().toLocaleDateString("en-IN")}</span>
                  </div>
                  <div className="border-t border-slate-400 pt-1 text-center">
                    <span className="block font-serif italic font-bold text-slate-900 text-[12px]">Dr. K. R. Ramanathan</span>
                    <span className="block font-semibold text-slate-800 text-[11px]">Principal / Head of Institution</span>
                    <span className="text-[10px] text-slate-400">Institutional Seal & Stamp</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer - HIDDEN ON PRINT */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end print:hidden">
              <Button size="sm" variant="outline" onClick={() => setShowForm16Modal(false)} className="text-xs h-8">
                Close Statement
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

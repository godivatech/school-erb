"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Printer,
  ShieldAlert,
  Send,
  Plus,
  Search,
  Filter,
  DollarSign,
  Layers,
  Users,
  X,
  Phone,
  Calendar,
  Building,
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
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  markReceiptBouncedOrVoid,
  createFeeHead,
  upsertFeeStructure,
  sendFeeDefaulterReminder,
} from "@/actions/finance";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionBanner } from "@/components/ui/action-banner";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { SearchableSelect, SearchOption } from "@/components/ui/searchable-select";

export interface ReceiptRow {
  id: string;
  receiptNo: string;
  studentName: string;
  admissionNo: string;
  className: string;
  amountReceived: number;
  paymentMode: "CASH" | "UPI" | "CARD" | "CHEQUE" | "ONLINE";
  clearanceStatus: "CLEARED" | "PENDING_CHEQUE" | "BOUNCED" | "VOIDED";
  chequeOrTxnRef: string | null;
  allocationsJson?: any;
  notes?: string | null;
  date: string;
}

export interface FeeHeadRow {
  id: string;
  name: string;
  frequency: "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
  priorityOrder: number;
  isMandatory: boolean;
}

export interface FeeStructureRow {
  id: string;
  classId: string;
  className: string;
  feeHeadId: string;
  feeHeadName: string;
  amount: number;
  dueDateDay: number;
}

export interface DefaulterRow {
  invoiceId: string;
  invoiceNo: string;
  installmentLabel: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  className: string;
  phone: string | null;
  dueDate: string;
  pendingAmount: number;
  overdueDays: number;
  status: string;
}

interface ClassOption {
  id: string;
  name: string;
}

interface FinanceClientProps {
  receipts: ReceiptRow[];
  totalCollectionToday: number;
  activeReceiptsCount: number;
  bouncedCount: number;
  feeHeads: FeeHeadRow[];
  classes: ClassOption[];
  feeStructures: FeeStructureRow[];
  defaulters: DefaulterRow[];
  isLocked: boolean;
  schoolId: string;
  academicYearId: string;
}

export function FinanceClient({
  receipts,
  totalCollectionToday,
  activeReceiptsCount,
  bouncedCount,
  feeHeads,
  classes,
  feeStructures,
  defaulters,
  isLocked,
  schoolId,
  academicYearId,
}: FinanceClientProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState<"receipts" | "structures" | "defaulters">("receipts");
  const [notification, setNotification] = React.useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  // In-app Confirmation Modal
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

  // Search & Filter
  const [receiptSearch, setReceiptSearch] = React.useState("");
  const [defaulterSearch, setDefaulterSearch] = React.useState("");
  const [selectedClassFilter, setSelectedClassFilter] = React.useState("ALL");

  // Printable Receipt Modal State
  const [receiptToPrint, setReceiptToPrint] = React.useState<ReceiptRow | null>(null);

  // Add Fee Head Modal
  const [isAddHeadOpen, setIsAddHeadOpen] = React.useState(false);
  const [headForm, setHeadForm] = React.useState({
    name: "",
    frequency: "QUARTERLY" as "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "ANNUAL",
    priorityOrder: 1,
    isMandatory: true,
  });

  // Configure Structure Modal
  const [isConfigureStructureOpen, setIsConfigureStructureOpen] = React.useState(false);
  const [structureForm, setStructureForm] = React.useState({
    classId: classes[0]?.id || "",
    feeHeadId: feeHeads[0]?.id || "",
    amount: 15000,
    dueDateDay: 10,
    lateFinePerDay: 50,
  });

  const totalDefaulterAmount = React.useMemo(() => {
    return defaulters.reduce((acc, d) => acc + d.pendingAmount, 0);
  }, [defaulters]);

  const filteredReceipts = React.useMemo(() => {
    if (!receiptSearch.trim()) return receipts;
    const q = receiptSearch.toLowerCase();
    return receipts.filter(
      (r) =>
        r.receiptNo.toLowerCase().includes(q) ||
        r.studentName.toLowerCase().includes(q) ||
        r.admissionNo.toLowerCase().includes(q) ||
        (r.chequeOrTxnRef && r.chequeOrTxnRef.toLowerCase().includes(q))
    );
  }, [receipts, receiptSearch]);

  const filteredDefaulters = React.useMemo(() => {
    return defaulters.filter((d) => {
      const matchSearch =
        !defaulterSearch.trim() ||
        d.studentName.toLowerCase().includes(defaulterSearch.toLowerCase()) ||
        d.admissionNo.toLowerCase().includes(defaulterSearch.toLowerCase()) ||
        d.invoiceNo.toLowerCase().includes(defaulterSearch.toLowerCase());

      const matchClass =
        selectedClassFilter === "ALL" || d.className.startsWith(selectedClassFilter);

      return matchSearch && matchClass;
    });
  }, [defaulters, defaulterSearch, selectedClassFilter]);

  // Client-side pagination hooks
  const { paginatedItems: paginatedReceipts, paginationProps: receiptsPagination } = usePagination(filteredReceipts, 10);
  const { paginatedItems: paginatedDefaulters, paginationProps: defaultersPagination } = usePagination(filteredDefaulters, 10);

  const handleAction = (receiptId: string, actionType: "BOUNCE" | "VOID") => {
    if (isLocked) {
      notify("error", "Academic year is LOCKED.");
      return;
    }

    const r = receipts.find((item) => item.id === receiptId);
    if (!r) return;

    const actionLabel = actionType === "BOUNCE" ? "BOUNCE" : "VOID";
    const promptMsg =
      actionType === "BOUNCE"
        ? `Mark Cheque for Receipt ${r.receiptNo} as BOUNCED? This rolls back ${formatCurrency(r.amountReceived)} on invoice, applies a ₹500 bounce charge, and writes to audit trail.`
        : `VOID Receipt ${r.receiptNo}? This rolls back ${formatCurrency(r.amountReceived)} on student invoice and writes to audit trail.`;

    setConfirmAction({
      isOpen: true,
      title: `${actionLabel} Receipt: ${r.receiptNo}`,
      description: promptMsg,
      confirmText: actionLabel === "BOUNCE" ? "Bounce Cheque" : "Void Receipt",
      variant: "danger",
      action: async () => {
        setLoadingId(receiptId);
        try {
          const res = await markReceiptBouncedOrVoid({
            receiptId,
            actionType,
            reason: `${actionLabel} requested by accounts office for ${r.receiptNo}`,
          });

          if (res.success) {
            notify("success", `Receipt ${r.receiptNo} successfully marked ${actionLabel}. Invoices reopened and audit trail logged.`);
            router.refresh();
          }
        } catch (err: any) {
          notify("error", "Error: " + err.message);
        } finally {
          setLoadingId(null);
        }
      },
    });
  };

  const handleSendReminder = async (defaulter: DefaulterRow) => {
    setLoadingId(defaulter.invoiceId);
    try {
      const res = await sendFeeDefaulterReminder({
        studentId: defaulter.studentId,
        studentName: defaulter.studentName,
        overdueAmount: defaulter.pendingAmount,
        phone: defaulter.phone || undefined,
      });

      if (res.success) {
        notify("success", res.message);
      }
    } catch (err: any) {
      notify("error", "Failed to send reminder: " + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const handleAddHeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headForm.name.trim()) return;

    setLoadingId("HEAD_CREATE");
    try {
      const res = await createFeeHead(headForm);
      if (res.success) {
        setIsAddHeadOpen(false);
        setHeadForm({
          name: "",
          frequency: "QUARTERLY",
          priorityOrder: feeHeads.length + 1,
          isMandatory: true,
        });
        notify("success", `Fee Head "${res.head.name}" created successfully.`);
        router.refresh();
      }
    } catch (err: any) {
      notify("error", "Failed to create fee head: " + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const handleConfigureStructureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!structureForm.classId || !structureForm.feeHeadId) {
      notify("error", "Please select both a class and a fee head.");
      return;
    }

    setLoadingId("STRUCT_CONFIG");
    try {
      const res = await upsertFeeStructure({
        academicYearId,
        classId: structureForm.classId,
        feeHeadId: structureForm.feeHeadId,
        amount: structureForm.amount,
        dueDateDay: structureForm.dueDateDay,
        lateFinePerDay: structureForm.lateFinePerDay,
      });

      if (res.success) {
        setIsConfigureStructureOpen(false);
        notify("success", `Fee structure for amount ₹${res.structure.amount} updated successfully.`);
        router.refresh();
      }
    } catch (err: any) {
      notify("error", "Failed to update fee structure: " + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const handlePrintReceipt = (receipt: ReceiptRow) => {
    const originalTitle = document.title;
    document.title = `Fee_Receipt_${receipt.receiptNo}_${receipt.admissionNo}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  return (
    <>
      <div className={cn("space-y-5", receiptToPrint && "print:hidden")}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Fee POS, Ledgers & Defaulter Recovery
          </h1>
          <p className="text-xs text-slate-500 font-tabular mt-0.5">
            Immutable double-entry audit receipts, configurable fee heads per grade, and automated WhatsApp/SMS dues recovery
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/finance/pos">
            <Button size="sm" variant="default" className="gap-1.5 font-semibold bg-navy-900 text-white">
              <CreditCard className="h-3.5 w-3.5" />
              <span>Open Cashier POS</span>
              <kbd className="bg-blue-800 text-white text-[9px] px-1 py-0.2 rounded font-mono">
                /
              </kbd>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Total Collections
          </div>
          <div className="text-xl font-bold font-tabular text-slate-900 mt-1">
            {formatCurrency(totalCollectionToday)}
          </div>
          <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
            {activeReceiptsCount} cleared receipts
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Total Overdue Dues
          </div>
          <div className="text-xl font-bold font-tabular text-rose-700 mt-1">
            {formatCurrency(totalDefaulterAmount)}
          </div>
          <div className="text-[10px] text-rose-600 font-medium mt-0.5">
            {defaulters.length} pending installments
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Pending Cheques
          </div>
          <div className="text-xl font-bold font-tabular text-amber-700 mt-1">
            {receipts.filter((r) => r.clearanceStatus === "PENDING_CHEQUE").length}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Awaiting bank clearance</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Bounced / Voided
          </div>
          <div className="text-xl font-bold font-tabular text-rose-700 mt-1">
            {bouncedCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Auto-rolled back on invoices</div>
        </div>
      </div>

      {notification && (
        <ActionBanner
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1 sm:gap-2 overflow-x-auto no-scrollbar pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("receipts")}
          className={`py-2 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
            activeTab === "receipts"
              ? "border-navy-900 text-navy-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="h-4 w-4 shrink-0" />
          <span>Receipts Ledger ({receipts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("defaulters")}
          className={`py-2 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
            activeTab === "defaulters"
              ? "border-navy-900 text-navy-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>Fee Defaulters & Overdue Dues</span>
          {defaulters.length > 0 && (
            <Badge variant="danger" className="h-4 px-1.5 text-[9px] shrink-0">
              {defaulters.length}
            </Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("structures")}
          className={`py-2 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
            activeTab === "structures"
              ? "border-navy-900 text-navy-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="h-4 w-4 shrink-0" />
          <span>Fee Heads & Grade Structures</span>
        </button>
      </div>

      {/* TAB 1: Receipts Ledger */}
      {activeTab === "receipts" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search receipt no, student, ref..."
                value={receiptSearch}
                onChange={(e) => setReceiptSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="text-xs text-slate-500 shrink-0">
              Showing {filteredReceipts.length} of {receipts.length} receipts
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50">
                  <TableHead>Receipt No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Payment Mode & Ref</TableHead>
                  <TableHead isNumeric>Amount Received</TableHead>
                  <TableHead>Clearance Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                      No receipts found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedReceipts.map((r) => (
                    <TableRow key={r.id} className="hover:bg-slate-50/70 border-b border-slate-100">
                      <TableCell className="font-mono text-xs font-bold text-navy-800">
                        {r.receiptNo}
                      </TableCell>
                      <TableCell className="font-tabular text-xs text-slate-600">
                        {formatDate(r.date)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {r.studentName}
                        <div className="text-[10px] text-slate-400 font-mono">
                          {r.admissionNo}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">{r.className}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                            {r.paymentMode}
                          </Badge>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {r.chequeOrTxnRef || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell isNumeric className="font-tabular font-bold text-slate-900">
                        {formatCurrency(r.amountReceived)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.clearanceStatus === "CLEARED"
                              ? "success"
                              : r.clearanceStatus === "PENDING_CHEQUE"
                              ? "warning"
                              : "danger"
                          }
                          className="text-[10px]"
                        >
                          {r.clearanceStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReceiptToPrint(r)}
                            className="h-6 text-[10px] px-2 text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                          >
                            <Printer className="h-3 w-3" />
                            <span>Print Slip</span>
                          </Button>

                          {r.clearanceStatus === "PENDING_CHEQUE" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleAction(r.id, "BOUNCE")}
                              disabled={isLocked || loadingId === r.id}
                              className="h-6 text-[10px] px-2"
                            >
                              {loadingId === r.id ? "..." : "Bounce"}
                            </Button>
                          )}
                          {r.clearanceStatus === "CLEARED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(r.id, "VOID")}
                              disabled={isLocked || loadingId === r.id}
                              className="h-6 text-[10px] px-1.5 text-slate-400 hover:text-red-700"
                            >
                              {loadingId === r.id ? "..." : "Void"}
                            </Button>
                          )}
                          {r.clearanceStatus === "BOUNCED" && (
                            <span className="text-[10px] text-red-700 font-medium font-mono">Rolled Back</span>
                          )}
                          {r.clearanceStatus === "VOIDED" && (
                            <span className="text-[10px] text-slate-400 font-medium font-mono">Voided</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Pagination {...receiptsPagination} />
          </div>
        </div>
      )}

      {/* TAB 2: Fee Defaulters */}
      {activeTab === "defaulters" && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search student or invoice..."
                  value={defaulterSearch}
                  onChange={(e) => setDefaulterSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="h-8 text-xs border border-slate-300 rounded px-2 bg-white"
              >
                <option value="ALL">All Grades</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Total Defaulters: <span className="font-bold text-rose-700">{filteredDefaulters.length}</span> • Pending Overdue: <span className="font-bold text-rose-700">{formatCurrency(filteredDefaulters.reduce((acc, d) => acc + d.pendingAmount, 0))}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50">
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Installment</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead isNumeric>Overdue Amount</TableHead>
                  <TableHead>Overdue Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDefaulters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                      No fee defaulters found. All student fees are up to date!
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDefaulters.map((d) => (
                    <TableRow key={d.invoiceId} className="hover:bg-slate-50/70 border-b border-slate-100">
                      <TableCell className="font-mono text-xs font-semibold text-slate-800">
                        {d.invoiceNo}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-900 text-xs">{d.studentName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Adm: {d.admissionNo} • Ph: {d.phone || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">{d.className}</TableCell>
                      <TableCell className="text-xs text-slate-600">{d.installmentLabel}</TableCell>
                      <TableCell className="font-tabular text-xs text-slate-700">
                        {formatDate(d.dueDate)}
                      </TableCell>
                      <TableCell isNumeric className="font-tabular font-bold text-rose-700 text-xs">
                        {formatCurrency(d.pendingAmount)}
                      </TableCell>
                      <TableCell>
                        {d.overdueDays > 0 ? (
                          <Badge variant="danger" className="text-[10px] font-mono">
                            {d.overdueDays} Days Overdue
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="text-[10px] font-mono">
                            Due Today
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleSendReminder(d)}
                          disabled={loadingId === d.invoiceId}
                          className="h-7 text-xs bg-navy-900 text-white font-semibold gap-1"
                        >
                          <Send className="h-3 w-3" />
                          <span>{loadingId === d.invoiceId ? "Sending..." : "Send Reminder"}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Pagination {...defaultersPagination} />
          </div>
        </div>
      )}

      {/* TAB 3: Fee Heads & Structures */}
      {activeTab === "structures" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Fee Heads & Grade Fee Configuration
              </h2>
              <p className="text-xs text-slate-500">
                Configure quarterly/annual fee heads (Tuition, Transport, Lab, Exam) and assign pricing amounts per grade level.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddHeadOpen(true)}
                className="gap-1.5 text-xs border-slate-300"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add Fee Head</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setIsConfigureStructureOpen(true)}
                className="gap-1.5 text-xs bg-navy-900 text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Configure Grade Fee</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Master Fee Heads */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-900">Master Fee Heads</span>
                <Badge variant="neutral" className="text-[10px]">{feeHeads.length} Heads</Badge>
              </div>

              <div className="divide-y divide-slate-100">
                {feeHeads.map((head) => (
                  <div key={head.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900">{head.name}</span>
                      <div className="text-[10px] text-slate-500">
                        Priority: #{head.priorityOrder} • Frequency: {head.frequency}
                      </div>
                    </div>
                    <Badge variant={head.isMandatory ? "primary" : "neutral"} className="text-[10px]">
                      {head.isMandatory ? "Mandatory" : "Optional"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Grade Fee Matrix */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-900">Configured Grade Fee Rates</span>
                <Badge variant="neutral" className="text-[10px]">{feeStructures.length} Rates</Badge>
              </div>

              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {feeStructures.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No fee rates configured yet. Click "+ Configure Grade Fee" above.
                  </div>
                ) : (
                  feeStructures.map((struct) => (
                    <div key={struct.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-navy-900">{struct.className}</span>
                        <span className="text-slate-500 ml-1.5">• {struct.feeHeadName}</span>
                        <div className="text-[10px] text-slate-400">
                          Due day: {struct.dueDateDay}th of month
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(struct.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* MODAL: Printable Receipt */}
      {receiptToPrint && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 print:static print:inset-auto print:p-0 print:m-0 print:bg-white print:overflow-visible print:block print:w-full">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-lg p-6 space-y-4 animate-in fade-in zoom-in-95 print:p-0 print:m-0 print:border-none print:shadow-none print:max-w-none print:w-full print:overflow-visible">
            {/* Non-print toolbar */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 print:hidden">
              <div className="flex items-center gap-2 flex-wrap">
                <Printer className="h-4 w-4 text-navy-900" />
                <h3 className="text-sm font-bold text-slate-900">Official Fee Receipt Slip</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={() => handlePrintReceipt(receiptToPrint)}
                  className="h-7 text-xs bg-navy-900 text-white font-semibold gap-1"
                >
                  <Printer className="h-3 w-3" />
                  <span>Print Document</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setReceiptToPrint(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Official Slip Content */}
            <div className="border border-slate-300 rounded p-5 space-y-4 font-sans text-slate-900 bg-white">
              {/* School Header */}
              <div className="text-center border-b border-slate-300 pb-3 space-y-1">
                <h2 className="text-base font-extrabold tracking-tight uppercase text-navy-900">
                  Crescent Matriculation Higher Secondary School
                </h2>
                <p className="text-[11px] text-slate-600">
                  Affiliated to Tamil Nadu State Matriculation Board • Code: CMS-CHENNAI
                </p>
                <p className="text-[10px] text-slate-500">
                  High Road, Chennai - 600045 • Phone: +91 44 2233 4455
                </p>
              </div>

              {/* Receipt Meta */}
              <div className="grid grid-cols-2 text-xs border-b border-slate-200 pb-3 gap-y-1">
                <div>
                  <span className="text-slate-500">Receipt No: </span>
                  <span className="font-mono font-bold text-navy-900">{receiptToPrint.receiptNo}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Date: </span>
                  <span className="font-bold">{formatDate(receiptToPrint.date)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Student Name: </span>
                  <span className="font-bold">{receiptToPrint.studentName}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Admission No: </span>
                  <span className="font-mono font-bold">{receiptToPrint.admissionNo}</span>
                </div>
                <div>
                  <span className="text-slate-500">Class & Section: </span>
                  <span className="font-bold">{receiptToPrint.className}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Payment Mode: </span>
                  <span className="font-mono font-bold">{receiptToPrint.paymentMode}</span>
                </div>
                {receiptToPrint.chequeOrTxnRef && (
                  <div className="col-span-2 text-[11px] text-slate-600">
                    <span className="text-slate-500">Transaction/Cheque Ref: </span>
                    <span className="font-mono">{receiptToPrint.chequeOrTxnRef}</span>
                  </div>
                )}
              </div>

              {/* Amount Breakdown */}
              <div className="space-y-2 py-2">
                <div className="flex justify-between text-xs font-semibold border-b border-slate-100 pb-1">
                  <span>Fee Particulars</span>
                  <span>Amount (INR)</span>
                </div>
                <div className="flex justify-between text-xs py-1">
                  <span>Tuition & Academic Term Installment</span>
                  <span className="font-mono">{formatCurrency(receiptToPrint.amountReceived)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold border-t border-slate-300 pt-2 text-navy-900">
                  <span>Total Amount Paid</span>
                  <span className="font-mono text-sm">{formatCurrency(receiptToPrint.amountReceived)}</span>
                </div>
              </div>

              {/* Footer Signatures */}
              <div className="pt-8 flex justify-between text-[11px] text-slate-500">
                <div className="text-center">
                  <div className="w-24 border-b border-slate-400 mb-1"></div>
                  <span>Parent/Guardian</span>
                </div>
                <div className="text-center">
                  <div className="w-28 border-b border-slate-400 mb-1"></div>
                  <span>Cashier / Authorized Signatory</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: + Add Fee Head */}
      {isAddHeadOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Plus className="h-4 w-4 text-navy-900" />
                <h3 className="text-sm font-bold text-slate-900">Add New Fee Head</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddHeadOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddHeadSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Fee Head Name *</label>
                <Input
                  required
                  placeholder="e.g. Annual Computer Lab Fee"
                  value={headForm.name}
                  onChange={(e) => setHeadForm({ ...headForm, name: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Billing Frequency</label>
                  <select
                    value={headForm.frequency}
                    onChange={(e) => setHeadForm({ ...headForm, frequency: e.target.value as any })}
                    className="w-full h-8 text-xs border border-slate-300 rounded px-2 bg-white"
                  >
                    <option value="ANNUAL">Annual</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="ONE_TIME">One-Time</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Priority Order</label>
                  <Input
                    type="number"
                    min="1"
                    max="99"
                    value={headForm.priorityOrder}
                    onChange={(e) => setHeadForm({ ...headForm, priorityOrder: Number(e.target.value) })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isMandatory"
                  checked={headForm.isMandatory}
                  onChange={(e) => setHeadForm({ ...headForm, isMandatory: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <label htmlFor="isMandatory" className="text-xs text-slate-700 font-medium">
                  Mandatory for all enrolled students
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddHeadOpen(false)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loadingId === "HEAD_CREATE"}
                  className="h-8 text-xs bg-navy-900 text-white font-semibold"
                >
                  {loadingId === "HEAD_CREATE" ? "Creating..." : "Create Fee Head"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: + Configure Grade Fee */}
      {isConfigureStructureOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Plus className="h-4 w-4 text-navy-900" />
                <h3 className="text-sm font-bold text-slate-900">Configure Grade Fee Amount</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigureStructureOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfigureStructureSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 block">Select Grade / Class *</label>
                <SearchableSelect
                  options={classes.map((c) => ({
                    value: c.id,
                    label: c.name,
                    badge: "Grade",
                  }))}
                  value={structureForm.classId}
                  onChange={(val) => setStructureForm({ ...structureForm, classId: val })}
                  placeholder="Select class..."
                  searchPlaceholder="Search class..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 block">Select Fee Head *</label>
                <SearchableSelect
                  options={feeHeads.map((h) => ({
                    value: h.id,
                    label: h.name,
                    sublabel: h.frequency,
                    badge: h.frequency,
                  }))}
                  value={structureForm.feeHeadId}
                  onChange={(val) => setStructureForm({ ...structureForm, feeHeadId: val })}
                  placeholder="Select fee head..."
                  searchPlaceholder="Search fee head..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Fee Amount (₹) *</label>
                  <Input
                    type="number"
                    min="100"
                    step="100"
                    required
                    value={structureForm.amount}
                    onChange={(e) => setStructureForm({ ...structureForm, amount: Number(e.target.value) })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Due Date Day</label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    value={structureForm.dueDateDay}
                    onChange={(e) => setStructureForm({ ...structureForm, dueDateDay: Number(e.target.value) })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConfigureStructureOpen(false)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loadingId === "STRUCT_CONFIG"}
                  className="h-8 text-xs bg-navy-900 text-white font-semibold"
                >
                  {loadingId === "STRUCT_CONFIG" ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global In-App Confirmation Dialog */}
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
        isLoading={!!loadingId}
      />
    </>
  );
}

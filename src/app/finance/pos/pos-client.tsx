"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Search,
  Users,
  Printer,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  ArrowLeft,
  Wallet,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatPhone } from "@/lib/utils";
import { collectFeePaymentPOS } from "@/actions/finance";
import { LockOverrideDialog } from "@/components/layout/lock-override-dialog";

export interface PosFeeItem {
  id: string;
  invoiceId: string;
  feeHeadName: string;
  priorityOrder: number;
  amount: number;
  alreadyPaid: number;
  allocatedNow: number;
}

export interface PosStudentInfo {
  id: string;
  admissionNo: string;
  name: string;
  className: string;
  parentName: string;
  parentPhone: string;
  walletBalance: number;
  siblingDues?: {
    siblingName: string;
    dueAmount: number;
  } | null;
}

interface PosClientProps {
  initialStudent: PosStudentInfo | null;
  initialFeeItems: PosFeeItem[];
  schoolId: string;
  academicYearId: string;
  isLocked: boolean;
  yearName: string;
}

export function CashierPosClient({
  initialStudent,
  initialFeeItems,
  schoolId,
  academicYearId,
  isLocked,
  yearName,
}: PosClientProps) {
  const router = useRouter();

  // Search input state
  const [searchQuery, setSearchQuery] = React.useState(initialStudent?.admissionNo || "");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const [student, setStudent] = React.useState<PosStudentInfo | null>(initialStudent);
  const [feeItems, setFeeItems] = React.useState<PosFeeItem[]>(initialFeeItems);

  // Total Net Due
  const totalDue = feeItems.reduce(
    (sum, item) => sum + Math.max(0, item.amount - item.alreadyPaid),
    0
  );

  const [paymentAmount, setPaymentAmount] = React.useState<string>(String(totalDue));
  const [paymentMode, setPaymentMode] = React.useState<"CASH" | "UPI" | "CARD" | "CHEQUE">("UPI");
  const [txnRef, setTxnRef] = React.useState("");
  const [printDualCopy, setPrintDualCopy] = React.useState(true);
  const [receiptGenerated, setReceiptGenerated] = React.useState<any | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // Reset fee items and total due when initial data changes
  React.useEffect(() => {
    setStudent(initialStudent);
    setFeeItems(initialFeeItems);
    const newTotal = initialFeeItems.reduce(
      (sum, item) => sum + Math.max(0, item.amount - item.alreadyPaid),
      0
    );
    setPaymentAmount(String(newTotal));
    // Allocate by default
    allocateAmount(newTotal, initialFeeItems);
    setFeedback(null);
  }, [initialStudent, initialFeeItems]);

  // Keyboard shortcut: '/' focuses search input immediately
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const allocateAmount = (val: number, items: PosFeeItem[]) => {
    let rem = val;
    const updated = items.map((item) => {
      const remainingDue = Math.max(0, item.amount - item.alreadyPaid);
      if (rem <= 0) {
        return { ...item, allocatedNow: 0 };
      }
      const toAllocate = Math.min(rem, remainingDue);
      rem -= toAllocate;
      return { ...item, allocatedNow: toAllocate };
    });
    setFeeItems(updated);
  };

  const handleAmountChange = (rawVal: string) => {
    setPaymentAmount(rawVal);
    const num = parseFloat(rawVal) || 0;
    allocateAmount(num, feeItems);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setFeedback(null);
      router.push(`/finance/pos?query=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleProcessPayment = async () => {
    setFeedback(null);
    if (!student) {
      setFeedback({ type: "warning", message: "Please search and select a student first." });
      return;
    }

    const amt = parseFloat(paymentAmount) || 0;
    if (amt <= 0) {
      setFeedback({ type: "error", message: "Please enter a valid payment amount greater than ₹0." });
      return;
    }

    if (paymentMode === "CHEQUE" && !txnRef.trim()) {
      setFeedback({
        type: "warning",
        message: "Please enter Cheque Number / Bank Instrument reference for cheque collection.",
      });
      return;
    }

    if (isLocked) {
      setOverrideModalOpen(true);
      return;
    }

    setIsProcessing(true);
    try {
      const idempotencyKey = `pos_${student.id}_${Date.now()}`;
      const res = await collectFeePaymentPOS({
        academicYearId,
        studentId: student.id,
        amountReceived: amt,
        paymentMode,
        chequeOrTxnRef: txnRef || undefined,
        idempotencyKey,
        notes: `POS cashier collection for ${student.name}`,
      });

      if (res.success && res.receipt) {
        setReceiptGenerated(res.receipt);
        setFeedback({
          type: "success",
          message: `Payment of ₹${amt.toFixed(2)} processed successfully! Receipt: ${res.receipt.receiptNo}`,
        });
        router.refresh();
      } else {
        setFeedback({ type: "error", message: "Payment error: " + (res.message || "Failed to process payment") });
      }
    } catch (err: any) {
      if (err.message?.includes("LOCKED") || err.name === "AcademicYearLockError") {
        setOverrideModalOpen(true);
      } else {
        setFeedback({ type: "error", message: "Transaction failed: " + err.message });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmOverride = async (overrideReason: string) => {
    if (!student) return;
    const amt = parseFloat(paymentAmount) || 0;
    setIsProcessing(true);
    try {
      const idempotencyKey = `pos_override_${student.id}_${Date.now()}`;
      const res = await collectFeePaymentPOS({
        academicYearId,
        studentId: student.id,
        amountReceived: amt,
        paymentMode,
        chequeOrTxnRef: txnRef || undefined,
        idempotencyKey,
        notes: `Audited SUPER_ADMIN override payment for ${student.name}`,
        overrideReason,
      });

      if (res.success && res.receipt) {
        setReceiptGenerated(res.receipt);
        setFeedback({
          type: "success",
          message: `Super-Admin override payment of ₹${amt.toFixed(2)} recorded! Receipt: ${res.receipt.receiptNo}`,
        });
        router.refresh();
      } else {
        setFeedback({ type: "error", message: "Override payment error: " + (res.message || "Failed") });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: "Override payment failed: " + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <Link href="/finance">
            <Button size="icon" variant="outline" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-navy-800" />
              Supermarket-Speed Cashier POS
            </h1>
            <p className="text-xs text-slate-500 font-tabular">
              Press <kbd className="px-1 py-0.2 bg-slate-100 border border-slate-300 rounded font-mono text-[10px]">/</kbd> anywhere to search • Priority-based auto-allocation
            </p>
          </div>
        </div>

        <Badge
          variant={isLocked ? "warning" : "success"}
          className="text-xs"
        >
          {yearName} ({isLocked ? "LOCKED" : "ACTIVE"})
        </Badge>
      </div>

      {/* Dynamic Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 rounded border text-sm flex items-start justify-between gap-3 ${
            feedback.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : feedback.type === "warning"
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "error" ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            ) : feedback.type === "warning" ? (
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* POS Quick Search Bar */}
      <form onSubmit={handleSearchSubmit} className="bg-white border border-slate-300 rounded p-3 flex items-center gap-3 shadow-sm">
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <input
          ref={searchInputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Scan barcode or type Admission No, Student Name, or Parent Phone (e.g., ADM-2026-0801, 9876543210)..."
          className="w-full text-sm outline-none text-slate-900 font-medium placeholder:text-slate-400"
        />
        <Button type="submit" size="sm" variant="default" className="text-xs bg-navy-900 text-white">
          Find
        </Button>
      </form>

      {/* Sibling Pending-Dues Alert Banner */}
      {student?.siblingDues && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-700 shrink-0" />
            <span>
              <strong>Sibling Alert:</strong> {student.siblingDues.siblingName} has{" "}
              <span className="font-tabular font-bold text-red-700">
                {formatCurrency(student.siblingDues.dueAmount)}
              </span>{" "}
              pending fee dues.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/parent?familyPhone=${student.parentPhone}`)}
            className="h-6 text-[10px] border-amber-400 text-amber-900 hover:bg-amber-100"
          >
            Switch to Sibling
          </Button>
        </div>
      )}

      {/* Cashier Split View */}
      {student ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left Col: Student Profile & Invoice Breakdown (Span 2) */}
          <div className="md:col-span-2 space-y-4">
            {/* Student ID Card */}
            <div className="bg-white border border-slate-200 rounded p-4 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Target Student
                </span>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  {student.name}
                </div>
                <div className="text-xs text-slate-500 font-tabular">
                  {student.admissionNo} • {student.className} • Parent: {student.parentName} ({formatPhone(student.parentPhone)})
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Wallet Balance
                </span>
                <div className="text-sm font-bold font-tabular text-emerald-700 flex items-center gap-1 justify-end">
                  <Wallet className="h-3.5 w-3.5" />
                  {formatCurrency(student.walletBalance)}
                </div>
              </div>
            </div>

            {/* Fee Items Priority Allocation Table */}
            <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  Priority-Ordered Invoice Allocation
                </span>
                <span className="text-[11px] text-slate-500 font-tabular">
                  Total Outstanding: <strong>{formatCurrency(totalDue)}</strong>
                </span>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">Prio</TableHead>
                    <TableHead>Fee Head</TableHead>
                    <TableHead isNumeric>Net Amount</TableHead>
                    <TableHead isNumeric>Already Paid</TableHead>
                    <TableHead isNumeric className="text-navy-900 font-bold">
                      Allocated Now
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feeItems.length > 0 ? (
                    feeItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-center font-tabular text-xs font-bold text-slate-500">
                          #{item.priorityOrder}
                        </TableCell>
                        <TableCell className="font-medium text-xs text-slate-800">
                          {item.feeHeadName}
                        </TableCell>
                        <TableCell isNumeric className="font-tabular text-xs text-slate-600">
                          {formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell isNumeric className="font-tabular text-xs text-slate-400">
                          {formatCurrency(item.alreadyPaid)}
                        </TableCell>
                        <TableCell isNumeric className="font-tabular text-xs font-bold text-emerald-700 bg-emerald-50/40">
                          {formatCurrency(item.allocatedNow)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-xs text-slate-400">
                        No outstanding invoices for this student.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Right Col: Payment Processing Panel */}
          <div className="bg-white border border-slate-200 rounded p-5 space-y-4 shadow-sm h-fit">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Collect Payment
            </h2>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Amount Received (₹)
              </label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="font-tabular text-lg font-bold text-slate-900 mt-1"
                placeholder="0.00"
              />
              {parseFloat(paymentAmount) > totalDue && (
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                  + {formatCurrency(parseFloat(paymentAmount) - totalDue)} excess will be credited to Student Wallet Advance!
                </p>
              )}
            </div>

            {/* Payment Mode Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Payment Mode
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(["CASH", "UPI", "CARD", "CHEQUE"] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    variant={paymentMode === mode ? "default" : "outline"}
                    onClick={() => setPaymentMode(mode)}
                    className="text-xs font-semibold h-8"
                  >
                    {mode}
                  </Button>
                ))}
              </div>
            </div>

            {/* Cheque / Txn Ref */}
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Txn Ref / Cheque No
              </label>
              <Input
                value={txnRef}
                onChange={(e) => setTxnRef(e.target.value)}
                placeholder="e.g., UPI-TXN-192830 or CHQ-00412"
                className="text-xs mt-1 font-mono"
              />
            </div>

            {/* Dual Print Toggle */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">
                Dual-Copy Print (Office + Student)
              </span>
              <input
                type="checkbox"
                checked={printDualCopy}
                onChange={(e) => setPrintDualCopy(e.target.checked)}
                className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
              />
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleProcessPayment}
              disabled={isLocked || isProcessing || parseFloat(paymentAmount) <= 0}
              className="w-full bg-navy-900 hover:bg-navy-800 text-white font-bold py-2.5 gap-2"
            >
              <Receipt className="h-4 w-4" />
              <span>{isProcessing ? "Processing..." : `Print Receipt (${formatCurrency(parseFloat(paymentAmount) || 0)})`}</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-slate-500">
            Search for a student using admission number (e.g. <code>ADM-2026-0801</code>) to start POS transaction.
          </p>
        </div>
      )}

      {/* Generated Receipt Modal / Dual Print Preview */}
      {receiptGenerated && (
        <div className="p-6 bg-emerald-50 border-2 border-emerald-500 rounded-lg space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <div>
                <h3 className="text-base font-bold text-emerald-950">
                  Payment Recorded & Immutable Receipt Issued
                </h3>
                <span className="font-mono text-xs font-bold text-emerald-800">
                  Receipt No: {receiptGenerated.receiptNo}
                </span>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              className="bg-white gap-1.5 text-xs font-semibold"
            >
              <Printer className="h-4 w-4" />
              <span>Print {printDualCopy ? "Dual Copy (Office + Student)" : "Receipt"}</span>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-tabular">
            <div>
              <span className="text-slate-500">Amount Received: </span>
              <span className="font-bold text-slate-900">
                {formatCurrency(parseFloat(receiptGenerated.amountReceived))}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Payment Mode: </span>
              <span className="font-bold text-slate-900">{receiptGenerated.paymentMode}</span>
            </div>
          </div>
        </div>
      )}

      {/* Academic Year Lock Override Modal */}
      <LockOverrideDialog
        open={overrideModalOpen}
        onOpenChange={setOverrideModalOpen}
        title="POS Cashier Fee Collection Lock Override"
        operationDescription={`Collect fee payment of ₹${paymentAmount || "0"} for ${student?.name || "Student"} (${student?.admissionNo || ""})`}
        onConfirmOverride={handleConfirmOverride}
      />
    </div>
  );
}

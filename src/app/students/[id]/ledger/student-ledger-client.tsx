"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  FileText,
  Phone,
  MapPin,
  Calendar,
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
import { formatCurrency, formatDate, formatPhone } from "@/lib/utils";

export interface StudentLedgerData {
  student: {
    id: string;
    admissionNo: string;
    name: string;
    className: string;
    rollNo: number | null;
    dob: string;
    gender: string;
    bloodGroup: string | null;
    parentName: string;
    parentPhone: string;
    address: string;
    emergencyContact: string;
    status: string;
  };
  yearName: string;
  financialSummary: {
    totalInvoiced: number;
    totalPaid: number;
    pendingDues: number;
    status: "PENDING" | "CLEARED" | "NO_INVOICE";
  };
  invoices: Array<{
    id: string;
    invoiceNo: string;
    installmentLabel: string;
    dueDate: string;
    baseAmount: number;
    discountAmount: number;
    lateFineAmount: number;
    netAmount: number;
    paidAmount: number;
    balanceDue: number;
    status: string;
    createdAt: string;
    items: Array<{
      id: string;
      feeHeadName: string;
      amount: number;
      paidAmount: number;
    }>;
  }>;
  receipts: Array<{
    id: string;
    receiptNo: string;
    amountReceived: number;
    paymentMode: string;
    chequeOrTxnRef: string | null;
    clearanceStatus: string;
    createdAt: string;
    allocations: any[];
    notes: string | null;
  }>;
}

function LedgerReceiptSlip({
  copyLabel,
  receipt,
  student,
  yearName,
}: {
  copyLabel: string;
  receipt: any;
  student: StudentLedgerData["student"];
  yearName: string;
}) {
  const rawAllocations: Array<{ feeHeadName: string; allocatedAmount: number; invoiceId?: string }> =
    Array.isArray(receipt.allocations) ? receipt.allocations : [];

  const allocations = rawAllocations.filter(
    (a) => a.invoiceId !== "WALLET_ADVANCE" && !a.feeHeadName?.toLowerCase().includes("wallet")
  );

  return (
    <div className="border border-slate-900 rounded p-4 text-xs font-sans text-slate-900 bg-white space-y-3">
      {/* School Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2">
        <div>
          <h2 className="text-sm font-black tracking-tight uppercase text-navy-950">
            Crescent Matriculation Higher Secondary School
          </h2>
          <p className="text-[10px] text-slate-600">
            Affiliated to Tamil Nadu State Matriculation Board • Code: CMS-CHENNAI
          </p>
          <p className="text-[9px] text-slate-500">
            High Road, Chennai - 600045 • Phone: +91 44 2233 4455
          </p>
        </div>
        <div className="text-right">
          <span className="inline-block border border-slate-900 px-2 py-0.5 font-bold font-mono text-[10px] uppercase bg-slate-100">
            {copyLabel}
          </span>
          <div className="text-[10px] font-mono text-slate-600 mt-1">
            Academic Year: {yearName}
          </div>
        </div>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] border-b border-slate-200 pb-2">
        <div>
          <span className="text-slate-500">Receipt No: </span>
          <span className="font-mono font-bold text-slate-900">{receipt.receiptNo}</span>
        </div>
        <div className="text-right">
          <span className="text-slate-500">Date: </span>
          <span className="font-bold">{formatDate(receipt.createdAt)}</span>
        </div>
        <div>
          <span className="text-slate-500">Student Name: </span>
          <span className="font-bold text-slate-900">{student.name}</span>
        </div>
        <div className="text-right">
          <span className="text-slate-500">Admission No: </span>
          <span className="font-mono font-bold">{student.admissionNo}</span>
        </div>
        <div>
          <span className="text-slate-500">Class & Section: </span>
          <span className="font-bold">{student.className}</span>
        </div>
        <div className="text-right">
          <span className="text-slate-500">Payment Mode: </span>
          <span className="font-bold font-mono">{receipt.paymentMode}</span>
        </div>
        {student.parentName && (
          <div>
            <span className="text-slate-500">Parent / Guardian: </span>
            <span>{student.parentName} ({formatPhone(student.parentPhone)})</span>
          </div>
        )}
        {receipt.chequeOrTxnRef && (
          <div className="text-right">
            <span className="text-slate-500">Instrument / Txn Ref: </span>
            <span className="font-mono font-medium">{receipt.chequeOrTxnRef}</span>
          </div>
        )}
      </div>

      {/* Itemized Fee Particulars */}
      <div className="space-y-1 py-1">
        <div className="flex justify-between text-[11px] font-bold border-b border-slate-300 pb-1 text-slate-800">
          <span>Fee Particulars</span>
          <span>Amount Paid</span>
        </div>
        {allocations.length > 0 ? (
          allocations.map((a, i) => (
            <div key={i} className="flex justify-between text-[11px] py-0.5">
              <span className="text-slate-700">{a.feeHeadName}</span>
              <span className="font-mono font-medium">{formatCurrency(a.allocatedAmount)}</span>
            </div>
          ))
        ) : (
          <div className="flex justify-between text-[11px] py-0.5">
            <span className="text-slate-700">Tuition & Term Academic Fees</span>
            <span className="font-mono font-medium">{formatCurrency(receipt.amountReceived)}</span>
          </div>
        )}

        <div className="flex justify-between text-xs font-black border-t-2 border-slate-900 pt-1.5 text-slate-900">
          <span>TOTAL AMOUNT PAID</span>
          <span className="font-mono text-sm">{formatCurrency(receipt.amountReceived)}</span>
        </div>
      </div>

      {/* Signatures */}
      <div className="pt-6 flex justify-between text-[10px] text-slate-500">
        <div className="text-center">
          <div className="w-28 border-b border-slate-400 mb-1"></div>
          <span>Parent / Depositor</span>
        </div>
        <div className="text-center">
          <div className="w-36 border-b border-slate-400 mb-1"></div>
          <span>Cashier / Authorized Signatory</span>
        </div>
      </div>
    </div>
  );
}

export function StudentLedgerClient({ initialData }: { initialData: StudentLedgerData }) {
  const { student, yearName, financialSummary, invoices, receipts } = initialData;
  const [activeTab, setActiveTab] = React.useState<"receipts" | "invoices">("receipts");
  const [selectedReceiptToPrint, setSelectedReceiptToPrint] = React.useState<any | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedReceiptToPrint(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handlePrintSlip = (receipt: any) => {
    setSelectedReceiptToPrint(receipt);
  };

  const handlePrintAccountStatement = () => {
    const originalTitle = document.title;
    document.title = `Fee_Statement_${student.admissionNo}_${student.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* SCREEN VIEW ONLY */}
      <div className="space-y-5 print:hidden">
        {/* Navigation Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3">
            <Link href="/students">
              <Button size="icon" variant="outline" className="h-8 w-8 shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-navy-800 shrink-0" />
                <span>Student Financial Ledger & Transaction History</span>
              </h1>
              <p className="text-xs text-slate-500">
                Official transaction statement, term invoice audit, and on-demand receipt re-printing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {financialSummary.pendingDues > 0 && (
              <Link href={`/finance/pos?query=${encodeURIComponent(student.admissionNo)}`}>
                <Button size="sm" className="bg-navy-900 text-white font-semibold text-xs gap-1.5 h-8">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Collect Dues at POS</span>
                </Button>
              </Link>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrintAccountStatement}
              className="text-xs gap-1.5 h-8 font-semibold border-slate-300"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Account Statement</span>
            </Button>
          </div>
        </div>

        {/* Student Identity Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-full bg-navy-900 text-white font-bold text-base flex items-center justify-center shrink-0">
              {student.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{student.name}</h2>
                <Badge variant={student.status === "ACTIVE" ? "success" : "neutral"} className="text-[10px]">
                  {student.status}
                </Badge>
              </div>
              <div className="text-xs text-slate-600 font-tabular mt-0.5 flex flex-wrap items-center gap-x-2">
                <span className="font-mono font-bold text-navy-950">{student.admissionNo}</span>
                <span>•</span>
                <span>{student.className}</span>
                {student.rollNo && (
                  <>
                    <span>•</span>
                    <span>Roll #{student.rollNo}</span>
                  </>
                )}
                <span>•</span>
                <span className="text-slate-500">{yearName}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <span>Parent: {student.parentName}</span>
                <span>({formatPhone(student.parentPhone)})</span>
              </div>
            </div>
          </div>

          {/* Quick Financial Health Pill */}
          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-5">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Total Invoiced
              </span>
              <span className="text-base font-bold font-tabular text-slate-900">
                {formatCurrency(financialSummary.totalInvoiced)}
              </span>
            </div>
            <div className="text-slate-300">|</div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Total Paid
              </span>
              <span className="text-base font-bold font-tabular text-emerald-700">
                {formatCurrency(financialSummary.totalPaid)}
              </span>
            </div>
            <div className="text-slate-300">|</div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Pending Due
              </span>
              <span className={`text-base font-bold font-tabular ${financialSummary.pendingDues > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                {formatCurrency(financialSummary.pendingDues)}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="border-b border-slate-200 flex gap-4 overflow-x-auto no-scrollbar pb-px">
          <button
            onClick={() => setActiveTab("receipts")}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === "receipts"
                ? "border-navy-900 text-navy-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Receipt className="h-3.5 w-3.5 shrink-0" />
            <span>Payment Receipts & Slips ({receipts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("invoices")}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === "invoices"
                ? "border-navy-900 text-navy-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span>Invoices & Fee Particulars ({invoices.length})</span>
          </button>
        </div>

        {/* TAB 1: Payment Receipts History */}
        {activeTab === "receipts" && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">
                Official Fee Receipts & Slips
              </span>
              <span className="text-[11px] text-slate-500 font-tabular">
                {receipts.length} payment transaction(s) recorded
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold text-slate-700">Receipt No</TableHead>
                  <TableHead className="font-bold text-slate-700">Date</TableHead>
                  <TableHead className="font-bold text-slate-700">Mode & Ref</TableHead>
                  <TableHead isNumeric className="font-bold text-slate-700">Amount Paid</TableHead>
                  <TableHead className="font-bold text-slate-700">Status</TableHead>
                  <TableHead className="text-right font-bold text-slate-700">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                      No payment receipts have been issued for this student yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  receipts.map((r) => (
                    <TableRow key={r.id} className="hover:bg-slate-50/70 border-b border-slate-100">
                      <TableCell className="font-mono text-xs font-bold text-navy-900">
                        {r.receiptNo}
                      </TableCell>
                      <TableCell className="font-tabular text-xs text-slate-700">
                        {formatDate(r.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {r.paymentMode}
                          </Badge>
                          <span className="text-slate-500 text-[11px] font-mono">
                            {r.chequeOrTxnRef || "Counter"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell isNumeric className="font-tabular text-xs font-bold text-emerald-700">
                        {formatCurrency(r.amountReceived)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={r.clearanceStatus === "CLEARED" ? "success" : "warning"}
                          className="text-[10px]"
                        >
                          {r.clearanceStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePrintSlip(r)}
                          className="h-7 text-xs gap-1 border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
                        >
                          <Printer className="h-3 w-3" />
                          <span>Re-Print Slip</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* TAB 2: Fee Invoices & Particulars */}
        {activeTab === "invoices" && (
          <div className="space-y-4">
            {invoices.length === 0 ? (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-lg text-slate-400 text-xs">
                No fee invoices generated yet for this student.
              </div>
            ) : (
              invoices.map((inv) => (
                <div key={inv.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-navy-950">{inv.invoiceNo}</span>
                        <Badge
                          variant={
                            inv.status === "PAID"
                              ? "success"
                              : inv.status === "PARTIAL"
                              ? "warning"
                              : "danger"
                          }
                          className="text-[10px]"
                        >
                          {inv.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-slate-600">{inv.installmentLabel}</span>
                    </div>

                    <div className="text-right text-xs">
                      <span className="text-slate-400 block text-[10px]">Due Date</span>
                      <span className="font-tabular font-medium text-slate-700">{formatDate(inv.dueDate)}</span>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="space-y-1 bg-slate-50 rounded p-2.5 text-xs">
                    <div className="flex justify-between font-semibold text-slate-500 pb-1 border-b border-slate-200 text-[10px] uppercase">
                      <span>Fee Head Particular</span>
                      <span>Billed Amount</span>
                    </div>
                    {inv.items.map((it) => (
                      <div key={it.id} className="flex justify-between py-0.5">
                        <span className="text-slate-800">{it.feeHeadName}</span>
                        <span className="font-mono font-medium">{formatCurrency(it.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900">
                      <span>Total Billed:</span>
                      <span className="font-mono">{formatCurrency(inv.netAmount)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Paid to Date:</span>
                      <span className="font-mono">{formatCurrency(inv.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between text-rose-700 font-bold">
                      <span>Balance Due:</span>
                      <span className="font-mono">{formatCurrency(inv.balanceDue)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* POPUP MODAL: Re-Print Single Receipt Slip */}
      {selectedReceiptToPrint && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-xl max-h-[92vh] overflow-y-auto p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-navy-900" />
                <h3 className="text-sm font-bold text-slate-900">Official Fee Receipt Slip</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const originalTitle = document.title;
                    document.title = `Fee_Receipt_${selectedReceiptToPrint?.receiptNo}_${student.admissionNo}`;
                    window.print();
                    setTimeout(() => {
                      document.title = originalTitle;
                    }, 1000);
                  }}
                  className="h-8 text-xs bg-navy-900 text-white font-semibold gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Document</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setSelectedReceiptToPrint(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <LedgerReceiptSlip
              copyLabel="OFFICE COPY (ACCOUNTS)"
              receipt={selectedReceiptToPrint}
              student={student}
              yearName={yearName}
            />

            <div className="relative text-center my-3 select-none">
              <div className="border-t border-dashed border-slate-400 w-full absolute top-1/2"></div>
              <span className="relative bg-white px-2 text-[10px] text-slate-500 font-mono">
                ✂ - - - - - - - - CUT HERE - - - - - - - - ✂
              </span>
            </div>

            <LedgerReceiptSlip
              copyLabel="STUDENT / PARENT COPY"
              receipt={selectedReceiptToPrint}
              student={student}
              yearName={yearName}
            />
          </div>
        </div>
      )}

      {/* PRINT-ONLY AREA: Executed when window.print() is called */}
      {selectedReceiptToPrint ? (
        <div className="hidden print:block w-full max-w-2xl mx-auto space-y-6 print:m-0 print:p-0 text-black bg-white">
          <LedgerReceiptSlip
            copyLabel="OFFICE COPY (ACCOUNTS)"
            receipt={selectedReceiptToPrint}
            student={student}
            yearName={yearName}
          />

          <div className="relative text-center my-4 select-none">
            <div className="border-t-2 border-dashed border-slate-500 w-full absolute top-1/2"></div>
            <span className="relative bg-white px-3 text-[10px] text-slate-500 font-mono">
              ✂ - - - - - - - - - - - - - - - - CUT HERE - - - - - - - - - - - - - - - - ✂
            </span>
          </div>

          <LedgerReceiptSlip
            copyLabel="STUDENT / PARENT COPY"
            receipt={selectedReceiptToPrint}
            student={student}
            yearName={yearName}
          />
        </div>
      ) : (
        /* Print complete Statement of Account */
        <div className="hidden print:block w-full max-w-3xl mx-auto space-y-4 print:m-0 print:p-0 text-black bg-white">
          <div className="text-center border-b-2 border-slate-900 pb-3">
            <h1 className="text-base font-black uppercase text-navy-950">
              Crescent Matriculation Higher Secondary School
            </h1>
            <p className="text-[10px] text-slate-600">
              Official Student Statement of Fee Account • Academic Year {yearName}
            </p>
          </div>

          <div className="grid grid-cols-2 text-xs border-b border-slate-300 pb-2">
            <div>
              <span className="text-slate-500">Student: </span>
              <span className="font-bold">{student.name}</span> ({student.admissionNo})
            </div>
            <div className="text-right">
              <span className="text-slate-500">Class: </span>
              <span className="font-bold">{student.className}</span>
            </div>
            <div>
              <span className="text-slate-500">Parent: </span>
              <span>{student.parentName} ({student.parentPhone})</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500">Statement Date: </span>
              <span className="font-mono">{new Date().toLocaleDateString("en-IN")}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase border-b border-slate-200 pb-1">
              Recorded Payment Receipts
            </h3>
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase">
                  <th className="py-1">Receipt No</th>
                  <th className="py-1">Date</th>
                  <th className="py-1">Mode</th>
                  <th className="py-1 text-right">Amount (INR)</th>
                  <th className="py-1 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id} className="border-b border-slate-200">
                    <td className="py-1 font-mono font-bold">{r.receiptNo}</td>
                    <td className="py-1">{formatDate(r.createdAt)}</td>
                    <td className="py-1">{r.paymentMode}</td>
                    <td className="py-1 text-right font-mono font-bold">{formatCurrency(r.amountReceived)}</td>
                    <td className="py-1 text-right">{r.clearanceStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-4 border-t-2 border-slate-900 flex justify-between text-xs font-bold">
            <span>Total Fees Invoiced: {formatCurrency(financialSummary.totalInvoiced)}</span>
            <span>Total Paid: {formatCurrency(financialSummary.totalPaid)}</span>
            <span className={financialSummary.pendingDues > 0 ? "text-rose-700" : "text-emerald-700"}>
              Outstanding Balance Due: {formatCurrency(financialSummary.pendingDues)}
            </span>
          </div>

          <div className="pt-8 flex justify-between text-[10px] text-slate-500">
            <div>Parent Signature</div>
            <div>Authorized Accounts Officer</div>
          </div>
        </div>
      )}
    </div>
  );
}

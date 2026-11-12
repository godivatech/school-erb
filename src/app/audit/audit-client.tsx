"use client";

import * as React from "react";
import {
  History,
  Search,
  Code2,
  Copy,
  Check,
  X,
  ShieldAlert,
  ArrowRight,
  FileJson,
  Layers,
  Printer,
  Download,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination, usePagination } from "@/components/ui/pagination";

export interface AuditLogItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValueJson: any;
  newValueJson: any;
  reason: string | null;
  createdAt: string;
  actorName: string;
  actorRole: string;
}

interface AuditClientProps {
  logs: AuditLogItem[];
}

export function AuditClient({ logs }: AuditClientProps) {
  const [actionFilter, setActionFilter] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [selectedLog, setSelectedLog] = React.useState<AuditLogItem | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function handleExportCsv() {
    const headers = [
      "Timestamp",
      "Action",
      "Entity Type",
      "Entity ID",
      "Actor Name",
      "Actor Role",
      "Reason / Justification",
      "State Changes (Before -> After)",
    ];

    const rows = filteredLogs.map((log) => {
      let diffSummary = "";
      if (log.oldValueJson || log.newValueJson) {
        try {
          const oldVal = typeof log.oldValueJson === "string" ? JSON.parse(log.oldValueJson) : log.oldValueJson;
          const newVal = typeof log.newValueJson === "string" ? JSON.parse(log.newValueJson) : log.newValueJson;
          diffSummary = `Before: ${JSON.stringify(oldVal || {})} -> After: ${JSON.stringify(newVal || {})}`;
        } catch {
          diffSummary = "Data updated";
        }
      }

      return [
        log.createdAt,
        log.action,
        log.entityType,
        log.entityId,
        log.actorName,
        log.actorRole,
        log.reason || "N/A",
        diffSummary || "N/A",
      ]
        .map((field) => `"${String(field).replace(/"/g, '""')}"`)
        .join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `crescent_erp_audit_trail_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Counts for pills
  const actionCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      ALL: logs.length,
      BOUNCE: 0,
      VOID: 0,
      OVERRIDE: 0,
      CREATE: 0,
      UPDATE: 0,
    };
    for (const log of logs) {
      if (counts[log.action] !== undefined) {
        counts[log.action]++;
      }
    }
    return counts;
  }, [logs]);

  // Filtered logs
  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== "ALL" && log.action !== actionFilter) {
      return false;
    }
    if (fromDate) {
      const logDate = log.createdAt.split("T")[0];
      if (logDate < fromDate) return false;
    }
    if (toDate) {
      const logDate = log.createdAt.split("T")[0];
      if (logDate > toDate) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchActor = log.actorName.toLowerCase().includes(q);
      const matchRole = log.actorRole.toLowerCase().includes(q);
      const matchReason = (log.reason || "").toLowerCase().includes(q);
      const matchEntity = log.entityType.toLowerCase().includes(q);
      const matchId = log.entityId.toLowerCase().includes(q);
      if (!matchActor && !matchRole && !matchReason && !matchEntity && !matchId) {
        return false;
      }
    }
    return true;
  });

  const { paginatedItems: paginatedLogs, paginationProps: auditPagination } = usePagination(filteredLogs, 10);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <History className="h-5 w-5 text-navy-800" />
            Immutable Audit Trail & Override Ledger
          </h1>
          <p className="text-xs text-slate-500 font-tabular mt-0.5">
            Strict append-only audit trail: Tracks academic year overrides, bounced cheques, voided receipts, and TC issuances
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono font-semibold">
            {filteredLogs.length} / {logs.length} Entries
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            className="gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-300 bg-white"
          >
            <Download className="h-3.5 w-3.5 text-slate-600" />
            <span>Export CSV</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setShowExportModal(true)}
            className="gap-1.5 text-xs bg-navy-900 text-white font-bold hover:bg-slate-800"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Export Audit Log to PDF</span>
          </Button>
        </div>
      </div>

      {/* Interactive Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Action Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActionFilter("ALL")}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                actionFilter === "ALL"
                  ? "bg-navy-900 text-white font-semibold"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All Actions ({actionCounts.ALL})
            </button>

            <button
              onClick={() => setActionFilter("BOUNCE")}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                actionFilter === "BOUNCE"
                  ? "bg-amber-600 text-white font-semibold"
                  : "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
              }`}
            >
              BOUNCE ({actionCounts.BOUNCE})
            </button>

            <button
              onClick={() => setActionFilter("VOID")}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                actionFilter === "VOID"
                  ? "bg-red-600 text-white font-semibold"
                  : "bg-red-50 text-red-900 border border-red-200 hover:bg-red-100"
              }`}
            >
              VOID ({actionCounts.VOID})
            </button>

            <button
              onClick={() => setActionFilter("OVERRIDE")}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                actionFilter === "OVERRIDE"
                  ? "bg-purple-700 text-white font-semibold"
                  : "bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100"
              }`}
            >
              OVERRIDE ({actionCounts.OVERRIDE})
            </button>

            <button
              onClick={() => setActionFilter("CREATE")}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                actionFilter === "CREATE"
                  ? "bg-emerald-700 text-white font-semibold"
                  : "bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              CREATE ({actionCounts.CREATE})
            </button>

            <button
              onClick={() => setActionFilter("UPDATE")}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                actionFilter === "UPDATE"
                  ? "bg-blue-700 text-white font-semibold"
                  : "bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100"
              }`}
            >
              UPDATE ({actionCounts.UPDATE})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by user, reason, or entity ID..."
              className="pl-8 text-xs h-8"
            />
          </div>
        </div>

        {/* Date Range Pickers (Feature 13) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-blue-700" /> Date Range:
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500">From:</span>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-7 text-xs w-36 font-tabular bg-white"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500">To:</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-7 text-xs w-36 font-tabular bg-white"
              />
            </div>
            {(fromDate || toDate) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                className="h-7 text-[11px] text-slate-500 hover:text-slate-900 px-2"
              >
                Clear Dates
              </Button>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-tabular font-medium">
            Showing {filteredLogs.length} matching event records
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200 bg-slate-50">
              <TableHead>Timestamp</TableHead>
              <TableHead>Authorizing User</TableHead>
              <TableHead>Action Type</TableHead>
              <TableHead>Target Entity</TableHead>
              <TableHead>Audited Reason / Context</TableHead>
              <TableHead className="text-right">Audit Diff</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length > 0 ? (
              paginatedLogs.map((log) => {
                let badgeVariant: "danger" | "warning" | "interactive" | "neutral" | "success" = "neutral";
                if (log.action === "OVERRIDE") badgeVariant = "danger";
                else if (log.action === "BOUNCE") badgeVariant = "warning";
                else if (log.action === "CREATE") badgeVariant = "success";
                else if (log.action === "VOID") badgeVariant = "danger";
                else if (log.action === "UPDATE") badgeVariant = "interactive";

                const hasDiff = log.oldValueJson != null || log.newValueJson != null;

                return (
                  <TableRow
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-50/70 border-b border-slate-100 cursor-pointer"
                  >
                    <TableCell className="font-tabular font-mono text-xs text-slate-600 whitespace-nowrap">
                      {log.createdAt.replace("T", " ").substring(0, 19)}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-xs text-slate-900">
                        {log.actorName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {log.actorRole}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant} className="text-[10px] uppercase font-mono">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-navy-800">
                        {log.entityType}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        ID: {log.entityId}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 max-w-xs truncate">
                      {log.reason || "Operational system event"}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {hasDiff ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedLog(log)}
                          className="h-7 text-[11px] gap-1 font-mono hover:bg-navy-900 hover:text-white"
                        >
                          <Code2 className="h-3 w-3" />
                          <span>Inspect Diff</span>
                        </Button>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-mono">No payload</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-400">
                  No audit log entries found matching criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Pagination {...auditPagination} />
      </div>

      {/* JSON Diff Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" className="font-mono text-xs font-bold uppercase">
                    {selectedLog.action}
                  </Badge>
                  <span className="font-mono text-xs font-bold text-navy-900">
                    {selectedLog.entityType}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ({selectedLog.entityId})
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-tabular flex items-center gap-2">
                  <span>Authorized by <strong>{selectedLog.actorName}</strong> ({selectedLog.actorRole})</span>
                  <span>•</span>
                  <span>{selectedLog.createdAt.replace("T", " ").substring(0, 19)}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Audited Reason Box */}
            {selectedLog.reason && (
              <div className="p-3 bg-amber-50/70 border-b border-amber-200 text-xs text-amber-950 font-medium flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
                <span>Audited Context / Override Reason: <strong>{selectedLog.reason}</strong></span>
              </div>
            )}

            {/* Diff Body (Side by Side JSON) */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900 text-slate-100 font-mono text-[11px]">
              {/* Previous State */}
              <div className="space-y-2 flex flex-col">
                <div className="flex items-center justify-between pb-1 border-b border-slate-700">
                  <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                    <FileJson className="h-3.5 w-3.5 text-amber-400" />
                    Previous State (old_value_json)
                  </span>
                  {selectedLog.oldValueJson && (
                    <button
                      onClick={() =>
                        copyToClipboard(JSON.stringify(selectedLog.oldValueJson, null, 2), "old")
                      }
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-[10px]"
                    >
                      {copiedKey === "old" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>Copy</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 p-3 rounded bg-slate-950/80 border border-slate-800 overflow-x-auto">
                  {selectedLog.oldValueJson ? (
                    <pre className="text-amber-200/90 whitespace-pre leading-relaxed">
                      {JSON.stringify(selectedLog.oldValueJson, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-slate-600 italic">No previous state recorded (Initial creation)</span>
                  )}
                </div>
              </div>

              {/* New State */}
              <div className="space-y-2 flex flex-col">
                <div className="flex items-center justify-between pb-1 border-b border-slate-700">
                  <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                    <FileJson className="h-3.5 w-3.5 text-emerald-400" />
                    New State (new_value_json)
                  </span>
                  {selectedLog.newValueJson && (
                    <button
                      onClick={() =>
                        copyToClipboard(JSON.stringify(selectedLog.newValueJson, null, 2), "new")
                      }
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-[10px]"
                    >
                      {copiedKey === "new" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>Copy</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 p-3 rounded bg-slate-950/80 border border-slate-800 overflow-x-auto">
                  {selectedLog.newValueJson ? (
                    <pre className="text-emerald-300 whitespace-pre leading-relaxed">
                      {JSON.stringify(selectedLog.newValueJson, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-slate-600 italic">No new state recorded (Entity deleted / voided)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono text-[11px]">
                Immutable Event ID: {selectedLog.id}
              </span>
              <Button size="sm" variant="outline" onClick={() => setSelectedLog(null)}>
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Official Export Audit Log to PDF Modal (Feature 13) */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 p-2 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full mx-auto my-auto flex flex-col overflow-hidden max-h-[95vh]">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-emerald-400" />
                <span className="font-bold text-xs">
                  Official System Audit Log Export ({filteredLogs.length} Records)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-8 px-3"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print / Download PDF (1-Click)</span>
                </Button>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Container */}
            <div className="p-8 overflow-y-auto bg-white print:p-8">
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
                  System Audit Trail & Security Override Ledger Report
                </div>
              </div>

              {/* Report Parameters Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs mb-5">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Report Generated</span>
                  <strong className="text-slate-900">{new Date().toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Date Range Filter</span>
                  <strong className="text-slate-900 font-mono">
                    {fromDate || "Beginning"} → {toDate || "Present"}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Action Filter</span>
                  <strong className="text-slate-900 font-mono">{actionFilter}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Audited Events</span>
                  <strong className="text-emerald-700 font-bold">{filteredLogs.length} Events</strong>
                </div>
              </div>

              {/* Audit Table */}
              <table className="w-full text-xs border-collapse border border-slate-300 mb-6">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 text-left">
                    <th className="border border-slate-300 px-3 py-1.5 font-bold">Timestamp (IST)</th>
                    <th className="border border-slate-300 px-3 py-1.5 font-bold">Authorizing User</th>
                    <th className="border border-slate-300 px-3 py-1.5 font-bold text-center">Action</th>
                    <th className="border border-slate-300 px-3 py-1.5 font-bold">Entity</th>
                    <th className="border border-slate-300 px-3 py-1.5 font-bold">Context / Override Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-3 py-1 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        {log.createdAt.replace("T", " ").substring(0, 19)}
                      </td>
                      <td className="border border-slate-300 px-3 py-1">
                        <strong className="text-slate-900">{log.actorName}</strong>
                        <span className="block text-[10px] text-slate-500 font-mono">{log.actorRole}</span>
                      </td>
                      <td className="border border-slate-300 px-3 py-1 text-center font-mono font-bold">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 border border-slate-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="border border-slate-300 px-3 py-1 font-mono text-[11px]">
                        <div>{log.entityType}</div>
                        <div className="text-[10px] text-slate-400">{log.entityId}</div>
                      </td>
                      <td className="border border-slate-300 px-3 py-1 text-slate-800">
                        {log.reason || "System state transition recorded"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Audit Certification Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 mt-4 border-t border-slate-300 text-center text-xs text-slate-600">
                <div>
                  <div className="border-b border-slate-400 h-8 mb-1"></div>
                  <span className="font-semibold">System Administrator / IT Auditor</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 h-8 mb-1"></div>
                  <span className="font-semibold">Principal / Correspondent Seal</span>
                </div>
              </div>

              {/* Legal Notice */}
              <div className="text-center text-[10px] text-slate-400 pt-6">
                This document is an official certified extract from the tamper-evident audit register of Crescent Matriculation Higher Secondary School.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

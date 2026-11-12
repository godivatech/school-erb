"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Save,
  Download,
  FileUp,
  Plus,
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
import { bulkImportStudentsCsv } from "@/actions/students";
import { ActionBanner } from "@/components/ui/action-banner";

export interface CsvImportRow {
  id: number;
  admNo: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  classId: string;
  sectionId: string;
  parentPhone: string;
  parentName: string;
  errors: Record<string, string>;
}

export interface ImportMetaOptions {
  classes: Array<{
    id: string;
    name: string;
    sections: Array<{ id: string; name: string }>;
  }>;
  academicYearId: string;
  schoolId: string;
  isLocked: boolean;
}

export function BulkCsvImportClient({
  classes,
  academicYearId,
  schoolId,
  isLocked,
}: ImportMetaOptions) {
  const router = useRouter();

  const defaultClass = classes[0];
  const defaultSection = defaultClass?.sections[0];

  const [rows, setRows] = React.useState<CsvImportRow[]>([
    {
      id: 1,
      admNo: "ADM-2026-0301",
      firstName: "Kavin",
      lastName: "Kumar",
      dob: "2011-08-14",
      gender: "MALE",
      classId: defaultClass?.id || "",
      sectionId: defaultSection?.id || "",
      parentName: "S. Karthikeyan",
      parentPhone: "9845012345",
      errors: {},
    },
    {
      id: 2,
      admNo: "ADM-2026-0302",
      firstName: "Harini",
      lastName: "", // Error: Missing last name
      dob: "12/04/2011", // Error: Wrong date format
      gender: "FEMALE",
      classId: defaultClass?.id || "",
      sectionId: defaultSection?.id || "",
      parentName: "Senthil Nathan",
      parentPhone: "98450", // Error: Phone too short
      errors: {
        lastName: "Last name is required",
        dob: "Date must be YYYY-MM-DD",
        parentPhone: "Phone must be at least 10 digits",
      },
    },
    {
      id: 3,
      admNo: "ADM-2026-0303",
      firstName: "Vetrivel",
      lastName: "Sundaram",
      dob: "2011-12-05",
      gender: "MALE",
      classId: defaultClass?.id || "",
      sectionId: defaultSection?.id || "",
      parentName: "M. Sundaram",
      parentPhone: "9876543210",
      errors: {},
    },
  ]);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [successCount, setSuccessCount] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Validate a row on cell edit
  const validateField = (field: string, value: string): string | null => {
    if (field === "admNo" && !value.trim()) return "Admission No is required";
    if (field === "firstName" && !value.trim()) return "First name is required";
    if (field === "lastName" && !value.trim()) return "Last name is required";
    if (field === "dob" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Date must be YYYY-MM-DD";
    if (field === "parentPhone" && value.replace(/\D/g, "").length < 10) return "Phone must be >= 10 digits";
    return null;
  };

  const [notification, setNotification] = React.useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);

  const recomputeRowErrors = (targetRows: CsvImportRow[]): CsvImportRow[] => {
    const admCounts = new Map<string, number>();
    for (const r of targetRows) {
      const trimmed = r.admNo.trim();
      if (trimmed) {
        admCounts.set(trimmed, (admCounts.get(trimmed) || 0) + 1);
      }
    }

    return targetRows.map((r) => {
      const errs: Record<string, string> = {};
      if (!r.admNo.trim()) errs.admNo = "Admission No is required";
      else if ((admCounts.get(r.admNo.trim()) || 0) > 1) {
        errs.admNo = "Duplicate admission number in this import batch";
      }

      if (!r.firstName.trim()) errs.firstName = "First name is required";
      if (!r.lastName.trim()) errs.lastName = "Last name is required";
      if (!r.dob || !/^\d{4}-\d{2}-\d{2}$/.test(r.dob)) errs.dob = "Date must be YYYY-MM-DD";
      const cleanPhone = r.parentPhone.replace(/\D/g, "");
      if (cleanPhone.length < 10) errs.parentPhone = "Phone must be at least 10 digits";

      return {
        ...r,
        errors: errs,
      };
    });
  };

  const handleDownloadSampleCsv = () => {
    const csvHeader = "Admission_No,First_Name,Last_Name,Date_of_Birth,Gender,Primary_Parent_Name,Primary_Phone\n";
    const sampleRows = [
      "ADM-2026-0601,Aravind,Natarajan,2014-03-12,MALE,Natarajan S,9840112233",
      "ADM-2026-0602,Keerthana,Balaji,2014-07-25,FEMALE,Balaji R,9840223344",
      "ADM-2026-0603,Manoj,Sundar,2014-11-04,MALE,Sundar V,9840334455",
    ].join("\n");

    const blob = new Blob([csvHeader + sampleRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "crescent_students_import_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotification({ type: "success", message: "Sample CSV template downloaded successfully!" });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setNotification({ type: "error", message: "Uploaded CSV must contain at least a header row and 1 data row." });
        return;
      }

      const dataLines = lines.slice(1);
      const parsedRows: CsvImportRow[] = dataLines.map((line, idx) => {
        const cols = line.split(",").map((c) => c.replace(/^["']|["']$/g, "").trim());
        const admNo = cols[0] || `ADM-2026-0${700 + idx}`;
        const firstName = cols[1] || "";
        const lastName = cols[2] || "";
        const dob = cols[3] || "2014-01-01";
        const rawGender = (cols[4] || "MALE").toUpperCase();
        const gender = (rawGender === "FEMALE" ? "FEMALE" : rawGender === "OTHER" ? "OTHER" : "MALE") as any;
        const parentName = cols[5] || "";
        const parentPhone = cols[6] || "";

        return {
          id: idx + 1,
          admNo,
          firstName,
          lastName,
          dob,
          gender,
          classId: defaultClass?.id || "",
          sectionId: defaultSection?.id || "",
          parentName,
          parentPhone,
          errors: {},
        };
      });

      const validated = recomputeRowErrors(parsedRows);
      setRows(validated);
      setNotification({
        type: "success",
        message: `Parsed ${validated.length} rows from "${file.name}". Review and commit!`,
      });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCellChange = (rowId: number, field: keyof CsvImportRow, value: string) => {
    setRows((prev) => {
      const updated = prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r));
      return recomputeRowErrors(updated);
    });
  };

  const handleAddRow = () => {
    setRows((prev) => {
      const newId = prev.length > 0 ? Math.max(...prev.map((r) => r.id)) + 1 : 1;
      const newRow: CsvImportRow = {
        id: newId,
        admNo: `ADM-2026-0${800 + newId}`,
        firstName: "",
        lastName: "",
        dob: "2014-06-15",
        gender: "MALE",
        classId: defaultClass?.id || "",
        sectionId: defaultSection?.id || "",
        parentName: "",
        parentPhone: "",
        errors: { firstName: "First name is required", lastName: "Last name is required" },
      };
      return [...prev, newRow];
    });
  };

  const totalErrors = rows.reduce(
    (count, r) => count + Object.keys(r.errors).length,
    0
  );

  const handleCommitBatch = async () => {
    if (isLocked) {
      setNotification({ type: "error", message: "Academic year is LOCKED." });
      return;
    }

    if (totalErrors > 0) {
      setNotification({
        type: "warning",
        message: `Please fix the ${totalErrors} red validation errors before committing.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await bulkImportStudentsCsv({
        schoolId,
        userId: "usr_principal",
        academicYearId,
        classId: rows[0]?.classId || defaultClass?.id || "",
        sectionId: rows[0]?.sectionId || defaultSection?.id || "",
        students: rows.map((r) => ({
          admissionNo: r.admNo,
          firstName: r.firstName,
          lastName: r.lastName,
          dob: r.dob,
          gender: r.gender,
          primaryParentName: r.parentName || "Parent",
          primaryPhone: r.parentPhone,
        })),
      });

      if (res.success) {
        setSuccessCount(res.count);
        setNotification({
          type: "success",
          message: `Successfully imported ${res.count} student records!`,
        });
        setTimeout(() => {
          router.push("/students");
        }, 2000);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: "Import error: " + err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Action Notification Banner */}
      {notification && (
        <ActionBanner
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <Link href="/students">
            <Button size="icon" variant="outline" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-navy-800" />
              Interactive CSV Bulk Import Wizard
            </h1>
            <p className="text-xs text-slate-500 font-tabular">
              Inline red-cell editing • Validates all rows before saving
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totalErrors > 0 ? (
            <Badge variant="danger" className="text-xs gap-1 font-tabular">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{totalErrors} Cell Errors Require Fixing</span>
            </Badge>
          ) : (
            <Badge variant="success" className="text-xs gap-1 font-tabular">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>All {rows.length} Rows Validated</span>
            </Badge>
          )}
        </div>
      </div>

      {/* CSV Import Toolbar Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv"
            className="hidden"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs h-8 bg-white gap-1.5 font-semibold text-slate-800"
          >
            <FileUp className="h-3.5 w-3.5 text-blue-600" />
            <span>Upload CSV File (.csv)</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadSampleCsv}
            className="text-xs h-8 bg-white gap-1.5 font-semibold text-slate-700"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Download Sample CSV Template</span>
          </Button>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleAddRow}
          className="text-xs h-8 bg-white gap-1.5 text-slate-700"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Row</span>
        </Button>
      </div>

      {successCount != null && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>
            Successfully imported {successCount} student records! Redirecting to SIS directory...
          </span>
        </div>
      )}

      {/* Inline Editable Spreadsheet Grid */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200 bg-slate-50">
              <TableHead className="w-12 text-center">Row</TableHead>
              <TableHead className="w-28">Admission No</TableHead>
              <TableHead>First Name</TableHead>
              <TableHead>Last Name</TableHead>
              <TableHead>DOB (YYYY-MM-DD)</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Parent Phone</TableHead>
              <TableHead className="w-24 text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const hasErrors = Object.keys(r.errors).length > 0;

              return (
                <TableRow
                  key={r.id}
                  className={`border-b border-slate-100 ${
                    hasErrors ? "bg-rose-50/40" : "bg-white"
                  }`}
                >
                  <TableCell className="text-center font-tabular text-xs font-bold text-slate-400">
                    #{r.id}
                  </TableCell>

                  {/* Admission No */}
                  <TableCell className="p-1">
                    <div className="space-y-0.5">
                      <input
                        type="text"
                        value={r.admNo}
                        onChange={(e) => handleCellChange(r.id, "admNo", e.target.value)}
                        className={`w-full h-7 px-2 text-xs font-mono font-semibold border rounded outline-none ${
                          r.errors.admNo
                            ? "border-red-500 bg-red-50 text-red-900"
                            : "border-slate-200 focus:border-navy-600 text-blue-950"
                        }`}
                      />
                      {r.errors.admNo && (
                        <span className="text-[10px] text-red-600 font-medium block">
                          {r.errors.admNo}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* First Name */}
                  <TableCell className="p-1">
                    <input
                      type="text"
                      value={r.firstName}
                      onChange={(e) => handleCellChange(r.id, "firstName", e.target.value)}
                      className="w-full h-7 px-2 text-xs border border-slate-200 rounded focus:border-navy-600 outline-none"
                    />
                  </TableCell>

                  {/* Last Name (with error cell highlighting) */}
                  <TableCell className="p-1">
                    <div className="space-y-0.5">
                      <input
                        type="text"
                        value={r.lastName}
                        onChange={(e) => handleCellChange(r.id, "lastName", e.target.value)}
                        placeholder="Required"
                        className={`w-full h-7 px-2 text-xs border rounded outline-none ${
                          r.errors.lastName
                            ? "border-red-500 bg-red-50/80 text-red-900 font-semibold"
                            : "border-slate-200 focus:border-navy-600"
                        }`}
                      />
                      {r.errors.lastName && (
                        <span className="text-[10px] text-red-600 font-medium block">
                          {r.errors.lastName}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* DOB */}
                  <TableCell className="p-1">
                    <div className="space-y-0.5">
                      <input
                        type="text"
                        value={r.dob}
                        onChange={(e) => handleCellChange(r.id, "dob", e.target.value)}
                        className={`w-full h-7 px-2 text-xs font-tabular border rounded outline-none ${
                          r.errors.dob
                            ? "border-red-500 bg-red-50/80 text-red-900 font-semibold"
                            : "border-slate-200 focus:border-navy-600"
                        }`}
                      />
                      {r.errors.dob && (
                        <span className="text-[10px] text-red-600 font-medium block">
                          {r.errors.dob}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Gender */}
                  <TableCell className="p-1">
                    <select
                      value={r.gender}
                      onChange={(e) => handleCellChange(r.id, "gender", e.target.value)}
                      className="w-full h-7 px-1 text-xs border border-slate-200 rounded bg-white"
                    >
                      <option value="MALE">MALE</option>
                      <option value="FEMALE">FEMALE</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </TableCell>

                  {/* Parent Phone */}
                  <TableCell className="p-1">
                    <div className="space-y-0.5">
                      <input
                        type="text"
                        value={r.parentPhone}
                        onChange={(e) => handleCellChange(r.id, "parentPhone", e.target.value)}
                        className={`w-full h-7 px-2 text-xs font-tabular border rounded outline-none ${
                          r.errors.parentPhone
                            ? "border-red-500 bg-red-50/80 text-red-900 font-semibold"
                            : "border-slate-200 focus:border-navy-600"
                        }`}
                      />
                      {r.errors.parentPhone && (
                        <span className="text-[10px] text-red-600 font-medium block">
                          {r.errors.parentPhone}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell className="text-center">
                    <Badge
                      variant={hasErrors ? "danger" : "success"}
                      className="text-[10px] py-0 px-1.5"
                    >
                      {hasErrors ? "Invalid" : "Ready"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-slate-500">
          Fix highlighted red cells directly in the table above to unlock atomic batch import.
        </span>

        <Button
          onClick={handleCommitBatch}
          disabled={isLocked || isSubmitting || totalErrors > 0}
          className="text-xs bg-navy-900 text-white font-bold gap-2 px-6"
        >
          {isSubmitting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>{isSubmitting ? "Importing to DB..." : `Commit ${rows.length} Validated Rows`}</span>
        </Button>
      </div>
    </div>
  );
}

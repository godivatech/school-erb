"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Plus,
  Calendar,
  Layers,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
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
  createExamTermAndExam,
  createExamSchedule,
} from "@/actions/exams";

export interface TermItem {
  id: string;
  name: string;
  weightagePercent: string;
  orderIndex: number;
}

export interface ExamItem {
  id: string;
  termId: string;
  name: string;
  aggregationRule: string;
  weightage: string | null;
}

export interface ScheduleItem {
  id: string;
  examId: string;
  className: string;
  subjectName: string;
  examDate: string | null;
  maxTheory: string;
  maxPractical: string | null;
  passMarks: string;
}

export interface ClassOption {
  id: string;
  name: string;
}

export interface SubjectOption {
  id: string;
  name: string;
  code: string;
}

interface ExamsClientProps {
  schoolId: string;
  academicYearId: string;
  academicYearName: string;
  isLocked: boolean;
  terms: TermItem[];
  allExams: ExamItem[];
  schedules: ScheduleItem[];
  scheduleCountsMap: Record<string, number>;
  classesList: ClassOption[];
  subjectsList: SubjectOption[];
}

export function ExamsClient({
  schoolId,
  academicYearId,
  academicYearName,
  isLocked,
  terms,
  allExams,
  schedules,
  scheduleCountsMap,
  classesList,
  subjectsList,
}: ExamsClientProps) {
  const router = useRouter();

  // Modals
  const [showTermModal, setShowTermModal] = React.useState(false);
  const [showScheduleModal, setShowScheduleModal] = React.useState(false);

  // Status
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Term Form
  const [newTermName, setNewTermName] = React.useState("");
  const [newWeightage, setNewWeightage] = React.useState("50");
  const [newExamName, setNewExamName] = React.useState("");
  const [newAggregationRule, setNewAggregationRule] = React.useState<"SUM" | "WEIGHTED" | "BEST_OF_N">("SUM");

  // Schedule Form
  const [selectedExamId, setSelectedExamId] = React.useState(allExams[0]?.id || "");
  const [selectedClassId, setSelectedClassId] = React.useState(classesList[0]?.id || "");
  const [selectedSubjectId, setSelectedSubjectId] = React.useState(subjectsList[0]?.id || "");
  const [examDate, setExamDate] = React.useState("2026-09-20");
  const [maxTheoryMarks, setMaxTheoryMarks] = React.useState("80");
  const [maxPracticalMarks, setMaxPracticalMarks] = React.useState("20");
  const [passMarks, setPassMarks] = React.useState("35");

  async function handleCreateTerm(e: React.FormEvent) {
    e.preventDefault();
    if (!newTermName.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await createExamTermAndExam({
        schoolId,
        academicYearId,
        termName: newTermName.trim(),
        weightagePercent: parseFloat(newWeightage) || 50,
        examName: newExamName.trim() || undefined,
        aggregationRule: newAggregationRule,
      });

      if (res.success) {
        setFeedback({ type: "success", message: `Term "${res.term.name}" and cycle created successfully.` });
        setShowTermModal(false);
        setNewTermName("");
        setNewExamName("");
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to create exam term" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExamId || !selectedClassId || !selectedSubjectId) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await createExamSchedule({
        examId: selectedExamId,
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        examDate,
        maxTheoryMarks: parseFloat(maxTheoryMarks) || 80,
        maxPracticalMarks: parseFloat(maxPracticalMarks) || 0,
        passMarks: parseFloat(passMarks) || 35,
      });

      if (res.success) {
        setFeedback({ type: "success", message: `Subject examination scheduled. You can now enter student marks.` });
        setShowScheduleModal(false);
        // Prompt immediate navigation to spreadsheet entry
        router.push(`/exams/mark-entry?scheduleId=${res.schedule.id}`);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to schedule exam" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 rounded border text-xs flex items-center justify-between animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-red-50 text-red-900 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Examinations & Weightage Schemes
          </h1>
          <p className="text-xs text-slate-500 font-tabular mt-0.5">
            CBSE / ICSE / State compliant aggregation (SUM, WEIGHTED, BEST_OF_N) • Academic Year: {academicYearName}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={isLocked ? "warning" : "success"} className="text-xs">
            {academicYearName} ({isLocked ? "LOCKED" : "ACTIVE"})
          </Badge>

          {!isLocked && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowTermModal(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Term</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowScheduleModal(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Schedule Exam</span>
              </Button>
            </>
          )}

          <Link href="/exams/mark-entry">
            <Button size="sm" variant="default" className="gap-1.5 font-semibold bg-navy-900 text-white">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Spreadsheet Mark Entry Grid</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Terms & Exams Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-4 w-4 text-navy-800" />
            Active Exam Terms & Cycles
          </h2>
          <span className="text-[11px] text-slate-500 font-tabular">
            {terms.length} Terms Configured
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200 bg-slate-50">
              <TableHead>Term Name</TableHead>
              <TableHead>Scheduled Exams</TableHead>
              <TableHead>Weightage</TableHead>
              <TableHead>Aggregation Rule</TableHead>
              <TableHead isNumeric>Schedule Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {terms.map((term) => {
              const termExams = allExams.filter((e) => e.termId === term.id);

              return (
                <React.Fragment key={term.id}>
                  <TableRow className="bg-slate-50/50 font-semibold border-b border-slate-200">
                    <TableCell colSpan={2} className="text-xs text-navy-900">
                      {term.name}
                    </TableCell>
                    <TableCell className="font-tabular text-xs">
                      {term.weightagePercent}%
                    </TableCell>
                    <TableCell colSpan={2} className="text-xs text-slate-500">
                      Term Weightage
                    </TableCell>
                  </TableRow>

                  {termExams.map((exam) => {
                    const count = scheduleCountsMap[exam.id] || 0;

                    return (
                      <TableRow key={exam.id} className="hover:bg-slate-50/70 border-b border-slate-100">
                        <TableCell className="pl-6 text-xs text-slate-700">
                          ↳ {exam.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="neutral" className="text-[10px] font-mono">
                            {exam.aggregationRule}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-tabular text-xs">
                          {exam.weightage}%
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {exam.aggregationRule === "SUM"
                            ? "Direct Marks Addition"
                            : "Weighted Normalization"}
                        </TableCell>
                        <TableCell isNumeric className="font-tabular font-bold text-xs text-navy-800">
                          {count} Subjects Scheduled
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Scheduled Subject Examinations Table with Direct Jump Link */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-emerald-700" />
            <span>Scheduled Subject Papers ({schedules.length})</span>
          </span>
          <span className="text-[11px] text-slate-500 font-tabular">
            Click "Enter Marks" to open live spreadsheet grid
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200 bg-slate-50">
              <TableHead>Class / Section</TableHead>
              <TableHead>Subject Paper</TableHead>
              <TableHead>Exam Date</TableHead>
              <TableHead isNumeric>Max Theory</TableHead>
              <TableHead isNumeric>Max Practical</TableHead>
              <TableHead isNumeric>Pass Marks</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.length > 0 ? (
              schedules.map((s) => (
                <TableRow key={s.id} className="hover:bg-slate-50/70 border-b border-slate-100">
                  <TableCell className="font-semibold text-xs text-slate-900">
                    {s.className}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-slate-800">
                    {s.subjectName}
                  </TableCell>
                  <TableCell className="font-tabular text-xs text-slate-600">
                    {s.examDate}
                  </TableCell>
                  <TableCell isNumeric className="font-tabular text-xs">
                    {s.maxTheory}
                  </TableCell>
                  <TableCell isNumeric className="font-tabular text-xs text-slate-500">
                    {s.maxPractical || "0"}
                  </TableCell>
                  <TableCell isNumeric className="font-tabular text-xs font-semibold text-emerald-800">
                    {s.passMarks}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/exams/mark-entry?scheduleId=${s.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] gap-1 font-semibold hover:bg-navy-900 hover:text-white"
                      >
                        <FileSpreadsheet className="h-3 w-3" />
                        <span>Enter Marks</span>
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-xs text-slate-400">
                  No subject exams scheduled yet. Click "Schedule Exam" to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal 1: Create Term */}
      {showTermModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-navy-800" />
                Create New Exam Term & Cycle
              </h3>
              <button
                onClick={() => setShowTermModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTerm} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Term Name *
                </label>
                <Input
                  value={newTermName}
                  onChange={(e) => setNewTermName(e.target.value)}
                  placeholder="e.g. Term 2 Annual Finals"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Term Weightage (%)
                  </label>
                  <Input
                    type="number"
                    value={newWeightage}
                    onChange={(e) => setNewWeightage(e.target.value)}
                    min={1}
                    max={100}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Aggregation Rule
                  </label>
                  <select
                    value={newAggregationRule}
                    onChange={(e) => setNewAggregationRule(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
                  >
                    <option value="SUM">SUM (Direct Addition)</option>
                    <option value="WEIGHTED">WEIGHTED</option>
                    <option value="BEST_OF_N">BEST_OF_N</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Examination Cycle Name
                </label>
                <Input
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                  placeholder="e.g. Final Theory & Practical Papers"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTermModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-navy-900 text-white font-semibold"
                >
                  {isSubmitting ? "Creating..." : "Create Term"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Schedule Exam */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-lg p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-700" />
                Schedule Subject Exam Paper
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Examination Cycle *
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
                  required
                >
                  {allExams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Class / Grade *
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
                    required
                  >
                    {classesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Subject *
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
                    required
                  >
                    {subjectsList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Date of Examination *
                </label>
                <Input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Max Theory *
                  </label>
                  <Input
                    type="number"
                    value={maxTheoryMarks}
                    onChange={(e) => setMaxTheoryMarks(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Max Practical
                  </label>
                  <Input
                    type="number"
                    value={maxPracticalMarks}
                    onChange={(e) => setMaxPracticalMarks(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Passing Marks
                  </label>
                  <Input
                    type="number"
                    value={passMarks}
                    onChange={(e) => setPassMarks(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScheduleModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-navy-900 text-white font-semibold"
                >
                  {isSubmitting ? "Scheduling..." : "Schedule Paper & Open Grid"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

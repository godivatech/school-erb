"use client";

import * as React from "react";
import {
  BellRing,
  Plus,
  Paperclip,
  Calendar,
  AlertTriangle,
  User,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Pencil,
  FileText,
  Download,
  ExternalLink,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { createNotice, updateNotice, deleteNotice } from "@/actions/notices";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionBanner } from "@/components/ui/action-banner";
import { Pagination, usePagination } from "@/components/ui/pagination";

export interface NoticeItem {
  id: string;
  title: string;
  content: string;
  targetAudience: "ALL" | "TEACHERS" | "PARENTS" | "STUDENTS";
  applicableClassIds?: string[] | null;
  priority: "NORMAL" | "URGENT";
  attachmentUrl: string | null;
  createdAt: string;
  authorName: string | null;
}

export interface ClassOption {
  id: string;
  name: string;
}

interface NoticesClientProps {
  schoolId: string;
  academicYearId: string;
  academicYearName: string;
  isLocked: boolean;
  currentUserId: string;
  currentUserRole: string;
  initialNotices: NoticeItem[];
  classesList?: ClassOption[];
}

export function NoticesClient({
  schoolId,
  academicYearId,
  academicYearName,
  isLocked,
  currentUserId,
  currentUserRole,
  initialNotices,
  classesList = [],
}: NoticesClientProps) {
  const [showModal, setShowModal] = React.useState(false);
  const [editingNotice, setEditingNotice] = React.useState<NoticeItem | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [previewDocument, setPreviewDocument] = React.useState<{
    name: string;
    title: string;
    author: string;
    date: string;
  } | null>(null);

  // In-app Confirmation Dialog state
  const [confirmAction, setConfirmAction] = React.useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    confirmText?: string;
    variant?: "danger" | "warning" | "primary";
    action: () => Promise<void>;
  } | null>(null);

  // Filter & Search states
  const [activeAudienceFilter, setActiveAudienceFilter] = React.useState<string>("ALL");
  const [urgentOnly, setUrgentOnly] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Class Lookup Map
  const classMap = React.useMemo(() => {
    return new Map(classesList.map((c) => [c.id, c.name]));
  }, [classesList]);

  // Create Form states
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [targetAudience, setTargetAudience] = React.useState<"ALL" | "TEACHERS" | "PARENTS" | "STUDENTS">("ALL");
  const [selectedClassIds, setSelectedClassIds] = React.useState<string[]>([]);
  const [priority, setPriority] = React.useState<"NORMAL" | "URGENT">("NORMAL");
  const [attachmentName, setAttachmentName] = React.useState("");

  // Edit Form states
  const [editTitle, setEditTitle] = React.useState("");
  const [editContent, setEditContent] = React.useState("");
  const [editAudience, setEditAudience] = React.useState<"ALL" | "TEACHERS" | "PARENTS" | "STUDENTS">("ALL");
  const [editClassIds, setEditClassIds] = React.useState<string[]>([]);
  const [editPriority, setEditPriority] = React.useState<"NORMAL" | "URGENT">("NORMAL");
  const [editAttachment, setEditAttachment] = React.useState("");

  async function handleCreateNotice(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await createNotice({
        schoolId,
        academicYearId,
        authorId: currentUserId,
        title: title.trim(),
        content: content.trim(),
        targetAudience,
        applicableClassIds: selectedClassIds,
        priority,
        attachmentUrl: attachmentName.trim() || undefined,
      });

      if (res.success) {
        setFeedback({ type: "success", message: `Circular "${res.notice.title}" broadcasted successfully.` });
        setShowModal(false);
        setTitle("");
        setContent("");
        setSelectedClassIds([]);
        setAttachmentName("");
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to publish notice" });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenEdit(notice: NoticeItem) {
    setEditingNotice(notice);
    setEditTitle(notice.title);
    setEditContent(notice.content);
    setEditAudience(notice.targetAudience);
    setEditClassIds(notice.applicableClassIds || []);
    setEditPriority(notice.priority);
    setEditAttachment(notice.attachmentUrl || "");
  }

  async function handleUpdateNotice(e: React.FormEvent) {
    e.preventDefault();
    if (!editingNotice || !editTitle.trim() || !editContent.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await updateNotice({
        id: editingNotice.id,
        schoolId,
        title: editTitle.trim(),
        content: editContent.trim(),
        targetAudience: editAudience,
        applicableClassIds: editClassIds,
        priority: editPriority,
        attachmentUrl: editAttachment.trim() || undefined,
      });

      if (res.success) {
        setFeedback({ type: "success", message: `Circular "${res.notice.title}" updated successfully.` });
        setEditingNotice(null);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to update notice" });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDeleteNotice(id: string, noticeTitle: string) {
    setConfirmAction({
      isOpen: true,
      title: "Delete Notice",
      description: `Are you sure you want to remove "${noticeTitle}"? This will permanently delete the circular from the notice board and parent portal.`,
      confirmText: "Delete Notice",
      variant: "danger",
      action: async () => {
        try {
          const res = await deleteNotice({ id, schoolId, userId: currentUserId });
          if (res.success) {
            setFeedback({ type: "success", message: `Notice deleted successfully.` });
          }
        } catch (err: any) {
          setFeedback({ type: "error", message: err.message || "Failed to delete notice" });
        }
      },
    });
  }

  const filteredNotices = initialNotices.filter((n) => {
    if (activeAudienceFilter !== "ALL" && n.targetAudience !== activeAudienceFilter) {
      return false;
    }
    if (urgentOnly && n.priority !== "URGENT") {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = n.title.toLowerCase().includes(q);
      const matchContent = n.content.toLowerCase().includes(q);
      const matchAuthor = (n.authorName || "").toLowerCase().includes(q);
      if (!matchTitle && !matchContent && !matchAuthor) return false;
    }
    return true;
  });

  const { paginatedItems: paginatedNotices, paginationProps: noticePagination } = usePagination(filteredNotices, 5);

  return (
    <div className="space-y-5">
      {/* Feedback Banner */}
      {feedback && (
        <ActionBanner
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BellRing className="h-5 w-5 text-navy-800" />
            Notice Board & Broadcast Circulars
          </h1>
          <p className="text-xs text-slate-500 font-tabular mt-0.5">
            Role-targeted circulars for Teachers, Parents, and Students • Academic Year: {academicYearName}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={isLocked ? "warning" : "success"} className="text-xs">
            {academicYearName} ({isLocked ? "LOCKED" : "ACTIVE"})
          </Badge>

          {!isLocked && (
            <Button
              size="sm"
              variant="default"
              onClick={() => setShowModal(true)}
              className="gap-1.5 text-xs font-semibold bg-navy-900 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Publish Circular</span>
            </Button>
          )}
        </div>
      </div>

      {/* Controls: Filter Pills & Live Search */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => {
              setActiveAudienceFilter("ALL");
              setUrgentOnly(false);
            }}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
              activeAudienceFilter === "ALL" && !urgentOnly
                ? "bg-navy-900 text-white font-semibold"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All Circulars ({initialNotices.length})
          </button>

          <button
            onClick={() => setUrgentOnly(!urgentOnly)}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors flex items-center gap-1 ${
              urgentOnly
                ? "bg-amber-600 text-white font-semibold"
                : "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            Urgent Only
          </button>

          <button
            onClick={() => {
              setActiveAudienceFilter("TEACHERS");
              setUrgentOnly(false);
            }}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
              activeAudienceFilter === "TEACHERS" && !urgentOnly
                ? "bg-navy-900 text-white font-semibold"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Teachers
          </button>

          <button
            onClick={() => {
              setActiveAudienceFilter("PARENTS");
              setUrgentOnly(false);
            }}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
              activeAudienceFilter === "PARENTS" && !urgentOnly
                ? "bg-navy-900 text-white font-semibold"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Parents
          </button>

          <button
            onClick={() => {
              setActiveAudienceFilter("STUDENTS");
              setUrgentOnly(false);
            }}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
              activeAudienceFilter === "STUDENTS" && !urgentOnly
                ? "bg-navy-900 text-white font-semibold"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Students
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search circulars..."
            className="pl-8 text-xs h-8"
          />
        </div>
      </div>

      {/* Notices List */}
      <div className="space-y-3">
        {filteredNotices.length > 0 ? (
          <>
            {paginatedNotices.map((notice) => (
              <div
                key={notice.id}
                className={`p-4 rounded-lg border transition-colors shadow-sm bg-white ${
                  notice.priority === "URGENT"
                    ? "border-amber-300 bg-amber-50/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2 mb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {notice.priority === "URGENT" && (
                      <Badge variant="warning" className="gap-1 text-[10px] uppercase font-bold">
                        <AlertTriangle className="h-3 w-3" /> Urgent
                      </Badge>
                    )}
                    <Badge variant="neutral" className="text-[10px] uppercase font-mono">
                      Audience: {notice.targetAudience}
                    </Badge>
                    {notice.applicableClassIds && notice.applicableClassIds.length > 0 ? (
                      <Badge variant="primary" className="text-[10px] font-mono">
                        Target: {notice.applicableClassIds.map((id) => classMap.get(id) || id).join(", ")}
                      </Badge>
                    ) : (
                      <Badge variant="neutral" className="text-[10px] text-slate-500">
                        All Classes
                      </Badge>
                    )}
                    <h2 className="text-sm font-bold text-slate-900">
                      {notice.title}
                    </h2>
                  </div>

                  <div className="text-[11px] text-slate-400 font-tabular flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3 text-slate-400" />
                      {notice.authorName || "Administration"}
                    </span>
                    <span>{formatDate(notice.createdAt.split("T")[0])}</span>

                    {!isLocked && (currentUserRole === "SUPER_ADMIN" || currentUserRole === "PRINCIPAL" || currentUserRole === "TEACHER") && (
                      <button
                        onClick={() => handleOpenEdit(notice)}
                        className="text-slate-400 hover:text-navy-900 transition-colors"
                        title="Edit Circular"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {!isLocked && currentUserRole === "SUPER_ADMIN" && (
                      <button
                        onClick={() => handleDeleteNotice(notice.id, notice.title)}
                        className="text-slate-300 hover:text-red-600 transition-colors"
                        title="Delete Notice"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  {notice.content}
                </p>

                {notice.attachmentUrl && (
                  <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono text-slate-700 flex items-center gap-1 truncate">
                        <FileText className="h-3 w-3 text-slate-500 shrink-0" />
                        {notice.attachmentUrl}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (notice.attachmentUrl?.startsWith("http")) {
                            window.open(notice.attachmentUrl, "_blank");
                          } else {
                            setPreviewDocument({
                              name: notice.attachmentUrl || "Circular_Attachment.pdf",
                              title: notice.title,
                              author: notice.authorName || "Administration",
                              date: notice.createdAt.split("T")[0],
                            });
                          }
                        }}
                        className="h-6 text-[11px] font-semibold text-blue-700 hover:text-blue-900 border-blue-200 bg-blue-50/70 hover:bg-blue-100 gap-1 px-2"
                      >
                        <Eye className="h-3 w-3" />
                        <span>View Attachment</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
              <Pagination {...noticePagination} />
            </div>
          </>
        ) : (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-lg text-xs text-slate-500">
            No notices match your current filters.
          </div>
        )}
      </div>

      {/* Modal: Publish Notice */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-lg p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BellRing className="h-4 w-4 text-navy-800" />
                Publish Official Circular / Homework Broadcast
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Circular Title *
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Schedule for Midterm Examinations & Syllabus"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Target Audience *
                  </label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
                  >
                    <option value="ALL">All School (Everyone)</option>
                    <option value="TEACHERS">Faculty / Teachers Only</option>
                    <option value="PARENTS">Parents Only</option>
                    <option value="STUDENTS">Students Only</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Priority Tier
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
                  >
                    <option value="NORMAL">Normal Priority</option>
                    <option value="URGENT">⚠️ Urgent / Action Required</option>
                  </select>
                </div>
              </div>

              {/* Grade/Section Multi-select Dropdown / Filter (Feature 10) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Target Specific Classes / Grades (Optional)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded max-h-28 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedClassIds([])}
                    className={`text-[11px] px-2 py-0.5 rounded border ${
                      selectedClassIds.length === 0
                        ? "bg-navy-900 text-white border-navy-900 font-semibold"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    All Classes (School-Wide)
                  </button>
                  {classesList.map((cls) => {
                    const isSelected = selectedClassIds.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedClassIds(selectedClassIds.filter((id) => id !== cls.id));
                          } else {
                            setSelectedClassIds([...selectedClassIds, cls.id]);
                          }
                        }}
                        className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600 font-semibold"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        {isSelected && "✓ "}
                        {cls.name}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {selectedClassIds.length === 0
                    ? "Notice will be broadcast to all classes."
                    : `Targeted specifically to ${selectedClassIds.length} class(es).`}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Notice Content & Instructions *
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  className="w-full text-xs border border-slate-300 rounded p-2.5 focus:outline-none focus:ring-1 focus:ring-navy-900"
                  placeholder="Provide comprehensive details, date schedules, or homework assignments..."
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Attachment Name / Document Link (Optional)
                </label>
                <div className="flex gap-2">
                  <Input
                    value={attachmentName}
                    onChange={(e) => setAttachmentName(e.target.value)}
                    placeholder="e.g. Term1_Datesheet_Syllabus.pdf"
                    className="text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setAttachmentName("CBSE_Circular_Datesheet_2026.pdf")}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded whitespace-nowrap"
                  >
                    Sample PDF
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-navy-900 text-white font-semibold"
                >
                  {isSubmitting ? "Broadcasting..." : "Broadcast Notice"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Circular */}
      {editingNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-lg p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Pencil className="h-4 w-4 text-navy-800" />
                Edit Official Circular
              </h3>
              <button
                onClick={() => setEditingNotice(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateNotice} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Circular Title *
                </label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Schedule for Midterm Examinations & Syllabus"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Target Audience *
                  </label>
                  <select
                    value={editAudience}
                    onChange={(e) => setEditAudience(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
                  >
                    <option value="ALL">All (Teachers, Parents, Students)</option>
                    <option value="TEACHERS">Teachers & Faculty Only</option>
                    <option value="PARENTS">Parents Only</option>
                    <option value="STUDENTS">Students Only</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Priority Level
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
                  >
                    <option value="NORMAL">Normal Priority</option>
                    <option value="URGENT">⚠️ Urgent / Action Required</option>
                  </select>
                </div>
              </div>

              {/* Grade/Section Multi-select Dropdown / Filter (Feature 10) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Target Specific Classes / Grades (Optional)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded max-h-28 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setEditClassIds([])}
                    className={`text-[11px] px-2 py-0.5 rounded border ${
                      editClassIds.length === 0
                        ? "bg-navy-900 text-white border-navy-900 font-semibold"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    All Classes (School-Wide)
                  </button>
                  {classesList.map((cls) => {
                    const isSelected = editClassIds.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setEditClassIds(editClassIds.filter((id) => id !== cls.id));
                          } else {
                            setEditClassIds([...editClassIds, cls.id]);
                          }
                        }}
                        className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600 font-semibold"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        {isSelected && "✓ "}
                        {cls.name}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {editClassIds.length === 0
                    ? "Notice will be broadcast to all classes."
                    : `Targeted specifically to ${editClassIds.length} class(es).`}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Notice Content & Instructions *
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={4}
                  className="w-full text-xs border border-slate-300 rounded p-2.5 focus:outline-none focus:ring-1 focus:ring-navy-900"
                  placeholder="Provide comprehensive details, date schedules, or homework assignments..."
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Attachment Name / Document Link (Optional)
                </label>
                <Input
                  value={editAttachment}
                  onChange={(e) => setEditAttachment(e.target.value)}
                  placeholder="e.g. Revised_Datesheet.pdf"
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingNotice(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-navy-900 text-white font-semibold"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
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

      {/* Official Circular Attachment Document Viewer Modal */}
      {previewDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xl w-full max-w-xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-navy-800" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Circular Attachment Preview
                  </h3>
                  <p className="text-[11px] text-slate-500 font-tabular">
                    {previewDocument.name} • Official Academic Document
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewDocument(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Document Details Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="text-center pb-3 border-b border-slate-200">
                <div className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                  Crescent Matriculation Higher Secondary School
                </div>
                <div className="text-[11px] text-slate-500">
                  Affiliated to Tamil Nadu State Board & Matriculation Directorate
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Associated Notice</div>
                  <div className="font-semibold text-slate-900 truncate">{previewDocument.title}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Published By</div>
                  <div className="font-semibold text-slate-900">{previewDocument.author}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Date of Issuance</div>
                  <div className="font-tabular text-slate-700">{previewDocument.date}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Format & Security</div>
                  <div className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Digitally Verified PDF
                  </div>
                </div>
              </div>

              {/* Document Mock Viewer Box */}
              <div className="bg-white border border-slate-200 rounded p-4 text-center space-y-2 mt-2">
                <FileText className="h-10 w-10 text-slate-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-800">{previewDocument.name}</div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  This official document is certified and signed by Crescent School Administration. Click below to download the local copy for offline reference.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewDocument(null)}
                className="text-xs"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const blob = new Blob(
                    [
                      `CRESCENT MATRICULATION HIGHER SECONDARY SCHOOL\r\n` +
                      `OFFICIAL CIRCULAR ATTACHMENT: ${previewDocument.name}\r\n` +
                      `Title: ${previewDocument.title}\r\n` +
                      `Issued: ${previewDocument.date}\r\n` +
                      `Authority: ${previewDocument.author}\r\n\r\n` +
                      `This document contains the official schedule and instructions ratified by the academic council.`
                    ],
                    { type: "text/plain;charset=utf-8" }
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = previewDocument.name;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="bg-navy-900 text-white font-semibold text-xs gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Attachment</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

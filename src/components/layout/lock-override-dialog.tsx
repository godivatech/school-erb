"use client";

import * as React from "react";
import { Lock, AlertTriangle, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAcademicYear } from "./academic-year-context";

interface LockOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  operationDescription: string;
  onConfirmOverride: (reason: string) => Promise<void>;
}

export function LockOverrideDialog({
  open,
  onOpenChange,
  title = "Academic Year Lock Override Required",
  operationDescription,
  onConfirmOverride,
}: LockOverrideDialogProps) {
  const { activeYear, currentUser, switchRole } = useAcademicYear();
  const [overrideReason, setOverrideReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";

  const handleExecute = async () => {
    if (!overrideReason.trim()) {
      setError("A detailed audit reason is mandatory for locked academic year operations.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirmOverride(overrideReason.trim());
      onOpenChange(false);
      setOverrideReason("");
    } catch (err: any) {
      setError(err.message || "Failed to execute override operation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchToSuperAdmin = async () => {
    setIsSubmitting(true);
    try {
      await switchRole("SUPER_ADMIN");
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-white border border-amber-300 shadow-xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-amber-700">
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Lock className="h-4 w-4 text-amber-800" strokeWidth={2.5} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                {title}
              </DialogTitle>
              <div className="text-xs text-amber-800 font-semibold mt-0.5">
                Year: {activeYear.name} ({activeYear.status})
              </div>
            </div>
          </div>
          <DialogDescription className="text-xs text-slate-600 leading-relaxed pt-1">
            Attempted action: <span className="font-mono text-slate-800 font-medium">{operationDescription}</span>
          </DialogDescription>
        </DialogHeader>

        {isSuperAdmin ? (
          <div className="space-y-4 pt-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
                <span>Super Administrator Privilege Detected</span>
              </div>
              <p className="text-[11px] leading-normal text-amber-800">
                As Super Administrator, you may bypass the archive write-lock. Every action will be permanently recorded in the immutable security audit log.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Mandatory Audit Override Reason:</span>
                <span className="text-[10px] text-red-600 font-bold">* Required</span>
              </label>
              <textarea
                rows={3}
                value={overrideReason}
                onChange={(e) => {
                  setOverrideReason(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Board inspection retrospective attendance correction approved by Principal..."
                className="w-full text-xs p-2.5 rounded border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded border border-red-200">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleExecute}
                disabled={isSubmitting || !overrideReason.trim()}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Overriding...
                  </>
                ) : (
                  "Execute Audited Override"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-red-950">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <span>AcademicYearLockError: Permission Denied</span>
              </div>
              <p className="text-[11px] leading-normal text-red-800">
                You are currently simulating role <strong className="uppercase">[{currentUser.role}]</strong>. Only an authorized <strong>SUPER_ADMIN</strong> with a documented override reason can write to a locked academic year.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Dismiss
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSwitchToSuperAdmin}
                disabled={isSubmitting}
                className="bg-navy-900 hover:bg-navy-800 text-white font-semibold"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : null}
                Switch to SUPER_ADMIN to Override
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

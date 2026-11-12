"use client";

import * as React from "react";
import { AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { Button } from "./button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmDialogProps) {
  const handleClose = onClose || onCancel || (() => {});

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, handleClose]);

  if (!isOpen) return null;

  const iconMap = {
    danger: <AlertTriangle className="h-5 w-5 text-rose-600" />,
    warning: <AlertCircle className="h-5 w-5 text-amber-600" />,
    primary: <Info className="h-5 w-5 text-blue-600" />,
  };

  const confirmBtnBg = {
    danger: "bg-rose-600 hover:bg-rose-700 text-white",
    warning: "bg-amber-600 hover:bg-amber-700 text-white",
    primary: "bg-[#1E3A8A] hover:bg-[#1e3a8a]/90 text-white",
  }[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-slate-50 border border-slate-100 shrink-0 mt-0.5">
              {iconMap[variant]}
            </div>
            <div className="flex-1 space-y-1">
              <h3
                id="confirm-dialog-title"
                className="text-sm font-bold text-slate-900 tracking-tight"
              >
                {title}
              </h3>
              <div className="text-xs text-slate-600 leading-relaxed">
                {description}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-slate-50 border-t border-slate-100">
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="text-xs h-8 px-3"
          >
            {cancelText}
          </Button>
          <Button
            size="sm"
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`text-xs h-8 px-4 font-semibold ${confirmBtnBg}`}
          >
            {isLoading ? "Processing..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

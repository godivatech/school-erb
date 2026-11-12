"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export interface ActionBannerProps {
  type: "success" | "error" | "warning" | "info";
  message: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export function ActionBanner({
  type,
  message,
  onClose,
  className = "",
}: ActionBannerProps) {
  if (!message) return null;

  const config = {
    success: {
      bg: "bg-emerald-50 border-emerald-300 text-emerald-900",
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />,
    },
    error: {
      bg: "bg-rose-50 border-rose-300 text-rose-900",
      icon: <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />,
    },
    warning: {
      bg: "bg-amber-50 border-amber-300 text-amber-900",
      icon: <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />,
    },
    info: {
      bg: "bg-blue-50 border-blue-300 text-blue-900",
      icon: <Info className="h-4 w-4 text-blue-600 shrink-0" />,
    },
  }[type];

  return (
    <div
      role="status"
      className={`p-3 rounded-md border text-xs flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200 ${config.bg} ${className}`}
    >
      <div className="flex items-center gap-2 flex-1">
        {config.icon}
        <div className="font-medium">{message}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import { Lock, Check, ChevronDown, Calendar, Loader2 } from "lucide-react";
import { useAcademicYear } from "./academic-year-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export function AcademicYearSwitcher() {
  const { activeYear, availableYears, switchYear, isLocked, isSwitching } = useAcademicYear();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={isSwitching}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors select-none ${
            isLocked
              ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A] hover:bg-[#FEF3C7]"
              : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
          } ${isSwitching ? "opacity-75 cursor-wait" : ""}`}
        >
          {isSwitching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
          ) : isLocked ? (
            <Lock className="h-3.5 w-3.5 text-[#92400E]" strokeWidth={2} />
          ) : (
            <Calendar className="h-3.5 w-3.5 text-[#1E3A8A]" strokeWidth={1.75} />
          )}
          <span className="font-semibold">{activeYear.name}</span>
          <Badge
            variant={
              activeYear.status === "ACTIVE"
                ? "success"
                : activeYear.status === "LOCKED"
                ? "warning"
                : "neutral"
            }
            className="text-[10px] py-0 px-1 ml-0.5"
          >
            {activeYear.status}
          </Badge>
          <ChevronDown className="h-3 w-3 text-slate-400 ml-0.5" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60 p-1">
        <DropdownMenuLabel className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
          <span>Switch Academic Year</span>
          <span className="text-[10px] font-mono text-slate-400">Cookie-Synced</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {availableYears.map((year) => {
          const isSelected = year.id === activeYear.id;
          return (
            <DropdownMenuItem
              key={year.id}
              onClick={() => switchYear(year.id)}
              className={`flex items-center justify-between text-xs py-2 px-2.5 cursor-pointer rounded ${
                isSelected ? "bg-[#EFF6FF] text-[#1D4ED8] font-semibold" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                {year.status === "LOCKED" ? (
                  <Lock className="h-3.5 w-3.5 text-amber-600" strokeWidth={2} />
                ) : (
                  <Calendar className="h-3.5 w-3.5 text-blue-700" strokeWidth={1.75} />
                )}
                <span>AY {year.name}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Badge
                  variant={
                    year.status === "ACTIVE"
                      ? "success"
                      : year.status === "LOCKED"
                      ? "warning"
                      : "neutral"
                  }
                  className="text-[9px] py-0 px-1"
                >
                  {year.status}
                </Badge>
                {isSelected && <Check className="h-3.5 w-3.5 text-[#1D4ED8]" strokeWidth={2} />}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

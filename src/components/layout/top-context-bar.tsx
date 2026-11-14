"use client";

import * as React from "react";
import Link from "next/link";
import { Search, CreditCard, School, ChevronDown, Check, Menu } from "lucide-react";
import { AcademicYearSwitcher } from "./academic-year-switcher";
import { useAcademicYear } from "./academic-year-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Role } from "@/lib/guards";

interface TopContextBarProps {
  onOpenCommandPalette: () => void;
}

export function TopContextBar({ onOpenCommandPalette }: TopContextBarProps) {
  const { currentUser, availableRoles, switchRole, isSwitching, setMobileNavOpen } = useAcademicYear();

  return (
    <header className="sticky top-0 z-40 flex h-12 w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-2.5 sm:px-4 select-none">
      {/* Left side: Mobile Menu Trigger + School Identity & Search */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Drawer Trigger */}
        <button
          onClick={() => setMobileNavOpen(true)}
          className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-100 md:hidden shrink-0 transition-colors"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>

        {/* School Identity */}
        <div className="hidden sm:flex items-center gap-2 pr-2 sm:pr-3 border-r border-slate-200 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-[#1E3A8A] text-white">
            <School className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="hidden md:block leading-tight">
            <div className="text-xs font-semibold text-slate-900 tracking-tight">
              Crescent Matriculation School
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              CMS-CHENNAI
            </div>
          </div>
        </div>

        {/* Global Command Palette Trigger Bar (Cmd+K / /) */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-1.5 sm:gap-2 h-7 w-36 sm:w-48 md:w-80 rounded border border-[#CBD5E1] bg-slate-50 px-2 text-xs text-slate-500 hover:border-slate-400 hover:bg-white transition-colors min-w-0"
        >
          <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />
          <span className="truncate text-left text-[11px]">
            Quick search...
          </span>
          <kbd className="ml-auto hidden md:inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9px] text-slate-400 shrink-0">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right side: Academic Year Switcher, POS Shortcut, Role Switcher */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Direct POS Link (Cashiers & Admins only) */}
        {["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"].includes(currentUser.role) && (
          <Link href="/finance/pos">
            <Button
              size="sm"
              variant="subtle"
              className="hidden md:inline-flex items-center gap-1.5 h-7 text-[11px] font-semibold"
            >
              <CreditCard className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Fee POS</span>
              <kbd className="text-[9px] font-mono bg-white px-1 py-0.2 rounded border border-blue-200">
                /
              </kbd>
            </Button>
          </Link>
        )}

        {/* Academic Year Switcher (hidden on mobile, fully accessible in mobile drawer) */}
        <div className="hidden sm:block">
          <AcademicYearSwitcher />
        </div>

        {/* Quick Role Switcher Dropdown (Always visible on mobile & desktop) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={isSwitching}
              className="flex items-center gap-1.5 pl-1.5 sm:pl-2 pr-1 sm:pr-1.5 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-left shrink-0"
              title={`Active Role: ${currentUser.role} (Click to switch)`}
            >
              <div className="h-6 w-6 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden lg:block leading-tight">
                <div className="text-[11px] font-semibold text-slate-900 truncate max-w-[120px]">
                  {currentUser.name}
                </div>
                <div className="text-[9px] text-blue-700 font-bold uppercase tracking-wider">
                  {currentUser.role}
                </div>
              </div>
              {/* Compact role badge on mobile */}
              <span className="text-[9px] font-bold text-blue-800 uppercase bg-blue-100/80 px-1 py-0.5 rounded border border-blue-200 block lg:hidden">
                {currentUser.role.split('_')[0]}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64 max-w-[92vw] p-1">
            <DropdownMenuLabel className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
              <span>Switch Testing Role</span>
              <span className="text-[10px] font-mono text-slate-400">Cookie-Synced</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {availableRoles.map((r) => {
              const isSelected = r.role === currentUser.role;
              return (
                <DropdownMenuItem
                  key={r.role}
                  onClick={() => switchRole(r.role as Role)}
                  className={`flex items-center justify-between text-xs py-2 px-2.5 cursor-pointer rounded ${
                    isSelected ? "bg-[#EFF6FF] text-[#1D4ED8] font-semibold" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-5 w-5 rounded bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {r.role.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{r.label}</div>
                      <div className="text-[10px] text-slate-500 font-tabular truncate">{r.userName}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant={
                        r.role === "SUPER_ADMIN"
                          ? "danger"
                          : r.role === "ACCOUNTANT"
                          ? "primary"
                          : r.role === "TEACHER"
                          ? "warning"
                          : "neutral"
                      }
                      className="text-[9px] py-0 px-1"
                    >
                      {r.role}
                    </Badge>
                    {isSelected && <Check className="h-3.5 w-3.5 text-[#1D4ED8]" strokeWidth={2} />}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

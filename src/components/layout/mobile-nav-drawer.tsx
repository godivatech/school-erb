"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  School,
  Lock,
  Calendar,
  Check,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Users,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAcademicYear } from "./academic-year-context";
import { NAV_ITEMS } from "./desktop-sidebar";
import { Badge } from "@/components/ui/badge";
import { Role } from "@/lib/guards";
import { cn } from "@/lib/utils";

export function MobileNavDrawer() {
  const pathname = usePathname();
  const {
    mobileNavOpen,
    setMobileNavOpen,
    currentUser,
    availableRoles,
    switchRole,
    activeYear,
    availableYears,
    switchYear,
    isSwitching,
  } = useAcademicYear();

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(currentUser.role)
  );

  return (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent
        side="left"
        className="w-[88vw] max-w-sm p-0 bg-[#0F172A] text-slate-200 border-r border-slate-800 flex flex-col h-full overflow-hidden focus:outline-none"
      >
        {/* Top Header */}
        <SheetHeader className="p-4 border-b border-slate-800 bg-[#0B1120] text-left shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded bg-[#1E3A8A] flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-sm">
                CMS
              </div>
              <div>
                <SheetTitle className="text-sm font-bold text-white tracking-tight">
                  CRESCENT SCHOOL ERP
                </SheetTitle>
                <div className="text-[10px] text-slate-400 font-mono">
                  CMS-CHENNAI • Affiliated TN Board
                </div>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
          {/* 1. Testing Role Switcher Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span>Switch Testing Role</span>
              <span className="text-[9px] font-mono text-blue-400 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-800">
                Live Switch
              </span>
            </div>

            {/* Current Active Persona Card */}
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Active: {currentUser.role}
                  </div>
                </div>
              </div>
              <Badge
                variant={
                  currentUser.role === "SUPER_ADMIN"
                    ? "danger"
                    : currentUser.role === "ACCOUNTANT"
                    ? "primary"
                    : currentUser.role === "TEACHER"
                    ? "warning"
                    : "neutral"
                }
                className="text-[10px] px-2 py-0.5 shrink-0"
              >
                {currentUser.role}
              </Badge>
            </div>

            {/* Quick 1-Tap Role Buttons Grid */}
            <div className="grid grid-cols-1 gap-1.5 pt-1">
              {availableRoles.map((r) => {
                const isSelected = r.role === currentUser.role;
                return (
                  <button
                    key={r.role}
                    disabled={isSwitching}
                    onClick={() => switchRole(r.role as Role)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded text-xs transition-colors text-left border",
                      isSelected
                        ? "bg-[#1E3A8A] border-blue-500 text-white font-semibold shadow-sm"
                        : "bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          "h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0",
                          isSelected
                            ? "bg-white text-blue-900"
                            : "bg-slate-700 text-slate-300"
                        )}
                      >
                        {r.role.charAt(0)}
                      </div>
                      <div className="truncate">
                        <div className="text-xs">{r.label}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {r.userName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSwitching && isSelected ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                      ) : isSelected ? (
                        <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
                      ) : (
                        <Badge
                          variant="neutral"
                          className="text-[9px] bg-slate-900/60 border-slate-700 text-slate-400"
                        >
                          {r.role}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Academic Year Switcher Section */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span>Academic Year</span>
              <span className="text-[10px] font-mono text-slate-400">
                {activeYear.name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {availableYears.map((y) => {
                const isSelected = y.id === activeYear.id;
                return (
                  <button
                    key={y.id}
                    disabled={isSwitching}
                    onClick={() => {
                      switchYear(y.id);
                      setMobileNavOpen(false);
                    }}
                    className={cn(
                      "flex flex-col items-start p-2 rounded border text-left transition-colors",
                      isSelected
                        ? "bg-blue-950/60 border-blue-500 text-white"
                        : "bg-slate-800/30 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="text-xs font-semibold">{y.name}</div>
                      {isSelected && (
                        <Check className="h-3 w-3 text-blue-400" strokeWidth={2.5} />
                      )}
                    </div>
                    <div className="text-[9px] mt-0.5">
                      {y.status === "ACTIVE" ? (
                        <span className="text-emerald-400 font-medium">● ACTIVE</span>
                      ) : (
                        <span className="text-amber-400 font-medium">🔒 LOCKED</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Complete Role-Filtered Navigation */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <span>All Role Pages</span>
              <span className="text-[10px] font-mono text-slate-500">
                {visibleNavItems.length} accessible
              </span>
            </div>

            <nav className="space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded text-xs transition-colors",
                      isActive
                        ? "bg-[#1E3A8A] text-white font-semibold"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{item.title}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badge && (
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded font-tabular",
                            item.badgeVariant === "primary"
                              ? "bg-blue-600 text-white font-semibold"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight className="h-3 w-3 text-slate-500" />
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-[#0B1120] text-[10px] text-slate-400 shrink-0 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>System Online</span>
            </div>
            <span className="font-medium text-slate-500">Enterprise v1.0</span>
          </div>
          <div className="text-center pt-1 border-t border-slate-800/80">
            <strong className="font-bold text-slate-200">
              Designed and Developed by Godivatech
            </strong>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}


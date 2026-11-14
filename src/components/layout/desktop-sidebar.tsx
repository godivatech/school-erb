"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  CalendarDays,
  UserCheck,
  ReceiptIndianRupee,
  FileSpreadsheet,
  UsersRound,
  Bus,
  BellRing,
  History,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Clock,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Role } from "@/lib/guards";
import { useAcademicYear } from "./academic-year-context";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: "primary" | "warning" | "danger" | "neutral";
  roles?: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Command Center",
    href: "/",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"],
  },
  {
    title: "Students & SIS",
    href: "/students",
    icon: GraduationCap,
    badge: "1,248",
    roles: ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT", "TEACHER"],
  },
  {
    title: "Academic Structure",
    href: "/academics",
    icon: CalendarDays,
    roles: ["SUPER_ADMIN", "PRINCIPAL"],
  },
  {
    title: "Attendance Grid",
    href: "/attendance",
    icon: UserCheck,
    badge: "96%",
    badgeVariant: "neutral",
    roles: ["SUPER_ADMIN", "PRINCIPAL", "TEACHER"],
  },
  {
    title: "Timetable & Clashes",
    href: "/timetable",
    icon: Clock,
    roles: ["SUPER_ADMIN", "PRINCIPAL", "TEACHER"],
  },
  {
    title: "Fee POS & Ledger",
    href: "/finance",
    icon: ReceiptIndianRupee,
    badge: "POS",
    badgeVariant: "primary",
    roles: ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"],
  },
  {
    title: "Exams & Marks",
    href: "/exams",
    icon: FileSpreadsheet,
    roles: ["SUPER_ADMIN", "PRINCIPAL", "TEACHER"],
  },
  {
    title: "Staff & Payroll",
    href: "/payroll",
    icon: UsersRound,
    roles: ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"],
  },
  {
    title: "Transport Routes",
    href: "/transport",
    icon: Bus,
    roles: ["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"],
  },
  {
    title: "Parent Portal",
    href: "/parent",
    icon: Users,
    badge: "PWA",
    badgeVariant: "neutral",
    roles: ["SUPER_ADMIN", "PRINCIPAL", "PARENT"],
  },
  {
    title: "Smart Notices",
    href: "/notices",
    icon: BellRing,
    roles: ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT", "TEACHER", "PARENT"],
  },
  {
    title: "Audit Trail",
    href: "/audit",
    icon: History,
    roles: ["SUPER_ADMIN", "PRINCIPAL"],
  },
];

interface DesktopSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function DesktopSidebar({ isCollapsed, onToggle }: DesktopSidebarProps) {
  const pathname = usePathname();
  const { currentUser } = useAcademicYear();

  const visibleNavItems = NAV_ITEMS.filter((item) =>
    !item.roles || item.roles.includes(currentUser.role)
  );

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-full border-r border-slate-800 bg-[#0F172A] text-slate-300 transition-all duration-200 select-none z-30 shrink-0",
        isCollapsed ? "w-14" : "w-[220px]"
      )}
    >
      {/* Brand / Logo Top */}
      <div className="flex h-12 items-center justify-between px-3 border-b border-slate-800">
        {!isCollapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="h-6 w-6 rounded bg-[#1E3A8A] flex items-center justify-center text-white font-bold text-xs tracking-wider">
              CMS
            </div>
            <span className="font-semibold text-xs tracking-tight text-white truncate">
              CRESCENT ERP
            </span>
          </div>
        )}
        {isCollapsed && (
          <div className="h-6 w-6 mx-auto rounded bg-[#1E3A8A] flex items-center justify-center text-white font-bold text-xs">
            C
          </div>
        )}

        <button
          onClick={onToggle}
          className={cn(
            "p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors",
            isCollapsed && "hidden"
          )}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* Nav items list */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
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
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs transition-colors",
                isActive
                  ? "bg-[#1E3A8A] text-white font-medium"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60",
                isCollapsed && "justify-center px-1"
              )}
              title={isCollapsed ? item.title : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {!isCollapsed && (
                <>
                  <span className="truncate">{item.title}</span>
                  {item.badge && (
                    <span
                      className={cn(
                        "ml-auto text-[10px] px-1.5 py-0.2 rounded font-tabular",
                        item.badgeVariant === "primary"
                          ? "bg-blue-600 text-white font-semibold"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapsed footer expand button */}
      {isCollapsed && (
        <div className="p-2 border-t border-slate-800 flex justify-center">
          <button
            onClick={onToggle}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            title="Expand Sidebar"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Footer System Status */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-800 text-[10px] text-slate-400 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>System Online</span>
            </div>
            <span className="font-medium text-slate-500">Enterprise v1.0</span>
          </div>
          <div className="text-[10px] text-slate-400 text-center pt-1.5 border-t border-slate-800/80">
            <strong className="font-bold text-slate-200">Designed and Developed by Godivatech</strong>
          </div>
        </div>
      )}
    </aside>
  );
}

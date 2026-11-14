"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarCheck,
  FileSpreadsheet,
  Bell,
  Users,
  Bus,
  Clock,
  CreditCard,
  ReceiptIndianRupee,
  UsersRound,
  GraduationCap,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAcademicYear } from "./academic-year-context";
import { Role } from "@/lib/guards";

interface MobileTabItem {
  name: string;
  href?: string;
  icon: React.ElementType;
  isAction?: boolean;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { currentUser, setMobileNavOpen } = useAcademicYear();
  const role = currentUser.role;

  let tabs: MobileTabItem[] = [];

  if (role === "PARENT") {
    tabs = [
      { name: "My Children", href: "/parent", icon: Users },
      { name: "Transport", href: "/transport", icon: Bus },
      { name: "Notices", href: "/notices", icon: Bell },
    ];
  } else if (role === "TEACHER") {
    tabs = [
      { name: "Attendance", href: "/attendance", icon: CalendarCheck },
      { name: "Marks", href: "/exams", icon: FileSpreadsheet },
      { name: "Timetable", href: "/timetable", icon: Clock },
      { name: "My Leaves", href: "/payroll", icon: UsersRound },
    ];
  } else if (role === "ACCOUNTANT") {
    tabs = [
      { name: "Overview", href: "/", icon: Home },
      { name: "Fee POS", href: "/finance/pos", icon: CreditCard },
      { name: "Ledger", href: "/finance", icon: ReceiptIndianRupee },
      { name: "Payroll", href: "/payroll", icon: UsersRound },
    ];
  } else {
    // SUPER_ADMIN, PRINCIPAL
    tabs = [
      { name: "Home", href: "/", icon: Home },
      { name: "Students", href: "/students", icon: GraduationCap },
      { name: "Fee POS", href: "/finance/pos", icon: CreditCard },
      { name: "Attendance", href: "/attendance", icon: CalendarCheck },
    ];
  }

  // Always append a "Menu / All" tab to allow opening the complete role sidebar
  tabs.push({
    name: "Menu",
    icon: Menu,
    isAction: true,
  });

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 block md:hidden bg-white border-t border-slate-200 shadow-lg">
      <div
        className="grid h-14"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;

          if (tab.isAction) {
            return (
              <button
                key={tab.name}
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-slate-600 hover:text-[#1E3A8A] transition-colors select-none"
              >
                <Icon className="h-5 w-5 stroke-[1.75]" />
                <span>{tab.name}</span>
              </button>
            );
          }

          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href!);

          return (
            <Link
              key={tab.name}
              href={tab.href!}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors select-none",
                isActive
                  ? "text-[#1E3A8A] font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <Icon
                className={cn("h-5 w-5", isActive ? "stroke-[2.2]" : "stroke-[1.75]")}
              />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

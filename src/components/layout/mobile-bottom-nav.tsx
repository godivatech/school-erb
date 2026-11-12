"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarCheck, FileSpreadsheet, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_TABS = [
  {
    name: "Home",
    href: "/",
    icon: Home,
  },
  {
    name: "Attendance",
    href: "/attendance",
    icon: CalendarCheck,
  },
  {
    name: "Marks",
    href: "/exams",
    icon: FileSpreadsheet,
  },
  {
    name: "Notices",
    href: "/notices",
    icon: Bell,
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 block md:hidden bg-white border-t border-slate-200 shadow-lg">
      <div className="grid grid-cols-4 h-14">
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.name}
              href={tab.href}
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

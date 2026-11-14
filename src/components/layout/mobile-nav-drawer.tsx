"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAcademicYear } from "./academic-year-context";
import { NAV_ITEMS } from "./desktop-sidebar";
import { cn } from "@/lib/utils";

export function MobileNavDrawer() {
  const pathname = usePathname();
  const { mobileNavOpen, setMobileNavOpen, currentUser } = useAcademicYear();

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(currentUser.role)
  );

  return (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent
        side="left"
        className="w-[85vw] max-w-xs p-0 bg-[#0F172A] text-slate-200 border-r border-slate-800 flex flex-col h-full overflow-hidden focus:outline-none"
      >
        {/* Top Header */}
        <SheetHeader className="p-4 border-b border-slate-800 bg-[#0B1120] text-left shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded bg-[#1E3A8A] flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-sm">
              CMS
            </div>
            <div>
              <SheetTitle className="text-sm font-bold text-white tracking-tight">
                CRESCENT SCHOOL ERP
              </SheetTitle>
              <div className="text-[10px] text-slate-400 font-mono">
                CMS-CHENNAI • Menu
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Navigation Links (All pages accessible to current role) */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <div className="px-2 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Navigation Menu ({visibleNavItems.length} Pages)
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
                    "flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-colors",
                    isActive
                      ? "bg-[#1E3A8A] text-white font-semibold shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                    <span className="truncate">{item.title}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.badge && (
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-mono",
                          item.badgeVariant === "primary"
                            ? "bg-blue-600 text-white font-semibold"
                            : "bg-slate-800 text-slate-300 border border-slate-700"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                </Link>
              );
            })}
          </nav>
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

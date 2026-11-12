"use client";

import * as React from "react";
import { AcademicYearProvider, useAcademicYear } from "./academic-year-context";
import { DesktopSidebar } from "./desktop-sidebar";
import { TopContextBar } from "./top-context-bar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { CommandPalette } from "./command-palette";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActiveContext } from "@/lib/context-types";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const { isLocked, activeYear, currentUser } = useAcademicYear();

  // Global keyboard shortcuts: Cmd+K / Ctrl+K and '/'
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (e.key === "/" && !isInput) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      suppressHydrationWarning
      className={cn(
        "h-screen w-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden",
        // Persistent Amber Warning Border around viewport if locked
        isLocked && "border-[4px] border-amber-500 box-border"
      )}
    >
      {/* Persistent Amber Banner if Academic Year is Locked */}
      {isLocked && (
        <div className="bg-[#FFFBEB] text-[#92400E] border-b border-[#FDE68A] px-4 py-1.5 text-xs font-medium flex items-center justify-between select-none z-50 shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#92400E] shrink-0" strokeWidth={2} />
            <span>
              <strong>LOCKED ACADEMIC YEAR ({activeYear.name}):</strong> Viewing archived historical data. All attendance, fee receipts, and marks write operations are strictly read-only.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              Active Role: {currentUser.role}
            </span>
            <span className="text-[11px] font-mono text-amber-800">
              Override Requires SUPER_ADMIN Audit Log
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop Collapsible Sidebar */}
        <DesktopSidebar
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Top Sticky 48px Context Bar */}
          <TopContextBar
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />

          {/* Primary Viewport Area */}
          <main className="flex-1 min-h-0 overflow-y-auto pb-16 md:pb-6 p-4 md:p-6 bg-slate-50">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile PWA Bottom Navigation */}
      <MobileBottomNav />

      {/* Global Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
    </div>
  );
}

export function AppShell({
  children,
  initialContext,
}: {
  children: React.ReactNode;
  initialContext?: ActiveContext;
}) {
  return (
    <AcademicYearProvider initialContext={initialContext}>
      <AppShellInner>{children}</AppShellInner>
    </AcademicYearProvider>
  );
}

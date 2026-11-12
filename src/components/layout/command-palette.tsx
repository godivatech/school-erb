"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  User,
  CreditCard,
  Calendar,
  FileSpreadsheet,
  GraduationCap,
  Bus,
  Clock,
  ArrowRight,
  ReceiptIndianRupee,
  Users,
  Compass,
  Loader2,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { searchGlobalEntities, GlobalSearchResult } from "@/actions/search";

interface StaticNavItem {
  id: string;
  type: "navigation" | "action";
  title: string;
  subtitle: string;
  tag?: string;
  tagVariant?: "primary" | "warning" | "danger" | "neutral" | "success";
  url: string;
  icon: React.ElementType;
}

const STATIC_NAV: StaticNavItem[] = [
  {
    id: "nav-pos",
    type: "action",
    title: "Open Cashier Fee POS",
    subtitle: "Collect fee payments, print instant 80mm/A4 receipts",
    tag: "Keyboard: /",
    tagVariant: "primary",
    url: "/finance/pos",
    icon: CreditCard,
  },
  {
    id: "nav-att",
    type: "action",
    title: "Take Student Attendance",
    subtitle: "30-second rapid absent/late marking",
    tag: "Operations",
    tagVariant: "neutral",
    url: "/attendance",
    icon: Calendar,
  },
  {
    id: "nav-marks",
    type: "action",
    title: "Spreadsheet Mark Entry",
    subtitle: "Keyboard spreadsheet entry with grace moderation",
    tag: "Exams",
    tagVariant: "neutral",
    url: "/exams/mark-entry",
    icon: FileSpreadsheet,
  },
  {
    id: "nav-sis",
    type: "navigation",
    title: "Student Directory (SIS)",
    subtitle: "Manage profiles, enrollments, and transfer certificates",
    tag: "SIS",
    tagVariant: "neutral",
    url: "/students",
    icon: GraduationCap,
  },
  {
    id: "nav-timetable",
    type: "navigation",
    title: "Timetable & Clash Detection",
    subtitle: "Manage weekly period grid and teacher substitutions",
    tag: "Academics",
    tagVariant: "neutral",
    url: "/timetable",
    icon: Clock,
  },
  {
    id: "nav-parent",
    type: "navigation",
    title: "Parent Mobile Portal",
    subtitle: "Sibling switcher, 1-click fee checkout, report card view",
    tag: "Portal",
    tagVariant: "success",
    url: "/parent",
    icon: Users,
  },
  {
    id: "nav-transport",
    type: "navigation",
    title: "Transport Routes & Stops",
    subtitle: "Manage fleet vehicles, stops, and billing",
    tag: "Transport",
    tagVariant: "neutral",
    url: "/transport",
    icon: Bus,
  },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [isSearching, setIsSearching] = React.useState(false);
  const [dbResults, setDbResults] = React.useState<GlobalSearchResult[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus input when opened
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
      setDbResults([]);
    }
  }, [open]);

  // Debounced search query to Server Action
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setDbResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchGlobalEntities(q);
        setDbResults(results);
        setSelectedIndex(0);
      } catch (err) {
        console.error("Command palette search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // Combined items: If query active, show DB results + matching static nav. Else static nav.
  const displayItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return STATIC_NAV;
    }

    const matchedStatic = STATIC_NAV.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.subtitle.toLowerCase().includes(q) ||
        (n.tag && n.tag.toLowerCase().includes(q))
    );

    return [...dbResults, ...matchedStatic];
  }, [query, dbResults]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, displayItems.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + displayItems.length) % Math.max(1, displayItems.length));
      } else if (e.key === "Enter" && displayItems[selectedIndex]) {
        e.preventDefault();
        const selected = displayItems[selectedIndex];
        onOpenChange(false);
        router.push(selected.url);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, displayItems, selectedIndex, onOpenChange, router]);

  const getItemIcon = (type: string) => {
    switch (type) {
      case "student":
        return User;
      case "family":
        return Users;
      case "receipt":
        return ReceiptIndianRupee;
      case "action":
        return CreditCard;
      default:
        return Compass;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-2xl overflow-hidden border-slate-300 shadow-2xl rounded-lg top-[30%]">
        {/* Search Input Bar */}
        <div className="flex items-center px-3.5 border-b border-slate-200 bg-white">
          {isSearching ? (
            <Loader2 className="h-4 w-4 text-blue-600 mr-2 shrink-0 animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" strokeWidth={1.75} />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type student name (Aarav), admission (0801), phone (9876543210), or command..."
            className="w-full h-11 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none border-none focus:ring-0 focus:outline-none !border-0"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-1.5 bg-slate-50">
          {displayItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No matching records or actions found for &quot;{query}&quot;
            </div>
          ) : (
            <div className="space-y-0.5">
              {displayItems.map((item, idx) => {
                const Icon = "icon" in item && item.icon ? item.icon : getItemIcon(item.type);
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onOpenChange(false);
                      router.push(item.url);
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between px-3 py-2 rounded text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]"
                        : "text-slate-700 hover:bg-slate-100 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div
                        className={`p-1.5 rounded ${
                          isSelected ? "bg-[#1E3A8A] text-white" : "bg-white border border-slate-200 text-slate-600"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-slate-900 leading-tight">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5 font-tabular">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {item.tag && (
                        <Badge
                          variant={
                            item.tagVariant ||
                            (item.type === "student"
                              ? "neutral"
                              : item.type === "family"
                              ? "success"
                              : item.type === "action"
                              ? "primary"
                              : "neutral")
                          }
                          className="font-tabular text-[10px]"
                        >
                          {item.tag}
                        </Badge>
                      )}
                      {isSelected && (
                        <ArrowRight className="h-3 w-3 text-[#1D4ED8]" strokeWidth={2} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-white border-t border-slate-200 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[9px]">↑↓</kbd> to navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[9px]">↵</kbd> to jump
            </span>
          </div>
          <span className="font-medium text-slate-400">
            Instant Search <span className="font-tabular">&lt;50ms</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

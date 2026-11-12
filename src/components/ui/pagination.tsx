"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "./button";

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  className = "",
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startRecord = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endRecord = Math.min(safePage * pageSize, totalItems);

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("...");

      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (safePage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-2.5 bg-white border-t border-slate-200 text-xs text-slate-600 select-none ${className}`}
    >
      {/* Left: Record summary & Page Size selector */}
      <div className="flex items-center gap-3">
        <span>
          Showing <strong className="font-semibold text-slate-900 font-tabular">{startRecord}</strong> to{" "}
          <strong className="font-semibold text-slate-900 font-tabular">{endRecord}</strong> of{" "}
          <strong className="font-semibold text-slate-900 font-tabular">{totalItems}</strong> entries
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
            <span className="text-[11px] text-slate-500">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="h-7 text-xs rounded border border-slate-300 bg-white px-1.5 text-slate-800 font-medium font-tabular focus:border-blue-600 focus:outline-none"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page Buttons */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
          title="First Page"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
          title="Previous Page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        {getPageNumbers().map((p, idx) => {
          if (p === "...") {
            return (
              <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-400">
                …
              </span>
            );
          }

          const isCurrent = p === safePage;
          return (
            <button
              key={`page-${p}`}
              type="button"
              onClick={() => onPageChange(Number(p))}
              className={`h-7 min-w-[28px] px-1.5 rounded text-xs font-semibold font-tabular transition-colors ${
                isCurrent
                  ? "bg-[#1E3A8A] text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-transparent hover:border-slate-200"
              }`}
            >
              {p}
            </button>
          );
        })}

        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
          title="Next Page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
          className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
          title="Last Page"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Reusable client-side pagination hook
 */
export function usePagination<T>(items: T[], initialPageSize = 10) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  // Reset to page 1 if items length changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, items.length);

  const paginatedItems = React.useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  const paginationProps: PaginationProps = {
    currentPage: safePage,
    totalItems: items.length,
    pageSize,
    onPageChange: setCurrentPage,
    onPageSizeChange: setPageSize,
  };

  return {
    currentPage: safePage,
    pageSize,
    totalPages,
    paginatedItems,
    setCurrentPage,
    setPageSize,
    startIndex,
    endIndex,
    totalItems: items.length,
    paginationProps,
  };
}

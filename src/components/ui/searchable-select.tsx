"use client";

import * as React from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";
import { Badge } from "./badge";

export interface SearchOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  options: SearchOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  disabled = false,
  clearable = false,
  className = "",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on query
  const filteredOptions = React.useMemo(() => {
    if (!query.trim()) return options;
    const lower = query.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lower) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(lower)) ||
        (opt.badge && opt.badge.toLowerCase().includes(lower))
    );
  }, [options, query]);

  // Click outside to close
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Auto focus search input when opened
  React.useEffect(() => {
    if (isOpen) {
      setQuery("");
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = filteredOptions[highlightedIndex];
      if (current && !current.disabled) {
        onChange(current.value);
        setIsOpen(false);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full text-xs select-none ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 h-9 rounded-md border text-left transition-colors font-sans ${
          disabled
            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
            : isOpen
            ? "bg-white border-blue-600 ring-1 ring-blue-600 text-slate-900"
            : "bg-white border-slate-300 hover:border-slate-400 text-slate-900 shadow-sm"
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              {selectedOption.badge && (
                <Badge variant="neutral" className="text-[9px] py-0 px-1 font-mono">
                  {selectedOption.badge}
                </Badge>
              )}
              <span className="font-semibold text-slate-900 truncate">
                {selectedOption.label}
              </span>
              {selectedOption.sublabel && (
                <span className="text-[11px] text-slate-500 truncate">
                  ({selectedOption.sublabel})
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {clearable && selectedOption && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="p-0.5 hover:text-slate-700 rounded"
              title="Clear selection"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-150 ${
              isOpen ? "rotate-180 text-blue-600" : ""
            }`}
          />
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Input Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent border-0 p-0 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <ul
            role="listbox"
            className="max-h-56 overflow-y-auto py-1 divide-y divide-slate-50"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-slate-400 italic">
                No matching options found
              </li>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      if (!opt.disabled) {
                        onChange(opt.value);
                        setIsOpen(false);
                      }
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      opt.disabled
                        ? "opacity-50 cursor-not-allowed bg-slate-50"
                        : isHighlighted
                        ? "bg-blue-50 text-blue-900"
                        : "hover:bg-slate-50 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {opt.badge && (
                        <Badge
                          variant={isSelected ? "primary" : "neutral"}
                          className="text-[9px] py-0 px-1 font-mono shrink-0"
                        >
                          {opt.badge}
                        </Badge>
                      )}
                      <div className="truncate">
                        <span
                          className={`text-xs ${
                            isSelected ? "font-bold text-blue-950" : "font-medium"
                          }`}
                        >
                          {opt.label}
                        </span>
                        {opt.sublabel && (
                          <span className="text-[11px] text-slate-500 ml-1.5">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

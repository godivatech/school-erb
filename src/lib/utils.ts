import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency with Indian Rupee or standard format and tabular numbers
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currencySymbol = "₹"
): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return `${currencySymbol}0.00`;
  }
  const numeric = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${currencySymbol}${numeric.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format date in Swiss Editorial compact format (e.g., "14 Oct 2026")
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format time in 12-hour AM/PM format
 */
export function formatTime(time: string | null | undefined): string {
  if (!time) return "—";
  return time;
}

/**
 * Clean phone number normalization
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
}

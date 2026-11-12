import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  tabular?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, tabular, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-8 w-full rounded border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs text-slate-900 shadow-none transition-colors",
          "placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-[#1E3A8A] focus-visible:ring-1 focus-visible:ring-[#BFDBFE]",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          tabular && "font-tabular text-right",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };

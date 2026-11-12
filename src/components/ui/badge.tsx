import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium transition-colors select-none",
  {
    variants: {
      variant: {
        primary: "bg-[#1E3A8A] text-white border border-[#1E3A8A]",
        interactive: "bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]",
        success: "bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]",
        warning: "bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]",
        danger: "bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]",
        neutral: "bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1]",
        outline: "text-slate-700 border border-slate-300 bg-white",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

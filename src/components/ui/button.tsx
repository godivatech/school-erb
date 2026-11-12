import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[#1E3A8A] text-white shadow-none hover:bg-[#1E40AF] active:bg-[#172554]",
        destructive:
          "bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] hover:bg-[#FEE2E2]",
        outline:
          "border border-[#CBD5E1] bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900",
        secondary:
          "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200",
        ghost:
          "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        link:
          "text-[#1E3A8A] underline-offset-4 hover:underline",
        subtle:
          "bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] hover:bg-[#DBEAFE]",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 rounded px-2 text-[11px]",
        lg: "h-9 rounded-md px-4 text-sm",
        icon: "h-8 w-8",
        dense: "h-6 px-2 text-[11px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

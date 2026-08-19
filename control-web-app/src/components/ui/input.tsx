import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full rounded-lg border bg-background text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "h-7 px-2 py-0.5 text-xs",
        default: "h-9 px-3 py-1",
        lg: "h-11 px-4 py-2 text-base",
      },
      state: {
        default: "border-input focus-visible:ring-ring",
        error: "border-rose-500 focus-visible:ring-rose-500/30 dark:border-rose-500",
        success: "border-emerald-500 focus-visible:ring-emerald-500/30 dark:border-emerald-500",
      },
    },
    defaultVariants: {
      size: "default",
      state: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size, state, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ size, state }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };

import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@store-builder/ui";

/** Native select styled to match the shared <Input>. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-[10px] border border-input bg-paper-raised px-3 py-2 text-sm text-ink",
        "transition-shadow focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@store-builder/ui";

/** Matches the shared <Input> styling — the ui package has no textarea. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-[10px] border border-input bg-paper-raised px-3 py-2 text-sm text-ink placeholder:text-muted-foreground",
        "transition-shadow focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

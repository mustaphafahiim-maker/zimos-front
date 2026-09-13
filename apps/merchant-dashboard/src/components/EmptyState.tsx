import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line px-6 py-12 text-center",
        className
      )}
    >
      {icon && <div className="mb-3 text-ink-soft/70 [&>svg]:size-8">{icon}</div>}
      <h3 className="font-display text-base font-medium text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

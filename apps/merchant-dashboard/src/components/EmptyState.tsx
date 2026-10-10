import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";

type EmptyStateTone = "default" | "success" | "attention";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  /**
   * The tint of the icon tile: the store's colour (default), green for
   * "all done, nothing waiting", amber for "this needs setting up first".
   */
  tone?: EmptyStateTone;
}

const TILE_TONE: Record<EmptyStateTone, string> = {
  default: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  attention: "bg-accent-soft text-accent-dark",
};

export function EmptyState({ title, description, action, icon, className, tone = "default" }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper-raised px-6 py-12 text-center",
        className
      )}
    >
      {icon && (
        <div className={cn("mb-4 flex size-12 items-center justify-center rounded-2xl [&>svg]:size-6", TILE_TONE[tone])}>
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

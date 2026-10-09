import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";

/**
 * The small pieces every inventory tab shares (handoff 206/207): the line
 * above a list with its one action, the list's surface, and how a variant is
 * named in a table.
 */

/** What the tab is for, and its action at the end of the line (under it on a phone). */
export function TabToolbar({ hint, children }: { hint: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="min-w-0 flex-1 basis-64 text-sm text-ink-soft">{hint}</p>
      {children && <div className="flex flex-wrap items-center gap-2 [&>a]:min-h-11 [&>button]:min-h-11">{children}</div>}
    </div>
  );
}

/**
 * The surface under a DataTable from md up, as the gift cards list has it. On
 * a phone the table draws each row as its own card, so the wrapper adds nothing.
 */
export function TableCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("md:overflow-hidden md:rounded-[var(--radius-card)] md:bg-paper-raised md:shadow-[var(--shadow-card)] md:ring-1 md:ring-line", className)}>
      {children}
    </div>
  );
}

/** A variant in a table cell: the product's name, and under it what tells this variant apart. */
export function VariantCell({ name, detail, children }: { name: string; detail?: string; children?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-medium text-ink">
        <bdi>{name}</bdi>
      </span>
      {detail && (
        <span className="text-xs font-normal text-ink-soft">
          <bdi>{detail}</bdi>
        </span>
      )}
      {children}
    </span>
  );
}

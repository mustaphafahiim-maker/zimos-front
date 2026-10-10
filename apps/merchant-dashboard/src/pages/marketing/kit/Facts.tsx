import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";

/**
 * The facts of one row in its preview sheet: a quiet label at the start, the
 * value at the end, a hairline between the lines. A definition list, so a
 * screen reader hears each value with its name.
 */
export function Facts({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("flex flex-col", className)}>{children}</dl>;
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-line py-2.5 first:border-t-0 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-[13px] leading-6 text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-end text-sm leading-6 font-medium wrap-anywhere text-ink">{children}</dd>
    </div>
  );
}

/**
 * A well inside a pane or a sheet: a group of fields that belong together, a
 * note, a sample. Solid and sunken on its own; glass/sweep-marketing.css gives
 * it the tint of the pane it sits in.
 */
export function Well({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-slot="sweep-well" className={cn("rounded-2xl bg-paper-sunken px-4 py-3.5", className)}>
      {children}
    </div>
  );
}

/** A small heading over a block of a page or of a sheet (13px, quiet), with an optional figure after it. */
export function BlockTitle({ children, count, className }: { children: ReactNode; count?: ReactNode; className?: string }) {
  return (
    <h2 className={cn("flex items-center gap-2 px-1 text-[13px] leading-5 font-semibold text-ink-soft", className)}>
      <span className="min-w-0 truncate">{children}</span>
      {count !== undefined && count !== null && (
        <span className="rounded-full bg-paper-sunken px-2 py-0.5 text-xs leading-4 font-semibold tabular-nums">{count}</span>
      )}
    </h2>
  );
}

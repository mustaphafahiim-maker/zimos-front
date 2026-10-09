import { cn } from "@store-builder/ui";
import { SkeletonBar } from "@/components/DataState";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { loading: "Loading…" },
  ar: { loading: "بيحمّل…" },
} satisfies Messages;

export interface ListSkeletonProps {
  /** How many rows to hold room for. Default 6. */
  rows?: number;
  /** `card`: phone cards at every width. `table`: the sheet at every width. Left out: cards under md, the sheet from md. */
  variant?: "card" | "table";
  className?: string;
}

// Widths in turn, so no two rows next to each other are the same.
const TITLE = ["w-2/5", "w-1/2", "w-1/3", "w-3/5"] as const;
const AMOUNT = ["w-16", "w-14", "w-20", "w-12"] as const;
const META = ["w-1/3", "w-1/4", "w-2/5", "w-1/5"] as const;
const FIRST = ["w-1/4", "w-1/5", "w-1/3", "w-1/4", "w-1/6"] as const;
const SECOND = ["w-1/6", "w-1/5", "w-1/8", "w-1/6", "w-1/5"] as const;
const LAST = ["w-14", "w-12", "w-16", "w-14", "w-12"] as const;

function turn(widths: readonly string[], index: number): string {
  return widths[index % widths.length] ?? "w-1/3";
}

/**
 * A list while its first page loads: placeholders in the shape of the rows and
 * exactly as tall, so nothing jumps when they arrive — `ListRowCard`s on a
 * phone (two lines, 74px), a table-like sheet from md (a head and 52px rows).
 * Announced once as "loading"; the bones themselves are hidden from screen
 * readers. The bars are DataState's `SkeletonBar`, so they shimmer with the
 * rest of the dashboard and stand still for people who asked for less motion.
 */
export function ListSkeleton({ rows = 6, variant, className }: ListSkeletonProps) {
  const t = useT(STRINGS);
  const lines = Array.from({ length: Math.max(1, Math.floor(rows)) }, (_, index) => index);

  return (
    <div data-skeleton="" data-variant={variant ?? "auto"} role="status" aria-live="polite" aria-busy="true" className={cn("min-w-0", className)}>
      <span className="sr-only">{t.loading}</span>

      {variant !== "table" && (
        <ul aria-hidden className={cn("flex flex-col gap-2.5", variant === undefined && "md:hidden")}>
          {lines.map((index) => (
            // The same box as ListRowCard: its padding, its two lines, its glass.
            <li
              key={index}
              className="zimos-row-card flex min-h-[72px] items-center gap-3 rounded-[1.25rem] bg-paper-raised px-3.5 py-3 shadow-[var(--shadow-card)] ring-1 ring-line"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex h-[1.375rem] items-center gap-2">
                  <SkeletonBar className={cn("h-3.5", turn(TITLE, index))} />
                  <SkeletonBar className={cn("ms-auto h-3.5", turn(AMOUNT, index))} />
                </div>
                <div className="flex h-6 items-center gap-2">
                  <SkeletonBar className="h-5 w-[4.5rem] shrink-0" />
                  <SkeletonBar className={cn("h-2.5", turn(META, index))} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {variant !== "card" && (
        <div
          aria-hidden
          className={cn(
            "zimos-list-sheet overflow-hidden rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line",
            variant === undefined && "max-md:hidden"
          )}
        >
          <div data-slot="list-skeleton-head" className="flex h-10 items-center gap-4 border-b border-line bg-paper-sunken/60 px-4">
            <SkeletonBar className="size-4 shrink-0 rounded-[5px]" />
            <SkeletonBar className="h-2.5 w-1/5" />
            <SkeletonBar className="h-2.5 w-1/6" />
            <SkeletonBar className="h-2.5 w-16 shrink-0" />
            <SkeletonBar className="ms-auto h-2.5 w-12 shrink-0" />
          </div>
          {lines.map((index) => (
            <div
              key={index}
              data-slot="list-skeleton-row"
              className="flex h-[3.25rem] items-center gap-4 border-b border-line px-4 last:border-b-0"
            >
              <SkeletonBar className="size-4 shrink-0 rounded-[5px]" />
              <SkeletonBar className={turn(FIRST, index)} />
              <SkeletonBar className={turn(SECOND, index)} />
              <SkeletonBar className="h-5 w-20 shrink-0" />
              <SkeletonBar className={cn("ms-auto shrink-0", turn(LAST, index))} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { cn } from "@store-builder/ui";
import { KpiCard } from "@/components/KpiCard";

/**
 * The placeholders of the report kit, shared by the parts and by the tab's
 * own skeleton (ReportTabState). They carry no "loading" announcement of
 * their own: whoever draws them says it once.
 */

/** A no-break space: text that holds a line open without saying anything. */
const NBSP = String.fromCharCode(0xa0);

// On a phone an odd last card takes the whole row, so the strip never ends on a half-empty line.
const ODD_LAST = "[&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1";

/**
 * The grid of a KPI strip: two to a row on a phone and a tablet, then one row
 * from lg — four across, three for three (or six) cards. Five cards are three
 * across at lg and one row of five from xl.
 */
export function kpiGridClass(count: number): string {
  const wide =
    count <= 2
      ? ""
      : count === 3 || count === 6
        ? "lg:grid-cols-3"
        : count === 5
          ? "lg:grid-cols-3 xl:grid-cols-5"
          : "lg:grid-cols-4";
  return cn("grid min-w-0 grid-cols-2 gap-[var(--bento-gap)]", ODD_LAST, wide);
}

/** `count` stat cards in their own skeleton shape (KpiCard's `loading`), in the strip's grid. */
export function KpiBones({ count, sparkline }: { count: number; sparkline: boolean }) {
  const cards = Math.max(1, Math.floor(count));
  return (
    <div aria-hidden className={kpiGridClass(cards)}>
      {Array.from({ length: cards }, (_, index) => (
        // A no-break space holds the label's line; an empty trend holds the sparkline's room.
        <KpiCard key={index} label={NBSP} value={null} loading trend={sparkline ? [] : undefined} />
      ))}
    </div>
  );
}

// A rising run of bars: the outline of a chart, not a grey block.
const BAR_HEIGHTS = [38, 52, 44, 66, 58, 74, 62, 80, 70, 88, 76, 92] as const;

/** Fills its box with the outline of a chart. The bars are DataState's skeleton bars (`zimos-skeleton`). */
export function ChartBones({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex h-full w-full items-end gap-1.5 sm:gap-2.5", className)}>
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={index}
          style={{ height: `${height}%` }}
          className="zimos-skeleton relative block min-w-0 flex-1 animate-pulse overflow-hidden rounded-t-lg bg-paper-sunken motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

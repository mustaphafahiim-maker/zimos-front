import { cn } from "@store-builder/ui";

export interface ProfitRankRow {
  key: string;
  label: string;
  /** Net profit in minor units; below zero is a loss. */
  value: number;
}

/**
 * Net profit of the top products or campaigns as ranked rows — a list, not an
 * SVG, so every amount is also plain text. The track under a row is as long as
 * its share of the largest amount on screen; a row that LOST money is written
 * and drawn in the danger colour and its amount carries the minus sign, so the
 * colour is never the only cue.
 */
export function ProfitRankBars({
  rows,
  format,
  summary,
  className,
}: {
  rows: ReadonlyArray<ProfitRankRow>;
  /** An amount as text, already signed. */
  format: (value: number) => string;
  /** Names the list for screen readers. */
  summary: string;
  className?: string;
}) {
  const largest = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  return (
    <ul aria-label={summary} data-slot="profit-rank" className={cn("flex flex-col gap-3", className)}>
      {rows.map((row) => {
        const loss = row.value < 0;
        const width = Math.max(row.value === 0 ? 0 : 2, (Math.abs(row.value) / largest) * 100);
        return (
          <li key={row.key} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm leading-5 text-ink" dir="auto">
                {row.label}
              </span>
              <bdi dir="ltr" className={cn("shrink-0 text-sm leading-5 font-semibold tabular-nums", loss ? "text-danger" : "text-ink")}>
                {format(row.value)}
              </bdi>
            </div>
            <div aria-hidden data-slot="profit-rank-track" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-sunken">
              <div className={cn("h-full rounded-full", loss ? "bg-danger" : "bg-primary")} style={{ width: `${width}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

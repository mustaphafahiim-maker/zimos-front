import { cn } from "@store-builder/ui";
import { fmt } from "@/i18n/LocaleContext";
import { formatPercentValue } from "@/lib/format";

/** One bar of the chart: one total (customers, orders, sales) split between new and returning customers. */
export interface SplitRow {
  key: string;
  /** What the bar measures («المبيعات»). */
  label: string;
  /** The part that came from new customers. */
  fresh: number;
  /** The part that came from customers who had bought before. */
  back: number;
  /** Writes a part for the viewer (a count, an amount of money). */
  format: (value: number) => string;
}

export interface NewVsReturningChartProps {
  rows: ReadonlyArray<SplitRow>;
  /** The height to fill, in px — handed down by `ReportChartCard`. */
  height: number;
  newLabel: string;
  returningLabel: string;
  /** Names the figure for screen readers. */
  summary: string;
  /** The tooltip of a part: `{metric}`, `{who}`, `{value}`, `{share}`. */
  segmentTitle: string;
}

// A row is its label (20px), the bar, and the line of values (16px), 4px apart.
const ROW_CHROME = 44;
const ROW_GAP = 8;

/**
 * The customers tab's ONE chart: who the period's customers, orders and sales
 * came from — each total as one bar split between new customers (the brand
 * colour, at the start) and the ones who came back (the accent, at the end).
 * Three bars under each other answer the question at a glance: when the
 * accent part grows from the first bar to the last, returning customers bring
 * more money than their number.
 *
 * In the style of components/charts.tsx: no library, token colours, a
 * `title` on every mark, and every value written as text under its bar, so
 * nothing has to be read off a length. It is a part-of-a-whole bar, not a time
 * axis, so it follows the reading direction (new at the start in Arabic too).
 * Not an SVG — like `HBarList`, it is a list with a proportional track, drawn
 * at the card's own width. Nothing here moves.
 */
export function NewVsReturningChart({ rows, height, newLabel, returningLabel, summary, segmentTitle }: NewVsReturningChartProps) {
  const count = Math.max(1, rows.length);
  // The bars share what is left of the height: 24px on a phone (220px), 30px at most.
  const bar = Math.max(12, Math.min(30, Math.floor((height - ROW_GAP * (count - 1)) / count) - ROW_CHROME));

  return (
    <ul aria-label={summary} className="flex h-full min-w-0 flex-col justify-between">
      {rows.map((row) => {
        const fresh = Math.max(0, row.fresh);
        const back = Math.max(0, row.back);
        const total = fresh + back;
        const share = (part: number) => (total > 0 ? formatPercentValue(part / total) : "—");
        const title = (who: string, part: number) =>
          fmt(segmentTitle, { metric: row.label, who, value: row.format(part), share: share(part) });
        return (
          <li key={row.key} className="min-w-0">
            <p className="text-[13px] leading-5 font-medium text-ink-soft">{row.label}</p>
            <div
              aria-hidden
              style={{ height: bar }}
              className="mt-1 flex w-full gap-0.5 overflow-hidden rounded-full bg-line"
            >
              {fresh > 0 && <span title={title(newLabel, fresh)} style={{ flexGrow: fresh }} className="min-w-1.5 basis-0 bg-primary" />}
              {back > 0 && <span title={title(returningLabel, back)} style={{ flexGrow: back }} className="min-w-1.5 basis-0 bg-accent" />}
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-xs leading-4">
              <SplitValue who={newLabel} value={row.format(fresh)} share={share(fresh)} dot="bg-primary" />
              <SplitValue who={returningLabel} value={row.format(back)} share={share(back)} dot="bg-accent" end />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** One part's figures under its end of the bar: a dot in the part's colour, the value, its share of the bar. */
function SplitValue({ who, value, share, dot, end = false }: { who: string; value: string; share: string; dot: string; end?: boolean }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5 tabular-nums", end && "justify-end")}>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot)} />
      <span className="sr-only">{who}:</span>
      <bdi dir="ltr" className="min-w-0 truncate font-semibold text-ink">
        {value}
      </bdi>
      <bdi dir="ltr" className="shrink-0 text-ink-soft">
        {share}
      </bdi>
    </span>
  );
}

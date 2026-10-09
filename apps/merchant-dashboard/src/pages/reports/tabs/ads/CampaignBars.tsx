import { cn } from "@store-builder/ui";
import { fmt, useT } from "@/i18n/LocaleContext";
import type { AdsRow } from "./adsData";
import { formatRoas, type AdsMoney } from "./adsFormat";
import { ADS_STRINGS } from "./adsStrings";

/** One campaign: a 20px line for its name and its return, two 6px bars, the gaps between. */
const ROW_HEIGHT = 44;

/** The width of a bar as a share of the longest one. A value above zero always leaves a mark. */
function barWidth(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "0%";
  return `${Math.max(1.5, Math.min(100, (value / max) * 100))}%`;
}

/**
 * The tab's ONE chart: for each campaign, what was spent on it (grey) over
 * the delivered sales it brought back (the brand colour), on one scale — so a
 * campaign whose coloured bar is the longer one returned more than it cost.
 *
 * Per campaign and not per day: the API has no daily series of what the ads
 * delivered (docs/ux/needs-backend.md). The campaigns with the most spend are
 * drawn, as many as fit the card; every campaign is in the table below.
 *
 * In the style of `HBarList` (components/charts.tsx): a list, not an SVG — the
 * names and the returns are plain text, each bar carries its exact amount as a
 * title, and a line for screen readers says the whole row. It is a ranking,
 * not a time axis, so it follows the reading direction: bars grow from the
 * start edge.
 */
export function CampaignBars({ rows, height, money }: { rows: readonly AdsRow[]; height: number; money: AdsMoney["money"] }) {
  const t = useT(ADS_STRINGS);
  const fits = Math.max(1, Math.floor(height / ROW_HEIGHT));
  const shown = [...rows].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0)).slice(0, fits);
  const max = Math.max(0, ...shown.map((row) => Math.max(row.spend ?? 0, row.deliveredSales)));
  // A handful of campaigns get thicker bars and more air, so the card does not read as mostly empty.
  const few = shown.length <= 3;
  const bar = few ? "h-3" : "h-1.5";

  return (
    <ul
      aria-label={t.chartSummary}
      data-slot="report-campaign-bars"
      className={cn("flex h-full min-w-0 flex-col justify-center", few ? "gap-4" : "gap-1.5")}
    >
      {shown.map((row) => {
        const spend = money(row.spend ?? 0);
        const sales = money(row.deliveredSales);
        const behind = row.roas !== null && row.roas < 1;
        return (
          <li key={row.id} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3" aria-hidden>
              <span className="min-w-0 truncate text-sm leading-5 font-medium text-ink" dir="auto" title={row.name}>
                {row.name}
              </span>
              <bdi dir="ltr" className={cn("shrink-0 text-xs leading-5 font-semibold tabular-nums", behind ? "text-danger" : "text-ink")}>
                {formatRoas(row.roas)}
              </bdi>
            </div>
            <div className="mt-1 flex flex-col gap-0.5" aria-hidden>
              <span
                title={fmt(t.barSpend, { amount: spend })}
                style={{ width: barWidth(row.spend ?? 0, max) }}
                className={cn("block rounded-full bg-ink-soft/50", bar)}
              />
              <span
                title={fmt(t.barSales, { amount: sales })}
                style={{ width: barWidth(row.deliveredSales, max) }}
                className={cn("block rounded-full bg-primary", bar)}
              />
            </div>
            <span className="sr-only">{fmt(t.chartRow, { name: row.name, spend, sales })}</span>
          </li>
        );
      })}
    </ul>
  );
}

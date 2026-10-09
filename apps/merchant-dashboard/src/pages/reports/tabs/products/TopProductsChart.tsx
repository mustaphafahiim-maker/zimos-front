import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import type { RankedBar } from "./model";
import { PRODUCTS_TAB_STRINGS } from "./strings";

/** One row of the chart: tall enough for a thumb, and five of them fill the 220px a chart has on a phone. */
const ROW_HEIGHT = 44;

const ROW = "flex h-full min-w-0 items-center gap-2.5 rounded-xl px-1.5";
const ROW_LINK =
  "transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:bg-paper-sunken motion-reduce:transition-none";

export interface TopProductsChartProps {
  /** The products in rank order, the best first. As many as fit the height are drawn. */
  bars: readonly RankedBar[];
  /** The height the chart has to fill, in px (`ReportChartCard` tells it). */
  height: number;
  /** A value as the viewer reads it: money in the report's currency. */
  format: (value: number) => string;
  /** One sentence naming the whole figure, for screen readers. */
  summary: string;
  /** Whether a product's row opens its page. */
  linked: boolean;
}

/**
 * The tab's ONE chart: the top products as ranked horizontal bars — rank, name
 * and amount as plain text, a proportional bar under them. In the house style
 * of `HBarList` (components/charts.tsx): a list, not a picture, so every value
 * is also text and the whole thing reads as a ranking without a fallback.
 *
 * It is not a time axis, so it follows the page's direction: in Arabic the
 * bars grow from the right, where the names start. The longest bar is the
 * largest amount in either direction; a loss is drawn in the danger ink, its
 * amount carries its minus sign and the row says «خسارة» to a screen reader.
 * A row whose product still exists opens that product.
 */
export function TopProductsChart({ bars, height, format, summary, linked }: TopProductsChartProps) {
  const t = useT(PRODUCTS_TAB_STRINGS);
  const count = Math.max(1, Math.floor(height / ROW_HEIGHT));
  const shown = bars.slice(0, count);
  const largest = Math.max(1, ...shown.map((bar) => Math.abs(bar.value)));

  return (
    <ol aria-label={summary} className="flex h-full min-w-0 flex-col">
      {shown.map((bar, index) => {
        const loss = bar.value < 0;
        const share = Math.abs(bar.value) / largest;
        // A bar that exists is never thinner than a sliver: a small amount is still an amount.
        const width = bar.value === 0 ? 0 : Math.max(2, Math.round(share * 100));
        const name = bar.label ?? t.deletedProduct;
        const amount = format(bar.value);
        const body: ReactNode = (
          <>
            <span
              aria-hidden
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs leading-none font-semibold tabular-nums",
                index === 0 ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary-dark"
              )}
            >
              {formatCount(index + 1)}
            </span>
            <span className="sr-only">{fmt(t.rank, { n: index + 1 })}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm leading-5 font-medium text-ink">
                  <bdi>{name}</bdi>
                </span>
                <span className={cn("shrink-0 text-sm leading-5 font-semibold tabular-nums", loss ? "text-danger" : "text-ink")}>
                  {loss && <span className="sr-only">{t.loss} </span>}
                  <bdi dir="ltr">{amount}</bdi>
                </span>
              </span>
              <span aria-hidden className="mt-1.5 block h-2 overflow-hidden rounded-full bg-paper-sunken">
                <span
                  className={cn("block h-full rounded-full", loss ? "bg-danger" : "bg-primary")}
                  style={{ width: `${width}%` }}
                />
              </span>
            </span>
          </>
        );
        return (
          <li key={bar.key} style={{ height: ROW_HEIGHT }} className="min-w-0 shrink-0" title={`${name}: ${amount}`}>
            {linked && bar.productId ? (
              <ViewLink to={`/catalog/${bar.productId}`} className={cn(ROW, ROW_LINK)}>
                {body}
              </ViewLink>
            ) : (
              <div className={ROW}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

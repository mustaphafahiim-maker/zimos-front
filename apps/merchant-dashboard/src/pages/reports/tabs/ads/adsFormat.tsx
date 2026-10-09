import { Fragment, useMemo, type ReactNode } from "react";
import { getIntlLocale } from "@/i18n/LocaleContext";
import { percentToRatio } from "@/lib/analytics";
import { formatMoney, formatPercentValue } from "@/lib/format";
import { useReportMoney } from "@/lib/reportCurrency";

/** Shown where the API has no figure (a rate over nothing, a cost with no delivered order). */
export const DASH = "—";

export interface AdsMoney {
  /** An amount for the screen, in the currency picked in the hub's header. Null → a dash. */
  money: (minor: number | null | undefined) => string;
  /** The same amount as a plain number of whole units, for a CSV cell. Null → an empty cell. */
  csv: (minor: number | null | undefined) => number | null;
  /** The amount in minor units of the shown currency, for a chart's axis. */
  shown: (minor: number) => number;
}

/**
 * Money on the ads tab: every amount goes through the hub's report currency
 * (lib/reportCurrency.tsx) and @/lib/format, so the tab reads in the same
 * currency as the other six.
 */
export function useAdsMoney(currency: string): AdsMoney {
  const inReport = useReportMoney();
  return useMemo<AdsMoney>(
    () => ({
      money: (minor) => (minor === null || minor === undefined ? DASH : formatMoney(...inReport(minor, currency))),
      // formatMoney shows minor units as hundredths; the file gets the same number.
      csv: (minor) => (minor === null || minor === undefined ? null : inReport(minor, currency)[0] / 100),
      shown: (minor) => inReport(minor, currency)[0],
    }),
    [inReport, currency]
  );
}

/** Delivered sales ÷ spend, as the ads world writes it: "2.4×". */
export function formatRoas(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  const figure = new Intl.NumberFormat(getIntlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(value);
  return `${figure}×`;
}

/** A rate the API gives as a percentage (12.5) → "12.5%"; null → a dash. */
export function formatRate(percent: number | null | undefined, digits = 1): string {
  return formatPercentValue(percentToRatio(percent), digits);
}

/**
 * `fmt` for a sentence that holds more than text: "{name} spent {amount}" with
 * each placeholder filled by a node — a name in its own direction, an amount
 * kept left-to-right inside an Arabic line. A placeholder with no part stays
 * as it was written.
 */
export function fill(template: string, parts: Record<string, ReactNode>): ReactNode {
  const out: ReactNode[] = [];
  let rest = template;
  let index = 0;
  while (rest.length > 0) {
    const open = rest.indexOf("{");
    const close = open < 0 ? -1 : rest.indexOf("}", open);
    if (open < 0 || close < 0) {
      out.push(rest);
      break;
    }
    if (open > 0) out.push(rest.slice(0, open));
    const key = rest.slice(open + 1, close);
    out.push(<Fragment key={index}>{key in parts ? parts[key] : `{${key}}`}</Fragment>);
    index += 1;
    rest = rest.slice(close + 1);
  }
  return out;
}

/** A figure, its sign and its currency in their own order inside an Arabic sentence. */
export function Figure({ children }: { children: ReactNode }) {
  return (
    <bdi dir="ltr" className="font-semibold tabular-nums">
      {children}
    </bdi>
  );
}

/** A campaign's or a source's name inside a sentence: its own direction, whatever script it is written in. */
export function Name({ children }: { children: ReactNode }) {
  return <bdi className="font-semibold">{children}</bdi>;
}

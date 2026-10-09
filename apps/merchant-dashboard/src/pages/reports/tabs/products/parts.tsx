import { Fragment, useMemo, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { IconLock, IconStockLow, IconWarning } from "@/components/icons";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { formatMinorMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { useReportMoney } from "@/lib/reportCurrency";
import { outOf, type ProductStock } from "./model";
import { PRODUCTS_TAB_STRINGS, type ProductsTabStrings } from "./strings";

/**
 * A sentence with parts that are not plain text: `{name}` in the template is
 * replaced by the node given for it (a product's name in its own direction, an
 * amount that keeps its digits in order), so the wording stays whole in the
 * strings file and the markup stays here. A slot with no node is left as written.
 */
export function rich(template: string, slots: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, index) => {
    const match = /^\{(\w+)\}$/.exec(part);
    if (!match) return part;
    const slot = slots[match[1]];
    return <Fragment key={index}>{slot === undefined ? part : slot}</Fragment>;
  });
}

/** A product's name inside a sentence: isolated, so a Latin name does not reorder the Arabic around it. */
export function NameInText({ name }: { name: string }) {
  return <bdi className="font-semibold">{name}</bdi>;
}

/** A figure inside a sentence or a list: its digits, sign and currency keep their own order. */
export function Figure({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("tabular-nums", className)}>
      {children}
    </bdi>
  );
}

/** A rate as it is said in a sentence: "4 in 10" («٤ من كل ١٠»), or "fewer than 1 in 100" for almost none. */
export function rateInWords(percent: number, t: ProductsTabStrings): string {
  const share = outOf(percent);
  return fmt(share.less ? t.lessThanOutOf : t.outOf, { n: share.n, of: share.of });
}

const minorDigits = new Map<string, number>();

/** Minor units as a plain number of major units, for a CSV cell a spreadsheet can add up (EGP 2 places, JPY 0, KWD 3). */
export function toMajor(amountMinor: number, currency: string): number {
  let digits = minorDigits.get(currency);
  if (digits === undefined) {
    try {
      digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      digits = 2;
    }
    minorDigits.set(currency, digits);
  }
  return amountMinor / 10 ** digits;
}

export interface Money {
  /** An amount for the screen, in the currency picked in the hub’s header; a dash for a missing amount. */
  format: (amountMinor: number | null | undefined) => string;
  /** The same amount as a plain number of major units, for a CSV cell; null for a missing amount. */
  major: (amountMinor: number | null | undefined) => number | null;
}

/**
 * Money of one report (`currency` is the store’s) as this tab shows it: through the hub’s currency switch
 * (`useReportMoney`), whole amounts without decimals — the same formatting as the old reports screen.
 */
export function useMoney(currency: string): Money {
  const inReport = useReportMoney();
  return useMemo<Money>(
    () => ({
      format: (amountMinor) =>
        amountMinor === null || amountMinor === undefined ? "—" : formatMinorMoney(...inReport(amountMinor, currency)),
      major: (amountMinor) =>
        amountMinor === null || amountMinor === undefined ? null : toMajor(...inReport(amountMinor, currency)),
    }),
    [inReport, currency]
  );
}

/** A page path as people read it («/منتج/شنطة»); a path that is not valid percent-encoding is shown as it came. */
export function readablePath(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

/**
 * A part of the tab whose own read failed: said plainly, with a way to try
 * again — never passed off as "nothing here", and never taking the rest of the
 * tab with it.
 */
export function PartError({ message, onRetry, className }: { message?: string; onRetry: () => void; className?: string }) {
  const t = useT(PRODUCTS_TAB_STRINGS);
  const common = useCommon();
  return (
    <div role="alert" className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-1", className)}>
      <p className="flex min-w-0 items-start gap-2 text-[13px] leading-5 text-ink-soft">
        <IconWarning aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0 text-accent-dark" />
        <span className="min-w-0">{message ?? t.partError}</span>
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 shrink-0 cursor-pointer rounded-full px-3 text-[13px] font-semibold text-primary transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        {common.retry}
      </button>
    </div>
  );
}

/** A part the signed-in role may not read, found out only when it was opened: one quiet line, no retry. */
export function PartDenied({ className }: { className?: string }) {
  const t = useT(PRODUCTS_TAB_STRINGS);
  return (
    <p className={cn("flex items-start gap-2 text-[13px] leading-5 text-ink-soft", className)}>
      <IconLock aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">{t.partDenied}</span>
    </p>
  );
}

/** How long a product's stock lasts, in words: «خلص», «نوع خلص», «أقل من يوم», «٣ أيام»; null when it has no pace to tell from. */
export function stockDaysText(stock: ProductStock, t: ProductsTabStrings): string | null {
  if (stock.status === "out") return stock.variants > 1 ? t.stockVariantOut : t.stockOut;
  if (stock.days === null) return null;
  if (stock.days <= 0) return t.stockLastDay;
  return countOf("day", stock.days);
}

/**
 * The «المخزون يكفي» cell of the products table: the days the first variant
 * to run out lasts. Out and "reorder now" are red, "running low" amber — and
 * each carries a mark and its word for a screen reader, so the colour is never
 * the only cue.
 */
export function StockDaysCell({ stock }: { stock: ProductStock | null }) {
  const t = useT(PRODUCTS_TAB_STRINGS);
  const text = stock ? stockDaysText(stock, t) : null;
  if (!stock || text === null) return <span className="text-ink-soft">—</span>;
  const urgent = stock.status === "out" || stock.status === "reorder_now";
  const soon = stock.status === "soon";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-1 font-medium whitespace-nowrap",
        urgent ? "text-danger" : soon ? "text-accent-dark" : "text-ink"
      )}
    >
      {urgent && <IconWarning aria-hidden weight="fill" className="size-3.5 shrink-0" />}
      {soon && <IconStockLow aria-hidden className="size-3.5 shrink-0" />}
      <bdi>{text}</bdi>
      {stock.status === "reorder_now" && <span className="sr-only">{fmt("({label})", { label: t.stockReorder })}</span>}
      {soon && <span className="sr-only">{fmt("({label})", { label: t.stockSoon })}</span>}
    </span>
  );
}

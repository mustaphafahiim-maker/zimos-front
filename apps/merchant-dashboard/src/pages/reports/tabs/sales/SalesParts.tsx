import { Fragment, useMemo, type ReactNode } from "react";
import { Button, cn } from "@store-builder/ui";
import { SkeletonBar } from "@/components/DataState";
import { IconCaretRight, IconWarning } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";
import { getIntlLocale, useT } from "@/i18n/LocaleContext";
import { isPermissionError } from "@/lib/errors";
import { formatMinorMoney } from "@/lib/format";
import { useReportMoney } from "@/lib/reportCurrency";
import { formatCompactMoney } from "@/lib/reportRange";
import { SALES_STRINGS } from "./salesStrings";

/*
 * The small pieces the parts of the «المبيعات والربح» tab share: amounts in the
 * report currency, a sentence with elements in its slots, the state of one
 * part (loading / not for this role / failed, with a retry), a list of
 * labelled amounts, and the amber "costs are incomplete" strip.
 */

/* ------------------------------------------------------------------ *
 * Amounts
 * ------------------------------------------------------------------ */

const digitCache = new Map<string, number>();

/** Decimal places of a currency's minor unit (EGP 2, JPY 0, KWD 3), from Intl. */
function minorDigits(currency: string): number {
  let digits = digitCache.get(currency);
  if (digits === undefined) {
    try {
      digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      digits = 2;
    }
    digitCache.set(currency, digits);
  }
  return digits;
}

export interface SalesMoney {
  /** An amount of the report (minor units of its own currency) as text, in the currency picked in the hub's header. */
  money: (minor: number | null | undefined) => string;
  /** The same with a minus sign in front of an amount below zero — the way a loss is written. */
  signed: (minor: number) => string;
  /** The amount as a plain number of major units in the currency shown — what a CSV cell holds. */
  major: (minor: number | null | undefined) => number;
  /** For a chart axis: "12K", "1.2M". */
  compact: (minor: number) => string;
}

/** Formatters for amounts of a report whose own currency is `currency` (lib/reportCurrency.tsx converts for viewing). */
export function useSalesMoney(currency: string): SalesMoney {
  const inReport = useReportMoney();
  return useMemo(() => {
    const money = (minor: number | null | undefined) => formatMinorMoney(...inReport(minor ?? 0, currency));
    return {
      money,
      signed: (minor: number) => `${minor < 0 ? "−" : ""}${money(Math.abs(minor))}`,
      major: (minor: number | null | undefined) => {
        const [amount, code] = inReport(minor ?? 0, currency);
        return amount / 10 ** minorDigits(code);
      },
      compact: (minor: number) => formatCompactMoney(inReport(minor, currency)[0]),
    };
  }, [inReport, currency]);
}

/** A figure inside a sentence: its own direction, tabular digits, never broken across lines. */
export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("font-semibold whitespace-nowrap tabular-nums", className)}>
      {children}
    </bdi>
  );
}

/** A sentence template with its `{slots}` filled by text or elements (an amount in its own direction). */
export function fill(template: string, slots: Record<string, ReactNode>): ReactNode {
  return template.split(/\{(\w+)\}/g).map((part, index) =>
    // Odd parts are the names between the braces.
    index % 2 === 1 ? <Fragment key={index}>{part in slots ? slots[part] : `{${part}}`}</Fragment> : part
  );
}

/** A weekday (0 = Sunday) in the screen's language. */
export function weekdayName(dow: number): string {
  // The first of January 2023 was a Sunday.
  return new Intl.DateTimeFormat(getIntlLocale(), { weekday: "long" }).format(new Date(2023, 0, 1 + dow));
}

/** An hour of the day as a clock reads it («٦ م», "6 PM"). */
export function hourName(hour: number): string {
  return new Intl.DateTimeFormat(getIntlLocale(), { hour: "numeric" }).format(new Date(2000, 0, 1, hour));
}

/* ------------------------------------------------------------------ *
 * The state of one part
 * ------------------------------------------------------------------ */

const PILL =
  "h-10 shrink-0 rounded-full px-4 pointer-coarse:h-11";

/**
 * One part of the tab that has its own request: bones while it loads; when the
 * role may not read it, a quiet line saying so (no retry — trying again cannot
 * grant a role); when it failed for another reason, its own line with «جرّب
 * تاني». One failed part never takes the tab with it.
 */
export function PartState({
  loading,
  error,
  onRetry,
  failed,
  className,
  children,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  /** In place of «الجزء ده ما اتحمّلش». */
  failed?: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useT(SALES_STRINGS);
  if (loading) {
    return (
      <div role="status" aria-busy="true" className={className}>
        <span className="sr-only">{t.partLoading}</span>
        <div aria-hidden>
          <SkeletonBar className="h-4 w-2/5" />
          <SkeletonBar className="mt-4 w-11/12" />
          <SkeletonBar className="mt-3 w-3/5" />
        </div>
      </div>
    );
  }
  if (error) {
    if (isPermissionError(error)) return <p className={cn("text-sm leading-6 text-ink-soft", className)}>{t.partDenied}</p>;
    return (
      <div role="alert" className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2", className)}>
        <p className="min-w-0 text-sm leading-6 text-ink-soft">{failed ?? t.partFailed}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => onRetry()} className={PILL}>
          {t.retry}
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}

/* ------------------------------------------------------------------ *
 * Labelled amounts
 * ------------------------------------------------------------------ */

export interface AmountRow {
  key: string;
  label: string;
  /** A second, quieter line under the label: what the amount counts. */
  sub?: string;
  /** The amount as text, already formatted and signed. */
  value: string;
  /** A total: heavier ink and a line above it. */
  strong?: boolean;
  /** Red (a loss) or green (what was kept). */
  tone?: "good" | "bad";
  /** Said in secondary ink in place of an amount that is not known («ناقصة»). */
  muted?: boolean;
}

/** A statement: one labelled amount per line, the digits in one column. */
export function AmountList({ rows, className }: { rows: ReadonlyArray<AmountRow>; className?: string }) {
  return (
    <dl className={cn("text-sm", className)}>
      {rows.map((row) => (
        <div
          key={row.key}
          className={cn("flex items-baseline justify-between gap-3 py-2", row.strong && "mt-1 border-t border-line pt-3")}
        >
          <dt className="min-w-0">
            <span className={cn("block", row.strong ? "font-semibold text-ink" : "text-ink-soft")}>{row.label}</span>
            {row.sub && <span className="block text-xs leading-5 text-ink-soft">{row.sub}</span>}
          </dt>
          <dd
            className={cn(
              "shrink-0 tabular-nums",
              row.strong ? "text-base font-semibold" : "font-medium",
              row.muted ? "font-normal text-ink-soft" : row.tone === "bad" ? "text-danger" : row.tone === "good" ? "text-success" : "text-ink"
            )}
          >
            <bdi dir="ltr">{row.value}</bdi>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One small figure with its label and a quiet line under it. */
export function Fact({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs leading-5 text-ink-soft">{label}</dt>
      <dd className="text-lg leading-7 font-semibold text-ink tabular-nums">
        <bdi dir="ltr">{value}</bdi>
      </dd>
      {hint && <dd className="text-xs leading-4 text-pretty text-ink-soft">{hint}</dd>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Product costs are incomplete
 * ------------------------------------------------------------------ */

/**
 * The amber strip the home shows inside its profit card, here under the KPI
 * strip: costs are incomplete, in the home's words, and the way to fix it. It
 * carries the home strip's hooks (`money-warn`, `money-warn-action`), so the
 * glass layer gives it the same material (glass/home-cards.css); on its own it
 * is the soft amber fill with a hairline.
 */
export function CostsNote({ text, className }: { text: string; className?: string }) {
  const t = useT(SALES_STRINGS);
  return (
    <div
      role="note"
      data-slot="money-warn"
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-accent-soft py-2 ps-3.5 pe-2 text-accent-dark ring-1 ring-accent/30",
        className
      )}
    >
      <p className="flex min-w-0 flex-1 basis-56 items-start gap-2 text-[13px] leading-5 font-semibold">
        <IconWarning aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 text-pretty">{text}</span>
      </p>
      <ViewLink
        to="/profit/costs"
        data-slot="money-warn-action"
        className="ms-auto inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-accent-dark px-4 text-[13px] font-semibold text-paper-raised transition-opacity duration-(--dur-fade) ease-(--ease-out) hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark motion-reduce:transition-none"
      >
        {t.completeCosts}
        <IconCaretRight aria-hidden weight="bold" className="size-3.5 shrink-0 rtl:-scale-x-100" />
      </ViewLink>
    </div>
  );
}

import { Fragment, type ReactNode } from "react";
import { getIntlLocale } from "@/i18n/LocaleContext";
import { formatPercentValue } from "@/lib/format";

/** The API's rates are percentages (12.5 = 12.5%); "—" when there is no denominator. */
export function formatRate(percent: number | null | undefined): string {
  return percent === null || percent === undefined ? "—" : formatPercentValue(percent / 100);
}

/** "2026-05" → "May 2026" / «مايو ٢٠٢٦»: the month a cohort placed its first order in. */
export function cohortLabel(cohort: string): string {
  const date = new Date(`${cohort}-01T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? cohort
    : new Intl.DateTimeFormat(getIntlLocale(), { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

/**
 * A translated template with pieces of markup in its placeholders:
 * `fill("{share} bought again and brought {sales}", { share: "3 in 10", sales: <bdi dir="ltr">EGP 4,200</bdi> })`.
 * A placeholder with no part is left as it is written.
 */
export function fill(template: string, parts: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((piece, index) => {
    const name = piece.startsWith("{") && piece.endsWith("}") ? piece.slice(1, -1) : "";
    return <Fragment key={index}>{name && name in parts ? parts[name] : piece}</Fragment>;
  });
}

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

/** Integer minor units → the amount as a plain number of whole units, for a spreadsheet cell. */
export function majorUnits(minor: number, currency: string): number {
  return minor / 10 ** minorDigits(currency);
}

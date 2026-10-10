import { getIntlLocale } from "@/i18n/LocaleContext";

/**
 * Small helpers for the number and day fields of the pre-order, purchase
 * limit and delivery time cards.
 */

/** Arabic-Indic and Persian digits typed on a phone keyboard, as ASCII. */
export function asciiDigits(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

/**
 * A whole number in [min, max] from a text field: `null` for an empty field,
 * `NaN` for anything else that is not one (the caller shows its own error).
 */
export function parseWholeNumber(raw: string, min: number, max: number): number | null {
  const text = asciiDigits(raw).trim();
  if (text === "") return null;
  if (!/^\d{1,9}$/.test(text)) return Number.NaN;
  const n = Number(text);
  return n >= min && n <= max ? n : Number.NaN;
}

/** "" for null, else the number as typed in the field (ASCII, so it round-trips). */
export function numberField(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * A calendar day ("YYYY-MM-DD") in the viewer's language — read as that day
 * itself, never shifted by the device's time zone.
 */
export function formatDay(ymd: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const date = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(getIntlLocale(), { ...opts, timeZone: "UTC" }).format(date);
}

/** Today in the device's calendar, as "YYYY-MM-DD". */
export function todayDay(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

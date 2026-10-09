import { fmt } from "@/i18n/LocaleContext";
import { pluralOf } from "@/lib/plural";
import type { JourneyT } from "./journeyStrings";

/*
 * Small formatting helpers of «رحلة الأوردر». The isolates are built from
 * their code points so no invisible character sits in the source.
 */
const LEFT_TO_RIGHT_ISOLATE = String.fromCharCode(0x2066);
const FIRST_STRONG_ISOLATE = String.fromCharCode(0x2068);
const POP_ISOLATE = String.fromCharCode(0x2069);

/** A number, an amount or a percentage keeps its own order inside an Arabic sentence. */
export const ltr = (value: string) => `${LEFT_TO_RIGHT_ISOLATE}${value}${POP_ISOLATE}`;
/** A name takes the direction of its own first letter. */
export const isolate = (value: string) => `${FIRST_STRONG_ISOLATE}${value}${POP_ISOLATE}`;

/** "N of every 10" for a percentage: 62.4 → 6. Clamped to 0–10. */
export function outOfTen(percent: number): number {
  return Math.min(10, Math.max(0, Math.round(percent / 10)));
}

/** «٥ من كل ١٠» for a percentage, in the language's own words for one and two. */
export function tenth(t: JourneyT, percent: number): string {
  return fmt(pluralOf(t, "ofTen", outOfTen(percent)), { ten: 10 });
}

/**
 * A courier as a name. The API sends the courier's code ("bosta", "j_and_t")
 * or, for a shipment booked by hand, whatever the merchant typed: a code is
 * written as a name, "manual" in words, anything else as it is.
 */
export function courierLabel(code: string | null | undefined, manual: string): string {
  const name = (code ?? "").trim();
  if (!name) return "—";
  if (name.toLowerCase() === "manual") return manual;
  if (/^[a-z0-9_-]+$/.test(name)) {
    return name
      .split(/[_-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return name;
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

/** Minor units as a plain number of whole units, for a CSV cell a spreadsheet can add up. */
export function toMajorUnits(minor: number, currency: string): number {
  return minor / 10 ** minorDigits(currency);
}

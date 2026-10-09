import { fmt } from "@/i18n/LocaleContext";
import { formatOptions, majorToMinor } from "@/lib/format";
import { asciiDigits } from "@/lib/wholeNumber";

/** A whole number in the screen's digits («١٢» in Arabic). */
export function num(n: number): string {
  return fmt("{n}", { n });
}

/** "+3" / "−2" / "0": a difference that reads without its colour. */
export function signed(n: number): string {
  if (n === 0) return num(0);
  return `${n > 0 ? "+" : "−"}${num(Math.abs(n))}`;
}

/** What tells one variant from its siblings: its options, else its SKU, else nothing. */
export function variantDetail(optionValues: Record<string, string> | null | undefined, sku: string | null | undefined): string {
  return formatOptions(optionValues) || sku || "";
}

/** "T-shirt · Size: M" — one line for labels and accessible names. */
export function variantFullName(productName: string, detail: string): string {
  return detail ? `${productName} · ${detail}` : productName;
}

/** The most a unit cost can be, in minor units (the API's cap). */
const MAX_COST_MINOR = 1e12;

/**
 * A cost typed in major units ("12.50", Arabic digits accepted) as integer
 * minor units through the shared converter; NaN when it is not an amount ≥ 0.
 */
export function costToMinor(raw: string): number {
  const minor = majorToMinor(asciiDigits(raw).replace(/٫/g, "."));
  return Number.isFinite(minor) && minor >= 0 && minor <= MAX_COST_MINOR ? minor : Number.NaN;
}

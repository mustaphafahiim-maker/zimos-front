import type { Variant } from "@store-builder/api-client";
import { formatOptions, parseMoney } from "@/lib/format";

/** The longest SKU the variant table accepts (the bulk table's own limit). */
export const SKU_MAX = 100;

/**
 * An amount as a merchant types it — 25000 → "250", 14950 → "149.5" — for the
 * field of an in-place edit: typing the same figure again is then no change.
 * Empty when there is no amount (a variant with no price before discount).
 */
export function plainAmount(minor: string | number | null | undefined): string {
  if (minor === null || minor === undefined || minor === "") return "";
  return String(parseMoney(minor) / 100);
}

/** What a variant is called in its row, its menu and its sheet: its options, or «الافتراضي» when it has none. */
export function variantName(variant: Variant, fallback: string): string {
  return formatOptions(variant.optionValues) || fallback;
}

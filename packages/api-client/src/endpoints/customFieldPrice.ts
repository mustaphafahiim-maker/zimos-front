import type { CustomField, CustomizationInput } from "../types";

/**
 * A custom field's price (catalog/customFieldPricing.js): `priceDeltaAmount`
 * minor units added to the line's unit price when the shopper fills the
 * field in. Absent or 0 = free.
 */
export type PricedCustomField = CustomField & { priceDeltaAmount?: number };

/** What filling this field in adds to the unit price (minor units). */
export function customFieldPrice(field: CustomField): number {
  const v = Number((field as PricedCustomField).priceDeltaAmount);
  return Number.isInteger(v) && v > 0 ? v : 0;
}

/** What these answers add to the unit price: the price of every field answered. */
export function customFieldsDelta(fields: CustomField[] | undefined, answers: CustomizationInput | undefined): number {
  if (!fields || !answers) return 0;
  return fields.reduce((sum, f) => {
    const answer = answers[f.id];
    return typeof answer === "string" && answer.trim() ? sum + customFieldPrice(f) : sum;
  }, 0);
}

/** An answered field's price, kept on the order line's snapshot. */
export function customizationPrice(entry: unknown): number {
  const v = Number((entry as { priceDeltaAmount?: unknown } | null)?.priceDeltaAmount);
  return Number.isInteger(v) && v > 0 ? v : 0;
}

/**
 * The id a product is known by in ad pixels (SPEC §13.2): the same id the
 * product feed gives the item (offers/productFeed.js: the variant's SKU, else
 * the variant id), so Meta / TikTok / Google match events to the catalog.
 * Every event the store sends — ViewContent, AddToCart, InitiateCheckout,
 * Purchase — uses it.
 */
export function contentIdOf(variant: { id?: string | null; sku?: string | null } | null | undefined): string | undefined {
  if (!variant) return undefined;
  const sku = typeof variant.sku === "string" ? variant.sku.trim() : "";
  return sku || variant.id || undefined;
}

/** An order line's id, from what the order kept (its SKU, else the variant). */
export function lineContentId(line: { skuSnapshot?: string | null; variantId?: string | null }): string | undefined {
  return contentIdOf({ id: line.variantId ?? null, sku: line.skuSnapshot ?? null });
}

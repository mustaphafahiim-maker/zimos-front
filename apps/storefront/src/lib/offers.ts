import { parseMoney, type StorefrontProduct } from "@store-builder/api-client";
import { defaultOfferOf, firstImage, offerAppliesTo, priceOf } from "./product";

/**
 * Commerce offers shown on product and checkout pages. Everything here is
 * derived from real catalogue data (merchant offers, product prices) — the
 * backend prices every line at checkout.
 */

export interface BundleTier {
  id: string;
  quantity: number;
  /** Percentage saved versus buying the pieces at the unit price. */
  discountPct: number;
  offerId: string;
  totalAmount: number;
  label: string;
  badge: string | null;
}

/** A product's quantity offers — only when the merchant created two or more. */
export function bundleTiers(product: StorefrontProduct): BundleTier[] {
  if (product.offers.length < 2) return [];
  const unit = priceOf(product) ?? 0;
  return product.offers.map((offer) => {
    const quantity = Math.max(1, offer.lines.reduce((sum, l) => sum + (l.quantity || 0), 0) || 1);
    const total = parseMoney(offer.priceAmount);
    const full = unit * quantity;
    return {
      id: offer.id,
      quantity,
      discountPct: full > total && full > 0 ? Math.round(((full - total) / full) * 100) : 0,
      offerId: offer.id,
      totalAmount: total,
      label: offer.name,
      badge: offer.badge,
    };
  });
}

export function bundlePricing(unitAmount: number, quantity: number, tier: BundleTier | undefined) {
  if (tier) {
    const full = unitAmount * tier.quantity;
    return { full, total: tier.totalAmount, saving: Math.max(0, full - tier.totalAmount) };
  }
  const full = unitAmount * quantity;
  return { full, total: full, saving: 0 };
}

export interface OrderBumpOffer {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  priceAmount: number;
  variantId: string;
  offerId?: string;
}

/** The cheapest other in-stock product, added as a real cart line at its real price. */
export function getOrderBump(products: StorefrontProduct[], excludeProductIds: string[]): OrderBumpOffer | null {
  const pick = products
    .filter((p) => !excludeProductIds.includes(p.id))
    .map((p) => ({ p, variant: p.variants.find((v) => v.inStock), price: priceOf(p) }))
    .filter((c): c is { p: StorefrontProduct; variant: NonNullable<typeof c.variant>; price: number } => !!c.variant && c.price !== undefined && c.price > 0)
    .sort((a, b) => a.price - b.price)[0];
  if (!pick) return null;
  const offer = defaultOfferOf(pick.p);
  return {
    id: pick.p.id,
    name: pick.p.name,
    description: pick.p.description?.slice(0, 120) ?? "",
    imageUrl: firstImage(pick.p),
    priceAmount: pick.price,
    variantId: pick.variant.id,
    offerId: offer && offerAppliesTo(offer, pick.variant.id) ? offer.id : undefined,
  };
}

import { parseMoney, type Order, type StorefrontProduct } from "@store-builder/api-client";
import { defaultOfferOf, firstImage, offerAppliesTo, priceOf } from "./product";

/**
 * ------------------------------------------------------------------------
 * Conversion features built on top of the public storefront API.
 *
 * Everything here is derived from real catalogue data: bundles come from the
 * merchant's own multi-line offers, and the order bump and post-purchase
 * upsell are real products from the same store, added as real cart lines at
 * real prices. When the data to support a feature isn't there, the function
 * returns nothing and the UI drops the feature rather than inventing a
 * placeholder product or discount.
 * ------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Bundles / quantity offers
// ---------------------------------------------------------------------------

export interface BundleTier {
  id: string;
  quantity: number;
  /** Percentage off `quantity × unit`, derived from the offer's own price. */
  discountPct: number;
  offerId: string;
  /** Fixed total for the offer (minor units). */
  totalAmount: number;
  label?: string;
  badge?: string | null;
}

/**
 * Quantity tiers for a product, built from the merchant's offers.
 *
 * A product needs two or more offers to present a ladder; with fewer there is
 * nothing to compare against, so no bundle UI is shown.
 */
export function bundleTiers(product: StorefrontProduct): BundleTier[] {
  if (product.offers.length < 2) return [];
  const unit = priceOf(product) ?? 0;
  return product.offers.map((offer) => {
    const quantity = Math.max(1, offer.lines.reduce((sum, l) => sum + (l.quantity || 0), 0) || 1);
    const total = parseMoney(offer.priceAmount);
    const full = unit * quantity;
    const discountPct = full > total && full > 0 ? Math.round(((full - total) / full) * 100) : 0;
    return {
      id: offer.id,
      quantity,
      discountPct,
      offerId: offer.id,
      totalAmount: total,
      label: offer.name,
      badge: offer.badge,
    };
  });
}

/** Totals for the selected tier, or plain unit × quantity when there is none. */
export function bundlePricing(unitAmount: number, quantity: number, tier: BundleTier | undefined) {
  if (tier) {
    const full = unitAmount * tier.quantity;
    return { full, total: tier.totalAmount, saving: Math.max(0, full - tier.totalAmount) };
  }
  const full = unitAmount * quantity;
  return { full, total: full, saving: 0 };
}

// ---------------------------------------------------------------------------
// Order bump
// ---------------------------------------------------------------------------

export interface OrderBumpOffer {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  priceAmount: number;
  compareAtAmount: number | null;
  /** The cart line this bump adds. */
  variantId: string;
  offerId?: string;
}

/**
 * The cheapest other in-stock product becomes the bump — a real cart line at
 * its real price. Returns null when the store has nothing else to offer.
 */
export function getOrderBump(
  products: StorefrontProduct[],
  excludeProductIds: string[]
): OrderBumpOffer | null {
  const pick = products
    .filter((p) => !excludeProductIds.includes(p.id))
    .map((p) => {
      const variant = p.variants.find((v) => v.inStock);
      return { p, variant, price: priceOf(p) };
    })
    .filter(
      (c): c is { p: StorefrontProduct; variant: NonNullable<typeof c.variant>; price: number } =>
        !!c.variant && c.price !== undefined && c.price > 0
    )
    .sort((a, b) => a.price - b.price)[0];

  if (!pick) return null;

  const offer = defaultOfferOf(pick.p);
  return {
    id: pick.p.id,
    name: pick.p.name,
    description: pick.p.description?.slice(0, 120) ?? "",
    imageUrl: firstImage(pick.p),
    priceAmount: pick.price,
    compareAtAmount: null,
    variantId: pick.variant.id,
    offerId: offer && offerAppliesTo(offer, pick.variant.id) ? offer.id : undefined,
  };
}

// ---------------------------------------------------------------------------
// Post-purchase one-click upsell
// ---------------------------------------------------------------------------

export interface UpsellOffer {
  id: string;
  productSlug: string | null;
  name: string;
  description: string;
  imageUrl: string | null;
  regularAmount: number;
  offerAmount: number;
}

/**
 * 25% off a catalogue product the shopper didn't just buy. Returns null when
 * there is no other in-stock product to offer.
 *
 * Accepting does not modify the placed order — there is no public
 * "append to order" endpoint — so the acceptance is stored on the device,
 * surfaced on the thank-you page, and confirmed on the call.
 */
export function getUpsellOffer(
  products: StorefrontProduct[],
  orderedProductIds: string[]
): UpsellOffer | null {
  const pick = products.find(
    (p) =>
      !orderedProductIds.includes(p.id) &&
      p.variants.some((v) => v.inStock) &&
      (priceOf(p) ?? 0) > 0
  );
  if (!pick) return null;

  const regular = priceOf(pick) ?? 0;
  return {
    id: pick.id,
    productSlug: pick.slug,
    name: pick.name,
    description: pick.description?.slice(0, 180) ?? "",
    imageUrl: firstImage(pick),
    regularAmount: regular,
    offerAmount: Math.round((regular * 0.75) / 100) * 100,
  };
}

export interface AcceptedUpsell {
  name: string;
  offerAmount: number;
  acceptedAt: string;
}

const upsellKey = (workspaceId: string, orderId: string) => `zimos_upsell_${workspaceId}_${orderId}`;

export function acceptUpsell(workspaceId: string, orderId: string, offer: UpsellOffer) {
  const record: AcceptedUpsell = {
    name: offer.name,
    offerAmount: offer.offerAmount,
    acceptedAt: new Date().toISOString(),
  };
  writeJson(upsellKey(workspaceId, orderId), record);
}

export function getAcceptedUpsell(workspaceId: string, orderId: string): AcceptedUpsell | null {
  return readJson<AcceptedUpsell>(upsellKey(workspaceId, orderId));
}

// ---------------------------------------------------------------------------
// Order snapshots (for thank-you + tracking on this device)
//
// A copy of the order the backend returned, kept so the thank-you and tracking
// pages work for a guest who has no account to look the order up against.
// ---------------------------------------------------------------------------

export interface OrderSnapshot {
  id: string;
  orderNumber: string;
  phone: string;
  currency: string;
  createdAt: string;
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
  items: { name: string; options: string; quantity: number; lineTotal: number }[];
  productIds: string[];
}

export function snapshotFromOrder(order: Order, phone: string): OrderSnapshot {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    phone,
    currency: order.currency,
    createdAt: order.createdAt ?? new Date().toISOString(),
    subtotalAmount: parseMoney(order.subtotalAmount),
    discountAmount: parseMoney(order.discountAmount),
    shippingAmount: parseMoney(order.shippingAmount),
    totalAmount: parseMoney(order.totalAmount),
    items: (order.items ?? []).map((item) => ({
      name: item.productNameSnapshot,
      options: Object.values(item.variantOptionsSnapshot ?? {}).filter(Boolean).join(" / "),
      quantity: item.quantity,
      lineTotal: parseMoney(item.lineTotalAmount),
    })),
    productIds: (order.items ?? []).map((i) => i.productId).filter((id): id is string => !!id),
  };
}

const ordersKey = (workspaceId: string) => `zimos_orders_${workspaceId}`;

export function saveOrderSnapshot(workspaceId: string, snapshot: OrderSnapshot) {
  const list = readJson<OrderSnapshot[]>(ordersKey(workspaceId)) ?? [];
  const next = [snapshot, ...list.filter((o) => o.id !== snapshot.id)].slice(0, 20);
  writeJson(ordersKey(workspaceId), next);
}

export function getOrderSnapshot(workspaceId: string, orderId: string): OrderSnapshot | null {
  const list = readJson<OrderSnapshot[]>(ordersKey(workspaceId)) ?? [];
  return list.find((o) => o.id === orderId) ?? null;
}

// ---------------------------------------------------------------------------
// storage helpers
// ---------------------------------------------------------------------------

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage disabled — the flow still works, it just won't be remembered */
  }
}

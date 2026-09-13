import { parseMoney, type Order, type StorefrontProduct } from "@store-builder/api-client";
import { findGovernorate } from "./egypt";
import { getDictionary, type Locale } from "./i18n";
import {
  defaultOfferOf,
  firstImage,
  offerAppliesTo,
  priceOf,
} from "./product";

/**
 * ------------------------------------------------------------------------
 * Client-side stand-ins for commerce features the public storefront API does
 * not expose yet. Everything simulated lives in this one file so it can be
 * swapped for real endpoints without touching the pages. Each simulated piece
 * is marked `// BACKEND:` with what the real API would need to provide.
 *
 * Real today (not in here): store meta, products, collections, pages, cart,
 * and COD checkout (incl. `discountCode` and Buy-Now `item`).
 * ------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Bundles / quantity offers
// ---------------------------------------------------------------------------

export interface BundleTier {
  id: string;
  quantity: number;
  /** Percentage off `quantity × unit`. 0 for the single-piece tier. */
  discountPct: number;
  /** Real merchant offer id when the tier maps to one. */
  offerId?: string;
  /** Fixed total for a real multi-line offer (minor units). */
  totalAmount?: number;
  label?: string;
  badge?: string | null;
  /** true = priced by the backend; false = display-only simulation. */
  real: boolean;
}

/**
 * Real merchant offers win: a product with two or more offers already has
 * backend-priced bundles, so those are shown as-is. Otherwise a standard
 * 1 / 2 (−10%) / 3 (−20%) ladder is simulated.
 */
export function bundleTiers(product: StorefrontProduct): BundleTier[] {
  if (product.offers.length >= 2) {
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
        real: true,
      };
    });
  }

  // BACKEND: quantity-break pricing isn't modelled on the storefront API. These
  // discounts are shown to the shopper and written into the order notes, but the
  // backend prices the order at the normal unit price until tiered offers exist.
  const offer = defaultOfferOf(product);
  return [
    { id: "q1", quantity: 1, discountPct: 0, offerId: offer?.id, real: false },
    { id: "q2", quantity: 2, discountPct: 10, offerId: offer?.id, real: false },
    { id: "q3", quantity: 3, discountPct: 20, offerId: offer?.id, real: false },
  ];
}

/** Best simulated tier for a free-typed quantity (e.g. 5 pieces → 3+ tier). */
export function tierForQuantity(tiers: BundleTier[], quantity: number): BundleTier | undefined {
  return [...tiers]
    .filter((t) => !t.real && t.quantity <= quantity)
    .sort((a, b) => b.quantity - a.quantity)[0];
}

export function bundlePricing(unitAmount: number, quantity: number, tier: BundleTier | undefined) {
  if (tier?.real && tier.totalAmount !== undefined) {
    const full = unitAmount * tier.quantity;
    return { full, total: tier.totalAmount, saving: Math.max(0, full - tier.totalAmount) };
  }
  const full = unitAmount * quantity;
  const pct = tier?.discountPct ?? 0;
  const saving = Math.round((full * pct) / 100);
  return { full, total: full - saving, saving };
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
  /** Set when the bump is a real catalogue product that can go in the cart. */
  variantId: string | null;
  offerId?: string;
  real: boolean;
}

/**
 * The cheapest other in-stock product becomes the bump — a real cart line at its
 * real price. With no other product, a gift-wrap add-on is simulated.
 */
export function getOrderBump(
  products: StorefrontProduct[],
  excludeProductIds: string[],
  locale: Locale
): OrderBumpOffer {
  const t = getDictionary(locale);
  const candidates = products
    .filter((p) => !excludeProductIds.includes(p.id))
    .map((p) => {
      const variant = p.variants.find((v) => v.inStock);
      return { p, variant, price: priceOf(p) };
    })
    .filter(
      (c): c is { p: StorefrontProduct; variant: NonNullable<typeof c.variant>; price: number } =>
        !!c.variant && c.price !== undefined && c.price > 0
    )
    .sort((a, b) => a.price - b.price);

  const pick = candidates[0];
  if (pick) {
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
      real: true,
    };
  }

  // BACKEND: no add-on/bump products are configurable for a store yet. This one
  // is recorded in the order notes only and is not charged by the backend.
  return {
    id: "mock-gift-wrap",
    name: t.bump.giftName,
    description: t.bump.giftDescription,
    imageUrl: null,
    priceAmount: 2500,
    compareAtAmount: 4000,
    variantId: null,
    real: false,
  };
}

// ---------------------------------------------------------------------------
// Shipping estimate
// ---------------------------------------------------------------------------

// BACKEND: shipping zones/rates exist only on the authenticated merchant API.
// A public `GET /store/:id/shipping/quote?province=` would replace this table.
// The real charged amount comes back on the created order (`shippingAmount`).
const ZONE_FEES: Record<string, number> = {
  metro: 5000,
  delta: 6000,
  canal: 6500,
  upper: 7500,
  remote: 9500,
};

export function estimateShipping(governorateCode: string): number | null {
  const g = findGovernorate(governorateCode);
  return g ? ZONE_FEES[g.zone] ?? null : null;
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
  real: boolean;
}

/** 25% off a catalogue product the shopper didn't just buy; generic kit otherwise. */
export function getUpsellOffer(
  products: StorefrontProduct[],
  orderedProductIds: string[],
  locale: Locale
): UpsellOffer {
  const t = getDictionary(locale);
  const pick = products.find(
    (p) => !orderedProductIds.includes(p.id) && p.variants.some((v) => v.inStock) && (priceOf(p) ?? 0) > 0
  );
  // BACKEND: accepting doesn't modify the order — there is no public
  // "append to order" endpoint. The acceptance is stored locally, surfaced on
  // the thank-you page, and should be confirmed on the call.
  if (pick) {
    const regular = priceOf(pick) ?? 0;
    return {
      id: pick.id,
      productSlug: pick.slug,
      name: pick.name,
      description: pick.description?.slice(0, 180) ?? "",
      imageUrl: firstImage(pick),
      regularAmount: regular,
      offerAmount: Math.round((regular * 0.75) / 100) * 100,
      real: true,
    };
  }
  return {
    id: "mock-care-kit",
    productSlug: null,
    name: t.upsell.fallbackName,
    description: t.upsell.fallbackDescription,
    imageUrl: null,
    regularAmount: 12000,
    offerAmount: 7900,
    real: false,
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
  /** Simulated extras shown to the shopper but not charged by the backend. */
  extras: { label: string; amount: number }[];
}

export function snapshotFromOrder(
  order: Order,
  phone: string,
  extras: OrderSnapshot["extras"] = []
): OrderSnapshot {
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
    extras,
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
// Order tracking
// ---------------------------------------------------------------------------

/** 0 placed · 1 confirmation · 2 shipped · 3 delivered */
export type OrderStage = 0 | 1 | 2 | 3;

export interface TrackResult {
  orderNumber: string;
  stage: OrderStage;
  updatedAt: string | null;
}

function stageFromAge(createdAt: string): OrderStage {
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 1) return 0;
  if (hours < 24) return 1;
  if (hours < 96) return 2;
  return 3;
}

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * BACKEND: there is no public order-lookup endpoint. A
 * `GET /store/:id/orders/track?phone=&number=` returning confirmation /
 * fulfillment state would replace this. Until then: orders placed on this
 * device are found and aged into a stage; any other well-formed lookup gets a
 * deterministic simulated stage.
 */
export async function trackOrder(
  workspaceId: string,
  phone: string,
  orderNumber: string
): Promise<TrackResult | null> {
  await new Promise((r) => setTimeout(r, 600));
  const number = orderNumber.replace(/^#/, "").trim();
  if (!number) return null;

  const list = readJson<OrderSnapshot[]>(ordersKey(workspaceId)) ?? [];
  const local = list.find((o) => o.orderNumber === number && o.phone === phone);
  if (local) {
    return { orderNumber: local.orderNumber, stage: stageFromAge(local.createdAt), updatedAt: local.createdAt };
  }
  if (!/^[A-Za-z0-9-]{3,}$/.test(number)) return null;
  const stage = (hash(`${phone}:${number}`) % 3) as OrderStage;
  return { orderNumber: number, stage, updatedAt: null };
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

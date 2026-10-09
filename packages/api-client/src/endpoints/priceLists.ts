/**
 * Wholesale price lists (backend: frontend-handoff item 205, src/modules/priceLists).
 *
 * A list gives lower prices to customers who carry one of its tags (e.g.
 * "wholesale"), and only once they are signed in to the store. A list is
 * either a percent off (every product, or the chosen ones) or fixed prices per
 * variant, each from a quantity upward (tiers). A plain order line gets the
 * lowest of its normal price and every matching list; offer bundles and
 * funnels keep their own prices.
 *
 * Dashboard, /workspaces/:ws/price-lists (read products.view, change products.manage):
 *   GET    /       → { priceLists: PriceList[] }
 *   GET    /:id    → PriceList
 *   POST   /       PriceListPayload → 201 PriceList
 *   PUT    /:id    PriceListPayload → PriceList (a full replace)
 *   DELETE /:id    → 204
 *   422 on `prices` / `productIds` when a variant or product is not the store's.
 *
 * Storefront:
 *   GET /store/:ws/price-list?variantIds=a,b,c (≤ 100, X-Shopper-Token) → ShopperPriceList —
 *   only the variants this shopper pays less for; empty when signed out or not tagged.
 *   The cart (/store/:ws/cart…) and the checkout price their lines with the same header.
 *
 * Money is integer minor units (sent back as strings).
 */
import type { ApiClient } from "../client";
import { apiFieldProblems } from "../errors";

export type PriceListKind = "percent" | "fixed";

/** One fixed price: what a unit of the variant costs from `minQuantity` units upward. */
export interface PriceListPrice {
  variantId: string;
  minQuantity: number;
  /** Minor units, as a string. */
  priceAmount: string;
}

export interface PriceList {
  id: string;
  name: string;
  /** Lower-case; matched to the customer's own tags. */
  customerTags: string[];
  kind: PriceListKind;
  /** 1–90 on a percent list, null on a fixed one. */
  percent: number | null;
  /** The products a percent list covers; null for every product. */
  productIds: string[] | null;
  isActive: boolean;
  /** A fixed list's prices, by variant then quantity; [] on a percent list. */
  prices: PriceListPrice[];
  createdAt: string;
  updatedAt: string;
}

/** The API refuses the other kind's keys, so each kind sends only its own. */
export type PriceListPayload =
  | {
      name: string;
      customerTags: string[];
      kind: "percent";
      percent: number;
      /** null or [] = every product. */
      productIds?: string[] | null;
      isActive?: boolean;
    }
  | {
      name: string;
      customerTags: string[];
      kind: "fixed";
      prices: Array<{ variantId: string; minQuantity: number; priceAmount: number }>;
      isActive?: boolean;
    };

/** The API's limits, for the form's own checks. */
export const PRICE_LIST_LIMITS = {
  nameMax: 120,
  tagsMax: 20,
  tagMax: 60,
  percentMin: 1,
  percentMax: 90,
  productsMax: 500,
  pricesMax: 2000,
  quantityMax: 100_000,
} as const;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/price-lists`;

export async function priceListsList(client: ApiClient, workspaceId: string): Promise<PriceList[]> {
  const { priceLists } = await client.request<{ priceLists: PriceList[] }>(base(workspaceId));
  return priceLists;
}

export function priceListGet(client: ApiClient, workspaceId: string, priceListId: string): Promise<PriceList> {
  return client.request<PriceList>(`${base(workspaceId)}/${priceListId}`);
}

export function priceListCreate(client: ApiClient, workspaceId: string, body: PriceListPayload): Promise<PriceList> {
  return client.request<PriceList>(base(workspaceId), { method: "POST", body });
}

/** Replaces the whole list: its tags, its kind and every price. */
export function priceListUpdate(client: ApiClient, workspaceId: string, priceListId: string, body: PriceListPayload): Promise<PriceList> {
  return client.request<PriceList>(`${base(workspaceId)}/${priceListId}`, { method: "PUT", body });
}

export function priceListDelete(client: ApiClient, workspaceId: string, priceListId: string): Promise<void> {
  return client.request<void>(`${base(workspaceId)}/${priceListId}`, { method: "DELETE" });
}

/** What a list sends back to the API unchanged but for the given keys (switching it on or off). */
export function priceListPayloadOf(list: PriceList, patch: { isActive?: boolean } = {}): PriceListPayload {
  const common = { name: list.name, customerTags: list.customerTags, isActive: patch.isActive ?? list.isActive };
  return list.kind === "percent"
    ? { ...common, kind: "percent", percent: list.percent ?? PRICE_LIST_LIMITS.percentMin, productIds: list.productIds }
    : {
        ...common,
        kind: "fixed",
        prices: list.prices.map((p) => ({ variantId: p.variantId, minQuantity: p.minQuantity, priceAmount: Number(p.priceAmount) })),
      };
}

/**
 * Why a save was refused, when it was about the catalogue: a variant among the
 * fixed prices, or a product among the chosen ones, is no longer the store's.
 */
export type PriceListProblem = "variant_not_in_store" | "product_not_in_store";

export function priceListProblemOf(err: unknown): PriceListProblem | null {
  for (const problem of apiFieldProblems(err)) {
    if (problem.field === "prices" && /not in this store/i.test(problem.message)) return "variant_not_in_store";
    if (problem.field === "productIds" && /not in this store/i.test(problem.message)) return "product_not_in_store";
  }
  return null;
}

/** Whether a customer with these tags gets this list (the API's own test: active, and a tag in common, case aside). */
export function priceListAppliesTo(list: Pick<PriceList, "customerTags" | "isActive">, tags: readonly string[]): boolean {
  if (!list.isActive) return false;
  const mine = new Set(tags.map((tag) => tag.trim().toLowerCase()));
  return list.customerTags.some((tag) => mine.has(tag.trim().toLowerCase()));
}

// ----------------------------------------------------------- storefront --

/** A unit's price from `minQuantity` units upward (minor units, as a string). */
export interface ShopperPriceTier {
  minQuantity: number;
  priceAmount: string;
}

export interface ShopperVariantPrice {
  variantId: string;
  /** What everyone else pays for a unit (minor units, as a string). */
  basePrice: string;
  /** Only the quantities this shopper pays less from, smallest first. */
  tiers: ShopperPriceTier[];
}

export interface ShopperPriceList {
  /** The name(s) of the shopper's lists ("Wholesale", "Wholesale, VIP"); null when they have none. */
  priceList: string | null;
  /** Only the variants with a lower price for this shopper. */
  prices: ShopperVariantPrice[];
}

/** The most variants one request may ask about. */
export const SHOPPER_PRICE_LIST_MAX_VARIANTS = 100;

/** The signed-in shopper's own prices for these variants. */
export function shopperPriceList(client: ApiClient, workspaceRef: string, token: string, variantIds: readonly string[]): Promise<ShopperPriceList> {
  const ids = [...new Set(variantIds)].slice(0, SHOPPER_PRICE_LIST_MAX_VARIANTS).join(",");
  return client.request<ShopperPriceList>(`/store/${workspaceRef}/price-list?variantIds=${encodeURIComponent(ids)}`, {
    auth: false,
    headers: { "X-Shopper-Token": token },
  });
}

/** The tier a line of `quantity` units is priced by — the one with the largest `minQuantity` it reaches — or null. */
export function shopperTierFor(price: Pick<ShopperVariantPrice, "tiers"> | null | undefined, quantity: number): ShopperPriceTier | null {
  let best: ShopperPriceTier | null = null;
  for (const tier of price?.tiers ?? []) {
    if (tier.minQuantity <= quantity && (!best || tier.minQuantity > best.minQuantity)) best = tier;
  }
  return best;
}

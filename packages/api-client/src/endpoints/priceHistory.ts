/**
 * Price history and the honest "lowest price in the last 30 days" (backend: frontend-handoff
 * item 234, src/modules/priceHistory).
 *
 * Every change of a variant's price or compare-at price is recorded, whatever made it (the
 * editor, a bulk edit, a scheduled sale).
 *
 * Dashboard (products.view): GET /workspaces/:ws/price-history/variants/:variantId?days=180
 *   → VariantPriceHistory — `changes` oldest first, 1–730 days back.
 * Storefront (public): GET /store/:ws/lowest-prices?variantIds=a,b (≤ 50; bad ids → 422)
 *   → StorefrontLowestPrices — per variant, the lowest price it really had in the last 30 days
 *   (the price in force when the window opened counts, and so does today's). Cached 5 minutes.
 *
 * Every amount is integer minor units, sent as a string.
 */
import type { ApiClient } from "../client";

export interface PriceHistoryChange {
  priceAmount: string;
  compareAtAmount: string | null;
  changedAt: string;
}

export interface VariantPriceHistory {
  current: { priceAmount: string; compareAtAmount: string | null; currency: string };
  /** The lowest price of the last 30 days. */
  lowest30Days: string | null;
  /** Oldest first. */
  changes: PriceHistoryChange[];
}

/** How far back the dashboard reads by default, and the most the API allows. */
export const PRICE_HISTORY_DAYS = { default: 180, max: 730 } as const;

export function variantPriceHistory(
  client: ApiClient,
  workspaceId: string,
  variantId: string,
  days: number = PRICE_HISTORY_DAYS.default
): Promise<VariantPriceHistory> {
  return client.request<VariantPriceHistory>(`/workspaces/${workspaceId}/price-history/variants/${variantId}?days=${days}`);
}

// ----------------------------------------------------------- storefront --

export interface StorefrontLowestPrices {
  /** The window, in days (30). */
  days: number;
  /** variant id → its lowest price in the window, minor units. */
  prices: Record<string, string>;
}

/** The most variant ids one call takes. */
export const LOWEST_PRICES_MAX_IDS = 50;

export function storefrontLowestPrices(client: ApiClient, workspaceRef: string, variantIds: string[]): Promise<StorefrontLowestPrices> {
  const ids = [...new Set(variantIds)].slice(0, LOWEST_PRICES_MAX_IDS);
  return client.request<StorefrontLowestPrices>(`/store/${workspaceRef}/lowest-prices?variantIds=${ids.join(",")}`, { auth: false });
}

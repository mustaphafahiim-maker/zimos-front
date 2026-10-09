/**
 * Frequently bought together (backend: frontend-handoff item 223, src/modules/boughtTogether).
 *
 * The cross-sell strip (endpoints/offers.ts `storefrontCrossSell`) shows the merchant's rule when
 * one matches — their pins — else this computed list: products found in the same real orders.
 * The pairs are worked out nightly, and right after a settings save. New here: the settings, and
 * what one product is bought with. The strip's placement "product" (the product page) lives with
 * the other placements in endpoints/offers.ts.
 *
 * Dashboard, /workspaces/:ws/bought-together (read products.view, change products.manage):
 *   GET  /                     → BoughtTogetherState
 *   PUT  /  BoughtTogetherSettings → the settings + `pairs` (recomputed at once);
 *        422 on `excludedProductIds` for a product of another store.
 *   POST /recompute            → { pairs }
 *   GET  /products/:productId  → { products: BoughtWithProduct[] } — most orders first
 */
import type { ApiClient } from "../client";

export interface BoughtTogetherSettings {
  /** Off: the computed list is not shown (the merchant's own rules still are). */
  enabled: boolean;
  /** How far back orders are read, 30–1095 days. */
  windowDays: number;
  /** Two products are a pair from this many shared orders, 1–100. */
  minOrders: number;
  /** Never suggested by the computed list (≤ 500). */
  excludedProductIds: string[];
}

export interface BoughtTogetherState extends BoughtTogetherSettings {
  /** How many pairs the last run kept. */
  pairs: number;
  /** When they were last worked out; null before the first run. */
  computedAt: string | null;
}

export interface BoughtWithProduct {
  productId: string;
  name: string;
  /** Orders that had both products. */
  orders: number;
  /** In the store's "don't suggest" list. */
  excluded: boolean;
}

export const BOUGHT_TOGETHER_LIMITS = { windowDaysMin: 30, windowDaysMax: 1095, minOrdersMin: 1, minOrdersMax: 100, excluded: 500 } as const;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/bought-together`;

export function boughtTogetherGet(client: ApiClient, workspaceId: string): Promise<BoughtTogetherState> {
  return client.request<BoughtTogetherState>(base(workspaceId));
}

/** Saves the settings; the pairs are worked out again at once. */
export function boughtTogetherSave(
  client: ApiClient,
  workspaceId: string,
  body: BoughtTogetherSettings
): Promise<BoughtTogetherSettings & { pairs: number }> {
  return client.request<BoughtTogetherSettings & { pairs: number }>(base(workspaceId), { method: "PUT", body });
}

export function boughtTogetherRecompute(client: ApiClient, workspaceId: string): Promise<{ pairs: number }> {
  return client.request<{ pairs: number }>(`${base(workspaceId)}/recompute`, { method: "POST" });
}

/** What a product is bought with, and in how many orders. */
export async function boughtTogetherForProduct(client: ApiClient, workspaceId: string, productId: string): Promise<BoughtWithProduct[]> {
  return (await client.request<{ products: BoughtWithProduct[] }>(`${base(workspaceId)}/products/${productId}`)).products;
}

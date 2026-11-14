import type { ApiClient } from "../client";
import type { ProductMedia, ShippingQuote, ShippingQuotePayload } from "../types";

/**
 * A/B tests on a product page (catalog/productTests.js). Variant "A" is the
 * product as it is; another variant changes some variant prices (minor units)
 * and/or the pictures. The server pins each visitor to a variant and charges
 * them its price — the cart, the shipping quote and the order agree.
 *
 * Staff: /workspaces/:id/product-tests (products.view to read, products.manage to change).
 * Shopper: GET /store/:id/products/:productId/test with X-Visitor-Id.
 */

export type ProductTestStatus = "running" | "paused" | "completed";
export type ProductTestMetric = "conversion_rate" | "revenue_per_visit";

export interface ProductTestVariant {
  key: string;
  name: string;
  weight: number;
  /** variantId → price in minor units; {} on the control. */
  prices: Record<string, number>;
  /** The pictures to show instead of the product's; null = the product's own. */
  media: ProductMedia[] | null;
}

export interface ProductTestAutoWinner {
  enabled: boolean;
  afterVisits: number;
  metric: ProductTestMetric;
}

export interface ProductTest {
  id: string;
  productId: string;
  name: string;
  status: ProductTestStatus;
  autoWinner: ProductTestAutoWinner;
  winnerVariantKey: string | null;
  variants: ProductTestVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductTestVariantResult {
  key: string;
  name: string;
  weight: number;
  visits: number;
  orders: number;
  /** Basis points: 100 = 1%. */
  conversionRateBp: number;
  revenueAmount: string;
  revenuePerVisitAmount: string;
}

export interface ProductTestResults {
  totalVisits: number;
  variants: ProductTestVariantResult[];
  leaderKey: string | null;
  /** 0.5–1, how sure the leader really is better; null with too little data. */
  confidence: number | null;
}

export interface ProductTestVariantInput {
  key: string;
  name?: string;
  weight: number;
  prices?: Record<string, number>;
  media?: ProductMedia[] | null;
}

export async function productTestsList(client: ApiClient, workspaceId: string, productId?: string): Promise<ProductTest[]> {
  const query = productId ? `?productId=${encodeURIComponent(productId)}` : "";
  return (await client.request<{ tests: ProductTest[] }>(`/workspaces/${workspaceId}/product-tests${query}`)).tests;
}

export async function productTestGet(
  client: ApiClient,
  workspaceId: string,
  testId: string
): Promise<{ test: ProductTest; results: ProductTestResults }> {
  return client.request<{ test: ProductTest; results: ProductTestResults }>(`/workspaces/${workspaceId}/product-tests/${testId}`);
}

export async function productTestCreate(
  client: ApiClient,
  workspaceId: string,
  body: { productId: string; name: string; variants: ProductTestVariantInput[]; autoWinner?: ProductTestAutoWinner | null }
): Promise<ProductTest> {
  return (await client.request<{ test: ProductTest }>(`/workspaces/${workspaceId}/product-tests`, { method: "POST", body })).test;
}

export async function productTestUpdate(
  client: ApiClient,
  workspaceId: string,
  testId: string,
  body: { name?: string; variants?: ProductTestVariantInput[]; autoWinner?: ProductTestAutoWinner | null; status?: "running" | "paused" }
): Promise<ProductTest> {
  return (await client.request<{ test: ProductTest }>(`/workspaces/${workspaceId}/product-tests/${testId}`, { method: "PATCH", body })).test;
}

/** Finishes the test: the winner's prices and pictures become the product's own. */
export async function productTestChooseWinner(client: ApiClient, workspaceId: string, testId: string, variantKey: string): Promise<ProductTest> {
  return (
    await client.request<{ test: ProductTest }>(`/workspaces/${workspaceId}/product-tests/${testId}/winner`, {
      method: "POST",
      body: { variantKey },
    })
  ).test;
}

export async function productTestDelete(client: ApiClient, workspaceId: string, testId: string): Promise<void> {
  await client.request(`/workspaces/${workspaceId}/product-tests/${testId}`, { method: "DELETE" });
}

// --- shopper -----------------------------------------------------------------

/** What this visitor sees on the product page; null when the product has no running test. */
export interface StorefrontProductTest {
  id: string;
  variantKey: string;
  prices: Record<string, number>;
  media: ProductMedia[] | null;
}

export async function storefrontProductTest(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  visitorId: string
): Promise<StorefrontProductTest | null> {
  const { test } = await client.request<{ test: StorefrontProductTest | null }>(`/store/${workspaceId}/products/${productId}/test`, {
    auth: false,
    headers: { "X-Visitor-Id": visitorId },
  });
  return test;
}

/** Whether the store says this product has a running test (the public product's `abTest`). */
export function storefrontProductHasTest(product: unknown): boolean {
  return (product as { abTest?: unknown } | null)?.abTest === true;
}

/** The shipping quote for this visitor: a product test's price counts, as the order will charge it. */
export async function storefrontShippingQuoteFor(
  client: ApiClient,
  workspaceId: string,
  payload: ShippingQuotePayload,
  opts: { cartToken?: string; visitorId?: string } = {}
): Promise<ShippingQuote> {
  const headers: Record<string, string> = {};
  if (opts.cartToken) headers["X-Cart-Token"] = opts.cartToken;
  if (opts.visitorId) headers["X-Visitor-Id"] = opts.visitorId;
  const { quote } = await client.request<{ quote: ShippingQuote }>(`/store/${workspaceId}/shipping-quote`, {
    method: "POST",
    body: payload,
    auth: false,
    headers,
  });
  return quote;
}

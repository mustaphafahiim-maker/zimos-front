/**
 * Size charts (backend: src/modules/sizeCharts).
 *
 * A chart is a table: column headings in Arabic and/or English, rows of text
 * cells ("S", "38–40" and "96" all fit), the unit its numbers are in, an
 * optional note and "how to measure" picture. It is attached to products
 * and/or collections.
 *
 * Staff (read products.view, change products.manage), /workspaces/:ws/size-charts:
 *   GET    /            → { sizeCharts: SizeChart[] } (by name)
 *   GET    /:id         → SizeChart
 *   POST   /            SizeChartPayload → 201 SizeChart
 *   PUT    /:id         SizeChartPayload (the whole chart) → SizeChart
 *   DELETE /:id         → 204
 *   422 VALIDATION_ERROR on `rows` (a row without one cell per column), on
 *   `productIds` / `collectionIds` (not this store's).
 *
 * Storefront (public, cached 5 minutes):
 *   GET /store/:ws/size-chart?productId= → { sizeChart: StorefrontSizeChart | null }
 *   The chart attached to the product wins; else the newest one on one of its collections.
 */
import type { ApiClient } from "../client";

export type SizeChartUnit = "cm" | "inch";

/** A heading or a note in the store's two languages; either may be missing or "". */
export interface SizeChartText {
  ar?: string;
  en?: string;
}

export interface SizeChart {
  id: string;
  name: string;
  /** The unit the numbers were typed in; the storefront converts for the shopper. */
  unit: SizeChartUnit;
  columns: SizeChartText[];
  /** One row per size, one cell per column. */
  rows: string[][];
  note: SizeChartText | null;
  /** https only. */
  imageUrl: string | null;
  productIds: string[];
  collectionIds: string[];
  updatedAt: string;
}

export interface SizeChartPayload {
  name: string;
  unit: SizeChartUnit;
  columns: SizeChartText[];
  rows: string[][];
  note: SizeChartText | null;
  imageUrl: string | null;
  productIds: string[];
  collectionIds: string[];
}

/** What the API accepts (sizeCharts/index.js). */
export const SIZE_CHART_LIMITS = {
  name: 120,
  columns: 12,
  rows: 40,
  heading: 60,
  cell: 40,
  note: 500,
  products: 500,
  collections: 100,
} as const;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/size-charts`;

export async function sizeChartsList(client: ApiClient, workspaceId: string): Promise<SizeChart[]> {
  const { sizeCharts } = await client.request<{ sizeCharts: SizeChart[] }>(base(workspaceId));
  return sizeCharts;
}

export function sizeChartGet(client: ApiClient, workspaceId: string, chartId: string): Promise<SizeChart> {
  return client.request<SizeChart>(`${base(workspaceId)}/${chartId}`);
}

export function sizeChartCreate(client: ApiClient, workspaceId: string, body: SizeChartPayload): Promise<SizeChart> {
  return client.request<SizeChart>(base(workspaceId), { method: "POST", body });
}

export function sizeChartUpdate(client: ApiClient, workspaceId: string, chartId: string, body: SizeChartPayload): Promise<SizeChart> {
  return client.request<SizeChart>(`${base(workspaceId)}/${chartId}`, { method: "PUT", body });
}

export async function sizeChartDelete(client: ApiClient, workspaceId: string, chartId: string): Promise<void> {
  await client.request<unknown>(`${base(workspaceId)}/${chartId}`, { method: "DELETE" });
}

/**
 * The chart a product gets, worked out the way the storefront's endpoint does:
 * one attached to the product itself, else one on a collection the product is
 * in — the most recently changed in each case. `collectionId` names the
 * collection it came through.
 */
export function sizeChartForProduct(
  charts: readonly SizeChart[],
  productId: string,
  collectionIds: readonly string[]
): { chart: SizeChart; via: "product" } | { chart: SizeChart; via: "collection"; collectionId: string } | null {
  const newest = (list: SizeChart[]) => list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const own = newest(charts.filter((c) => c.productIds.includes(productId)));
  if (own) return { chart: own, via: "product" };
  const inherited = newest(charts.filter((c) => c.collectionIds.some((id) => collectionIds.includes(id))));
  if (!inherited) return null;
  return { chart: inherited, via: "collection", collectionId: inherited.collectionIds.find((id) => collectionIds.includes(id))! };
}

// ----------------------------------------------------------- storefront --

/** What a shopper gets of a chart: never what it is attached to. */
export type StorefrontSizeChart = Pick<SizeChart, "id" | "name" | "unit" | "columns" | "rows" | "note" | "imageUrl">;

/** The product's size chart, or null when it has none. `workspaceRef` is the store's id or slug. */
export async function storefrontSizeChart(
  client: ApiClient,
  workspaceRef: string,
  productId: string,
  init: { signal?: AbortSignal } = {}
): Promise<StorefrontSizeChart | null> {
  const { sizeChart } = await client.request<{ sizeChart: StorefrontSizeChart | null }>(
    `/store/${workspaceRef}/size-chart?productId=${encodeURIComponent(productId)}`,
    { auth: false, ...(init.signal ? { signal: init.signal } : {}) }
  );
  return sizeChart;
}

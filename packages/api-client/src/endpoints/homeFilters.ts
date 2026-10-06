/**
 * The dashboard home's product and store filters (backend: frontend-handoff
 * item 172, on the existing overview endpoint).
 *
 *   GET /workspaces/:ws/analytics/overview?productId=&websiteId=   analytics.view
 *
 * `productId` keeps only orders with a line of that product (visits, carts
 * and checkouts can't be split by product, so they stay the whole store's:
 * `eventScope: "store"`); `websiteId` keeps one website's orders and visits
 * (`eventScope: "filtered"`). Combinable with funnelId, from/to, compare,
 * currency. With any filter, net profit is the quick estimate.
 */
import type { ApiClient } from "../client";
import { insightsQuery, type InsightsOverview, type InsightsOverviewParams } from "./insights";

export interface HomeOverviewParams extends InsightsOverviewParams {
  productId?: string;
  websiteId?: string;
}

export type HomeOverview = InsightsOverview & {
  productId?: string | null;
  websiteId?: string | null;
  /** "store": visit-based numbers are the whole store's; "filtered": everything follows the filter. */
  eventScope?: "store" | "filtered";
};

export async function homeGetOverview(
  client: ApiClient,
  workspaceId: string,
  params: HomeOverviewParams = {}
): Promise<HomeOverview> {
  const { overview } = await client.request<{ overview: HomeOverview }>(
    `/workspaces/${workspaceId}/analytics/overview${insightsQuery(params)}`
  );
  return overview;
}

import type { ApiClient } from "../client";

/** One offer's numbers over the period (offers/offerStats.js). `revenue` null: not measurable (cross-sell). */
export interface OfferStat {
  impressions: number;
  accepted: number;
  /** Minor units of the store's currency. */
  revenue: number | null;
}

export interface OfferStats {
  days: number;
  /** Keyed by order-bump rule id. */
  bumps: Record<string, OfferStat>;
  /** Keyed by post-purchase upsell rule id. */
  upsells: Record<string, OfferStat>;
  /** Keyed by bundle id. */
  bundles: Record<string, OfferStat>;
  /** Keyed by cross-sell rule id. */
  crossSell: Record<string, OfferStat>;
  exitDownsell: OfferStat;
}

/** GET /offers/stats — each offer's impressions, acceptances and added revenue. */
export async function offersStatsGet(client: ApiClient, workspaceId: string, days = 30): Promise<OfferStats> {
  const { stats } = await client.request<{ stats: OfferStats }>(`/workspaces/${workspaceId}/offers/stats?days=${days}`);
  return stats;
}

import {
  adsConnectionsList,
  insightsGetAttribution,
  profitGetCampaigns,
  profitGetPnl,
  type AdsConnection,
  type InsightsAttribution,
  type InsightsAttributionGroup,
  type ProfitCampaign,
  type ProfitCampaigns,
  type ProfitPnl,
  type ProfitRow,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";

/**
 * The data of the «الإعلانات» tab: its requests, the one row shape its table
 * shows in every view, the join that gives a campaign its net profit, and the
 * rules behind the tab's one sentence.
 *
 * Range: the hub's ONE range. `from` / `to` (ISO instants, `to` exclusive) go
 * as they are to the campaigns report, the P&L and attribution — the three
 * resolve the same window on the server, so their figures can sit in one row.
 * None of them has a comparison: the tab shows no change chip anywhere.
 */

/** The instants of the hub's range, as every ads request takes them. */
export interface RangeWindow {
  from: string;
  to: string;
}

/** A 403 is "this part is not for this role": it becomes null. Any other failure is thrown on. */
export async function orDenied<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (isPermissionError(error)) return null;
    throw error;
  }
}

// ------------------------------------------------------------------ main --

export interface AdsMain {
  /** Spend per campaign against its real orders. Null: campaign spend is not for this role. */
  report: ProfitCampaigns | null;
  /** The store's ad-account connections. Null: could not be read (it only words a link and the empty state). */
  connections: AdsConnection[] | null;
}

/**
 * The tab's main request: the campaigns report (financial_reports.view), with
 * the connection state beside it. A 403 on the report is not an error here —
 * a role that reads analytics but not money still gets the order sources.
 */
export async function loadAdsMain(workspaceId: string, range: RangeWindow): Promise<AdsMain> {
  const [report, connections] = await Promise.all([
    orDenied(profitGetCampaigns(apiClient, workspaceId, { from: range.from, to: range.to })),
    // Never fails the tab: "unknown" words the link in neutral terms.
    adsConnectionsList(apiClient, workspaceId).catch(() => null),
  ]);
  return { report, connections };
}

/** The P&L grouped by campaign: net profit per campaign. Null when the role may not read it. */
export function loadCampaignPnl(workspaceId: string, range: RangeWindow): Promise<ProfitPnl | null> {
  return orDenied(profitGetPnl(apiClient, workspaceId, { from: range.from, to: range.to, groupBy: "campaign" }));
}

// ------------------------------------------------------------ connection --

export interface AdsConnectionState {
  /** False when the connections could not be read. */
  known: boolean;
  /** An ad platform is connected and working. */
  connected: boolean;
  /** Ad accounts the merchant picked to follow, over the working connections. */
  followed: number;
  /** A connection says "error" (keys refused, platform unreachable). */
  problem: boolean;
}

export function connectionState(connections: AdsConnection[] | null): AdsConnectionState {
  if (!connections) return { known: false, connected: false, followed: 0, problem: false };
  const live = connections.filter((connection) => connection.status === "connected");
  return {
    known: true,
    connected: live.length > 0,
    followed: live.reduce((count, connection) => count + connection.accounts.filter((account) => account.selected).length, 0),
    problem: connections.some((connection) => connection.status === "error"),
  };
}

// ----------------------------------------------------------- attribution --

/** What the table breaks down by: the campaigns that have spend, or one of the UTM values of the orders' links. */
export type AdsTableMode = "ads" | InsightsAttributionGroup;
export type AdsTouch = "last" | "first";

/** Narrowing the UTM views to one source and / or one link campaign (tap a row to set, a chip to clear). */
export interface AdsFilters {
  source: string;
  campaign: string;
}

export const NO_FILTERS: AdsFilters = { source: "", campaign: "" };

export interface AttributionChoice {
  groupBy: InsightsAttributionGroup;
  touch: AdsTouch;
  /** "" = the whole store. */
  funnelId: string;
  filters: AdsFilters;
}

/** Orders by source, last touch, whole store, unfiltered: the view the tab opens the UTM table on. */
export const DEFAULT_ATTRIBUTION: AttributionChoice = { groupBy: "source", touch: "last", funnelId: "", filters: NO_FILTERS };

export function loadAttribution(workspaceId: string, range: RangeWindow, choice: AttributionChoice): Promise<InsightsAttribution> {
  return insightsGetAttribution(apiClient, workspaceId, {
    from: range.from,
    to: range.to,
    groupBy: choice.groupBy,
    touch: choice.touch,
    funnelId: choice.funnelId || undefined,
    utm_source: choice.filters.source || undefined,
    utm_campaign: choice.filters.campaign || undefined,
  });
}

/** Names one attribution request for `useTabData`'s `extra`, so the same view asked twice is found in the cache. */
export function attributionKey(choice: AttributionChoice): string {
  return JSON.stringify([choice.groupBy, choice.touch, choice.funnelId, choice.filters.source, choice.filters.campaign]);
}

// ------------------------------------------------------------------ rows --

/**
 * One row of the tab's table, whatever it is broken down by. A figure a view
 * does not have is null and its column is left out of that view.
 */
export interface AdsRow {
  id: string;
  /** The campaign's name, or the UTM value ("" = the order's link carried none). */
  name: string;
  /** The ad platform of a campaign with spend. */
  platform: string | null;
  visitors: number | null;
  orders: number;
  confirmed: number | null;
  delivered: number;
  returned: number | null;
  /** Sales of the orders that were not cancelled. */
  sales: number | null;
  deliveredSales: number;
  /** Orders ÷ visitors, a percentage. */
  conversionRate: number | null;
  averageOrderValue: number | null;
  spend: number | null;
  /** Spend ÷ delivered orders. */
  costPerDelivered: number | null;
  /** Delivered sales ÷ spend. */
  roas: number | null;
  /** Net profit from the P&L (finished orders only). Null: not readable for this row. */
  profit: number | null;
}

/** The server keys a campaign's spend by its name, trimmed and lower-cased; orders by the campaign in their link, lower-cased. */
export const campaignKey = (name: string) => name.trim().toLowerCase();

export const campaignRowId = (campaign: Pick<ProfitCampaign, "platform" | "campaignName">) => `${campaign.platform}:${campaign.campaignName}`;

/**
 * NET PROFIT PER CAMPAIGN — "when readable".
 *
 * Spend per campaign comes from the campaigns report, profit from the P&L
 * grouped by campaign: two endpoints that do not match orders to a campaign
 * the same way. The report also finds a campaign's orders by its platform id
 * or by an ad's id; the P&L only by the name in the order's link, and it adds
 * up the spend of same-named campaigns on different platforms.
 *
 * So a campaign gets a profit figure only when the P&L row under its name is
 * provably about the same thing:
 *   1. one platform only uses that name in the range;
 *   2. the P&L has a row under that name;
 *   3. that row carries the same spend, and the same number of delivered and of
 *      returned orders, as the campaign's row in the report.
 * Anything else leaves the cell empty (never "minus the whole spend" for a
 * campaign whose orders the P&L filed under another name).
 */
export function profitByCampaign(campaigns: readonly ProfitCampaign[], pnl: ProfitPnl | null | undefined): Map<string, number> {
  const profit = new Map<string, number>();
  if (!pnl || pnl.groupBy !== "campaign") return profit;

  const uses = new Map<string, number>();
  for (const campaign of campaigns) {
    const key = campaignKey(campaign.campaignName);
    uses.set(key, (uses.get(key) ?? 0) + 1);
  }
  const rows = new Map<string, ProfitRow>();
  for (const row of pnl.rows) {
    if (row.key) rows.set(row.key, row);
  }

  for (const campaign of campaigns) {
    const key = campaignKey(campaign.campaignName);
    if (uses.get(key) !== 1) continue;
    const row = rows.get(key);
    if (!row) continue;
    const sameSpend = row.actual.adSpend === campaign.spendAmount;
    const sameOrders = Math.round(row.orders.delivered) === campaign.delivered && Math.round(row.orders.returned) === campaign.returned;
    if (sameSpend && sameOrders) profit.set(campaignRowId(campaign), row.actual.netProfit);
  }
  return profit;
}

export function campaignRows(report: ProfitCampaigns, profit: ReadonlyMap<string, number>): AdsRow[] {
  return report.campaigns.map((campaign) => {
    const id = campaignRowId(campaign);
    return {
      id,
      name: campaign.campaignName,
      platform: campaign.platform,
      visitors: null,
      orders: campaign.orders,
      confirmed: campaign.confirmed,
      delivered: campaign.delivered,
      returned: campaign.returned,
      sales: campaign.salesAmount,
      deliveredSales: campaign.deliveredSalesAmount,
      conversionRate: null,
      averageOrderValue: null,
      spend: campaign.spendAmount,
      costPerDelivered: campaign.realCpa,
      roas: campaign.realRoas,
      profit: profit.get(id) ?? null,
    };
  });
}

export function attributionRows(data: InsightsAttribution): AdsRow[] {
  return data.rows.map((row) => ({
    id: row.key || "__none",
    name: row.key,
    platform: null,
    visitors: row.visitors,
    orders: row.orders,
    // The attribution report counts confirmed cash-on-delivery orders only; the table does not show it.
    confirmed: null,
    delivered: row.delivered,
    returned: null,
    sales: row.sales,
    deliveredSales: row.deliveredSales,
    conversionRate: row.conversionRate,
    averageOrderValue: row.averageOrderValue,
    spend: row.spend,
    costPerDelivered: row.costPerDelivered,
    roas: row.roas,
    profit: null,
  }));
}

// ---------------------------------------------------------- the sentence --

/**
 * THE SENTENCE of the tab — the rule.
 *
 * Every figure is the campaigns report's; net profit is the P&L's, where it
 * could be joined (`profitByCampaign`).
 *
 * A campaign is JUDGED once MIN_FINISHED (5) of its orders have finished —
 * delivered or returned — and it has spend. Before that its delivered sales
 * say nothing: its orders are still on the road.
 *
 *  1. No campaign is judged yet → "too early to judge". The exception: money
 *     was spent and not ONE order is recorded under any campaign → the ad
 *     links are the problem, and the sentence says that.
 *  2. The winner. When net profit is readable for EVERY judged campaign: the
 *     one with the highest net profit, if above zero. Otherwise: the one with
 *     the highest return on spend, if its delivered sales at least cover what
 *     was spent on it (return ≥ 1).
 *  3. The one that brings refused orders: the judged campaign, other than the
 *     winner, with the largest share of finished orders that came back — when
 *     that share is RETURNS_BAD (3 of every 10) or more.
 *  4. No winner → the loser: on profit, the campaign that lost the most; on
 *     return, the biggest spender among those whose delivered sales do not
 *     cover their spend.
 *  5. None of these → "no campaign clearly makes or loses money".
 */
export const MIN_FINISHED = 5;
export const RETURNS_BAD = 0.3;

export type AdsVerdict =
  | { kind: "thin" }
  | { kind: "noOrders"; spend: number }
  | { kind: "winner"; by: "profit" | "roas"; row: AdsRow; returns: { row: AdsRow; share: number } | null }
  | { kind: "loser"; by: "profit" | "roas"; row: AdsRow }
  | { kind: "returns"; row: AdsRow; share: number }
  | { kind: "even" };

const finishedOf = (row: AdsRow) => row.delivered + (row.returned ?? 0);
const returnShare = (row: AdsRow) => (finishedOf(row) > 0 ? (row.returned ?? 0) / finishedOf(row) : 0);

function best<T>(items: readonly T[], score: (item: T) => number): T | null {
  let top: T | null = null;
  let topScore = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    const value = score(item);
    if (value > topScore) {
      top = item;
      topScore = value;
    }
  }
  return top;
}

export function judgeCampaigns(rows: readonly AdsRow[], totals: { spendAmount: number; orders: number }): AdsVerdict {
  const judged = rows.filter((row) => (row.spend ?? 0) > 0 && finishedOf(row) >= MIN_FINISHED);
  if (judged.length === 0) {
    if (totals.spendAmount > 0 && totals.orders === 0) return { kind: "noOrders", spend: totals.spendAmount };
    return { kind: "thin" };
  }

  const by: "profit" | "roas" = judged.every((row) => row.profit !== null) ? "profit" : "roas";
  let winner: AdsRow | null = null;
  let loser: AdsRow | null = null;
  if (by === "profit") {
    const top = best(judged, (row) => row.profit ?? 0);
    if (top && (top.profit ?? 0) > 0) winner = top;
    const bottom = best(judged, (row) => -(row.profit ?? 0));
    if (bottom && (bottom.profit ?? 0) < 0) loser = bottom;
  } else {
    const top = best(judged, (row) => row.roas ?? 0);
    if (top && (top.roas ?? 0) >= 1) winner = top;
    loser = best(
      judged.filter((row) => (row.roas ?? 0) < 1),
      (row) => row.spend ?? 0
    );
  }

  const winnerId = winner ? winner.id : null;
  const worstReturns = best(
    judged.filter((row) => row.id !== winnerId),
    returnShare
  );
  const returns = worstReturns && returnShare(worstReturns) >= RETURNS_BAD ? { row: worstReturns, share: returnShare(worstReturns) } : null;

  if (winner) return { kind: "winner", by, row: winner, returns };
  if (loser) return { kind: "loser", by, row: loser };
  if (returns) return { kind: "returns", row: returns.row, share: returns.share };
  return { kind: "even" };
}

/**
 * The sentence of the tab for a role that reads the order sources but not
 * campaign spend — the rule, on the attribution report by source (last touch):
 *
 *  1. Fewer than MIN_SOURCE_ORDERS (10) orders in the range → "not enough to judge".
 *  2. UNTRACKED_BAD (half) or more of the orders carry no UTM at all → say
 *     that: the merchant cannot tell which ad sells.
 *  3. Otherwise the source (one with a UTM) that delivered the most sales, when
 *     at least MIN_SOURCE_DELIVERED (3) of its orders were delivered.
 *  4. Otherwise "not enough to judge".
 */
export const MIN_SOURCE_ORDERS = 10;
export const UNTRACKED_BAD = 0.5;
export const MIN_SOURCE_DELIVERED = 3;

export type SourcesVerdict =
  | { kind: "thin" }
  | { kind: "untracked"; share: number }
  | { kind: "top"; name: string; deliveredSales: number; orders: number };

export function judgeSources(data: InsightsAttribution): SourcesVerdict {
  const total = data.totals.orders;
  if (data.groupBy !== "source" || total < MIN_SOURCE_ORDERS) return { kind: "thin" };
  const untracked = data.rows.find((row) => row.key === "");
  const share = untracked ? untracked.orders / total : 0;
  if (share >= UNTRACKED_BAD) return { kind: "untracked", share };
  const top = best(
    data.rows.filter((row) => row.key !== "" && row.delivered >= MIN_SOURCE_DELIVERED),
    (row) => row.deliveredSales
  );
  if (!top) return { kind: "thin" };
  return { kind: "top", name: top.key, deliveredSales: top.deliveredSales, orders: top.orders };
}

/** A share as "N of every 10": 0.42 → 4. Never 0 for a share that passed a threshold, never above 10. */
export function outOfTen(share: number): number {
  return Math.min(10, Math.max(1, Math.round(share * 10)));
}

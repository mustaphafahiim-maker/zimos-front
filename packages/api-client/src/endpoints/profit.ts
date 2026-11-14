/**
 * Real profit — the P&L report, product economics, ad spend and campaigns
 * (backend: src/modules/profit).
 *
 * Mounted at /workspaces/:workspaceId/profit. Reads need
 * financial_reports.view, writes need profit.manage. All exported names in
 * this file are prefixed with `profit` / `Profit`.
 *
 * Money is integer minor units of the store's currency; percentages on
 * economics are basis points (250 = 2.5%); rates on reports are percentages.
 */
import type { ApiClient } from "../client";
import { insightsQuery } from "./insights";

// ------------------------------------------------------------------ types --

export type ProfitGroupBy = "day" | "product" | "campaign";

export interface ProfitStatement {
  /** Delivered revenue (after refunds). */
  revenue: number;
  costOfGoods: number;
  /** Outbound shipping for everything that shipped. */
  shipping: number;
  returnShipping: number;
  /** Collection (COD) and gateway fees. */
  fees: number;
  adSpend: number;
  zimosFees: number;
  netProfit: number;
  /** Net profit ÷ revenue, as a percentage; null without revenue. */
  margin: number | null;
}

export interface ProfitLine {
  /** Fractions appear in per-product rows: an order is split across its lines. */
  orders: { delivered: number; returned: number; open: number };
  deliveryRate: number | null;
  /** Finished orders only (delivered or returned). */
  actual: ProfitStatement;
  /** Actual + open orders weighted by the store's delivery rate. */
  projected: ProfitStatement;
  /** Ad cost one placed order can carry before it loses money. */
  maxCpa: number | null;
  /** Ad spend ÷ finished orders. */
  costPerOrder: number | null;
}

export interface ProfitRow extends ProfitLine {
  key: string;
  label: string | null;
}

export interface ProfitPnl {
  range: { from: string; to: string; timeZone: string };
  currency: string;
  groupBy: ProfitGroupBy;
  /** Delivery rate the projection assumes; null when the store has no history. */
  projectionDeliveryRate: number | null;
  /** Share of delivered units that had a unit cost, as a percentage. */
  costCoverage: number | null;
  zimosFeeBp: { transactionBp: number; codBp: number };
  /** False in the per-product view: ad spend is only in the totals there. */
  adSpendAllocated: boolean;
  totals: ProfitLine;
  rows: ProfitRow[];
}

export interface ProfitEconomics {
  packagingCostAmount: number | null;
  shippingCostAmount: number | null;
  returnCostAmount: number | null;
  collectionFeeBp: number | null;
  gatewayFeeBp: number | null;
  damageBp: number | null;
}

export interface ProfitEconomicsProduct {
  productId: string;
  name: string;
  status: string;
  minCostAmount: number | null;
  maxCostAmount: number | null;
  minPriceAmount: number | null;
  maxPriceAmount: number | null;
  variants: number;
  variantsWithoutCost: number;
  /** Null when the product uses the store defaults. */
  overrides: ProfitEconomics | null;
}

export interface ProfitEconomicsList {
  defaults: ProfitEconomics;
  products: ProfitEconomicsProduct[];
}

export type ProfitAdPlatform = "meta" | "tiktok" | "snapchat" | "google" | "other";
export const PROFIT_AD_PLATFORMS: ProfitAdPlatform[] = ["meta", "tiktok", "snapchat", "google", "other"];

export interface ProfitAdSpendEntry {
  id: string;
  /** YYYY-MM-DD */
  day: string;
  platform: ProfitAdPlatform;
  campaignName: string;
  campaignId: string | null;
  /** The ads behind it, from an import at ad level (Ad ID column): orders carrying ad_id match through them. */
  adIds?: string[];
  spendAmount: number;
  currency: string;
  impressions: number | null;
  clicks: number | null;
  source: "manual" | "csv" | "sync";
  createdAt: string;
}

export interface ProfitAdSpendList {
  entries: ProfitAdSpendEntry[];
  total: number;
  totalSpendAmount: number;
  currency: string;
}

export interface ProfitAdSpendPayload {
  day: string;
  platform: ProfitAdPlatform;
  campaignName: string;
  campaignId?: string | null;
  spendAmount: number;
  impressions?: number | null;
  clicks?: number | null;
}

export interface ProfitAdSpendImport {
  dryRun: boolean;
  rows: number;
  valid: number;
  created: number;
  updated: number;
  totalSpendAmount: number;
  currency: string;
  /** First 200 rejected lines (1-based, the header is line 1). */
  errors: { line: number; problems: string[] }[];
  errorCount: number;
}

export interface ProfitCampaign {
  platform: ProfitAdPlatform;
  campaignName: string;
  campaignId: string | null;
  firstDay: string;
  lastDay: string;
  spendAmount: number;
  impressions: number | null;
  clicks: number | null;
  orders: number;
  confirmed: number;
  delivered: number;
  returned: number;
  salesAmount: number;
  deliveredSalesAmount: number;
  costPerOrder: number | null;
  /** Spend ÷ delivered orders. */
  realCpa: number | null;
  /** Delivered sales ÷ spend. */
  realRoas: number | null;
}

export interface ProfitCampaigns {
  range: { from: string; to: string; timeZone: string };
  currency: string;
  totals: {
    spendAmount: number;
    orders: number;
    delivered: number;
    deliveredSalesAmount: number;
    realCpa: number | null;
    realRoas: number | null;
  };
  campaigns: ProfitCampaign[];
  /** utm_campaign values that brought orders but have no spend recorded. */
  withoutSpend: { campaign: string; orders: number; delivered: number; salesAmount: number }[];
  suggestedUrlParameters: Record<"meta" | "tiktok" | "snapchat" | "google", string>;
}

// -------------------------------------------------------------- functions --

const base = (workspaceId: string) => `/workspaces/${workspaceId}/profit`;

export async function profitGetPnl(
  client: ApiClient,
  workspaceId: string,
  params: { from?: string; to?: string; groupBy?: ProfitGroupBy } = {}
): Promise<ProfitPnl> {
  const { pnl } = await client.request<{ pnl: ProfitPnl }>(`${base(workspaceId)}/pnl${insightsQuery(params)}`);
  return pnl;
}

export async function profitGetEconomics(client: ApiClient, workspaceId: string): Promise<ProfitEconomicsList> {
  return client.request<ProfitEconomicsList>(`${base(workspaceId)}/economics`);
}

export async function profitSaveDefaults(
  client: ApiClient,
  workspaceId: string,
  payload: Partial<ProfitEconomics>
): Promise<ProfitEconomics> {
  const { defaults } = await client.request<{ defaults: ProfitEconomics }>(`${base(workspaceId)}/economics/defaults`, {
    method: "PUT",
    body: payload,
  });
  return defaults;
}

export async function profitSaveProductEconomics(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  payload: Partial<ProfitEconomics>
): Promise<ProfitEconomics> {
  const { overrides } = await client.request<{ overrides: ProfitEconomics }>(
    `${base(workspaceId)}/economics/products/${productId}`,
    { method: "PUT", body: payload }
  );
  return overrides;
}

export async function profitResetProductEconomics(client: ApiClient, workspaceId: string, productId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/economics/products/${productId}`, { method: "DELETE" });
}

export async function profitListAdSpend(
  client: ApiClient,
  workspaceId: string,
  params: { from?: string; to?: string; platform?: ProfitAdPlatform; limit?: number; offset?: number } = {}
): Promise<ProfitAdSpendList> {
  return client.request<ProfitAdSpendList>(`${base(workspaceId)}/ad-spend${insightsQuery(params)}`);
}

/** Saving the same day, platform and campaign again replaces its amount. */
export async function profitAddAdSpend(
  client: ApiClient,
  workspaceId: string,
  payload: ProfitAdSpendPayload
): Promise<ProfitAdSpendEntry> {
  const { entry } = await client.request<{ entry: ProfitAdSpendEntry }>(`${base(workspaceId)}/ad-spend`, {
    method: "POST",
    body: payload,
  });
  return entry;
}

export async function profitDeleteAdSpend(client: ApiClient, workspaceId: string, entryId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/ad-spend/${entryId}`, { method: "DELETE" });
}

/** `csv` is the file's text: date, platform, campaign name, spend[, impressions, clicks]. */
export async function profitImportAdSpend(
  client: ApiClient,
  workspaceId: string,
  payload: { csv: string; defaultPlatform?: ProfitAdPlatform; dryRun?: boolean }
): Promise<ProfitAdSpendImport> {
  const result = await client.request<{ import: ProfitAdSpendImport }>(`${base(workspaceId)}/ad-spend/import`, {
    method: "POST",
    body: payload,
  });
  return result.import;
}

export async function profitGetCampaigns(
  client: ApiClient,
  workspaceId: string,
  params: { from?: string; to?: string } = {}
): Promise<ProfitCampaigns> {
  return client.request<ProfitCampaigns>(`${base(workspaceId)}/campaigns${insightsQuery(params)}`);
}

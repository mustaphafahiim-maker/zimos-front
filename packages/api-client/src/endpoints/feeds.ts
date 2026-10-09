/**
 * The product feed for ad channels, the Google Merchant checklist and the
 * Offers hub's numbers (backend: src/modules/offers/productFeed.js; lane 3).
 *
 * Staff: GET/PUT /workspaces/:id/offers/feed, GET /offers/merchant-checklist,
 * GET /offers/summary (products.view / products.manage). The feed itself is
 * public: GET /feeds/:workspaceSlug/:channel.xml (or .csv) under the API
 * base, 404 while the feed is switched off. All exported names here start
 * with `feeds` / `Feed` or `offersSummary`.
 */
import type { ApiClient } from "../client";
import type { FeedChannelStatus, FeedChannelsSettings } from "./feedChannels";

export type FeedChannel = "meta" | "google" | "tiktok" | "snapchat";
export const FEED_CHANNELS: FeedChannel[] = ["meta", "google", "tiktok", "snapchat"];

export interface FeedSettings {
  enabled: boolean;
  /** Only products of these collections; empty for the whole catalog. */
  collectionIds: string[];
  excludeOutOfStock: boolean;
  /** Defaults to the store's name when blank. */
  brand: string;
  googleProductCategory: string;
  /** Each channel's own switch, collections and stock rule (handoff 264, feedChannels.ts); absent from an older API. */
  channels?: FeedChannelsSettings;
}

export interface FeedState {
  feed: FeedSettings;
  /** Variants the feed lists right now. */
  itemCount: number;
  productCount: number;
  /** Paths under the API base, per channel. */
  links: Record<FeedChannel, { xml: string; csv: string }>;
  /** Whether each channel's link answers, and what it holds (handoff 264); absent from an older API. */
  channels?: Record<FeedChannel, FeedChannelStatus>;
}

export type FeedCheckKey =
  | "store_info_enabled"
  | "email"
  | "phone"
  | "address"
  | "shipping_policy"
  | "return_policy"
  | "cod_policy"
  | "privacy_policy"
  | "products"
  | "feed_enabled";

export interface FeedChecklist {
  ready: boolean;
  checks: { key: FeedCheckKey; ok: boolean; fixAt: "store_info" | "legal" | "catalog" | "feed" }[];
}

/** What each offer tool did over `days`. Money is minor units. */
export interface OffersSummary {
  days: number;
  bundles: { active: number; orders: number; savedAmount: number };
  bumps: { active: number; sold: number; revenue: number };
  crossSell: { active: number };
  upsells: { active: number; accepted: number; revenue: number };
  discounts: { active: number; redemptions: number; amount: number };
  newsletter: { subscribers: number };
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/offers`;

export async function feedsGet(client: ApiClient, workspaceId: string): Promise<FeedState> {
  return client.request<FeedState>(`${base(workspaceId)}/feed`);
}

export async function feedsSave(client: ApiClient, workspaceId: string, settings: FeedSettings): Promise<FeedState> {
  return client.request<FeedState>(`${base(workspaceId)}/feed`, { method: "PUT", body: settings });
}

export async function feedsChecklist(client: ApiClient, workspaceId: string): Promise<FeedChecklist> {
  return client.request<FeedChecklist>(`${base(workspaceId)}/merchant-checklist`);
}

export async function offersSummaryGet(client: ApiClient, workspaceId: string, days = 30): Promise<OffersSummary> {
  return (await client.request<{ summary: OffersSummary }>(`${base(workspaceId)}/summary?days=${days}`)).summary;
}

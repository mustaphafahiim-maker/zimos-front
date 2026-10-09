/**
 * Storefront search analytics and synonyms (backend: frontend-handoff item 211,
 * src/modules/searchInsights).
 *
 * Storefront:
 *   GET  /store/:ws/products?search=… — the first page also answers `searchId`
 *        (null on later pages) and, when the words found nothing but one of
 *        their synonyms did, `servedAs` (the term searched instead). The search
 *        is counted per shopper when the request carries `X-Visitor-Id`.
 *   POST /store/:ws/search/click { searchId, productId } → 204 — the result the
 *        shopper opened (the first click counts, within an hour of the search).
 *
 * Staff, /workspaces/:ws/search-insights:
 *   GET  /?from=&to=   (analytics.view, default the last 30 days) → SearchInsights
 *   GET  /synonyms     (products.view)   → { groups: string[][] }
 *   PUT  /synonyms     (products.manage) { groups } → { groups }
 *        2–10 terms per group (≤ 60 characters), ≤ 200 groups, a term in one
 *        group only: 422 VALIDATION_ERROR on `groups`, `"<term>" is in two groups`.
 * Searches are kept 180 days.
 */
import type { ApiClient } from "../client";
import type { StorefrontListing, StorefrontListingParams } from "../types";

export interface SearchInsightsTotals {
  searches: number;
  /** Shoppers who searched (distinct visitor ids; searches sent without one are not counted here). */
  searchers: number;
  /** Searches that found nothing. */
  noResults: number;
  clicks: number;
  /** Clicks ÷ searches that had results, in %; null when no search had results. */
  clickRate: number | null;
}

export interface SearchInsightsTopSearch {
  query: string;
  searches: number;
  /** Results per search, on average. */
  avgResults: number;
  clicks: number;
  /** Clicks ÷ searches of this query, in %. */
  clickRate: number | null;
  /** The synonym whose results were shown instead, when the query itself found nothing. */
  servedAs: string | null;
}

export interface SearchInsightsNoResult {
  query: string;
  searches: number;
  lastAt: string;
}

export interface SearchInsightsClickedProduct {
  productId: string;
  name: string;
  clicks: number;
}

export interface SearchInsights {
  range: { from: string; to: string };
  totals: SearchInsightsTotals;
  /** The 50 most searched queries. */
  topSearches: SearchInsightsTopSearch[];
  /** The 50 most searched queries that found nothing. */
  noResults: SearchInsightsNoResult[];
  /** The 20 products most opened from a search. */
  topClickedProducts: SearchInsightsClickedProduct[];
}

/** What the API accepts for synonyms (searchInsights/index.js). */
export const SEARCH_SYNONYM_LIMITS = { groups: 200, minTerms: 2, maxTerms: 10, term: 60 } as const;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/search-insights`;

export function searchInsightsGet(
  client: ApiClient,
  workspaceId: string,
  range: { from?: string; to?: string } = {}
): Promise<SearchInsights> {
  const qs = new URLSearchParams();
  if (range.from) qs.set("from", range.from);
  if (range.to) qs.set("to", range.to);
  const s = qs.toString();
  return client.request<SearchInsights>(`${base(workspaceId)}${s ? `?${s}` : ""}`);
}

/** The store's synonym groups: [["تيشيرت", "t-shirt", "tee"], …]. */
export async function searchSynonymsGet(client: ApiClient, workspaceId: string): Promise<string[][]> {
  const { groups } = await client.request<{ groups: string[][] }>(`${base(workspaceId)}/synonyms`);
  return groups;
}

/** Replaces every group; answers them as saved (trimmed, without repeats). */
export async function searchSynonymsSave(client: ApiClient, workspaceId: string, groups: string[][]): Promise<string[][]> {
  const saved = await client.request<{ groups: string[][] }>(`${base(workspaceId)}/synonyms`, { method: "PUT", body: { groups } });
  return saved.groups;
}

/** How the API compares two terms: trimmed, lower case, single spaces. */
export function normalizeSearchTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The term a 422 on `groups` names (`"<term>" is in two groups`), when it names one. */
export function searchSynonymClash(message: string | null | undefined): string | null {
  const match = /^"(.+)" is in two groups$/.exec(message ?? "");
  return match ? match[1] : null;
}

// ----------------------------------------------------------- storefront --

/** A listing that was a search: its id for click reporting, and the synonym served instead, if one was. */
export type StorefrontSearchListing = StorefrontListing & {
  /** Null on later pages, and when the search could not be logged. */
  searchId?: string | null;
  servedAs?: string;
};

/** The same client, with one more header on every request it makes. */
function withHeader(client: ApiClient, name: string, value: string): ApiClient {
  const wrapped = Object.create(client) as ApiClient;
  wrapped.request = ((path: string, opts: Parameters<ApiClient["request"]>[1] = {}) =>
    client.request(path, { ...opts, headers: { ...opts.headers, [name]: value } })) as ApiClient["request"];
  return wrapped;
}

/**
 * `client.searchStorefrontProducts`, typed with what a search adds and — when
 * the shopper's `visitorId` is known — sent with `X-Visitor-Id`, so the
 * merchant's report can count shoppers and not only searches.
 */
export function storefrontSearchListing(
  client: ApiClient,
  workspaceRef: string,
  params: StorefrontListingParams = {},
  visitorId?: string | null
): Promise<StorefrontSearchListing> {
  const sender = visitorId && params.search ? withHeader(client, "X-Visitor-Id", visitorId) : client;
  return sender.searchStorefrontProducts(workspaceRef, params) as Promise<StorefrontSearchListing>;
}

/** The search's id and the synonym it was served as, read off any listing (null for a plain listing). */
export function storefrontSearchMeta(listing: StorefrontListing): { searchId: string | null; servedAs: string | null } {
  const search = listing as StorefrontSearchListing;
  return { searchId: search.searchId ?? null, servedAs: search.servedAs?.trim() || null };
}

/** Reports the result the shopper opened from a search. Never throws: a lost click must not disturb the visit. */
export async function storefrontSearchClick(
  client: ApiClient,
  workspaceRef: string,
  click: { searchId: string; productId: string }
): Promise<void> {
  try {
    await client.request<unknown>(`/store/${workspaceRef}/search/click`, { method: "POST", body: click, auth: false });
  } catch {
    /* counted or not, the shopper goes on */
  }
}

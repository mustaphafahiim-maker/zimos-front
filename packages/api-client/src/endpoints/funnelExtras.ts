/**
 * Funnel share codes, import by code, the map editor's server-side draft and
 * the issues list. Backend: src/modules/funnels/funnelExtras.js,
 * under /workspaces/:workspaceId/funnels — permission funnels.manage.
 *
 * Codes: NOT_FOUND on import (404 — the code is wrong or sharing was stopped),
 * the plan's funnel limit on import (same refusal as creating a funnel).
 */
import type { ApiClient } from "../client";
import type { FunnelDto } from "./funnels";

const base = (workspaceId: string) => "/workspaces/" + workspaceId + "/funnels";

/** The funnel's share code; created the first time it is asked for. */
export async function funnelExtrasShare(client: ApiClient, workspaceId: string, funnelId: string): Promise<string> {
  const { shareCode } = await client.request<{ shareCode: string }>(base(workspaceId) + "/" + funnelId + "/share", {
    method: "POST",
  });
  return shareCode;
}

/** Stops the code working. */
export async function funnelExtrasUnshare(client: ApiClient, workspaceId: string, funnelId: string): Promise<void> {
  await client.request(base(workspaceId) + "/" + funnelId + "/share", { method: "DELETE" });
}

/** Copies a shared funnel into this store — its pages and links, without products, offers or orders. */
export async function funnelExtrasImport(
  client: ApiClient,
  workspaceId: string,
  payload: { shareCode: string; name?: string }
): Promise<{ funnel: FunnelDto; stepCount: number; edgeCount: number }> {
  return client.request<{ funnel: FunnelDto; stepCount: number; edgeCount: number }>(base(workspaceId) + "/import", {
    method: "POST",
    body: payload,
  });
}

export interface FunnelDraft<T = Record<string, unknown>> {
  draft: T | null;
  draftUpdatedAt: string | null;
}

export function funnelExtrasGetDraft<T = Record<string, unknown>>(
  client: ApiClient,
  workspaceId: string,
  funnelId: string
): Promise<FunnelDraft<T>> {
  return client.request<FunnelDraft<T>>(base(workspaceId) + "/" + funnelId + "/draft");
}

/** Auto-save of unfinished map work (at most 500 KB). */
export function funnelExtrasSaveDraft(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  draft: Record<string, unknown>
): Promise<{ draftUpdatedAt: string }> {
  return client.request<{ draftUpdatedAt: string }>(base(workspaceId) + "/" + funnelId + "/draft", {
    method: "PUT",
    body: { draft },
  });
}

export async function funnelExtrasDiscardDraft(client: ApiClient, workspaceId: string, funnelId: string): Promise<void> {
  await client.request(base(workspaceId) + "/" + funnelId + "/draft", { method: "DELETE" });
}

export type FunnelIssueCode =
  | "graph"
  | "untranslated_text"
  | "page_without_product"
  | "unlinked_button"
  | "image_without_alt"
  | "missing_policies";

export interface FunnelIssue {
  /** `fatal` blocks publishing; `warning` does not. */
  severity: "fatal" | "warning";
  code: FunnelIssueCode;
  stepKey: string | null;
  elementId?: string | null;
  field?: string | null;
  /** English, from the server; the dashboard translates by `code` where it can. */
  message: string;
  /** untranslated_text: the language the texts are missing in, and how many. */
  locale?: string;
  count?: number;
}

export interface FunnelIssues {
  issues: FunnelIssue[];
  counts: { fatal: number; warning: number };
}

export function funnelExtrasIssues(client: ApiClient, workspaceId: string, funnelId: string): Promise<FunnelIssues> {
  return client.request<FunnelIssues>(base(workspaceId) + "/" + funnelId + "/issues");
}

// --------------------------------------------------------- split tests ----
// Backend: src/modules/funnels/splitTests.js — /workspaces/:ws/experiments
// (funnels.manage). Codes: SPLIT_TEST_EXISTS (409 — the page already has a
// test), SPLIT_TEST_COMPLETED (409 — a finished test's variants cannot change).

export type SplitTestStatus = "running" | "paused" | "completed";
export type SplitTestMetric = "conversion_rate" | "revenue_per_visit";

export interface SplitTestVariant {
  /** "A" is the step's own page (the control); others carry a page of their own. */
  key: string;
  name: string;
  /** Share of visitors, in percent; the shares add up to 100. */
  weight: number;
  /** Present on detail reads for variants other than "A". */
  builderData?: unknown;
}

export interface SplitTestAutoWinner {
  enabled: boolean;
  afterVisits: number;
  metric: SplitTestMetric;
}

export interface SplitTest {
  id: string;
  name: string;
  funnelId: string;
  stepKey: string;
  status: SplitTestStatus;
  autoWinner: SplitTestAutoWinner;
  winnerVariantKey: string | null;
  variants: SplitTestVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface SplitTestResults {
  totalVisits: number;
  variants: Array<{
    key: string;
    name: string;
    weight: number;
    visits: number;
    orders: number;
    /** Basis points: 100 = 1%. */
    conversionRateBp: number;
    /** Minor units, as a string. */
    revenueAmount: string;
    revenuePerVisitAmount: string;
  }>;
  leaderKey: string | null;
  /** 0.5–1: how sure the leader's conversion rate is really better; null with too little data. */
  confidence: number | null;
}

const experimentsBase = (workspaceId: string) => "/workspaces/" + workspaceId + "/experiments";

export async function splitTestsList(client: ApiClient, workspaceId: string, funnelId: string): Promise<SplitTest[]> {
  const { experiments } = await client.request<{ experiments: SplitTest[] }>(
    experimentsBase(workspaceId) + "?funnelId=" + encodeURIComponent(funnelId)
  );
  return experiments;
}

export function splitTestsGet(
  client: ApiClient,
  workspaceId: string,
  experimentId: string
): Promise<{ experiment: SplitTest; results: SplitTestResults }> {
  return client.request<{ experiment: SplitTest; results: SplitTestResults }>(experimentsBase(workspaceId) + "/" + experimentId);
}

export async function splitTestsCreate(
  client: ApiClient,
  workspaceId: string,
  payload: {
    funnelId: string;
    stepKey: string;
    name: string;
    variants: Array<{ key: string; name?: string; weight: number; builderData?: unknown }>;
    autoWinner?: SplitTestAutoWinner | null;
  }
): Promise<SplitTest> {
  const { experiment } = await client.request<{ experiment: SplitTest }>(experimentsBase(workspaceId), {
    method: "POST",
    body: payload,
  });
  return experiment;
}

export async function splitTestsUpdate(
  client: ApiClient,
  workspaceId: string,
  experimentId: string,
  patch: {
    name?: string;
    status?: "running" | "paused";
    variants?: Array<{ key: string; name?: string; weight: number; builderData?: unknown }>;
    autoWinner?: SplitTestAutoWinner | null;
  }
): Promise<SplitTest> {
  const { experiment } = await client.request<{ experiment: SplitTest }>(experimentsBase(workspaceId) + "/" + experimentId, {
    method: "PATCH",
    body: patch,
  });
  return experiment;
}

/** Finishes the test: every visitor then sees the winner's page. */
export async function splitTestsChooseWinner(
  client: ApiClient,
  workspaceId: string,
  experimentId: string,
  variantKey: string
): Promise<SplitTest> {
  const { experiment } = await client.request<{ experiment: SplitTest }>(
    experimentsBase(workspaceId) + "/" + experimentId + "/winner",
    { method: "POST", body: { variantKey } }
  );
  return experiment;
}

export async function splitTestsDelete(client: ApiClient, workspaceId: string, experimentId: string): Promise<void> {
  await client.request(experimentsBase(workspaceId) + "/" + experimentId, { method: "DELETE" });
}

// ------------------------------------- geo redirects and funnel settings ----
// Backend: src/modules/funnels/geoRedirects.js, under the funnels routes.

export interface FunnelGeoRedirect {
  id: string;
  sourceFunnelId: string;
  targetFunnelId: string;
  targetFunnelName?: string | null;
  /** ISO 3166-1 alpha-2, upper case. */
  countries: string[];
  isActive: boolean;
}

export async function funnelGeoRedirectsList(client: ApiClient, workspaceId: string, funnelId: string): Promise<FunnelGeoRedirect[]> {
  const { geoRedirects } = await client.request<{ geoRedirects: FunnelGeoRedirect[] }>(
    base(workspaceId) + "/" + funnelId + "/geo-redirects"
  );
  return geoRedirects;
}

export async function funnelGeoRedirectsCreate(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  payload: { targetFunnelId: string; countries: string[]; isActive?: boolean }
): Promise<FunnelGeoRedirect> {
  const { geoRedirect } = await client.request<{ geoRedirect: FunnelGeoRedirect }>(
    base(workspaceId) + "/" + funnelId + "/geo-redirects",
    { method: "POST", body: payload }
  );
  return geoRedirect;
}

export async function funnelGeoRedirectsUpdate(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  ruleId: string,
  patch: { targetFunnelId?: string; countries?: string[]; isActive?: boolean }
): Promise<FunnelGeoRedirect> {
  const { geoRedirect } = await client.request<{ geoRedirect: FunnelGeoRedirect }>(
    base(workspaceId) + "/" + funnelId + "/geo-redirects/" + ruleId,
    { method: "PATCH", body: patch }
  );
  return geoRedirect;
}

export async function funnelGeoRedirectsDelete(client: ApiClient, workspaceId: string, funnelId: string, ruleId: string): Promise<void> {
  await client.request(base(workspaceId) + "/" + funnelId + "/geo-redirects/" + ruleId, { method: "DELETE" });
}

export interface FunnelOwnSettings {
  /** A 3-letter currency code shown as the funnel's currency; null = the store's. */
  currency: string | null;
  faviconUrl: string | null;
  title: string | null;
  description: string | null;
  /** The funnel's own scripts, on every step (storefront FunnelCode). */
  headCode?: string | null;
  bodyCode?: string | null;
  /** Its shipping group (Shipping → groups); null = each product's own. */
  shippingProfileId?: string | null;
}

export async function funnelSettingsGet(client: ApiClient, workspaceId: string, funnelId: string): Promise<FunnelOwnSettings> {
  const { settings } = await client.request<{ settings: FunnelOwnSettings }>(base(workspaceId) + "/" + funnelId + "/settings");
  return settings;
}

export async function funnelSettingsSave(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  patch: Partial<Record<keyof FunnelOwnSettings, string | null>>
): Promise<FunnelOwnSettings> {
  const { settings } = await client.request<{ settings: FunnelOwnSettings }>(base(workspaceId) + "/" + funnelId + "/settings", {
    method: "PATCH",
    body: patch,
  });
  return settings;
}

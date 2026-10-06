import type { ApiClient } from "../client";
import type { PageTree } from "../types";

/**
 * The funnel template marketplace, merchant side (backend modules/marketplace,
 * handoff 192). Mounted at /workspaces/:ws/marketplace, permission
 * funnels.manage. Free templates only — there is no price anywhere.
 *
 *   1. A merchant submits one of their funnels as a template; its pages are
 *      copied at that moment (products, offers and bumps taken out).
 *   2. The platform reviews it: listed («منشور»), or rejected with a note.
 *   3. Any store browses the listed ones and copies one as a new draft funnel.
 *
 * Errors: 422 VALIDATION_ERROR "The funnel has no pages yet" (field funnelId)
 * or "The funnel is too large to share"; 409 ALREADY_SUBMITTED (that funnel is
 * pending or listed), SUBMISSION_WITHDRAWN, FUNNEL_GONE (its funnel was
 * deleted, so it can't be resubmitted).
 */

export const MARKETPLACE_CATEGORIES = [
  "ecommerce",
  "lead_generation",
  "webinar",
  "digital_product",
  "course",
  "service",
  "event",
  "other",
] as const;
export type MarketplaceCategory = (typeof MARKETPLACE_CATEGORIES)[number];
export type MarketplaceLanguage = "ar" | "en" | "fr";
export type MarketplaceSubmissionStatus = "pending" | "approved" | "rejected" | "withdrawn";

/** Server limits on a template's card (marketplace/index.js cardBody). */
export const MARKETPLACE_LIMITS = { nameMin: 3, nameMax: 120, description: 1000, tags: 10, tagLength: 40, authorName: 120 } as const;

export interface MarketplaceTemplateCard {
  id: string;
  name: string;
  description: string | null;
  category: MarketplaceCategory;
  tags: string[];
  thumbnailUrl: string | null;
  authorName: string;
  language: MarketplaceLanguage | null;
  stepCount: number;
  usesCount: number;
  createdAt: string;
}

export interface MarketplaceTemplatePage {
  key: string;
  name: string;
  /** The step's page tree, as a copy gets it — render it like any page. */
  builderData: PageTree | null;
}

export interface MarketplaceTemplateDetail extends MarketplaceTemplateCard {
  steps: Array<{ key: string; stepType: string; name: string }>;
  pages: MarketplaceTemplatePage[];
}

/** One of the store's own submissions, with where its review stands. */
export interface MarketplaceSubmission extends MarketplaceTemplateCard {
  status: MarketplaceSubmissionStatus;
  /** The reviewer's note — what to change when it was rejected. */
  reviewNote: string | null;
  reviewedAt: string | null;
  /** Null once the source funnel was deleted. */
  funnelId: string | null;
  updatedAt: string;
}

export interface MarketplaceBrowseParams {
  category?: MarketplaceCategory;
  q?: string;
  language?: MarketplaceLanguage;
  sort?: "popular" | "new";
  page?: number;
  limit?: number;
}

export interface MarketplaceBrowseResponse {
  templates: MarketplaceTemplateCard[];
  total: number;
  page: number;
  limit: number;
  categories: MarketplaceCategory[];
}

export interface MarketplaceCardInput {
  name?: string;
  category?: MarketplaceCategory;
  description?: string | null;
  /** ≤10, stored lower-cased. */
  tags?: string[];
  /** https only. */
  thumbnailUrl?: string | null;
  /** Defaults to the store's name. */
  authorName?: string;
  language?: MarketplaceLanguage;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/marketplace`;

/** GET /templates — the listed templates, most used first by default. */
export function marketplaceBrowse(client: ApiClient, workspaceId: string, params: MarketplaceBrowseParams = {}): Promise<MarketplaceBrowseResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return client.request<MarketplaceBrowseResponse>(`${base(workspaceId)}/templates${qs ? `?${qs}` : ""}`);
}

/** GET /templates/:id — a listed template with its pages, for the preview. */
export async function marketplaceTemplate(client: ApiClient, workspaceId: string, id: string): Promise<MarketplaceTemplateDetail> {
  const { template } = await client.request<{ template: MarketplaceTemplateDetail }>(`${base(workspaceId)}/templates/${id}`);
  return template;
}

/** POST /templates/:id/use — copies the template into this store as a new draft funnel (counts against the plan). */
export function marketplaceUseTemplate(
  client: ApiClient,
  workspaceId: string,
  id: string,
  body: { name?: string } = {}
): Promise<{ funnel: { id: string; name: string; status: "draft" }; stepCount: number }> {
  return client.request(`${base(workspaceId)}/templates/${id}/use`, { method: "POST", body });
}

/** GET /submissions — this store's own submissions, newest first. */
export async function marketplaceSubmissions(client: ApiClient, workspaceId: string): Promise<MarketplaceSubmission[]> {
  const { submissions } = await client.request<{ submissions: MarketplaceSubmission[] }>(`${base(workspaceId)}/submissions`);
  return submissions;
}

/** POST /submissions — sends one of the store's funnels for review; its pages are copied now. */
export async function marketplaceSubmit(
  client: ApiClient,
  workspaceId: string,
  body: MarketplaceCardInput & { funnelId: string; name: string; category: MarketplaceCategory }
): Promise<MarketplaceSubmission> {
  const { submission } = await client.request<{ submission: MarketplaceSubmission }>(`${base(workspaceId)}/submissions`, { method: "POST", body });
  return submission;
}

/**
 * PATCH /submissions/:id — edits the card. `resubmit` takes a fresh copy of
 * the funnel's pages and sends it for review again; editing a listed card
 * sends it back to review too.
 */
export async function marketplaceUpdateSubmission(
  client: ApiClient,
  workspaceId: string,
  id: string,
  body: MarketplaceCardInput & { resubmit?: boolean }
): Promise<MarketplaceSubmission> {
  const { submission } = await client.request<{ submission: MarketplaceSubmission }>(`${base(workspaceId)}/submissions/${id}`, { method: "PATCH", body });
  return submission;
}

/** DELETE /submissions/:id — withdraws it from the marketplace; funnels already copied stay. */
export async function marketplaceWithdrawSubmission(client: ApiClient, workspaceId: string, id: string): Promise<MarketplaceSubmission> {
  const { submission } = await client.request<{ submission: MarketplaceSubmission }>(`${base(workspaceId)}/submissions/${id}`, { method: "DELETE" });
  return submission;
}

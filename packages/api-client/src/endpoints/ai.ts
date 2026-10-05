/**
 * AI module (backend: src/modules/ai).
 *
 * Mounted at /workspaces/:workspaceId/ai; needs products.manage or
 * website.edit. A request is a job: POST /jobs answers 202 with the queued
 * job, and the result is read by polling GET /jobs/:id (`aiWaitForJob`).
 * Output is only ever a draft — "apply" makes a draft product or an
 * unpublished page.
 *
 * Notable codes: AI_NOT_CONFIGURED (503), AI_LIMIT_REACHED (429,
 * `details.scope` is month | hour), AI_JOB_NOT_READY (409),
 * AI_JOB_ALREADY_APPLIED (409), WEBSITE_REQUIRED (409), PAGE_PATH_TAKEN (409).
 */
import type { ApiClient } from "../client";
import type { PageTree } from "../types";

export const AI_DIALECTS = ["egyptian", "gulf", "msa", "english", "french"] as const;
export type AiDialect = (typeof AI_DIALECTS)[number];

export type AiFeature = "product" | "page" | "translate" | "policies" | "page_review" | "ad_creatives" | "store_builder" | "wa_reply";
export type AiJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface AiProductInput {
  name: string;
  price?: string;
  link?: string;
  notes?: string;
  imageUrls?: string[];
  dialect?: AiDialect;
}

export interface AiProductOutput {
  name: string;
  description: string;
  features: { title: string; description?: string }[];
  faqs: { question: string; answer: string }[];
  metaDescription: string;
  slug: string;
  specialOfferText: string;
}

export interface AiPageInput {
  productId: string;
  audience?: string;
  template?: "classic" | "problem_solution" | "short";
  dialect?: AiDialect;
}

export interface AiPageOutput {
  title: string;
  tree: PageTree;
}

export interface AiTranslateInput {
  /** Label → text; the same labels come back translated. */
  fields: Record<string, string>;
  targetLanguage: AiDialect;
}

export interface AiTranslateOutput {
  fields: Record<string, string>;
}

export interface AiPoliciesInput {
  storeName?: string;
  country?: string;
  sells?: string;
  deliveryDays?: string;
  returnDays?: string;
  contact?: string;
  dialect?: AiDialect;
}

export interface AiPoliciesOutput {
  shipping: string;
  returns: string;
  privacy: string;
}

// --- P2 (backend ai/featuresP2.js) ---------------------------------------

/** A store page by id, or a funnel step by its funnel and key; its last 30 days are read on the server. */
export type AiPageReviewInput =
  | { source: "page"; pageId: string; dialect?: AiDialect }
  | { source: "step"; funnelId: string; stepKey: string; dialect?: AiDialect };

export interface AiPageReviewOutput {
  score: number;
  summary: string;
  recommendations: { title: string; detail: string; severity: "high" | "medium" | "low" }[];
}

export interface AiAdCreativesInput {
  productId: string;
  platform?: "facebook" | "instagram" | "tiktok";
  angle?: string;
  dialect?: AiDialect;
}

export interface AiAdBanner {
  /** Always one of the product's own pictures. */
  imageUrl: string;
  headline: string;
  subline: string;
  badge: string;
  format: "square" | "story" | "landscape";
}

export interface AiAdCreativesOutput {
  headlines: string[];
  primaryTexts: string[];
  /** Empty when the product has no pictures. */
  banners: AiAdBanner[];
}

export interface AiStoreBuilderInput {
  niche: string;
  storeName: string;
  /** "#rrggbb" */
  color?: string;
  dialect?: AiDialect;
}

export interface AiStoreBuilderOutput {
  theme: { key: string; primaryColor: string };
  home: { title: string; tree: PageTree };
  collections: { name: string; description: string }[];
  policies: { shipping: string; returns: string; privacy: string };
}

export interface AiWaReplyInput {
  conversationId: string;
  dialect?: AiDialect;
}

export interface AiWaReplyOutput {
  reply: string;
}

export interface AiInputs {
  product: AiProductInput;
  page: AiPageInput;
  translate: AiTranslateInput;
  policies: AiPoliciesInput;
  page_review: AiPageReviewInput;
  ad_creatives: AiAdCreativesInput;
  store_builder: AiStoreBuilderInput;
  wa_reply: AiWaReplyInput;
}

export interface AiOutputs {
  product: AiProductOutput;
  page: AiPageOutput;
  translate: AiTranslateOutput;
  policies: AiPoliciesOutput;
  page_review: AiPageReviewOutput;
  ad_creatives: AiAdCreativesOutput;
  store_builder: AiStoreBuilderOutput;
  wa_reply: AiWaReplyOutput;
}

/** What "apply" created from the result. */
export type AiApplied =
  | { type: "product"; id: string }
  | { type: "page"; id: string; websiteId: string; path: string }
  /** `page` applied with target "funnel": a new draft funnel (sales → checkout → thank you). */
  | { type: "funnel"; id: string }
  /** store_builder: an unpublished page and hidden collections. */
  | { type: "store"; pageId: string; websiteId: string; path: string; collectionIds: string[] };

export interface AiJob<F extends AiFeature = AiFeature> {
  id: string;
  feature: F;
  status: AiJobStatus;
  input: AiInputs[F];
  /** Present once `status` is succeeded. */
  output: AiOutputs[F] | null;
  /** Present once `status` is failed. */
  error: string | null;
  provider: string | null;
  applied: AiApplied | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface AiUsage {
  provider: { available: boolean; name: string | null; sandbox: boolean };
  /** "2026-10" */
  month: string;
  used: number;
  /** The plan's monthly limit; null = none. */
  limit: number | null;
  remaining: number | null;
  tokens: number;
  byType: { type: AiFeature; requests: number; tokens: number }[];
}

const aiBase = (workspaceId: string) => `/workspaces/${workspaceId}/ai`;

export async function aiUsage(client: ApiClient, workspaceId: string): Promise<AiUsage> {
  return client.request<AiUsage>(`${aiBase(workspaceId)}/usage`);
}

export async function aiStart<F extends AiFeature>(client: ApiClient, workspaceId: string, feature: F, input: AiInputs[F]): Promise<AiJob<F>> {
  const { job } = await client.request<{ job: AiJob<F> }>(`${aiBase(workspaceId)}/jobs`, { method: "POST", body: { feature, input } });
  return job;
}

export async function aiGetJob<F extends AiFeature = AiFeature>(client: ApiClient, workspaceId: string, jobId: string): Promise<AiJob<F>> {
  const { job } = await client.request<{ job: AiJob<F> }>(`${aiBase(workspaceId)}/jobs/${jobId}`);
  return job;
}

/** Polls until the job succeeds or fails (or `timeoutMs` passes — then the last state is returned). */
export async function aiWaitForJob<F extends AiFeature>(
  client: ApiClient,
  workspaceId: string,
  jobId: string,
  { intervalMs = 1200, timeoutMs = 120000, signal }: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<AiJob<F>> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const job = await aiGetJob<F>(client, workspaceId, jobId);
    if (job.status === "succeeded" || job.status === "failed" || Date.now() > deadline || signal?.aborted) return job;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export async function aiListJobs(client: ApiClient, workspaceId: string, params: { feature?: AiFeature; limit?: number } = {}): Promise<AiJob[]> {
  const search = new URLSearchParams();
  if (params.feature) search.set("feature", params.feature);
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  const { jobs } = await client.request<{ jobs: AiJob[] }>(`${aiBase(workspaceId)}/jobs${query ? `?${query}` : ""}`);
  return jobs;
}

/**
 * `product`: creates a draft product (`overrides` carries the merchant's
 * edits). `page`: creates an unpublished page at `path` on the store website,
 * or with `target: "funnel"` a new draft funnel named `name` whose sales step
 * is the page.
 */
export async function aiApply<F extends "product" | "page" | "store_builder">(
  client: ApiClient,
  workspaceId: string,
  jobId: string,
  payload: { overrides?: Partial<AiProductOutput>; path?: string; target?: "website" | "funnel"; name?: string; subdomain?: string } = {}
): Promise<AiJob<F>> {
  const { job } = await client.request<{ job: AiJob<F> }>(`${aiBase(workspaceId)}/jobs/${jobId}/apply`, { method: "POST", body: payload });
  return job;
}

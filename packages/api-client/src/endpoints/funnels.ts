/**
 * Funnels endpoints (backend: src/modules/funnels). Owned by the funnels wiring task.
 * Functions take the shared ApiClient instance and use its public `request()`.
 * All exported names in this file are prefixed with `funnels` / `Funnel`.
 *
 * Mounted at /workspaces/:workspaceId/funnels. Error envelope for every call:
 *   { error: { code, message, details?, requestId } }  -> ApiError(.status, .code, .details = whole body)
 * Notable codes: VALIDATION_ERROR (422, details = FunnelProblem[]), FUNNEL_STEP_KEY_TAKEN (409),
 * FUNNEL_NOT_PUBLISHED (409, pause/resume before publish), SUBSCRIPTION_REQUIRED (402, create/publish),
 * FORBIDDEN (403, missing funnels.manage / funnels.publish).
 */
import { ApiError, type ApiClient } from "../client";

// ------------------------------------------------------------------ types --

export type FunnelStatus = "draft" | "published" | "paused";

export type FunnelStepTypeDto =
  | "landing"
  | "sales"
  | "opt_in"
  | "checkout"
  | "upsell"
  | "downsell"
  | "thank_you"
  | "custom";

export const FUNNEL_STEP_TYPES: readonly FunnelStepTypeDto[] = [
  "landing",
  "sales",
  "opt_in",
  "checkout",
  "upsell",
  "downsell",
  "thank_you",
  "custom",
];

/** Step types that must reference an active offer before publishing. */
export const FUNNEL_OFFER_STEP_TYPES: readonly FunnelStepTypeDto[] = ["upsell", "downsell"];

export type FunnelEdgeConditionType = "always" | "completed_checkout" | "accepted_offer" | "declined_offer";

export type FunnelEdgeConditionDto = ({ type: FunnelEdgeConditionType } & Record<string, unknown>) | null;

export interface FunnelDto {
  id: string;
  workspaceId: string;
  name: string;
  /** Globally unique, auto-generated from the name on create. */
  subdomain: string | null;
  status: FunnelStatus;
  publishedRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FunnelStepDto {
  id: string;
  workspaceId: string;
  funnelId: string;
  /** Immutable after create; edges reference it. /^[a-z0-9](?:[a-z0-9-_]*[a-z0-9])?$/ */
  key: string;
  stepType: FunnelStepTypeDto;
  name: string;
  /** Page tree (section -> row -> column -> element). */
  builderData: unknown;
  offerId: string | null;
  abTestExperimentId: string | null;
  /** Arbitrary keys are accepted (Joi .unknown(true)). */
  seo: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FunnelEdgeDto {
  id: string;
  workspaceId: string;
  funnelId: string;
  fromStepKey: string;
  toStepKey: string;
  condition: FunnelEdgeConditionDto;
  /** Higher runs first. */
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface FunnelPublishedRevisionDto {
  id: string;
  revisionNumber: number;
  note: string | null;
  createdAt: string;
}

export interface FunnelDetailDto {
  funnel: FunnelDto;
  steps: FunnelStepDto[];
  edges: FunnelEdgeDto[];
  publishedRevision: FunnelPublishedRevisionDto | null;
}

export interface FunnelRevisionDto {
  id: string;
  revisionNumber: number;
  note: string | null;
  publishedByUserId: string;
  createdAt: string;
  stepCount: number;
}

/** One entry of a 422 `error.details[]` (publish graph validation, step/edge validation). */
export interface FunnelProblem {
  field: string;
  message: string;
  stepKey?: string;
}

export interface FunnelCreatePayload {
  name: string;
  subdomain?: string;
}

export interface FunnelUpdatePayload {
  name?: string;
}

export interface FunnelStepCreatePayload {
  key: string;
  stepType: FunnelStepTypeDto;
  name: string;
  builderData?: unknown;
  offerId?: string;
  seo?: Record<string, unknown>;
}

export interface FunnelStepUpdatePayload {
  stepType?: FunnelStepTypeDto;
  name?: string;
  builderData?: unknown;
  offerId?: string | null;
  seo?: Record<string, unknown>;
}

export interface FunnelEdgeCreatePayload {
  fromStepKey: string;
  toStepKey: string;
  condition?: FunnelEdgeConditionDto;
  priority?: number;
}

export type FunnelEdgeUpdatePayload = Partial<FunnelEdgeCreatePayload>;

// ------------------------------------------------------------- endpoints --

const base = (workspaceId: string) => `/workspaces/${workspaceId}/funnels`;

// funnels
export async function funnelsList(client: ApiClient, workspaceId: string): Promise<FunnelDto[]> {
  const { funnels } = await client.request<{ funnels: FunnelDto[] }>(base(workspaceId));
  return funnels;
}

export async function funnelsGet(client: ApiClient, workspaceId: string, funnelId: string): Promise<FunnelDetailDto> {
  return client.request<FunnelDetailDto>(`${base(workspaceId)}/${funnelId}`);
}

export async function funnelsCreate(client: ApiClient, workspaceId: string, payload: FunnelCreatePayload): Promise<FunnelDto> {
  const { funnel } = await client.request<{ funnel: FunnelDto }>(base(workspaceId), { method: "POST", body: payload });
  return funnel;
}

export async function funnelsUpdate(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  payload: FunnelUpdatePayload
): Promise<FunnelDto> {
  const { funnel } = await client.request<{ funnel: FunnelDto }>(`${base(workspaceId)}/${funnelId}`, {
    method: "PATCH",
    body: payload,
  });
  return funnel;
}

export async function funnelsDelete(client: ApiClient, workspaceId: string, funnelId: string): Promise<{ deleted: boolean }> {
  return client.request<{ deleted: boolean }>(`${base(workspaceId)}/${funnelId}`, { method: "DELETE" });
}

// publish / revisions / rollback / pause
export async function funnelsPublish(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  note?: string
): Promise<{ funnel: FunnelDto; revision: FunnelPublishedRevisionDto }> {
  return client.request(`${base(workspaceId)}/${funnelId}/publish`, {
    method: "POST",
    body: note ? { note } : {},
  });
}

export async function funnelsListRevisions(client: ApiClient, workspaceId: string, funnelId: string): Promise<FunnelRevisionDto[]> {
  const { revisions } = await client.request<{ revisions: FunnelRevisionDto[] }>(`${base(workspaceId)}/${funnelId}/revisions`);
  return revisions;
}

export async function funnelsRollback(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  revisionId: string
): Promise<{ funnel: FunnelDto; rolledBackTo: { id: string; revisionNumber: number } }> {
  return client.request(`${base(workspaceId)}/${funnelId}/revisions/${revisionId}/rollback`, { method: "POST", body: {} });
}

export async function funnelsPause(client: ApiClient, workspaceId: string, funnelId: string): Promise<FunnelDto> {
  const { funnel } = await client.request<{ funnel: FunnelDto }>(`${base(workspaceId)}/${funnelId}/pause`, { method: "POST", body: {} });
  return funnel;
}

export async function funnelsResume(client: ApiClient, workspaceId: string, funnelId: string): Promise<FunnelDto> {
  const { funnel } = await client.request<{ funnel: FunnelDto }>(`${base(workspaceId)}/${funnelId}/resume`, { method: "POST", body: {} });
  return funnel;
}

// steps
export async function funnelsListSteps(client: ApiClient, workspaceId: string, funnelId: string): Promise<FunnelStepDto[]> {
  const { steps } = await client.request<{ steps: FunnelStepDto[] }>(`${base(workspaceId)}/${funnelId}/steps`);
  return steps;
}

export async function funnelsCreateStep(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  payload: FunnelStepCreatePayload
): Promise<FunnelStepDto> {
  const { step } = await client.request<{ step: FunnelStepDto }>(`${base(workspaceId)}/${funnelId}/steps`, {
    method: "POST",
    body: payload,
  });
  return step;
}

export async function funnelsUpdateStep(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  stepId: string,
  payload: FunnelStepUpdatePayload
): Promise<FunnelStepDto> {
  const { step } = await client.request<{ step: FunnelStepDto }>(`${base(workspaceId)}/${funnelId}/steps/${stepId}`, {
    method: "PATCH",
    body: payload,
  });
  return step;
}

/** Also deletes every draft edge touching the step's key (server-side). */
export async function funnelsDeleteStep(client: ApiClient, workspaceId: string, funnelId: string, stepId: string): Promise<{ deleted: boolean }> {
  return client.request<{ deleted: boolean }>(`${base(workspaceId)}/${funnelId}/steps/${stepId}`, { method: "DELETE" });
}

// edges
export async function funnelsListEdges(client: ApiClient, workspaceId: string, funnelId: string): Promise<FunnelEdgeDto[]> {
  const { edges } = await client.request<{ edges: FunnelEdgeDto[] }>(`${base(workspaceId)}/${funnelId}/edges`);
  return edges;
}

export async function funnelsCreateEdge(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  payload: FunnelEdgeCreatePayload
): Promise<FunnelEdgeDto> {
  const { edge } = await client.request<{ edge: FunnelEdgeDto }>(`${base(workspaceId)}/${funnelId}/edges`, {
    method: "POST",
    body: payload,
  });
  return edge;
}

export async function funnelsUpdateEdge(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  edgeId: string,
  payload: FunnelEdgeUpdatePayload
): Promise<FunnelEdgeDto> {
  const { edge } = await client.request<{ edge: FunnelEdgeDto }>(`${base(workspaceId)}/${funnelId}/edges/${edgeId}`, {
    method: "PATCH",
    body: payload,
  });
  return edge;
}

export async function funnelsDeleteEdge(client: ApiClient, workspaceId: string, funnelId: string, edgeId: string): Promise<{ deleted: boolean }> {
  return client.request<{ deleted: boolean }>(`${base(workspaceId)}/${funnelId}/edges/${edgeId}`, { method: "DELETE" });
}

// helpers
/** The `error.details[]` problem list of a 422, or [] for anything else. */
export function funnelsProblemsOf(err: unknown): FunnelProblem[] {
  if (!(err instanceof ApiError) || err.status !== 422) return [];
  const body = err.details as { error?: { details?: unknown } } | undefined;
  const details = body?.error?.details;
  if (!Array.isArray(details)) return [];
  return details.filter(
    (d): d is FunnelProblem => !!d && typeof (d as FunnelProblem).message === "string"
  );
}

// ------------------------------------------------------- public runtime --
// Mounted at /store/:workspaceId/funnels (backend: funnelsPublicRoutes.js). No
// staff auth — every call passes `auth: false`, like the storefront methods on
// ApiClient. `workspaceId` may be the store's UUID or its slug.
//
// Codes: 404 NOT_FOUND "Funnel not found" (unknown, draft or unpublished),
// 404 NOT_FOUND "FunnelSession not found", 410 FUNNEL_PAUSED, and 422
// VALIDATION_ERROR when an upsell is accepted before any checkout order exists.

/** What the visitor did on the current step; the backend routes the matching edge. */
export type FunnelOutcomeType = "completed_checkout" | "accepted_offer" | "declined_offer" | "clicked_through";

export interface FunnelOutcome {
  type: FunnelOutcomeType;
  /** Only with `completed_checkout`: the order just placed on this step. */
  orderId?: string;
}

export interface FunnelSessionDto {
  id: string;
  currentStepKey: string;
  /** Step keys already finished, oldest first. */
  path: string[];
  status: "active" | "completed";
  /** The order placed on the checkout step, once there is one. */
  orderId: string | null;
}

/** One step, from the funnel's published snapshot — never the draft. */
export interface FunnelPublicStepDto {
  key: string;
  name: string;
  stepType: FunnelStepTypeDto;
  /** Page tree (section -> row -> column -> element), same shape the page engine renders. */
  tree: unknown;
  seo: Record<string, unknown>;
}

/** Only upsell/downsell steps carry one. Amounts are integer minor units (BIGINT may arrive as a string). */
export interface FunnelPublicOfferDto {
  id: string;
  name: string;
  priceAmount: number | string | null;
  currency: string;
  badge: string | null;
  lines: { variantId: string; quantity: number }[];
}

/** The order an accepted upsell/downsell created, linked to the checkout order. */
export interface FunnelFollowOnOrderDto {
  id: string;
  orderNumber: string;
  totalAmount: number | string;
  linkedFromOrderId: string;
}

/** Either a step to render, or `done: true` when no outbound edge matched and the funnel ended. */
export interface FunnelStepResponse {
  session: FunnelSessionDto;
  done?: boolean;
  step?: FunnelPublicStepDto;
  offer?: FunnelPublicOfferDto;
  followOnOrder?: FunnelFollowOnOrderDto;
}

export interface FunnelStartResponse extends FunnelStepResponse {
  funnel: { id: string; name: string; subdomain: string | null };
}

const storeBase = (workspaceId: string) => `/store/${encodeURIComponent(workspaceId)}/funnels`;

/**
 * Enter a funnel by id or subdomain. Resumes the visitor's newest *active*
 * session when there is one, so `visitorId` must be stable per browser.
 */
export async function funnelsStartSession(
  client: ApiClient,
  workspaceId: string,
  funnelRef: string,
  payload: { visitorId: string; attribution?: Record<string, unknown> }
): Promise<FunnelStartResponse> {
  return client.request<FunnelStartResponse>(`${storeBase(workspaceId)}/${encodeURIComponent(funnelRef)}/sessions`, {
    method: "POST",
    body: payload,
    auth: false,
  });
}

export async function funnelsGetSessionStep(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  sessionId: string
): Promise<FunnelStepResponse> {
  return client.request<FunnelStepResponse>(
    `${storeBase(workspaceId)}/${encodeURIComponent(funnelId)}/sessions/${encodeURIComponent(sessionId)}/step`,
    { auth: false }
  );
}

/**
 * Finish the current step. The server serialises advances per session (row
 * lock), creates the follow-on order itself for an accepted offer, and answers
 * with the next step — or `done` when the funnel ends.
 */
export async function funnelsAdvance(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  sessionId: string,
  outcome: FunnelOutcome
): Promise<FunnelStepResponse> {
  return client.request<FunnelStepResponse>(
    `${storeBase(workspaceId)}/${encodeURIComponent(funnelId)}/sessions/${encodeURIComponent(sessionId)}/advance`,
    { method: "POST", body: { outcome }, auth: false }
  );
}

export type FunnelRuntimeErrorKind = "paused" | "unavailable" | "sessionGone" | "offerNeedsOrder" | "other";

/**
 * Sorts a runtime failure. Both 404s share one code, so the message tells a
 * lost session (start again) from a funnel that isn't live (show "not available").
 */
export function funnelsRuntimeErrorKind(err: unknown): FunnelRuntimeErrorKind {
  if (!(err instanceof ApiError)) return "other";
  if (err.status === 410 || err.code === "FUNNEL_PAUSED") return "paused";
  if (err.status === 404) {
    if (/FunnelSession/i.test(err.message)) return "sessionGone";
    if (/^(Funnel|Step) not found/i.test(err.message)) return "unavailable";
    return "other";
  }
  if (err.status === 422) {
    // createFollowOnOrder's own refusal names the `session` field; any other
    // 422 (stock, fraud rules) keeps the server's message.
    const body = err.details as { error?: { details?: { field?: string }[] } } | undefined;
    if (body?.error?.details?.some((d) => d?.field === "session")) return "offerNeedsOrder";
  }
  return "other";
}

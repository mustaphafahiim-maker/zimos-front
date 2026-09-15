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

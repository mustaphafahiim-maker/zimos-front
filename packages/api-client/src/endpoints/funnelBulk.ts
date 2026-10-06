/**
 * Bulk actions on funnels (backend: src/modules/funnels/funnelBulk.js,
 * frontend-handoff 166).
 *
 *   POST /workspaces/:ws/funnels/bulk  { action, funnelIds: 1–50 uuids, note? (publish only) }
 *
 * Permissions follow the single buttons: publish / pause / resume need
 * funnels.publish (publish and resume also a live store: 402/403 from the
 * subscription guard), duplicate / delete need funnels.manage (duplicate is
 * refused on a restricted store and counts against the plan per copy). A
 * refused permission fails the whole request; otherwise the answer is always
 * 200 and reports each funnel on its own.
 */
import { ApiError, type ApiClient } from "../client";

export type FunnelBulkAction = "publish" | "pause" | "resume" | "duplicate" | "delete";

export const FUNNEL_BULK_ACTIONS: readonly FunnelBulkAction[] = ["publish", "pause", "resume", "duplicate", "delete"];

/** Most funnels one request takes. */
export const FUNNEL_BULK_MAX = 50;

export interface FunnelBulkError {
  code: string;
  message: string;
  /** VALIDATION_ERROR on publish: the funnel's problems ({ message, … }[]). */
  details?: unknown;
}

export interface FunnelBulkResult {
  funnelId: string;
  /** Null when the funnel was not found in this store. */
  name: string | null;
  ok: boolean;
  /** Duplicate only: the copy's id. */
  newFunnelId?: string;
  error?: FunnelBulkError;
}

export interface FunnelBulkResponse {
  action: FunnelBulkAction;
  total: number;
  succeeded: number;
  failed: number;
  results: FunnelBulkResult[];
}

export interface FunnelBulkPayload {
  action: FunnelBulkAction;
  funnelIds: string[];
  /** Publish only: the revision note, as on the single publish. */
  note?: string;
}

export function funnelBulk(client: ApiClient, workspaceId: string, payload: FunnelBulkPayload): Promise<FunnelBulkResponse> {
  return client.request<FunnelBulkResponse>(`/workspaces/${workspaceId}/funnels/bulk`, { method: "POST", body: payload });
}

const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION_ERROR: 422,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  SUBSCRIPTION_REQUIRED: 402,
  PLAN_LIMIT_REACHED: 402,
  INTERNAL_SERVER_ERROR: 500,
};

/**
 * One funnel's refusal as the ApiError its own button would have thrown, so
 * the apps' error translators (and `funnelsProblemsOf`) read it the same way.
 * Null for a funnel that went through.
 */
export function funnelBulkErrorOf(result: FunnelBulkResult): ApiError | null {
  if (result.ok || !result.error) return null;
  const { code, message, details } = result.error;
  return new ApiError(message, STATUS_BY_CODE[code] ?? 409, code, { error: { code, message, details } });
}

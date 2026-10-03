/**
 * Funnel share codes, import by code, the map editor's server-side draft and
 * the issues list (lane 5). Backend: src/modules/funnels/funnelExtras.js,
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
}

export interface FunnelIssues {
  issues: FunnelIssue[];
  counts: { fatal: number; warning: number };
}

export function funnelExtrasIssues(client: ApiClient, workspaceId: string, funnelId: string): Promise<FunnelIssues> {
  return client.request<FunnelIssues>(base(workspaceId) + "/" + funnelId + "/issues");
}

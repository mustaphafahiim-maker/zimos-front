/**
 * The store's activity log: /workspaces/:id/audit-logs (audit_log.view).
 */

import type { ApiClient } from "../client";
// ------------------------------------------------------------ activity log --

export interface ActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  ipAddress: string | null;
  actor: { id: string; fullName: string | null; email: string } | null;
  before: unknown;
  after: unknown;
}

export interface ActivityLogParams {
  limit?: number;
  /** `nextCursor` of the previous page. */
  before?: string;
  /** Prefix of the action name: "order", "product", "membership"… */
  action?: string;
  actorUserId?: string;
  from?: string;
}

export async function activityLogList(
  client: ApiClient,
  workspaceId: string,
  params: ActivityLogParams = {}
): Promise<{ logs: ActivityLogEntry[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return client.request(`/workspaces/${workspaceId}/audit-logs${suffix}`);
}

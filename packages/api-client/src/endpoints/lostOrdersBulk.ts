/**
 * Lost orders in bulk (backend: checkoutSessions/lostOrderBulk.js).
 *
 *   POST /workspaces/:ws/checkout-sessions/bulk-delete { ids } — at most 500;
 *   lost orders that became orders are kept and counted as skipped.
 */
import type { ApiClient } from "../client";

export async function lostOrdersBulkDelete(client: ApiClient, workspaceId: string, ids: string[]): Promise<{ deleted: number; skipped: number }> {
  return client.request(`/workspaces/${workspaceId}/checkout-sessions/bulk-delete`, { method: "POST", body: { ids } });
}

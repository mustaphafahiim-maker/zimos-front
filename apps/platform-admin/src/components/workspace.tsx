import { Status, StatusBadge } from "@/components/StatusBadge";
import type { AdminWorkspaceRow } from "@/lib/adminApi";

/**
 * A workspace's billing state. A workspace that has never subscribed has no
 * subscription row at all, which is a real state worth showing rather than
 * flattening into "canceled".
 */
export function WorkspaceStatus({ row }: { row: AdminWorkspaceRow }) {
  if (!row.subscription) return <StatusBadge tone="neutral">No subscription</StatusBadge>;
  return <Status value={row.subscription.status} />;
}

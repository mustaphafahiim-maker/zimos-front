import { Status, StatusBadge } from "@/components/StatusBadge";
import type { AdminWorkspaceRow } from "@/lib/adminApi";

/**
 * A workspace's billing state, plus whether the store is suspended by hand or
 * restricted — those are separate from billing, so they get badges of their
 * own. A workspace that has never subscribed has no subscription row at all,
 * which is a real state worth showing rather than flattening into "canceled".
 */
export function WorkspaceStatus({ row }: { row: AdminWorkspaceRow }) {
  const ws = row.workspace;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {ws.draft ? (
        <StatusBadge tone="info" dot>
          Draft — not subscribed
        </StatusBadge>
      ) : row.subscription ? (
        <Status value={row.subscription.status} />
      ) : (
        <StatusBadge tone="neutral">No subscription</StatusBadge>
      )}
      {ws.suspended && (
        <StatusBadge tone="danger" dot>
          Suspended
        </StatusBadge>
      )}
      {!ws.suspended && ws.restricted && (
        <StatusBadge tone="danger" dot>
          Restricted
        </StatusBadge>
      )}
    </span>
  );
}

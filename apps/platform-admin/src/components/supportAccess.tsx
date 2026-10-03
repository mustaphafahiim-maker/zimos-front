import { adminSupportAccess } from "@store-builder/api-client";
import { Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { useAsync } from "@/lib/useAsync";
import { apiClient } from "@/lib/apiClient";
import { formatDateTime, formatRelative } from "@/lib/format";

/**
 * Whether the merchant has let support into this store right now. The
 * merchant grants and revokes it from their own Settings → Security; nothing
 * here can open it. Without a grant, the store's data stays closed to the
 * platform team.
 */
export function SupportAccessPanel({ workspaceId }: { workspaceId: string }) {
  const { data, loading, error } = useAsync(() => adminSupportAccess(apiClient, workspaceId), [workspaceId]);
  if (loading || error) return null;
  return (
    <Panel
      title="Support access"
      actions={data ? <StatusBadge tone="success">Granted</StatusBadge> : <StatusBadge tone="neutral">Not granted</StatusBadge>}
    >
      <p className="text-sm text-ink-soft">
        {data
          ? `The merchant allowed support into this store until ${formatDateTime(data.expiresAt)}${data.note ? ` — “${data.note}”` : ""}. ${
              data.lastUsedAt ? `Last used ${formatRelative(data.lastUsedAt)}.` : "Not used yet."
            }`
          : "The merchant has not allowed support into this store. They can do it from Settings → Security in their dashboard, for a set time."}
      </p>
    </Panel>
  );
}

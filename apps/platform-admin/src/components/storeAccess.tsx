import { useState, type FormEvent } from "react";
import { Ban, PlayCircle } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import type { AdminStoreAccess } from "@store-builder/api-client";
import { DataState } from "@/components/DataState";
import { DetailRow } from "@/components/Drawer";
import { Modal } from "@/components/Modal";
import { Panel } from "@/components/Panel";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { TextAreaField } from "@/components/forms";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import { BILLING_PHASE_LABELS } from "@/lib/billing";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { P } from "@/lib/permissions";

/**
 * A store's access, on its workspace page: the manual suspension and the
 * billing lifecycle side by side, because they are independent — either one
 * restricts the store (storefront unavailable, no new products or funnels),
 * reactivating lifts only the suspension, and paying lifts only billing.
 */
export function StoreAccessPanel({ workspaceId, onChanged }: { workspaceId: string; onChanged?: () => void }) {
  const toast = useToast();
  const { can } = useAuth();
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.getStoreAccess(workspaceId), [workspaceId]);
  const [acting, setActing] = useState<"suspend" | "reactivate" | null>(null);

  return (
    <Panel title="Store access">
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && (
          <div className="space-y-4">
            <Summary access={data} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">Manual suspension</p>
                <dl>
                  <DetailRow label="State">
                    {data.suspension.suspended ? (
                      <StatusBadge tone="danger" dot>
                        Suspended
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone="success" dot>
                        Not suspended
                      </StatusBadge>
                    )}
                  </DetailRow>
                  {data.suspension.suspended && (
                    <>
                      <DetailRow label="Since">
                        <span title={formatDateTime(data.suspension.suspendedAt)}>{formatRelative(data.suspension.suspendedAt)}</span>
                        {data.suspension.suspendedBy && <span className="text-ink-soft"> · {data.suspension.suspendedBy.fullName}</span>}
                      </DetailRow>
                      <DetailRow label="Reason">{data.suspension.suspensionReason}</DetailRow>
                    </>
                  )}
                </dl>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">Billing</p>
                <dl>
                  <DetailRow label="Lifecycle">
                    <StatusBadge tone={BILLING_PHASE_LABELS[data.billing.phase].tone} dot>
                      {BILLING_PHASE_LABELS[data.billing.phase].label}
                    </StatusBadge>
                  </DetailRow>
                  <DetailRow label="Subscription">{data.billing.status ? <Status value={data.billing.status} /> : "—"}</DetailRow>
                  <DetailRow label="Period ends">{formatDate(data.billing.periodEnd)}</DetailRow>
                  {data.billing.phase !== "ok" && data.billing.restrictsAt && (
                    <DetailRow label="Restricted from">{formatDateTime(data.billing.restrictsAt)} if unpaid</DetailRow>
                  )}
                </dl>
                {!data.billing.enforced && (
                  <p className="mt-2 text-xs text-ink-soft">
                    Billing restrictions only warn on this server (BILLING_RESTRICTIONS=warn): an unpaid store is never
                    restricted.
                  </p>
                )}
              </div>
            </div>
            {can(P.WORKSPACES_MANAGE) && (
              <div className="flex justify-end">
                {data.suspension.suspended ? (
                  <Button variant="outline" onClick={() => setActing("reactivate")}>
                    <PlayCircle /> Reactivate store
                  </Button>
                ) : (
                  <Button variant="destructive" onClick={() => setActing("suspend")}>
                    <Ban /> Suspend store
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </DataState>

      {acting && (
        <SuspensionModal
          action={acting}
          onClose={() => setActing(null)}
          onDone={(access) => {
            setData(access);
            toast.success(
              acting === "suspend"
                ? "Store suspended. Its storefront is now unavailable."
                : access.restricted
                  ? "Suspension lifted. The store is still restricted by its unpaid subscription."
                  : "Store reactivated."
            );
            setActing(null);
            onChanged?.();
          }}
          workspaceId={workspaceId}
        />
      )}
    </Panel>
  );
}

function Summary({ access }: { access: AdminStoreAccess }) {
  if (!access.restricted) {
    return <Alert>Serving normally: the storefront is up and products and funnels can be created.</Alert>;
  }
  const why = access.reasons
    .map((r) => (r === "suspended" ? "suspended by hand" : "unpaid past its grace day"))
    .join(" and ");
  return (
    <Alert variant="danger">
      Restricted — {why}. The storefront shows “currently unavailable” and new products and funnels can’t be created.
      {access.reasons.length > 1 && " Both have to be cleared before it serves again."}
    </Alert>
  );
}

function SuspensionModal({
  action,
  workspaceId,
  onClose,
  onDone,
}: {
  action: "suspend" | "reactivate";
  workspaceId: string;
  onClose: () => void;
  onDone: (access: AdminStoreAccess) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suspending = action === "suspend";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onDone(
        suspending
          ? await adminApi.suspendWorkspace(workspaceId, reason.trim())
          : await adminApi.reactivateWorkspace(workspaceId, reason.trim())
      );
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={suspending ? "Suspend store" : "Reactivate store"}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="suspension-form" variant={suspending ? "destructive" : "default"} disabled={busy || !reason.trim()}>
            {busy ? "Saving…" : suspending ? "Suspend store" : "Reactivate store"}
          </Button>
        </>
      }
    >
      <form id="suspension-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Alert>
          {suspending
            ? "The storefront shows “currently unavailable” on every page and the merchant can’t create products or funnels until the store is reactivated. Its subscription and billing are not touched, and paying does not lift a suspension. The merchant is told the store is suspended, not why."
            : "Lifts the manual suspension only. If the subscription is also unpaid past its grace day, the store stays restricted until it is paid."}
        </Alert>
        <TextAreaField
          label="Reason"
          required
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={2000}
          rows={3}
          hint="Kept in the audit log. Internal — never shown to the merchant."
        />
      </form>
    </Modal>
  );
}

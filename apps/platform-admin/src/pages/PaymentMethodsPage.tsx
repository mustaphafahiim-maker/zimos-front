import { useState } from "react";
import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import type { AdminPaymentMethod } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Panel, Mono } from "@/components/Panel";
import { Status } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/forms";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { P } from "@/lib/permissions";
import * as adminApi from "@/lib/adminApi";

/**
 * The ways merchants can pay Zimos. Reading is for whoever reviews payments;
 * turning a method on or off and the order need payment_methods.manage, and
 * a manual method's number payment_methods.edit_numbers (the creator's unless
 * granted). A gateway shows whether it is on here and whether the server's
 * environment has what it needs — by variable names, never a value.
 */
export function PaymentMethodsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const canManage = can(P.PAYMENT_METHODS_MANAGE);
  const canEditNumbers = can(P.PAYMENT_METHODS_EDIT_NUMBERS);
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.listPaymentMethods(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPaymentMethod | null>(null);
  const methods = data?.methods ?? [];

  async function setEnabled(code: string, enabled: boolean) {
    setBusy(code);
    try {
      await adminApi.updatePaymentMethod(code, { enabled });
      await refresh({ silent: true });
      toast.success(enabled ? "Turned on." : "Turned off.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function move(index: number, step: -1 | 1) {
    const codes = methods.map((m) => m.code);
    const target = index + step;
    if (target < 0 || target >= codes.length) return;
    [codes[index], codes[target]] = [codes[target], codes[index]];
    setBusy("order");
    try {
      setData(await adminApi.reorderPaymentMethods(codes));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Payment methods"
        description="How merchants pay their subscription. Merchants see the ones that are on, in this order."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      {!canManage && (
        <Alert className="mb-4">Turning methods on or off needs the “Payment methods — turn on and off” permission.</Alert>
      )}
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        <div className="space-y-4">
          {methods.length === 0 ? (
            <EmptyBlock message="No payment methods yet." />
          ) : (
            <Panel flush>
              <ul className="divide-y divide-line">
                {methods.map((m, index) => (
                  <li key={m.code} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                        {m.labelEn}
                        <span className="font-normal text-ink-soft" dir="rtl">
                          {m.labelAr}
                        </span>
                        <Mono className="text-xs">{m.code}</Mono>
                        <Status value={m.offered ? "active" : "inactive"} label={m.offered ? "Offered to merchants" : "Not offered"} />
                      </p>
                      {m.kind === "manual" ? (
                        <p className="text-sm text-ink-soft">
                          Transfer to <span dir="ltr" className="font-mono text-ink">{m.accountNumber || "— no number yet —"}</span>
                          {(m.noteEn || m.noteAr) && <span className="block text-xs">{m.noteEn || m.noteAr}</span>}
                        </p>
                      ) : (
                        <GatewayState method={m} />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canManage && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Move ${m.labelEn} up`}
                            disabled={busy !== null || index === 0}
                            onClick={() => void move(index, -1)}
                          >
                            <ArrowUp />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Move ${m.labelEn} down`}
                            disabled={busy !== null || index === methods.length - 1}
                            onClick={() => void move(index, 1)}
                          >
                            <ArrowDown />
                          </Button>
                        </>
                      )}
                      {m.kind === "manual" && canEditNumbers && (
                        <Button size="sm" variant="outline" onClick={() => setEditing(m)}>
                          Edit number
                        </Button>
                      )}
                      <Toggle
                        checked={m.enabled}
                        label={`${m.labelEn} on`}
                        hideLabel
                        disabled={!canManage || busy !== null}
                        onChange={(next) => void setEnabled(m.code, next)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {(data?.gatewaysNotAdded.length ?? 0) > 0 && (
            <Panel title="Gateways not added yet" description="This server has these gateways. Turning one on adds it to the list above.">
              <ul className="space-y-3">
                {data!.gatewaysNotAdded.map((g) => (
                  <li key={g.code} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      <span className="font-medium text-ink">{g.name}</span> <Mono className="text-xs">{g.code}</Mono>
                      <span className="block text-xs text-ink-soft">
                        {g.configured ? "Configured in the environment." : `Not configured: ${g.missing.join(", ")}`}
                      </span>
                    </div>
                    {canManage && (
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void setEnabled(g.code, true)}>
                        Add and turn on
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </DataState>

      {editing && (
        <AccountDialog
          method={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.success("Saved. The change is in the audit log.");
            void refresh({ silent: true });
          }}
        />
      )}
    </div>
  );
}

function GatewayState({ method }: { method: AdminPaymentMethod }) {
  const g = method.gateway;
  if (!g) return null;
  return (
    <p className="text-sm text-ink-soft">
      {g.name ?? method.code} · {method.enabled ? "On here" : "Off here"} ·{" "}
      {!g.adapterInstalled
        ? "this server has no adapter for it"
        : g.configured
          ? "configured in the environment"
          : `not configured in the environment (${g.missing.join(", ")})`}
    </p>
  );
}

function AccountDialog({ method, onClose, onSaved }: { method: AdminPaymentMethod; onClose: () => void; onSaved: () => void }) {
  const [accountNumber, setAccountNumber] = useState(method.accountNumber ?? "");
  const [noteAr, setNoteAr] = useState(method.noteAr ?? "");
  const [noteEn, setNoteEn] = useState(method.noteEn ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.updatePaymentMethodAccount(method.code, { accountNumber: accountNumber.trim(), noteAr: noteAr.trim(), noteEn: noteEn.trim() });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={`${method.labelEn}: where the money goes`}
      description="Merchants send their transfers here. Check it twice: a wrong number sends their money elsewhere."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy || !accountNumber.trim()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextField label="Number or InstaPay address" dir="ltr" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} maxLength={80} required />
        <TextField label="Note in Arabic (optional)" dir="rtl" value={noteAr} onChange={(e) => setNoteAr(e.target.value)} maxLength={500} />
        <TextField label="Note in English (optional)" value={noteEn} onChange={(e) => setNoteEn(e.target.value)} maxLength={500} />
        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

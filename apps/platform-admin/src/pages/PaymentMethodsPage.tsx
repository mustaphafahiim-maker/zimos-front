import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import { Alert, Button, buttonVariants } from "@store-builder/ui";
import {
  adminPaymentMethodAccount,
  adminPaymentMethodUpdate,
  adminPaymentMethodsList,
  adminPaymentMethodsReorder,
  apiErrorCode,
  apiFieldProblems,
  type AdminPaymentMethod,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { TextAreaField, TextField } from "@/components/forms";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { P } from "@/lib/permissions";
import { useAsync } from "@/lib/useAsync";

/**
 * Billing → Payment methods: how merchants pay their ZIMOS subscription and
 * top up their balance — manual transfers (InstaPay, a wallet) with the number
 * they send to, and the payment gateways. Order, on/off and labels need
 * `payment_methods.manage`; the numbers need `payment_methods.edit_numbers`.
 */
export function PaymentMethodsPage() {
  const toast = useToast();
  const { can } = useAuth();
  const canManage = can(P.PAYMENT_METHODS_MANAGE);
  const canEditNumbers = can(P.PAYMENT_METHODS_EDIT_NUMBERS);
  const { data, loading, error, refresh, setData } = useAsync(() => adminPaymentMethodsList(apiClient), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPaymentMethod | null>(null);

  function replace(method: AdminPaymentMethod) {
    setData((prev) => (prev ? { ...prev, methods: prev.methods.map((m) => (m.code === method.code ? method : m)) } : prev!));
  }

  async function setEnabled(method: AdminPaymentMethod, enabled: boolean) {
    setBusy(method.code);
    try {
      replace(await adminPaymentMethodUpdate(apiClient, method.code, { enabled }));
      toast.success(`${method.labelEn} turned ${enabled ? "on" : "off"}.`);
    } catch (err) {
      toast.error(apiErrorCode(err) === "PAYMENT_METHOD_NEEDS_NUMBER" ? "Set the number before turning it on" : getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function addGateway(code: string, name: string) {
    setBusy(code);
    try {
      await adminPaymentMethodUpdate(apiClient, code, { enabled: true });
      toast.success(`${name} added.`);
      await refresh({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function move(index: number, by: -1 | 1) {
    if (!data) return;
    const codes = data.methods.map((m) => m.code);
    const to = index + by;
    if (to < 0 || to >= codes.length) return;
    [codes[index], codes[to]] = [codes[to], codes[index]];
    setBusy("order");
    try {
      setData(await adminPaymentMethodsReorder(apiClient, codes));
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
        description="How merchants pay their ZIMOS subscription and top up their balance. Merchants see them in this order."
        actions={
          <Link to="/payment-proofs" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Transfer proofs
          </Link>
        }
      />
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && (
          <div className="space-y-4">
            <Panel flush>
              <ul className="divide-y divide-line">
                {data.methods.map((m, index) => (
                  <li key={m.code} className="flex flex-wrap items-start gap-4 px-5 py-4" data-testid={`payment-method-${m.code}`}>
                    <div className="flex flex-col gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Move ${m.labelEn} up`}
                        disabled={!canManage || index === 0 || busy !== null}
                        onClick={() => void move(index, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Move ${m.labelEn} down`}
                        disabled={!canManage || index === data.methods.length - 1 || busy !== null}
                        onClick={() => void move(index, 1)}
                      >
                        <ArrowDown />
                      </Button>
                    </div>
                    <div className="min-w-0 flex-[1_1_16rem] space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-ink">{m.labelEn}</h2>
                        <span className="text-sm text-ink-soft" dir="rtl" lang="ar">
                          {m.labelAr}
                        </span>
                        <StatusBadge tone={m.kind === "manual" ? "info" : "primary"}>{m.kind === "manual" ? "Manual transfer" : "Gateway"}</StatusBadge>
                        <StatusBadge tone={m.offered ? "success" : "neutral"} dot>
                          {m.offered ? "Offered to merchants" : "Not offered"}
                        </StatusBadge>
                      </div>
                      {m.kind === "manual" ? (
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                          <dt className="text-ink-soft">Number</dt>
                          <dd className="font-mono text-ink">{m.accountNumber || <span className="font-sans text-ink-soft">Not set</span>}</dd>
                          <dt className="text-ink-soft">Payment link</dt>
                          <dd className="min-w-0 break-all text-ink">{m.paymentLink || <span className="text-ink-soft">—</span>}</dd>
                          <dt className="text-ink-soft">Note in Arabic</dt>
                          <dd className="text-ink">
                            <bdi lang="ar">{m.noteAr || "—"}</bdi>
                          </dd>
                          <dt className="text-ink-soft">Note in English</dt>
                          <dd className="text-ink">{m.noteEn || "—"}</dd>
                        </dl>
                      ) : (
                        <p className="text-sm text-ink">
                          {m.gateway?.configured ? (
                            <StatusBadge tone="success">Configured</StatusBadge>
                          ) : (
                            <>
                              <StatusBadge tone="warning">Not configured</StatusBadge>
                              <span className="ms-2 font-mono text-xs text-ink-soft">Missing: {(m.gateway?.missing ?? []).join(", ") || "—"}</span>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {(canManage || (m.kind === "manual" && canEditNumbers)) && (
                        <Button size="sm" variant="outline" onClick={() => setEditing(m)}>
                          <Pencil /> Edit
                        </Button>
                      )}
                      <div className="flex items-center gap-2 text-sm text-ink">
                        <span>On</span>
                        <Toggle
                          label={`${m.labelEn} on`}
                          hideLabel
                          checked={m.enabled}
                          disabled={!canManage || busy !== null}
                          onChange={(next) => void setEnabled(m, next)}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            {data.gatewaysNotAdded.length > 0 && (
              <Panel title="Gateways not added" flush>
                <ul className="divide-y divide-line">
                  {data.gatewaysNotAdded.map((g) => (
                    <li key={g.code} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-ink">
                          {g.name} <span className="text-xs font-normal text-ink-soft">{g.currencies.join(", ")}</span>
                        </p>
                        {g.configured ? (
                          <StatusBadge tone="success">Configured</StatusBadge>
                        ) : (
                          <p className="font-mono text-xs break-all text-ink-soft">Missing: {g.missing.join(", ")}</p>
                        )}
                      </div>
                      <Button size="sm" variant="outline" disabled={!canManage || busy !== null} onClick={() => void addGateway(g.code, g.name)}>
                        <Plus /> Add
                      </Button>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            {!canManage && <p className="text-xs text-ink-soft">Order, on/off and labels need the “Payment methods — manage” permission.</p>}
          </div>
        )}
      </DataState>

      {editing && (
        <EditMethod
          method={editing}
          canManage={canManage}
          canEditNumbers={canEditNumbers}
          onClose={() => setEditing(null)}
          onSaved={(method) => {
            replace(method);
            setEditing(null);
            toast.success(`${method.labelEn} saved.`);
          }}
        />
      )}
    </div>
  );
}

function EditMethod({
  method,
  canManage,
  canEditNumbers,
  onClose,
  onSaved,
}: {
  method: AdminPaymentMethod;
  canManage: boolean;
  canEditNumbers: boolean;
  onClose: () => void;
  onSaved: (method: AdminPaymentMethod) => void;
}) {
  const manual = method.kind === "manual";
  const [labelAr, setLabelAr] = useState(method.labelAr);
  const [labelEn, setLabelEn] = useState(method.labelEn);
  const [accountNumber, setAccountNumber] = useState(method.accountNumber ?? "");
  const [paymentLink, setPaymentLink] = useState(method.paymentLink ?? "");
  const [noteAr, setNoteAr] = useState(method.noteAr ?? "");
  const [noteEn, setNoteEn] = useState(method.noteEn ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLinkError(null);
    const link = paymentLink.trim();
    if (manual && canEditNumbers && link && !/^https:\/\//i.test(link)) {
      setLinkError("The link must start with https://");
      return;
    }
    setBusy(true);
    try {
      let saved = method;
      if (canManage && (labelAr.trim() !== method.labelAr || labelEn.trim() !== method.labelEn)) {
        saved = await adminPaymentMethodUpdate(apiClient, method.code, { labelAr: labelAr.trim(), labelEn: labelEn.trim() });
      }
      if (manual && canEditNumbers) {
        const account: Parameters<typeof adminPaymentMethodAccount>[2] = {};
        if (accountNumber.trim() !== (method.accountNumber ?? "")) account.accountNumber = accountNumber.trim();
        if (link !== (method.paymentLink ?? "")) account.paymentLink = link;
        if (noteAr.trim() !== (method.noteAr ?? "")) account.noteAr = noteAr.trim();
        if (noteEn.trim() !== (method.noteEn ?? "")) account.noteEn = noteEn.trim();
        if (Object.keys(account).length > 0) saved = await adminPaymentMethodAccount(apiClient, method.code, account);
      }
      onSaved(saved);
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === "PAYMENT_METHOD_NEEDS_NUMBER") setError("Turn it off before removing the number");
      else if (apiFieldProblems(err).some((p) => p.field === "paymentLink")) setLinkError("The link must start with https://");
      else setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={`Edit ${method.labelEn}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="payment-method-form" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="payment-method-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Label in English" required value={labelEn} disabled={!canManage} onChange={(e) => setLabelEn(e.target.value)} />
          <TextField label="Label in Arabic" required dir="rtl" value={labelAr} disabled={!canManage} onChange={(e) => setLabelAr(e.target.value)} />
        </div>
        {manual && (
          <>
            <TextField
              label="Number"
              value={accountNumber}
              disabled={!canEditNumbers}
              onChange={(e) => setAccountNumber(e.target.value)}
              hint="The InstaPay address or wallet number merchants send money to."
            />
            <TextField
              label="Payment link (optional)"
              type="url"
              placeholder="https://"
              value={paymentLink}
              disabled={!canEditNumbers}
              error={linkError ?? undefined}
              onChange={(e) => setPaymentLink(e.target.value)}
            />
            <TextAreaField label="Note in Arabic" dir="rtl" rows={2} value={noteAr} disabled={!canEditNumbers} onChange={(e) => setNoteAr(e.target.value)} />
            <TextAreaField label="Note in English" rows={2} value={noteEn} disabled={!canEditNumbers} onChange={(e) => setNoteEn(e.target.value)} />
            {!canEditNumbers && <p className="text-xs text-ink-soft">The number, link and notes need the “Payment methods — edit numbers” permission.</p>}
          </>
        )}
      </form>
    </Modal>
  );
}

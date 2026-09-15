import { useEffect, useState } from "react";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import { Modal } from "@/components/Modal";
import { Field, SelectField } from "@/components/forms";
import { useToast } from "@/components/Toast";
import { adminApi } from "@/mock/adminApi";
import type { AdminWorkspace, BillingCycle, Plan } from "@/mock/types";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";

export function ChangePlanModal({
  ws,
  plans,
  open,
  onClose,
  onDone,
}: {
  ws: AdminWorkspace;
  plans: Plan[];
  open: boolean;
  onClose: () => void;
  onDone: (ws: AdminWorkspace) => void;
}) {
  const toast = useToast();
  const [planId, setPlanId] = useState(ws.meta.planId);
  const [cycle, setCycle] = useState<BillingCycle>(ws.meta.billingCycle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPlanId(ws.meta.planId);
      setCycle(ws.meta.billingCycle);
      setError(null);
    }
  }, [open, ws.meta.planId, ws.meta.billingCycle]);

  const selected = plans.find((p) => p.id === planId);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const next = await adminApi.changePlan(ws.id, planId, cycle);
      toast.success(`${ws.name} moved to ${selected?.name ?? "the new plan"} (${cycle}).`);
      onDone(next);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Change plan"
      description={`Takes effect immediately for ${ws.name}. Proration is handled by billing.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || (planId === ws.meta.planId && cycle === ws.meta.billingCycle)}>
            {busy ? "Saving…" : "Change plan"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <SelectField label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.active && p.id !== ws.meta.planId}>
              {p.name}
              {!p.active ? " (inactive)" : ""}
            </option>
          ))}
        </SelectField>
        <Field label="Billing cycle">
          {() => (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Billing cycle">
              {(["monthly", "yearly"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={cycle === c}
                  onClick={() => setCycle(c)}
                  className={cn(
                    "cursor-pointer rounded-[10px] border px-3 py-2.5 text-start text-sm transition-colors",
                    cycle === c ? "border-primary bg-primary-soft text-ink" : "border-line text-ink-soft hover:border-ink-soft"
                  )}
                >
                  <span className="block font-medium capitalize">{c}</span>
                  {selected && (
                    <span className="tabular text-xs">
                      {formatMoney(c === "monthly" ? selected.monthlyPrice : selected.yearlyPrice)} / {c === "monthly" ? "month" : "year"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </Field>
      </div>
    </Modal>
  );
}

export function ExtendTrialModal({
  ws,
  open,
  onClose,
  onDone,
}: {
  ws: AdminWorkspace | null;
  open: boolean;
  onClose: () => void;
  onDone: (ws: AdminWorkspace) => void;
}) {
  const toast = useToast();
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDays("7");
      setError(null);
    }
  }, [open]);

  if (!ws) return null;
  const n = Number(days);
  const base = ws.meta.trialEndsAt && new Date(ws.meta.trialEndsAt).getTime() > Date.now() ? new Date(ws.meta.trialEndsAt) : new Date();
  const preview = new Date(base);
  if (Number.isFinite(n)) preview.setDate(preview.getDate() + n);

  async function save() {
    if (!ws) return;
    setBusy(true);
    setError(null);
    try {
      const next = await adminApi.extendTrial(ws.id, n);
      toast.success(`Trial for ${ws.name} now ends ${formatDate(next.meta.trialEndsAt)}.`);
      onDone(next);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Extend trial"
      description={
        ws.meta.subscriptionStatus === "trialing"
          ? `Current trial ends ${formatDate(ws.meta.trialEndsAt)}.`
          : `${ws.name} is not trialing — this starts a new trial from today.`
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !Number.isInteger(n) || n < 1 || n > 90}>
            {busy ? "Saving…" : "Extend trial"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Field label="Extend by (days)" hint={`New end date: ${formatDate(preview.toISOString())}`}>
          {(p) => <Input {...p} type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} />}
        </Field>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <Button key={d} type="button" size="sm" variant="outline" onClick={() => setDays(String(d))}>
              +{d} days
            </Button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

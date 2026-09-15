import { useEffect, useState } from "react";
import { Alert, Button, Modal, Toggle } from "@store-builder/ui";
import { SelectField, TextField } from "@/components/forms";
import { useToast } from "@/components/Toast";
import { useStatusLabel } from "@/components/StatusBadge";
import { adminApi, SUBSCRIPTION_STATUSES, type AdminPlan, type BillingCycle, type SubscriptionPatch, type SubscriptionStatus } from "@/lib/adminApi";
import { getErrorMessage } from "@/lib/errors";
import { fromDateInput, toDateInput } from "@/lib/format";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Change subscription",
    description: "Changes apply to {name} immediately and are recorded in the audit log.",
    status: "Status",
    plan: "Plan",
    cycle: "Billing cycle",
    periodEnd: "Current period ends",
    trialEnds: "Trial ends",
    graceUntil: "Grace until",
    cancelAtEnd: "Cancel at period end",
    noChanges: "Nothing changed.",
    saved: "Subscription updated.",
    plansFailed: "Couldn't load plans — plan can't be changed right now.",
    inactive: "(inactive)",
    none: "—",
  },
  ar: {
    title: "تعديل الاشتراك",
    description: "التعديلات بتتطبق على {name} فورًا وبتتسجل في سجل العمليات.",
    status: "الحالة",
    plan: "الباقة",
    cycle: "دورة الفوترة",
    periodEnd: "نهاية الفترة الحالية",
    trialEnds: "نهاية الفترة التجريبية",
    graceUntil: "مهلة لحد",
    cancelAtEnd: "إلغاء في نهاية الفترة",
    noChanges: "مفيش حاجة اتغيرت.",
    saved: "الاشتراك اتعدّل.",
    plansFailed: "مقدرناش نحمّل الباقات — مش هينفع تغيّر الباقة دلوقتي.",
    inactive: "(متوقفة)",
    none: "—",
  },
};

export interface SubscriptionSnapshot {
  status: string;
  planId?: string | null;
  /** Used to match a plan when only the name is known (list rows). */
  planName?: string | null;
  billingCycle?: BillingCycle | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  graceUntil?: string | null;
  cancelAtPeriodEnd?: boolean | null;
}

export function SubscriptionEditor({
  open,
  workspaceId,
  workspaceName,
  current,
  onClose,
  onSaved,
}: {
  open: boolean;
  workspaceId: string;
  workspaceName: string;
  current: SubscriptionSnapshot;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(STRINGS);
  const c = useCommon();
  const toast = useToast();
  const statusLabel = useStatusLabel();
  const [plans, setPlans] = useState<AdminPlan[] | null>(null);
  const [plansError, setPlansError] = useState(false);
  const [status, setStatus] = useState(current.status);
  const [planId, setPlanId] = useState("");
  const [cycle, setCycle] = useState<string>(current.billingCycle ?? "");
  const [periodEnd, setPeriodEnd] = useState(toDateInput(current.currentPeriodEnd));
  const [trialEnds, setTrialEnds] = useState(toDateInput(current.trialEndsAt));
  const [grace, setGrace] = useState(toDateInput(current.graceUntil));
  const [cancelAtEnd, setCancelAtEnd] = useState(!!current.cancelAtPeriodEnd);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialPlanId = current.planId ?? plans?.find((p) => p.name === current.planName)?.id ?? "";

  useEffect(() => {
    if (!open) return;
    setStatus(current.status);
    setCycle(current.billingCycle ?? "");
    setPeriodEnd(toDateInput(current.currentPeriodEnd));
    setTrialEnds(toDateInput(current.trialEndsAt));
    setGrace(toDateInput(current.graceUntil));
    setCancelAtEnd(!!current.cancelAtPeriodEnd);
    setError(null);
    setPlansError(false);
    let cancelled = false;
    adminApi
      .listPlans()
      .then((p) => {
        if (cancelled) return;
        setPlans(p);
        setPlanId(current.planId ?? p.find((x) => x.name === current.planName)?.id ?? "");
      })
      .catch(() => !cancelled && setPlansError(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    const patch: SubscriptionPatch = {};
    if (status !== current.status) patch.status = status as SubscriptionStatus;
    if (planId && planId !== initialPlanId) patch.planId = planId;
    if (cycle && cycle !== (current.billingCycle ?? "")) patch.billingCycle = cycle as BillingCycle;
    if (periodEnd && periodEnd !== toDateInput(current.currentPeriodEnd)) patch.currentPeriodEnd = fromDateInput(periodEnd);
    if (trialEnds !== toDateInput(current.trialEndsAt)) patch.trialEndsAt = trialEnds ? fromDateInput(trialEnds) : null;
    if (current.graceUntil !== undefined && grace !== toDateInput(current.graceUntil)) patch.graceUntil = grace ? fromDateInput(grace) : null;
    if (current.cancelAtPeriodEnd !== undefined && current.cancelAtPeriodEnd !== null && cancelAtEnd !== current.cancelAtPeriodEnd) patch.cancelAtPeriodEnd = cancelAtEnd;
    if (Object.keys(patch).length === 0) {
      setError(t.noChanges);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateSubscription(workspaceId, patch);
      toast.success(t.saved);
      onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.title}
      description={fmt(t.description, { name: workspaceName })}
      closeLabel={c.close}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {c.cancel}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? c.working : c.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        {plansError && <Alert variant="warning">{t.plansFailed}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label={t.status} value={status} onChange={(e) => setStatus(e.target.value)}>
            {SUBSCRIPTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </SelectField>
          <SelectField label={t.plan} value={planId} onChange={(e) => setPlanId(e.target.value)} disabled={!plans}>
            {!planId && <option value="">{plans ? t.none : c.loading}</option>}
            {(plans ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.isActive ? "" : t.inactive}
              </option>
            ))}
          </SelectField>
          {current.billingCycle !== undefined && (
            <SelectField label={t.cycle} value={cycle} onChange={(e) => setCycle(e.target.value)}>
              {!cycle && <option value="">{t.none}</option>}
              <option value="monthly">{statusLabel("monthly")}</option>
              <option value="yearly">{statusLabel("yearly")}</option>
            </SelectField>
          )}
          <TextField label={t.periodEnd} type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          <TextField label={t.trialEnds} type="date" value={trialEnds} onChange={(e) => setTrialEnds(e.target.value)} />
          {current.graceUntil !== undefined && <TextField label={t.graceUntil} type="date" value={grace} onChange={(e) => setGrace(e.target.value)} />}
        </div>
        {current.cancelAtPeriodEnd !== undefined && current.cancelAtPeriodEnd !== null && (
          <Toggle checked={cancelAtEnd} onChange={setCancelAtEnd} label={t.cancelAtEnd} />
        )}
      </div>
    </Modal>
  );
}

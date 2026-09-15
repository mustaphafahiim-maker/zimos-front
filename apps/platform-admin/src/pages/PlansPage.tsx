import { useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField } from "@/components/forms";
import { Toggle } from "@/components/Toggle";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { adminApi } from "@/mock/adminApi";
import { PLAN_FEATURES } from "@/mock/constants";
import type { Plan, PlanFeatureKey } from "@/mock/types";
import { formatBp, formatMoney, formatNumber, formatRelative } from "@/lib/format";

interface PlanForm {
  id?: string;
  name: string;
  code: string;
  monthlyPrice: string;
  yearlyPrice: string;
  trialDays: string;
  orderQuota: string;
  transactionFeeBp: string;
  codFeeBp: string;
  features: PlanFeatureKey[];
  active: boolean;
}

const EMPTY: PlanForm = {
  name: "",
  code: "",
  monthlyPrice: "0",
  yearlyPrice: "0",
  trialDays: "14",
  orderQuota: "",
  transactionFeeBp: "100",
  codFeeBp: "75",
  features: [],
  active: true,
};

function toForm(p: Plan): PlanForm {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    monthlyPrice: String(p.monthlyPrice),
    yearlyPrice: String(p.yearlyPrice),
    trialDays: String(p.trialDays),
    orderQuota: p.orderQuota === null ? "" : String(p.orderQuota),
    transactionFeeBp: String(p.transactionFeeBp),
    codFeeBp: String(p.codFeeBp),
    features: [...p.features],
    active: p.active,
  };
}

export function PlansPage() {
  const toast = useToast();
  const { data, loading, error, refresh } = useAsync(() => adminApi.listPlans(), []);
  const [editing, setEditing] = useState<PlanForm | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);

  return (
    <div>
      <PageHeader
        title="Plans"
        description="Subscription plans offered to merchants."
        actions={
          <Button onClick={() => setEditing({ ...EMPTY })}>
            <Plus /> New plan
          </Button>
        }
      />
      <DataState
        loading={loading}
        error={error}
        onRetry={() => void refresh()}
        empty={!!data && data.length === 0}
        emptyMessage="No plans yet. Create the first plan merchants can subscribe to."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((p) => (
            <article key={p.id} className="flex flex-col rounded-[var(--radius-card)] border border-line bg-paper-raised">
              <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">{p.name}</h2>
                  <p className="font-mono text-xs text-ink-soft">{p.code}</p>
                </div>
                <StatusBadge tone={p.active ? "success" : "neutral"} dot>
                  {p.active ? "Active" : "Inactive"}
                </StatusBadge>
              </div>
              <div className="flex-1 space-y-4 px-5 py-4">
                <div>
                  <p className="tabular text-2xl font-semibold text-ink">
                    {formatMoney(p.monthlyPrice)}
                    <span className="text-sm font-normal text-ink-soft"> / month</span>
                  </p>
                  <p className="tabular text-sm text-ink-soft">{formatMoney(p.yearlyPrice)} / year</p>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-ink-soft">Trial</dt>
                  <dd className="text-end text-ink">{p.trialDays} days</dd>
                  <dt className="text-ink-soft">Order quota</dt>
                  <dd className="text-end text-ink">{p.orderQuota === null ? "Unlimited" : `${formatNumber(p.orderQuota)}/mo`}</dd>
                  <dt className="text-ink-soft">Transaction fee</dt>
                  <dd className="text-end text-ink">{formatBp(p.transactionFeeBp)}</dd>
                  <dt className="text-ink-soft">COD fee</dt>
                  <dd className="text-end text-ink">{formatBp(p.codFeeBp)}</dd>
                </dl>
                <ul className="space-y-1">
                  {PLAN_FEATURES.map((f) => {
                    const on = p.features.includes(f.key);
                    return (
                      <li key={f.key} className={on ? "flex items-center gap-2 text-sm text-ink" : "flex items-center gap-2 text-sm text-ink-soft line-through"}>
                        <Check className={on ? "size-3.5 text-primary" : "size-3.5 opacity-30"} aria-hidden />
                        {f.label}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
                <span className="text-xs text-ink-soft">Updated {formatRelative(p.updatedAt)}</span>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setEditing(toForm(p))}>
                    <Pencil /> Edit
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${p.name}`} onClick={() => setDeleting(p)}>
                    <Trash2 className="text-danger" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </DataState>

      {editing && (
        <PlanEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            toast.success(`Plan “${p.name}” saved.`);
            setEditing(null);
            void refresh({ silent: true });
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={`Delete plan “${deleting?.name ?? ""}”?`}
        description="Plans with active workspaces can't be deleted — mark them inactive instead."
        confirmLabel="Delete plan"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await adminApi.deletePlan(deleting.id);
          toast.success("Plan deleted.");
          setDeleting(null);
          void refresh({ silent: true });
        }}
      />
    </div>
  );
}

function PlanEditor({ initial, onClose, onSaved }: { initial: PlanForm; onClose: () => void; onSaved: (p: Plan) => void }) {
  const [form, setForm] = useState<PlanForm>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const nums = [form.monthlyPrice, form.yearlyPrice, form.trialDays, form.transactionFeeBp, form.codFeeBp].map(Number);
    if (nums.some((n) => !Number.isFinite(n))) {
      setError("Prices, trial days and fees must be numbers.");
      return;
    }
    const quota = form.orderQuota.trim() === "" ? null : Number(form.orderQuota);
    if (quota !== null && (!Number.isInteger(quota) || quota < 1)) {
      setError("Order quota must be a whole number, or empty for unlimited.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await adminApi.savePlan({
        id: form.id,
        name: form.name,
        code: form.code,
        monthlyPrice: nums[0],
        yearlyPrice: nums[1],
        trialDays: Math.max(0, Math.round(nums[2])),
        orderQuota: quota,
        transactionFeeBp: Math.round(nums[3]),
        codFeeBp: Math.round(nums[4]),
        features: form.features,
        active: form.active,
      });
      onSaved(saved);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={form.id ? `Edit ${initial.name}` : "New plan"}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" disabled={busy}>
            {busy ? "Saving…" : "Save plan"}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          <TextField label="Code" hint="Lowercase identifier used by billing. Derived from the name if empty." value={form.code} onChange={(e) => set("code", e.target.value)} />
          <TextField label="Monthly price" type="number" min={0} step="1" required value={form.monthlyPrice} onChange={(e) => set("monthlyPrice", e.target.value)} />
          <TextField label="Yearly price" type="number" min={0} step="1" required value={form.yearlyPrice} onChange={(e) => set("yearlyPrice", e.target.value)} />
          <TextField label="Trial days" type="number" min={0} max={90} required value={form.trialDays} onChange={(e) => set("trialDays", e.target.value)} />
          <TextField label="Order quota / month" type="number" min={1} hint="Leave empty for unlimited." value={form.orderQuota} onChange={(e) => set("orderQuota", e.target.value)} />
          <TextField
            label="Transaction fee (bp)"
            type="number"
            min={0}
            required
            hint={Number.isFinite(Number(form.transactionFeeBp)) ? `= ${formatBp(Number(form.transactionFeeBp))} per online payment` : undefined}
            value={form.transactionFeeBp}
            onChange={(e) => set("transactionFeeBp", e.target.value)}
          />
          <TextField
            label="COD fee (bp)"
            type="number"
            min={0}
            required
            hint={Number.isFinite(Number(form.codFeeBp)) ? `= ${formatBp(Number(form.codFeeBp))} per COD order` : undefined}
            value={form.codFeeBp}
            onChange={(e) => set("codFeeBp", e.target.value)}
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Features</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PLAN_FEATURES.map((f) => {
              const checked = form.features.includes(f.key);
              return (
                <label key={f.key} className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line px-3 py-2 text-sm text-ink hover:border-ink-soft">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-primary)]"
                    checked={checked}
                    onChange={() => set("features", checked ? form.features.filter((k) => k !== f.key) : [...form.features, f.key])}
                  />
                  {f.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <Toggle label="Active" description="Inactive plans stay on existing workspaces but can't be chosen for new ones." checked={form.active} onChange={(v) => set("active", v)} />
      </form>
    </Modal>
  );
}

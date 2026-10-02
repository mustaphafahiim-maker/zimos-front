import { useId, useState, type FormEvent } from "react";
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
import * as adminApi from "@/lib/adminApi";
import { ANNUAL_PRICE_MONTHS } from "@/lib/billing";
import { PLAN_FEATURES } from "@/lib/planFeatures";
import { FeaturePicker } from "@/components/FeaturePicker";
import type { AdminPlan as Plan, PlanFeatureKey } from "@store-builder/api-client";
import {
  PLATFORM_CURRENCY,
  formatBp,
  formatMinorMoney,
  formatNumber,
  formatRelative,
  minorUnitDigits,
  toMajorAmount,
  toMinorAmount,
} from "@/lib/format";

interface PlanForm {
  id?: string;
  name: string;
  code: string;
  /** The plan's currency: prices are typed in it and sent in its minor units. */
  currency: string;
  /** Whole currency units as typed (299), not minor units. */
  monthlyPrice: string;
  yearlyPrice: string;
  trialDays: string;
  orderQuota: string;
  transactionFeeBp: string;
  codFeeBp: string;
  features: PlanFeatureKey[];
  active: boolean;
  /** Whole numbers as typed; ignored while the matching "unlimited" box is ticked. */
  maxStores: string;
  storesUnlimited: boolean;
  maxFunnels: string;
  funnelsUnlimited: boolean;
  /** Listed on the marketing site and offered at sign-up. */
  isPublic: boolean;
  displayOrder: string;
  /** The pay-per-order fee in whole currency units as typed (0.50); "0" = none. */
  perOrderFee: string;
}

// A new plan is priced in the platform currency (EGP, also the API's default
// for plans.currency) and is saved with it, so the price the form shows is the
// one stored. An existing plan keeps its own currency.
const EMPTY: PlanForm = {
  name: "",
  code: "",
  currency: PLATFORM_CURRENCY,
  monthlyPrice: "0",
  yearlyPrice: "0",
  trialDays: "14",
  orderQuota: "",
  transactionFeeBp: "100",
  codFeeBp: "75",
  features: [],
  active: true,
  maxStores: "1",
  storesUnlimited: true,
  maxFunnels: "10",
  funnelsUnlimited: true,
  // Never shown to the public until someone decides it should be.
  isPublic: false,
  displayOrder: "0",
  perOrderFee: "0",
};

function toForm(p: Plan): PlanForm {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    currency: p.currency,
    monthlyPrice: String(toMajorAmount(p.monthlyPrice, p.currency)),
    yearlyPrice: String(toMajorAmount(p.yearlyPrice, p.currency)),
    trialDays: String(p.trialDays),
    orderQuota: p.orderQuota === null ? "" : String(p.orderQuota),
    transactionFeeBp: String(p.transactionFeeBp),
    codFeeBp: String(p.codFeeBp),
    features: [...p.features],
    active: p.active,
    maxStores: p.maxStores === null || p.maxStores === undefined ? "1" : String(p.maxStores),
    storesUnlimited: p.maxStores === null || p.maxStores === undefined,
    maxFunnels: p.maxFunnelsPerMonth === null || p.maxFunnelsPerMonth === undefined ? "10" : String(p.maxFunnelsPerMonth),
    funnelsUnlimited: p.maxFunnelsPerMonth === null || p.maxFunnelsPerMonth === undefined,
    isPublic: Boolean(p.isPublic),
    displayOrder: String(p.displayOrder ?? 0),
    perOrderFee: String(toMajorAmount(p.perOrderFee ?? 0, p.currency)),
  };
}

/** A whole number in [min, max] typed into a field, or null when it isn't one. */
function wholeNumber(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return n >= min && n <= max ? n : null;
}

function limitLabel(value: number | null | undefined, unit: string): string {
  return value === null || value === undefined ? "Unlimited" : `${formatNumber(value)} ${unit}`;
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
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge tone={p.active ? "success" : "neutral"} dot>
                    {p.active ? "Active" : "Inactive"}
                  </StatusBadge>
                  <StatusBadge tone={p.isPublic ? "info" : "neutral"}>
                    {p.isPublic ? `Shown at sign-up · #${p.displayOrder}` : "Hidden from sign-up"}
                  </StatusBadge>
                </div>
              </div>
              <div className="flex-1 space-y-4 px-5 py-4">
                <div>
                  <p className="tabular text-2xl font-semibold text-ink">
                    {formatMinorMoney(p.monthlyPrice, p.currency)}
                    <span className="text-sm font-normal text-ink-soft"> / month</span>
                  </p>
                  <p className="tabular text-sm text-ink-soft">
                    {formatMinorMoney(p.yearlyPrice, p.currency)} / year
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-ink-soft">Free trial</dt>
                  <dd className="text-end text-ink">{p.trialDays > 0 ? `${p.trialDays} days` : "None"}</dd>
                  <dt className="text-ink-soft">Stores per owner</dt>
                  <dd className="text-end text-ink">{limitLabel(p.maxStores, p.maxStores === 1 ? "store" : "stores")}</dd>
                  <dt className="text-ink-soft">Funnels per month</dt>
                  <dd className="text-end text-ink">{limitLabel(p.maxFunnelsPerMonth, "/mo")}</dd>
                  <dt className="text-ink-soft">Order quota</dt>
                  <dd className="text-end text-ink">{p.orderQuota === null ? "Unlimited" : `${formatNumber(p.orderQuota)}/mo`}</dd>
                  <dt className="text-ink-soft">Transaction fee</dt>
                  <dd className="text-end text-ink">{formatBp(p.transactionFeeBp)}</dd>
                  <dt className="text-ink-soft">COD fee</dt>
                  <dd className="text-end text-ink">{formatBp(p.codFeeBp)}</dd>
                  {(p.perOrderFee ?? 0) > 0 && (
                    <>
                      <dt className="text-ink-soft">Fee per order</dt>
                      <dd className="text-end text-ink">{formatMinorMoney(p.perOrderFee ?? 0, p.currency)}</dd>
                    </>
                  )}
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
    // The annual price is not sent: the API always sets it to 10 × monthly.
    const nums = [form.monthlyPrice, "0", form.trialDays, form.transactionFeeBp, form.codFeeBp].map(Number);
    if (nums.some((n) => !Number.isFinite(n))) {
      setError("Prices, trial days and fees must be numbers.");
      return;
    }
    const quota = form.orderQuota.trim() === "" ? null : Number(form.orderQuota);
    if (quota !== null && (!Number.isInteger(quota) || quota < 1)) {
      setError("Order quota must be a whole number, or empty for unlimited.");
      return;
    }
    const trialDays = wholeNumber(form.trialDays, 0, 90);
    if (trialDays === null) {
      setError("Free trial must be a whole number of days from 0 (no trial) to 90.");
      return;
    }
    const maxStores = form.storesUnlimited ? null : wholeNumber(form.maxStores, 1, 100000);
    if (!form.storesUnlimited && maxStores === null) {
      setError("Max stores must be a whole number of at least 1 — or tick Unlimited.");
      return;
    }
    const maxFunnels = form.funnelsUnlimited ? null : wholeNumber(form.maxFunnels, 0, 100000);
    if (!form.funnelsUnlimited && maxFunnels === null) {
      setError("Max funnels per month must be a whole number (0 or more) — or tick Unlimited.");
      return;
    }
    const displayOrder = wholeNumber(form.displayOrder, 0, 10000);
    if (displayOrder === null) {
      setError("Display order must be a whole number from 0 to 10000.");
      return;
    }
    const fee = Number(form.perOrderFee.trim() === "" ? "0" : form.perOrderFee);
    if (!Number.isFinite(fee) || fee < 0) {
      setError("The fee per order must be a number, 0 for none.");
      return;
    }
    const feeMinor = toMinorAmount(fee, form.currency);
    if (feeMinor > 0 && (toMinorAmount(nums[0], form.currency) !== 0 || form.currency !== "EGP")) {
      setError("A fee per order is only for a plan priced 0 a month, in EGP. Set the monthly price to 0, or the fee to 0.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const monthlyMinor = toMinorAmount(nums[0], form.currency);
      const saved = await adminApi.savePlan({
        id: form.id,
        name: form.name,
        code: form.code,
        ...(form.id ? {} : { currency: form.currency }),
        monthlyPrice: monthlyMinor,
        yearlyPrice: monthlyMinor * ANNUAL_PRICE_MONTHS,
        trialDays,
        orderQuota: quota,
        transactionFeeBp: Math.round(nums[3]),
        codFeeBp: Math.round(nums[4]),
        features: form.features,
        active: form.active,
        maxStores,
        maxFunnelsPerMonth: maxFunnels,
        isPublic: form.isPublic,
        displayOrder,
        perOrderFee: feeMinor,
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
          <TextField
            label={`Monthly price (${form.currency})`}
            type="number"
            min={0}
            step={minorUnitDigits(form.currency) > 0 ? String(10 ** -minorUnitDigits(form.currency)) : "1"}
            required
            value={form.monthlyPrice}
            hint={
              Number.isFinite(Number(form.monthlyPrice))
                ? `= ${formatMinorMoney(toMinorAmount(Number(form.monthlyPrice), form.currency), form.currency)} a month`
                : undefined
            }
            onChange={(e) => set("monthlyPrice", e.target.value)}
          />
          <TextField
            label={`Yearly price (${form.currency})`}
            type="number"
            readOnly
            value={
              Number.isFinite(Number(form.monthlyPrice))
                ? String(toMajorAmount(toMinorAmount(Number(form.monthlyPrice), form.currency) * ANNUAL_PRICE_MONTHS, form.currency))
                : ""
            }
            hint={`Always ${ANNUAL_PRICE_MONTHS} × the monthly price (two months free).`}
          />
          <TextField
            label="Free trial (days)"
            type="number"
            min={0}
            max={90}
            step={1}
            required
            hint="0 = no free trial. Up to 90."
            value={form.trialDays}
            onChange={(e) => set("trialDays", e.target.value)}
          />
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

        <fieldset className="grid grid-cols-1 gap-4 rounded-[var(--radius-card)] border border-line p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold text-ink">Limits</legend>
          <LimitField
            label="Max stores"
            hint="Stores one owner may have. The largest limit among their current stores' plans applies."
            min={1}
            value={form.maxStores}
            unlimited={form.storesUnlimited}
            onValue={(v) => set("maxStores", v)}
            onUnlimited={(v) => set("storesUnlimited", v)}
          />
          <LimitField
            label="Max funnels per month"
            hint="Funnels one store may create each calendar month (Cairo time), deleted ones included."
            min={0}
            value={form.maxFunnels}
            unlimited={form.funnelsUnlimited}
            onValue={(v) => set("maxFunnels", v)}
            onUnlimited={(v) => set("funnelsUnlimited", v)}
          />
          <p className="text-xs text-ink-soft sm:col-span-2">
            New limits apply to stores and funnels created from now on. Nothing that exists is removed or switched off.
          </p>
        </fieldset>

        <FeaturePicker value={form.features} onChange={(next) => set("features", next)} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Toggle
            label="Show at sign-up"
            description="Listed on the marketing site's pricing page and offered on the sign-up form."
            checked={form.isPublic}
            onChange={(v) => set("isPublic", v)}
          />
          <TextField
            label="Display order"
            type="number"
            min={0}
            step={1}
            hint="Lower comes first on the pricing page."
            value={form.displayOrder}
            onChange={(e) => set("displayOrder", e.target.value)}
          />
        </div>

        <TextField
          label={`Fee per order (${form.currency})`}
          inputMode="decimal"
          hint="Pay per order: taken from the store's prepaid balance for each order (WALLET_ENABLED). Only on a plan priced 0 a month, in EGP. 0 = no fee."
          value={form.perOrderFee}
          onChange={(e) => set("perOrderFee", e.target.value)}
        />

        <Toggle label="Active" description="Inactive plans stay on existing workspaces but can't be chosen for new ones." checked={form.active} onChange={(v) => set("active", v)} />
      </form>
    </Modal>
  );
}

/** A number field with an "Unlimited" box beside it; ticking the box sends null. */
function LimitField({
  label,
  hint,
  min,
  value,
  unlimited,
  onValue,
  onUnlimited,
}: {
  label: string;
  hint: string;
  min: number;
  value: string;
  unlimited: boolean;
  onValue: (next: string) => void;
  onUnlimited: (next: boolean) => void;
}) {
  const boxId = useId();
  return (
    <div className="space-y-2">
      <TextField
        label={label}
        type="number"
        min={min}
        step={1}
        hint={hint}
        value={unlimited ? "" : value}
        placeholder={unlimited ? "Unlimited" : undefined}
        disabled={unlimited}
        onChange={(e) => onValue(e.target.value)}
      />
      <label htmlFor={boxId} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
        <input
          id={boxId}
          type="checkbox"
          checked={unlimited}
          onChange={(e) => onUnlimited(e.target.checked)}
          className="size-4 accent-[var(--color-primary)]"
        />
        Unlimited
      </label>
    </div>
  );
}

import { useId } from "react";
import { Check } from "lucide-react";
import { cn } from "@store-builder/ui";
import type { BillingCycle, PlanFeatureKey, PublicPlan } from "@store-builder/api-client";
import { useLocale, useT, fmt } from "@/i18n/LocaleContext";
import { formatMinorMoney } from "@/lib/format";
import { PLAN_STRINGS, featureLabel, formatDays } from "@/lib/planDisplay";

export interface PlanChoice {
  planId: string | null;
  billingCycle: BillingCycle;
}

interface PlanLike {
  name: string;
  currency: string;
  monthlyPrice: number;
  yearlyPrice: number;
  trialDays?: number;
  maxStores?: number | null;
  maxFunnelsPerMonth?: number | null;
  softOrderQuota?: number | null;
  features?: PlanFeatureKey[];
}

/** A plan's price for a cycle, its trial, limits and features — the body of every plan card. */
export function PlanSummary({ plan, billingCycle, compact = false }: { plan: PlanLike; billingCycle: BillingCycle; compact?: boolean }) {
  const t = useT(PLAN_STRINGS);
  const { locale } = useLocale();
  const price = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const number = (n: number) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(n);
  const limit = (value: number | null | undefined) => (value === null || value === undefined ? t.unlimited : number(value));

  return (
    <div>
      <p className="tabular text-2xl font-semibold text-ink">
        {price === 0 ? t.free : formatMinorMoney(price, plan.currency)}
        {price > 0 && (
          <span className="ms-1 text-sm font-normal text-ink-soft">{billingCycle === "yearly" ? t.perYear : t.perMonth}</span>
        )}
      </p>
      {plan.trialDays !== undefined && (
        <p className="mt-1 text-sm text-ink-soft">
          {plan.trialDays > 0 ? fmt(t.trialDays, { days: formatDays(plan.trialDays, locale) }) : t.noTrial}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink-soft">{t.storesLabel}</dt>
        <dd className="text-end text-ink">{limit(plan.maxStores)}</dd>
        <dt className="text-ink-soft">{t.funnelsLabel}</dt>
        <dd className="text-end text-ink">{limit(plan.maxFunnelsPerMonth)}</dd>
        {plan.softOrderQuota !== undefined && plan.softOrderQuota !== null && (
          <>
            <dt className="text-ink-soft">{t.ordersLabel}</dt>
            <dd className="text-end text-ink">{number(plan.softOrderQuota)}</dd>
          </>
        )}
      </dl>
      {!compact && plan.features && plan.features.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
          {plan.features.map((key) => (
            <li key={key} className="flex items-start gap-2 text-sm text-ink">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {featureLabel(key, t)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Monthly / yearly, as a two-option radio group. */
export function CycleSwitch({ value, onChange, disabled }: { value: BillingCycle; onChange: (next: BillingCycle) => void; disabled?: boolean }) {
  const t = useT(PLAN_STRINGS);
  const name = useId();
  const options: Array<{ value: BillingCycle; label: string; note?: string }> = [
    { value: "monthly", label: t.monthly },
    { value: "yearly", label: t.yearly, note: t.yearlyNote },
  ];
  return (
    <fieldset className="inline-flex rounded-full border border-line bg-paper p-1" disabled={disabled}>
      <legend className="sr-only">{t.billingCycle}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
            value === option.value ? "bg-primary text-primary-foreground" : "text-ink-soft hover:text-ink"
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
          {option.note && <span className="text-xs opacity-80">({option.note})</span>}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * The plans on offer as a radio group of cards, with the monthly/yearly
 * switch above. Used at sign-up and by an account made through Google.
 */
export function PlanPicker({
  plans,
  value,
  onChange,
  disabled,
  labelledBy,
}: {
  plans: PublicPlan[];
  value: PlanChoice;
  onChange: (next: PlanChoice) => void;
  disabled?: boolean;
  /** Id of the heading naming the group. */
  labelledBy?: string;
}) {
  const name = useId();
  return (
    <div className="space-y-4">
      <CycleSwitch value={value.billingCycle} onChange={(billingCycle) => onChange({ ...value, billingCycle })} disabled={disabled} />
      <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-3">
        {plans.map((plan) => {
          const selected = value.planId === plan.id;
          return (
            <label
              key={plan.id}
              className={cn(
                "block cursor-pointer rounded-[var(--radius-card)] border bg-paper-raised p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                selected ? "border-primary ring-1 ring-primary" : "border-line hover:border-primary/60",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-display text-lg font-medium text-ink">{plan.name}</span>
                <input
                  type="radio"
                  name={name}
                  value={plan.id}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => onChange({ ...value, planId: plan.id })}
                  className="mt-1 size-5 accent-[var(--color-primary)]"
                />
              </div>
              <div className="mt-2">
                <PlanSummary plan={plan} billingCycle={value.billingCycle} />
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

import { useId } from "react";
import { cn } from "@store-builder/ui";
import type { BillingCycle, PlanFeatureKey, PublicPlan } from "@store-builder/api-client";
import { IconCaretDown, IconCheck } from "@/components/icons";
import { Segmented } from "@/components/Segmented";
import type { PlanChoice } from "@/components/plans/PlanPicker";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatMinorMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";

/**
 * The plans on offer as cards — sign-up, the plan step of an account made
 * through Google, and a second store. Monthly / yearly is one segmented
 * control above; a card says the plan's name, its price for that cycle, and
 * what is included in three lines (stores, orders a month, the first of its
 * features); everything else it includes folds under «كل اللي فيها». The chosen
 * card wears the brand ring and a tick, and says so in words.
 *
 * A radio group underneath: one real radio per card, so the arrow keys move
 * between plans and a screen reader hears "plan, 2 of 3". The value it hands
 * back is the same `PlanChoice` the pages have always sent.
 */

const STRINGS = {
  en: {
    cycle: "Billing cycle",
    monthly: "Monthly",
    yearly: "Yearly",
    yearlyNote: "Yearly: 2 months free",
    perMonth: "a month",
    perYear: "a year",
    free: "Free",
    trial: "Free for the first {days}",
    stores: "Stores: {n}",
    storesUnlimited: "Unlimited stores",
    orders: "{orders} a month",
    funnels: "Sales funnels a month: {n}",
    funnelsUnlimited: "Unlimited sales funnels",
    andMore: "{list} +{n} more",
    chosen: "Your choice",
    all: "Everything in it",
    f_custom_domain: "Your own domain",
    f_funnels: "Sales funnels",
    f_whatsapp_confirmation: "Order confirmation on WhatsApp",
    f_abandoned_cart: "Lost order recovery",
    f_multi_warehouse: "More than one warehouse",
    f_api_access: "API access",
    f_staff_accounts: "Team accounts",
    f_advanced_analytics: "Advanced reports",
    f_remove_branding: "No ZIMOS badge on the store",
    f_priority_support: "Priority support",
  },
  ar: {
    cycle: "مدة الاشتراك",
    monthly: "شهري",
    yearly: "سنوي",
    yearlyNote: "السنوي: شهرين ببلاش",
    perMonth: "في الشهر",
    perYear: "في السنة",
    free: "ببلاش",
    trial: "ببلاش أول {days}",
    stores: "عدد المتاجر: {n}",
    storesUnlimited: "متاجر من غير حد",
    orders: "{orders} في الشهر",
    funnels: "مسارات بيع في الشهر: {n}",
    funnelsUnlimited: "مسارات بيع من غير حد",
    andMore: "{list} +{n} كمان",
    chosen: "اختيارك",
    all: "كل اللي فيها",
    f_custom_domain: "دومين خاص بيك",
    f_funnels: "مسارات البيع",
    f_whatsapp_confirmation: "تأكيد الأوردرات بواتساب",
    f_abandoned_cart: "استرجاع الأوردرات المفقودة",
    f_multi_warehouse: "أكتر من مخزن",
    f_api_access: "ربط بالـ API",
    f_staff_accounts: "حسابات للفريق",
    f_advanced_analytics: "تقارير متقدمة",
    f_remove_branding: "من غير علامة ZIMOS على المتجر",
    f_priority_support: "دعم بأولوية",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

function featureName(key: PlanFeatureKey, t: T): string {
  return (t as Record<string, string>)[`f_${key}`] ?? key;
}

/** The three lines of a card: how many stores, how much it carries a month, the first of its features. */
function includedLines(plan: PublicPlan, t: T): string[] {
  const lines: string[] = [];
  lines.push(plan.maxStores === null ? t.storesUnlimited : fmt(t.stores, { n: plan.maxStores }));
  if (plan.softOrderQuota !== null) lines.push(fmt(t.orders, { orders: countOf("order", plan.softOrderQuota) }));
  else lines.push(plan.maxFunnelsPerMonth === null ? t.funnelsUnlimited : fmt(t.funnels, { n: plan.maxFunnelsPerMonth }));
  const names = plan.features.map((key) => featureName(key, t));
  if (names.length > 0) {
    const first = names.slice(0, 2).join(" · ");
    lines.push(names.length > 2 ? fmt(t.andMore, { list: first, n: names.length - 2 }) : first);
  }
  return lines;
}

export function PlanCards({
  plans,
  value,
  onChange,
  disabled = false,
  labelledBy,
}: {
  plans: PublicPlan[];
  value: PlanChoice;
  onChange: (next: PlanChoice) => void;
  disabled?: boolean;
  /** Id of the heading naming the group. */
  labelledBy?: string;
}) {
  const t = useT(STRINGS);
  const name = useId();
  const cycle: BillingCycle = value.billingCycle;

  return (
    <div className="space-y-3">
      {/* A disabled fieldset switches the segments off with the cards while a save runs. */}
      <fieldset disabled={disabled} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 disabled:opacity-60">
        <legend className="sr-only">{t.cycle}</legend>
        <Segmented<BillingCycle>
          value={cycle}
          onChange={(billingCycle) => onChange({ ...value, billingCycle })}
          options={[
            { value: "monthly", label: t.monthly },
            { value: "yearly", label: t.yearly },
          ]}
          label={t.cycle}
        />
        <p className="text-xs font-medium text-success">{t.yearlyNote}</p>
      </fieldset>

      <div role="radiogroup" aria-labelledby={labelledBy} className={cn("grid gap-3", plans.length > 1 && "sm:grid-cols-2")}>
        {plans.map((plan) => {
          const selected = value.planId === plan.id;
          const price = cycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
          const lines = includedLines(plan, t);
          return (
            <div
              key={plan.id}
              data-slot="plan-card"
              data-selected={selected ? "" : undefined}
              className={cn(
                "flex min-w-0 flex-col rounded-[1.25rem] border bg-paper-raised transition-[border-color,background-color,box-shadow,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-primary",
                "motion-safe:has-[label:active]:scale-[0.985]",
                selected ? "border-primary ring-1 ring-primary" : "border-line",
                disabled && "opacity-60"
              )}
            >
              <label className={cn("flex min-w-0 flex-1 flex-col p-4", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span dir="auto" className="block truncate font-display text-lg leading-7 font-semibold text-ink">
                      {plan.name}
                    </span>
                    {selected && <span className="block text-xs font-semibold text-primary">{t.chosen}</span>}
                  </span>
                  <input
                    type="radio"
                    name={name}
                    value={plan.id}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onChange({ ...value, planId: plan.id })}
                    className="sr-only"
                  />
                  <span
                    data-slot="plan-tick"
                    aria-hidden
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full",
                      selected ? "bg-primary text-primary-foreground" : "ring-1 ring-line-strong ring-inset"
                    )}
                  >
                    {selected && <IconCheck className="size-3.5" weight="bold" />}
                  </span>
                </span>

                <span className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
                  <bdi className="text-2xl leading-8 font-semibold text-ink tabular-nums">
                    {price === 0 ? t.free : formatMinorMoney(price, plan.currency)}
                  </bdi>
                  {price > 0 && <span className="text-sm text-ink-soft">{cycle === "yearly" ? t.perYear : t.perMonth}</span>}
                </span>
                {plan.trialDays > 0 && (
                  <span className="mt-0.5 block text-xs font-medium text-success">{fmt(t.trial, { days: countOf("day", plan.trialDays) })}</span>
                )}

                <span className="mt-3 flex flex-col gap-1.5">
                  {lines.map((line) => (
                    <span key={line} className="flex items-start gap-2 text-sm leading-5 text-ink">
                      <IconCheck className="mt-0.5 size-4 shrink-0 text-primary" weight="bold" aria-hidden />
                      <span className="min-w-0">{line}</span>
                    </span>
                  ))}
                </span>
              </label>

              {(plan.features.length > 2 || plan.softOrderQuota !== null) && (
                <details className="group border-t border-line px-4">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-medium text-ink-soft select-none hover:text-ink focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                    {t.all}
                    <IconCaretDown
                      className="size-4 shrink-0 transition-[rotate] duration-[var(--dur-fade)] ease-[var(--ease-out)] group-open:rotate-180 motion-reduce:transition-none"
                      aria-hidden
                    />
                  </summary>
                  <ul className="space-y-1.5 pb-3.5">
                    <li className="text-sm leading-5 text-ink">
                      {plan.maxFunnelsPerMonth === null ? t.funnelsUnlimited : fmt(t.funnels, { n: plan.maxFunnelsPerMonth })}
                    </li>
                    {plan.features.map((key) => (
                      <li key={key} className="flex items-start gap-2 text-sm leading-5 text-ink">
                        <IconCheck className="mt-0.5 size-4 shrink-0 text-primary" weight="bold" aria-hidden />
                        {featureName(key, t)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

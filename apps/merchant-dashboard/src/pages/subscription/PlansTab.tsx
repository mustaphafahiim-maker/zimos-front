import { useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import type {
  BillingCycle,
  PlanPrice,
  SubscriptionPlan,
  SubscriptionPlans,
  WorkspaceBilling,
} from "@store-builder/api-client";
import { apiErrorDetails } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMinorMoney } from "@/lib/format";
import { noteWentLive } from "@/lib/goLive";
import { formatDays } from "@/lib/planDisplay";
import { useLocale, useT, fmt } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { CycleSwitch, PlanSummary } from "@/components/plans/PlanPicker";
import { BillingCycleChoice } from "./billingParts";
import { BILLING_STRINGS, codeDiscountLabel } from "./billingText";
import { SUBSCRIPTION_STRINGS } from "./subscriptionStrings";

/** What a card offers, from the subscription's state (see the backend's merchantPlansService). */
type CardAction = "trial" | "choose" | "support" | "current" | "none";

function actionFor(plan: SubscriptionPlan, view: SubscriptionPlans): CardAction {
  if (view.trial.available && plan.trialDays > 0 && (plan.isPublic || plan.isCurrent)) return "trial";
  if (plan.isCurrent) return "current";
  if (!plan.isPublic) return "none";
  return view.planChange === "immediate" ? "choose" : "support";
}

const priceFor = (prices: { monthly: PlanPrice; yearly: PlanPrice }, cycle: BillingCycle) => (cycle === "yearly" ? prices.yearly : prices.monthly);

/**
 * The plan cards: features and limits, the store's own plan marked, prices
 * for the chosen cycle (with what annual saves), a code field on each, and
 * the one action the subscription allows — a free trial from a draft, the
 * plan itself while nothing is paid, or support once paid. Every price is
 * the server's.
 */
export function PlansTab({
  view,
  billing,
  onPlansChange,
  onBillingChange,
  onChanged,
}: {
  view: SubscriptionPlans;
  billing: WorkspaceBilling | null;
  onPlansChange: (next: SubscriptionPlans) => void;
  onBillingChange: (next: WorkspaceBilling) => void;
  /** Something changed that the summary and the banners show. */
  onChanged: () => void;
}) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const bt = useT(BILLING_STRINGS);
  const [cycle, setCycle] = useState<BillingCycle>(view.subscription.billingCycle);
  const code = view.referralCode;
  const paidPlan = billing?.subscription.plan;

  return (
    <div className="space-y-5">
      {view.trial.available && (
        <Alert role="status">
          {t.trialNote} {t.trialEndNote}
        </Alert>
      )}
      {view.planChange === "support" && <p className="text-sm text-ink-soft">{t.paidNote}</p>}

      {code && (
        <p className="text-sm text-ink" dir="auto">
          {code.active
            ? fmt(t.storeCode, { code: code.code, discount: codeDiscountLabel(code, bt) })
            : fmt(t.codeInactive, { code: code.code })}
        </p>
      )}

      {view.planChange === "support" && billing && paidPlan && paidPlan.monthlyPrice > 0 ? (
        <BillingCycleChoice billing={billing} onChange={onBillingChange} />
      ) : (
        <CycleSwitch value={cycle} onChange={setCycle} />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {view.plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            view={view}
            cycle={view.planChange === "support" ? view.subscription.billingCycle : cycle}
            onPlansChange={onPlansChange}
            onChanged={onChanged}
          />
        ))}
        <PayPerOrderCard />
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  view,
  cycle,
  onPlansChange,
  onChanged,
}: {
  plan: SubscriptionPlan;
  view: SubscriptionPlans;
  cycle: BillingCycle;
  onPlansChange: (next: SubscriptionPlans) => void;
  onChanged: () => void;
}) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = actionFor(plan, view);
  const price = priceFor(plan.prices, cycle);
  const yearlySaving = plan.prices.monthly.net * 12 - plan.prices.yearly.net;
  const titleId = useId();

  async function act() {
    setBusy(true);
    setError(null);
    try {
      if (action === "trial") {
        await apiClient.startTrial(workspaceId, plan.id);
        noteWentLive();
        onPlansChange(await apiClient.getSubscriptionPlans(workspaceId));
        toast.success(t.trialStarted);
      } else {
        const { plans } = await apiClient.changeSubscriptionPlan(workspaceId, { planId: plan.id, billingCycle: cycle });
        onPlansChange(plans);
        toast.success(t.planChanged);
      }
      onChanged();
    } catch (err) {
      const reason = apiErrorDetails<{ reason?: string }>(err)?.reason;
      setError(
        errorMessage(err, {
          TRIAL_NOT_AVAILABLE: reason === "no_trial" ? t.noTrial : t.trialUsed,
          PLAN_NOT_AVAILABLE: t.planNotAvailable,
          OPEN_CHARGE_EXISTS: t.openCharge,
          PLAN_CHANGE_NEEDS_SUPPORT: t.needsSupport,
        })
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col rounded-[var(--radius-card)] border bg-paper-raised p-5",
        plan.isCurrent ? "border-primary ring-1 ring-primary" : "border-line"
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h3 id={titleId} className="font-display text-lg font-medium text-ink">
          {plan.name}
        </h3>
        {plan.isCurrent && (
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">{t.currentPlan}</span>
        )}
        {!plan.isPublic && !plan.isCurrent && <span className="text-xs text-ink-soft">{t.notOffered}</span>}
      </div>

      <PlanSummary plan={{ ...plan, monthlyPrice: plan.prices.monthly.net, yearlyPrice: plan.prices.yearly.net }} billingCycle={cycle} />
      {price.discount > 0 && (
        <p className="mt-1 text-xs text-ink-soft">
          <span className="line-through">{fmt(t.insteadOf, { price: formatMinorMoney(price.gross, plan.currency) })}</span>
        </p>
      )}
      {cycle === "yearly" && yearlySaving > 0 && (
        <p className="mt-1 text-sm font-medium text-success">{fmt(t.saveYearly, { amount: formatMinorMoney(yearlySaving, plan.currency) })}</p>
      )}

      {!view.referralCode && (action === "trial" || action === "choose") && (
        <CodeField plan={plan} cycle={cycle} onApplied={onPlansChange} onChanged={onChanged} />
      )}

      <div className="mt-auto space-y-2 pt-4">
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}
        {(action === "trial" || action === "choose") && (
          <Button type="button" className="min-h-11 w-full" disabled={busy} onClick={() => void act()}>
            {action === "trial" ? fmt(t.startTrial, { days: formatDays(plan.trialDays, locale) }) : t.choosePlan}
          </Button>
        )}
        {action === "support" && (
          <Button asChild variant="outline" className="min-h-11 w-full">
            <Link to="/support">{t.contactSupport}</Link>
          </Button>
        )}
      </div>
    </article>
  );
}

/**
 * "Discount or voucher code" on a card: Check shows this card's price with the
 * code (nothing is attached); Apply attaches it to the store — once, for every
 * payment from then on — after which every card shows the discounted prices.
 */
function CodeField({
  plan,
  cycle,
  onApplied,
  onChanged,
}: {
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  onApplied: (next: SubscriptionPlans) => void;
  onChanged: () => void;
}) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const bt = useT(BILLING_STRINGS);
  const id = useId();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<{ code: string; price: PlanPrice } | null>(null);
  const [busy, setBusy] = useState<"check" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const describe = (err: unknown) =>
    errorMessage(err, { REFERRAL_CODE_INVALID: bt.invalid, REFERRAL_CODE_ALREADY_SET: bt.alreadySet });

  async function check(e: FormEvent) {
    e.preventDefault();
    setBusy("check");
    setError(null);
    setPreview(null);
    try {
      const result = await apiClient.previewReferralCode(workspaceId, code.trim());
      const mine = result.plans.find((p) => p.planId === plan.id);
      if (mine) setPreview({ code: result.code.code, price: priceFor(mine.prices, cycle) });
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!preview) return;
    setBusy("apply");
    setError(null);
    try {
      await apiClient.attachReferralCode(workspaceId, preview.code);
      toast.success(t.codeApplied);
      onApplied(await apiClient.getSubscriptionPlans(workspaceId));
      onChanged();
    } catch (err) {
      setError(describe(err));
      setBusy(null);
    }
  }

  return (
    <form onSubmit={check} className="mt-4 space-y-2 border-t border-line pt-3">
      <Label htmlFor={id} className="text-xs text-ink-soft">
        {t.code}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setPreview(null);
          }}
          placeholder={t.codePlaceholder}
          maxLength={32}
          dir="ltr"
          className="min-w-0 flex-1 font-mono"
          disabled={busy !== null}
        />
        <Button type="submit" variant="outline" className="min-h-10 shrink-0" disabled={busy !== null || code.trim().length < 3}>
          {busy === "check" ? t.checking : t.check}
        </Button>
      </div>
      {preview && (
        <div className="space-y-2">
          <p className="text-sm text-ink" dir="auto">
            {fmt(t.withCode, { code: preview.code, price: formatMinorMoney(preview.price.net, plan.currency) })}
          </p>
          <Button type="button" variant="outline" className="min-h-10 w-full" disabled={busy !== null} onClick={() => void apply()}>
            {busy === "apply" ? t.applying : t.applyCode}
          </Button>
        </div>
      )}
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
    </form>
  );
}

/** The pay-per-order plan (the balance, a later phase): shown, not offered yet. */
function PayPerOrderCard() {
  const t = useT(SUBSCRIPTION_STRINGS);
  return (
    <article className="flex flex-col rounded-[var(--radius-card)] border border-dashed border-line bg-paper p-5" aria-disabled="true">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display text-lg font-medium text-ink">{t.payPerOrder}</h3>
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-ink">{t.comingSoon}</span>
      </div>
      <p className="text-sm text-ink-soft">{t.payPerOrderBody}</p>
    </article>
  );
}

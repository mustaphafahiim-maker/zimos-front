import { useId, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { PAY_STRINGS } from "./payStrings";
import { SUBSCRIPTION_STRINGS } from "./subscriptionStrings";
import { WALLET_STRINGS } from "./walletStrings";

/** The Invoices tab with its Pay dialog open (SubscriptionPage). */
const PAY_NOW_LINK = "/subscription?tab=invoices&pay=1";

/** The Usage tab, where the prepaid balance is topped up. */
const TOP_UP_LINK = "/subscription?tab=usage";

/** What a card offers, from the subscription's state (see the backend's merchantPlansService). */
type CardAction = "trial" | "choose" | "move" | "movePay" | "support" | "current" | "none";

function actionFor(plan: SubscriptionPlan, view: SubscriptionPlans): CardAction {
  if (view.trial.available && plan.trialDays > 0 && (plan.isPublic || plan.isCurrent)) return "trial";
  if (plan.isCurrent) return "current";
  if (!plan.isPublic) return "none";
  // A store on pay per order moves by itself; while a move waits, only its plan's card leads to paying it.
  const move = view.move;
  if (move?.available) {
    if (move.pending) return move.pending.planId === plan.id ? "movePay" : "none";
    return "move";
  }
  return view.planChange === "immediate" ? "choose" : "support";
}

const priceFor = (prices: { monthly: PlanPrice; yearly: PlanPrice }, cycle: BillingCycle) => (cycle === "yearly" ? prices.yearly : prices.monthly);

/**
 * The plan cards: features and limits, the store's own plan marked, prices
 * for the chosen cycle (with what annual saves), a code field on each, and
 * the one action the subscription allows — a free trial from a draft, the
 * plan itself while nothing is paid, or support once paid. Every price is
 * the server's. The current plan's card leads to paying ("Pay now") while
 * its next charge is due and no paid period runs — so right after a priced
 * plan is chosen, once the summary is read again.
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
  const move = view.move?.available ? view.move : null;
  const paidPlan = billing?.subscription.plan;
  // The next charge, for the current plan's card — not while a paid period
  // runs (that renews from the Invoices tab). Read again after a plan change.
  const due =
    billing && billing.subscription.status !== "active" && billing.nextCharge
      ? { ...billing.nextCharge, planId: billing.subscription.plan?.id ?? null }
      : null;

  return (
    <div className="space-y-5">
      {view.trial.available && (
        <Alert role="status">
          {t.trialNote} {t.trialEndNote}
        </Alert>
      )}
      {move ? <MoveNotice move={move} /> : view.planChange === "support" && <p className="text-sm text-ink-soft">{t.paidNote}</p>}

      {code && (
        <p className="text-sm text-ink" dir="auto">
          {code.active
            ? fmt(t.storeCode, { code: code.code, discount: codeDiscountLabel(code, bt) })
            : fmt(t.codeInactive, { code: code.code })}
        </p>
      )}

      {!move && view.planChange === "support" && billing && paidPlan && paidPlan.monthlyPrice > 0 ? (
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
            cycle={move?.pending ? move.pending.billingCycle : view.planChange === "support" && !move ? view.subscription.billingCycle : cycle}
            due={due}
            onPlansChange={onPlansChange}
            onChanged={onChanged}
          />
        ))}
        <PayPerOrderCard view={view} onPlansChange={onPlansChange} onChanged={onChanged} />
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  view,
  cycle,
  due,
  onPlansChange,
  onChanged,
}: {
  plan: SubscriptionPlan;
  view: SubscriptionPlans;
  cycle: BillingCycle;
  /** The store's next charge while it is due, and the plan it is for (see PlansTab). */
  due: (NonNullable<WorkspaceBilling["nextCharge"]> & { planId: string | null }) | null;
  onPlansChange: (next: SubscriptionPlans) => void;
  onChanged: () => void;
}) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const p = useT(PAY_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const navigate = useNavigate();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = actionFor(plan, view);
  const moveBlocked = action === "move" && ((view.move?.debt ?? 0) > 0 || Boolean(view.move?.otherChargeOpen));
  const price = priceFor(plan.prices, cycle);
  const yearlySaving = plan.prices.monthly.net * 12 - plan.prices.yearly.net;
  const titleId = useId();
  // Right after a change the summary may still hold the old plan's charge: shown once it is this plan's.
  const payAmount =
    plan.isCurrent && action === "current" && due && due.planId === plan.id && due.amount > 0
      ? formatMinorMoney(due.amount, due.currency)
      : null;

  async function act() {
    setBusy(true);
    setError(null);
    try {
      if (action === "trial") {
        await apiClient.startTrial(workspaceId, plan.id);
        noteWentLive();
        onPlansChange(await apiClient.getSubscriptionPlans(workspaceId));
        toast.success(t.trialStarted);
      } else if (action === "move") {
        // One charge for the new plan; the store switches once it is paid.
        const { plans } = await apiClient.requestPlanMove(workspaceId, { planId: plan.id, billingCycle: cycle });
        onPlansChange(plans);
        toast.success(t.moveRequested);
        onChanged();
        navigate(PAY_NOW_LINK);
        return;
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
          OPEN_CHARGE_EXISTS: action === "move" ? t.moveOtherCharge : t.openCharge,
          PLAN_CHANGE_NEEDS_SUPPORT: t.needsSupport,
          WALLET_DEBT_OUTSTANDING: t.moveDebtError,
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

      <PlanSummary
        // A move off pay per order never starts a trial, so a plan's own isn't shown then.
        plan={{ ...plan, monthlyPrice: plan.prices.monthly.net, yearlyPrice: plan.prices.yearly.net, trialDays: view.move?.available ? 0 : plan.trialDays }}
        billingCycle={cycle}
      />
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
        {action === "move" && (
          <Button type="button" className="min-h-11 w-full" disabled={busy || moveBlocked} onClick={() => void act()}>
            {t.moveChoose}
          </Button>
        )}
        {action === "movePay" && (
          <Button asChild className="min-h-11 w-full">
            <Link to={PAY_NOW_LINK}>{t.movePay}</Link>
          </Button>
        )}
        {action === "support" && (
          <Button asChild variant="outline" className="min-h-11 w-full">
            <Link to="/support">{t.contactSupport}</Link>
          </Button>
        )}
        {payAmount && (
          <>
            <p className="text-sm text-ink">{fmt(p.payPanelBody, { amount: payAmount })}</p>
            <Button asChild className="min-h-11 w-full">
              <Link to={PAY_NOW_LINK}>{t.payNow}</Link>
            </Button>
          </>
        )}
      </div>
    </article>
  );
}

/**
 * The move off pay per order, above the cards: no free trial, the balance
 * (it stays in the wallet), a debt to clear first, or the move waiting for
 * its payment.
 */
function MoveNotice({ move }: { move: NonNullable<SubscriptionPlans["move"]> }) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const pending = move.pending;
  return (
    <section aria-labelledby="move-title" className="space-y-2 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
      <h2 id="move-title" className="font-display text-base font-medium text-ink">
        {t.moveTitle}
      </h2>
      {pending ? (
        <Alert role="status">
          {fmt(t.movePending, {
            plan: pending.planName ?? "",
            cycle: pending.billingCycle === "yearly" ? t.cycleYearly : t.cycleMonthly,
            amount: formatMinorMoney(pending.amountDue, pending.currency),
          })}
        </Alert>
      ) : (
        <p className="text-sm text-ink">{t.moveNote}</p>
      )}
      {move.debt > 0 ? (
        <Alert variant="danger" role="alert">
          {fmt(t.moveDebt, { debt: formatMinorMoney(move.debt, move.currency) })}{" "}
          <Link to={TOP_UP_LINK} className="font-medium underline">
            {t.moveTopUp}
          </Link>
        </Alert>
      ) : (
        <p className="text-sm text-ink-soft">{fmt(t.moveBalance, { balance: formatMinorMoney(move.balance, move.currency) })}</p>
      )}
    </section>
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

/**
 * The pay-per-order plan (the prepaid balance, WALLET_ENABLED). Offered:
 * chosen at once from a draft or a trial, through support once paid. Not
 * offered (switched off, or no such plan): shown as coming soon.
 */
function PayPerOrderCard({
  view,
  onPlansChange,
  onChanged,
}: {
  view: SubscriptionPlans;
  onPlansChange: (next: SubscriptionPlans) => void;
  onChanged: () => void;
}) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const w = useT(WALLET_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ppo = view.payPerOrder;
  const plan = ppo?.plan ?? null;

  if (!ppo || (!ppo.available && !ppo.current) || !plan) {
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

  async function choose() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.choosePayPerOrder(workspaceId);
      onPlansChange(await apiClient.getSubscriptionPlans(workspaceId));
      onChanged();
      toast.success(w.ppoChosen);
    } catch (err) {
      setError(errorMessage(err, { OPEN_CHARGE_EXISTS: w.ppoOpenCharge, PLAN_CHANGE_NEEDS_SUPPORT: w.ppoNeedsSupport }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={cn(
        "flex flex-col rounded-[var(--radius-card)] border bg-paper-raised p-5",
        ppo.current ? "border-primary" : "border-line"
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display text-lg font-medium text-ink">{t.payPerOrder}</h3>
        {ppo.current && <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">{w.ppoCurrent}</span>}
      </div>
      <p className="tabular text-2xl font-semibold text-ink">{fmt(w.ppoFee, { fee: formatMinorMoney(plan.fee, plan.currency) })}</p>
      <p className="mt-2 flex-1 text-sm text-ink-soft">{w.ppoBalanceHint}</p>
      {!ppo.current &&
        (view.planChange === "immediate" ? (
          <Button type="button" className="mt-4 min-h-11 w-full" disabled={busy} onClick={() => void choose()}>
            {busy ? w.ppoChoosing : w.ppoChoose}
          </Button>
        ) : (
          <Button asChild variant="outline" className="mt-4 min-h-11 w-full">
            <Link to="/support">{w.ppoSupport}</Link>
          </Button>
        ))}
      {error && (
        <Alert variant="danger" role="alert" className="mt-3">
          {error}
        </Alert>
      )}
    </article>
  );
}

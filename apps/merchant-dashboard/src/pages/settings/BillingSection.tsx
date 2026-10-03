import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { UsageBlock } from "./UsageBlock";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import type { OnlinePaymentResult, OnlinePaymentStatus, WorkspaceBilling } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney } from "@/lib/format";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useLocale, useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { DataState } from "@/components/DataState";

/**
 * Role keys that hold billing.manage, which GET/POST /workspaces/:id/billing
 * need: the owner ('*') and the accountant (SYSTEM_ROLES in the backend's
 * core/security/permissions.js). Other roles don't see the card at all.
 */
const BILLING_ROLES: ReadonlySet<string> = new Set(["owner", "accountant"]);

const STRINGS = {
  en: {
    title: "Plan and referral code",
    description: "Your Zimos plan, and the referral code of the agent who introduced you, if you have one.",
    plan: "Plan",
    noPlan: "No plan",
    status: "Status",
    trialing: "Free trial",
    active: "Active",
    past_due: "Payment due",
    suspended: "Suspended",
    cancelled: "Cancelled",
    trialEnds: "Trial ends {date}",
    renews: "Current period ends {date}",
    monthly: "Monthly",
    yearly: "Yearly",
    cycle: "Billing cycle",
    cycleMonthly: "Monthly — {price} a month",
    cycleYearly: "Annual — {price} a year (2 months free)",
    cycleHint: "Applies from your next payment.",
    cycleSaved: "Billing cycle updated. It applies from your next payment.",
    cycleOpenCharge: "A payment is already open at your current billing cycle. You can switch once it's settled.",
    nextCharge: "Next charge",
    nextChargeDiscount: "{amount} (plan price {gross}, {discount} off with your code)",
    referralCode: "Referral code",
    referralHint: "Got a code from a Zimos agent? Enter it here. It applies to your plan's payments and can only be set once.",
    codePlaceholder: "e.g. CAIRO10",
    apply: "Apply code",
    applying: "Applying…",
    applied: "Referral code applied.",
    attachedOn: "Applied on {date}",
    noDiscount: "No discount — it records who referred you.",
    percentOff: "{value}% off each payment",
    fixedOff: "{amount} off each payment",
    inactive: "This code is no longer active, so it gives no discount on new payments.",
    invalid: "That referral code isn't valid. Check it and try again.",
    alreadySet: "This store already has a referral code.",
    payTitle: "Pay online",
    payHint: "Pay one period of your plan ({amount}) on Fawaterak's secure payment page.",
    payNow: "Pay now",
    opening: "Opening the payment page…",
    awaitingReference: "Waiting for your payment by {method}. Reference number: {reference}",
    checking: "Checking your payment…",
    paid: "Payment received. Your subscription is active.",
    stillPending: "Your payment is still being processed. This page will show it once it's confirmed.",
    notCompleted: "The payment wasn't completed. You can try again.",
    leftPayment: "You left the payment page without paying. You can pay any time.",
    review: "We received a payment that needs review by the Zimos team. We'll contact you.",
    duplicate: "This charge was already paid. The Zimos team will contact you about refunding this payment.",
    notConfirmedYet: "We couldn't confirm the payment yet. If you paid, it will show here shortly.",
    payDisabled: "Online payment isn't available right now.",
    payUnavailable: "Online payment isn't available right now. Try again later.",
    payCurrency: "Online payment is only available for plans priced in Egyptian pounds.",
    payStartFailed: "The payment page couldn't be opened. Try again in a few minutes.",
    payStarting: "A payment is already being opened. Wait a moment and try again.",
    nothingToPay: "Nothing is due right now.",
    chargeSettled: "This charge was settled in the meantime. Reload the page.",
  },
  ar: {
    title: "الخطة وكود الإحالة",
    description: "خطتك في Zimos، وكود الإحالة الخاص بالمندوب الذي عرّفك بنا إن وُجد.",
    plan: "الخطة",
    noPlan: "بدون خطة",
    status: "الحالة",
    trialing: "فترة تجريبية",
    active: "نشطة",
    past_due: "مستحقة الدفع",
    suspended: "موقوفة",
    cancelled: "ملغاة",
    trialEnds: "تنتهي الفترة التجريبية في {date}",
    renews: "تنتهي الفترة الحالية في {date}",
    monthly: "شهري",
    yearly: "سنوي",
    cycle: "دورة الفوترة",
    cycleMonthly: "شهري — {price} شهريًا",
    cycleYearly: "سنوي — {price} سنويًا (شهران مجانًا)",
    cycleHint: "يُطبق من دفعتك القادمة.",
    cycleSaved: "تم تحديث دورة الفوترة. تُطبق من دفعتك القادمة.",
    cycleOpenCharge: "هناك دفعة مفتوحة بدورة الفوترة الحالية. يمكنك التبديل بعد تسويتها.",
    nextCharge: "الدفعة القادمة",
    nextChargeDiscount: "{amount} (سعر الخطة {gross}، وخصم {discount} بكودك)",
    referralCode: "كود الإحالة",
    referralHint: "حصلت على كود من أحد مندوبي Zimos؟ أدخله هنا. يُطبق على مدفوعات خطتك ويمكن إدخاله مرة واحدة فقط.",
    codePlaceholder: "مثال: CAIRO10",
    apply: "تطبيق الكود",
    applying: "جارٍ التطبيق…",
    applied: "تم تطبيق كود الإحالة.",
    attachedOn: "طُبق في {date}",
    noDiscount: "بدون خصم — يسجل فقط من قام بإحالتك.",
    percentOff: "خصم {value}% على كل دفعة",
    fixedOff: "خصم {amount} على كل دفعة",
    inactive: "هذا الكود لم يعد نشطًا، لذلك لا يمنح خصمًا على المدفوعات الجديدة.",
    invalid: "كود الإحالة غير صالح. تحقق منه وحاول مرة أخرى.",
    alreadySet: "هذا المتجر لديه كود إحالة بالفعل.",
    payTitle: "الدفع الإلكتروني",
    payHint: "ادفع قيمة فترة واحدة من خطتك ({amount}) عبر صفحة الدفع الآمنة من فواتيرك.",
    payNow: "ادفع الآن",
    opening: "جارٍ فتح صفحة الدفع…",
    awaitingReference: "بانتظار دفعتك عبر {method}. الرقم المرجعي: {reference}",
    checking: "جارٍ التحقق من دفعتك…",
    paid: "تم استلام الدفعة، واشتراكك نشط.",
    stillPending: "دفعتك قيد المعالجة. ستظهر في هذه الصفحة عند تأكيدها.",
    notCompleted: "لم تكتمل عملية الدفع. يمكنك المحاولة مرة أخرى.",
    leftPayment: "غادرت صفحة الدفع دون إتمام الدفع. يمكنك الدفع في أي وقت.",
    review: "استلمنا دفعة تحتاج إلى مراجعة من فريق Zimos، وسنتواصل معك.",
    duplicate: "هذه الدفعة مسددة بالفعل. سيتواصل معك فريق Zimos بشأن استرداد هذا المبلغ.",
    notConfirmedYet: "لم نتمكن من تأكيد الدفعة بعد. إذا أتممت الدفع فستظهر هنا قريبًا.",
    payDisabled: "الدفع الإلكتروني غير متاح حاليًا.",
    payUnavailable: "الدفع الإلكتروني غير متاح حاليًا. حاول مرة أخرى لاحقًا.",
    payCurrency: "الدفع الإلكتروني متاح فقط للخطط المسعّرة بالجنيه المصري.",
    payStartFailed: "تعذّر فتح صفحة الدفع. حاول مرة أخرى بعد بضع دقائق.",
    payStarting: "هناك عملية دفع يجري فتحها بالفعل. انتظر لحظة ثم حاول مرة أخرى.",
    nothingToPay: "لا يوجد مبلغ مستحق حاليًا.",
    chargeSettled: "تمت تسوية هذه الدفعة في الأثناء. أعد تحميل الصفحة.",
  },
} satisfies Messages;

// The payment is still being made or awaits the customer.
const IN_PROGRESS: ReadonlySet<OnlinePaymentStatus> = new Set(["created", "open", "pending"]);
// How often, and how many times, the return page asks about a payment in
// progress: once when Fawaterak sent the merchant back from a decline or the
// back link, a few times otherwise.
const RETURN_POLL_MS = 3000;
const RETURN_POLL_TRIES = 8;
// Which of Fawaterak's redirects brought the merchant back. It only words the
// message; the payment's state always comes from the server.
type ReturnHint = "success" | "fail" | "pending" | "back" | null;
const hintOf = (value: string | null): ReturnHint =>
  value === "success" || value === "fail" || value === "pending" || value === "back" ? value : null;

export function BillingSection() {
  const { currentWorkspace } = useWorkspace();
  if (!BILLING_ROLES.has(currentWorkspace?.role ?? "")) return null;
  return <BillingCard />;
}

function BillingCard() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const billing = useAsync(() => apiClient.getWorkspaceBilling(workspaceId), [workspaceId]);
  const [params, setParams] = useSearchParams();
  // Fawaterak sends the merchant back here with ?payment=<id>&workspace=<id>
  // (SettingsPage switches to that store first, which remounts this card).
  // Read once, so the message stays after the URL is cleaned.
  const [returned] = useState(() =>
    params.get("workspace") === workspaceId && params.get("payment")
      ? { paymentId: params.get("payment")!, hint: hintOf(params.get("result")) }
      : null
  );

  function closeReturn() {
    const next = new URLSearchParams(params);
    next.delete("payment");
    next.delete("workspace");
    next.delete("result");
    setParams(next, { replace: true });
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      {returned && (
        <PaymentReturn
          key={returned.paymentId}
          paymentId={returned.paymentId}
          hint={returned.hint}
          onSettled={() => void billing.refresh({ silent: true })}
          onDone={closeReturn}
        />
      )}
      <div className="mt-4">
        <DataState loading={billing.loading && !billing.data} error={billing.error} onRetry={() => void billing.refresh()}>
          {billing.data && <BillingDetails billing={billing.data} onChange={(next) => billing.setData(next)} />}
        </DataState>
      </div>
      <UsageBlock />
    </section>
  );
}

/**
 * The page Fawaterak sends the merchant back to. The redirect itself proves
 * nothing: the server is asked (it asks Fawaterak) a few times while the
 * payment is still in progress.
 */
function PaymentReturn({
  paymentId,
  hint,
  onSettled,
  onDone,
}: {
  paymentId: string;
  hint: ReturnHint;
  onSettled: () => void;
  onDone: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [payment, setPayment] = useState<OnlinePaymentResult["payment"] | null>(null);
  const [asking, setAsking] = useState(true);
  const callbacks = useRef({ onSettled, onDone });
  useEffect(() => {
    callbacks.current = { onSettled, onDone };
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function ask(tries: number) {
      try {
        const next = await apiClient.getOnlinePayment(workspaceId, paymentId);
        if (cancelled) return;
        setPayment(next.payment);
        const maxTries = hint === "fail" || hint === "back" ? 1 : RETURN_POLL_TRIES;
        if (IN_PROGRESS.has(next.payment.status) && tries < maxTries) {
          timer = setTimeout(() => void ask(tries + 1), RETURN_POLL_MS);
          return;
        }
        if (next.payment.status === "paid") callbacks.current.onSettled();
      } catch {
        if (cancelled) return;
      }
      setAsking(false);
      callbacks.current.onDone();
    }
    void ask(1);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [workspaceId, paymentId, hint]);

  const { message, variant } = returnMessage(t, payment, asking, hint);
  return (
    <Alert variant={variant} className="mt-4" role="status">
      {message}
    </Alert>
  );
}

function returnMessage(
  t: Record<keyof (typeof STRINGS)["en"], string>,
  payment: OnlinePaymentResult["payment"] | null,
  asking: boolean,
  hint: ReturnHint
): { message: string; variant: "default" | "success" | "danger" } {
  if (!payment) return { message: asking ? t.checking : t.notConfirmedYet, variant: "default" };
  switch (payment.status) {
    case "paid":
      return { message: t.paid, variant: "success" };
    case "mismatch":
      return { message: t.review, variant: "default" };
    case "paid_duplicate":
      return { message: t.duplicate, variant: "default" };
    case "created":
    case "open":
    case "pending":
      if (payment.referenceNumber) {
        const reference = fmt(t.awaitingReference, { method: payment.paymentMethod ?? "", reference: payment.referenceNumber });
        return { message: reference, variant: "default" };
      }
      if (asking) return { message: t.checking, variant: "default" };
      if (hint === "fail") return { message: t.notCompleted, variant: "default" };
      if (hint === "back") return { message: t.leftPayment, variant: "default" };
      return { message: t.stillPending, variant: "default" };
    default:
      return { message: t.notCompleted, variant: "danger" };
  }
}

/**
 * The Pay button, and a reference still awaiting payment (a Fawry code). An
 * open checkout's link isn't offered again: Fawaterak's links are single
 * attempts, so one already tried may be dead. Pay makes a new one.
 */
function OnlinePaymentPanel({ billing }: { billing: WorkspaceBilling }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = billing.onlinePayment?.latest ?? null;
  const awaiting = latest && latest.status === "pending" && latest.referenceNumber ? latest : null;
  const amount = billing.nextCharge ? formatMoney(billing.nextCharge.amount, billing.nextCharge.currency) : "";

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const { payment } = await apiClient.startOnlinePayment(workspaceId, locale);
      if (!payment.checkoutUrl) throw new Error("no checkout");
      window.location.assign(payment.checkoutUrl);
    } catch (err) {
      setError(
        errorMessage(err, {
          ONLINE_BILLING_DISABLED: t.payDisabled,
          ONLINE_BILLING_UNAVAILABLE: t.payUnavailable,
          ONLINE_PAYMENT_CURRENCY_UNSUPPORTED: t.payCurrency,
          ONLINE_PAYMENT_START_FAILED: t.payStartFailed,
          PAYMENT_STARTING: t.payStarting,
          NOTHING_TO_PAY: t.nothingToPay,
          PLAN_IS_FREE: t.nothingToPay,
          CHARGE_NOT_PENDING: t.chargeSettled,
        })
      );
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-[10px] border border-line bg-paper px-4 py-3">
      <p className="text-xs text-ink-soft">{t.payTitle}</p>
      <p className="text-sm text-ink">{fmt(t.payHint, { amount })}</p>
      {awaiting && (
        <p className="text-sm text-ink-soft">
          {fmt(t.awaitingReference, { method: awaiting.paymentMethod ?? "", reference: awaiting.referenceNumber! })}
        </p>
      )}
      <Button type="button" onClick={() => void pay()} disabled={busy} className="min-h-10">
        {busy ? t.opening : t.payNow}
      </Button>
      {error && <Alert variant="danger">{error}</Alert>}
    </div>
  );
}

function BillingDetails({ billing, onChange }: { billing: WorkspaceBilling; onChange: (next: WorkspaceBilling) => void }) {
  const t = useT(STRINGS);
  const { subscription, referralCode, nextCharge } = billing;
  const plan = subscription.plan;

  return (
    <div className="space-y-5">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-ink-soft">{t.plan}</dt>
          <dd className="mt-0.5 text-sm font-medium text-ink">
            {plan ? `${plan.name} · ${t[subscription.billingCycle]}` : t.noPlan}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">{t.status}</dt>
          <dd className="mt-0.5 text-sm font-medium text-ink">
            {t[subscription.status as keyof typeof t] ?? subscription.status}
            <span className="block text-xs font-normal text-ink-soft">
              {subscription.status === "trialing" && subscription.trialEndsAt
                ? fmt(t.trialEnds, { date: formatDate(subscription.trialEndsAt) })
                : fmt(t.renews, { date: formatDate(subscription.currentPeriodEnd) })}
            </span>
          </dd>
        </div>
        {nextCharge && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-ink-soft">{t.nextCharge}</dt>
            <dd className="mt-0.5 text-sm font-medium text-ink">
              {nextCharge.discountAmount > 0
                ? fmt(t.nextChargeDiscount, {
                    amount: formatMoney(nextCharge.amount, nextCharge.currency),
                    gross: formatMoney(nextCharge.grossAmount, nextCharge.currency),
                    discount: formatMoney(nextCharge.discountAmount, nextCharge.currency),
                  })
                : formatMoney(nextCharge.amount, nextCharge.currency)}
            </dd>
          </div>
        )}
      </dl>

      {billing.onlinePayment?.enabled && nextCharge && <OnlinePaymentPanel billing={billing} />}

      {plan && plan.monthlyPrice > 0 && <BillingCycleChoice billing={billing} onChange={onChange} />}

      {referralCode ? <AttachedCode code={referralCode} /> : <ReferralCodeForm onApplied={onChange} />}
    </div>
  );
}

/** Monthly or annual (10 × monthly), from the next charge. */
function BillingCycleChoice({ billing, onChange }: { billing: WorkspaceBilling; onChange: (next: WorkspaceBilling) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = billing.subscription.plan!;
  const current = billing.subscription.billingCycle;

  async function choose(cycle: "monthly" | "yearly") {
    if (cycle === current || busy) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await apiClient.setWorkspaceBillingCycle(workspaceId, cycle));
      toast.success(t.cycleSaved);
    } catch (err) {
      setError(errorMessage(err, { OPEN_CHARGE_EXISTS: t.cycleOpenCharge }));
    } finally {
      setBusy(false);
    }
  }

  const options: Array<{ value: "monthly" | "yearly"; label: string }> = [
    { value: "monthly", label: fmt(t.cycleMonthly, { price: formatMoney(plan.monthlyPrice, plan.currency) }) },
    { value: "yearly", label: fmt(t.cycleYearly, { price: formatMoney(plan.yearlyPrice, plan.currency) }) },
  ];

  return (
    <fieldset className="space-y-2" disabled={busy}>
      <legend className="text-xs text-ink-soft">{t.cycle}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2 text-sm",
              current === o.value ? "border-primary bg-primary-soft text-ink" : "border-line text-ink-soft"
            )}
          >
            <input
              type="radio"
              name="billing-cycle"
              value={o.value}
              checked={current === o.value}
              onChange={() => void choose(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
      <p className="text-xs text-ink-soft">{t.cycleHint}</p>
      {error && <Alert variant="danger">{error}</Alert>}
    </fieldset>
  );
}

function AttachedCode({ code }: { code: NonNullable<WorkspaceBilling["referralCode"]> }) {
  const t = useT(STRINGS);
  const discount =
    code.discountType === "percentage" && code.discountValue != null
      ? fmt(t.percentOff, { value: code.discountValue / 100 })
      : code.discountType === "fixed" && code.discountValue != null && code.discountCurrency
        ? fmt(t.fixedOff, { amount: formatMoney(code.discountValue, code.discountCurrency) })
        : t.noDiscount;
  return (
    <div className="rounded-[10px] border border-line bg-paper px-4 py-3">
      <p className="text-xs text-ink-soft">{t.referralCode}</p>
      <p className="mt-0.5 font-mono text-sm font-medium text-ink" dir="ltr">
        {code.code}
      </p>
      <p className="mt-1 text-sm text-ink-soft">{discount}</p>
      <p className="mt-1 text-xs text-ink-soft">{fmt(t.attachedOn, { date: formatDate(code.attachedAt) })}</p>
      {!code.active && (
        <Alert className="mt-3">{t.inactive}</Alert>
      )}
    </div>
  );
}

function ReferralCodeForm({ onApplied }: { onApplied: (next: WorkspaceBilling) => void }) {
  const t = useT(STRINGS);
  const id = useId();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await apiClient.attachReferralCode(workspaceId, code.trim());
      toast.success(t.applied);
      onApplied(next);
    } catch (err) {
      setError(errorMessage(err, { REFERRAL_CODE_INVALID: t.invalid, REFERRAL_CODE_ALREADY_SET: t.alreadySet }));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor={id}>{t.referralCode}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t.codePlaceholder}
          maxLength={32}
          dir="ltr"
          className="max-w-60 font-mono"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || code.trim().length < 3} className="min-h-10">
          {busy ? t.applying : t.apply}
        </Button>
      </div>
      <p className="text-xs text-ink-soft">{t.referralHint}</p>
      {error && <Alert variant="danger">{error}</Alert>}
    </form>
  );
}

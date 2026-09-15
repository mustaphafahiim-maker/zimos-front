import { Info } from "lucide-react";
import type { BillingOverview, BillingPlan, SubscriptionStatus } from "@store-builder/api-client";
import { Alert, Button, Card, cn, useAsync } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { isPermissionError } from "@/lib/errors";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { DataState } from "@/components/DataState";
import { fmt, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";

type Tone = "success" | "info" | "warning" | "danger" | "neutral";
const STATUS_TONE: Record<SubscriptionStatus, Tone> = {
  active: "success",
  trialing: "info",
  past_due: "warning",
  suspended: "danger",
  cancelled: "neutral",
};
const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success/25",
  info: "bg-info-soft text-info border-info/25",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/25",
  neutral: "bg-paper text-ink-soft border-line",
};
const STATUS_LABEL: Record<Locale, Record<SubscriptionStatus, string>> = {
  en: { active: "Active", trialing: "Trial", past_due: "Past due", suspended: "Suspended", cancelled: "Cancelled" },
  ar: { active: "شغّالة", trialing: "فترة تجريبية", past_due: "متأخرة في الدفع", suspended: "موقوفة", cancelled: "متلغية" },
};

const STRINGS = {
  en: {
    perMonth: "/ month",
    perYear: "/ year",
    trialEnds: "Trial ends {date}",
    periodEnds: "Current period ends {date}",
    graceUntil: "Grace period until {date}",
    cancelAtEnd: "Cancels at the end of this period",
    ordersThisPeriod: "Orders this period",
    softQuota: "Soft quota — orders above it are never blocked, we just suggest a bigger plan.",
    noQuota: "No order quota on this plan.",
    noSubscription: "This store doesn't have a subscription yet.",
    noPlan: "No plan",
    plans: "Plans",
    ordersQuota: "Up to {n} orders / period",
    unlimitedOrders: "No order quota",
    trialDays: "{n}-day free trial",
    currentPlan: "Current plan",
    changePlan: "Choose this plan",
    gatewayNote: "Online payment for subscriptions isn't available yet — contact support to change plan.",
    noPermission: "You don't have permission to view billing (billing.manage). Ask the store owner for access.",
  },
  ar: {
    perMonth: "/ شهريًا",
    perYear: "/ سنويًا",
    trialEnds: "الفترة التجريبية بتخلص {date}",
    periodEnds: "الفترة الحالية بتخلص {date}",
    graceUntil: "فترة سماح لحد {date}",
    cancelAtEnd: "الاشتراك هيتلغي في آخر الفترة دي",
    ordersThisPeriod: "طلبات الفترة دي",
    softQuota: "حد مرن — مش هنوقف أي طلبات لو عدّيته، بس هنقترح عليك باقة أكبر.",
    noQuota: "الباقة دي مالهاش حد للطلبات.",
    noSubscription: "المتجر ده لسه مالوش اشتراك.",
    noPlan: "مفيش باقة",
    plans: "الباقات",
    ordersQuota: "لحد {n} طلب في الفترة",
    unlimitedOrders: "من غير حد للطلبات",
    trialDays: "تجربة مجانية {n} يوم",
    currentPlan: "باقتك الحالية",
    changePlan: "اختار الباقة دي",
    gatewayNote: "الدفع أونلاين للاشتراكات لسه مش متاح — كلّم الدعم الفني عشان تغيّر باقتك.",
    noPermission: "معندكش صلاحية تشوف الفواتير والاشتراك (billing.manage). اطلب الصلاحية من صاحب المتجر.",
  },
} satisfies Messages;

export function PlanTab() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const billing = useAsync(() => apiClient.getBilling(workspaceId), [workspaceId]);

  if (billing.error && isPermissionError(billing.error)) {
    return (
      <Alert variant="warning" className="text-sm">
        <Info />
        <span>{t.noPermission}</span>
      </Alert>
    );
  }

  return (
    <DataState loading={billing.loading} error={billing.error} onRetry={() => billing.refresh()}>
      {billing.data && <PlanBody b={billing.data} />}
    </DataState>
  );
}

function PlanBody({ b }: { b: BillingOverview }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const sub = b.subscription;
  const plan = sub?.plan ?? null;
  const { ordersThisPeriod, softOrderQuota } = b.usage;
  const usagePct = softOrderQuota ? Math.min(100, Math.round((ordersThisPeriod / Math.max(softOrderQuota, 1)) * 100)) : 0;
  const yearly = sub?.billingCycle === "yearly";

  return (
    <div className="space-y-8">
      <Card className="rounded-2xl p-5">
        {sub ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-xl font-semibold text-ink">{plan?.name ?? t.noPlan}</p>
              <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", TONE_CLASS[STATUS_TONE[sub.status]])}>
                {STATUS_LABEL[locale][sub.status]}
              </span>
            </div>
            {plan && (
              <p className="mt-1 text-sm text-ink-soft">
                <bdi dir="ltr">{formatMoney(yearly ? plan.yearlyPriceAmount : plan.monthlyPriceAmount, plan.currency)}</bdi> {yearly ? t.perYear : t.perMonth}
              </p>
            )}
            <ul className="mt-2 space-y-0.5 text-sm text-ink-soft">
              {sub.status === "trialing" && sub.trialEndsAt && <li>{fmt(t.trialEnds, { date: formatDate(sub.trialEndsAt) })}</li>}
              {sub.currentPeriodEnd && <li>{fmt(t.periodEnds, { date: formatDate(sub.currentPeriodEnd) })}</li>}
              {sub.graceUntil && <li className="text-warning">{fmt(t.graceUntil, { date: formatDate(sub.graceUntil) })}</li>}
              {sub.cancelAtPeriodEnd && <li className="text-danger">{t.cancelAtEnd}</li>}
            </ul>
          </>
        ) : (
          <p className="text-sm text-ink-soft">{t.noSubscription}</p>
        )}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-soft">{t.ordersThisPeriod}</span>
            <span className="tabular-nums text-ink" dir="ltr">
              {formatNumber(ordersThisPeriod)}
              {softOrderQuota ? ` / ${formatNumber(softOrderQuota)}` : ""}
            </span>
          </div>
          {softOrderQuota ? (
            <>
              <div
                className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zimos-ice"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={softOrderQuota}
                aria-valuenow={ordersThisPeriod}
                aria-label={t.ordersThisPeriod}
              >
                <div className={cn("h-full rounded-full", usagePct >= 90 ? "bg-danger" : usagePct >= 70 ? "bg-warning" : "bg-primary")} style={{ width: `${usagePct}%` }} />
              </div>
              <p className="mt-1 text-xs text-ink-soft">{t.softQuota}</p>
            </>
          ) : (
            <p className="mt-1 text-xs text-ink-soft">{t.noQuota}</p>
          )}
        </div>
      </Card>

      {b.plans.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-display text-lg font-semibold text-ink">{t.plans}</h3>
          {!b.gatewayConnected && (
            <Alert variant="info" className="text-sm">
              <Info />
              <span>{t.gatewayNote}</span>
            </Alert>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {b.plans.map((pl) => (
              <PlanCard key={pl.id} plan={pl} current={plan?.id === pl.id} canChange={b.gatewayConnected} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PlanCard({ plan, current, canChange }: { plan: BillingPlan; current: boolean; canChange: boolean }) {
  const t = useT(STRINGS);
  return (
    <Card className={cn("flex flex-col rounded-2xl p-5", current && "ring-2 ring-primary")}>
      <p className="font-display text-lg font-semibold text-ink">{plan.name}</p>
      <p className="mt-1 text-sm text-ink-soft">
        <bdi dir="ltr" className="text-2xl font-semibold text-ink">
          {formatMoney(plan.monthlyPriceAmount, plan.currency)}
        </bdi>{" "}
        {t.perMonth}
      </p>
      <p className="text-xs text-ink-soft">
        <bdi dir="ltr">{formatMoney(plan.yearlyPriceAmount, plan.currency)}</bdi> {t.perYear}
      </p>
      <ul className="mt-4 flex-1 space-y-1.5 text-sm text-ink">
        <li>{plan.softOrderQuota ? fmt(t.ordersQuota, { n: formatNumber(plan.softOrderQuota) }) : t.unlimitedOrders}</li>
        {plan.trialDays > 0 && <li>{fmt(t.trialDays, { n: plan.trialDays })}</li>}
      </ul>
      <div className="mt-5">
        <Button variant={current ? "outline" : "primary"} className="w-full" disabled={current || !canChange}>
          {current ? t.currentPlan : t.changePlan}
        </Button>
      </div>
    </Card>
  );
}

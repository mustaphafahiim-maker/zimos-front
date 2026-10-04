import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Repeat, Settings2 } from "lucide-react";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  customerSubscriptionsChangeStatus,
  customerSubscriptionsList,
  customerSubscriptionsOverview,
  productPlanSet,
  productPlansList,
  type BillingInterval,
  type CustomerSubscription,
  type CustomerSubscriptionStatus,
  type ProductBillingPlan,
  type ProductPlanRow,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { formatDate, formatMoney } from "@/lib/format";
import { useT, fmt, useCommon, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Field, TextField } from "@/components/Field";
import { FilterTabs } from "@/components/FilterTabs";
import { KpiCard } from "@/components/KpiCard";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Subscriptions",
    description: "Products your customers pay for every period, or in installments, on a saved card.",
    tabs: "Subscriptions view",
    tabList: "Subscriptions",
    tabPlans: "Product plans",
    kpiActive: "Active",
    kpiActiveHint: "{amount} per period",
    kpiPastDue: "Payment failed",
    kpiNew: "New this month",
    kpiRevenue: "Collected",
    colCustomer: "Customer",
    colProduct: "Product",
    colPlan: "Plan",
    colNext: "Next charge",
    colStatus: "Status",
    kind_subscription: "Subscription",
    kind_installments: "Installments",
    every_week: "weekly",
    every_month: "monthly",
    every_year: "yearly",
    everyN: "every {n} {unit}",
    unit_week: "weeks",
    unit_month: "months",
    unit_year: "years",
    installmentsLeft: "{made} of {total} paid",
    status_trialing: "Trial",
    status_active: "Active",
    status_past_due: "Payment failed",
    status_paused: "Paused",
    status_cancelled: "Cancelled",
    status_completed: "Completed",
    noCard: "No saved card",
    retry: "Attempt {n} failed",
    none: "—",
    pause: "Pause",
    resume: "Resume",
    cancel: "Cancel",
    copyPortal: "Customer link",
    firstOrder: "First order",
    statusFilter: "Status",
    anyStatus: "Any status",
    emptyTitle: "No subscriptions yet",
    emptyDescription: "Put a product on a plan in “Product plans”. When a customer pays for it by card, the subscription starts here.",
    cancelTitle: "Cancel this subscription?",
    cancelDescription: "The customer is not charged again. Orders already paid are not refunded.",
    cancelling: "Cancelling…",
    plansIntro: "The product's price is what each payment charges. Plans need a card payment on a gateway that can save cards; a cash-on-delivery order never starts one.",
    colProductName: "Product",
    colCurrent: "How it is sold",
    once: "Sold once",
    planOf: "{kind}, {every}",
    planPayments: "{payments} payments, {every}",
    edit: "Change",
    planTitle: "How “{name}” is sold",
    mode: "Payment model",
    mode_once: "One payment",
    mode_subscription: "Subscription: charged every period until cancelled",
    mode_installments: "Installments: the same amount a fixed number of times",
    interval: "Every",
    payments: "Number of payments",
    trialDays: "Free trial (days)",
    trialHint: "Optional, up to 90. The first order charges nothing for the product and the first charge comes after the trial. One trial per customer; the store's card must be able to save cards without a payment when nothing else is due.",
    planTrial: "{days}-day free trial",
    planSaved: "Plan saved.",
    emptyPlans: "No products yet.",
  },
  ar: {
    title: "الاشتراكات",
    description: "منتجات يدفع عملاؤك ثمنها كل فترة، أو بالتقسيط، على بطاقة محفوظة.",
    tabs: "طريقة عرض الاشتراكات",
    tabList: "الاشتراكات",
    tabPlans: "خطط المنتجات",
    kpiActive: "نشطة",
    kpiActiveHint: "{amount} كل فترة",
    kpiPastDue: "فشل الدفع",
    kpiNew: "جديدة هذا الشهر",
    kpiRevenue: "المُحصَّل",
    colCustomer: "العميل",
    colProduct: "المنتج",
    colPlan: "الخطة",
    colNext: "الخصم القادم",
    colStatus: "الحالة",
    kind_subscription: "اشتراك",
    kind_installments: "تقسيط",
    every_week: "أسبوعيًا",
    every_month: "شهريًا",
    every_year: "سنويًا",
    everyN: "كل {n} {unit}",
    unit_week: "أسابيع",
    unit_month: "شهور",
    unit_year: "سنوات",
    installmentsLeft: "دُفع {made} من {total}",
    status_trialing: "تجربة",
    status_active: "نشط",
    status_past_due: "فشل الدفع",
    status_paused: "متوقف",
    status_cancelled: "ملغي",
    status_completed: "مكتمل",
    noCard: "لا توجد بطاقة محفوظة",
    retry: "فشلت المحاولة {n}",
    none: "—",
    pause: "إيقاف",
    resume: "استئناف",
    cancel: "إلغاء",
    copyPortal: "رابط العميل",
    firstOrder: "أول طلب",
    statusFilter: "الحالة",
    anyStatus: "كل الحالات",
    emptyTitle: "لا توجد اشتراكات بعد",
    emptyDescription: "ضع منتجًا على خطة من «خطط المنتجات». عندما يدفع العميل بالبطاقة يبدأ الاشتراك هنا.",
    cancelTitle: "إلغاء هذا الاشتراك؟",
    cancelDescription: "لن يُخصم من العميل مرة أخرى. الطلبات المدفوعة لا تُرد.",
    cancelling: "جارٍ الإلغاء…",
    plansIntro: "سعر المنتج هو ما يُخصم في كل دفعة. الخطط تحتاج دفعًا بالبطاقة على بوابة تحفظ البطاقات؛ طلب الدفع عند الاستلام لا يبدأ خطة.",
    colProductName: "المنتج",
    colCurrent: "طريقة البيع",
    once: "دفعة واحدة",
    planOf: "{kind}، {every}",
    planPayments: "{payments} دفعات، {every}",
    edit: "تغيير",
    planTitle: "طريقة بيع «{name}»",
    mode: "نموذج الدفع",
    mode_once: "دفعة واحدة",
    mode_subscription: "اشتراك: يُخصم كل فترة حتى الإلغاء",
    mode_installments: "تقسيط: نفس المبلغ عددًا محددًا من المرات",
    interval: "كل",
    payments: "عدد الدفعات",
    trialDays: "فترة تجربة مجانية (بالأيام)",
    trialHint: "اختياري، حتى ٩٠ يومًا. الطلب الأول لا يُحتسب فيه المنتج وأول خصم بعد فترة التجربة. تجربة واحدة لكل عميل؛ ويلزم أن تحفظ بوابة الدفع البطاقة دون دفع إذا لم يكن هناك مبلغ آخر مستحق.",
    planTrial: "تجربة مجانية {days} يوم",
    planSaved: "تم حفظ الخطة.",
    emptyPlans: "لا توجد منتجات بعد.",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

const STATUS_TONE: Record<CustomerSubscriptionStatus, "success" | "warning" | "danger" | "neutral" | "info"> = {
  trialing: "info",
  active: "success",
  past_due: "warning",
  paused: "neutral",
  cancelled: "danger",
  completed: "info",
};

function everyText(t: T, interval: BillingInterval, count: number): string {
  return count <= 1 ? t[`every_${interval}`] : fmt(t.everyN, { n: count, unit: t[`unit_${interval}`] });
}

/** Subscriptions (SPEC §18.1): what renews, what failed, and how each product is sold. */
export function SubscriptionsPage() {
  const t = useT(STRINGS);
  const [tab, setTab] = useState<"list" | "plans">("list");
  return (
    <div className="max-w-6xl">
      <PageHeader title={t.title} description={t.description} />
      <FilterTabs
        className="mb-4"
        label={t.tabs}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "list", label: t.tabList },
          { value: "plans", label: t.tabPlans },
        ]}
      />
      {tab === "list" ? <SubscriptionsTab onGoToPlans={() => setTab("plans")} /> : <PlansTab />}
    </div>
  );
}

function SubscriptionsTab({ onGoToPlans }: { onGoToPlans: () => void }) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [status, setStatus] = useState<"" | CustomerSubscriptionStatus>("");
  const overview = useAsync(() => customerSubscriptionsOverview(apiClient, workspaceId), [workspaceId]);
  const list = useAsync(() => customerSubscriptionsList(apiClient, workspaceId, { status: status || undefined, limit: 200 }), [workspaceId, status]);
  const [cancelling, setCancelling] = useState<CustomerSubscription | null>(null);
  const currency = overview.data?.currency ?? "EGP";

  async function act(sub: CustomerSubscription, action: "pause" | "resume" | "cancel") {
    const saved = await customerSubscriptionsChangeStatus(apiClient, workspaceId, sub.id, action);
    list.setData((prev) => (prev ?? []).map((row) => (row.id === saved.id ? { ...row, ...saved, customerName: row.customerName, customerPhone: row.customerPhone } : row)));
    void overview.refresh({ silent: true });
  }

  const columns: Column<CustomerSubscription>[] = [
    {
      key: "customer",
      header: t.colCustomer,
      cell: (s) => (
        <div className="min-w-0">
          <Link to={`/customers/${s.customerId}`} className="font-medium text-ink hover:text-primary">
            <bdi>{s.customerName || s.customerPhone || t.none}</bdi>
          </Link>
          <div className="text-xs text-ink-soft">
            <Link to={`/orders/${s.orderId}`} className="hover:text-primary">
              {t.firstOrder}
            </Link>
            {" · "}
            {formatDate(s.createdAt)}
          </div>
        </div>
      ),
    },
    {
      key: "product",
      header: t.colProduct,
      cell: (s) => (
        <span className="text-ink">
          <bdi>{s.productName}</bdi>
          {s.quantity > 1 && <span className="text-ink-soft"> × {s.quantity}</span>}
        </span>
      ),
    },
    {
      key: "plan",
      header: t.colPlan,
      cell: (s) => (
        <div>
          <p className="tabular-nums text-ink">
            {formatMoney(s.amount, s.currency)} <span className="text-ink-soft">{everyText(t, s.interval, s.intervalCount)}</span>
          </p>
          <p className="text-xs text-ink-soft">
            {s.kind === "installments" && s.installmentsTotal
              ? fmt(t.installmentsLeft, { made: s.paymentsMade, total: s.installmentsTotal })
              : t[`kind_${s.kind}`]}
          </p>
        </div>
      ),
    },
    {
      key: "next",
      header: t.colNext,
      cell: (s) => (
        <div className="text-ink-soft">
          <p>{s.nextRenewalAt ? formatDate(s.nextRenewalAt) : t.none}</p>
          {!s.hasCard && s.status !== "cancelled" && s.status !== "completed" && <p className="text-xs text-danger">{t.noCard}</p>}
          {s.failedAttempts > 0 && s.status === "past_due" && <p className="text-xs text-danger">{fmt(t.retry, { n: s.failedAttempts })}</p>}
        </div>
      ),
    },
    { key: "status", header: t.colStatus, cell: (s) => <StatusBadge value={s.status} tone={STATUS_TONE[s.status]} text={t[`status_${s.status}`]} /> },
    {
      key: "actions",
      header: <span className="sr-only">{common.actions}</span>,
      align: "end",
      cell: (s) => {
        const ended = s.status === "cancelled" || s.status === "completed";
        const run = (action: "pause" | "resume") => () => void act(s, action).catch((err) => toast.error(errorMessage(err)));
        return (
          <div className="flex flex-wrap justify-end gap-2">
            <CopyButton value={`${STOREFRONT_URL}/store/${workspaceId}/subscriptions/${s.portalToken}`} label={t.copyPortal} />
            {!ended && s.status !== "paused" && (
              <Button size="sm" variant="outline" className="min-h-9" onClick={run("pause")}>
                {t.pause}
              </Button>
            )}
            {(s.status === "paused" || s.status === "past_due") && s.hasCard && (
              <Button size="sm" variant="outline" className="min-h-9" onClick={run("resume")}>
                {t.resume}
              </Button>
            )}
            {!ended && (
              <Button size="sm" variant="outline" className="min-h-9" onClick={() => setCancelling(s)}>
                {t.cancel}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={t.kpiActive}
          value={String(overview.data?.active ?? "—")}
          hint={overview.data ? fmt(t.kpiActiveHint, { amount: formatMoney(overview.data.activeAmount, currency) }) : undefined}
          icon={<Repeat aria-hidden />}
        />
        <KpiCard label={t.kpiPastDue} value={String(overview.data?.pastDue ?? "—")} />
        <KpiCard label={t.kpiNew} value={String(overview.data?.newThisMonth ?? "—")} />
        <KpiCard label={t.kpiRevenue} value={overview.data ? formatMoney(overview.data.revenue, currency) : "—"} />
      </div>

      <Field label={t.statusFilter} labelHidden className="w-56">
        {(props) => (
          <Select {...props} value={status} onChange={(e) => setStatus(e.target.value as "" | CustomerSubscriptionStatus)}>
            <option value="">
              {t.statusFilter}: {t.anyStatus}
            </option>
            {(["active", "past_due", "paused", "cancelled", "completed"] as const).map((key) => (
              <option key={key} value={key}>
                {t[`status_${key}`]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        <Card className="p-0">
          <DataTable
            columns={columns}
            rows={list.data ?? []}
            rowKey={(s) => s.id}
            minWidth="64rem"
            empty={
              <EmptyState
                icon={<Repeat className="size-6" aria-hidden />}
                title={t.emptyTitle}
                description={t.emptyDescription}
                action={status === "" ? <Button onClick={onGoToPlans}>{t.tabPlans}</Button> : undefined}
              />
            }
          />
        </Card>
      </DataState>

      <ConfirmDialog
        open={cancelling !== null}
        title={t.cancelTitle}
        description={t.cancelDescription}
        confirmLabel={t.cancel}
        busyLabel={t.cancelling}
        cancelLabel={common.back}
        destructive
        onCancel={() => setCancelling(null)}
        onConfirm={async () => {
          if (!cancelling) return;
          try {
            await act(cancelling, "cancel");
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          setCancelling(null);
        }}
      />
    </div>
  );
}

function PlansTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const list = useAsync(() => productPlansList(apiClient, workspaceId), [workspaceId]);
  const [editing, setEditing] = useState<ProductPlanRow | null>(null);

  const describe = (plan: ProductBillingPlan | null) => {
    if (!plan) return t.once;
    const every = everyText(t, plan.interval, plan.intervalCount ?? 1);
    if (plan.mode === "installments") return fmt(t.planPayments, { payments: plan.payments, every });
    const text = fmt(t.planOf, { kind: t.kind_subscription, every });
    return plan.trialDays ? `${text} · ${fmt(t.planTrial, { days: plan.trialDays })}` : text;
  };

  const columns: Column<ProductPlanRow>[] = [
    {
      key: "name",
      header: t.colProductName,
      cell: (p) => (
        <Link to={`/catalog/${p.id}`} className="font-medium text-ink hover:text-primary">
          <bdi>{p.name}</bdi>
        </Link>
      ),
    },
    {
      key: "plan",
      header: t.colCurrent,
      cell: (p) => (p.billingPlan ? <StatusBadge value="plan" tone="info" text={describe(p.billingPlan)} /> : <span className="text-ink-soft">{t.once}</span>),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t.edit}</span>,
      align: "end",
      cell: (p) => (
        <Button size="sm" variant="outline" className="min-h-9" onClick={() => setEditing(p)}>
          <Settings2 className="size-4" aria-hidden />
          {t.edit}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-ink-soft">{t.plansIntro}</p>
      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        <Card className="p-0">
          <DataTable columns={columns} rows={list.data ?? []} rowKey={(p) => p.id} minWidth="36rem" empty={<EmptyState title={t.emptyPlans} />} />
        </Card>
      </DataState>
      <PlanModal
        product={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void list.refresh({ silent: true });
        }}
      />
    </div>
  );
}

function PlanModal({ product, onClose, onSaved }: { product: ProductPlanRow | null; onClose: () => void; onSaved: () => void }) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [mode, setMode] = useState<"once" | "subscription" | "installments">("once");
  const [interval, setIntervalValue] = useState<BillingInterval>("month");
  const [payments, setPayments] = useState("3");
  const [trialDays, setTrialDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    const plan = product.billingPlan;
    setMode(plan ? plan.mode : "once");
    setIntervalValue(plan?.interval ?? "month");
    setPayments(plan && plan.mode === "installments" ? String(plan.payments) : "3");
    setTrialDays(plan && plan.mode === "subscription" && plan.trialDays ? String(plan.trialDays) : "");
    setError(null);
  }, [product]);

  const count = Math.floor(Number(payments));
  const trial = trialDays.trim() === "" ? 0 : Math.floor(Number(trialDays));
  const valid =
    (mode !== "installments" || (Number.isFinite(count) && count >= 2 && count <= 36)) &&
    (mode !== "subscription" || (Number.isFinite(trial) && trial >= 0 && trial <= 90));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!product) return;
    setBusy(true);
    setError(null);
    const plan: ProductBillingPlan | null =
      mode === "once"
        ? null
        : mode === "subscription"
          ? { mode, interval, intervalCount: 1, ...(trial > 0 ? { trialDays: trial } : {}) }
          : { mode, interval, intervalCount: 1, payments: count };
    try {
      await productPlanSet(apiClient, workspaceId, product.id, plan);
      toast.success(t.planSaved);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={product !== null} onClose={onClose} title={product ? fmt(t.planTitle, { name: product.name }) : ""}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Field label={t.mode}>
          {(props) => (
            <Select {...props} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="once">{t.mode_once}</option>
              <option value="subscription">{t.mode_subscription}</option>
              <option value="installments">{t.mode_installments}</option>
            </Select>
          )}
        </Field>
        {mode !== "once" && (
          <Field label={t.interval}>
            {(props) => (
              <Select {...props} value={interval} onChange={(e) => setIntervalValue(e.target.value as BillingInterval)}>
                <option value="week">{t.every_week}</option>
                <option value="month">{t.every_month}</option>
                <option value="year">{t.every_year}</option>
              </Select>
            )}
          </Field>
        )}
        {mode === "installments" && (
          <TextField label={t.payments} type="number" min={2} max={36} required value={payments} onChange={(e) => setPayments(e.target.value)} />
        )}
        {mode === "subscription" && (
          <TextField label={t.trialDays} hint={t.trialHint} type="number" min={0} max={90} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" disabled={busy || !valid}>
            {busy ? common.saving : common.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

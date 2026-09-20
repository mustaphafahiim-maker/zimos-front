import { useState } from "react";
import { BarChart3, PackageCheck, ShoppingBag, Users, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { BarChart, HBarList, LineAreaChart } from "@/components/charts";
import { RangeSwitch } from "@/components/RangeSwitch";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, formatPercentValue } from "@/lib/format";
import {
  deltaBasisPoints,
  formatAxisDate,
  formatCount,
  percentToRatio,
  useAnalyticsSummary,
  type AnalyticsRange,
} from "@/lib/analytics";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Analytics",
    description:
      "Revenue, orders, confirmation and delivery, all counted from your real orders. Nothing here is estimated.",
    revenue: "Revenue",
    revenueHint: "Orders placed, minus cancelled and rejected ones",
    orders: "Orders",
    avgOrderValue: "Average order value",
    avgOrderHint: "Revenue ÷ orders",
    deliveredRevenue: "Delivered revenue",
    deliveredRevenueHint: "Value of the orders that reached the customer",
    collected: "Cash collected",
    collectedHint: "Payments actually recorded against orders",
    confirmationRate: "Confirmation rate",
    confirmationHint: "Confirmed ÷ orders you got an answer on",
    deliveryRate: "Delivery rate",
    deliveryHint: "Delivered ÷ confirmed",
    returnRate: "Return rate",
    returnHint: "Returned ÷ (delivered + returned)",
    newCustomers: "New customers",
    revenueChartTitle: "Revenue per day",
    revenueChartDesc: "Daily revenue in {currency}, across the range.",
    ordersChartTitle: "Orders per day",
    ordersChartDesc: "How many orders came in each day.",
    ordersCount: "{n} orders",
    noActivity: "No orders in this range",
    noActivityDesc: "The charts fill in as soon as orders start coming in.",
    statusTitle: "Where the orders stand",
    statusDesc: "The orders placed in this range, by the state they are in now.",
    statusPending: "Waiting for confirmation",
    statusConfirmed: "Confirmed",
    statusPostponed: "Postponed",
    statusUnreachable: "Couldn't reach them",
    statusRejected: "Rejected",
    statusCancelled: "Cancelled",
    statusDelivered: "Delivered",
    statusReturned: "Returned",
    productsTitle: "Top products",
    productsDesc: "The five best sellers in this range, by units sold.",
    units: "{n} units",
    noProducts: "Nothing sold yet in this range",
    noProductsDesc: "Once orders come in, your best sellers are listed here.",
    unnamedProduct: "Unnamed product",
  },
  ar: {
    title: "التحليلات",
    description:
      "المبيعات والطلبات ونسب التأكيد والتوصيل، كلها متحسوبة من طلباتك الحقيقية. مفيش رقم هنا تقديري.",
    revenue: "المبيعات",
    revenueHint: "الطلبات اللي اتعملت، ناقص الملغي والمرفوض",
    orders: "الطلبات",
    avgOrderValue: "متوسط قيمة الطلب",
    avgOrderHint: "المبيعات ÷ الطلبات",
    deliveredRevenue: "مبيعات اتسلّمت",
    deliveredRevenueHint: "قيمة الطلبات اللي وصلت للعميل",
    collected: "الفلوس اللي اتحصّلت",
    collectedHint: "الدفعات اللي اتسجّلت فعلاً على الطلبات",
    confirmationRate: "نسبة التأكيد",
    confirmationHint: "المتأكد ÷ الطلبات اللي جالك فيها رد",
    deliveryRate: "نسبة التوصيل",
    deliveryHint: "اللي اتسلّم ÷ المتأكد",
    returnRate: "نسبة المرتجع",
    returnHint: "المرتجع ÷ (اللي اتسلّم + المرتجع)",
    newCustomers: "عملاء جداد",
    revenueChartTitle: "المبيعات كل يوم",
    revenueChartDesc: "مبيعات كل يوم بـ {currency} على طول الفترة.",
    ordersChartTitle: "الطلبات كل يوم",
    ordersChartDesc: "كام طلب جه كل يوم.",
    ordersCount: "{n} طلب",
    noActivity: "مفيش طلبات في الفترة دي",
    noActivityDesc: "الرسومات هتتملى أول ما الطلبات تبدأ تيجي.",
    statusTitle: "الطلبات واقفة فين",
    statusDesc: "الطلبات اللي اتعملت في الفترة دي، حسب حالتها دلوقتي.",
    statusPending: "مستنية التأكيد",
    statusConfirmed: "متأكدة",
    statusPostponed: "متأجلة",
    statusUnreachable: "مردّوش",
    statusRejected: "مرفوضة",
    statusCancelled: "ملغية",
    statusDelivered: "اتسلّمت",
    statusReturned: "مرتجعة",
    productsTitle: "أكتر المنتجات مبيعاً",
    productsDesc: "أحسن خمس منتجات في الفترة دي، حسب عدد القطع.",
    units: "{n} قطعة",
    noProducts: "مفيش حاجة اتباعت في الفترة دي",
    noProductsDesc: "أول ما الطلبات تيجي، أكتر منتجاتك مبيعاً هتتعرض هنا.",
    unnamedProduct: "منتج من غير اسم",
  },
} satisfies Messages;

/** A titled block, matching the section style the other screens use. */
function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
      <h2 className="font-display text-base font-medium text-ink">{title}</h2>
      <p className="mb-3 text-xs text-ink-soft">{description}</p>
      {children}
    </section>
  );
}

export function AnalyticsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const summary = useAnalyticsSummary(workspaceId, range);

  const current = summary.data?.current ?? null;
  const previous = summary.data?.previous ?? null;
  const currency = current?.currency ?? "EGP";
  const money = (value: number) => <bdi dir="ltr">{formatMoney(value, currency)}</bdi>;
  const percent = (value: number | null) => (
    <bdi dir="ltr">{formatPercentValue(percentToRatio(value))}</bdi>
  );
  const count = (value: number) => <bdi dir="ltr">{formatCount(value)}</bdi>;

  const hasOrders = Boolean(current && current.orders.placed > 0);

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={<RangeSwitch value={range} onChange={setRange} />}
      />

      <DataState
        loading={summary.loading && !current}
        error={summary.error}
        onRetry={() => summary.refresh()}
      >
        {current && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
              <KpiCard
                label={t.revenue}
                value={money(current.revenue.gross)}
                deltaBasisPoints={deltaBasisPoints(current.revenue.gross, previous?.revenue.gross)}
                hint={t.revenueHint}
                icon={<Wallet />}
              />
              <KpiCard
                label={t.orders}
                value={count(current.orders.placed)}
                deltaBasisPoints={deltaBasisPoints(current.orders.placed, previous?.orders.placed)}
                to="/orders"
                icon={<ShoppingBag />}
              />
              <KpiCard
                label={t.avgOrderValue}
                value={money(current.revenue.averageOrderValue)}
                hint={t.avgOrderHint}
              />
              <KpiCard
                label={t.deliveredRevenue}
                value={money(current.revenue.delivered)}
                hint={t.deliveredRevenueHint}
                icon={<PackageCheck />}
              />
              <KpiCard
                label={t.collected}
                value={money(current.revenue.collected)}
                hint={t.collectedHint}
              />
              <KpiCard
                label={t.confirmationRate}
                value={percent(current.rates.confirmation)}
                hint={t.confirmationHint}
                to="/confirmation-queue"
              />
              <KpiCard
                label={t.deliveryRate}
                value={percent(current.rates.delivery)}
                hint={t.deliveryHint}
              />
              <KpiCard
                label={t.returnRate}
                value={percent(current.rates.return)}
                hint={t.returnHint}
                to="/returns"
              />
              <KpiCard
                label={t.newCustomers}
                value={count(current.newCustomers)}
                deltaBasisPoints={deltaBasisPoints(current.newCustomers, previous?.newCustomers)}
                to="/customers"
                icon={<Users />}
              />
            </div>

            {hasOrders ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel
                  title={t.revenueChartTitle}
                  description={fmt(t.revenueChartDesc, { currency })}
                >
                  {/* A time axis reads left-to-right in Arabic too. */}
                  <div dir="ltr">
                    <LineAreaChart
                      summary={fmt(t.revenueChartDesc, { currency })}
                      points={current.series.map((day) => ({
                        label: formatAxisDate(day.date),
                        value: day.revenue,
                      }))}
                      format={(value) => formatMoney(value, currency)}
                    />
                  </div>
                </Panel>
                <Panel title={t.ordersChartTitle} description={t.ordersChartDesc}>
                  <div dir="ltr">
                    <BarChart
                      summary={t.ordersChartDesc}
                      points={current.series.map((day) => ({
                        label: formatAxisDate(day.date),
                        value: day.orders,
                      }))}
                      format={(value) => fmt(t.ordersCount, { n: formatCount(value) })}
                    />
                  </div>
                </Panel>
              </div>
            ) : (
              <EmptyState icon={<BarChart3 />} title={t.noActivity} description={t.noActivityDesc} />
            )}

            {hasOrders && (
              <Panel title={t.statusTitle} description={t.statusDesc}>
                <HBarList
                  format={(value) => formatCount(value)}
                  rows={[
                    { label: t.statusPending, value: current.orders.pending },
                    { label: t.statusConfirmed, value: current.orders.confirmed },
                    { label: t.statusPostponed, value: current.orders.postponed },
                    { label: t.statusUnreachable, value: current.orders.unreachable },
                    { label: t.statusRejected, value: current.orders.rejected },
                    { label: t.statusCancelled, value: current.orders.cancelled },
                    { label: t.statusDelivered, value: current.orders.delivered },
                    { label: t.statusReturned, value: current.orders.returned },
                  ]}
                />
              </Panel>
            )}

            <Panel title={t.productsTitle} description={t.productsDesc}>
              {current.topProducts.length === 0 ? (
                <EmptyState
                  icon={<BarChart3 />}
                  title={t.noProducts}
                  description={t.noProductsDesc}
                />
              ) : (
                <HBarList
                  format={(value) => formatMoney(value, currency)}
                  rows={current.topProducts.map((product) => ({
                    label: product.name ?? t.unnamedProduct,
                    value: product.revenue,
                    caption: fmt(t.units, { n: formatCount(product.quantity) }),
                  }))}
                />
              )}
            </Panel>
          </div>
        )}
      </DataState>
    </div>
  );
}

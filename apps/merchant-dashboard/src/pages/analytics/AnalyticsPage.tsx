import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@store-builder/ui";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, formatNumber, formatPercentValue, formatShortDate } from "@/lib/format";
import { deltaBp, pctRatio, useAnalyticsSummary } from "@/lib/analyticsSummary";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { BarChart, HBarList, LineAreaChart } from "@/components/charts";
import { RangeSwitch, type AnalyticsRange } from "@/components/RangeSwitch";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Analytics",
    description: "Revenue, orders, confirmation and delivery performance from your real orders.",
    revenue: "Revenue",
    orders: "Orders",
    avgOrderValue: "Avg order value",
    avgOrderHint: "Revenue ÷ orders",
    confirmationRate: "Confirmation rate",
    confirmationHint: "Orders confirmed by phone / WhatsApp",
    deliveryRate: "Delivery rate",
    deliveryHint: "Orders that reached the customer",
    returnRate: "Return rate",
    returnHint: "Delivered orders returned",
    deliveredRevenue: "Delivered revenue",
    deliveredRevenueHint: "Value of delivered orders",
    collected: "Cash collected",
    collectedHint: "Payments actually received",
    newCustomers: "New customers",
    revenueChartDesc: "Daily revenue, {currency}.",
    ordersChartDesc: "Orders placed per day.",
    ordersCount: "{n} orders",
    noActivity: "No orders in this range yet",
    noActivityDesc: "Charts will fill in once orders come in.",
    statusTitle: "Order status",
    statusDesc: "Where the orders placed in this range stand now.",
    statusPending: "Awaiting confirmation",
    statusConfirmed: "Confirmed",
    statusPostponed: "Postponed",
    statusUnreachable: "Unreachable",
    statusRejected: "Rejected",
    statusCancelled: "Cancelled",
    statusDelivered: "Delivered",
    statusReturned: "Returned",
    breakdownsTitle: "Breakdowns",
    breakdownsDesc: "What sold in this range.",
    tabProducts: "Top products",
    units: "{n} units",
    noProducts: "No product sales yet",
    noProductsDesc: "Top-selling products will appear here once orders come in.",
  },
  ar: {
    title: "التحليلات",
    description: "المبيعات والطلبات ونسب التأكيد والتوصيل من طلباتك الحقيقية.",
    revenue: "المبيعات",
    orders: "الطلبات",
    avgOrderValue: "متوسط قيمة الطلب",
    avgOrderHint: "المبيعات ÷ الطلبات",
    confirmationRate: "نسبة التأكيد",
    confirmationHint: "طلبات اتأكدت بالتليفون / واتساب",
    deliveryRate: "نسبة التوصيل",
    deliveryHint: "طلبات وصلت للعميل",
    returnRate: "نسبة المرتجع",
    returnHint: "طلبات اتسلمت ورجعت",
    deliveredRevenue: "مبيعات اتسلّمت",
    deliveredRevenueHint: "قيمة الطلبات اللي اتسلّمت",
    collected: "الفلوس اللي اتحصّلت",
    collectedHint: "المدفوعات اللي وصلت فعلًا",
    newCustomers: "عملاء جداد",
    revenueChartDesc: "المبيعات كل يوم بعملة {currency}.",
    ordersChartDesc: "عدد الطلبات كل يوم.",
    ordersCount: "{n} طلب",
    noActivity: "مفيش طلبات في الفترة دي لسه",
    noActivityDesc: "الرسومات هتظهر أول ما الطلبات تيجي.",
    statusTitle: "حالة الطلبات",
    statusDesc: "الطلبات اللي اتعملت في الفترة دي وصلت لفين.",
    statusPending: "مستني التأكيد",
    statusConfirmed: "متأكد",
    statusPostponed: "متأجل",
    statusUnreachable: "مش بيرد",
    statusRejected: "مرفوض",
    statusCancelled: "ملغي",
    statusDelivered: "اتسلّم",
    statusReturned: "مرتجع",
    breakdownsTitle: "التفاصيل",
    breakdownsDesc: "إيه اللي اتباع في الفترة دي.",
    tabProducts: "أكتر المنتجات مبيعًا",
    units: "{n} قطعة",
    noProducts: "مفيش مبيعات منتجات لسه",
    noProductsDesc: "أكتر المنتجات مبيعًا هتظهر هنا أول ما الطلبات تيجي.",
  },
} satisfies Messages;

export function AnalyticsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const summary = useAnalyticsSummary(workspaceId, range);

  const a = summary.data?.current ?? null;
  const prev = summary.data?.previous ?? null;
  const currency = a?.currency ?? "EGP";
  const money = (v: number) => <bdi dir="ltr">{formatMoney(v, currency)}</bdi>;
  const pct = (v: number | null) => <bdi dir="ltr">{formatPercentValue(pctRatio(v))}</bdi>;

  const statusRows = a
    ? [
        { label: t.statusPending, value: a.orders.pending },
        { label: t.statusConfirmed, value: a.orders.confirmed },
        { label: t.statusPostponed, value: a.orders.postponed },
        { label: t.statusUnreachable, value: a.orders.unreachable },
        { label: t.statusRejected, value: a.orders.rejected },
        { label: t.statusCancelled, value: a.orders.cancelled },
        { label: t.statusDelivered, value: a.orders.delivered },
        { label: t.statusReturned, value: a.orders.returned },
      ].map((r) => ({ ...r, caption: fmt(t.ordersCount, { n: formatNumber(r.value) }) }))
    : [];

  const hasOrders = !!a && a.orders.placed > 0 && a.series.length > 0;

  return (
    <div>
      <PageHeader title={t.title} description={t.description} actions={<RangeSwitch value={range} onChange={setRange} />} />

      <DataState loading={summary.loading && !a} error={summary.error} onRetry={() => summary.refresh()}>
        {a && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
              <KpiCard label={t.revenue} value={money(a.revenue.gross)} deltaBasisPoints={deltaBp(a.revenue.gross, prev?.revenue.gross)} />
              <KpiCard label={t.orders} value={<bdi dir="ltr">{formatNumber(a.orders.placed)}</bdi>} deltaBasisPoints={deltaBp(a.orders.placed, prev?.orders.placed)} to="/orders" />
              <KpiCard label={t.avgOrderValue} value={money(a.revenue.averageOrderValue)} hint={t.avgOrderHint} />
              <KpiCard label={t.deliveredRevenue} value={money(a.revenue.delivered)} hint={t.deliveredRevenueHint} />
              <KpiCard label={t.collected} value={money(a.revenue.collected)} hint={t.collectedHint} />
              <KpiCard label={t.confirmationRate} value={pct(a.rates.confirmation)} hint={t.confirmationHint} to="/confirmation-queue" />
              <KpiCard label={t.deliveryRate} value={pct(a.rates.delivery)} hint={t.deliveryHint} to="/shipping" />
              <KpiCard label={t.returnRate} value={pct(a.rates.return)} hint={t.returnHint} to="/returns" />
              <KpiCard label={t.newCustomers} value={<bdi dir="ltr">{formatNumber(a.newCustomers)}</bdi>} deltaBasisPoints={deltaBp(a.newCustomers, prev?.newCustomers)} to="/customers" />
            </div>

            {hasOrders ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="font-semibold">{t.revenue}</CardTitle>
                    <CardDescription>{fmt(t.revenueChartDesc, { currency })}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div dir="ltr">
                      <LineAreaChart points={a.series.map((d) => ({ label: formatShortDate(d.date), value: d.revenue }))} format={(v) => formatMoney(v, currency)} height={200} />
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="font-semibold">{t.orders}</CardTitle>
                    <CardDescription>{t.ordersChartDesc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div dir="ltr">
                      <BarChart
                        points={a.series.map((d) => ({ label: formatShortDate(d.date), value: d.orders }))}
                        format={(v) => fmt(t.ordersCount, { n: formatNumber(v) })}
                        color="var(--color-primary)"
                        height={200}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <EmptyState icon={<BarChart3 />} title={t.noActivity} description={t.noActivityDesc} />
            )}

            {a.orders.placed > 0 && (
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="font-semibold">{t.statusTitle}</CardTitle>
                  <CardDescription>{t.statusDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <HBarList rows={statusRows} />
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="font-semibold">{t.breakdownsTitle}</CardTitle>
                <CardDescription>{t.breakdownsDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="products">
                  <TabsList>
                    <TabsTrigger value="products">{t.tabProducts}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="products" className="pt-4">
                    {a.topProducts.length === 0 ? (
                      <EmptyState icon={<BarChart3 />} title={t.noProducts} description={t.noProductsDesc} />
                    ) : (
                      <HBarList
                        rows={a.topProducts.map((p) => ({
                          label: p.name,
                          value: p.revenue,
                          caption: `${fmt(t.units, { n: formatNumber(p.quantity) })} · ${formatMoney(p.revenue, currency)}`,
                        }))}
                        format={(v) => formatMoney(v, currency)}
                      />
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </DataState>
    </div>
  );
}

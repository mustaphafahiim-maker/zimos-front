import { useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@store-builder/ui";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, formatNumber, formatPercentValue, formatShortDate } from "@/lib/format";
import { deltaBp, pctRatio, useAnalyticsSummary } from "@/lib/analyticsSummary";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { BarChart } from "@/components/charts";
import { RangeSwitch, type AnalyticsRange } from "@/components/RangeSwitch";

const STRINGS = {
  en: {
    title: "Profit",
    description: "Gross profit on delivered orders: what customers paid for items, minus discounts, product cost and refunds.",
    grossProfit: "Gross profit",
    margin: "Gross margin",
    marginHint: "Gross profit ÷ delivered items revenue",
    itemsRevenue: "Delivered items revenue",
    discounts: "Discounts",
    productCost: "Product cost (COGS)",
    refunds: "Refunds",
    coverageWarning: "{pct} of delivered units have a cost price — add cost prices to products for accurate profit.",
    coverageUnknown: "We can't tell yet how many delivered units have a cost price — add cost prices to products for accurate profit.",
    goToCatalog: "Go to products",
    breakdownTitle: "Breakdown",
    breakdownDesc: "How gross profit is calculated.",
    dailyTitle: "Delivered orders",
    dailyDesc: "Orders delivered per day.",
    ordersCount: "{n} orders",
    noDelivered: "No delivered orders in this range yet",
    noDeliveredDesc: "Profit is counted on delivered orders only, so it will show up once orders get delivered.",
  },
  ar: {
    title: "الربح",
    description: "إجمالي الربح من الطلبات اللي اتسلّمت: تمن المنتجات ناقص الخصومات وتكلفة المنتجات والمبالغ المسترجعة.",
    grossProfit: "إجمالي الربح",
    margin: "هامش الربح",
    marginHint: "إجمالي الربح ÷ مبيعات المنتجات اللي اتسلّمت",
    itemsRevenue: "مبيعات المنتجات اللي اتسلّمت",
    discounts: "الخصومات",
    productCost: "تكلفة المنتجات",
    refunds: "المبالغ المسترجعة",
    coverageWarning: "{pct} بس من القطع اللي اتسلّمت ليها سعر تكلفة — ضيف سعر التكلفة للمنتجات عشان الربح يطلع مظبوط.",
    coverageUnknown: "لسه مش عارفين كام قطعة اتسلّمت ليها سعر تكلفة — ضيف سعر التكلفة للمنتجات عشان الربح يطلع مظبوط.",
    goToCatalog: "روح للمنتجات",
    breakdownTitle: "التفاصيل",
    breakdownDesc: "إزاي بنحسب إجمالي الربح.",
    dailyTitle: "الطلبات اللي اتسلّمت",
    dailyDesc: "عدد الطلبات اللي اتسلّمت كل يوم.",
    ordersCount: "{n} طلب",
    noDelivered: "مفيش طلبات اتسلّمت في الفترة دي لسه",
    noDeliveredDesc: "الربح بيتحسب على الطلبات اللي اتسلّمت بس، فهيظهر أول ما الطلبات تتسلّم.",
  },
} satisfies Messages;

export function ProfitPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const summary = useAnalyticsSummary(workspaceId, range);

  const a = summary.data?.current ?? null;
  const prev = summary.data?.previous ?? null;
  const currency = a?.currency ?? "EGP";
  const money = (v: number) => <bdi dir="ltr">{formatMoney(v, currency)}</bdi>;

  const p = a?.profit;
  const marginRatio = p && p.deliveredItemsRevenue > 0 ? p.grossProfit / p.deliveredItemsRevenue : null;
  const hasDelivered = !!a && a.orders.delivered > 0;

  return (
    <div>
      <PageHeader title={t.title} description={t.description} actions={<RangeSwitch value={range} onChange={setRange} />} />

      <DataState loading={summary.loading && !a} error={summary.error} onRetry={() => summary.refresh()}>
        {a && p && (
          <div className="space-y-6">
            {hasDelivered && (p.costCoverage === null || p.costCoverage < 100) && (
              <Alert variant="warning" className="text-sm">
                <p>
                  {p.costCoverage === null
                    ? t.coverageUnknown
                    : fmt(t.coverageWarning, { pct: formatPercentValue(pctRatio(p.costCoverage)) })}{" "}
                  <Link to="/catalog" className="font-medium underline">
                    {t.goToCatalog}
                  </Link>
                </p>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <KpiCard label={t.grossProfit} value={money(p.grossProfit)} deltaBasisPoints={deltaBp(p.grossProfit, prev?.profit.grossProfit)} icon={<TrendingUp />} />
              <KpiCard label={t.margin} value={<bdi dir="ltr">{formatPercentValue(marginRatio)}</bdi>} hint={t.marginHint} />
              <KpiCard label={t.itemsRevenue} value={money(p.deliveredItemsRevenue)} deltaBasisPoints={deltaBp(p.deliveredItemsRevenue, prev?.profit.deliveredItemsRevenue)} />
              <KpiCard label={t.discounts} value={money(p.discounts)} />
              <KpiCard label={t.productCost} value={money(p.productCost)} />
              <KpiCard label={t.refunds} value={money(p.refunded)} />
            </div>

            {hasDelivered ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="font-semibold">{t.breakdownTitle}</CardTitle>
                    <CardDescription>{t.breakdownDesc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <dl className="divide-y divide-line text-sm">
                      {[
                        { label: t.itemsRevenue, value: p.deliveredItemsRevenue, sign: "" },
                        { label: t.discounts, value: p.discounts, sign: "−" },
                        { label: t.productCost, value: p.productCost, sign: "−" },
                        { label: t.refunds, value: p.refunded, sign: "−" },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3 py-2">
                          <dt className="text-ink-soft">{row.label}</dt>
                          <dd className="tabular text-ink">
                            <bdi dir="ltr">
                              {row.sign}
                              {formatMoney(row.value, currency)}
                            </bdi>
                          </dd>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-3 py-2 font-semibold">
                        <dt className="text-ink">{t.grossProfit}</dt>
                        <dd className={p.grossProfit < 0 ? "tabular text-danger" : "tabular text-success"}>{money(p.grossProfit)}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="font-semibold">{t.dailyTitle}</CardTitle>
                    <CardDescription>{t.dailyDesc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div dir="ltr">
                      <BarChart
                        points={a.series.map((d) => ({ label: formatShortDate(d.date), value: d.delivered }))}
                        format={(v) => fmt(t.ordersCount, { n: formatNumber(v) })}
                        color="var(--color-success)"
                        height={200}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <EmptyState icon={<TrendingUp />} title={t.noDelivered} description={t.noDeliveredDesc} />
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}

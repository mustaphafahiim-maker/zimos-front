import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  Megaphone,
  Package,
  PhoneCall,
  Plus,
  ShoppingCart,
  Tag,
  TrendingUp,
  Users,
  Workflow,
} from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, ZIMOS_PHRASES, cn } from "@store-builder/ui";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, formatNumber, formatPercentValue, formatShortDate } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { mockApi } from "@/mock/api";
import { listInventoryItems } from "@/pages/inventory/inventoryAdapter";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { HBarList, LineAreaChart } from "@/components/charts";
import { RangeSwitch, type AnalyticsRange } from "@/components/RangeSwitch";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";

const STRINGS = {
  en: {
    welcome: "Welcome back",
    welcomeNamed: "Welcome back, {name}",
    intro: "Here's how your store is doing.",
    createFunnel: "Create funnel",
    addProduct: "Add product",
    createDiscount: "Create discount",
    connectPixel: "Connect pixel",
    revenue: "Revenue",
    orders: "Orders",
    conversion: "Conversion rate",
    aov: "Avg order value",
    revenueDesc: "Daily revenue over the selected range.",
    viewReports: "View reports",
    pipeline: "Order pipeline",
    pipelineDesc: "Where your orders are right now.",
    openBoard: "Open board",
    stageNew: "New",
    stageAwaiting: "Awaiting confirmation",
    stageConfirmed: "Confirmed",
    stageShipped: "Shipped",
    stageDelivered: "Delivered",
    stageReturned: "Returned",
    attention: "Needs attention",
    attentionDesc: "Things worth a look today.",
    awaitingLabel: "Orders awaiting confirmation",
    awaitingHint: "Call or WhatsApp customers to confirm COD orders.",
    flaggedLabel: "Orders flagged by fraud rules",
    flaggedHint: "Review before shipping to avoid fake orders.",
    abandonedLabel: "Abandoned checkouts to recover",
    abandonedHint: "Customers who left contact details but did not finish.",
    lowStockLabel: "Variants low on stock",
    lowStockHint: "Below their low-stock threshold.",
    topProducts: "Top products",
    topProductsDesc: "By revenue in this range.",
    units: "{count} units",
    bySource: "Sales by source",
    bySourceDesc: "Where orders come from.",
    ordersCount: "{count} orders",
  },
  ar: {
    welcome: "مرحبًا بعودتك",
    welcomeNamed: "مرحبًا بعودتك، {name}",
    intro: "إليك نظرة سريعة على أداء متجرك.",
    createFunnel: "إنشاء مسار بيع",
    addProduct: "إضافة منتج",
    createDiscount: "إنشاء خصم",
    connectPixel: "ربط البكسل",
    revenue: "الإيرادات",
    orders: "الطلبات",
    conversion: "معدل التحويل",
    aov: "متوسط قيمة الطلب",
    revenueDesc: "الإيرادات اليومية خلال الفترة المحددة.",
    viewReports: "عرض التقارير",
    pipeline: "مسار الطلبات",
    pipelineDesc: "أين تقف طلباتك الآن.",
    openBoard: "فتح اللوحة",
    stageNew: "جديد",
    stageAwaiting: "بانتظار التأكيد",
    stageConfirmed: "مؤكَّد",
    stageShipped: "تم الشحن",
    stageDelivered: "تم التوصيل",
    stageReturned: "مرتجع",
    attention: "يحتاج إلى متابعة",
    attentionDesc: "أمور تستحق نظرة اليوم.",
    awaitingLabel: "طلبات بانتظار التأكيد",
    awaitingHint: "تواصل مع العملاء هاتفيًا أو عبر واتساب لتأكيد طلبات الدفع عند الاستلام.",
    flaggedLabel: "طلبات علّمتها قواعد الاحتيال",
    flaggedHint: "راجعها قبل الشحن لتجنّب الطلبات الوهمية.",
    abandonedLabel: "سلات متروكة يمكن استردادها",
    abandonedHint: "عملاء تركوا بيانات التواصل ولم يُكملوا الطلب.",
    lowStockLabel: "خيارات منتجات بمخزون منخفض",
    lowStockHint: "أقل من حد التنبيه المحدد للمخزون.",
    topProducts: "المنتجات الأكثر مبيعًا",
    topProductsDesc: "حسب الإيرادات خلال هذه الفترة.",
    units: "{count} قطعة",
    bySource: "المبيعات حسب المصدر",
    bySourceDesc: "من أين تأتي طلباتك.",
    ordersCount: "{count} طلب",
  },
};

function deltaBp(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 10000);
}

export function DashboardHomePage() {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<AnalyticsRange>("30d");

  const analytics = useAsync(() => mockApi.getAnalytics(workspaceId, range), [workspaceId, range]);

  const attention = useAsync(
    () =>
      Promise.all([
        mockApi.listFlagged(workspaceId),
        mockApi.listAbandoned(workspaceId),
        // Real stock (same source as the Inventory page); a failure only hides the count.
        listInventoryItems(workspaceId).catch(() => []),
      ]).then(
        ([flagged, abandoned, inventory]) => ({
          flagged: flagged.filter((f) => f.status === "flagged").length,
          abandoned: abandoned.filter((a) => a.recoveryStatus === "not_contacted").length,
          lowStock: inventory.filter((r) => r.available <= r.lowStockThreshold).length,
        })
      ),
    [workspaceId]
  );

  const quickActions = [
    { label: t.createFunnel, to: "/funnels", icon: <Workflow /> },
    { label: t.addProduct, to: "/catalog/new", icon: <Plus /> },
    { label: t.createDiscount, to: "/discounts", icon: <Tag /> },
    { label: t.connectPixel, to: "/marketing", icon: <Megaphone /> },
  ];

  const a = analytics.data;
  const currency = a?.currency ?? "EGP";

  const pipeline = a
    ? [
        { label: t.stageNew, value: a.pipeline.newOrders, tone: "text-ink" },
        { label: t.stageAwaiting, value: a.pipeline.awaitingConfirmation, tone: "text-warning" },
        { label: t.stageConfirmed, value: a.pipeline.confirmed, tone: "text-info" },
        { label: t.stageShipped, value: a.pipeline.shipped, tone: "text-info" },
        { label: t.stageDelivered, value: a.pipeline.delivered, tone: "text-success" },
        { label: t.stageReturned, value: a.pipeline.returned, tone: "text-danger" },
      ]
    : [];

  const attentionItems = [
    {
      label: t.awaitingLabel,
      count: a?.pipeline.awaitingConfirmation ?? 0,
      to: "/confirmation-queue",
      icon: <PhoneCall />,
      hint: t.awaitingHint,
    },
    {
      label: t.flaggedLabel,
      count: attention.data?.flagged ?? 0,
      to: "/fraud",
      icon: <AlertTriangle />,
      hint: t.flaggedHint,
    },
    {
      label: t.abandonedLabel,
      count: attention.data?.abandoned ?? 0,
      to: "/abandoned-checkouts",
      icon: <ShoppingCart />,
      hint: t.abandonedHint,
    },
    {
      label: t.lowStockLabel,
      count: attention.data?.lowStock ?? 0,
      to: "/inventory",
      icon: <Boxes />,
      hint: t.lowStockHint,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-primary" dir="ltr" lang="en">
            {ZIMOS_PHRASES.loop}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {currentWorkspace ? fmt(t.welcomeNamed, { name: currentWorkspace.name }) : t.welcome}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{t.intro}</p>
        </div>
        <RangeSwitch value={range} onChange={setRange} />
      </div>

      <div className="flex flex-wrap gap-2">
        {quickActions.map((q) => (
          <Button key={q.to} variant="outline" size="sm" asChild>
            <Link to={q.to}>
              {q.icon}
              {q.label}
            </Link>
          </Button>
        ))}
      </div>

      <OnboardingChecklist />

      <DataState loading={analytics.loading && !a} error={analytics.error} onRetry={() => analytics.refresh()}>
        {a && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard
                label={t.revenue}
                value={formatMoney(a.totals.revenueAmount, currency)}
                deltaBasisPoints={deltaBp(a.totals.revenueAmount, a.previous.revenueAmount)}
                icon={<TrendingUp />}
                to="/analytics"
              />
              <KpiCard
                label={t.orders}
                value={formatNumber(a.totals.orders)}
                deltaBasisPoints={deltaBp(a.totals.orders, a.previous.orders)}
                icon={<Package />}
                to="/orders"
              />
              <KpiCard
                label={t.conversion}
                value={formatPercentValue(a.totals.conversionBasisPoints / 10000, 2)}
                deltaBasisPoints={deltaBp(a.totals.conversionBasisPoints, a.previous.conversionBasisPoints)}
                icon={<Users />}
                to="/analytics"
              />
              <KpiCard
                label={t.aov}
                value={formatMoney(a.totals.averageOrderAmount, currency)}
                deltaBasisPoints={deltaBp(
                  a.totals.averageOrderAmount,
                  a.previous.orders > 0 ? Math.round(a.previous.revenueAmount / a.previous.orders) : 0
                )}
                icon={<BarChart3 />}
              />
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{t.revenue}</CardTitle>
                    <CardDescription>{t.revenueDesc}</CardDescription>
                  </div>
                  <Link to="/analytics" className="shrink-0 text-sm font-medium text-primary hover:underline">
                    {t.viewReports}
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <LineAreaChart
                  points={a.daily.map((d) => ({ label: formatShortDate(d.date), value: d.revenueAmount }))}
                  format={(v) => formatMoney(v, currency)}
                  height={200}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{t.pipeline}</CardTitle>
                    <CardDescription>{t.pipelineDesc}</CardDescription>
                  </div>
                  <Link
                    to="/orders/pipeline"
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {t.openBoard} <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {pipeline.map((p) => (
                    <Link
                      key={p.label}
                      to="/orders/pipeline"
                      className="rounded-[10px] border border-line bg-paper px-3 py-2.5 transition-colors hover:border-primary/40"
                    >
                      <p className="truncate text-xs text-ink-soft">{p.label}</p>
                      <p className={cn("tabular mt-0.5 text-xl font-semibold", p.tone)}>{formatNumber(p.value)}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>{t.attention}</CardTitle>
                  <CardDescription>{t.attentionDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-line">
                    {attentionItems.map((item) => (
                      <li key={item.to}>
                        <Link to={item.to} className="group flex items-center gap-3 py-3">
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-[10px] [&>svg]:size-4",
                              item.count > 0 ? "bg-primary-soft text-primary" : "bg-paper text-ink-muted"
                            )}
                          >
                            {item.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-ink transition-colors group-hover:text-primary">
                              {item.label}
                            </span>
                            <span className="block text-xs text-ink-muted">{item.hint}</span>
                          </span>
                          <span className="tabular shrink-0 text-lg font-semibold text-ink">
                            {attention.loading && item.to !== "/confirmation-queue" ? "…" : formatNumber(item.count)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t.topProducts}</CardTitle>
                  <CardDescription>{t.topProductsDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <HBarList
                    rows={a.topProducts.map((p) => ({
                      label: p.name,
                      value: p.revenueAmount,
                      caption: `${fmt(t.units, { count: formatNumber(p.units) })} · ${formatMoney(p.revenueAmount, currency)}`,
                    }))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t.bySource}</CardTitle>
                  <CardDescription>{t.bySourceDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <HBarList
                    color="var(--color-accent)"
                    rows={a.bySource.map((s) => ({
                      label: s.source,
                      value: s.orders,
                      caption: fmt(t.ordersCount, { count: formatNumber(s.orders) }),
                    }))}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}

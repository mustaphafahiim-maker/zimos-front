import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Megaphone,
  Package,
  PhoneCall,
  Plus,
  Tag,
  TrendingUp,
  CheckCircle2,
  Workflow,
} from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, ZIMOS_PHRASES, cn } from "@store-builder/ui";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { formatMoney, formatNumber, formatPercentValue, formatShortDate } from "@/lib/format";
import { deltaBp, pctRatio, useAnalyticsSummary } from "@/lib/analyticsSummary";
import { fmt, useT } from "@/i18n/LocaleContext";
import { listInventoryItems } from "@/pages/inventory/inventoryAdapter";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
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
    confirmation: "Confirmation rate",
    aov: "Avg order value",
    revenueDesc: "Daily revenue over the selected range.",
    noRevenue: "No orders in this range yet.",
    viewReports: "View reports",
    pipeline: "Order pipeline",
    pipelineDesc: "Where the orders from this range stand now.",
    openBoard: "Open board",
    stageAwaiting: "Awaiting confirmation",
    stageConfirmed: "Confirmed",
    stageDelivered: "Delivered",
    stageReturned: "Returned",
    stageCancelled: "Cancelled",
    attention: "Needs attention",
    attentionDesc: "Things worth a look today.",
    awaitingLabel: "Orders awaiting confirmation",
    awaitingHint: "Call or WhatsApp customers to confirm COD orders.",
    lowStockLabel: "Variants low on stock",
    lowStockHint: "Below their low-stock threshold.",
    topProducts: "Top products",
    topProductsDesc: "By revenue in this range.",
    noProducts: "No product sales in this range yet.",
    units: "{count} units",
  },
  ar: {
    welcome: "أهلًا بيك تاني",
    welcomeNamed: "أهلًا بيك تاني، {name}",
    intro: "دي نظرة سريعة على أداء متجرك.",
    createFunnel: "إنشاء مسار بيع",
    addProduct: "إضافة منتج",
    createDiscount: "إنشاء خصم",
    connectPixel: "ربط البكسل",
    revenue: "المبيعات",
    orders: "الطلبات",
    confirmation: "نسبة التأكيد",
    aov: "متوسط قيمة الطلب",
    revenueDesc: "المبيعات كل يوم في الفترة اللي اخترتها.",
    noRevenue: "مفيش طلبات في الفترة دي لسه.",
    viewReports: "عرض التقارير",
    pipeline: "مسار الطلبات",
    pipelineDesc: "طلبات الفترة دي وصلت لفين.",
    openBoard: "فتح اللوحة",
    stageAwaiting: "مستني التأكيد",
    stageConfirmed: "متأكد",
    stageDelivered: "اتسلّم",
    stageReturned: "مرتجع",
    stageCancelled: "ملغي",
    attention: "محتاج متابعة",
    attentionDesc: "حاجات تستاهل تبص عليها النهارده.",
    awaitingLabel: "طلبات مستنية التأكيد",
    awaitingHint: "كلّم العملاء أو ابعتلهم واتساب عشان تأكد طلبات الدفع عند الاستلام.",
    lowStockLabel: "منتجات مخزونها قليل",
    lowStockHint: "أقل من حد التنبيه بتاع المخزون.",
    topProducts: "أكتر المنتجات مبيعًا",
    topProductsDesc: "حسب المبيعات في الفترة دي.",
    noProducts: "مفيش مبيعات منتجات في الفترة دي لسه.",
    units: "{count} قطعة",
  },
};

export function DashboardHomePage() {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<AnalyticsRange>("30d");

  const analytics = useAnalyticsSummary(workspaceId, range);

  // Real stock (same source as the Inventory page); a failure hides the item.
  const lowStock = useAsync(
    () =>
      listInventoryItems(workspaceId)
        .then((inventory) => inventory.filter((r) => r.available <= r.lowStockThreshold).length)
        .catch(() => null),
    [workspaceId]
  );

  const quickActions = [
    { label: t.createFunnel, to: "/funnels", icon: <Workflow /> },
    { label: t.addProduct, to: "/catalog/new", icon: <Plus /> },
    { label: t.createDiscount, to: "/discounts", icon: <Tag /> },
    { label: t.connectPixel, to: "/marketing", icon: <Megaphone /> },
  ];

  const a = analytics.data?.current ?? null;
  const prev = analytics.data?.previous ?? null;
  const currency = a?.currency ?? "EGP";

  const pipeline = a
    ? [
        { label: t.stageAwaiting, value: a.orders.pending, tone: "text-warning" },
        { label: t.stageConfirmed, value: a.orders.confirmed, tone: "text-info" },
        { label: t.stageDelivered, value: a.orders.delivered, tone: "text-success" },
        { label: t.stageReturned, value: a.orders.returned, tone: "text-danger" },
        { label: t.stageCancelled, value: a.orders.cancelled, tone: "text-ink-soft" },
      ]
    : [];

  const attentionItems: Array<{ label: string; count: string; active: boolean; to: string; icon: ReactNode; hint: string }> = [];
  if (a) {
    attentionItems.push({
      label: t.awaitingLabel,
      count: formatNumber(a.orders.pending),
      active: a.orders.pending > 0,
      to: "/confirmation-queue",
      icon: <PhoneCall />,
      hint: t.awaitingHint,
    });
  }
  if (lowStock.loading || lowStock.data !== null) {
    attentionItems.push({
      label: t.lowStockLabel,
      count: lowStock.loading ? "…" : formatNumber(lowStock.data ?? 0),
      active: (lowStock.data ?? 0) > 0,
      to: "/inventory",
      icon: <Boxes />,
      hint: t.lowStockHint,
    });
  }

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
                value={formatMoney(a.revenue.gross, currency)}
                deltaBasisPoints={deltaBp(a.revenue.gross, prev?.revenue.gross)}
                icon={<TrendingUp />}
                to="/analytics"
              />
              <KpiCard
                label={t.orders}
                value={formatNumber(a.orders.placed)}
                deltaBasisPoints={deltaBp(a.orders.placed, prev?.orders.placed)}
                icon={<Package />}
                to="/orders"
              />
              <KpiCard
                label={t.confirmation}
                value={formatPercentValue(pctRatio(a.rates.confirmation))}
                deltaBasisPoints={deltaBp(a.rates.confirmation, prev?.rates.confirmation)}
                icon={<CheckCircle2 />}
                to="/confirmation-queue"
              />
              <KpiCard
                label={t.aov}
                value={formatMoney(a.revenue.averageOrderValue, currency)}
                deltaBasisPoints={deltaBp(a.revenue.averageOrderValue, prev?.revenue.averageOrderValue)}
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
                {a.orders.placed === 0 || a.series.length === 0 ? (
                  <EmptyState title={t.noRevenue} />
                ) : (
                  <div dir="ltr">
                    <LineAreaChart
                      points={a.series.map((d) => ({ label: formatShortDate(d.date), value: d.revenue }))}
                      format={(v) => formatMoney(v, currency)}
                      height={200}
                    />
                  </div>
                )}
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
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

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
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
                              item.active ? "bg-primary-soft text-primary" : "bg-paper text-ink-muted"
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
                          <span className="tabular shrink-0 text-lg font-semibold text-ink">{item.count}</span>
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
                  {a.topProducts.length === 0 ? (
                    <EmptyState title={t.noProducts} />
                  ) : (
                    <HBarList
                      rows={a.topProducts.map((p) => ({
                        label: p.name,
                        value: p.revenue,
                        caption: `${fmt(t.units, { count: formatNumber(p.quantity) })} · ${formatMoney(p.revenue, currency)}`,
                      }))}
                      format={(v) => formatMoney(v, currency)}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}

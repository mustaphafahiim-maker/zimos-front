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
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from "@store-builder/ui";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney } from "@/lib/format";
import { mockApi } from "@/mock/api";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { HBarList, LineAreaChart } from "@/components/charts";
import { RangeSwitch, type AnalyticsRange } from "@/components/RangeSwitch";

function deltaBp(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 10000);
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const QUICK_ACTIONS = [
  { label: "Create funnel", to: "/funnels", icon: <Workflow /> },
  { label: "Add product", to: "/catalog/new", icon: <Plus /> },
  { label: "Create discount", to: "/discounts", icon: <Tag /> },
  { label: "Connect pixel", to: "/marketing", icon: <Megaphone /> },
];

export function DashboardHomePage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<AnalyticsRange>("30d");

  const analytics = useAsync(() => mockApi.getAnalytics(workspaceId, range), [workspaceId, range]);

  const attention = useAsync(
    () =>
      Promise.all([mockApi.listFlagged(workspaceId), mockApi.listAbandoned(workspaceId), mockApi.listInventory(workspaceId)]).then(
        ([flagged, abandoned, inventory]) => ({
          flagged: flagged.filter((f) => f.status === "flagged").length,
          abandoned: abandoned.filter((a) => a.recoveryStatus === "not_contacted").length,
          lowStock: inventory.filter((r) => r.available <= r.lowStockThreshold).length,
        })
      ),
    [workspaceId]
  );

  const a = analytics.data;
  const currency = a?.currency ?? "EGP";

  const pipeline = a
    ? [
        { label: "New", value: a.pipeline.newOrders, tone: "text-ink" },
        { label: "Awaiting confirmation", value: a.pipeline.awaitingConfirmation, tone: "text-accent-dark" },
        { label: "Confirmed", value: a.pipeline.confirmed, tone: "text-primary-dark" },
        { label: "Shipped", value: a.pipeline.shipped, tone: "text-primary-dark" },
        { label: "Delivered", value: a.pipeline.delivered, tone: "text-success" },
        { label: "Returned", value: a.pipeline.returned, tone: "text-danger" },
      ]
    : [];

  const attentionItems = [
    {
      label: "Orders awaiting confirmation",
      count: a?.pipeline.awaitingConfirmation ?? 0,
      to: "/confirmation-queue",
      icon: <PhoneCall />,
      hint: "Call or WhatsApp customers to confirm COD orders.",
    },
    {
      label: "Orders flagged by fraud rules",
      count: attention.data?.flagged ?? 0,
      to: "/fraud",
      icon: <AlertTriangle />,
      hint: "Review before shipping to avoid fake orders.",
    },
    {
      label: "Abandoned checkouts to recover",
      count: attention.data?.abandoned ?? 0,
      to: "/abandoned-checkouts",
      icon: <ShoppingCart />,
      hint: "Customers who left contact details but did not finish.",
    },
    {
      label: "Variants low on stock",
      count: attention.data?.lowStock ?? 0,
      to: "/inventory",
      icon: <Boxes />,
      hint: "Below their low-stock threshold.",
    },
  ];

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-ink">
            Welcome back{currentWorkspace ? `, ${currentWorkspace.name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">Here's how your store is doing.</p>
        </div>
        <RangeSwitch value={range} onChange={setRange} />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((q) => (
          <Button key={q.to} variant="outline" size="sm" asChild>
            <Link to={q.to}>
              {q.icon}
              {q.label}
            </Link>
          </Button>
        ))}
      </div>

      <DataState loading={analytics.loading && !a} error={analytics.error} onRetry={() => analytics.refresh()}>
        {a && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard
                label="Revenue"
                value={formatMoney(a.totals.revenueAmount, currency)}
                deltaBasisPoints={deltaBp(a.totals.revenueAmount, a.previous.revenueAmount)}
                icon={<TrendingUp />}
                to="/analytics"
              />
              <KpiCard
                label="Orders"
                value={a.totals.orders.toLocaleString()}
                deltaBasisPoints={deltaBp(a.totals.orders, a.previous.orders)}
                icon={<Package />}
                to="/orders"
              />
              <KpiCard
                label="Conversion rate"
                value={`${(a.totals.conversionBasisPoints / 100).toFixed(2)}%`}
                deltaBasisPoints={deltaBp(a.totals.conversionBasisPoints, a.previous.conversionBasisPoints)}
                icon={<Users />}
                to="/analytics"
              />
              <KpiCard
                label="Avg order value"
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
                    <CardTitle>Revenue</CardTitle>
                    <CardDescription>Daily revenue over the selected range.</CardDescription>
                  </div>
                  <Link to="/analytics" className="text-sm text-primary hover:underline">
                    View reports
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <LineAreaChart
                  points={a.daily.map((d) => ({ label: shortDate(d.date), value: d.revenueAmount }))}
                  format={(v) => formatMoney(v, currency)}
                  height={200}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Order pipeline</CardTitle>
                    <CardDescription>Where your orders are right now.</CardDescription>
                  </div>
                  <Link to="/orders/pipeline" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    Open board <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {pipeline.map((p) => (
                    <Link
                      key={p.label}
                      to="/orders/pipeline"
                      className="rounded-[0.5rem] border border-line bg-paper px-3 py-2.5 transition-colors hover:border-primary/40"
                    >
                      <p className="text-xs text-ink-soft">{p.label}</p>
                      <p className={cn("mt-0.5 font-display text-xl font-medium tabular-nums", p.tone)}>{p.value.toLocaleString()}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Needs attention</CardTitle>
                  <CardDescription>Things worth a look today.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-line">
                    {attentionItems.map((item) => (
                      <li key={item.to}>
                        <Link to={item.to} className="flex items-center gap-3 py-3 transition-colors hover:text-primary">
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-full [&>svg]:size-4",
                              item.count > 0 ? "bg-accent-soft text-accent-dark" : "bg-paper text-ink-soft"
                            )}
                          >
                            {item.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-ink">{item.label}</span>
                            <span className="block text-xs text-ink-soft">{item.hint}</span>
                          </span>
                          <span className="shrink-0 font-display text-lg font-medium tabular-nums text-ink">
                            {attention.loading && item.to !== "/confirmation-queue" ? "…" : item.count}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top products</CardTitle>
                  <CardDescription>By revenue in this range.</CardDescription>
                </CardHeader>
                <CardContent>
                  <HBarList
                    rows={a.topProducts.map((p) => ({
                      label: p.name,
                      value: p.revenueAmount,
                      caption: `${p.units.toLocaleString()} · ${formatMoney(p.revenueAmount, currency)}`,
                    }))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sales by source</CardTitle>
                  <CardDescription>Where orders come from.</CardDescription>
                </CardHeader>
                <CardContent>
                  <HBarList
                    color="var(--color-accent)"
                    rows={a.bySource.map((s) => ({
                      label: s.source,
                      value: s.orders,
                      caption: `${s.orders.toLocaleString()} orders`,
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

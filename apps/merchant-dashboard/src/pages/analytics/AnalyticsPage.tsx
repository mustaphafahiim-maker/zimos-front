import { useState } from "react";
import { Download } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@store-builder/ui";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney } from "@/lib/format";
import { mockApi } from "@/mock/api";
import type { AnalyticsOverview } from "@/mock/types";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { BarChart, FunnelBars, HBarList, LineAreaChart } from "@/components/charts";
import { RangeSwitch, type AnalyticsRange } from "@/components/RangeSwitch";

function deltaBp(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 10000);
}

function pct(bp: number): string {
  return `${(bp / 100).toFixed(1)}%`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(data: AnalyticsOverview) {
  const header = ["date", "visitors", "orders", "revenue_minor", `revenue_${data.currency.toLowerCase()}`];
  const rows = data.daily.map((d) => [d.date, d.visitors, d.orders, d.revenueAmount, (d.revenueAmount / 100).toFixed(2)]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics-${data.range}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function AnalyticsPage() {
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [tab, setTab] = useState<string>("products");
  const analytics = useAsync(() => mockApi.getAnalytics(workspaceId, range), [workspaceId, range]);
  const a = analytics.data;
  const currency = a?.currency ?? "EGP";

  const funnel = a
    ? [
        { label: "Visitors", value: a.totals.visitors },
        { label: "Add to cart", value: Math.round(a.totals.visitors * 0.18) },
        { label: "Checkout started", value: Math.round(a.totals.visitors * 0.09) },
        { label: "Orders", value: a.totals.orders },
        { label: "Confirmed", value: Math.round((a.totals.orders * a.totals.confirmationRateBasisPoints) / 10000) },
        { label: "Delivered", value: Math.round((a.totals.orders * a.totals.deliveryRateBasisPoints) / 10000) },
      ]
    : [];

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Analytics"
        description="Revenue, orders, conversion and delivery performance across your store and funnels."
        actions={
          <>
            <RangeSwitch value={range} onChange={setRange} />
            <Button variant="outline" size="sm" disabled={!a} onClick={() => a && downloadCsv(a)}>
              <Download />
              Export CSV
            </Button>
          </>
        }
      />

      <DataState loading={analytics.loading && !a} error={analytics.error} onRetry={() => analytics.refresh()}>
        {a && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard label="Revenue" value={formatMoney(a.totals.revenueAmount, currency)} deltaBasisPoints={deltaBp(a.totals.revenueAmount, a.previous.revenueAmount)} />
              <KpiCard label="Orders" value={a.totals.orders.toLocaleString()} deltaBasisPoints={deltaBp(a.totals.orders, a.previous.orders)} />
              <KpiCard label="Visitors" value={a.totals.visitors.toLocaleString()} deltaBasisPoints={deltaBp(a.totals.visitors, a.previous.visitors)} />
              <KpiCard label="Conversion rate" value={pct(a.totals.conversionBasisPoints)} deltaBasisPoints={deltaBp(a.totals.conversionBasisPoints, a.previous.conversionBasisPoints)} />
              <KpiCard label="Avg order value" value={formatMoney(a.totals.averageOrderAmount, currency)} hint="Revenue ÷ orders" />
              <KpiCard label="Confirmation rate" value={pct(a.totals.confirmationRateBasisPoints)} hint="Orders confirmed by phone / WhatsApp" to="/confirmation-queue" />
              <KpiCard label="Delivery rate" value={pct(a.totals.deliveryRateBasisPoints)} hint="Of shipped orders, delivered" to="/shipping" />
              <KpiCard label="Return rate" value={pct(a.totals.returnRateBasisPoints)} hint="Delivered orders returned" to="/returns" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue</CardTitle>
                  <CardDescription>Daily revenue, {currency}.</CardDescription>
                </CardHeader>
                <CardContent>
                  <LineAreaChart points={a.daily.map((d) => ({ label: shortDate(d.date), value: d.revenueAmount }))} format={(v) => formatMoney(v, currency)} height={200} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Orders</CardTitle>
                  <CardDescription>Orders placed per day.</CardDescription>
                </CardHeader>
                <CardContent>
                  <BarChart points={a.daily.map((d) => ({ label: shortDate(d.date), value: d.orders }))} format={(v) => `${v} orders`} height={200} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Conversion funnel</CardTitle>
                <CardDescription>Add-to-cart and checkout stages are estimated from pixel events; the rest come from orders.</CardDescription>
              </CardHeader>
              <CardContent>
                <FunnelBars stages={funnel} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Breakdowns</CardTitle>
                <CardDescription>Where revenue and orders come from.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
                  <TabsList>
                    <TabsTrigger value="products">Products</TabsTrigger>
                    <TabsTrigger value="sources">Sources</TabsTrigger>
                    <TabsTrigger value="governorates">Governorates</TabsTrigger>
                  </TabsList>

                  <TabsContent value="products" className="pt-4">
                    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
                      <table className="w-full min-w-[560px] text-sm">
                        <thead>
                          <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                            <th className="px-4 py-3 font-medium">Product</th>
                            <th className="px-4 py-3 text-right font-medium">Units</th>
                            <th className="px-4 py-3 text-right font-medium">Revenue</th>
                            <th className="px-4 py-3 text-right font-medium">Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.topProducts.map((p) => (
                            <tr key={p.productId} className="border-b border-line last:border-0 hover:bg-paper-raised">
                              <td className="px-4 py-3 text-ink">{p.name}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{p.units.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-ink">{formatMoney(p.revenueAmount, currency)}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-ink-soft">
                                {a.totals.revenueAmount > 0 ? `${((p.revenueAmount / a.totals.revenueAmount) * 100).toFixed(1)}%` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  <TabsContent value="sources" className="pt-4">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">Orders</p>
                        <HBarList rows={a.bySource.map((s) => ({ label: s.source, value: s.orders, caption: `${s.orders.toLocaleString()} orders` }))} />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">Revenue</p>
                        <HBarList color="var(--color-accent)" rows={a.bySource.map((s) => ({ label: s.source, value: s.revenueAmount, caption: formatMoney(s.revenueAmount, currency) }))} />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="governorates" className="pt-4">
                    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead>
                          <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                            <th className="px-4 py-3 font-medium">Governorate</th>
                            <th className="px-4 py-3 text-right font-medium">Orders</th>
                            <th className="px-4 py-3 font-medium">Delivery rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.byGovernorate.map((g) => (
                            <tr key={g.name} className="border-b border-line last:border-0 hover:bg-paper-raised">
                              <td className="px-4 py-3 text-ink">{g.name}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{g.orders.toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-1.5 w-40 overflow-hidden rounded-full bg-line/60">
                                    <div
                                      className={g.deliveryRateBasisPoints >= 7000 ? "h-full rounded-full bg-success" : "h-full rounded-full bg-accent"}
                                      style={{ width: `${g.deliveryRateBasisPoints / 100}%` }}
                                    />
                                  </div>
                                  <span className="tabular-nums text-ink-soft">{pct(g.deliveryRateBasisPoints)}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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

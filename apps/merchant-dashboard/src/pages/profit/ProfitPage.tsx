import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@store-builder/ui";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { mockApi } from "@/mock/api";
import type { ProductEconomics } from "@/mock/types2";
import { computeBreakEven, fmtX } from "@/lib/adMetrics";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { LineAreaChart } from "@/components/charts";
import { RangeSwitch, type AnalyticsRange } from "@/components/RangeSwitch";
import { useToast } from "@/components/Toast";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const thClass = "px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-ink-soft whitespace-nowrap";
const tdNum = "px-3 py-2.5 text-right tabular-nums whitespace-nowrap";

type MoneyField = "cogsAmount" | "shippingCostAmount" | "carrierFeeAmount" | "paymentFeeAmount" | "packagingAmount" | "returnCostAmount";
const MONEY_FIELDS: Array<{ key: MoneyField; label: string }> = [
  { key: "cogsAmount", label: "COGS" },
  { key: "shippingCostAmount", label: "Shipping" },
  { key: "carrierFeeAmount", label: "Carrier fee" },
  { key: "paymentFeeAmount", label: "Payment fee" },
  { key: "packagingAmount", label: "Packaging" },
  { key: "returnCostAmount", label: "Return cost" },
];

type Draft = Record<string, Record<MoneyField, string>>;

function toDraft(rows: ProductEconomics[]): Draft {
  const d: Draft = {};
  rows.forEach((r) => {
    d[r.productId] = {
      cogsAmount: minorToMajorInput(r.cogsAmount),
      shippingCostAmount: minorToMajorInput(r.shippingCostAmount),
      carrierFeeAmount: minorToMajorInput(r.carrierFeeAmount),
      paymentFeeAmount: minorToMajorInput(r.paymentFeeAmount),
      packagingAmount: minorToMajorInput(r.packagingAmount),
      returnCostAmount: minorToMajorInput(r.returnCostAmount),
    };
  });
  return d;
}

function CostAssumptions({ rows, currency, onSaved }: { rows: ProductEconomics[]; currency: string; onSaved: (rows: ProductEconomics[]) => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => toDraft(rows));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(toDraft(rows));
  }, [rows]);

  const merged = useMemo<ProductEconomics[] | null>(() => {
    const out: ProductEconomics[] = [];
    for (const r of rows) {
      const d = draft[r.productId];
      if (!d) return null;
      const next: ProductEconomics = { ...r };
      for (const f of MONEY_FIELDS) {
        const v = majorToMinor(d[f.key]);
        if (!Number.isFinite(v) || v < 0) return null;
        next[f.key] = v;
      }
      out.push(next);
    }
    return out;
  }, [rows, draft]);

  const dirty = useMemo(() => JSON.stringify(toDraft(rows)) !== JSON.stringify(draft), [rows, draft]);

  async function save() {
    if (!merged) return;
    setBusy(true);
    try {
      await mockApi.saveEconomics(workspaceId, merged);
      onSaved(merged);
      toast.success("Cost assumptions saved. Break-even CPDs are updated across the dashboard.");
    } catch {
      toast.error("Could not save cost assumptions.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-line bg-paper-raised">
              <th className={thClass}>Product</th>
              <th className={cn(thClass, "text-right")}>Price</th>
              {MONEY_FIELDS.map((f) => (
                <th key={f.key} className={cn(thClass, "text-right")}>
                  {f.label}
                </th>
              ))}
              <th className={cn(thClass, "text-right")}>Conf %</th>
              <th className={cn(thClass, "text-right")}>Deliv %</th>
              <th className={cn(thClass, "text-right")}>RTO %</th>
              <th className={cn(thClass, "text-right")}>BE CPD</th>
              <th className={cn(thClass, "text-right")}>BE ROAS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const live = merged?.find((m) => m.productId === r.productId) ?? r;
              const be = computeBreakEven(live);
              return (
                <tr key={r.productId} className="border-b border-line last:border-0">
                  <td className="max-w-[220px] truncate px-3 py-2 text-ink">{r.productName}</td>
                  <td className={cn(tdNum, "text-ink-soft")}>{formatMoney(r.sellingPriceAmount, currency)}</td>
                  {MONEY_FIELDS.map((f) => (
                    <td key={f.key} className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        aria-label={`${f.label} for ${r.productName}`}
                        value={draft[r.productId]?.[f.key] ?? ""}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [r.productId]: { ...prev[r.productId], [f.key]: e.target.value } }))}
                        className="h-8 w-24 text-right text-xs"
                      />
                    </td>
                  ))}
                  <td className={cn(tdNum, "text-ink-soft")}>{(r.confirmationRateBp / 100).toFixed(1)}%</td>
                  <td className={cn(tdNum, "text-ink-soft")}>{(r.deliveryRateBp / 100).toFixed(1)}%</td>
                  <td className={cn(tdNum, "text-ink-soft")}>{(r.returnRateBp / 100).toFixed(1)}%</td>
                  <td className={cn(tdNum, "font-medium text-ink")}>{formatMoney(Math.round(be.cpd), currency)}</td>
                  <td className={cn(tdNum, "text-ink-soft")}>{fmtX(be.roas)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-soft">Amounts in {currency}. Confirmation, delivery and RTO rates are read-only — computed from the last 90 days of orders.</p>
        <Button size="sm" disabled={!dirty || !merged || busy} onClick={() => void save()}>
          <Save />
          {busy ? "Saving…" : "Save assumptions"}
        </Button>
      </div>
    </div>
  );
}

export function ProfitPage() {
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [tab, setTab] = useState("products");
  const pnl = useAsync(() => mockApi.getPnl(workspaceId, range), [workspaceId, range]);
  const economics = useAsync(() => mockApi.listEconomics(workspaceId), [workspaceId]);
  const p = pnl.data;
  const currency = p?.currency ?? "EGP";

  const revenueLine = p?.lines.find((l) => l.sign === 1);
  const revenue = revenueLine?.amount ?? 0;
  const line = (key: string) => p?.lines.find((l) => l.key === key)?.amount ?? 0;
  const byProduct = useMemo(() => (p ? [...p.byProduct].sort((a, b) => b.netProfitAmount - a.netProfitAmount) : []), [p]);

  return (
    <div className="max-w-6xl">
      <PageHeader title="Profit & loss" description="What you actually keep after ads, goods, shipping and returns — on delivered orders only." actions={<RangeSwitch value={range} onChange={setRange} />} />

      <Alert variant="info" className="mb-6 text-sm">
        Net profit is computed on <strong>DELIVERED</strong> orders only. COD orders that were never delivered count as cost (shipping + return), not revenue.
      </Alert>

      <DataState loading={pnl.loading && !p} error={pnl.error} onRetry={() => pnl.refresh()}>
        {p && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <KpiCard
                className="col-span-2 lg:col-span-1"
                label="Net profit"
                value={<span className={p.netProfitAmount < 0 ? "text-danger" : "text-success"}>{formatMoney(p.netProfitAmount, currency)}</span>}
                hint={`${(p.netMarginBp / 100).toFixed(1)}% net margin`}
              />
              <KpiCard label="Revenue" value={formatMoney(revenue, currency)} hint="Delivered orders" />
              <KpiCard label="Ad spend" value={formatMoney(line("ads"), currency)} hint={revenue > 0 ? `${((line("ads") / revenue) * 100).toFixed(1)}% of revenue` : "—"} to="/ads" />
              <KpiCard label="COGS" value={formatMoney(line("cogs"), currency)} hint={revenue > 0 ? `${((line("cogs") / revenue) * 100).toFixed(1)}% of revenue` : "—"} />
              <KpiCard label="Returns cost" value={formatMoney(line("returns"), currency)} hint="Shipping both ways on RTO" to="/returns" />
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Waterfall</CardTitle>
                  <CardDescription>Revenue at the top, every cost as a share of it.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {p.lines.map((l) => {
                      const share = revenue > 0 ? (l.amount / revenue) * 100 : 0;
                      return (
                        <li key={l.key}>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className={l.sign === 1 ? "font-medium text-ink" : "text-ink-soft"}>{l.label}</span>
                            <span className={cn("shrink-0 tabular-nums", l.sign === 1 ? "text-ink" : "text-danger")}>
                              {l.sign === -1 && "− "}
                              {formatMoney(l.amount, currency)}
                              <span className="ml-1 text-xs text-ink-soft">({share.toFixed(1)}%)</span>
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line/60">
                            <div className={cn("h-full rounded-full", l.sign === 1 ? "bg-primary" : "bg-danger/70")} style={{ width: `${Math.min(Math.max(share, 1), 100)}%` }} />
                          </div>
                        </li>
                      );
                    })}
                    <li className="border-t border-line pt-3">
                      <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                        <span className="text-ink">Net profit</span>
                        <span className={cn("tabular-nums", p.netProfitAmount < 0 ? "text-danger" : "text-success")}>
                          {formatMoney(p.netProfitAmount, currency)}
                          <span className="ml-1 text-xs font-normal text-ink-soft">({(p.netMarginBp / 100).toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line/60">
                        <div className={cn("h-full rounded-full", p.netProfitAmount < 0 ? "bg-danger" : "bg-success")} style={{ width: `${Math.min(Math.max(Math.abs(p.netMarginBp) / 100, 1), 100)}%` }} />
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Daily</CardTitle>
                  <CardDescription>Revenue, ad spend and net profit per day.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Delivered revenue", color: "var(--color-primary)", pick: (d: (typeof p.byDay)[number]) => d.revenueAmount },
                    { label: "Ad spend", color: "var(--color-accent)", pick: (d: (typeof p.byDay)[number]) => d.adSpendAmount },
                    { label: "Net profit", color: "var(--color-success)", pick: (d: (typeof p.byDay)[number]) => Math.max(d.netProfitAmount, 0) },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">{s.label}</p>
                      <LineAreaChart points={p.byDay.map((d) => ({ label: shortDate(d.date), value: s.pick(d) }))} color={s.color} format={(v) => formatMoney(v, currency)} height={110} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Breakdown</CardTitle>
                <CardDescription>Profit per product, and the cost assumptions behind every break-even number.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
                  <TabsList>
                    <TabsTrigger value="products">By product</TabsTrigger>
                    <TabsTrigger value="assumptions">Cost assumptions</TabsTrigger>
                  </TabsList>

                  <TabsContent value="products" className="pt-4">
                    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
                      <table className="w-full min-w-[900px] text-sm">
                        <thead>
                          <tr className="border-b border-line bg-paper-raised">
                            <th className={thClass}>Product</th>
                            <th className={cn(thClass, "text-right")}>Delivered</th>
                            <th className={cn(thClass, "text-right")}>Revenue</th>
                            <th className={cn(thClass, "text-right")}>Ad spend</th>
                            <th className={cn(thClass, "text-right")}>COGS</th>
                            <th className={cn(thClass, "text-right")}>Shipping</th>
                            <th className={cn(thClass, "text-right")}>Returns</th>
                            <th className={cn(thClass, "text-right")}>Net profit</th>
                            <th className={cn(thClass, "text-right")}>Margin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {byProduct.map((r) => {
                            const neg = r.netProfitAmount < 0;
                            const margin = r.revenueAmount > 0 ? (r.netProfitAmount / r.revenueAmount) * 100 : null;
                            return (
                              <tr key={r.productId} className={cn("border-b border-line last:border-0", neg ? "bg-danger-soft/40" : "hover:bg-paper-raised")}>
                                <td className="max-w-[260px] truncate px-3 py-2.5 text-ink">{r.productName}</td>
                                <td className={cn(tdNum, "text-ink-soft")}>{r.deliveredOrders.toLocaleString()}</td>
                                <td className={cn(tdNum, "text-ink")}>{formatMoney(r.revenueAmount, currency)}</td>
                                <td className={cn(tdNum, "text-ink-soft")}>{formatMoney(r.adSpendAmount, currency)}</td>
                                <td className={cn(tdNum, "text-ink-soft")}>{formatMoney(r.cogsAmount, currency)}</td>
                                <td className={cn(tdNum, "text-ink-soft")}>{formatMoney(r.shippingAmount, currency)}</td>
                                <td className={cn(tdNum, "text-ink-soft")}>{formatMoney(r.returnsAmount, currency)}</td>
                                <td className={cn(tdNum, "font-semibold", neg ? "text-danger" : "text-success")}>{formatMoney(r.netProfitAmount, currency)}</td>
                                <td className={cn(tdNum, neg ? "text-danger" : "text-ink-soft")}>{margin === null ? "—" : `${margin.toFixed(1)}%`}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  <TabsContent value="assumptions" className="pt-4">
                    <DataState loading={economics.loading && !economics.data} error={economics.error} onRetry={() => economics.refresh()}>
                      {economics.data && <CostAssumptions rows={economics.data} currency={currency} onSaved={(rows) => economics.setData(rows)} />}
                    </DataState>
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

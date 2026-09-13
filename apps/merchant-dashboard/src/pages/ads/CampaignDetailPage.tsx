import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Award, Skull } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from "@store-builder/ui";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney } from "@/lib/format";
import { mockApi } from "@/mock/api";
import type { Campaign, ProductEconomics } from "@/mock/types2";
import { computeBreakEven, computeMetrics, fmtPct, fmtX, rankCreativesByCpd, verdictFor, withEstimatedCost } from "@/lib/adMetrics";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { FunnelBars, LineAreaChart } from "@/components/charts";
import { PlatformChip, VerdictPill, tdNum, thClass } from "./adsShared";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function money(v: number | null, currency: string): string {
  return v === null ? "—" : formatMoney(Math.round(v), currency);
}

function BreakEvenCalculator({ econ, campaignCpd, currency }: { econ: ProductEconomics; campaignCpd: number | null; currency: string }) {
  const [marginPct, setMarginPct] = useState(20);
  const base = computeBreakEven(econ);
  const target = computeBreakEven(econ, { targetMargin: marginPct / 100 });
  const rto = econ.returnRateBp / 10000;
  const expectedReturn = econ.returnCostAmount * rto;
  const stack: Array<{ label: string; amount: number; sign: 1 | -1 }> = [
    { label: "Selling price", amount: econ.sellingPriceAmount, sign: 1 },
    { label: "COGS", amount: econ.cogsAmount, sign: -1 },
    { label: "Shipping", amount: econ.shippingCostAmount, sign: -1 },
    { label: "Carrier / COD fee", amount: econ.carrierFeeAmount, sign: -1 },
    { label: "Payment fee", amount: econ.paymentFeeAmount, sign: -1 },
    { label: "Packaging", amount: econ.packagingAmount, sign: -1 },
    { label: `Expected return cost (${formatMoney(econ.returnCostAmount, currency)} × ${(rto * 100).toFixed(0)}% RTO)`, amount: expectedReturn, sign: -1 },
  ];
  const verdict = verdictFor(campaignCpd, target.cpd);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Break-even calculator</CardTitle>
        <CardDescription>
          Cost stack for <span className="text-ink">{econ.productName}</span>. Edit the assumptions on the{" "}
          <Link to="/profit" className="text-primary hover:underline">
            Profit page
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-line text-sm">
          {stack.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3 py-1.5">
              <span className={s.sign === 1 ? "text-ink" : "text-ink-soft"}>{s.label}</span>
              <span className={cn("tabular-nums", s.sign === 1 ? "text-ink" : "text-danger")}>
                {s.sign === -1 && "− "}
                {formatMoney(Math.round(s.amount), currency)}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 py-2 font-medium">
            <span className="text-ink">= Max CPD at 0% margin (break-even)</span>
            <span className="tabular-nums text-ink">{formatMoney(Math.round(base.cpd), currency)}</span>
          </li>
        </ul>

        <div className="mt-4 rounded-[0.5rem] border border-line bg-paper-raised p-4">
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="target-margin" className="font-medium text-ink">
              Target net margin
            </label>
            <span className="tabular-nums text-ink">{marginPct}%</span>
          </div>
          <input id="target-margin" type="range" min={0} max={60} step={1} value={marginPct} onChange={(e) => setMarginPct(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-primary)]" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ink-soft">Max CPD</p>
              <p className="font-display text-xl font-medium tabular-nums text-ink">{formatMoney(Math.round(target.cpd), currency)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ink-soft">Min ROAS</p>
              <p className="font-display text-xl font-medium tabular-nums text-ink">{fmtX(target.roas)}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-ink-soft">
              This campaign's CPD: <span className="tabular-nums text-ink">{money(campaignCpd, currency)}</span>
            </span>
            <VerdictPill verdict={verdict} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CampaignDetailPage() {
  const { campaignId = "" } = useParams();
  const workspaceId = useWorkspaceId();
  const currency = "EGP";

  const state = useAsync(
    () =>
      Promise.all([mockApi.listCampaigns(workspaceId), mockApi.listEconomics(workspaceId)]).then(([campaigns, economics]) => ({
        campaign: campaigns.find((c) => c.id === campaignId) ?? null,
        economics,
      })),
    [workspaceId, campaignId]
  );

  const campaign: Campaign | null = state.data?.campaign ?? null;
  const econ = useMemo(() => state.data?.economics.find((e) => e.productId === campaign?.productId) ?? null, [state.data, campaign]);
  const m = campaign ? computeMetrics(campaign) : null;
  const breakEvenCpd = econ ? computeBreakEven(econ).cpd : null;
  const verdict = m ? verdictFor(m.cpd, breakEvenCpd) : null;

  return (
    <div className="max-w-6xl">
      <DataState loading={state.loading && !state.data} error={state.error} onRetry={() => state.refresh()}>
        {!campaign || !m ? (
          <EmptyState
            title="Campaign not found"
            description="It may have been removed from the ad account."
            action={
              <Button variant="outline" asChild>
                <Link to="/ads">Back to ads</Link>
              </Button>
            }
          />
        ) : (
          <>
            <PageHeader
              title={campaign.name}
              back={{ to: "/ads", label: "Ads & media buying" }}
              titleBadge={
                <span className="inline-flex items-center gap-2">
                  <PlatformChip platform={campaign.platform} />
                  <StatusBadge value={campaign.status} tone={campaign.status === "active" ? "success" : campaign.status === "paused" ? "warning" : "neutral"} />
                  <VerdictPill verdict={verdict} />
                </span>
              }
              description={`${campaign.objective} · daily budget ${formatMoney(campaign.dailyBudgetAmount, currency)} · last 30 days`}
              actions={
                campaign.productId ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/catalog/${campaign.productId}`}>{campaign.productName}</Link>
                  </Button>
                ) : undefined
              }
            />

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                <KpiCard label="Spend" value={formatMoney(campaign.spendAmount, currency)} hint={`${campaign.impressions.toLocaleString()} impressions`} />
                <KpiCard label="CPM" value={money(m.cpm, currency)} hint="Per 1,000 impressions" />
                <KpiCard label="CTR" value={fmtPct(m.ctr, 2)} hint={`CPC ${money(m.cpc, currency)}`} />
                <KpiCard label="Landing view rate" value={fmtPct(m.landingViewRate)} hint="Landing views ÷ clicks" />
                <KpiCard label="ATC rate" value={fmtPct(m.atcRate)} hint="Add to cart ÷ landing views" />
                <KpiCard label="Checkout rate" value={fmtPct(m.checkoutRate)} hint="Checkouts ÷ add to cart" />
                <KpiCard label="CR" value={fmtPct(m.cr, 2)} hint="Orders ÷ clicks" />
                <KpiCard label="CPO" value={money(m.cpo, currency)} hint={`${campaign.orders.toLocaleString()} orders placed`} />
                <KpiCard label="CPCO" value={money(m.cpco, currency)} hint={`Confirmation ${fmtPct(m.confirmationRate)}`} />
                <KpiCard label="CPD" value={money(m.cpd, currency)} hint={`Delivery ${fmtPct(m.deliveryRate)} · RTO ${fmtPct(m.rtoRate)}`} />
                <KpiCard label="Real ROAS" value={fmtX(m.roas)} hint={breakEvenCpd && econ ? `Break-even ${fmtX(computeBreakEven(econ).roas)}` : "Delivered revenue ÷ spend"} />
                <KpiCard label="Net profit" value={<span className={m.netProfit < 0 ? "text-danger" : "text-success"}>{formatMoney(m.netProfit, currency)}</span>} hint={`Margin ${fmtPct(m.margin)}`} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Full funnel</CardTitle>
                    <CardDescription>From impression to cash in hand. Step % is relative to the previous stage.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FunnelBars
                      stages={[
                        { label: "Impressions", value: campaign.impressions },
                        { label: "Clicks", value: campaign.clicks },
                        { label: "Landing views", value: campaign.landingViews },
                        { label: "Add to cart", value: campaign.addToCarts },
                        { label: "Checkout", value: campaign.checkouts },
                        { label: "Orders", value: campaign.orders },
                        { label: "Confirmed", value: campaign.confirmedOrders },
                        { label: "Delivered", value: campaign.deliveredOrders },
                      ]}
                    />
                  </CardContent>
                </Card>
                {econ ? (
                  <BreakEvenCalculator econ={econ} campaignCpd={m.cpd} currency={currency} />
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Break-even calculator</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <EmptyState title="No product linked" description="Link this campaign to a product with cost assumptions to get a break-even CPD." />
                    </CardContent>
                  </Card>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Daily performance</CardTitle>
                  <CardDescription>Spend, orders and delivered revenue per day.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">Spend</p>
                      <LineAreaChart points={campaign.daily.map((d) => ({ label: shortDate(d.date), value: d.spendAmount }))} color="var(--color-accent)" format={(v) => formatMoney(v, currency)} height={130} />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">Orders</p>
                      <LineAreaChart points={campaign.daily.map((d) => ({ label: shortDate(d.date), value: d.orders }))} format={(v) => `${v} orders`} height={130} />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">Revenue</p>
                      <LineAreaChart points={campaign.daily.map((d) => ({ label: shortDate(d.date), value: d.revenueAmount }))} color="var(--color-success)" format={(v) => formatMoney(v, currency)} height={130} />
                    </div>
                  </div>
                  <div className="mt-4 max-h-72 overflow-auto rounded-[var(--radius-card)] border border-line">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="sticky top-0 bg-paper-raised">
                        <tr className="border-b border-line">
                          <th className={thClass}>Date</th>
                          <th className={cn(thClass, "text-right")}>Spend</th>
                          <th className={cn(thClass, "text-right")}>Orders</th>
                          <th className={cn(thClass, "text-right")}>CPO</th>
                          <th className={cn(thClass, "text-right")}>Revenue</th>
                          <th className={cn(thClass, "text-right")}>ROAS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...campaign.daily].reverse().map((d) => (
                          <tr key={d.date} className="border-b border-line last:border-0 hover:bg-paper-raised">
                            <td className="px-3 py-2 text-ink">{shortDate(d.date)}</td>
                            <td className={cn(tdNum, "text-ink")}>{formatMoney(d.spendAmount, currency)}</td>
                            <td className={cn(tdNum, "text-ink-soft")}>{d.orders}</td>
                            <td className={cn(tdNum, "text-ink-soft")}>{d.orders > 0 ? formatMoney(Math.round(d.spendAmount / d.orders), currency) : "—"}</td>
                            <td className={cn(tdNum, "text-ink-soft")}>{formatMoney(d.revenueAmount, currency)}</td>
                            <td className={cn(tdNum, "text-ink-soft")}>{d.spendAmount > 0 ? fmtX(d.revenueAmount / d.spendAmount) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ad sets & creatives</CardTitle>
                  <CardDescription>Winner = lowest CPD in the ad set, Kill = highest. Net profit uses the campaign's average cost per delivered order.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {campaign.adSets.map((set) => {
                    const sm = computeMetrics(withEstimatedCost(set, campaign));
                    const { winnerId, loserId } = rankCreativesByCpd(set.creatives);
                    return (
                      <div key={set.id}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-ink">{set.name}</p>
                            <p className="text-xs text-ink-soft">Audience: {set.audience}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-ink-soft">
                            <span>
                              Spend <span className="tabular-nums text-ink">{formatMoney(set.spendAmount, currency)}</span>
                            </span>
                            <span>
                              CPD <span className="tabular-nums text-ink">{money(sm.cpd, currency)}</span>
                            </span>
                            <span>
                              ROAS <span className="tabular-nums text-ink">{fmtX(sm.roas)}</span>
                            </span>
                            <VerdictPill verdict={verdictFor(sm.cpd, breakEvenCpd)} />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {set.creatives.map((cr) => {
                            const cm = computeMetrics(withEstimatedCost(cr, campaign));
                            const isWinner = cr.id === winnerId;
                            const isLoser = cr.id === loserId;
                            return (
                              <div key={cr.id} className={cn("rounded-[var(--radius-card)] border bg-paper-raised p-3", isWinner ? "border-success/50" : isLoser ? "border-danger/50" : "border-line")}>
                                <div className="flex items-start gap-3">
                                  <span className="size-12 shrink-0 rounded-[0.5rem]" style={{ background: cr.thumbnailColor }} />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="truncate text-sm font-medium text-ink">{cr.name}</p>
                                      {isWinner && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-success">
                                          <Award className="size-3" /> Winner
                                        </span>
                                      )}
                                      {isLoser && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-danger">
                                          <Skull className="size-3" /> Kill
                                        </span>
                                      )}
                                    </div>
                                    <span className="mt-0.5 inline-block rounded border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-soft">{cr.format}</span>
                                  </div>
                                </div>
                                <dl className="mt-3 grid grid-cols-3 gap-x-2 gap-y-1.5 text-xs">
                                  {[
                                    ["Spend", formatMoney(cr.spendAmount, currency)],
                                    ["CTR", fmtPct(cm.ctr, 2)],
                                    ["CPC", money(cm.cpc, currency)],
                                    ["Orders", String(cr.orders)],
                                    ["CPCO", money(cm.cpco, currency)],
                                    ["CPD", money(cm.cpd, currency)],
                                    ["ROAS", fmtX(cm.roas)],
                                    ["Deliv %", fmtPct(cm.deliveryRate)],
                                    ["Net", formatMoney(cm.netProfit, currency)],
                                  ].map(([k, v]) => (
                                    <div key={k}>
                                      <dt className="text-ink-soft">{k}</dt>
                                      <dd className={cn("tabular-nums text-ink", k === "Net" && (cm.netProfit < 0 ? "text-danger" : "text-success"))}>{v}</dd>
                                    </div>
                                  ))}
                                </dl>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}

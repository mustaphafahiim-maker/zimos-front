import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Award, Skull } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from "@store-builder/ui";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { formatMoney } from "@/lib/format";
import { mockApi } from "@/mock/api";
import type { Campaign, ProductEconomics } from "@/mock/types2";
import { computeBreakEven, computeMetrics, fmtPct, fmtX, rankCreativesByCpd, verdictFor, verdictLabel, withEstimatedCost } from "@/lib/adMetrics";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { FunnelBars, LineAreaChart } from "@/components/charts";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { Num, PlatformChip, VerdictPill, fmtNodes, tdNum, thClass, useAdsLabels } from "./adsShared";
import { CAMPAIGN_PAGE } from "./ads.strings";

function shortDate(iso: string, intlLocale: string): string {
  return new Date(iso).toLocaleDateString(intlLocale, { month: "short", day: "numeric" });
}

function money(v: number | null, currency: string): string {
  return v === null ? "—" : formatMoney(Math.round(v), currency);
}

function BreakEvenCalculator({ econ, campaignCpd, currency }: { econ: ProductEconomics; campaignCpd: number | null; currency: string }) {
  const t = useT(CAMPAIGN_PAGE);
  const { t: a } = useAdsLabels();
  const [marginPct, setMarginPct] = useState(20);
  const base = computeBreakEven(econ);
  const target = computeBreakEven(econ, { targetMargin: marginPct / 100 });
  const rto = econ.returnRateBp / 10000;
  const expectedReturn = econ.returnCostAmount * rto;
  const stack: Array<{ id: string; label: string; amount: number; sign: 1 | -1 }> = [
    { id: "price", label: t.sellingPrice, amount: econ.sellingPriceAmount, sign: 1 },
    { id: "cogs", label: t.cogs, amount: econ.cogsAmount, sign: -1 },
    { id: "shipping", label: t.shipping, amount: econ.shippingCostAmount, sign: -1 },
    { id: "carrier", label: t.carrierFee, amount: econ.carrierFeeAmount, sign: -1 },
    { id: "payment", label: t.paymentFee, amount: econ.paymentFeeAmount, sign: -1 },
    { id: "packaging", label: t.packaging, amount: econ.packagingAmount, sign: -1 },
    {
      id: "return",
      label: fmt(t.expectedReturn, { cost: `⁦${formatMoney(econ.returnCostAmount, currency)}⁩`, pct: `⁦${(rto * 100).toFixed(0)}%⁩` }),
      amount: expectedReturn,
      sign: -1,
    },
  ];
  const verdict = verdictFor(campaignCpd, target.cpd);
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="font-semibold">{t.beTitle}</CardTitle>
        <CardDescription>
          {fmtNodes(t.beDesc, {
            product: <span className="text-ink">{econ.productName}</span>,
            profitLink: (
              <Link to="/profit" className="text-primary hover:underline">
                {a.profitPage}
              </Link>
            ),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-line text-sm">
          {stack.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className={s.sign === 1 ? "text-ink" : "text-ink-soft"}>{s.label}</span>
              <Num className={cn("whitespace-nowrap", s.sign === 1 ? "text-ink" : "text-danger")}>
                {s.sign === -1 && "− "}
                {formatMoney(Math.round(s.amount), currency)}
              </Num>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 py-2 font-medium">
            <span className="text-ink">{t.maxCpdBe}</span>
            <Num className="whitespace-nowrap text-ink">{formatMoney(Math.round(base.cpd), currency)}</Num>
          </li>
        </ul>

        <div className="mt-4 rounded-2xl border border-line bg-paper-raised p-4">
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="target-margin" className="font-medium text-ink">
              {t.targetMargin}
            </label>
            <Num className="text-ink">{marginPct}%</Num>
          </div>
          <input id="target-margin" type="range" min={0} max={60} step={1} value={marginPct} onChange={(e) => setMarginPct(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-primary)]" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ink-soft" title={a.tipCpd}>
                {t.maxCpd}
              </p>
              <p className="font-display text-xl font-medium text-ink">
                <Num>{formatMoney(Math.round(target.cpd), currency)}</Num>
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ink-soft" title={a.tipRoas}>
                {t.minRoas}
              </p>
              <p className="font-display text-xl font-medium text-ink">
                <Num>{fmtX(target.roas)}</Num>
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-ink-soft">
              {t.thisCpd} <Num className="text-ink">{money(campaignCpd, currency)}</Num>
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
  const t = useT(CAMPAIGN_PAGE);
  const { t: a, campaignStatus, creativeFormat, objective } = useAdsLabels();
  const { locale, intlLocale } = useLocale();

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
  const num = (n: number) => n.toLocaleString(intlLocale);
  /** Wrap a Latin value in LTR isolates so it reads correctly inside Arabic sentences. */
  const iso = (s: string) => `⁦${s}⁩`;

  return (
    <div className="max-w-6xl">
      <DataState loading={state.loading && !state.data} error={state.error} onRetry={() => state.refresh()}>
        {!campaign || !m ? (
          <EmptyState
            title={t.notFoundTitle}
            description={t.notFoundDesc}
            action={
              <Button variant="outline" asChild>
                <Link to="/ads">{t.backToAds}</Link>
              </Button>
            }
          />
        ) : (
          <>
            <PageHeader
              title={campaign.name}
              back={{ to: "/ads", label: t.adsTitle }}
              titleBadge={
                <span className="inline-flex flex-wrap items-center gap-2">
                  <PlatformChip platform={campaign.platform} />
                  <StatusBadge value={campaignStatus[campaign.status]} tone={campaign.status === "active" ? "success" : campaign.status === "paused" ? "warning" : "neutral"} />
                  <VerdictPill verdict={verdict} />
                </span>
              }
              description={fmt(t.descriptionLine, { objective: objective[campaign.objective], budget: iso(formatMoney(campaign.dailyBudgetAmount, currency)) })}
              actions={
                campaign.productId ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/catalog/${campaign.productId}`}>{campaign.productName}</Link>
                  </Button>
                ) : undefined
              }
            />

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard label={a.spend} value={<Num>{formatMoney(campaign.spendAmount, currency)}</Num>} hint={fmt(t.spendHint, { n: num(campaign.impressions) })} />
                <KpiCard label={t.cpm} value={<Num>{money(m.cpm, currency)}</Num>} hint={t.cpmHint} />
                <KpiCard label={t.ctr} value={<Num>{fmtPct(m.ctr, 2)}</Num>} hint={fmt(t.ctrHint, { v: iso(money(m.cpc, currency)) })} />
                <KpiCard label={t.landingRate} value={<Num>{fmtPct(m.landingViewRate)}</Num>} hint={t.landingRateHint} />
                <KpiCard label={t.atcRate} value={<Num>{fmtPct(m.atcRate)}</Num>} hint={t.atcRateHint} />
                <KpiCard label={t.checkoutRate} value={<Num>{fmtPct(m.checkoutRate)}</Num>} hint={t.checkoutRateHint} />
                <KpiCard label={t.cr} value={<Num>{fmtPct(m.cr, 2)}</Num>} hint={t.crHint} />
                <KpiCard label={t.cpo} value={<Num>{money(m.cpo, currency)}</Num>} hint={fmt(t.cpoHint, { n: num(campaign.orders) })} />
                <KpiCard label={t.cpco} value={<Num>{money(m.cpco, currency)}</Num>} hint={fmt(t.cpcoHint, { v: iso(fmtPct(m.confirmationRate)) })} />
                <KpiCard label={t.cpd} value={<Num>{money(m.cpd, currency)}</Num>} hint={fmt(t.cpdHint, { d: iso(fmtPct(m.deliveryRate)), r: iso(fmtPct(m.rtoRate)) })} />
                <KpiCard label={t.roas} value={<Num>{fmtX(m.roas)}</Num>} hint={breakEvenCpd && econ ? fmt(t.roasHintBe, { v: iso(fmtX(computeBreakEven(econ).roas)) }) : t.roasHint} />
                <KpiCard
                  label={a.netProfit}
                  value={<Num className={m.netProfit < 0 ? "text-danger" : "text-success"}>{formatMoney(m.netProfit, currency)}</Num>}
                  hint={fmt(t.netHint, { v: iso(fmtPct(m.margin)) })}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="font-semibold">{t.funnelTitle}</CardTitle>
                    <CardDescription>{t.funnelDesc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div dir="ltr">
                      <FunnelBars
                        stages={[
                          { label: t.stImpressions, value: campaign.impressions },
                          { label: t.stClicks, value: campaign.clicks },
                          { label: t.stLanding, value: campaign.landingViews },
                          { label: t.stAtc, value: campaign.addToCarts },
                          { label: t.stCheckout, value: campaign.checkouts },
                          { label: t.stOrders, value: campaign.orders },
                          { label: t.stConfirmed, value: campaign.confirmedOrders },
                          { label: t.stDelivered, value: campaign.deliveredOrders },
                        ]}
                      />
                    </div>
                  </CardContent>
                </Card>
                {econ ? (
                  <BreakEvenCalculator econ={econ} campaignCpd={m.cpd} currency={currency} />
                ) : (
                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle className="font-semibold">{t.beTitle}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <EmptyState title={t.noProductTitle} description={t.noProductDesc} />
                    </CardContent>
                  </Card>
                )}
              </div>

              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="font-semibold">{t.dailyTitle}</CardTitle>
                  <CardDescription>{t.dailyDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">{a.spend}</p>
                      <div dir="ltr">
                        <LineAreaChart points={campaign.daily.map((d) => ({ label: shortDate(d.date, intlLocale), value: d.spendAmount }))} color="var(--color-accent)" format={(v) => formatMoney(v, currency)} height={130} />
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">{a.orders}</p>
                      <div dir="ltr">
                        <LineAreaChart points={campaign.daily.map((d) => ({ label: shortDate(d.date, intlLocale), value: d.orders }))} format={(v) => fmt(t.ordersFmt, { n: v })} height={130} />
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">{t.revenue}</p>
                      <div dir="ltr">
                        <LineAreaChart points={campaign.daily.map((d) => ({ label: shortDate(d.date, intlLocale), value: d.revenueAmount }))} color="var(--color-success)" format={(v) => formatMoney(v, currency)} height={130} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 max-h-72 overflow-auto rounded-2xl border border-line bg-paper-raised">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="sticky top-0 bg-paper">
                        <tr className="border-b border-line">
                          <th className={thClass}>{t.colDate}</th>
                          <th className={cn(thClass, "text-end")}>{a.spend}</th>
                          <th className={cn(thClass, "text-end")}>{a.orders}</th>
                          <th className={cn(thClass, "text-end")} title={a.tipCpo}>
                            {a.cpo}
                          </th>
                          <th className={cn(thClass, "text-end")}>{t.revenue}</th>
                          <th className={cn(thClass, "text-end")} title={a.tipRoas}>
                            {a.roas}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...campaign.daily].reverse().map((d) => (
                          <tr key={d.date} className="border-b border-line last:border-0 hover:bg-paper">
                            <td className="whitespace-nowrap px-3 py-2 text-ink">{shortDate(d.date, intlLocale)}</td>
                            <td className={cn(tdNum, "text-ink")}>
                              <Num>{formatMoney(d.spendAmount, currency)}</Num>
                            </td>
                            <td className={cn(tdNum, "text-ink-soft")}>
                              <Num>{num(d.orders)}</Num>
                            </td>
                            <td className={cn(tdNum, "text-ink-soft")}>
                              <Num>{d.orders > 0 ? formatMoney(Math.round(d.spendAmount / d.orders), currency) : "—"}</Num>
                            </td>
                            <td className={cn(tdNum, "text-ink-soft")}>
                              <Num>{formatMoney(d.revenueAmount, currency)}</Num>
                            </td>
                            <td className={cn(tdNum, "text-ink-soft")}>
                              <Num>{d.spendAmount > 0 ? fmtX(d.revenueAmount / d.spendAmount) : "—"}</Num>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="font-semibold">{t.adSetsTitle}</CardTitle>
                  <CardDescription>{t.adSetsDesc}</CardDescription>
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
                            <p className="text-xs text-ink-soft">{fmt(t.audience, { v: set.audience })}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-ink-soft">
                            <span>
                              {a.spend} <Num className="text-ink">{formatMoney(set.spendAmount, currency)}</Num>
                            </span>
                            <span title={a.tipCpd}>
                              {a.cpd} <Num className="text-ink">{money(sm.cpd, currency)}</Num>
                            </span>
                            <span title={a.tipRoas}>
                              {a.roas} <Num className="text-ink">{fmtX(sm.roas)}</Num>
                            </span>
                            <VerdictPill verdict={verdictFor(sm.cpd, breakEvenCpd)} />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {set.creatives.map((cr) => {
                            const cm = computeMetrics(withEstimatedCost(cr, campaign));
                            const isWinner = cr.id === winnerId;
                            const isLoser = cr.id === loserId;
                            const cells: Array<{ id: string; label: string; title?: string; value: string }> = [
                              { id: "spend", label: a.spend, value: formatMoney(cr.spendAmount, currency) },
                              { id: "ctr", label: a.ctr, title: a.tipCtr, value: fmtPct(cm.ctr, 2) },
                              { id: "cpc", label: a.cpc, title: a.tipCpc, value: money(cm.cpc, currency) },
                              { id: "orders", label: a.orders, value: num(cr.orders) },
                              { id: "cpco", label: a.cpco, title: a.tipCpco, value: money(cm.cpco, currency) },
                              { id: "cpd", label: a.cpd, title: a.tipCpd, value: money(cm.cpd, currency) },
                              { id: "roas", label: a.roas, title: a.tipRoas, value: fmtX(cm.roas) },
                              { id: "deliv", label: a.delivPct, title: a.tipDeliv, value: fmtPct(cm.deliveryRate) },
                              { id: "net", label: a.net, value: formatMoney(cm.netProfit, currency) },
                            ];
                            return (
                              <div key={cr.id} className={cn("rounded-2xl border bg-paper-raised p-3", isWinner ? "border-success/50" : isLoser ? "border-danger/50" : "border-line")}>
                                <div className="flex items-start gap-3">
                                  <span className="size-12 shrink-0 rounded-xl" style={{ background: cr.thumbnailColor }} />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="truncate text-sm font-medium text-ink">{cr.name}</p>
                                      {isWinner && (
                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-success">
                                          <Award className="size-3" /> {t.winner}
                                        </span>
                                      )}
                                      {isLoser && (
                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-danger">
                                          <Skull className="size-3" /> {verdictLabel("kill", locale)}
                                        </span>
                                      )}
                                    </div>
                                    <span className="mt-0.5 inline-block rounded border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-soft">{creativeFormat[cr.format]}</span>
                                  </div>
                                </div>
                                <dl className="mt-3 grid grid-cols-3 gap-x-2 gap-y-1.5 text-xs">
                                  {cells.map((cell) => (
                                    <div key={cell.id}>
                                      <dt className="text-ink-soft" title={cell.title}>
                                        {cell.label}
                                      </dt>
                                      <dd className={cn("text-ink", cell.id === "net" && (cm.netProfit < 0 ? "text-danger" : "text-success"))}>
                                        <Num>{cell.value}</Num>
                                      </dd>
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

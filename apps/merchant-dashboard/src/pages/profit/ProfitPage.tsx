import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@store-builder/ui";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { mockApi } from "@/mock/api";
import type { ProductEconomics } from "@/mock/types2";
import { computeBreakEven, fmtX } from "@/lib/adMetrics";
import { useCommon, useLocale, useT, fmt, type Locale, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { LineAreaChart } from "@/components/charts";
import { RangeSwitch, type AnalyticsRange } from "@/components/RangeSwitch";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Profit & loss",
    description: "What you actually keep after ads, goods, shipping and returns — on delivered orders only.",
    alertA: "Net profit is computed on",
    alertDelivered: "DELIVERED",
    alertB: "orders only. COD orders that were never delivered count as cost (shipping + return), not revenue.",
    netProfit: "Net profit",
    netMargin: "{pct}% net margin",
    revenue: "Revenue",
    deliveredOrders: "Delivered orders",
    adSpend: "Ad spend",
    ofRevenue: "{pct}% of revenue",
    cogs: "COGS",
    returnsCost: "Returns cost",
    returnsHint: "Shipping both ways on RTO",
    waterfall: "Waterfall",
    waterfallDesc: "Revenue at the top, every cost as a share of it.",
    daily: "Daily",
    dailyDesc: "Revenue, ad spend and net profit per day.",
    deliveredRevenue: "Delivered revenue",
    breakdown: "Breakdown",
    breakdownDesc: "Profit per product, and the cost assumptions behind every break-even number.",
    byProduct: "By product",
    costAssumptions: "Cost assumptions",
    colProduct: "Product",
    colDelivered: "Delivered",
    colShipping: "Shipping",
    colReturns: "Returns",
    colMargin: "Margin",
    colPrice: "Price",
    colCarrierFee: "Carrier fee",
    colPaymentFee: "Payment fee",
    colPackaging: "Packaging",
    colReturnCost: "Return cost",
    colConf: "Conf %",
    colDeliv: "Deliv %",
    colRto: "RTO %",
    colBeCpd: "BE CPD",
    colBeRoas: "BE ROAS",
    fieldAria: "{field} for {product}",
    savedToast: "Cost assumptions saved. Break-even CPDs are updated across the dashboard.",
    saveError: "Could not save cost assumptions.",
    assumptionsNote: "Amounts in {currency}. Confirmation, delivery and RTO rates are read-only — computed from the last 90 days of orders.",
    saveAssumptions: "Save assumptions",
  },
  ar: {
    title: "الأرباح والخسائر",
    description: "ما تحتفظ به فعلًا بعد الإعلانات والبضاعة والشحن والمرتجعات — على الطلبات المسلَّمة فقط.",
    alertA: "يُحسب صافي الربح على الطلبات",
    alertDelivered: "المسلَّمة",
    alertB: "فقط. طلبات الدفع عند الاستلام التي لم تُسلَّم تُحسب كتكلفة (شحن + مرتجع) وليست إيرادًا.",
    netProfit: "صافي الربح",
    netMargin: "هامش صافي {pct}%",
    revenue: "الإيرادات",
    deliveredOrders: "الطلبات المسلَّمة",
    adSpend: "الإنفاق الإعلاني",
    ofRevenue: "{pct}% من الإيرادات",
    cogs: "تكلفة البضاعة",
    returnsCost: "تكلفة المرتجعات",
    returnsHint: "الشحن ذهابًا وإيابًا للمرتجعات",
    waterfall: "تفصيل الأرباح",
    waterfallDesc: "الإيرادات في الأعلى، وكل تكلفة كنسبة منها.",
    daily: "يوميًا",
    dailyDesc: "الإيرادات والإنفاق الإعلاني وصافي الربح لكل يوم.",
    deliveredRevenue: "إيرادات الطلبات المسلَّمة",
    breakdown: "التفاصيل",
    breakdownDesc: "الربح لكل منتج، وافتراضات التكلفة وراء كل رقم لنقطة التعادل.",
    byProduct: "حسب المنتج",
    costAssumptions: "افتراضات التكلفة",
    colProduct: "المنتج",
    colDelivered: "المسلَّمة",
    colShipping: "الشحن",
    colReturns: "المرتجعات",
    colMargin: "الهامش",
    colPrice: "السعر",
    colCarrierFee: "رسوم شركة الشحن",
    colPaymentFee: "رسوم الدفع",
    colPackaging: "التغليف",
    colReturnCost: "تكلفة المرتجع",
    colConf: "نسبة التأكيد",
    colDeliv: "نسبة التسليم",
    colRto: "نسبة المرتجع",
    colBeCpd: "تكلفة الطلب المسلَّم للتعادل",
    colBeRoas: "ROAS للتعادل",
    fieldAria: "{field} لـ {product}",
    savedToast: "تم حفظ افتراضات التكلفة. تم تحديث تكلفة الطلب المسلَّم للتعادل في كل لوحة التحكم.",
    saveError: "تعذّر حفظ افتراضات التكلفة.",
    assumptionsNote: "المبالغ بعملة {currency}. نسب التأكيد والتسليم والمرتجع للقراءة فقط — محسوبة من طلبات آخر 90 يومًا.",
    saveAssumptions: "حفظ الافتراضات",
  },
} satisfies Messages;

/** P&L line labels keyed by line key; unknown keys fall back to the API label. */
const PNL_LINE_LABEL: Record<Locale, Record<string, string>> = {
  en: {
    revenue: "Delivered revenue",
    cogs: "Cost of goods",
    ads: "Ad spend",
    shipping: "Shipping paid to carriers",
    carrier_fees: "COD collection fees",
    returns: "Returns & RTO cost",
    packaging: "Packaging",
    platform: "Platform & payment fees",
    team: "Confirmation team",
  },
  ar: {
    revenue: "إيرادات الطلبات المسلَّمة",
    cogs: "تكلفة البضاعة",
    ads: "الإنفاق الإعلاني",
    shipping: "رسوم الشحن المدفوعة لشركات الشحن",
    carrier_fees: "رسوم تحصيل الدفع عند الاستلام",
    returns: "تكلفة المرتجعات",
    packaging: "التغليف",
    platform: "رسوم المنصة والدفع",
    team: "فريق التأكيد",
  },
};

function shortDate(iso: string, intlLocale: string): string {
  return new Date(iso).toLocaleDateString(intlLocale, { month: "short", day: "numeric" });
}

const thClass = "px-3 py-2.5 text-start text-[11px] font-medium uppercase tracking-wide text-ink-soft whitespace-nowrap";
const tdNum = "px-3 py-2.5 text-end tabular-nums whitespace-nowrap";

type MoneyField = "cogsAmount" | "shippingCostAmount" | "carrierFeeAmount" | "paymentFeeAmount" | "packagingAmount" | "returnCostAmount";
type StringKey = keyof (typeof STRINGS)["en"];
const MONEY_FIELDS: Array<{ key: MoneyField; labelKey: StringKey }> = [
  { key: "cogsAmount", labelKey: "cogs" },
  { key: "shippingCostAmount", labelKey: "colShipping" },
  { key: "carrierFeeAmount", labelKey: "colCarrierFee" },
  { key: "paymentFeeAmount", labelKey: "colPaymentFee" },
  { key: "packagingAmount", labelKey: "colPackaging" },
  { key: "returnCostAmount", labelKey: "colReturnCost" },
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
  const t = useT(STRINGS);
  const c = useCommon();
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
      toast.success(t.savedToast);
    } catch {
      toast.error(t.saveError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-line bg-paper-raised">
              <th className={thClass}>{t.colProduct}</th>
              <th className={cn(thClass, "text-end")}>{t.colPrice}</th>
              {MONEY_FIELDS.map((f) => (
                <th key={f.key} className={cn(thClass, "text-end")}>
                  {t[f.labelKey]}
                </th>
              ))}
              <th className={cn(thClass, "text-end")}>{t.colConf}</th>
              <th className={cn(thClass, "text-end")}>{t.colDeliv}</th>
              <th className={cn(thClass, "text-end")}>{t.colRto}</th>
              <th className={cn(thClass, "text-end")}>{t.colBeCpd}</th>
              <th className={cn(thClass, "text-end")}>{t.colBeRoas}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const live = merged?.find((m) => m.productId === r.productId) ?? r;
              const be = computeBreakEven(live);
              return (
                <tr key={r.productId} className="border-b border-line bg-paper last:border-0">
                  <td className="max-w-[220px] truncate px-3 py-2 text-start text-ink" dir="auto">
                    {r.productName}
                  </td>
                  <td className={cn(tdNum, "text-ink-soft")}>
                    <bdi>{formatMoney(r.sellingPriceAmount, currency)}</bdi>
                  </td>
                  {MONEY_FIELDS.map((f) => (
                    <td key={f.key} className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        dir="ltr"
                        aria-label={fmt(t.fieldAria, { field: t[f.labelKey], product: r.productName })}
                        value={draft[r.productId]?.[f.key] ?? ""}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [r.productId]: { ...prev[r.productId], [f.key]: e.target.value } }))}
                        className="h-8 w-24 text-end text-xs tabular-nums"
                      />
                    </td>
                  ))}
                  <td className={cn(tdNum, "text-ink-soft")}>
                    <span dir="ltr">{(r.confirmationRateBp / 100).toFixed(1)}%</span>
                  </td>
                  <td className={cn(tdNum, "text-ink-soft")}>
                    <span dir="ltr">{(r.deliveryRateBp / 100).toFixed(1)}%</span>
                  </td>
                  <td className={cn(tdNum, "text-ink-soft")}>
                    <span dir="ltr">{(r.returnRateBp / 100).toFixed(1)}%</span>
                  </td>
                  <td className={cn(tdNum, "font-medium text-ink")}>
                    <bdi>{formatMoney(Math.round(be.cpd), currency)}</bdi>
                  </td>
                  <td className={cn(tdNum, "text-ink-soft")}>
                    <span dir="ltr">{fmtX(be.roas)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-ink-soft">{fmt(t.assumptionsNote, { currency })}</p>
        <Button size="sm" disabled={!dirty || !merged || busy} onClick={() => void save()}>
          <Save />
          {busy ? c.saving : t.saveAssumptions}
        </Button>
      </div>
    </div>
  );
}

export function ProfitPage() {
  const t = useT(STRINGS);
  const { locale, intlLocale } = useLocale();
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
  const pctOfRevenue = (amount: number) => (revenue > 0 ? fmt(t.ofRevenue, { pct: ((amount / revenue) * 100).toFixed(1) }) : "—");

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader title={t.title} description={t.description} actions={<RangeSwitch value={range} onChange={setRange} />} />

      <Alert variant="info" className="mb-6 text-sm">
        {t.alertA} <strong>{t.alertDelivered}</strong> {t.alertB}
      </Alert>

      <DataState loading={pnl.loading && !p} error={pnl.error} onRetry={() => pnl.refresh()}>
        {p && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <KpiCard
                className="col-span-2 lg:col-span-1"
                label={t.netProfit}
                value={
                  <bdi className={p.netProfitAmount < 0 ? "text-danger" : "text-success"}>{formatMoney(p.netProfitAmount, currency)}</bdi>
                }
                hint={fmt(t.netMargin, { pct: (p.netMarginBp / 100).toFixed(1) })}
              />
              <KpiCard label={t.revenue} value={<bdi>{formatMoney(revenue, currency)}</bdi>} hint={t.deliveredOrders} />
              <KpiCard label={t.adSpend} value={<bdi>{formatMoney(line("ads"), currency)}</bdi>} hint={pctOfRevenue(line("ads"))} to="/ads" />
              <KpiCard label={t.cogs} value={<bdi>{formatMoney(line("cogs"), currency)}</bdi>} hint={pctOfRevenue(line("cogs"))} />
              <KpiCard label={t.returnsCost} value={<bdi>{formatMoney(line("returns"), currency)}</bdi>} hint={t.returnsHint} to="/returns" />
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              <Card className="min-w-0 rounded-2xl lg:col-span-2">
                <CardHeader>
                  <CardTitle>{t.waterfall}</CardTitle>
                  <CardDescription>{t.waterfallDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {p.lines.map((l) => {
                      const share = revenue > 0 ? (l.amount / revenue) * 100 : 0;
                      return (
                        <li key={l.key}>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className={cn("min-w-0", l.sign === 1 ? "font-medium text-ink" : "text-ink-soft")}>{PNL_LINE_LABEL[locale][l.key] ?? l.label}</span>
                            <span className={cn("shrink-0 tabular-nums", l.sign === 1 ? "text-ink" : "text-danger")}>
                              <bdi>
                                {l.sign === -1 && "− "}
                                {formatMoney(l.amount, currency)}
                              </bdi>
                              <span className="ms-1 text-xs text-ink-soft" dir="ltr">
                                ({share.toFixed(1)}%)
                              </span>
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
                        <span className="text-ink">{t.netProfit}</span>
                        <span className={cn("tabular-nums", p.netProfitAmount < 0 ? "text-danger" : "text-success")}>
                          <bdi>{formatMoney(p.netProfitAmount, currency)}</bdi>
                          <span className="ms-1 text-xs font-normal text-ink-soft" dir="ltr">
                            ({(p.netMarginBp / 100).toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line/60">
                        <div className={cn("h-full rounded-full", p.netProfitAmount < 0 ? "bg-danger" : "bg-success")} style={{ width: `${Math.min(Math.max(Math.abs(p.netMarginBp) / 100, 1), 100)}%` }} />
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="min-w-0 rounded-2xl lg:col-span-3">
                <CardHeader>
                  <CardTitle>{t.daily}</CardTitle>
                  <CardDescription>{t.dailyDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { id: "revenue", label: t.deliveredRevenue, color: "var(--color-primary)", pick: (d: (typeof p.byDay)[number]) => d.revenueAmount },
                    { id: "ads", label: t.adSpend, color: "var(--color-accent)", pick: (d: (typeof p.byDay)[number]) => d.adSpendAmount },
                    { id: "net", label: t.netProfit, color: "var(--color-success)", pick: (d: (typeof p.byDay)[number]) => Math.max(d.netProfitAmount, 0) },
                  ].map((s) => (
                    <div key={s.id}>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">{s.label}</p>
                      <div dir="ltr">
                        <LineAreaChart points={p.byDay.map((d) => ({ label: shortDate(d.date, intlLocale), value: s.pick(d) }))} color={s.color} format={(v) => formatMoney(v, currency)} height={110} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="min-w-0 rounded-2xl">
              <CardHeader>
                <CardTitle>{t.breakdown}</CardTitle>
                <CardDescription>{t.breakdownDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
                  <TabsList>
                    <TabsTrigger value="products">{t.byProduct}</TabsTrigger>
                    <TabsTrigger value="assumptions">{t.costAssumptions}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="products" className="pt-4">
                    <div className="max-h-[70vh] overflow-auto rounded-2xl border border-line bg-paper-raised">
                      <table className="w-full min-w-[900px] text-sm">
                        <thead className="sticky top-0 z-10 bg-paper-raised">
                          <tr className="border-b border-line">
                            <th className={thClass}>{t.colProduct}</th>
                            <th className={cn(thClass, "text-end")}>{t.colDelivered}</th>
                            <th className={cn(thClass, "text-end")}>{t.revenue}</th>
                            <th className={cn(thClass, "text-end")}>{t.adSpend}</th>
                            <th className={cn(thClass, "text-end")}>{t.cogs}</th>
                            <th className={cn(thClass, "text-end")}>{t.colShipping}</th>
                            <th className={cn(thClass, "text-end")}>{t.colReturns}</th>
                            <th className={cn(thClass, "text-end")}>{t.netProfit}</th>
                            <th className={cn(thClass, "text-end")}>{t.colMargin}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {byProduct.map((r) => {
                            const neg = r.netProfitAmount < 0;
                            const margin = r.revenueAmount > 0 ? (r.netProfitAmount / r.revenueAmount) * 100 : null;
                            return (
                              <tr key={r.productId} className={cn("border-b border-line last:border-0", neg ? "bg-danger-soft/40" : "bg-paper hover:bg-paper-raised")}>
                                <td className="max-w-[260px] truncate px-3 py-2.5 text-start text-ink" dir="auto">
                                  {r.productName}
                                </td>
                                <td className={cn(tdNum, "text-ink-soft")}>{r.deliveredOrders.toLocaleString()}</td>
                                <td className={cn(tdNum, "text-ink")}>
                                  <bdi>{formatMoney(r.revenueAmount, currency)}</bdi>
                                </td>
                                <td className={cn(tdNum, "text-ink-soft")}>
                                  <bdi>{formatMoney(r.adSpendAmount, currency)}</bdi>
                                </td>
                                <td className={cn(tdNum, "text-ink-soft")}>
                                  <bdi>{formatMoney(r.cogsAmount, currency)}</bdi>
                                </td>
                                <td className={cn(tdNum, "text-ink-soft")}>
                                  <bdi>{formatMoney(r.shippingAmount, currency)}</bdi>
                                </td>
                                <td className={cn(tdNum, "text-ink-soft")}>
                                  <bdi>{formatMoney(r.returnsAmount, currency)}</bdi>
                                </td>
                                <td className={cn(tdNum, "font-semibold", neg ? "text-danger" : "text-success")}>
                                  <bdi>{formatMoney(r.netProfitAmount, currency)}</bdi>
                                </td>
                                <td className={cn(tdNum, neg ? "text-danger" : "text-ink-soft")}>
                                  <span dir="ltr">{margin === null ? "—" : `${margin.toFixed(1)}%`}</span>
                                </td>
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

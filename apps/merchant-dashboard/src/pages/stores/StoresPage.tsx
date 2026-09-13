import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, Store } from "lucide-react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { StoreSummary } from "@/mock/types2";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { BarChart } from "@/components/charts";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "All stores",
    description: "Every brand on this account, side by side.",
    createStore: "Create store",
    banner: "One login, many brands. Each store has its own domain, catalog and team; reports roll up here.",
    switchHint: "Switch workspace from the top-left menu to open this store.",
    myStore: "My store",
    ordersToday: "Orders today",
    storesCount: "{n} stores",
    revenueToday: "Revenue today",
    mixedCurrency: "Summed across currencies",
    netMonth: "Net profit this month",
    netHint: "After ads, COGS, shipping & returns",
    adSpendMonth: "Ad spend this month",
    poas: "{x}× profit on ad spend",
    blendedDelivery: "Blended delivery rate",
    weighted: "Weighted by monthly orders",
    colStore: "Store",
    colCurrency: "Currency",
    colOrdersToday: "Orders today",
    colRevenueToday: "Revenue today",
    colOrdersMonth: "Orders month",
    colRevenueMonth: "Revenue month",
    colNet: "Net profit",
    colAdSpend: "Ad spend",
    colDelivery: "Delivery",
    current: "Current",
    open: "Open",
    archived: "Archived",
    revenueMonthTitle: "Revenue this month",
    revenueMonthHint: "Per store, in each store's own currency.",
    emptyTitle: "No stores yet",
    emptyHint: "Create your first store to see it here.",
  },
  ar: {
    title: "كل المتاجر",
    description: "كل العلامات التجارية في حسابك جنبًا إلى جنب.",
    createStore: "إنشاء متجر",
    banner: "تسجيل دخول واحد لعلامات تجارية متعددة. لكل متجر نطاقه وكتالوجه وفريقه الخاص، وتُجمع التقارير هنا.",
    switchHint: "بدّل مساحة العمل من القائمة أعلى الشاشة لفتح هذا المتجر.",
    myStore: "متجري",
    ordersToday: "طلبات اليوم",
    storesCount: "{n} متاجر",
    revenueToday: "إيرادات اليوم",
    mixedCurrency: "مجموع بعملات مختلفة",
    netMonth: "صافي الربح هذا الشهر",
    netHint: "بعد الإعلانات وتكلفة البضاعة والشحن والمرتجعات",
    adSpendMonth: "الإنفاق الإعلاني هذا الشهر",
    poas: "{x}× ربح مقابل الإنفاق الإعلاني",
    blendedDelivery: "متوسط معدل التسليم",
    weighted: "مرجّح بعدد الطلبات الشهرية",
    colStore: "المتجر",
    colCurrency: "العملة",
    colOrdersToday: "طلبات اليوم",
    colRevenueToday: "إيرادات اليوم",
    colOrdersMonth: "طلبات الشهر",
    colRevenueMonth: "إيرادات الشهر",
    colNet: "صافي الربح",
    colAdSpend: "الإنفاق الإعلاني",
    colDelivery: "التسليم",
    current: "الحالي",
    open: "فتح",
    archived: "مؤرشف",
    revenueMonthTitle: "إيرادات هذا الشهر",
    revenueMonthHint: "لكل متجر، بعملة المتجر نفسه.",
    emptyTitle: "لا توجد متاجر بعد",
    emptyHint: "أنشئ متجرك الأول ليظهر هنا.",
  },
} satisfies Messages;

function DeliveryMeter({ bp }: { bp: number }) {
  const pct = bp / 100;
  const tone = bp === 0 ? "bg-line" : bp >= 7500 ? "bg-success" : bp >= 6500 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zimos-ice">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums text-ink-soft" dir="ltr">
        {bp === 0 ? "—" : formatPercent(bp)}
      </span>
    </div>
  );
}

const TH = "px-4 py-3 font-medium text-start";
const TH_NUM = "px-4 py-3 font-medium text-end";
const TD_NUM = "px-4 py-3 text-end tabular-nums";

export function StoresPage() {
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const t = useT(STRINGS);
  const c = useCommon();
  const wsId = currentWorkspace?.id ?? "";
  const wsName = currentWorkspace?.name ?? t.myStore;
  const stores = useAsync(() => mockApi.listStores(wsId, wsName), [wsId, wsName]);

  const list = stores.data ?? [];

  const totals = useMemo(() => {
    const ordersToday = list.reduce((s, x) => s + x.ordersToday, 0);
    const revenueToday = list.reduce((s, x) => s + x.revenueTodayAmount, 0);
    const netMonth = list.reduce((s, x) => s + x.netProfitMonthAmount, 0);
    const adSpend = list.reduce((s, x) => s + x.adSpendMonthAmount, 0);
    const active = list.filter((x) => x.ordersMonth > 0);
    const weighted = active.reduce((s, x) => s + x.deliveryRateBp * x.ordersMonth, 0);
    const ordersMonth = active.reduce((s, x) => s + x.ordersMonth, 0);
    const blendedBp = ordersMonth > 0 ? Math.round(weighted / ordersMonth) : 0;
    return { ordersToday, revenueToday, netMonth, adSpend, blendedBp };
  }, [list]);

  const mixedCurrency = useMemo(() => new Set(list.map((s) => s.currency)).size > 1, [list]);

  function open(store: StoreSummary) {
    if (store.workspaceId === wsId) navigate("/");
    else toast.success(t.switchHint);
  }

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => navigate("/workspaces")}>
            <Plus /> {t.createStore}
          </Button>
        }
      />

      <Alert variant="info" className="rounded-2xl border-primary/30 bg-primary-soft text-ink">
        <Building2 className="text-primary" />
        <span>{t.banner}</span>
      </Alert>

      <DataState loading={stores.loading} error={stores.error} onRetry={() => stores.refresh()}>
        {list.length === 0 ? (
          <EmptyState
            icon={<Store />}
            title={t.emptyTitle}
            description={t.emptyHint}
            action={
              <Button onClick={() => navigate("/workspaces")}>
                <Plus /> {t.createStore}
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
              <KpiCard
                label={t.ordersToday}
                value={<bdi dir="ltr">{formatNumber(totals.ordersToday)}</bdi>}
                hint={fmt(t.storesCount, { n: formatNumber(list.length) })}
              />
              <KpiCard
                label={t.revenueToday}
                value={<bdi dir="ltr">{formatMoney(totals.revenueToday)}</bdi>}
                hint={mixedCurrency ? t.mixedCurrency : undefined}
              />
              <KpiCard label={t.netMonth} value={<bdi dir="ltr">{formatMoney(totals.netMonth)}</bdi>} hint={t.netHint} />
              <KpiCard
                label={t.adSpendMonth}
                value={<bdi dir="ltr">{formatMoney(totals.adSpend)}</bdi>}
                hint={
                  totals.netMonth > 0 && totals.adSpend > 0
                    ? fmt(t.poas, { x: (totals.netMonth / totals.adSpend).toFixed(2) })
                    : undefined
                }
              />
              <KpiCard
                label={t.blendedDelivery}
                value={<bdi dir="ltr">{totals.blendedBp ? formatPercent(totals.blendedBp) : "—"}</bdi>}
                hint={t.weighted}
                className="col-span-2 lg:col-span-1"
              />
            </div>

            <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper text-xs uppercase tracking-wide text-ink-soft">
                    <th className={TH}>{t.colStore}</th>
                    <th className={TH}>{t.colCurrency}</th>
                    <th className={TH_NUM}>{t.colOrdersToday}</th>
                    <th className={TH_NUM}>{t.colRevenueToday}</th>
                    <th className={TH_NUM}>{t.colOrdersMonth}</th>
                    <th className={TH_NUM}>{t.colRevenueMonth}</th>
                    <th className={TH_NUM}>{t.colNet}</th>
                    <th className={TH_NUM}>{t.colAdSpend}</th>
                    <th className={TH}>{t.colDelivery}</th>
                    <th className={TH}>{c.status}</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => {
                    const current = s.workspaceId === wsId;
                    const isActive = s.status === "active";
                    return (
                      <tr
                        key={s.workspaceId}
                        className={cn("border-b border-line last:border-0", current ? "bg-primary-soft/40" : "hover:bg-paper/60")}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-ink" dir="auto">
                              {s.name}
                            </span>
                            {current && (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-white">
                                {t.current}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-soft" dir="ltr">
                          <span className="block text-start rtl:text-end">{s.currency}</span>
                        </td>
                        <td className={cn(TD_NUM, "text-ink")}>
                          <bdi dir="ltr">{formatNumber(s.ordersToday)}</bdi>
                        </td>
                        <td className={cn(TD_NUM, "text-ink")}>
                          <bdi dir="ltr">{formatMoney(s.revenueTodayAmount, s.currency)}</bdi>
                        </td>
                        <td className={cn(TD_NUM, "text-ink-soft")}>
                          <bdi dir="ltr">{formatNumber(s.ordersMonth)}</bdi>
                        </td>
                        <td className={cn(TD_NUM, "text-ink")}>
                          <bdi dir="ltr">{formatMoney(s.revenueMonthAmount, s.currency)}</bdi>
                        </td>
                        <td className={cn(TD_NUM, "font-medium", s.netProfitMonthAmount > 0 ? "text-success" : "text-ink-soft")}>
                          <bdi dir="ltr">{formatMoney(s.netProfitMonthAmount, s.currency)}</bdi>
                        </td>
                        <td className={cn(TD_NUM, "text-ink-soft")}>
                          <bdi dir="ltr">{formatMoney(s.adSpendMonthAmount, s.currency)}</bdi>
                        </td>
                        <td className="px-4 py-3">
                          <DeliveryMeter bp={s.deliveryRateBp} />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                              isActive ? "border-success/25 bg-success-soft text-success" : "border-line bg-paper text-ink-soft"
                            )}
                          >
                            {isActive ? c.active : t.archived}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <Button size="sm" variant={current ? "primary" : "outline"} onClick={() => open(s)}>
                            {t.open}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="font-semibold">{t.revenueMonthTitle}</CardTitle>
                <CardDescription>{t.revenueMonthHint}</CardDescription>
              </CardHeader>
              <CardContent>
                <div dir="ltr">
                  <BarChart
                    points={list.map((s) => ({ label: s.name, value: s.revenueMonthAmount }))}
                    height={140}
                    format={(v) => formatMoney(v)}
                  />
                  <div
                    className="mt-2 grid text-center text-xs text-ink-soft"
                    style={{ gridTemplateColumns: `repeat(${Math.max(list.length, 1)}, minmax(0, 1fr))` }}
                  >
                    {list.map((s) => (
                      <span key={s.workspaceId} className="truncate px-1" dir="auto">
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DataState>
    </div>
  );
}

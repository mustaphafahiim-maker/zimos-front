import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { StoreSummary } from "@/mock/types2";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { BarChart } from "@/components/charts";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";

function DeliveryMeter({ bp }: { bp: number }) {
  const pct = bp / 100;
  const tone = bp === 0 ? "bg-line" : bp >= 7500 ? "bg-success" : bp >= 6500 ? "bg-accent" : "bg-danger";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line/60">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums text-ink-soft">{bp === 0 ? "—" : formatPercent(bp)}</span>
    </div>
  );
}

export function StoresPage() {
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const wsId = currentWorkspace?.id ?? "";
  const wsName = currentWorkspace?.name ?? "My store";
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
    else toast.success("Switch workspace from the top-left menu to open this store.");
  }

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title="All stores"
        description="Every brand on this account, side by side."
        actions={
          <Button onClick={() => navigate("/workspaces")}>
            <Plus /> Create store
          </Button>
        }
      />

      <Alert variant="info" className="border-primary/30 bg-primary-soft text-primary-dark">
        <Building2 />
        <span>One login, many brands. Each store has its own domain, catalog and team; reports roll up here.</span>
      </Alert>

      <DataState loading={stores.loading} error={stores.error} onRetry={() => stores.refresh()}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Orders today" value={totals.ordersToday.toLocaleString()} hint={`${list.length} stores`} />
          <KpiCard label="Revenue today" value={formatMoney(totals.revenueToday)} hint={mixedCurrency ? "Summed across currencies" : undefined} />
          <KpiCard label="Net profit this month" value={formatMoney(totals.netMonth)} hint="After ads, COGS, shipping & returns" />
          <KpiCard label="Ad spend this month" value={formatMoney(totals.adSpend)} hint={totals.netMonth > 0 && totals.adSpend > 0 ? `${(totals.netMonth / totals.adSpend).toFixed(2)}× profit on ad spend` : undefined} />
          <KpiCard label="Blended delivery rate" value={totals.blendedBp ? formatPercent(totals.blendedBp) : "—"} hint="Weighted by monthly orders" />
        </div>

        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Store</th>
                <th className="px-4 py-3 font-medium">Currency</th>
                <th className="px-4 py-3 text-right font-medium">Orders today</th>
                <th className="px-4 py-3 text-right font-medium">Revenue today</th>
                <th className="px-4 py-3 text-right font-medium">Orders month</th>
                <th className="px-4 py-3 text-right font-medium">Revenue month</th>
                <th className="px-4 py-3 text-right font-medium">Net profit</th>
                <th className="px-4 py-3 text-right font-medium">Ad spend</th>
                <th className="px-4 py-3 font-medium">Delivery</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const current = s.workspaceId === wsId;
                return (
                  <tr key={s.workspaceId} className={cn("border-b border-line last:border-0", current ? "bg-primary-soft/40" : "hover:bg-paper-raised/60")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink" dir="auto">{s.name}</span>
                        {current && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-white">Current</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{s.currency}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{s.ordersToday}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{formatMoney(s.revenueTodayAmount, s.currency)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{s.ordersMonth.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{formatMoney(s.revenueMonthAmount, s.currency)}</td>
                    <td className={cn("px-4 py-3 text-right tabular-nums font-medium", s.netProfitMonthAmount > 0 ? "text-success" : "text-ink-soft")}>{formatMoney(s.netProfitMonthAmount, s.currency)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{formatMoney(s.adSpendMonthAmount, s.currency)}</td>
                    <td className="px-4 py-3"><DeliveryMeter bp={s.deliveryRateBp} /></td>
                    <td className="px-4 py-3"><StatusBadge value={s.status} tone={s.status === "active" ? "success" : "neutral"} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant={current ? "primary" : "outline"} onClick={() => open(s)}>
                        Open
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Revenue this month</CardTitle>
            <CardDescription>Per store, in each store's own currency.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart points={list.map((s) => ({ label: s.name, value: s.revenueMonthAmount }))} height={140} format={(v) => formatMoney(v)} />
            <div className="mt-2 grid text-center text-xs text-ink-soft" style={{ gridTemplateColumns: `repeat(${Math.max(list.length, 1)}, minmax(0, 1fr))` }}>
              {list.map((s) => (
                <span key={s.workspaceId} className="truncate px-1" dir="auto">{s.name}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      </DataState>
    </div>
  );
}

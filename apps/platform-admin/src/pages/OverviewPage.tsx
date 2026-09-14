import { useState } from "react";
import { Link } from "react-router-dom";
import { ControlTower } from "@/components/ControlTower";
import {
  Building2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Globe,
  Hourglass,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  TriangleAlert,
  Truck,
  Wallet,
} from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { BarChart, ChartAxis, LineAreaChart } from "@store-builder/ui";
import { Panel, SourceNotice, Td, Th } from "@/components/Panel";
import { Known, UNKNOWN_HINT, Unknown, WorkspaceStatus, planLabel } from "@/components/workspace";

function withData(label: string, n: number): string {
  return n === 0 ? UNKNOWN_HINT : `${label} · from ${n} workspace${n === 1 ? "" : "s"} with data`;
}
import { useAsync } from "@store-builder/ui";
import { adminApi } from "@/mock/adminApi";
import type { AttentionItem, OverviewData } from "@/mock/types";
import { formatCompact, formatMoney, formatMoneyCompact, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { cn } from "@store-builder/ui";

const ATTENTION_ICON: Record<AttentionItem["kind"], typeof CreditCard> = {
  past_due: CreditCard,
  high_rto: ShieldAlert,
  carrier_error: Truck,
  unverified_domain: Globe,
};

export function OverviewPage() {
  const { data, loading, error, refresh } = useAsync(() => adminApi.getOverview(), []);
  const [towerKey, setTowerKey] = useState(0);

  return (
    <div>
      <PageHeader
        title="Control tower"
        description="Real backend numbers first, then alerts and platform-wide trends."
        actions={
          <Button variant="outline" size="sm" onClick={() => { setTowerKey((k) => k + 1); void refresh(); }} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <div className="mb-6">
        <ControlTower key={towerKey} />
      </div>
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data && <OverviewBody data={data} />}
      </DataState>
    </div>
  );
}

function OverviewBody({ data }: { data: OverviewData }) {
  const { kpis } = data;
  const signupsTotal = data.signupsPerDay.reduce((s, p) => s + p.value, 0);
  const ordersTotal = data.ordersPerDay.reduce((s, p) => s + p.value, 0);

  return (
    <div className="space-y-6">
      <SourceNotice result={data.workspaces} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active workspaces" value={formatNumber(kpis.activeWorkspaces)} icon={<Building2 />} to="/workspaces" hint="Paying and not suspended" />
        <KpiCard label="Trialing" value={formatNumber(kpis.trialing)} icon={<Hourglass />} to="/subscriptions" hint="Currently in free trial" />
        <KpiCard label="Past due" value={formatNumber(kpis.pastDue)} icon={<TriangleAlert />} to="/subscriptions" hint="Failed renewal payment" />
        <KpiCard label="MRR" value={formatMoneyCompact(kpis.mrr)} icon={<CircleDollarSign />} hint={formatMoney(kpis.mrr)} />
        <KpiCard label="GMV processed" value={<Known value={kpis.gmv30d} format={formatMoneyCompact} />} icon={<Wallet />} hint={withData("Last 30 days", kpis.gmvKnownCount)} />
        <KpiCard label="Orders today" value={<Known value={kpis.ordersToday} format={formatNumber} />} icon={<ShoppingCart />} hint={withData("Today", kpis.ordersTodayKnownCount)} />
        <KpiCard label="Orders (all time)" value={<Known value={kpis.ordersAllTime} format={formatNumber} />} icon={<ShoppingCart />} hint={withData("orderCount", kpis.ordersAllTimeKnownCount)} />
        <KpiCard label="Delivery rate" value={<Known value={kpis.deliveryRate} format={(v) => formatPercent(v)} />} icon={<Truck />} hint={withData("Weighted by orders", kpis.deliveryKnownCount)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Signups per day" description={data.signupsPerDay.length ? `Last 30 days · ${formatNumber(signupsTotal)} total` : UNKNOWN_HINT}>
          {data.signupsPerDay.length ? (
            <>
              <BarChart points={data.signupsPerDay} height={140} color="var(--color-primary)" format={(v) => `${v} signups`} />
              <ChartAxis points={data.signupsPerDay} />
            </>
          ) : (
            <p className="py-10 text-center text-sm text-ink-muted">— {UNKNOWN_HINT}</p>
          )}
        </Panel>
        <Panel title="MRR trend" description="Last 12 months">
          <LineAreaChart points={data.mrrTrend} height={140} format={formatMoney} />
          <ChartAxis points={data.mrrTrend} />
        </Panel>
        <Panel title="Orders per day" description={data.ordersPerDay.length ? `Last 30 days · ${formatCompact(ordersTotal)} total` : UNKNOWN_HINT}>
          {data.ordersPerDay.length ? (
            <>
              <BarChart points={data.ordersPerDay} height={140} color="var(--color-accent)" format={(v) => `${formatNumber(v)} orders`} />
              <ChartAxis points={data.ordersPerDay} />
            </>
          ) : (
            <p className="py-10 text-center text-sm text-ink-muted">— {UNKNOWN_HINT}</p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel
          className="xl:col-span-2"
          title="Needs attention"
          description={`${data.attention.length} item${data.attention.length === 1 ? "" : "s"}`}
          flush
        >
          {data.attention.length === 0 ? (
            <div className="p-4">
              <EmptyBlock message="Nothing needs attention right now." />
            </div>
          ) : (
            <ul className="scroll-thin max-h-[26rem] divide-y divide-line overflow-y-auto">
              {data.attention.map((item) => {
                const Icon = ATTENTION_ICON[item.kind];
                return (
                  <li key={item.id}>
                    <Link to={item.to} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-primary-soft/60">
                      <span
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                          item.severity === "danger" && "bg-danger-soft text-danger",
                          item.severity === "warning" && "bg-warning-soft text-warning",
                          item.severity === "info" && "bg-info-soft text-info"
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                        <span className="block truncate text-xs text-ink-soft">{item.detail}</span>
                      </span>
                      <ChevronRight className="mt-2 size-4 shrink-0 text-ink-muted rtl:rotate-180" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          className="xl:col-span-3"
          title="Recent signups"
          actions={
            <Link to="/workspaces" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          }
          flush
        >
          {data.recentSignups.length === 0 ? (
            <div className="p-4">
              <EmptyBlock message="No workspaces yet." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Workspace</Th>
                  <Th>Owner</Th>
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <Th className="text-end">Created</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentSignups.map((ws) => (
                  <TableRow key={ws.id}>
                    <Td>
                      <Link to={`/workspaces/${ws.id}`} className="font-medium text-ink hover:text-primary">
                        {ws.name}
                      </Link>
                    </Td>
                    <Td className="text-ink-soft">{ws.meta.ownerEmail ?? <Unknown />}</Td>
                    <Td>{planLabel(ws) ?? <Unknown />}</Td>
                    <Td>
                      <WorkspaceStatus ws={ws} />
                    </Td>
                    <Td className="text-end text-ink-soft">{formatRelative(ws.createdAt)}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>
    </div>
  );
}

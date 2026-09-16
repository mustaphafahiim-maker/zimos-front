import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Globe,
  Hourglass,
  Info,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  TriangleAlert,
  Truck,
  Wallet,
} from "lucide-react";
import { Alert, Button, Spinner, Table, TableBody, TableHeader, TableRow, cn } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { BarChart, ChartAxis, LineAreaChart } from "@/components/charts";
import type { ChartPoint } from "@/components/charts";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { WorkspaceStatus } from "@/components/workspace";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import type { OverviewKpi, OverviewMoneyKpi, OverviewReport, OverviewSeries } from "@/lib/adminApi";
import {
  formatChartLabel,
  formatDateTime,
  formatMinorMoney,
  formatMinorMoneyCompact,
  formatNumber,
  formatRate,
  formatRelative,
} from "@/lib/format";

const ATTENTION_ICON: Record<string, typeof CreditCard> = {
  past_due: CreditCard,
  high_rto: ShieldAlert,
  carrier_error: Truck,
  unverified_domain: Globe,
};

/**
 * An unmeasured metric, rendered so it cannot be mistaken for a zero.
 *
 * Deliberately not a dash: at a glance a small grey "Not available" reads as
 * an absence, where "—" reads as "nothing happened" and a bare 0 reads as a
 * measurement. The three are different claims and the tile has to pick one.
 */
function Unavailable() {
  return <span className="text-base font-normal text-ink-soft">Not available</span>;
}

function kpiValue(kpi: OverviewKpi, format: (value: number) => string) {
  return kpi.value === null ? <Unavailable /> : format(kpi.value);
}

/**
 * A money tile. A zero total carries no currency — there is nothing to
 * denominate and zero is the same figure in every one — so it renders as a
 * plain number rather than asserting a currency that was never measured.
 */
function moneyValue(kpi: OverviewMoneyKpi) {
  if (kpi.value === null) return <Unavailable />;
  if (kpi.currency === null) return formatNumber(kpi.value);
  return formatMinorMoneyCompact(kpi.value, kpi.currency);
}

function moneyHint(kpi: OverviewMoneyKpi, whenKnown: string): string {
  if (kpi.unavailable) return kpi.unavailable;
  if (kpi.value === null || kpi.currency === null) return whenKnown;
  // The tile shows a compact figure; the hint carries the exact one.
  return `${formatMinorMoney(kpi.value, kpi.currency)} · ${whenKnown}`;
}

/**
 * Ends a server-supplied message with a full stop so it does not run into the
 * sentence after it. Server errors arrive punctuated inconsistently ("Route not
 * found" vs "Not found."), and the banner reads as one run-on either way.
 */
function sentence(text: string): string {
  return /[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;
}

/** ISO bucket keys are only formatted for display here, never in the data layer. */
function displayPoints(series: OverviewSeries): ChartPoint[] | null {
  if (series.points === null) return null;
  return series.points.map((p) => ({ label: formatChartLabel(p.label), value: p.value }));
}

function ChartPanel({
  title,
  series,
  total,
  children,
}: {
  title: string;
  series: OverviewSeries;
  /** Description shown when the series exists. */
  total: (points: ChartPoint[]) => string;
  children: (points: ChartPoint[]) => React.ReactNode;
}) {
  const points = displayPoints(series);
  if (points === null) {
    return (
      <Panel title={title} description="Unavailable">
        <p className="text-sm text-ink-soft">{series.unavailable}</p>
      </Panel>
    );
  }
  return (
    <Panel title={title} description={total(points)}>
      {children(points)}
      <ChartAxis points={points} />
    </Panel>
  );
}

export function OverviewPage() {
  const { data, loading, error, refresh } = useAsync(() => adminApi.loadOverview(), []);
  const [refreshing, setRefreshing] = useState(false);
  const busy = loading || refreshing;

  // A refresh keeps the current figures on screen instead of collapsing the
  // whole dashboard to a spinner, but `useAsync` leaves `loading` false during
  // a silent refresh — so the button needs its own busy state or it looks
  // inert and invites a second click.
  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Platform-wide state across every workspace."
        actions={
          <Button variant="outline" size="sm" onClick={() => void reload()} disabled={busy}>
            {busy ? <Spinner /> : <RefreshCw />} {busy ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data && <OverviewBody data={data} />}
      </DataState>
    </div>
  );
}

function OverviewBody({ data }: { data: OverviewReport }) {
  const { kpis } = data;
  const signups = displayPoints(data.signupsPerDay);
  const signupsTotal = signups?.reduce((sum, p) => sum + p.value, 0) ?? 0;

  return (
    <div className="space-y-6">
      {data.source === "derived" && (
        <Alert variant="info">
          <Info aria-hidden />
          <span className="font-medium">
            Platform metrics aren&rsquo;t available — showing what can be worked out from the
            workspace list.
          </span>
          <span className="text-ink-soft">
            <Mono>GET /admin/metrics/overview</Mono> answered:{" "}
            <span className="text-ink">{sentence(data.endpointError ?? "")}</span> Subscription counts, MRR and
            signups are counted here from <Mono>GET /admin/workspaces</Mono> and{" "}
            <Mono>GET /admin/subscriptions</Mono>. Anything needing order, shipment or invoice
            totals across workspaces is marked unavailable rather than shown as zero — no endpoint
            exposes those yet.
          </span>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active workspaces"
          value={kpiValue(kpis.activeWorkspaces, formatNumber)}
          icon={<Building2 />}
          to="/workspaces"
          hint={kpis.activeWorkspaces.unavailable ?? "Subscription active"}
        />
        <KpiCard
          label="Trialing"
          value={kpiValue(kpis.trialing, formatNumber)}
          icon={<Hourglass />}
          to="/subscriptions"
          hint={kpis.trialing.unavailable ?? "Currently in free trial"}
        />
        <KpiCard
          label="Past due"
          value={kpiValue(kpis.pastDue, formatNumber)}
          icon={<TriangleAlert />}
          to="/subscriptions"
          hint={kpis.pastDue.unavailable ?? "Failed renewal payment"}
        />
        <KpiCard
          label="MRR"
          value={moneyValue(kpis.mrr)}
          icon={<CircleDollarSign />}
          hint={moneyHint(kpis.mrr, "Monthly run rate, paying plans only")}
        />
        <KpiCard
          label="GMV processed"
          value={moneyValue(kpis.gmv30d)}
          icon={<Wallet />}
          hint={moneyHint(kpis.gmv30d, "Last 30 days, all stores")}
        />
        <KpiCard
          label="Orders today"
          value={kpiValue(kpis.ordersToday, formatNumber)}
          icon={<ShoppingCart />}
          hint={kpis.ordersToday.unavailable ?? "Across all stores, UTC day"}
        />
        <KpiCard
          label="Delivery rate"
          value={kpiValue(kpis.deliveryRate, formatRate)}
          icon={<Truck />}
          hint={kpis.deliveryRate.unavailable ?? "Delivered share of finished shipments, 30 days"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartPanel
          title="Signups per day"
          series={data.signupsPerDay}
          total={() => `Last 30 days · ${formatNumber(signupsTotal)} total`}
        >
          {(points) => (
            <BarChart
              points={points}
              height={140}
              color="var(--color-primary)"
              format={(v) => `${v} signups`}
            />
          )}
        </ChartPanel>

        <ChartPanel title="MRR trend" series={data.mrrTrend} total={() => "Last 12 months"}>
          {(points) => (
            <LineAreaChart
              points={points}
              height={140}
              format={(v) =>
                kpis.mrr.currency ? formatMinorMoney(v, kpis.mrr.currency) : formatNumber(v)
              }
            />
          )}
        </ChartPanel>

        <ChartPanel
          title="Orders per day"
          series={data.ordersPerDay}
          total={(points) =>
            `Last 30 days · ${formatNumber(points.reduce((s, p) => s + p.value, 0))} total`
          }
        >
          {(points) => (
            <BarChart
              points={points}
              height={140}
              color="var(--color-accent)"
              format={(v) => `${formatNumber(v)} orders`}
            />
          )}
        </ChartPanel>
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
              <EmptyBlock
                message={
                  data.source === "derived"
                    ? "No overdue payments. Return rates and domain checks need the metrics endpoint."
                    : "Nothing needs attention right now."
                }
              />
            </div>
          ) : (
            <ul className="scroll-thin max-h-[26rem] divide-y divide-line overflow-y-auto">
              {data.attention.map((item) => {
                // A kind this build predates still gets a row and a neutral
                // icon — the queue must not hide what it cannot name.
                const Icon = ATTENTION_ICON[item.kind] ?? TriangleAlert;
                const body = (
                  <>
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                        item.severity === "danger" && "bg-danger-soft text-danger",
                        item.severity === "warning" && "bg-accent-soft text-accent-dark",
                        item.severity === "info" && "bg-primary-soft text-primary-dark dark:text-primary"
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-ink-soft">{item.detail}</span>
                    </span>
                  </>
                );
                return (
                  <li key={item.id}>
                    {item.to ? (
                      <Link
                        to={item.to}
                        className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-primary-soft/60"
                      >
                        {body}
                        <ChevronRight
                          className="mt-2 size-4 shrink-0 text-ink-soft rtl:rotate-180"
                          aria-hidden
                        />
                      </Link>
                    ) : (
                      // No workspace to open — a link to nowhere would be worse
                      // than a plain row.
                      <div className="flex items-start gap-3 px-5 py-3">{body}</div>
                    )}
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
                  <Th>Address</Th>
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <Th className="text-end">Created</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentSignups.map((row) => (
                  <TableRow key={row.workspace.id}>
                    <Td>
                      <Link
                        to={`/workspaces/${row.workspace.id}`}
                        className="font-medium text-ink hover:text-primary"
                      >
                        {row.workspace.name}
                      </Link>
                    </Td>
                    <Td className="text-ink-soft">{row.workspace.slug}</Td>
                    <Td>{row.workspace.plan}</Td>
                    <Td>
                      <WorkspaceStatus row={row} />
                    </Td>
                    <Td className="text-end text-ink-soft">
                      {formatRelative(row.workspace.createdAt)}
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>

      <p className="text-xs text-ink-soft">
        Figures as of {formatDateTime(data.generatedAt)}. Daily and monthly buckets are UTC
        calendar days, so the newest column closes at 00:00 UTC rather than local midnight.
      </p>
    </div>
  );
}

import { Link } from "react-router-dom";
import { Building2, RefreshCw, ShoppingCart, Sparkles, Users, Wallet } from "lucide-react";
import { BarChart, Button, ChartAxis, useAsync } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { Panel } from "@/components/Panel";
import { Status, useStatusLabel } from "@/components/StatusBadge";
import { adminApi, type AdminOverview } from "@/lib/adminApi";
import { formatDate, formatMinor, formatNumber, formatRelative } from "@/lib/format";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Overview",
    description: "Live platform numbers from the backend.",
    workspaces: "Workspaces",
    workspacesHint: "{active} active · {suspended} suspended · {closed} closed",
    new30d: "New workspaces",
    last30: "Last 30 days",
    users: "Users",
    usersHint: "All accounts",
    orders: "Orders (all time)",
    orders30d: "Orders (30 days)",
    gmv: "GMV (30 days)",
    gmvHint: "Non-cancelled orders",
    noGmv: "No sales in the last 30 days",
    ordersPerDay: "Orders per day",
    ordersPerDayDesc: "Last 30 days · {n} orders",
    ordersUnit: "{n} orders",
    subsByStatus: "Subscriptions by status",
    noSubs: "No subscriptions yet.",
    recentAudit: "Recent admin & account activity",
    noAudit: "No audit entries yet.",
    system: "System",
  },
  ar: {
    title: "نظرة عامة",
    description: "أرقام المنصة الحقيقية من الباك إند.",
    workspaces: "مساحات العمل",
    workspacesHint: "{active} نشطة · {suspended} موقوفة · {closed} مقفولة",
    new30d: "مساحات عمل جديدة",
    last30: "آخر 30 يوم",
    users: "المستخدمين",
    usersHint: "كل الحسابات",
    orders: "الطلبات (من الأول)",
    orders30d: "الطلبات (30 يوم)",
    gmv: "حجم المبيعات (30 يوم)",
    gmvHint: "الطلبات غير الملغية",
    noGmv: "مفيش مبيعات آخر 30 يوم",
    ordersPerDay: "الطلبات في اليوم",
    ordersPerDayDesc: "آخر 30 يوم · {n} طلب",
    ordersUnit: "{n} طلب",
    subsByStatus: "الاشتراكات حسب الحالة",
    noSubs: "مفيش اشتراكات لسه.",
    recentAudit: "آخر نشاط",
    noAudit: "مفيش عمليات متسجلة لسه.",
    system: "النظام",
  },
};

export function OverviewPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const overview = useAsync(() => adminApi.overview(), []);
  const audit = useAsync(() => adminApi.listAuditLogs({ limit: 8 }), []);

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void overview.refresh();
              void audit.refresh();
            }}
            disabled={overview.loading}
          >
            <RefreshCw /> {c.refresh}
          </Button>
        }
      />
      <DataState loading={overview.loading} error={overview.error} onRetry={() => void overview.refresh()}>
        {overview.data && <OverviewBody data={overview.data} />}
      </DataState>

      <Panel
        className="mt-6"
        title={t.recentAudit}
        actions={
          <Link to="/audit-log" className="text-sm font-medium text-primary hover:underline">
            {c.viewAll}
          </Link>
        }
        flush
      >
        <DataState loading={audit.loading} error={audit.error} onRetry={() => void audit.refresh()}>
          {audit.data && audit.data.logs.length === 0 ? (
            <div className="p-4">
              <EmptyBlock message={t.noAudit} />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {audit.data?.logs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                  <code className="rounded bg-primary-soft px-1.5 py-0.5 font-mono text-xs text-ink" dir="ltr">
                    {log.action}
                  </code>
                  <span className="min-w-0 flex-1 truncate text-ink-soft">
                    {log.actor?.fullName || log.actor?.email || "—"}
                    {log.workspace && (
                      <>
                        {" · "}
                        <Link to={`/workspaces/${log.workspace.id}`} className="text-ink hover:text-primary">
                          {log.workspace.name}
                        </Link>
                      </>
                    )}
                  </span>
                  <span className="text-xs text-ink-muted" title={formatDate(log.createdAt)}>
                    {formatRelative(log.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </Panel>
    </div>
  );
}

function OverviewBody({ data }: { data: AdminOverview }) {
  const t = useT(STRINGS);
  const statusLabel = useStatusLabel();
  const ws = data.workspaces;
  const gmv = Object.entries(data.orders.gmv30dByCurrency);
  const points = data.series.map((p) => ({ label: p.date.slice(5), value: p.orders }));
  const seriesTotal = data.series.reduce((s, p) => s + p.orders, 0);
  const subs = Object.entries(data.subscriptions.byStatus).filter(([, n]) => (n ?? 0) > 0) as Array<[string, number]>;
  const subsTotal = subs.reduce((s, [, n]) => s + n, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label={t.workspaces}
          value={formatNumber(ws.total)}
          icon={<Building2 />}
          to="/workspaces"
          hint={fmt(t.workspacesHint, { active: formatNumber(ws.byStatus.active ?? 0), suspended: formatNumber(ws.byStatus.suspended ?? 0), closed: formatNumber(ws.byStatus.closed ?? 0) })}
        />
        <KpiCard label={t.new30d} value={formatNumber(ws.new30d)} icon={<Sparkles />} hint={t.last30} />
        <KpiCard label={t.users} value={formatNumber(data.users.total)} icon={<Users />} to="/users" hint={t.usersHint} />
        <KpiCard label={t.orders} value={formatNumber(data.orders.total)} icon={<ShoppingCart />} />
        <KpiCard label={t.orders30d} value={formatNumber(data.orders.last30d)} icon={<ShoppingCart />} hint={t.last30} />
        <KpiCard
          label={t.gmv}
          value={gmv.length === 0 ? "—" : gmv.map(([cur, amt]) => formatMinor(amt, cur)).join(" · ")}
          icon={<Wallet />}
          hint={gmv.length === 0 ? t.noGmv : t.gmvHint}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title={t.ordersPerDay} description={fmt(t.ordersPerDayDesc, { n: formatNumber(seriesTotal) })}>
          <BarChart points={points} height={160} color="var(--color-primary)" format={(v) => fmt(t.ordersUnit, { n: formatNumber(v) })} />
          <ChartAxis points={points} />
        </Panel>
        <Panel title={t.subsByStatus}>
          {subs.length === 0 ? (
            <EmptyBlock message={t.noSubs} />
          ) : (
            <ul className="space-y-3">
              {subs.map(([status, n]) => (
                <li key={status}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <Link to={`/subscriptions?status=${status}`} aria-label={statusLabel(status)}>
                      <Status value={status} />
                    </Link>
                    <span className="tabular font-medium text-ink">{formatNumber(n)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-paper">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(n / subsTotal) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { Ban, ChevronRight, CreditCard, ExternalLink, FileWarning, Gavel, ListX, Power, Trash2, Wallet } from "lucide-react";
import { Alert, cn } from "@store-builder/ui";
import { KpiCard } from "@/components/KpiCard";
import { Panel } from "@/components/Panel";
import { EmptyBlock } from "@/components/DataState";
import { StatusBadge, humanize } from "@/components/StatusBadge";
import { useAsync } from "@/lib/useAsync";
import { formatNumber, formatRelative } from "@/lib/format";
import { adminDashboardUrl, loadRealDashboard, type RealStatus } from "@/lib/realAdmin";
import { controlApi } from "@/mock/controlApi";
import type { ControlAlert } from "@/mock/controlTypes";

const ALERT_ICON: Record<ControlAlert["kind"], typeof CreditCard> = {
  past_due: CreditCard,
  suspended: Ban,
  kyc_pending: FileWarning,
  failed_jobs: ListX,
  moderation: Gavel,
  maintenance: Power,
  payout_queue: Wallet,
  deletion_scheduled: Trash2,
};

function RealBadge({ status }: { status: RealStatus }) {
  const tone = status.state === "ok" ? "success" : status.state === "forbidden" ? "warning" : "danger";
  return <StatusBadge tone={tone} dot>{status.state === "ok" ? "Live" : humanize(status.state)}</StatusBadge>;
}

/** Real backend numbers first, then cross-page alerts. */
export function ControlTower() {
  const real = useAsync(() => loadRealDashboard(), []);
  const alerts = useAsync(() => controlApi.getControlAlerts(), []);
  const ws = real.data?.workspaces;
  const byStatus = (s: string) => ws?.rows.filter((r) => r.status === s).length ?? 0;

  return (
    <div className="space-y-4">
      <Panel
        title="Backend (real)"
        description="GET /api/v1/admin/workspaces and GET /api/v1/admin/dashboard"
        actions={
          real.data && (
            <>
              <RealBadge status={real.data.workspaces} />
              <a href={adminDashboardUrl()} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                HTML dashboard <ExternalLink className="size-3" aria-hidden />
              </a>
            </>
          )
        }
      >
        {real.loading ? (
          <p className="text-sm text-ink-soft">Checking backend…</p>
        ) : !ws ? null : ws.state === "ok" ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiCard label="Workspaces" value={formatNumber(ws.rows.length)} to="/workspaces" hint="From /admin/workspaces" />
            <KpiCard label="Active" value={formatNumber(byStatus("active"))} hint="Subscription status" />
            <KpiCard label="Trialing" value={formatNumber(byStatus("trialing"))} hint="Subscription status" />
            <KpiCard label="Past due" value={formatNumber(byStatus("past_due"))} to="/subscriptions" hint="Subscription status" />
            {(() => {
              const known = ws.rows.filter((r) => typeof r.orderCount === "number");
              return (
                <KpiCard
                  label="Orders (all time)"
                  value={known.length ? formatNumber(known.reduce((s, r) => s + r.orderCount, 0)) : "—"}
                  hint={known.length ? `Sum of orderCount · from ${known.length} workspace${known.length === 1 ? "" : "s"} with data` : "Not provided by the API yet"}
                />
              );
            })()}
          </div>
        ) : (
          <Alert variant={ws.state === "forbidden" ? "warning" : "danger"}>
            {ws.state === "forbidden"
              ? "This account is not a platform admin — the backend returned 403 for /admin/workspaces. The console below shows demo data stored locally."
              : `Couldn't reach the admin endpoints (${ws.message ?? ws.state}). Showing demo data.`}
            <span className="mt-1 block text-xs">Dashboard endpoint: {humanize(real.data?.dashboard.state ?? "unknown")} · checked {formatRelative(ws.checkedAt)}</span>
          </Alert>
        )}
      </Panel>

      <Panel flush title="Alerts" description="Everything on the platform that needs an owner decision.">
        {alerts.loading ? (
          <p className="px-5 py-4 text-sm text-ink-soft">Loading alerts…</p>
        ) : alerts.error ? (
          <p className="px-5 py-4 text-sm text-danger">Couldn't load alerts.</p>
        ) : (alerts.data ?? []).length === 0 ? (
          <div className="p-4"><EmptyBlock message="All clear — nothing needs attention." /></div>
        ) : (
          <ul className="grid grid-cols-1 divide-y divide-line md:grid-cols-2 md:divide-y-0">
            {(alerts.data ?? []).map((a) => {
              const Icon = ALERT_ICON[a.kind];
              return (
                <li key={a.id} className="md:border-b md:border-line md:odd:border-e">
                  <Link to={a.to} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-primary-soft/60">
                    <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", a.severity === "danger" && "bg-danger-soft text-danger", a.severity === "warning" && "bg-warning-soft text-warning", a.severity === "info" && "bg-info-soft text-info")}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{a.title}</span>
                      <span className="block truncate text-xs text-ink-soft">{a.detail}</span>
                    </span>
                    <ChevronRight className="mt-2 size-4 shrink-0 text-ink-muted rtl:rotate-180" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

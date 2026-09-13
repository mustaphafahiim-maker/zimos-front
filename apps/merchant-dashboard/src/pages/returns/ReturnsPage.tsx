import { useMemo, useState } from "react";
import { Alert, Button, Tabs, TabsList, TabsTrigger, cn } from "@store-builder/ui";
import { Check, Info, PackageCheck, PackageX, Phone, RotateCcw, Truck, Wallet, X } from "lucide-react";
import type { ReturnRequest } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatMoney, humanize } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { HBarList } from "@/components/charts";
import { useToast } from "@/components/Toast";

type Tab = "all" | "customer_return" | "rto";

const RETURN_RATE_LABEL = "9.4%";

const STATUS_TONE: Record<ReturnRequest["status"], "warning" | "info" | "danger" | "success" | "neutral"> = {
  requested: "warning",
  approved: "info",
  rejected: "danger",
  received: "success",
  restocked: "success",
  refunded: "neutral",
};

const REASON_LABEL: Record<ReturnRequest["reason"], string> = {
  no_longer_wanted: "No longer wanted",
  not_as_described: "Not as described",
  wrong_item: "Wrong item",
  damaged: "Damaged",
  arrived_late: "Arrived late",
  rto_unreachable: "RTO — unreachable",
  rto_refused: "RTO — refused",
};

export function ReturnsPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => mockApi.listReturns(workspaceId), [workspaceId]);
  const [tab, setTab] = useState<Tab>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const returns = list.data ?? [];

  const kpis = useMemo(() => {
    const now = new Date();
    const open = returns.filter((r) => r.status === "requested" || r.status === "approved" || r.status === "received").length;
    const rtoMonth = returns.filter((r) => r.kind === "rto" && new Date(r.createdAt).getMonth() === now.getMonth() && new Date(r.createdAt).getFullYear() === now.getFullYear()).length;
    const refundPending = returns.filter((r) => r.kind === "customer_return" && r.status !== "refunded" && r.status !== "rejected").reduce((a, r) => a + r.refundAmount, 0);
    return { open, rtoMonth, refundPending };
  }, [returns]);

  const reasons = useMemo(() => {
    const counts = new Map<ReturnRequest["reason"], number>();
    returns.forEach((r) => counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([reason, value]) => ({ label: REASON_LABEL[reason] ?? humanize(reason), value }));
  }, [returns]);

  const rows = returns.filter((r) => tab === "all" || r.kind === tab).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function advance(r: ReturnRequest, status: ReturnRequest["status"], message: string) {
    setBusy(r.id);
    list.setData((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, status } : x)));
    try {
      await mockApi.setReturnStatus(workspaceId, r.id, status);
      toast.success(message);
    } catch (err) {
      toast.error(getErrorMessage(err));
      list.refresh({ silent: true });
    } finally {
      setBusy(null);
    }
  }

  function actions(r: ReturnRequest) {
    const disabled = busy === r.id;
    switch (r.status) {
      case "requested":
        return (
          <>
            <Button size="sm" variant="ghost" className="text-success" disabled={disabled} onClick={() => advance(r, "approved", `${r.orderNumber} return approved — pickup scheduled.`)}>
              <Check /> Approve
            </Button>
            <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" disabled={disabled} onClick={() => advance(r, "rejected", `${r.orderNumber} return rejected.`)}>
              <X /> Reject
            </Button>
          </>
        );
      case "approved":
        return (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => advance(r, "received", `${r.orderNumber} marked as received at warehouse.`)}>
            <PackageCheck /> Mark received
          </Button>
        );
      case "received":
        return (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => advance(r, "restocked", `${r.orderNumber} items restocked.`)}>
            <RotateCcw /> Restock
          </Button>
        );
      case "restocked":
        return r.kind === "customer_return" ? (
          <Button size="sm" variant="ghost" className="text-primary" disabled={disabled} onClick={() => advance(r, "refunded", `${formatMoney(r.refundAmount, r.currency)} refunded for ${r.orderNumber}.`)}>
            <Wallet /> Refund
          </Button>
        ) : (
          <span className="text-xs text-ink-soft">Done</span>
        );
      default:
        return <span className="text-xs text-ink-soft">Closed</span>;
    }
  }

  return (
    <div className="max-w-6xl">
      <PageHeader title="Returns & RTO" description="Customer returns and undelivered COD parcels coming back to you." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Open requests" value={kpis.open} hint="Requested, approved or awaiting restock" icon={<RotateCcw />} />
        <KpiCard label="RTO this month" value={kpis.rtoMonth} hint="Shipped but never delivered" icon={<PackageX />} />
        <KpiCard label="Return rate" value={RETURN_RATE_LABEL} hint="Of delivered orders, last 30 days" icon={<Truck />} />
        <KpiCard label="Refund pending" value={formatMoney(kpis.refundPending)} hint="Customer returns not yet refunded" icon={<Wallet />} />
      </div>

      <Alert variant="info" className="mb-6 border-primary/30 bg-primary-soft/40">
        <Info />
        <p className="text-sm text-ink-soft">RTO = order shipped but never delivered (unreachable / refused). It costs you shipping both ways — that's why confirmation matters.</p>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <Tabs value={tab} onValueChange={(v) => setTab(String(v) as Tab)} className="mb-3">
            <TabsList variant="line">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="customer_return">Customer returns</TabsTrigger>
              <TabsTrigger value="rto">RTO (undelivered)</TabsTrigger>
            </TabsList>
          </Tabs>

          <DataState loading={list.loading} error={list.error} empty={rows.length === 0} emptyMessage="No returns here." onRetry={() => list.refresh()}>
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Kind</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 text-right font-medium">Refund</th>
                    <th className="px-4 py-3 font-medium">Carrier</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper-raised">
                      <td className="px-4 py-3 font-mono text-xs text-ink">{r.orderNumber}</td>
                      <td className="px-4 py-3">
                        <p className="text-ink" dir="auto">
                          {r.customerName}
                        </p>
                        <p className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-soft">
                          <Phone className="size-3" /> {r.phone}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", r.kind === "rto" ? "bg-accent-soft text-accent-dark" : "bg-primary-soft text-primary-dark")}>{r.kind === "rto" ? "RTO" : "Return"}</span>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{humanize(r.reason)}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-ink" dir="auto">
                        {r.items.map((i) => `${i.productName} × ${i.quantity}`).join(", ")}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink">{r.refundAmount ? formatMoney(r.refundAmount, r.currency) : "—"}</td>
                      <td className="px-4 py-3 text-xs text-ink-soft">{r.carrierName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={r.status} tone={STATUS_TONE[r.status]} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-soft">{formatDate(r.createdAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{actions(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataState>
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
          <p className="text-sm font-medium text-ink">Reasons breakdown</p>
          <p className="mb-3 text-xs text-ink-soft">All returns and RTOs, by reason.</p>
          {reasons.length ? <HBarList rows={reasons} format={(v) => `${v}`} /> : <p className="text-xs text-ink-soft">No data yet.</p>}
        </div>
      </div>
    </div>
  );
}

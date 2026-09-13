import { useMemo, useRef, useState } from "react";
import { Alert, Button, Label, cn } from "@store-builder/ui";
import { AlertTriangle, Banknote, CalendarClock, Check, FileUp, Info, Scale, Wallet } from "lucide-react";
import type { Settlement, SettlementOrder } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

const STATUS_TONE: Record<Settlement["status"], "info" | "success" | "danger" | "neutral"> = {
  expected: "info",
  received: "success",
  discrepancy: "danger",
  reconciled: "neutral",
};

const CARRIER_TONE: Record<string, string> = {
  bosta: "bg-danger-soft text-danger",
  jnt: "bg-danger-soft text-danger",
};

const AVG_PAYOUT_DELAY_DAYS = 6;

function CarrierChip({ carrierKey, name }: { carrierKey: string; name: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", CARRIER_TONE[carrierKey] ?? "bg-primary-soft text-primary-dark")}>{name}</span>;
}

export function SettlementsPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => mockApi.listSettlements(workspaceId), [workspaceId]);

  const [carrier, setCarrier] = useState<string>("all");
  const [status, setStatus] = useState<"all" | Settlement["status"]>("all");
  const [reconciling, setReconciling] = useState<Settlement | null>(null);
  const [uploadTarget, setUploadTarget] = useState<Settlement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const settlements = list.data ?? [];
  const carriers = useMemo(() => Array.from(new Map(settlements.map((s) => [s.carrierKey, s.carrierName])).entries()), [settlements]);

  const kpis = useMemo(() => {
    const now = new Date();
    const expected = settlements.filter((s) => s.status === "expected").reduce((a, s) => a + s.netAmount, 0);
    const receivedMonth = settlements
      .filter((s) => s.receivedAt && new Date(s.receivedAt).getMonth() === now.getMonth() && new Date(s.receivedAt).getFullYear() === now.getFullYear())
      .reduce((a, s) => a + s.netAmount, 0);
    const disc = settlements.filter((s) => s.status === "discrepancy");
    return { expected, receivedMonth, discCount: disc.length, discAmount: disc.reduce((a, s) => a + Math.abs(s.discrepancyAmount), 0) };
  }, [settlements]);

  const rows = settlements.filter((s) => (carrier === "all" || s.carrierKey === carrier) && (status === "all" || s.status === status));

  async function setSt(s: Settlement, next: Settlement["status"]) {
    list.setData((prev) => (prev ?? []).map((x) => (x.id === s.id ? { ...x, status: next, receivedAt: x.receivedAt ?? new Date().toISOString() } : x)));
    try {
      await mockApi.setSettlementStatus(workspaceId, s.id, next);
      toast.success(next === "received" ? `${s.reference} marked as received.` : `${s.reference} reconciled.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
      list.refresh({ silent: true });
    }
  }

  function pickFile(s: Settlement) {
    setUploadTarget(s);
    requestAnimationFrame(() => fileRef.current?.click());
  }

  function onFile(files: FileList | null) {
    const f = files?.[0];
    if (f && uploadTarget) toast.success(`“${f.name}” uploaded for ${uploadTarget.reference} — matching against delivered orders.`);
    if (fileRef.current) fileRef.current.value = "";
    setUploadTarget(null);
  }

  return (
    <div className="max-w-6xl">
      <PageHeader title="COD settlements" description="The cash carriers collected for you — what's due, what arrived, and what doesn't add up." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Expected" value={formatMoney(kpis.expected)} hint="Net payouts not yet received" icon={<Wallet />} />
        <KpiCard label="Received this month" value={formatMoney(kpis.receivedMonth)} hint="Net after carrier & COD fees" icon={<Banknote />} />
        <KpiCard label="Discrepancies" value={kpis.discCount} hint={kpis.discCount ? `${formatMoney(kpis.discAmount)} short` : "All payouts match"} icon={<AlertTriangle />} />
        <KpiCard label="Avg. payout delay" value={`${AVG_PAYOUT_DELAY_DAYS} days`} hint="From delivery to cash in your account" icon={<CalendarClock />} />
      </div>

      <Alert variant="info" className="mb-6 border-primary/30 bg-primary-soft/40">
        <Info />
        <p className="text-sm text-ink-soft">Carriers collect cash from customers and pay you weekly minus fees. Zimos matches each payout against your delivered orders so nothing goes missing.</p>
      </Alert>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-ink-soft">Carrier</Label>
          <Select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="h-8 w-40 py-1">
            <option value="all">All carriers</option>
            {carriers.map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-ink-soft">Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-8 w-40 py-1">
            <option value="all">All</option>
            <option value="expected">Expected</option>
            <option value="received">Received</option>
            <option value="discrepancy">Discrepancy</option>
            <option value="reconciled">Reconciled</option>
          </Select>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".csv,.xlsx,.pdf" className="hidden" onChange={(e) => onFile(e.target.files)} />

      <DataState loading={list.loading} error={list.error} empty={rows.length === 0} emptyMessage="No settlements match these filters." onRetry={() => list.refresh()}>
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Carrier</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 text-right font-medium">Orders</th>
                <th className="px-4 py-3 text-right font-medium">Collected</th>
                <th className="px-4 py-3 text-right font-medium">Carrier fees</th>
                <th className="px-4 py-3 text-right font-medium">COD fees</th>
                <th className="px-4 py-3 text-right font-medium">Net</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0 hover:bg-paper-raised">
                  <td className="px-4 py-3">
                    <CarrierChip carrierKey={s.carrierKey} name={s.carrierName} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink">{s.reference}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-soft">
                    {formatDate(s.periodFrom)} → {formatDate(s.periodTo)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">{s.ordersCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">{formatMoney(s.collectedAmount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-danger">−{formatMoney(s.carrierFeesAmount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-danger">−{formatMoney(s.codFeesAmount)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-ink">
                    {formatMoney(s.netAmount)}
                    {s.discrepancyAmount !== 0 && <span className="block text-[11px] font-normal text-danger">{formatMoney(s.discrepancyAmount)}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={s.status} tone={STATUS_TONE[s.status]} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-soft">{s.receivedAt ? formatDate(s.receivedAt) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {s.status === "expected" && (
                      <Button size="sm" variant="ghost" className="text-success" onClick={() => setSt(s, "received")}>
                        <Check /> Mark received
                      </Button>
                    )}
                    {(s.status === "received" || s.status === "discrepancy") && (
                      <Button size="sm" variant="ghost" onClick={() => setReconciling(s)}>
                        <Scale /> Reconcile
                      </Button>
                    )}
                    <Button size="icon-sm" variant="ghost" aria-label="Upload carrier statement" title="Upload carrier statement" onClick={() => pickFile(s)}>
                      <FileUp />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>

      <Modal open={reconciling !== null} onClose={() => setReconciling(null)} title={reconciling ? `Reconcile ${reconciling.reference}` : "Reconcile"} description="Order-by-order comparison between what you shipped and what the carrier reported." className="max-w-3xl">
        {reconciling && (
          <ReconcilePanel
            key={reconciling.id}
            settlement={reconciling}
            onAccept={async () => {
              await setSt(reconciling, "reconciled");
              setReconciling(null);
            }}
            onDispute={() => {
              toast.success(`Dispute raised with ${reconciling.carrierName} for ${reconciling.reference}.`);
              setReconciling(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function ReconcilePanel({ settlement, onAccept, onDispute }: { settlement: Settlement; onAccept: () => Promise<void>; onDispute: () => void }) {
  const workspaceId = useWorkspaceId();
  const orders = useAsync(() => mockApi.getSettlementOrders(workspaceId, settlement.id), [workspaceId, settlement.id]);
  const [busy, setBusy] = useState(false);
  const rows: SettlementOrder[] = orders.data ?? [];
  const matched = rows.filter((r) => r.matched).length;
  const totalDiff = rows.reduce((a, r) => a + ((r.carrierReportedAmount ?? 0) - (r.carrierStatus === "delivered" ? r.codAmount : 0)), 0);

  return (
    <DataState loading={orders.loading} error={orders.error} onRetry={() => orders.refresh()}>
      <div className="max-h-[50vh] overflow-auto rounded-[var(--radius-card)] border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 bg-paper-raised">
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 text-right font-medium">Our COD</th>
              <th className="px-3 py-2 font-medium">Carrier status</th>
              <th className="px-3 py-2 text-right font-medium">Carrier reported</th>
              <th className="px-3 py-2 text-right font-medium">Diff</th>
              <th className="px-3 py-2 text-center font-medium">Match</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const expected = r.carrierStatus === "delivered" ? r.codAmount : 0;
              const diff = (r.carrierReportedAmount ?? 0) - expected;
              return (
                <tr key={r.orderNumber} className={cn("border-b border-line last:border-0", !r.matched && "bg-danger-soft/40")}>
                  <td className="px-3 py-2 font-mono text-xs text-ink">{r.orderNumber}</td>
                  <td className="px-3 py-2 text-ink" dir="auto">
                    {r.customerName}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{formatMoney(r.codAmount)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge value={r.carrierStatus} tone={r.carrierStatus === "delivered" ? "success" : r.carrierStatus === "returned" ? "warning" : "danger"} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{r.carrierReportedAmount === null ? "—" : formatMoney(r.carrierReportedAmount)}</td>
                  <td className={cn("px-3 py-2 text-right tabular-nums", diff === 0 ? "text-ink-soft" : diff < 0 ? "text-danger" : "text-success")}>{diff === 0 ? "0" : formatMoney(diff)}</td>
                  <td className="px-3 py-2 text-center">{r.matched ? <Check className="mx-auto size-4 text-success" /> : <AlertTriangle className="mx-auto size-4 text-danger" />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          <span className="font-medium text-ink">
            {matched} of {rows.length}
          </span>{" "}
          matched · total diff <span className={cn("font-medium tabular-nums", totalDiff === 0 ? "text-success" : "text-danger")}>{formatMoney(totalDiff)}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="text-danger" onClick={onDispute} disabled={busy}>
            Raise dispute
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onAccept();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Accept & mark reconciled"}
          </Button>
        </div>
      </div>
    </DataState>
  );
}

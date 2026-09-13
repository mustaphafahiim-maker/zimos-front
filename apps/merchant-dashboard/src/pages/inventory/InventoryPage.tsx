import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Boxes, Download, Layers, Wallet } from "lucide-react";
import { Button, Input, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { InventoryRow } from "@/mock/types";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";

type StockStatus = "in_stock" | "low" | "out";

function stockStatus(r: InventoryRow): StockStatus {
  if (r.available <= 0) return "out";
  if (r.available <= r.lowStockThreshold) return "low";
  return "in_stock";
}

const STATUS_PILL: Record<StockStatus, { label: string; className: string }> = {
  in_stock: { label: "In stock", className: "bg-success-soft text-success" },
  low: { label: "Low", className: "bg-accent-soft text-accent-dark" },
  out: { label: "Out", className: "bg-danger-soft text-danger" },
};

const REASONS = [
  { value: "received", label: "Received" },
  { value: "damaged", label: "Damaged" },
  { value: "correction", label: "Correction" },
  { value: "returned", label: "Returned" },
] as const;

function stockValue(r: InventoryRow): number {
  return r.costAmount ? Math.max(r.available, 0) * Number(r.costAmount) : 0;
}

function csvCell(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function InventoryPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const inventory = useAsync(() => mockApi.listInventory(workspaceId), [workspaceId]);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState<Record<string, string>>({});

  const rows = inventory.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (lowOnly && stockStatus(r) === "in_stock") return false;
      if (!q) return true;
      return [r.productName, r.variantLabel, r.sku ?? ""].some((s) => s.toLowerCase().includes(q));
    });
  }, [rows, search, lowOnly]);

  const kpis = useMemo(
    () => ({
      skus: rows.length,
      units: rows.reduce((a, r) => a + r.onHand, 0),
      low: rows.filter((r) => stockStatus(r) !== "in_stock").length,
      value: rows.reduce((a, r) => a + stockValue(r), 0),
    }),
    [rows]
  );

  async function commitThreshold(r: InventoryRow) {
    const raw = thresholdDraft[r.variantId];
    if (raw === undefined) return;
    const n = Number(raw);
    setThresholdDraft((p) => {
      const next = { ...p };
      delete next[r.variantId];
      return next;
    });
    if (!Number.isInteger(n) || n < 0 || n === r.lowStockThreshold) return;
    await mockApi.setLowStockThreshold(workspaceId, r.variantId, n);
    inventory.setData((prev) => (prev ?? []).map((x) => (x.variantId === r.variantId ? { ...x, lowStockThreshold: n } : x)));
    toast.success("Threshold updated.");
  }

  function exportCsv() {
    const header = ["Product", "Variant", "SKU", "On hand", "Reserved", "Available", "Low stock threshold", "Cost", "Stock value"];
    const lines = filtered.map((r) =>
      [r.productName, r.variantLabel, r.sku, r.onHand, r.reserved, r.available, r.lowStockThreshold, r.costAmount, stockValue(r)].map(csvCell).join(",")
    );
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title="Inventory"
        description="Stock levels per variant, with reservations from unfulfilled orders."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download /> Export CSV
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="SKUs" value={kpis.skus.toLocaleString()} icon={<Layers />} />
        <KpiCard label="Units on hand" value={kpis.units.toLocaleString()} icon={<Boxes />} />
        <KpiCard label="Low stock" value={kpis.low.toLocaleString()} hint="At or below threshold" icon={<AlertTriangle />} />
        <KpiCard label="Inventory value" value={formatMoney(kpis.value, "EGP")} hint="Available × cost" icon={<Wallet />} />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input placeholder="Search product, variant or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <label className="flex items-center gap-2 text-sm text-ink">
          <Toggle checked={lowOnly} onChange={setLowOnly} /> Low stock only
        </label>
      </div>

      <DataState loading={inventory.loading} error={inventory.error} empty={filtered.length === 0} emptyMessage="No variants match." onRetry={() => inventory.refresh()}>
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Variant</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 text-right font-medium">On hand</th>
                <th className="px-4 py-3 text-right font-medium">Reserved</th>
                <th className="px-4 py-3 text-right font-medium">Available</th>
                <th className="px-4 py-3 text-right font-medium">Low at</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 text-right font-medium">Stock value</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const st = STATUS_PILL[stockStatus(r)];
                return (
                  <tr key={r.variantId} className="border-b border-line last:border-0 hover:bg-paper-raised">
                    <td className="px-4 py-3 font-medium text-ink">{r.productName}</td>
                    <td className="px-4 py-3 text-ink-soft">{r.variantLabel}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">{r.sku ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{r.onHand}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{r.reserved}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-ink">{r.available}</td>
                    <td className="px-4 py-3 text-right">
                      <Input
                        type="number"
                        min={0}
                        aria-label={`Low stock threshold for ${r.productName} ${r.variantLabel}`}
                        value={thresholdDraft[r.variantId] ?? String(r.lowStockThreshold)}
                        onChange={(e) => setThresholdDraft((p) => ({ ...p, [r.variantId]: e.target.value }))}
                        onBlur={() => commitThreshold(r)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        className="ml-auto h-8 w-20 text-right"
                      />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{r.costAmount ? formatMoney(r.costAmount, "EGP") : "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{formatMoney(stockValue(r), "EGP")}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", st.className)}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setAdjusting(r)}>
                        Adjust
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataState>

      <Modal open={adjusting !== null} onClose={() => setAdjusting(null)} title="Adjust stock" description={adjusting ? `${adjusting.productName} · ${adjusting.variantLabel}` : undefined}>
        {adjusting && (
          <AdjustForm
            key={adjusting.variantId}
            row={adjusting}
            onCancel={() => setAdjusting(null)}
            onDone={() => {
              setAdjusting(null);
              inventory.refresh({ silent: true });
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function AdjustForm({ row, onCancel, onDone }: { row: InventoryRow; onCancel: () => void; onDone: () => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("received");
  const [saving, setSaving] = useState(false);
  const n = Number(delta);
  const valid = delta.trim() !== "" && Number.isInteger(n) && n !== 0 && row.onHand + n >= 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await mockApi.adjustInventory(workspaceId, row.variantId, n);
      toast.success(`${n > 0 ? "+" : ""}${n} units (${reason}) applied.`);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-ink-soft">
        On hand now <span className="font-medium text-ink">{row.onHand}</span>
        {valid && (
          <>
            {" "}→ <span className="font-medium text-ink">{row.onHand + n}</span>
          </>
        )}
      </p>
      <Field label="Quantity change" required hint="Positive to add stock, negative to remove.">
        {({ id, ...aria }) => <Input id={id} {...aria} type="number" step={1} value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="+10 or -3" autoFocus />}
      </Field>
      <Field label="Reason" required>
        {({ id }) => (
          <Select id={id} value={reason} onChange={(e) => setReason(e.target.value as (typeof REASONS)[number]["value"])}>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !valid}>
          {saving ? "Applying…" : "Apply adjustment"}
        </Button>
      </div>
    </form>
  );
}

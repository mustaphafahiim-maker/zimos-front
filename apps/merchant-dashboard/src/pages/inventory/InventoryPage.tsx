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
import { fmt, useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Inventory",
    description: "Stock levels per variant, with reservations from unfulfilled orders.",
    kpiSkus: "SKUs",
    kpiUnits: "Units on hand",
    kpiLow: "Low stock",
    kpiLowHint: "At or below threshold",
    kpiValue: "Inventory value",
    kpiValueHint: "Available × cost",
    searchPlaceholder: "Search product, variant or SKU…",
    lowOnly: "Low stock only",
    empty: "No variants match.",
    colProduct: "Product",
    colVariant: "Variant",
    colSku: "SKU",
    colOnHand: "On hand",
    colReserved: "Reserved",
    colAvailable: "Available",
    colLowAt: "Low at",
    colCost: "Cost",
    colStockValue: "Stock value",
    colLowThreshold: "Low stock threshold",
    thresholdAria: "Low stock threshold for {product} {variant}",
    adjust: "Adjust",
    adjustTitle: "Adjust stock",
    thresholdUpdated: "Threshold updated.",
    onHandNow: "On hand now",
    quantityChange: "Quantity change",
    quantityHint: "Positive to add stock, negative to remove.",
    quantityPlaceholder: "+10 or -3",
    reason: "Reason",
    applying: "Applying…",
    applyAdjustment: "Apply adjustment",
    adjustApplied: "{delta} units ({reason}) applied.",
  },
  ar: {
    title: "المخزون",
    description: "مستويات المخزون لكل متغيّر، مع الكميات المحجوزة للطلبات غير المشحونة.",
    kpiSkus: "SKU",
    kpiUnits: "الوحدات المتوفرة",
    kpiLow: "مخزون منخفض",
    kpiLowHint: "عند الحد الأدنى أو أقل",
    kpiValue: "قيمة المخزون",
    kpiValueHint: "المتاح × التكلفة",
    searchPlaceholder: "ابحث بالمنتج أو المتغيّر أو SKU…",
    lowOnly: "المخزون المنخفض فقط",
    empty: "لا توجد متغيّرات مطابقة.",
    colProduct: "المنتج",
    colVariant: "المتغيّر",
    colSku: "SKU",
    colOnHand: "في المخزن",
    colReserved: "محجوز",
    colAvailable: "متاح",
    colLowAt: "حد التنبيه",
    colCost: "التكلفة",
    colStockValue: "قيمة المخزون",
    colLowThreshold: "حد المخزون المنخفض",
    thresholdAria: "حد المخزون المنخفض لـ {product} {variant}",
    adjust: "تعديل",
    adjustTitle: "تعديل المخزون",
    thresholdUpdated: "تم تحديث حد التنبيه.",
    onHandNow: "المتوفر حاليًا",
    quantityChange: "تغيير الكمية",
    quantityHint: "رقم موجب لإضافة مخزون، وسالب للخصم.",
    quantityPlaceholder: "+10 أو -3",
    reason: "السبب",
    applying: "جارٍ التطبيق…",
    applyAdjustment: "تطبيق التعديل",
    adjustApplied: "تم تطبيق {delta} وحدة ({reason}).",
  },
} satisfies Messages;

type StockStatus = "in_stock" | "low" | "out";

function stockStatus(r: InventoryRow): StockStatus {
  if (r.available <= 0) return "out";
  if (r.available <= r.lowStockThreshold) return "low";
  return "in_stock";
}

const STATUS_CLASS: Record<StockStatus, string> = {
  in_stock: "bg-success-soft text-success",
  low: "bg-warning-soft text-warning",
  out: "bg-danger-soft text-danger",
};

const STATUS_LABEL: Record<Locale, Record<StockStatus, string>> = {
  en: { in_stock: "In stock", low: "Low", out: "Out" },
  ar: { in_stock: "متوفر", low: "منخفض", out: "نفد" },
};

const REASON_VALUES = ["received", "damaged", "correction", "returned"] as const;
type Reason = (typeof REASON_VALUES)[number];

const REASON_LABEL: Record<Locale, Record<Reason, string>> = {
  en: { received: "Received", damaged: "Damaged", correction: "Correction", returned: "Returned" },
  ar: { received: "استلام بضاعة", damaged: "تالف", correction: "تصحيح جرد", returned: "مرتجع" },
};

function stockValue(r: InventoryRow): number {
  return r.costAmount ? Math.max(r.available, 0) * Number(r.costAmount) : 0;
}

function csvCell(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function InventoryPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
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
    toast.success(t.thresholdUpdated);
  }

  function exportCsv() {
    const header = [t.colProduct, t.colVariant, t.colSku, t.colOnHand, t.colReserved, t.colAvailable, t.colLowThreshold, t.colCost, t.colStockValue];
    const lines = filtered.map((r) =>
      [r.productName, r.variantLabel, r.sku, r.onHand, r.reserved, r.available, r.lowStockThreshold, r.costAmount, stockValue(r)].map(csvCell).join(",")
    );
    const blob = new Blob(["﻿" + [header.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
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
        title={t.title}
        description={t.description}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download /> {c.exportCsv}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t.kpiSkus} value={<bdi>{kpis.skus.toLocaleString()}</bdi>} icon={<Layers />} />
        <KpiCard label={t.kpiUnits} value={<bdi>{kpis.units.toLocaleString()}</bdi>} icon={<Boxes />} />
        <KpiCard label={t.kpiLow} value={<bdi>{kpis.low.toLocaleString()}</bdi>} hint={t.kpiLowHint} icon={<AlertTriangle />} />
        <KpiCard label={t.kpiValue} value={<bdi dir="ltr">{formatMoney(kpis.value, "EGP")}</bdi>} hint={t.kpiValueHint} icon={<Wallet />} />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input placeholder={t.searchPlaceholder} aria-label={c.search} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:max-w-xs" dir="auto" />
        <label className="flex items-center gap-2 text-sm text-ink">
          <Toggle checked={lowOnly} onChange={setLowOnly} /> {t.lowOnly}
        </label>
      </div>

      <DataState loading={inventory.loading} error={inventory.error} empty={filtered.length === 0} emptyMessage={t.empty} onRetry={() => inventory.refresh()}>
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-start text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 text-start font-medium">{t.colProduct}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colVariant}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colSku}</th>
                <th className="px-4 py-3 text-end font-medium">{t.colOnHand}</th>
                <th className="px-4 py-3 text-end font-medium">{t.colReserved}</th>
                <th className="px-4 py-3 text-end font-medium">{t.colAvailable}</th>
                <th className="px-4 py-3 text-end font-medium">{t.colLowAt}</th>
                <th className="px-4 py-3 text-end font-medium">{t.colCost}</th>
                <th className="px-4 py-3 text-end font-medium">{t.colStockValue}</th>
                <th className="px-4 py-3 text-start font-medium">{c.status}</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">{c.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const st = stockStatus(r);
                return (
                  <tr key={r.variantId} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-4 py-3 font-medium text-ink" dir="auto">{r.productName}</td>
                    <td className="px-4 py-3 text-ink-soft" dir="auto">{r.variantLabel}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                      <bdi dir="ltr">{r.sku ?? "—"}</bdi>
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink">{r.onHand}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink-soft">{r.reserved}</td>
                    <td className="px-4 py-3 text-end tabular-nums font-medium text-ink">{r.available}</td>
                    <td className="px-4 py-3 text-end">
                      <Input
                        type="number"
                        min={0}
                        dir="ltr"
                        aria-label={fmt(t.thresholdAria, { product: r.productName, variant: r.variantLabel })}
                        value={thresholdDraft[r.variantId] ?? String(r.lowStockThreshold)}
                        onChange={(e) => setThresholdDraft((p) => ({ ...p, [r.variantId]: e.target.value }))}
                        onBlur={() => commitThreshold(r)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        className="ms-auto h-8 w-20 text-end"
                      />
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink-soft">
                      <bdi dir="ltr">{r.costAmount ? formatMoney(r.costAmount, "EGP") : "—"}</bdi>
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink">
                      <bdi dir="ltr">{formatMoney(stockValue(r), "EGP")}</bdi>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_CLASS[st])}>{STATUS_LABEL[locale][st]}</span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button size="sm" variant="ghost" onClick={() => setAdjusting(r)}>
                        {t.adjust}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataState>

      <Modal open={adjusting !== null} onClose={() => setAdjusting(null)} title={t.adjustTitle} description={adjusting ? `${adjusting.productName} · ${adjusting.variantLabel}` : undefined}>
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
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<Reason>("received");
  const [saving, setSaving] = useState(false);
  const n = Number(delta);
  const valid = delta.trim() !== "" && Number.isInteger(n) && n !== 0 && row.onHand + n >= 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await mockApi.adjustInventory(workspaceId, row.variantId, n);
      toast.success(fmt(t.adjustApplied, { delta: `${n > 0 ? "+" : ""}${n}`, reason: REASON_LABEL[locale][reason] }));
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-ink-soft">
        {t.onHandNow} <span className="font-medium tabular-nums text-ink">{row.onHand}</span>
        {valid && (
          <>
            {" "}
            <span className="inline-block rtl:rotate-180">→</span> <span className="font-medium tabular-nums text-ink">{row.onHand + n}</span>
          </>
        )}
      </p>
      <Field label={t.quantityChange} required hint={t.quantityHint}>
        {({ id, ...aria }) => <Input id={id} {...aria} type="number" step={1} dir="ltr" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder={t.quantityPlaceholder} autoFocus />}
      </Field>
      <Field label={t.reason} required>
        {({ id }) => (
          <Select id={id} value={reason} onChange={(e) => setReason(e.target.value as Reason)}>
            {REASON_VALUES.map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[locale][r]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving || !valid}>
          {saving ? t.applying : t.applyAdjustment}
        </Button>
      </div>
    </form>
  );
}

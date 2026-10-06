import { useMemo, useState, type ReactNode } from "react";
import { Table2 } from "lucide-react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  catalogBulkUpdateVariants,
  isApiErrorCode,
  type CatalogVariantRowPatch,
  type Variant,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { majorToMinor, minorToMajorInput } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

/**
 * "Variant control" (SPEC §7.2): every variant of the product in one table —
 * price, compare-at, cost, stock, SKU, active/hidden — with multi-select and
 * "apply a value to the selected rows". Saved in one request; only the cells
 * that changed are sent.
 */

const STRINGS = {
  en: {
    open: "Edit all variants in a table",
    title: "Variant control",
    description: "Edit every variant at once. Tick rows to fill a column for all of them.",
    variant: "Variant",
    price: "Price",
    compareAt: "Compare-at",
    cost: "Cost",
    stock: "Stock",
    sku: "SKU",
    active: "Active",
    selectAll: "Select all variants",
    selectRow: "Select {name}",
    defaultVariant: "Default",
    applyTo: "Apply to {count} selected",
    column: "Column",
    value: "Value",
    apply: "Apply",
    status_active: "Active",
    status_archived: "Hidden",
    invalid: "Some cells are not valid numbers. Fix the highlighted cells.",
    skuTaken: "One of these SKUs is already used by another variant.",
    cancel: "Cancel",
    save: "Save {count} changes",
    noChanges: "No changes",
    saving: "Saving…",
    saved: "{count} variants updated.",
  },
  ar: {
    open: "تعديل كل المتغيرات في جدول",
    title: "التحكم في المتغيرات",
    description: "عدّل كل المتغيرات مرة واحدة. حدّد صفوفًا لملء عمود لها كلها.",
    variant: "المتغير",
    price: "السعر",
    compareAt: "قبل الخصم",
    cost: "التكلفة",
    stock: "المخزون",
    sku: "SKU",
    active: "نشط",
    selectAll: "تحديد كل المتغيرات",
    selectRow: "تحديد {name}",
    defaultVariant: "الافتراضي",
    applyTo: "تطبيق على {count} محدد",
    column: "العمود",
    value: "القيمة",
    apply: "تطبيق",
    status_active: "نشط",
    status_archived: "مخفي",
    invalid: "بعض الخانات ليست أرقامًا صحيحة. صحّح الخانات المظللة.",
    skuTaken: "أحد رموز SKU مستخدم لمتغير آخر.",
    cancel: "إلغاء",
    save: "حفظ {count} تغيير",
    noChanges: "لا توجد تغييرات",
    saving: "جارٍ الحفظ…",
    saved: "تم تحديث {count} متغير.",
  },
} satisfies Messages;

interface Row {
  id: string;
  name: string;
  price: string;
  compareAt: string;
  cost: string;
  stock: string;
  sku: string;
  active: boolean;
}

type MoneyColumn = "price" | "compareAt" | "cost";
type FillColumn = MoneyColumn | "stock" | "active";

function rowOf(variant: Variant, fallback: string): Row {
  return {
    id: variant.id,
    name: Object.values(variant.optionValues ?? {}).filter(Boolean).join(" / ") || variant.sku || fallback,
    price: minorToMajorInput(variant.priceAmount),
    compareAt: minorToMajorInput(variant.compareAtAmount),
    cost: minorToMajorInput(variant.costAmount),
    stock: String(variant.stockOnHand),
    sku: variant.sku ?? "",
    active: variant.status === "active",
  };
}

/** The patch for one row, or "invalid" when a cell cannot be read. Null when nothing changed. */
function diff(row: Row, original: Row): CatalogVariantRowPatch | null | "invalid" {
  const patch: CatalogVariantRowPatch = { id: row.id };
  let changed = false;
  if (row.price !== original.price) {
    const value = majorToMinor(row.price);
    if (!Number.isFinite(value) || value < 0) return "invalid";
    patch.priceAmount = value;
    changed = true;
  }
  for (const [key, field] of [
    ["compareAt", "compareAtAmount"],
    ["cost", "costAmount"],
  ] as const) {
    if (row[key] === original[key]) continue;
    if (row[key].trim() === "") patch[field] = null;
    else {
      const value = majorToMinor(row[key]);
      if (!Number.isFinite(value) || value < 0) return "invalid";
      patch[field] = value;
    }
    changed = true;
  }
  if (row.stock !== original.stock) {
    const value = Number(row.stock);
    if (!Number.isInteger(value) || value < 0) return "invalid";
    patch.stockOnHand = value;
    changed = true;
  }
  if (row.sku.trim() !== original.sku) {
    patch.sku = row.sku.trim() || null;
    changed = true;
  }
  if (row.active !== original.active) {
    patch.status = row.active ? "active" : "archived";
    changed = true;
  }
  return changed ? patch : null;
}

export function VariantBulkEditor({
  productId,
  variants,
  onChanged,
  skuNote,
}: {
  productId: string;
  variants: Variant[];
  onChanged: () => void;
  /** A warning about the SKUs, shown above the table (handoff 181). */
  skuNote?: ReactNode;
}) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  if (variants.length === 0) return null;
  return (
    <div className="-mt-3 flex justify-end">
      <Button type="button" variant="outline" className="min-h-10" onClick={() => setOpen(true)}>
        <Table2 className="size-4" aria-hidden />
        {t.open}
      </Button>
      {open && (
        <EditorDialog
          productId={productId}
          variants={variants}
          skuNote={skuNote}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function EditorDialog({
  productId,
  variants,
  skuNote,
  onClose,
  onSaved,
}: {
  productId: string;
  variants: Variant[];
  skuNote?: ReactNode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const original = useMemo(() => variants.map((v) => rowOf(v, t.defaultVariant)), [variants, t.defaultVariant]);
  const [rows, setRows] = useState(original);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [fillColumn, setFillColumn] = useState<FillColumn>("price");
  const [fillValue, setFillValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patches = rows.map((row, i) => diff(row, original[i]));
  const invalid = new Set(rows.filter((_, i) => patches[i] === "invalid").map((r) => r.id));
  const changes = patches.filter((p): p is CatalogVariantRowPatch => p !== null && p !== "invalid");

  const set = (id: string, patch: Partial<Row>) =>
    setRows((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = selected.size === rows.length;

  function fill() {
    setRows((current) =>
      current.map((r) => {
        if (!selected.has(r.id)) return r;
        if (fillColumn === "active") return { ...r, active: fillValue !== "archived" };
        return { ...r, [fillColumn]: fillValue };
      })
    );
  }

  async function save() {
    if (invalid.size > 0) {
      setError(t.invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await catalogBulkUpdateVariants(apiClient, workspaceId, productId, changes);
      toast.success(fmt(t.saved, { count: result.updated }));
      onSaved();
    } catch (err) {
      setError(isApiErrorCode(err, "DUPLICATE_RESOURCE") ? t.skuTaken : errorMessage(err));
      setBusy(false);
    }
  }

  const cell = (row: Row, key: MoneyColumn | "stock", label: string) => (
    <td className="px-2 py-1.5">
      <Input
        aria-label={`${label} — ${row.name}`}
        type="number"
        inputMode="decimal"
        min={0}
        step={key === "stock" ? 1 : "0.01"}
        dir="ltr"
        value={row[key]}
        disabled={busy}
        onChange={(e) => set(row.id, { [key]: e.target.value })}
        className="h-9 w-24"
      />
    </td>
  );

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={t.title}
      description={t.description}
      className="max-w-5xl"
      footer={
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" disabled={busy || changes.length === 0} onClick={() => void save()}>
            {busy ? t.saving : changes.length === 0 ? t.noChanges : fmt(t.save, { count: changes.length })}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {skuNote}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-end gap-2 rounded-[0.5rem] bg-primary-soft px-3 py-2">
            <span className="self-center text-sm font-medium text-ink">{fmt(t.applyTo, { count: selected.size })}</span>
            <Select
              aria-label={t.column}
              value={fillColumn}
              className="h-9 w-36"
              onChange={(e) => {
                setFillColumn(e.target.value as FillColumn);
                setFillValue(e.target.value === "active" ? "active" : "");
              }}
            >
              <option value="price">{t.price}</option>
              <option value="compareAt">{t.compareAt}</option>
              <option value="cost">{t.cost}</option>
              <option value="stock">{t.stock}</option>
              <option value="active">{t.active}</option>
            </Select>
            {fillColumn === "active" ? (
              <Select aria-label={t.value} value={fillValue} className="h-9 w-32" onChange={(e) => setFillValue(e.target.value)}>
                <option value="active">{t.status_active}</option>
                <option value="archived">{t.status_archived}</option>
              </Select>
            ) : (
              <Input
                aria-label={t.value}
                type="number"
                inputMode="decimal"
                min={0}
                dir="ltr"
                value={fillValue}
                onChange={(e) => setFillValue(e.target.value)}
                className="h-9 w-28 bg-paper-raised"
              />
            )}
            <Button type="button" className="min-h-9" onClick={fill}>
              {t.apply}
            </Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-[0.5rem] border border-line">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-xs uppercase tracking-wide text-ink-soft">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    aria-label={t.selectAll}
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                  />
                </th>
                <th className="px-2 py-2 text-start font-medium">{t.variant}</th>
                <th className="px-2 py-2 text-start font-medium">{t.price}</th>
                <th className="px-2 py-2 text-start font-medium">{t.compareAt}</th>
                <th className="px-2 py-2 text-start font-medium">{t.cost}</th>
                <th className="px-2 py-2 text-start font-medium">{t.stock}</th>
                <th className="px-2 py-2 text-start font-medium">{t.sku}</th>
                <th className="px-2 py-2 text-start font-medium">{t.active}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-line last:border-0 ${invalid.has(row.id) ? "bg-danger-soft" : selected.has(row.id) ? "bg-primary-soft/50" : ""}`}
                >
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      aria-label={fmt(t.selectRow, { name: row.name })}
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                    />
                  </td>
                  <td className={`px-2 py-1.5 font-medium ${row.active ? "text-ink" : "text-ink-soft line-through"}`}>{row.name}</td>
                  {cell(row, "price", t.price)}
                  {cell(row, "compareAt", t.compareAt)}
                  {cell(row, "cost", t.cost)}
                  {cell(row, "stock", t.stock)}
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={`${t.sku} — ${row.name}`}
                      dir="ltr"
                      maxLength={100}
                      value={row.sku}
                      disabled={busy}
                      onChange={(e) => set(row.id, { sku: e.target.value })}
                      className="h-9 w-32"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      aria-label={`${t.active} — ${row.name}`}
                      checked={row.active}
                      disabled={busy}
                      onChange={(e) => set(row.id, { active: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

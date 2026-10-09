import { useEffect, useMemo, useState, type ReactNode } from "react";
import { IconTable } from "@/components/icons";
import { Alert, Button, Input, cn } from "@store-builder/ui";
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
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { useBulkTableOffered } from "../variants/bulkEntry";
import { FormSheet } from "../variants/FormSheet";

/**
 * "Variant control" (SPEC §7.2): every variant of the product in one table —
 * price, compare-at, cost, stock, SKU, active/hidden — with multi-select and
 * "apply a value to the selected rows". Saved in one request; only the cells
 * that changed are sent.
 *
 * It opens in a sheet (`VariantBulkSheet`), from «عدّل الكل في جدول» in the
 * head of the variants section. `VariantBulkEditor` is the same sheet behind
 * its own button, for a page that has no variants section.
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
    cellOf: "{column} — {name}",
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
    open: "عدّل كل المتغيرات في جدول",
    title: "التحكم في المتغيرات",
    description: "عدّل كل المتغيرات مرة واحدة. علّم على الصفوف عشان تملى عمود ليهم كلهم.",
    variant: "المتغير",
    price: "السعر",
    compareAt: "قبل الخصم",
    cost: "التكلفة",
    stock: "المخزون",
    sku: "SKU",
    active: "شغّال",
    selectAll: "اختار كل المتغيرات",
    selectRow: "اختار {name}",
    cellOf: "{column} — {name}",
    defaultVariant: "الافتراضي",
    applyTo: "طبّق على {count} متحدد",
    column: "العمود",
    value: "القيمة",
    apply: "طبّق",
    status_active: "شغّال",
    status_archived: "مخفي",
    invalid: "فيه خانات مش أرقام صحيحة. صحّح الخانات المتعلّم عليها.",
    skuTaken: "فيه SKU من دول مستخدم لمتغير تاني.",
    cancel: "إلغاء",
    save: "احفظ {count} تغيير",
    noChanges: "مفيش تغييرات",
    saving: "بنحفظ…",
    saved: "{count} متغير اتحدّث.",
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
  // The variants section opens this table from its own head. Beside such a section the button would be a second
  // door to the same room, so it waits one beat to hear from the section, and stays out if there is one.
  const offered = useBulkTableOffered(productId);
  const [settled, setSettled] = useState(false);
  useEffect(() => setSettled(true), []);

  if (variants.length === 0 || offered || !settled) return null;
  return (
    <div className="flex justify-end">
      <Button type="button" variant="outline" className="min-h-11 rounded-full px-4 md:min-h-10" onClick={() => setOpen(true)}>
        <IconTable className="size-4" aria-hidden />
        {t.open}
      </Button>
      <VariantBulkSheet
        open={open}
        onClose={() => setOpen(false)}
        productId={productId}
        variants={variants}
        skuNote={skuNote}
        onSaved={() => {
          setOpen(false);
          onChanged();
        }}
      />
    </div>
  );
}

/** The 44px target of a tick box on a touch screen; under a mouse the box keeps a table's tight rhythm. */
const TICK = "flex size-9 cursor-pointer items-center justify-center pointer-coarse:size-11";
const HEAD = "px-2 py-2.5 text-start font-medium whitespace-nowrap";

/**
 * The table itself, in a sheet: a bottom sheet on the phone, a wide centred
 * pane on a desktop. Once a cell was typed in, closing it by a stray tap,
 * Escape or a pull down first asks whether to leave the edits (FormSheet).
 * Every open starts from the variants as they are saved.
 */
export function VariantBulkSheet({
  open,
  onClose,
  productId,
  variants,
  skuNote,
  onSaved,
}: {
  open: boolean;
  /** The sheet asks to close without saving. */
  onClose: () => void;
  productId: string;
  variants: Variant[];
  skuNote?: ReactNode;
  /** The changes are saved: close the sheet and reload the product. */
  onSaved: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const original = useMemo(() => variants.map((v) => rowOf(v, t.defaultVariant)), [variants, t.defaultVariant]);
  const originalById = useMemo(() => new Map(original.map((row) => [row.id, row])), [original]);
  const [rows, setRows] = useState(original);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [fillColumn, setFillColumn] = useState<FillColumn>("price");
  const [fillValue, setFillValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The sheet stays mounted while closed (so it can slide away): each opening starts over from what is saved.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setRows(original);
      setSelected(new Set());
      setFillColumn("price");
      setFillValue("");
      setBusy(false);
      setError(null);
    }
  }

  const patches = rows.map((row) => {
    const was = originalById.get(row.id);
    return was ? diff(row, was) : null;
  });
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
  const allSelected = rows.length > 0 && selected.size === rows.length;

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
        aria-label={fmt(t.cellOf, { column: label, name: row.name })}
        type="number"
        inputMode={key === "stock" ? "numeric" : "decimal"}
        min={0}
        step={key === "stock" ? 1 : "0.01"}
        dir="ltr"
        value={row[key]}
        disabled={busy}
        onChange={(e) => set(row.id, { [key]: e.target.value })}
        className="h-9 w-24 tabular-nums pointer-coarse:h-11"
      />
    </td>
  );

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={t.title}
      description={t.description}
      size="lg"
      locked={busy}
      className="lg:max-w-[58rem]"
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" className="rounded-full px-5" disabled={busy || changes.length === 0} onClick={() => void save()}>
            {busy ? t.saving : changes.length === 0 ? t.noChanges : fmt(t.save, { count: changes.length })}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {skuNote}
        {selected.size > 0 && (
          <div className="zimos-variant-fill flex flex-wrap items-end gap-2 rounded-[0.875rem] bg-primary-soft px-3 py-2">
            <span className="self-center text-sm font-medium text-ink">{fmt(t.applyTo, { count: selected.size })}</span>
            <Select
              aria-label={t.column}
              value={fillColumn}
              className="h-9 w-36 pointer-coarse:h-11"
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
              <Select aria-label={t.value} value={fillValue} className="h-9 w-32 pointer-coarse:h-11" onChange={(e) => setFillValue(e.target.value)}>
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
                className="h-9 w-28 bg-paper-raised tabular-nums pointer-coarse:h-11"
              />
            )}
            <Button type="button" className="min-h-9 rounded-full px-4 pointer-coarse:min-h-11" onClick={fill}>
              {t.apply}
            </Button>
          </div>
        )}

        <div data-slot="variant-bulk" className="zimos-variant-bulk overflow-x-auto rounded-[1.25rem] bg-paper-raised ring-1 ring-line">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">{t.title}</caption>
            <thead>
              <tr className="border-b border-line bg-paper-sunken/60 text-xs text-ink-soft">
                <th scope="col" className="w-10 py-1 ps-2 pe-0">
                  <label className={TICK}>
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-primary"
                      aria-label={t.selectAll}
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                    />
                  </label>
                </th>
                <th scope="col" className={HEAD}>
                  {t.variant}
                </th>
                <th scope="col" className={HEAD}>
                  {t.price}
                </th>
                <th scope="col" className={HEAD}>
                  {t.compareAt}
                </th>
                <th scope="col" className={HEAD}>
                  {t.cost}
                </th>
                <th scope="col" className={HEAD}>
                  {t.stock}
                </th>
                <th scope="col" className={HEAD}>
                  {t.sku}
                </th>
                <th scope="col" className={HEAD}>
                  {t.active}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  data-invalid={invalid.has(row.id) ? "" : undefined}
                  data-selected={selected.has(row.id) ? "" : undefined}
                  className={cn("border-b border-line last:border-0", invalid.has(row.id) ? "bg-danger-soft" : selected.has(row.id) ? "bg-primary-soft/50" : "")}
                >
                  <td className="py-1 ps-2 pe-0">
                    <label className={TICK}>
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-primary"
                        aria-label={fmt(t.selectRow, { name: row.name })}
                        checked={selected.has(row.id)}
                        onChange={() => toggle(row.id)}
                      />
                    </label>
                  </td>
                  <th scope="row" className={cn("max-w-[14rem] px-2 py-1.5 text-start font-medium", row.active ? "text-ink" : "text-ink-soft line-through")}>
                    <bdi className="break-words">{row.name}</bdi>
                  </th>
                  {cell(row, "price", t.price)}
                  {cell(row, "compareAt", t.compareAt)}
                  {cell(row, "cost", t.cost)}
                  {cell(row, "stock", t.stock)}
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={fmt(t.cellOf, { column: t.sku, name: row.name })}
                      dir="ltr"
                      maxLength={100}
                      value={row.sku}
                      disabled={busy}
                      onChange={(e) => set(row.id, { sku: e.target.value })}
                      className="h-9 w-32 pointer-coarse:h-11"
                    />
                  </td>
                  <td className="py-1 ps-1 pe-2">
                    <label className={TICK}>
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-primary"
                        aria-label={fmt(t.cellOf, { column: t.active, name: row.name })}
                        checked={row.active}
                        disabled={busy}
                        onChange={(e) => set(row.id, { active: e.target.checked })}
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </FormSheet>
  );
}

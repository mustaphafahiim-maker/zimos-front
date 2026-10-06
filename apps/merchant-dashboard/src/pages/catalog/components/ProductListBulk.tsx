import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { catalogDuplicateProduct, type Product } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { ProductBulkEditDialog } from "./ProductBulkEditDialog";
import { ProductTransferDialog } from "./ProductTransferDialog";

/**
 * The product list's multi-select pieces (SPEC §7.5): the selection itself,
 * the bar that appears once something is ticked, the row checkbox, and the
 * per-row "Duplicate" button.
 */

const STRINGS = {
  en: {
    selected: "{count} selected",
    bulkEdit: "Bulk edit",
    clear: "Clear selection",
    selectAll: "Select all products on this page",
    selectAllShort: "Select all",
    selectRow: "Select {name}",
    transfer: "Import / export",
    duplicate: "Duplicate",
    duplicating: "Duplicating…",
    duplicated: "“{name}” created as a draft.",
  },
  ar: {
    selected: "تم تحديد {count}",
    bulkEdit: "تعديل جماعي",
    clear: "إلغاء التحديد",
    selectAll: "اختار كل المنتجات في الصفحة دي",
    selectAllShort: "اختار الكل",
    selectRow: "تحديد {name}",
    transfer: "استيراد / تصدير",
    duplicate: "نسخ",
    duplicating: "جارٍ النسخ…",
    duplicated: "تم إنشاء «{name}» كمسودة.",
  },
} satisfies Messages;

export interface ProductSelection {
  ids: ReadonlySet<string>;
  toggle: (id: string) => void;
  setAll: (ids: string[], on: boolean) => void;
  clear: () => void;
}

export function useProductSelection(): ProductSelection {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  return {
    ids,
    toggle: (id) =>
      setIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    setAll: (list, on) =>
      setIds((current) => {
        const next = new Set(current);
        for (const id of list) {
          if (on) next.add(id);
          else next.delete(id);
        }
        return next;
      }),
    clear: () => setIds(new Set()),
  };
}

/** The header checkbox: ticks or clears every product shown. */
export function SelectAllCheckbox({
  selection,
  products,
  withLabel,
}: {
  selection: ProductSelection;
  products: Product[];
  /** Phones: the words beside the box, not a lone 16 px square (re-audit N-25). */
  withLabel?: boolean;
}) {
  const t = useT(STRINGS);
  const all = products.length > 0 && products.every((p) => selection.ids.has(p.id));
  const box = (
    <input
      type="checkbox"
      className="size-4 cursor-pointer accent-primary"
      aria-label={withLabel ? undefined : t.selectAll}
      checked={all}
      onChange={() => selection.setAll(products.map((p) => p.id), !all)}
    />
  );
  if (!withLabel) return box;
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 pe-2">
      {box}
      <span>{t.selectAllShort}</span>
    </label>
  );
}

export function SelectRowCheckbox({ selection, product }: { selection: ProductSelection; product: Product }) {
  const t = useT(STRINGS);
  return (
    <input
      type="checkbox"
      className="size-4 cursor-pointer accent-primary"
      aria-label={fmt(t.selectRow, { name: product.name })}
      checked={selection.ids.has(product.id)}
      onChange={() => selection.toggle(product.id)}
    />
  );
}

/** Shown above the list while anything is ticked. */
export function ProductBulkBar({ selection, onDone }: { selection: ProductSelection; onDone: () => void }) {
  const t = useT(STRINGS);
  const [editing, setEditing] = useState(false);
  if (selection.ids.size === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-[0.5rem] border border-primary/30 bg-primary-soft px-4 py-2.5">
      <span className="text-sm font-semibold text-ink">{fmt(t.selected, { count: selection.ids.size })}</span>
      <Button type="button" size="sm" onClick={() => setEditing(true)}>
        {t.bulkEdit}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={selection.clear}>
        {t.clear}
      </Button>
      {editing && (
        <ProductBulkEditDialog
          productIds={[...selection.ids]}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            selection.clear();
            onDone();
          }}
        />
      )}
    </div>
  );
}

/** The header button that opens the import / export dialog. */
export function ProductTransferButton({ onImported }: { onImported: () => void }) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        {t.transfer}
      </Button>
      {open && <ProductTransferDialog onClose={() => setOpen(false)} onImported={onImported} />}
    </>
  );
}

/** Copies the product as a draft and opens the copy. */
export function DuplicateProductButton({ product }: { product: Product }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    if (busy) return;
    setBusy(true);
    try {
      const copy = await catalogDuplicateProduct(apiClient, workspaceId, product.id);
      toast.success(fmt(t.duplicated, { name: copy.name }));
      navigate(`/catalog/${copy.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void duplicate()}>
      {busy ? t.duplicating : t.duplicate}
    </Button>
  );
}

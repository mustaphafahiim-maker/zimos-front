import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@store-builder/ui";
import {
  catalogCountProducts,
  catalogDuplicateProduct,
  type CatalogProductFilters,
  type Product,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { ProductBulkEditDialog } from "./ProductBulkEditDialog";
import { ProductBulkDeleteDialog } from "./ProductBulkDeleteDialog";
import { ProductTransferDialog } from "./ProductTransferDialog";
import type { BulkDeleteTarget } from "./bulkDelete";

/**
 * The product list's multi-select pieces (SPEC §7.5): the selection itself,
 * the bar that appears once something is ticked, the row checkbox, and the
 * per-row "Duplicate" button. With the whole page ticked and more products
 * beyond it, the bar offers every product the list's filters match, on every
 * page — the bulk delete takes that; the bulk edit works on ticked rows.
 */

const STRINGS = {
  en: {
    selected: "{count} selected",
    selectedEverything: "All {count} selected",
    bulkEdit: "Bulk edit",
    delete: "Delete",
    clear: "Clear selection",
    selectAll: "Select all products on this page",
    selectRow: "Select {name}",
    pageSelected: "All {count} products on this page are selected.",
    selectEverything: "Select all {count} products in the store",
    selectMatching: "Select all {count} matching products",
    transfer: "Import / export",
    duplicate: "Duplicate",
    duplicating: "Duplicating…",
    duplicated: "“{name}” created as a draft.",
  },
  ar: {
    selected: "تم تحديد {count}",
    selectedEverything: "تم تحديد كل المنتجات ({count})",
    bulkEdit: "تعديل جماعي",
    delete: "حذف",
    clear: "إلغاء التحديد",
    selectAll: "تحديد كل المنتجات في هذه الصفحة",
    selectRow: "تحديد {name}",
    pageSelected: "تم تحديد كل منتجات هذه الصفحة ({count}).",
    selectEverything: "تحديد كل {count} منتج في المتجر",
    selectMatching: "تحديد كل {count} منتج مطابق",
    transfer: "استيراد / تصدير",
    duplicate: "نسخ",
    duplicating: "جارٍ النسخ…",
    duplicated: "تم إنشاء «{name}» كمسودة.",
  },
} satisfies Messages;

/** Every product the list's filters matched when they were counted (catalogCountProducts). */
export interface CountedProducts {
  count: number;
  asOf: string;
}

export interface ProductSelection {
  ids: ReadonlySet<string>;
  /** "All N": every product the list's tab and filters match, on every page; null while the ticked rows are the selection. */
  everything: CountedProducts | null;
  toggle: (id: string) => void;
  setAll: (ids: string[], on: boolean) => void;
  clear: () => void;
  selectEverything: (counted: CountedProducts) => void;
}

/**
 * `scope` names the list's tab and filters: "all N" holds only for the scope
 * it was chosen in. Ticking or unticking any row goes back to ticked rows.
 */
export function useProductSelection(scope = ""): ProductSelection {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  const [everything, setEverything] = useState<(CountedProducts & { scope: string }) | null>(null);
  // Another tab or filter: "all N" meant the products of the old one.
  if (everything && everything.scope !== scope) setEverything(null);
  return {
    ids,
    everything: everything && everything.scope === scope ? { count: everything.count, asOf: everything.asOf } : null,
    toggle: (id) => {
      setEverything(null);
      setIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    setAll: (list, on) => {
      setEverything(null);
      setIds((current) => {
        const next = new Set(current);
        for (const id of list) {
          if (on) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    clear: () => {
      setEverything(null);
      setIds(new Set());
    },
    selectEverything: (counted) => setEverything({ ...counted, scope }),
  };
}

/** The header checkbox: ticks or clears every product shown. */
export function SelectAllCheckbox({ selection, products }: { selection: ProductSelection; products: Product[] }) {
  const t = useT(STRINGS);
  const all = products.length > 0 && (selection.everything !== null || products.every((p) => selection.ids.has(p.id)));
  return (
    <input
      type="checkbox"
      className="size-4 cursor-pointer accent-primary"
      aria-label={t.selectAll}
      checked={all}
      onChange={() => selection.setAll(products.map((p) => p.id), !all)}
    />
  );
}

export function SelectRowCheckbox({ selection, product }: { selection: ProductSelection; product: Product }) {
  const t = useT(STRINGS);
  return (
    <input
      type="checkbox"
      className="size-4 cursor-pointer accent-primary"
      aria-label={fmt(t.selectRow, { name: product.name })}
      checked={selection.everything !== null || selection.ids.has(product.id)}
      onChange={() => selection.toggle(product.id)}
    />
  );
}

interface BulkBarProps {
  selection: ProductSelection;
  onDone: () => void;
  /** The rows loaded so far, and whether the list has more. */
  products: Product[];
  hasMore: boolean;
  /** The list's tab and filters, as the count and the bulk delete take them. */
  filters: CatalogProductFilters;
  filtersKey: string;
  /** A tab or filter narrows the list: "matching products", not "in the store". */
  narrowed: boolean;
  /** The Archived tab: deleting is for good only, as for one archived product. */
  archivedTab: boolean;
}

/** Shown above the list while anything is ticked. */
export function ProductBulkBar({ selection, onDone, products, hasMore, filters, filtersKey, narrowed, archivedTab }: BulkBarProps) {
  const t = useT(STRINGS);
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const everything = selection.everything;
  const size = everything ? everything.count : selection.ids.size;
  if (size === 0) return null;

  const pageSelected = products.length > 0 && products.every((p) => selection.ids.has(p.id));
  const target: BulkDeleteTarget = everything
    ? { kind: "filter", filter: filters, count: everything.count, asOf: everything.asOf }
    : { kind: "ids", ids: [...selection.ids] };
  const finish = () => {
    setDialog(null);
    selection.clear();
    onDone();
  };

  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3 rounded-[0.5rem] border border-primary/30 bg-primary-soft px-4 py-2.5">
        <span className="text-sm font-semibold text-ink">
          {fmt(everything ? t.selectedEverything : t.selected, { count: size })}
        </span>
        {!everything && (
          <Button type="button" size="sm" onClick={() => setDialog("edit")}>
            {t.bulkEdit}
          </Button>
        )}
        <Button type="button" size="sm" variant="danger" onClick={() => setDialog("delete")}>
          {t.delete}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={selection.clear}>
          {t.clear}
        </Button>
      </div>
      {!everything && pageSelected && hasMore && (
        <SelectEverything
          pageCount={products.length}
          filters={filters}
          filtersKey={filtersKey}
          narrowed={narrowed}
          onSelect={selection.selectEverything}
        />
      )}
      {dialog === "edit" && (
        <ProductBulkEditDialog productIds={[...selection.ids]} onClose={() => setDialog(null)} onDone={finish} />
      )}
      {dialog === "delete" && (
        <ProductBulkDeleteDialog target={target} archivedOnly={archivedTab} onClose={() => setDialog(null)} onDone={finish} />
      )}
    </div>
  );
}

/** "All 50 on this page are selected. Select all N products in the store" — N counted across every page. */
function SelectEverything({
  pageCount,
  filters,
  filtersKey,
  narrowed,
  onSelect,
}: {
  pageCount: number;
  filters: CatalogProductFilters;
  filtersKey: string;
  narrowed: boolean;
  onSelect: (counted: CountedProducts) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const counted = useAsync(() => catalogCountProducts(apiClient, workspaceId, filters), [workspaceId, filtersKey]);
  const data = counted.data;
  // Without the count there is nothing more to offer than the page.
  if (!data || data.count <= pageCount) return null;
  return (
    <p className="px-1 text-sm text-ink" data-slot="select-everything">
      {fmt(t.pageSelected, { count: pageCount })}{" "}
      <button
        type="button"
        className="cursor-pointer font-medium text-primary underline hover:no-underline"
        onClick={() => onSelect(data)}
      >
        {fmt(narrowed ? t.selectMatching : t.selectEverything, { count: data.count })}
      </button>
    </p>
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

import { useCallback, useMemo, useState } from "react";
import { IconEdit } from "@/components/icons";
import { BulkBar, type BulkAction } from "@/components/list";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { pluralOf } from "@/lib/plural";
import { ProductBulkEditDialog } from "./ProductBulkEditDialog";

/**
 * The product list's multi-select pieces (SPEC §7.5): the selection itself
 * and the bar that rises once something is ticked. The bar is the list kit's
 * (components/list/BulkBar.tsx); what it does is what the list always did in
 * bulk — the bulk edit dialog (status, shipping, collection, price), which
 * the server applies to all the selected products or to none.
 */

const STRINGS = {
  en: {
    selected_one: "1 product selected",
    selected_other: "{n} products selected",
    bulkEdit: "Bulk edit",
    selectShown: "Select all {n} shown",
    shownSelected: "All {n} shown are selected.",
  },
  ar: {
    selected_one: "منتج واحد متحدد",
    selected_two: "منتجين متحددين",
    selected_few: "{n} منتجات متحددة",
    selected_other: "{n} منتج متحدد",
    bulkEdit: "تعديل جماعي",
    selectShown: "اختار كل اللي ظاهر ({n})",
    shownSelected: "كل اللي ظاهر متحدد ({n}).",
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
  const toggle = useCallback(
    (id: string) =>
      setIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    []
  );
  const setAll = useCallback(
    (list: string[], on: boolean) =>
      setIds((current) => {
        const next = new Set(current);
        for (const id of list) {
          if (on) next.add(id);
          else next.delete(id);
        }
        return next;
      }),
    []
  );
  const clear = useCallback(() => setIds((current) => (current.size === 0 ? current : new Set())), []);
  return useMemo(() => ({ ids, toggle, setAll, clear }), [ids, toggle, setAll, clear]);
}

const LINK =
  "inline-flex min-h-8 cursor-pointer items-center rounded-full font-semibold text-primary-dark underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-coarse:min-h-11 dark:text-primary";

/**
 * The bar over the list while anything is ticked: how many, «تعديل جماعي»,
 * and a way to take every product shown — the one way to select all on a
 * phone and in the grid, where there is no table head to tick.
 */
export function ProductBulkBar({
  selection,
  shownIds,
  onDone,
  onClear,
}: {
  selection: ProductSelection;
  /** The products on screen, in order. */
  shownIds: readonly string[];
  /** The bulk edit went through: the list is out of date. */
  onDone: () => void;
  /** The selection was let go from the bar (also turns «حدّد» off). */
  onClear: () => void;
}) {
  const t = useT(STRINGS);
  const [editing, setEditing] = useState(false);
  const count = selection.ids.size;
  const allShown = shownIds.length > 0 && shownIds.every((id) => selection.ids.has(id));

  const actions: BulkAction[] = [{ id: "edit", label: t.bulkEdit, icon: IconEdit, onSelect: () => setEditing(true) }];

  return (
    <>
      <BulkBar
        count={count}
        label={pluralOf(t, "selected", count)}
        onClear={onClear}
        actions={actions}
        extra={
          shownIds.length > 1 ? (
            allShown ? (
              <span role="status">{fmt(t.shownSelected, { n: shownIds.length })}</span>
            ) : (
              <button type="button" className={LINK} onClick={() => selection.setAll([...shownIds], true)}>
                {fmt(t.selectShown, { n: shownIds.length })}
              </button>
            )
          ) : undefined
        }
      />
      {editing && (
        <ProductBulkEditDialog
          productIds={[...selection.ids]}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            onClear();
            onDone();
          }}
        />
      )}
    </>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@store-builder/ui";
import type { CatalogEntityStatus, Variant } from "@store-builder/api-client";
import { EditInPlace } from "@/components/EditInPlace";
import { useToast } from "@/components/Toast";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, majorToMinor } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { useCatalogLabels } from "../catalogLabels";
import { SwitchTrack } from "./SwitchTrack";
import type { VariantEdits } from "./useVariantEdits";
import { VARIANT_STRINGS } from "./variantStrings";
import { SKU_MAX, plainAmount } from "./variantValues";

/**
 * The figures of a variant, each changed where it is shown (`EditInPlace`:
 * press the figure, type, Enter — the new value shows at once, a toast offers
 * «تراجع», and a save that fails puts the old value back and says why). The
 * grid and the phone cards draw the same cells.
 */

/** What every editable figure of the grid shares: a cell that lights up under the pointer and wears a ring while it is being edited. */
const CELL =
  "zimos-variant-cell min-h-9 hover:bg-paper-sunken data-[popup-open]:bg-paper-sunken data-[popup-open]:ring-2 data-[popup-open]:ring-primary/50 focus-visible:-outline-offset-1";

const DASH = <span className="text-ink-soft">—</span>;

interface CellProps {
  variant: Variant;
  edits: VariantEdits;
  className?: string;
}

/** The price shoppers pay. It cannot be emptied. */
export function PriceCell({ variant, edits, className }: CellProps) {
  const t = useT(VARIANT_STRINGS);
  return (
    <EditInPlace
      kind="money"
      label={t.colPrice}
      value={plainAmount(variant.priceAmount)}
      format={(value) => <span className="tabular-nums">{formatMoney(majorToMinor(value), variant.currency)}</span>}
      validate={(next) => (next === "" ? t.priceRequired : null)}
      onSave={(next) => edits.price(variant, next)}
      undoMessage={t.priceSaved}
      className={cn(CELL, "font-semibold text-ink", className)}
    />
  );
}

/** The price before the discount, shown struck through in the store. Emptying the field clears it. */
export function CompareAtCell({ variant, edits, className }: CellProps) {
  const t = useT(VARIANT_STRINGS);
  return (
    <EditInPlace
      kind="money"
      label={t.colCompareAt}
      value={plainAmount(variant.compareAtAmount)}
      format={(value) => (value === "" ? DASH : <span className="tabular-nums">{formatMoney(majorToMinor(value), variant.currency)}</span>)}
      onSave={(next) => edits.compareAt(variant, next)}
      undoMessage={t.compareSaved}
      className={cn(CELL, "text-ink-soft", className)}
    />
  );
}

/** The SKU: Latin letters and digits, so it always reads left to right. Emptying the field clears it. */
export function SkuCell({ variant, edits, className }: CellProps) {
  const t = useT(VARIANT_STRINGS);
  return (
    <EditInPlace
      kind="text"
      label={t.colSku}
      value={variant.sku ?? ""}
      format={(value) => (value === "" ? DASH : <bdi dir="ltr">{value}</bdi>)}
      validate={(next) => (next.length > SKU_MAX ? fmt(t.skuTooLong, { max: SKU_MAX }) : null)}
      onSave={(next) => edits.sku(variant, next)}
      undoMessage={t.skuSaved}
      className={cn(CELL, "text-ink-soft", className)}
    />
  );
}

/** How many are on the shelf, and beside it how many of them orders are holding. Only for a product whose quantity is counted. */
export function StockCell({ variant, edits, className }: CellProps) {
  const t = useT(VARIANT_STRINGS);
  return (
    <span className="inline-flex max-w-full items-center gap-2">
      <EditInPlace
        kind="number"
        label={t.colStock}
        value={String(variant.stockOnHand)}
        format={(value) => (
          <bdi dir="ltr" className="tabular-nums">
            {fmt("{n}", { n: Number(value) })}
          </bdi>
        )}
        validate={(next) => (next === "" ? t.stockRequired : Number(next) < 0 ? t.stockNegative : null)}
        onSave={(next) => edits.stock(variant, next)}
        undoMessage={t.stockSaved}
        className={cn(CELL, "font-medium", variant.stockOnHand <= 0 ? "text-danger" : "text-ink", className)}
      />
      {variant.reservedStock > 0 && (
        <span className="text-xs whitespace-nowrap text-ink-soft">{fmt(t.reserved, { n: variant.reservedStock })}</span>
      )}
    </span>
  );
}

const OTHER: Record<CatalogEntityStatus, CatalogEntityStatus> = { active: "archived", archived: "active" };

/**
 * On sale or not, as a switch — the same field the variant form's «الحالة»
 * sets, through the same call. It flips at once, and the toast's «تراجع» flips
 * it back; if the server refuses, it returns by itself and a toast says why.
 */
export function StatusCell({ variant, edits, name, className }: CellProps & { name: string }) {
  const t = useT(VARIANT_STRINGS);
  const labels = useCatalogLabels();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  // What was just chosen, shown until the page's own value catches up. `base` is the status it was chosen over.
  const [flipped, setFlipped] = useState<{ to: CatalogEntityStatus; base: CatalogEntityStatus } | null>(null);
  if (flipped && flipped.base !== variant.status) setFlipped(null);
  const status = flipped ? flipped.to : variant.status;
  const on = status === "active";

  // «تراجع» is pressed seconds later, maybe after the row was drawn again: it answers through the latest props.
  const latest = useRef({ variant, edits, t, errorMessage });
  useEffect(() => {
    latest.current = { variant, edits, t, errorMessage };
  });

  const change = useCallback(
    async (to: CatalogEntityStatus, undoable: boolean): Promise<void> => {
      const now = latest.current;
      setFlipped({ to, base: now.variant.status });
      setBusy(true);
      try {
        await now.edits.status(now.variant, to);
      } catch (err) {
        setFlipped(null);
        setBusy(false);
        toast.error(fmt(now.t.statusFailed, { reason: now.errorMessage(err) }));
        return;
      }
      setBusy(false);
      if (undoable) toast.undo(to === "active" ? now.t.statusNowActive : now.t.statusNowArchived, () => change(OTHER[to], false));
    },
    [toast]
  );

  const withProduct = !on && variant.archivedWithProduct === true;

  return (
    <span className={cn("inline-flex max-w-full items-center gap-0.5", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={fmt(t.statusOf, { name })}
        aria-busy={busy || undefined}
        disabled={busy}
        onClick={() => void change(OTHER[status], true)}
        className="zimos-variant-switch group/sw relative inline-flex h-11 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none disabled:cursor-progress pointer-fine:h-9"
      >
        <SwitchTrack
          on={on}
          className="group-focus-visible/sw:outline-2 group-focus-visible/sw:outline-offset-2 group-focus-visible/sw:outline-primary group-active/sw:[&>span]:scale-[0.92] group-disabled/sw:opacity-70"
        />
      </button>
      <span className={cn("min-w-0 truncate text-[13px] leading-5", on ? "text-ink" : "text-ink-soft")}>
        {withProduct ? t.archivedWithProduct : labels.status(status)}
        {withProduct && <span className="sr-only"> {t.archivedWithProductHint}</span>}
      </span>
    </span>
  );
}

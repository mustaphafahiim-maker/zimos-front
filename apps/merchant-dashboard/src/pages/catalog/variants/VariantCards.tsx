import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { ContextMenu } from "@/components/ContextMenu";
import { useT } from "@/i18n/LocaleContext";
import { ItemMenu } from "../media/ItemMenu";
import { CompareAtCell, PriceCell, SkuCell, StatusCell, StockCell } from "./VariantCells";
import type { VariantListProps, VariantRow } from "./variantRow";
import type { VariantEdits } from "./useVariantEdits";
import { VARIANT_STRINGS } from "./variantStrings";

/**
 * The variants on a phone (and wherever the section is too narrow for the
 * grid): a card each, in the material of the phone card of any list. What it
 * is and its price on the first line, «…» at its end; stock and SKU on the
 * second; the price before discount and the on-sale switch on the third. Each
 * figure is still pressed and changed in place — a 44px target under a thumb.
 * A long press on the card gives the same menu as «…».
 */
export function VariantCards({ rows, tracked, edits }: VariantListProps) {
  return (
    <ul data-slot="variant-cards" className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <VariantCard key={row.variant.id} row={row} tracked={tracked} edits={edits} />
      ))}
    </ul>
  );
}

function VariantCard({ row, tracked, edits }: { row: VariantRow; tracked: boolean; edits: VariantEdits }) {
  const t = useT(VARIANT_STRINGS);
  const { variant, name } = row;
  const archived = variant.status === "archived";
  return (
    <ContextMenu items={row.menu} label={row.menuLabel}>
      <li
        data-slot="variant-card"
        data-archived={archived ? "" : undefined}
        className="zimos-row-card zimos-variant-card relative list-none rounded-[1.25rem] bg-paper-raised px-3.5 py-2 text-ink shadow-[var(--shadow-card)] ring-1 ring-line"
      >
        <div className="flex min-h-11 items-center gap-2">
          <h4 className="flex min-w-0 flex-1 flex-wrap items-center gap-y-0.5 text-[15px] leading-[1.375rem] font-semibold">
            <bdi className={cn("min-w-0 break-words", archived ? "text-ink-soft" : "text-ink")}>{name}</bdi>
            {row.badge}
          </h4>
          <div className="shrink-0 text-[15px] leading-[1.375rem]">
            <PriceCell variant={variant} edits={edits} />
          </div>
          <ItemMenu items={row.menu} label={row.menuLabel} className="-me-2" />
        </div>

        <div className="mt-1 border-t border-line pt-1 text-sm">
          <div className="flex min-h-11 items-center gap-x-4">
            {tracked && (
              <Fact label={t.colStock} className="shrink-0">
                <StockCell variant={variant} edits={edits} />
              </Fact>
            )}
            <Fact label={t.colSku} className="min-w-0 flex-1">
              <SkuCell variant={variant} edits={edits} />
            </Fact>
          </div>
          <div className="flex min-h-11 items-center gap-x-3">
            <Fact label={t.colCompareAt} className="min-w-0 flex-1">
              <CompareAtCell variant={variant} edits={edits} />
            </Fact>
            {/* The switch says what it is («شغّال») beside itself: it needs no name before it. */}
            <StatusCell variant={variant} edits={edits} name={name} className="shrink-0" />
          </div>
        </div>
      </li>
    </ContextMenu>
  );
}

/**
 * A named figure on a line of the card: the name quiet, the figure pressed to
 * change it. The figure's own button already says its name to a screen reader,
 * so the written one is for the eye only.
 */
function Fact({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span aria-hidden className="shrink-0 text-[13px] leading-5 text-ink-soft">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

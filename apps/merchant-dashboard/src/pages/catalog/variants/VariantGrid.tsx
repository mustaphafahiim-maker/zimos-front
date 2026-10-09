import { cn } from "@store-builder/ui";
import { ContextMenu } from "@/components/ContextMenu";
import { useT } from "@/i18n/LocaleContext";
import { ItemMenu } from "../media/ItemMenu";
import { CompareAtCell, PriceCell, SkuCell, StatusCell, StockCell } from "./VariantCells";
import type { VariantListProps, VariantRow } from "./variantRow";
import type { VariantEdits } from "./useVariantEdits";
import { VARIANT_STRINGS } from "./variantStrings";

const HEAD = "px-3 py-3 text-start font-medium whitespace-nowrap";
const CELL = "px-3 py-1.5 align-middle";

/**
 * The variants as a grid, where there is room for it: one row per variant —
 * what it is, its price, the price before discount, its SKU, its stock (only
 * for a product whose quantity is counted) and whether it is on sale — every
 * figure edited in its own cell. «…» at the end of the row, and a right-click
 * on the row, hold what does not fit a cell: edit everything, archive.
 *
 * It is the same sheet as every table of the dashboard (the orders list is the
 * reference): a tinted head, hairlines, 56px rows, the row under the pointer
 * lit. Material for the cells is in glass/product-media.css.
 */
export function VariantGrid({ rows, tracked, edits }: VariantListProps) {
  const t = useT(VARIANT_STRINGS);
  return (
    <div data-slot="variant-grid" className="zimos-variant-grid overflow-x-auto rounded-[1.25rem] bg-paper-raised ring-1 ring-line">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="sr-only">{t.title}</caption>
        <thead>
          <tr className="border-b border-line bg-paper-sunken/60 text-xs text-ink-soft">
            <th scope="col" className={cn(HEAD, "ps-4")}>
              {t.colVariant}
            </th>
            <th scope="col" className={HEAD}>
              {t.colPrice}
            </th>
            <th scope="col" className={HEAD}>
              {t.colCompareAt}
            </th>
            <th scope="col" className={HEAD}>
              {t.colSku}
            </th>
            {tracked && (
              <th scope="col" className={HEAD}>
                {t.colStock}
              </th>
            )}
            <th scope="col" className={HEAD}>
              {t.colStatus}
            </th>
            <th scope="col" className="w-12 px-1 py-3">
              <span className="sr-only">{t.colActions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <GridRow key={row.variant.id} row={row} tracked={tracked} edits={edits} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GridRow({ row, tracked, edits }: { row: VariantRow; tracked: boolean; edits: VariantEdits }) {
  const { variant, name } = row;
  const archived = variant.status === "archived";
  return (
    <ContextMenu items={row.menu} label={row.menuLabel}>
      <tr
        data-variant-row={variant.id}
        data-archived={archived ? "" : undefined}
        className="zimos-variant-row h-14 border-b border-line transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] last:border-b-0 hover:bg-paper-sunken/50 motion-reduce:transition-none"
      >
        <th scope="row" className="max-w-[18rem] py-1.5 ps-4 pe-3 text-start align-middle font-medium">
          <span className="flex flex-wrap items-center gap-y-0.5">
            <bdi className={cn("min-w-0 break-words", archived ? "text-ink-soft" : "text-ink")}>{name}</bdi>
            {row.badge}
          </span>
        </th>
        <td className={CELL}>
          <PriceCell variant={variant} edits={edits} />
        </td>
        <td className={CELL}>
          <CompareAtCell variant={variant} edits={edits} />
        </td>
        <td className={cn(CELL, "max-w-[11rem]")}>
          <SkuCell variant={variant} edits={edits} />
        </td>
        {tracked && (
          <td className={CELL}>
            <StockCell variant={variant} edits={edits} />
          </td>
        )}
        <td className={cn(CELL, "whitespace-nowrap")}>
          <StatusCell variant={variant} edits={edits} name={name} />
        </td>
        <td className="px-1 py-1 text-end align-middle">
          <ItemMenu items={row.menu} label={row.menuLabel} />
        </td>
      </tr>
    </ContextMenu>
  );
}

import { cn } from "@store-builder/ui";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { IconEdit } from "@/components/icons";
import { ProductImage } from "@/components/ProductImage";
import { useQuickLookRow } from "@/components/QuickLook";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { markViewSource } from "@/lib/viewTransition";
import { PriceCell, StockCell } from "./ProductCells";
import { isRowPress, ProductFlags, ProductStatusChip, useProductRowText, type ProductRowView } from "./productRow";
import type { ProductEdits } from "./useProductEdits";

const STRINGS = {
  en: {
    caption: "Products",
    colProduct: "Product",
    colPrice: "Price",
    colStock: "Stock",
    colStatus: "Status",
    colVariants: "Variants",
    colOpen: "Open",
    selectAll: "Select all products shown",
    selectRow: "Select {name}",
    openProduct: "Open {name} to edit it",
    menuLabel: "Actions for {name}",
    code: "Code",
    none: "—",
  },
  ar: {
    caption: "المنتجات",
    colProduct: "المنتج",
    colPrice: "السعر",
    colStock: "المخزون",
    colStatus: "الحالة",
    colVariants: "الأنواع",
    colOpen: "فتح",
    selectAll: "اختار كل المنتجات اللي ظاهرة",
    selectRow: "اختار {name}",
    openProduct: "افتح {name} وعدّله",
    menuLabel: "إجراءات {name}",
    code: "الكود",
    none: "—",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

export interface ProductsTableProps {
  rows: readonly ProductRowView[];
  edits: ProductEdits;
  selected: ReadonlySet<string>;
  onToggle: (productId: string) => void;
  allSelected: boolean;
  onToggleAll: () => void;
  menuFor: (row: ProductRowView) => ContextMenuItem[];
  /** Quick Look. */
  onPeek: (row: ProductRowView) => void;
  /** The product's own page. */
  onOpen: (row: ProductRowView) => void;
}

/**
 * The products as one table on a sheet of glass, from md up: the photo and the
 * name (its code under it), the price, the stock, where it stands, how many
 * variants — and at the row's end the way into the product's page.
 *
 * The price and the stock are changed where they are shown (ProductCells.tsx).
 * A row opens Quick Look (a click anywhere on it, or Space while it has
 * focus); Enter on it opens the product's page, the name, price and status
 * travelling into that page's header. Right-click gives the row's menu. The
 * tick box selects it for the bulk bar; a selected row tints.
 *
 * Material (the row under the pointer, the selected tint) is in
 * glass/catalog.css; without the glass layer it is a solid raised sheet.
 */
export function ProductsTable({ rows, edits, selected, onToggle, allSelected, onToggleAll, menuFor, onPeek, onOpen }: ProductsTableProps) {
  const t = useT(STRINGS);
  const someSelected = rows.some((row) => selected.has(row.product.id));
  const head = "px-3 py-3 text-start font-medium whitespace-nowrap";

  return (
    <div
      data-slot="catalog-table"
      className="zimos-catalog-table overflow-x-auto rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line"
    >
      <table className="zimos-catalog-grid w-full min-w-[44rem] text-sm">
        <caption className="sr-only">{t.caption}</caption>
        <thead>
          <tr className="border-b border-line bg-paper-sunken/60 text-xs text-ink-soft">
            <th scope="col" className="w-11 py-1 ps-2 pe-0">
              <label className="flex size-11 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-primary"
                  checked={allSelected}
                  ref={(box) => {
                    // Some but not all: the box says so with a dash.
                    if (box) box.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={onToggleAll}
                  aria-label={t.selectAll}
                />
              </label>
            </th>
            <th scope="col" className={head}>
              {t.colProduct}
            </th>
            <th scope="col" className={head}>
              {t.colPrice}
            </th>
            <th scope="col" className={head}>
              {t.colStock}
            </th>
            <th scope="col" className={head}>
              {t.colStatus}
            </th>
            <th scope="col" className={cn(head, "max-lg:hidden")}>
              {t.colVariants}
            </th>
            <th scope="col" className="px-3 py-3">
              <span className="sr-only">{t.colOpen}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ProductTableRow
              key={row.product.id}
              row={row}
              edits={edits}
              selected={selected.has(row.product.id)}
              onToggle={onToggle}
              menu={menuFor(row)}
              onPeek={onPeek}
              onOpen={onOpen}
              t={t}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductTableRow({
  row,
  edits,
  selected,
  onToggle,
  menu,
  onPeek,
  onOpen,
  t,
}: {
  row: ProductRowView;
  edits: ProductEdits;
  selected: boolean;
  onToggle: (productId: string) => void;
  menu: ContextMenuItem[];
  onPeek: (row: ProductRowView) => void;
  onOpen: (row: ProductRowView) => void;
  t: Strings;
}) {
  const { product, to, code, image, variants } = row;
  const text = useProductRowText();
  // Space on the focused row peeks; a key pressed on one of its controls is that control's.
  const peekProps = useQuickLookRow(() => onPeek(row));

  return (
    <ContextMenu items={menu} label={fmt(t.menuLabel, { name: product.name })}>
      <tr
        data-product-row={product.id}
        data-selected={selected ? "" : undefined}
        tabIndex={peekProps.tabIndex}
        onKeyDown={(e) => {
          peekProps.onKeyDown(e);
          // Enter, on the row itself, opens the product's page.
          if (e.key !== "Enter" || e.target !== e.currentTarget || e.defaultPrevented || e.repeat) return;
          e.preventDefault();
          onOpen(row);
        }}
        onClick={(e) => {
          if (!isRowPress(e.target, e.currentTarget)) return;
          // Ctrl / ⌘ + click is "in a new tab", as on a link.
          if (e.metaKey || e.ctrlKey) {
            window.open(to, "_blank", "noopener");
            return;
          }
          onPeek(row);
        }}
        className={cn(
          "zimos-catalog-row group/row cursor-pointer border-b border-line outline-none last:border-b-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
          selected && "bg-primary-soft/50"
        )}
      >
        {/* The start edge of a selected row carries the brand colour; the edge is always there, so nothing shifts when it lights. */}
        <td className="w-11 border-s-[3px] border-s-transparent ps-1.5 pe-0 group-data-[selected]/row:border-s-primary">
          <label className="flex size-11 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              className="size-4 cursor-pointer accent-primary"
              checked={selected}
              onChange={() => onToggle(product.id)}
              aria-label={fmt(t.selectRow, { name: product.name })}
            />
          </label>
        </td>

        <td className="max-w-80 px-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* 44px, reserved: the row is the same height with or without a photo. */}
            <ProductImage media={image} alt="" className="size-11 rounded-[0.75rem]" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span data-vt-part="title" className="min-w-0 truncate text-[15px] leading-6 font-medium text-ink">
                  <bdi>{product.name}</bdi>
                </span>
                <ProductFlags row={row} />
              </div>
              {code && (
                <p className="text-xs leading-5 text-ink-soft tabular-nums">
                  <span className="sr-only">{t.code}: </span>
                  <bdi dir="ltr">{code}</bdi>
                </p>
              )}
            </div>
          </div>
        </td>

        <td className="px-3 whitespace-nowrap">
          <span data-vt-part="amount" className="inline-block max-w-full text-[15px]">
            <PriceCell row={row} edits={edits} />
          </span>
        </td>

        <td className="px-3 text-[13px] whitespace-nowrap">
          <StockCell row={row} edits={edits} />
        </td>

        <td className="px-3">
          <ProductStatusChip product={product} />
        </td>

        <td className="px-3 text-[13px] whitespace-nowrap text-ink-soft max-lg:hidden">
          {variants.length > 0 ? text.variantCount(variants.length) : t.none}
        </td>

        <td className="w-px px-3">
          <ViewLink
            to={to}
            aria-label={fmt(t.openProduct, { name: product.name })}
            title={fmt(t.openProduct, { name: product.name })}
            // The row is the source of the journey into the product's page.
            onClick={(e) => markViewSource(e.currentTarget.closest("tr"))}
            className="zimos-catalog-tool ms-auto flex size-10 cursor-pointer items-center justify-center rounded-full bg-paper-raised text-ink ring-1 ring-line transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:size-11"
          >
            <IconEdit className="size-[18px]" aria-hidden />
          </ViewLink>
        </td>
      </tr>
    </ContextMenu>
  );
}

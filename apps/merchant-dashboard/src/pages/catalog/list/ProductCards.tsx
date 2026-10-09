import { productPreorderOf } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { ListRowCard } from "@/components/list";
import { ProductImage } from "@/components/ProductImage";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { canEditFigures, EditFiguresButton, PriceCell, StockCell } from "./ProductCells";
import { ProductFlags, ProductStatusChip, useProductRowText, type ProductRowView } from "./productRow";
import type { ProductEdits } from "./useProductEdits";

const STRINGS = {
  en: {
    listLabel: "Products",
    selectRow: "Select {name}",
    menuLabel: "Actions for {name}",
    stock: "Stock",
  },
  ar: {
    listLabel: "المنتجات",
    selectRow: "اختار {name}",
    menuLabel: "إجراءات {name}",
    stock: "المخزون",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

export interface ProductCardsProps {
  rows: readonly ProductRowView[];
  edits: ProductEdits;
  /** The tick boxes are out: «حدّد» was pressed, or something is already selected. */
  selecting: boolean;
  selected: ReadonlySet<string>;
  onToggle: (productId: string) => void;
  menuFor: (row: ProductRowView) => ContextMenuItem[];
  /** Quick Look. */
  onPeek: (row: ProductRowView) => void;
  /** The product's own page. */
  onOpen: (row: ProductRowView) => void;
}

/**
 * The products on a phone, as rows: one card each (ListRowCard). The photo,
 * the name and the price on the first line; where it stands, the stock and
 * how many variants on the second, with the ONE action at its end — a pencil
 * that opens the prices and the stock, each figure editable in place. Then the
 * small chips, only when one applies (sold out, no weight, pre-orders).
 *
 * A tap opens Quick Look; a long press, the product's menu; Enter on a focused
 * card, the product's page. With «حدّد» on, each card has its tick box.
 */
export function ProductCards({ rows, edits, selecting, selected, onToggle, menuFor, onPeek, onOpen }: ProductCardsProps) {
  const t = useT(STRINGS);
  return (
    <ul aria-label={t.listLabel} className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <ProductCard
          key={row.product.id}
          row={row}
          edits={edits}
          selecting={selecting}
          selected={selected.has(row.product.id)}
          onToggle={onToggle}
          menu={menuFor(row)}
          onPeek={onPeek}
          onOpen={onOpen}
          t={t}
        />
      ))}
    </ul>
  );
}

function ProductCard({
  row,
  edits,
  selecting,
  selected,
  onToggle,
  menu,
  onPeek,
  onOpen,
  t,
}: {
  row: ProductRowView;
  edits: ProductEdits;
  selecting: boolean;
  selected: boolean;
  onToggle: (productId: string) => void;
  menu: ContextMenuItem[];
  onPeek: (row: ProductRowView) => void;
  onOpen: (row: ProductRowView) => void;
  t: Strings;
}) {
  const { product, image, variants } = row;
  const text = useProductRowText();
  const hasFlags = row.soldOut || row.missingWeight || productPreorderOf(product) !== null;

  return (
    <ContextMenu items={menu} label={fmt(t.menuLabel, { name: product.name })}>
      {/* The card and its parts are the source of the journey into the product's page (lib/viewTransition.ts). */}
      <li data-product-row={product.id}>
        <ListRowCard
          leading={<ProductImage media={image} alt="" className="size-10 rounded-[0.75rem]" />}
          title={
            <span data-vt-part="title">
              <bdi>{product.name}</bdi>
            </span>
          }
          amount={
            <span data-vt-part="amount" className="inline-block">
              <PriceCell row={row} edits={edits} plain />
            </span>
          }
          status={<ProductStatusChip product={product} />}
          meta={
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0">
                {row.stockTotal !== null && <span>{t.stock} </span>}
                <StockCell row={row} edits={edits} plain className="font-medium" />
              </span>
              {variants.length > 1 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="min-w-0 truncate">{text.variantCount(variants.length)}</span>
                </>
              )}
            </span>
          }
          // One 44px target that opens every figure of the product, each editable in place.
          action={canEditFigures(row, edits) ? <EditFiguresButton row={row} edits={edits} /> : undefined}
          footer={hasFlags ? <ProductFlags row={row} /> : undefined}
          selected={selected}
          onSelectedChange={selecting ? () => onToggle(product.id) : undefined}
          selectLabel={fmt(t.selectRow, { name: product.name })}
          onOpen={() => onPeek(row)}
          aria-haspopup="dialog"
          onKeyDown={(e) => {
            // Space peeks (the card's own key); Enter, on the card itself, opens the product's page.
            if (e.key !== "Enter" || e.target !== e.currentTarget || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
            e.preventDefault();
            onOpen(row);
          }}
        />
      </li>
    </ContextMenu>
  );
}

import { useId } from "react";
import type { Product } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { SkeletonBar } from "@/components/DataState";
import { IconCheck } from "@/components/icons";
import { ProductImage } from "@/components/ProductImage";
import { useQuickLookRow } from "@/components/QuickLook";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useCatalogLabels } from "../catalogLabels";
import { PriceCell, StockCell } from "./ProductCells";
import { ProductFlags, type ProductRowView } from "./productRow";
import type { ProductEdits } from "./useProductEdits";

const STRINGS = {
  en: {
    listLabel: "Products",
    selectRow: "Select {name}",
    menuLabel: "Actions for {name}",
    stock: "Stock",
    loading: "Loading…",
  },
  ar: {
    listLabel: "المنتجات",
    selectRow: "اختار {name}",
    menuLabel: "إجراءات {name}",
    stock: "المخزون",
    loading: "بيحمّل…",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

/** Two photos across on a phone, up to five on a wide screen. */
const GRID = "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5";

export interface ProductGridProps {
  rows: readonly ProductRowView[];
  edits: ProductEdits;
  /** Wide enough for a mouse-sized figure: the price and the stock are edited on the tile itself. */
  desktop: boolean;
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
 * The products as photos: a tile each — the photo (square, its room kept
 * whether or not it has loaded), the name, the price, a line for the stock and
 * a dot with the status. A tile opens Quick Look (Space too); Enter opens the
 * product's page; right-click or a long press gives its menu. With «حدّد» on,
 * each tile has a tick box over its photo.
 *
 * Material (the pane of a tile, its lift, the selected ring) is in
 * glass/catalog.css; without the glass layer a tile is a solid raised card.
 */
export function ProductGrid({ rows, edits, desktop, selecting, selected, onToggle, menuFor, onPeek, onOpen }: ProductGridProps) {
  const t = useT(STRINGS);
  return (
    <ul aria-label={t.listLabel} className={GRID}>
      {rows.map((row) => (
        <ProductTile
          key={row.product.id}
          row={row}
          edits={edits}
          desktop={desktop}
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

const DOT: Record<Product["status"], string> = {
  active: "bg-success",
  draft: "bg-accent",
  archived: "bg-ink-soft/50",
};

/** The status as a dot and its word: the word carries the meaning, the colour only helps. */
function StatusDot({ product }: { product: Product }) {
  const labels = useCatalogLabels();
  return (
    <span data-vt-part="status" className="inline-flex shrink-0 items-center gap-1.5 text-xs leading-5 text-ink-soft">
      <span aria-hidden data-status={product.status} className={cn("zimos-catalog-dot size-2 rounded-full", DOT[product.status])} />
      {labels.status(product.status)}
    </span>
  );
}

function ProductTile({
  row,
  edits,
  desktop,
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
  desktop: boolean;
  selecting: boolean;
  selected: boolean;
  onToggle: (productId: string) => void;
  menu: ContextMenuItem[];
  onPeek: (row: ProductRowView) => void;
  onOpen: (row: ProductRowView) => void;
  t: Strings;
}) {
  const { product, image } = row;
  const titleId = useId();
  const peekProps = useQuickLookRow(() => onPeek(row));

  return (
    <ContextMenu items={menu} label={fmt(t.menuLabel, { name: product.name })}>
      <li
        data-product-row={product.id}
        data-selected={selected ? "" : undefined}
        className={cn(
          "zimos-catalog-tile relative flex min-w-0 flex-col overflow-hidden rounded-[1.25rem] text-ink shadow-[var(--shadow-card)]",
          "transition-[translate,box-shadow,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
          // Something that opens lifts under the pointer, and gives while it is held.
          "motion-safe:hover:-translate-y-0.5 motion-safe:has-[[data-tile-open]:active]:translate-y-0 motion-safe:has-[[data-tile-open]:active]:scale-[0.985]",
          selected ? "bg-primary-soft ring-2 ring-primary" : "bg-paper-raised ring-1 ring-line"
        )}
      >
        {/* The whole tile is one target; the tick box and the editable figures are drawn above it. */}
        <div
          role="button"
          aria-labelledby={titleId}
          aria-haspopup="dialog"
          data-tile-open=""
          tabIndex={peekProps.tabIndex}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey) {
              window.open(row.to, "_blank", "noopener");
              return;
            }
            onPeek(row);
          }}
          onKeyDown={(e) => {
            peekProps.onKeyDown(e);
            if (e.key !== "Enter" || e.target !== e.currentTarget || e.defaultPrevented || e.repeat) return;
            e.preventDefault();
            onOpen(row);
          }}
          className="absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        />

        {/* Square, and the room is kept before the photo arrives: nothing under it moves. */}
        <div className="relative aspect-square w-full">
          <ProductImage media={image} alt="" className="size-full rounded-none border-0" iconClassName="size-8" />
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-wrap items-center gap-1 empty:hidden">
            <ProductFlags row={row} />
          </div>
        </div>

        {selecting && (
          <label className="absolute start-1 top-1 z-10 flex size-11 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(product.id)}
              aria-label={fmt(t.selectRow, { name: product.name })}
              className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0"
            />
            <span
              aria-hidden
              data-checked={selected ? "" : undefined}
              className={cn(
                "zimos-row-check pointer-events-none flex size-6 items-center justify-center rounded-[8px] shadow-[var(--shadow-card)]",
                "transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-active:scale-[0.92] motion-reduce:peer-active:scale-100",
                selected ? "bg-primary text-primary-foreground" : "bg-paper-raised ring-[1.5px] ring-line-strong ring-inset"
              )}
            >
              {selected && (
                <IconCheck className="size-4 motion-safe:animate-[list-badge-pop_var(--dur-pop)_var(--ease-pop)_both]" weight="bold" aria-hidden />
              )}
            </span>
          </label>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-3 [&_button]:relative [&_button]:z-10">
          <p id={titleId} data-vt-part="title" className="truncate text-sm leading-6 font-medium text-ink">
            <bdi>{product.name}</bdi>
          </p>
          <p className="flex min-h-6 min-w-0 items-center text-[15px] leading-6">
            <span data-vt-part="amount" className="inline-block max-w-full">
              <PriceCell row={row} edits={edits} plain={!desktop} />
            </span>
          </p>
          <div className="flex min-h-6 min-w-0 items-center justify-between gap-2 text-xs leading-5 text-ink-soft">
            <span className="flex min-w-0 items-center gap-1 truncate">
              {row.stockTotal !== null && <span className="shrink-0">{t.stock}</span>}
              <StockCell row={row} edits={edits} plain={!desktop} />
            </span>
            <StatusDot product={product} />
          </div>
        </div>
      </li>
    </ContextMenu>
  );
}

/** The grid while its first page loads: tiles in the shape of the ones to come — a square for the photo, three lines under it. */
export function ProductGridSkeleton({ tiles = 10 }: { tiles?: number }) {
  const t = useT(STRINGS);
  return (
    <div data-skeleton="" role="status" aria-live="polite" aria-busy="true" className="min-w-0">
      <span className="sr-only">{t.loading}</span>
      <ul aria-hidden className={GRID}>
        {Array.from({ length: tiles }, (_, index) => (
          <li
            key={index}
            className="zimos-catalog-tile flex min-w-0 flex-col overflow-hidden rounded-[1.25rem] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line"
          >
            <SkeletonBar className="aspect-square h-auto w-full rounded-none" />
            <div className="flex flex-col gap-0.5 p-3">
              <div className="flex h-6 items-center">
                <SkeletonBar className={cn("h-3.5", index % 2 === 0 ? "w-3/4" : "w-3/5")} />
              </div>
              <div className="flex h-6 items-center">
                <SkeletonBar className="h-3.5 w-16" />
              </div>
              <div className="flex h-6 items-center justify-between gap-2">
                <SkeletonBar className="h-2.5 w-14" />
                <SkeletonBar className="h-2.5 w-10" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

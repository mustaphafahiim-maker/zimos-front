import type { ReactNode } from "react";
import type { Product, Variant } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { EditInPlace } from "@/components/EditInPlace";
import { IconCaretDown, IconEdit } from "@/components/icons";
import { Popover } from "@/components/Popover";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatMoney, majorToMinor } from "@/lib/format";
import { priceInput, useProductRowText, variantName, type ProductRowView } from "./productRow";
import type { ProductEdits } from "./useProductEdits";

const STRINGS = {
  en: {
    price: "Price",
    stock: "Stock",
    variant: "Variant",
    priceOf: "Price of {name}",
    stockOf: "Stock of {name}",
    priceSaved: "Price changed.",
    stockSaved: "Stock updated.",
    priceRequired: "Type the price.",
    stockRequired: "Type the quantity.",
    stockNegative: "Stock can't go below zero.",
    figuresOf: "Price and stock of {name}",
    pricesOf: "Prices of {name}",
    editFigures: "Change the price or the stock of {name}",
    reserved: "{n} reserved",
    none: "—",
  },
  ar: {
    price: "السعر",
    stock: "المخزون",
    variant: "النوع",
    priceOf: "سعر {name}",
    stockOf: "مخزون {name}",
    priceSaved: "السعر اتغيّر.",
    stockSaved: "المخزون اتحدّث.",
    priceRequired: "اكتب السعر.",
    stockRequired: "اكتب الكمية.",
    stockNegative: "المخزون ما ينفعش يبقى أقل من صفر.",
    figuresOf: "سعر ومخزون {name}",
    pricesOf: "أسعار {name}",
    editFigures: "غيّر سعر أو مخزون {name}",
    reserved: "{n} محجوز",
    none: "—",
  },
} satisfies Messages;

/** An editable figure of the list: it lights up under the pointer and wears a ring while its field is open. */
const CELL =
  "zimos-catalog-cell min-h-9 hover:bg-paper-sunken data-[popup-open]:bg-paper-sunken data-[popup-open]:ring-2 data-[popup-open]:ring-primary/50 focus-visible:-outline-offset-1";

/** A count, in the language's digits, always read left to right. */
function Count({ n, className }: { n: number; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("tabular-nums", className)}>
      {fmt("{n}", { n })}
    </bdi>
  );
}

interface VariantEditProps {
  product: Product;
  variant: Variant;
  edits: ProductEdits;
  /** Shown as plain text: the role may not change products, or the product is archived. */
  readOnly?: boolean;
  /** Names the field when a row holds several: «سعر قميص كتان / M». */
  label?: string;
  className?: string;
}

/** The price shoppers pay for one variant, changed where it is shown. It cannot be emptied. */
export function VariantPriceEdit({ product, variant, edits, readOnly = false, label, className }: VariantEditProps) {
  const t = useT(STRINGS);
  return (
    <EditInPlace
      kind="money"
      label={label ?? t.price}
      value={priceInput(variant.priceAmount)}
      format={(value) => (
        <bdi className="tabular-nums">{value === "" ? t.none : formatMoney(majorToMinor(value), variant.currency)}</bdi>
      )}
      validate={(next) => (next === "" ? t.priceRequired : null)}
      onSave={(next) => edits.price(product, variant, next)}
      undoMessage={t.priceSaved}
      disabled={readOnly || !edits.canEdit}
      className={cn(!(readOnly || !edits.canEdit) && CELL, "font-semibold text-ink", className)}
    />
  );
}

/** How many of one variant are on the shelf, changed where it is shown. Only for a product whose quantity is counted. */
export function VariantStockEdit({ product, variant, edits, readOnly = false, label, className }: VariantEditProps) {
  const t = useT(STRINGS);
  return (
    <EditInPlace
      kind="number"
      label={label ?? t.stock}
      value={String(variant.stockOnHand)}
      format={(value) => <Count n={Number(value)} />}
      validate={(next) => (next === "" ? t.stockRequired : Number(next) < 0 ? t.stockNegative : null)}
      onSave={(next) => edits.stock(product, variant, next)}
      undoMessage={t.stockSaved}
      disabled={readOnly || !edits.canEdit}
      className={cn(!(readOnly || !edits.canEdit) && CELL, "font-medium", variant.stockOnHand <= 0 ? "text-danger" : "text-ink", className)}
    />
  );
}

/**
 * Every variant the row speaks for, one line each: what it is, its price and —
 * for a product whose quantity is counted — its stock, each figure its own
 * in-place edit. The pane of the range cells, of the phone card's pencil, and
 * the price list inside Quick Look.
 */
export function VariantsEditor({ row, edits, className }: { row: ProductRowView; edits: ProductEdits; className?: string }) {
  const t = useT(STRINGS);
  const text = useProductRowText();
  const { product, variants, tracked } = row;
  const readOnly = !row.editable;
  const columns = tracked ? "grid-cols-[minmax(0,1fr)_7rem_4.25rem]" : "grid-cols-[minmax(0,1fr)_7rem]";

  if (variants.length === 0) return <p className={cn("text-sm text-ink-soft", className)}>{text.noVariants}</p>;

  return (
    <div data-slot="variants-editor" className={cn("min-w-0", className)}>
      <div aria-hidden className={cn("grid items-center gap-x-3 pb-1.5 text-xs font-medium text-ink-soft", columns)}>
        <span>{t.variant}</span>
        <span>{t.price}</span>
        {tracked && <span>{t.stock}</span>}
      </div>
      <ul className="-mx-1 max-h-[min(20rem,50dvh)] divide-y divide-line overflow-y-auto overscroll-contain px-1">
        {variants.map((variant) => {
          const name = variantName(variant, text.defaultVariant);
          return (
            <li key={variant.id} className={cn("grid min-h-11 items-center gap-x-3 py-1", columns)}>
              <span className="min-w-0">
                <span className="block truncate text-sm leading-5 text-ink">
                  <bdi>{name}</bdi>
                </span>
                {tracked && variant.reservedStock > 0 && (
                  <span className="block text-xs leading-4 text-ink-soft">{fmt(t.reserved, { n: variant.reservedStock })}</span>
                )}
              </span>
              <span className="min-w-0">
                <VariantPriceEdit product={product} variant={variant} edits={edits} readOnly={readOnly} label={fmt(t.priceOf, { name })} />
              </span>
              {tracked && (
                <span className="min-w-0">
                  <VariantStockEdit product={product} variant={variant} edits={edits} readOnly={readOnly} label={fmt(t.stockOf, { name })} />
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The pane's own title and width, around the editor. */
function EditorPane({ row, edits }: { row: ProductRowView; edits: ProductEdits }) {
  return (
    <div className="w-[min(22rem,calc(100vw-3rem))]">
      <p className="mb-2.5 truncate text-[13px] leading-5 font-semibold text-ink">
        <bdi>{row.product.name}</bdi>
      </p>
      <VariantsEditor row={row} edits={edits} />
    </div>
  );
}

/** A figure that stands for several variants: pressing it lists them, each editable. */
function RangeButton({ row, edits, label, className, children }: { row: ProductRowView; edits: ProductEdits; label: string; className?: string; children: ReactNode }) {
  return (
    <Popover
      label={label}
      align="start"
      trigger={
        <button
          type="button"
          data-slot="product-range"
          aria-label={label}
          // It sits in a row that is itself pressable: pressing the figure opens its variants and nothing else.
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") event.stopPropagation();
          }}
          className={cn(
            "group/range relative -mx-1.5 inline-flex max-w-full cursor-pointer items-center gap-1 rounded-lg px-1.5 text-start",
            "transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            "focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100 pointer-coarse:min-h-11 pointer-coarse:min-w-11",
            CELL,
            className
          )}
        >
          <span className="min-w-0 truncate">{children}</span>
          <IconCaretDown
            className="size-3.5 shrink-0 text-ink-soft transition-[rotate] duration-[var(--dur-fade)] ease-[var(--ease-out)] group-data-[popup-open]/range:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
        </button>
      }
    >
      <EditorPane row={row} edits={edits} />
    </Popover>
  );
}

interface CellProps {
  row: ProductRowView;
  edits: ProductEdits;
  /** Plain text whatever the role: a phone card, where the pencil opens the editor instead. */
  plain?: boolean;
  className?: string;
}

/**
 * The price of a product in the list. One variant: its price, edited in
 * place. Several: the range («٢٥٠ – ٣٢٠ ج.م»), which opens each variant's own
 * price. Plain text for a role that may not change products, and for an
 * archived product.
 */
export function PriceCell({ row, edits, plain = false, className }: CellProps) {
  const t = useT(STRINGS);
  if (row.priceLabel === null) return <span className={cn("text-ink-soft", className)}>{t.none}</span>;
  const words = <bdi className="tabular-nums">{row.priceLabel}</bdi>;
  if (plain || !edits.canEdit || !row.editable) return <span className={cn("font-semibold text-ink", className)}>{words}</span>;
  const only = row.variants.length === 1 ? row.variants[0] : undefined;
  if (only) return <VariantPriceEdit product={row.product} variant={only} edits={edits} className={className} />;
  return (
    <RangeButton row={row} edits={edits} label={fmt(row.tracked ? t.figuresOf : t.pricesOf, { name: row.product.name })} className={cn("font-semibold text-ink", className)}>
      {words}
    </RangeButton>
  );
}

/**
 * The stock of a product in the list: «مش متتبّع» when its quantity is not
 * counted, else the units on hand — edited in place for one variant, the total
 * that opens each variant's own count for several.
 */
export function StockCell({ row, edits, plain = false, className }: CellProps) {
  const t = useT(STRINGS);
  const text = useProductRowText();
  if (!row.tracked) return <span className={cn("text-ink-soft", className)}>{text.notTracked}</span>;
  if (row.stockTotal === null) return <span className={cn("text-ink-soft", className)}>{text.noVariants}</span>;
  const tone = row.stockTotal <= 0 ? "text-danger" : "text-ink";
  if (plain || !edits.canEdit || !row.editable) return <Count n={row.stockTotal} className={cn("font-medium", tone, className)} />;
  const only = row.variants.length === 1 ? row.variants[0] : undefined;
  if (only) return <VariantStockEdit product={row.product} variant={only} edits={edits} className={className} />;
  return (
    <RangeButton row={row} edits={edits} label={fmt(t.figuresOf, { name: row.product.name })} className={cn("font-medium", tone, className)}>
      <Count n={row.stockTotal} />
    </RangeButton>
  );
}

/** Whether the row has a figure this role can change from the list. */
export function canEditFigures(row: ProductRowView, edits: ProductEdits): boolean {
  return edits.canEdit && row.editable && row.variants.length > 0;
}

/**
 * The phone card's one action: a pencil that opens the product's prices and
 * stock, each figure editable — one 44px target instead of two figures to aim
 * at inside a card that is itself a button.
 */
export function EditFiguresButton({ row, edits }: { row: ProductRowView; edits: ProductEdits }) {
  const t = useT(STRINGS);
  if (!canEditFigures(row, edits)) return null;
  const label = fmt(t.editFigures, { name: row.product.name });
  return (
    <Popover
      label={label}
      align="end"
      trigger={
        <button
          type="button"
          data-slot="product-edit"
          aria-label={label}
          title={label}
          onClick={(event) => event.stopPropagation()}
          className="zimos-catalog-tool flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-paper-raised text-ink ring-1 ring-line transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] data-[popup-open]:bg-paper-sunken motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          <IconEdit className="size-[18px]" aria-hidden />
        </button>
      }
    >
      <EditorPane row={row} edits={edits} />
    </Popover>
  );
}

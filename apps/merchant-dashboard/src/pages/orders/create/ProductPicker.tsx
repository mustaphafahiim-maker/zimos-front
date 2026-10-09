import { useEffect, useId, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, cn } from "@store-builder/ui";
import type { Product } from "@store-builder/api-client";
import { IconCaretDown, IconPackage, IconPlus } from "@/components/icons";
import { DataState, SkeletonBar } from "@/components/DataState";
import { ProductImage } from "@/components/ProductImage";
import { ListToolbar } from "@/components/list";
import { fmt, getLocale, useT } from "@/i18n/LocaleContext";
import { formatMoney, formatMoneyRange, parseMoney, variantLabel } from "@/lib/format";
import { CREATE_STRINGS } from "./strings";
import { QuantityStepper } from "./QuantityStepper";
import { activeVariants, stockOf, variantIsNamed, variantIsOut } from "./model";
import { revealInBody } from "./reveal";
import type { CreateOrder } from "./useCreateOrder";

/** One price, or the lowest and highest across the variants on sale. */
function priceOf(product: Product): string | null {
  const variants = activeVariants(product);
  if (variants.length === 0) return null;
  const prices = variants.map((v) => parseMoney(v.priceAmount));
  return formatMoneyRange(Math.min(...prices), Math.max(...prices), variants[0].currency, getLocale() === "ar" ? "ar-EG" : "en-EG");
}

// The pill of a filter (components/list FilterChoice), with room for a second, quieter word: the price.
const CHIP =
  "inline-flex h-10 max-w-full cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-medium select-none pointer-coarse:h-11 " +
  "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100";
const CHIP_ON = "bg-primary text-primary-foreground forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]";
const CHIP_OFF = "bg-paper-raised text-ink ring-1 ring-line hover:bg-paper-sunken";

interface ChipProps {
  pressed: boolean;
  onPress: () => void;
  label: string;
  /** The price, after the name. */
  detail?: string;
  /** A short warning («خلص»). */
  note?: string;
}

function Chip({ pressed, onPress, label, detail, note }: ChipProps) {
  return (
    <button type="button" aria-pressed={pressed} data-slot="order-chip" onClick={onPress} className={cn(CHIP, pressed ? CHIP_ON : CHIP_OFF)}>
      <span className="min-w-0 truncate">
        <bdi>{label}</bdi>
      </span>
      {detail && (
        <span data-part="detail" className={cn("shrink-0 font-normal tabular-nums", !pressed && "text-ink-soft")}>
          <bdi>{detail}</bdi>
        </span>
      )}
      {note && (
        <span
          data-part="note"
          className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] leading-none font-medium",
            pressed ? "ring-1 ring-current/50" : "bg-accent-soft text-accent-dark"
          )}
        >
          {note}
        </span>
      )}
    </button>
  );
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div>
      <p id={id} className="mb-1.5 text-xs leading-4 font-medium text-ink-soft">
        {label}
      </p>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}

/** What opens under a chosen product: its variants and offers as chips, how many, and «ضيف للأوردر». */
function ProductPanel({ id, ctl, product }: { id: string; ctl: CreateOrder; product: Product }) {
  const t = useT(CREATE_STRINGS);
  const { variants } = ctl;
  const chosen = variants.find((v) => v.id === ctl.variantId);
  // A product sold in one plain form has nothing to choose between: the row above already says its price.
  const showVariants = variants.length > 1 || (variants.length === 1 && variantIsNamed(product, variants[0]));

  function add() {
    if (!ctl.addLine()) return;
    // With a keyboard the cursor goes back to the search, ready for the next product; by touch no keyboard is raised.
    if (!window.matchMedia("(pointer: coarse)").matches) ctl.focusSearch();
  }

  return (
    <div
      id={id}
      data-slot="order-product-panel"
      className="space-y-3 px-2.5 pt-1 pb-3 motion-safe:animate-[order-create-open_var(--dur-fade)_var(--ease-out)_both]"
    >
      {variants.length === 0 ? (
        <p className="text-sm leading-6 text-ink-soft">{t.noVariants}</p>
      ) : (
        <>
          {showVariants && (
            <ChipGroup label={t.variant}>
              {variants.map((v) => (
                <Chip
                  key={v.id}
                  pressed={v.id === ctl.variantId}
                  onPress={() => ctl.setVariantId(v.id)}
                  label={variantLabel(v)}
                  detail={formatMoney(v.priceAmount, v.currency)}
                  note={variantIsOut(product, v) ? t.variantOut : undefined}
                />
              ))}
            </ChipGroup>
          )}
          {ctl.offers.length > 0 && (
            <ChipGroup label={t.offer}>
              <Chip pressed={ctl.offerId === ""} onPress={() => ctl.setOfferId("")} label={t.noOffer} />
              {ctl.offers.map((o) => (
                <Chip
                  key={o.id}
                  pressed={o.id === ctl.offerId}
                  onPress={() => ctl.setOfferId(o.id)}
                  label={o.name}
                  detail={o.priceAmount ? formatMoney(o.priceAmount, o.currency) : undefined}
                />
              ))}
            </ChipGroup>
          )}
          <div className="flex items-center gap-3">
            <QuantityStepper value={ctl.quantity} onChange={ctl.setQuantity} label={t.quantity} onEnter={add} />
            <button
              type="button"
              data-slot="order-add"
              disabled={!chosen}
              onClick={add}
              className={cn(
                "inline-flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-primary-soft px-4 text-sm font-semibold text-primary-dark",
                "transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                "hover:bg-primary-soft/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100",
                "disabled:cursor-default disabled:opacity-50 disabled:active:scale-100"
              )}
            >
              <IconPlus className="size-4 shrink-0" weight="bold" aria-hidden />
              <span className="min-w-0 truncate">{t.add}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ProductRow({ ctl, product }: { ctl: CreateOrder; product: Product }) {
  const t = useT(CREATE_STRINGS);
  const panelId = useId();
  const row = useRef<HTMLLIElement>(null);
  const open = ctl.productId === product.id;
  const price = priceOf(product);
  const stock = stockOf(product);
  const inOrder = ctl.form.lines.reduce((sum, line) => (line.productId === product.id ? sum + line.quantity : sum), 0);

  // The chips and the add button open under the row: bring them above the footer when they would land beneath it.
  useEffect(() => {
    if (open && row.current) revealInBody(row.current, "nearest");
  }, [open]);

  return (
    <li ref={row} data-slot="order-product" data-open={open ? "" : undefined} className={cn(open && "bg-paper-sunken/50")}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-slot="order-product-row"
        onClick={() => ctl.toggleProduct(product.id)}
        className="flex min-h-16 w-full cursor-pointer items-center gap-3 px-2.5 py-2 text-start transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        <ProductImage media={product.media?.[0]} alt={product.name} className="size-11 rounded-[0.75rem]" />
        <span className="block min-w-0 flex-1">
          <span className="block truncate text-sm leading-5 font-medium text-ink">
            <bdi>{product.name}</bdi>
          </span>
          <span data-slot="order-product-meta" className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs leading-4 text-ink-soft tabular-nums">
            {price && <bdi>{price}</bdi>}
            {price && stock !== null && <span aria-hidden>·</span>}
            {stock !== null && (
              <span className={stock <= 0 ? "font-medium text-danger" : undefined}>{stock > 0 ? fmt(t.stock, { n: stock }) : t.outOfStock}</span>
            )}
          </span>
        </span>
        {inOrder > 0 && (
          // Keyed by the figure, so it pops each time the order takes more of this product.
          <span
            key={inOrder}
            data-slot="order-product-count"
            className="shrink-0 rounded-full bg-primary-soft px-2 py-1 text-xs leading-none font-semibold text-primary-dark tabular-nums motion-safe:animate-[order-create-pop_var(--dur-pop)_var(--ease-pop)_both]"
          >
            {fmt(t.inOrder, { n: inOrder })}
          </span>
        )}
        <IconCaretDown
          className={cn(
            "size-4 shrink-0 text-ink-soft transition-[rotate] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open && <ProductPanel id={panelId} ctl={ctl} product={product} />}
    </li>
  );
}

/** Rows in the shape of the products, while the catalog is on its way. */
function PickerSkeleton() {
  const widths = ["w-2/5", "w-1/2", "w-1/3", "w-3/5"] as const;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[1rem] bg-paper-raised ring-1 ring-line" data-slot="order-products">
      {widths.map((width) => (
        <li key={width} className="flex min-h-16 items-center gap-3 px-2.5 py-2">
          <SkeletonBar className="size-11 shrink-0 rounded-[0.75rem]" />
          <div className="min-w-0 flex-1">
            <SkeletonBar className={cn("h-3.5", width)} />
            <SkeletonBar className="mt-2 h-2.5 w-1/4" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The catalog as a list to search, in place of three selects: a search field
 * over the store's products on sale (by name, product code or SKU, with Arabic
 * spelling folded), each row with its photo, price and stock. Pressing a
 * product opens it in place. Loading, a failed load and an empty catalog each
 * have their own state here, so the other two steps never wait for products.
 */
export function ProductPicker({ ctl }: { ctl: CreateOrder }) {
  const t = useT(CREATE_STRINGS);
  const { products } = ctl;

  return (
    <section aria-label={t.stepProducts} data-slot="order-picker">
      <ListToolbar
        search={{ value: ctl.search, onChange: ctl.setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }}
      />
      {ctl.fieldErrors.items && (
        <p role="alert" className="mt-2 px-4 text-xs leading-4 font-medium text-danger">
          {ctl.fieldErrors.items}
        </p>
      )}
      <div className="mt-3">
        <DataState
          loading={products.loading}
          error={products.error}
          onRetry={() => void products.refresh()}
          skeleton={<PickerSkeleton />}
        >
          {ctl.catalog.length === 0 ? (
            <div className="flex flex-col items-center rounded-[1rem] px-4 py-8 text-center">
              <IconPackage className="size-10 text-ink-soft" weight="duotone" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-ink">{t.noProducts}</p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-ink-soft">{t.noProductsHint}</p>
              <Button asChild variant="outline" className="mt-4 min-h-11 rounded-full px-5">
                <Link to="/catalog">{t.openCatalog}</Link>
              </Button>
            </div>
          ) : ctl.matches.length === 0 ? (
            <p role="status" className="px-4 py-8 text-center text-sm leading-6 text-ink-soft">
              {fmt(t.noMatches, { term: ctl.search.trim() })}
            </p>
          ) : (
            <ul data-slot="order-products" className="divide-y divide-line overflow-hidden rounded-[1rem] bg-paper-raised ring-1 ring-line">
              {ctl.matches.map((p) => (
                <ProductRow key={p.id} ctl={ctl} product={p} />
              ))}
            </ul>
          )}
        </DataState>
      </div>
    </section>
  );
}

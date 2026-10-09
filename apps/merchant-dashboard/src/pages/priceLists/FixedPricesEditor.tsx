import { useMemo, useState } from "react";
import { IconClose, IconDelete, IconPlus, IconSearch } from "@/components/icons";
import { Button, Input, cn } from "@store-builder/ui";
import { PRICE_LIST_LIMITS, type Product } from "@store-builder/api-client";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { SkeletonBar } from "@/components/DataState";
import { useToast } from "@/components/Toast";
import { toAsciiDigits } from "@/pages/loyalty/loyaltyStrings";
import { PRICE_LIST_CATALOG_CAP, variantOptionsLabel, type VariantRef } from "./priceListCatalog";
import { PRICE_LIST_STRINGS, type PriceListStrings } from "./priceListStrings";

/** One fixed price as it is typed: a variant, the quantity it starts from, and the price of a unit. */
export interface PriceRowDraft {
  key: string;
  variantId: string;
  quantity: string;
  price: string;
}

export type PriceRowErrors = Record<string, { quantity?: string; price?: string }>;

let nextKey = 1;
export const newRowKey = () => `row-${nextKey++}`;

/** The rows of a saved list, as drafts. */
export function rowsFromPrices(prices: ReadonlyArray<{ variantId: string; minQuantity: number; priceAmount: string }>): PriceRowDraft[] {
  return prices.map((p) => ({ key: newRowKey(), variantId: p.variantId, quantity: String(p.minQuantity), price: minorToMajorInput(p.priceAmount) }));
}

/** A typed quantity as a whole number from 1, or null. */
export function parseQuantity(raw: string): number | null {
  const ascii = toAsciiDigits(raw);
  if (!/^\d{1,6}$/.test(ascii)) return null;
  const n = Number(ascii);
  return n >= 1 && n <= PRICE_LIST_LIMITS.quantityMax ? n : null;
}

/** A typed price in minor units (0 and up, two decimals at most), or null. */
export function parsePrice(raw: string): number | null {
  const ascii = toAsciiDigits(raw);
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(ascii)) return null;
  const minor = majorToMinor(ascii);
  return Number.isFinite(minor) && minor >= 0 ? minor : null;
}

/** What is wrong with the rows, by row; {} when they can be saved. */
export function checkPriceRows(rows: PriceRowDraft[], t: PriceListStrings): PriceRowErrors {
  const errors: PriceRowErrors = {};
  const seen = new Map<string, string>();
  for (const row of rows) {
    const found: { quantity?: string; price?: string } = {};
    const quantity = parseQuantity(row.quantity);
    if (quantity === null) found.quantity = t.quantityInvalid;
    else {
      const id = `${row.variantId}:${quantity}`;
      if (seen.has(id)) found.quantity = t.quantityDuplicate;
      else seen.set(id, row.key);
    }
    if (!row.price.trim()) found.price = t.priceRequired;
    else if (parsePrice(row.price) === null) found.price = t.priceInvalid;
    if (found.quantity || found.price) errors[row.key] = found;
  }
  return errors;
}

interface Group {
  productId: string;
  product: Product | null;
  variants: Array<{ variantId: string; ref: VariantRef | null; rows: PriceRowDraft[] }>;
}

/** The rows by product then variant, in the order their product was added. */
function groupRows(rows: PriceRowDraft[], variants: Map<string, VariantRef>): Group[] {
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const ref = variants.get(row.variantId) ?? null;
    // A variant the catalogue no longer has stands alone, so it can still be seen and removed.
    const productId = ref?.product.id ?? `gone:${row.variantId}`;
    let group = groups.get(productId);
    if (!group) {
      group = { productId, product: ref?.product ?? null, variants: [] };
      groups.set(productId, group);
    }
    let entry = group.variants.find((v) => v.variantId === row.variantId);
    if (!entry) {
      entry = { variantId: row.variantId, ref, rows: [] };
      group.variants.push(entry);
    }
    entry.rows.push(row);
  }
  for (const group of groups.values()) {
    // The product's own order of options, whatever order they were typed in.
    const order = (group.product?.variants ?? []).map((v) => v.id);
    group.variants.sort((a, b) => order.indexOf(a.variantId) - order.indexOf(b.variantId));
  }
  return [...groups.values()];
}

const GRID = "grid grid-cols-[5.5rem_minmax(0,10rem)_2.75rem] items-start gap-2";

/**
 * The fixed prices of a list (handoff 205): the merchant adds a product, then
 * writes what a unit costs these customers — and, with «ضيف كمية», a lower
 * price from a quantity upward. One line per variant and quantity, as the API
 * keeps them.
 */
export function FixedPricesEditor({
  rows,
  onChange,
  errors,
  products,
  variants,
  catalogComplete,
  catalogLoading,
  currency,
  disabled,
}: {
  rows: PriceRowDraft[];
  onChange: (rows: PriceRowDraft[]) => void;
  errors: PriceRowErrors;
  products: Product[];
  variants: Map<string, VariantRef>;
  catalogComplete: boolean;
  catalogLoading: boolean;
  currency: string;
  disabled?: boolean;
}) {
  const t = useT(PRICE_LIST_STRINGS);
  const toast = useToast();
  const [picking, setPicking] = useState(rows.length === 0);
  const [search, setSearch] = useState("");

  const groups = useMemo(() => groupRows(rows, variants), [rows, variants]);
  const usedVariants = useMemo(() => new Set(rows.map((row) => row.variantId)), [rows]);
  const full = rows.length >= PRICE_LIST_LIMITS.pricesMax;

  const q = search.trim().toLowerCase();
  const shown = products.filter((p) => (p.variants?.length ?? 0) > 0 && (!q || p.name.toLowerCase().includes(q)));

  function addProduct(product: Product) {
    const fresh = (product.variants ?? [])
      .filter((v) => !usedVariants.has(v.id))
      .map((v) => ({ key: newRowKey(), variantId: v.id, quantity: "1", price: "" }));
    if (fresh.length === 0) return;
    onChange([...rows, ...fresh]);
    setPicking(false);
    setSearch("");
  }

  const patch = (key: string, change: Partial<PriceRowDraft>) => onChange(rows.map((row) => (row.key === key ? { ...row, ...change } : row)));

  function addTier(variantId: string) {
    // Right under the variant's own rows.
    let last = -1;
    rows.forEach((row, i) => {
      if (row.variantId === variantId) last = i;
    });
    const next = [...rows];
    next.splice(last + 1, 0, { key: newRowKey(), variantId, quantity: "", price: "" });
    onChange(next);
  }

  /** The first option's prices and quantities, written onto every other option of the product. */
  function copyToAll(group: Group) {
    const source = group.variants[0];
    if (!source || !group.product) return;
    const others = (group.product.variants ?? []).filter((v) => v.id !== source.variantId);
    const replaced = new Set(others.map((v) => v.id));
    const copies = others.flatMap((v) => source.rows.map((row) => ({ key: newRowKey(), variantId: v.id, quantity: row.quantity, price: row.price })));
    const kept = rows.filter((row) => !replaced.has(row.variantId));
    // Right after the first option's own rows, so the product's block stays where it is.
    let last = -1;
    kept.forEach((row, i) => {
      if (row.variantId === source.variantId) last = i;
    });
    kept.splice(last + 1, 0, ...copies);
    onChange(kept);
    toast.success(t.copied);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">{t.fixedHint}</p>

      {groups.map((group) => {
        const name = group.product?.name ?? t.unknownProduct;
        const allVariants = group.product?.variants ?? [];
        return (
          <section key={group.productId} className="rounded-[var(--radius)] border border-line">
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
              <h3 className="min-w-0 truncate text-sm font-semibold text-ink">
                <bdi>{name}</bdi>
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 text-ink-soft hover:text-danger"
                disabled={disabled}
                aria-label={fmt(t.removeProduct, { name })}
                title={fmt(t.removeProduct, { name })}
                onClick={() => {
                  const ids = new Set(group.variants.map((v) => v.variantId));
                  onChange(rows.filter((row) => !ids.has(row.variantId)));
                }}
              >
                <IconDelete className="size-4" aria-hidden />
              </Button>
            </div>

            <div className="divide-y divide-line">
              {group.variants.map((entry) => {
                const options = entry.ref ? variantOptionsLabel(entry.ref) : "";
                const normal = entry.ref ? Number(entry.ref.variant.priceAmount) : null;
                return (
                  <div key={entry.variantId} className="px-3 py-3">
                    <p className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm">
                      {options && (
                        <span className="font-medium text-ink">
                          <bdi>{options}</bdi>
                        </span>
                      )}
                      {normal !== null && <span className="text-xs text-ink-soft">{fmt(t.normalPrice, { price: formatMoney(normal, currency) })}</span>}
                    </p>
                    <div className={cn(GRID, "mb-1 text-xs font-medium text-ink-soft")} aria-hidden>
                      <span>{t.fromQuantity}</span>
                      <span>{t.price}</span>
                    </div>
                    <div className="space-y-2">
                      {entry.rows.map((row) => {
                        const rowErrors = errors[row.key];
                        const typed = parsePrice(row.price);
                        const notLower = normal !== null && typed !== null && typed >= normal;
                        return (
                          <div key={row.key} className={GRID} data-row={row.key}>
                            <Field label={t.fromQuantity} labelHidden error={rowErrors?.quantity}>
                              {(props) => (
                                <Input
                                  {...props}
                                  type="text"
                                  inputMode="numeric"
                                  dir="ltr"
                                  autoComplete="off"
                                  maxLength={6}
                                  placeholder="5"
                                  value={row.quantity}
                                  disabled={disabled}
                                  onChange={(e) => patch(row.key, { quantity: e.target.value })}
                                  className="h-11 text-center tabular-nums"
                                />
                              )}
                            </Field>
                            <Field label={t.price} labelHidden error={rowErrors?.price} hint={notLower ? t.notLower : undefined}>
                              {(props) => (
                                <div className="relative">
                                  <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-xs text-ink-soft">{currency}</span>
                                  <Input
                                    {...props}
                                    type="text"
                                    inputMode="decimal"
                                    dir="ltr"
                                    autoComplete="off"
                                    maxLength={13}
                                    placeholder="0.00"
                                    value={row.price}
                                    disabled={disabled}
                                    onChange={(e) => patch(row.key, { price: e.target.value })}
                                    className="h-11 ps-11 tabular-nums"
                                  />
                                </div>
                              )}
                            </Field>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-11 text-ink-soft hover:text-danger"
                              disabled={disabled}
                              aria-label={t.removePrice}
                              title={t.removePrice}
                              onClick={() => onChange(rows.filter((other) => other.key !== row.key))}
                            >
                              <IconClose className="size-4" aria-hidden />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="mt-1 min-h-11 px-2 text-primary" disabled={disabled || full} onClick={() => addTier(entry.variantId)}>
                      <IconPlus className="size-4" aria-hidden />
                      {t.addTier}
                    </Button>
                  </div>
                );
              })}
            </div>

            {allVariants.length > 1 && (
              <div className="border-t border-line px-2 py-1">
                <Button type="button" variant="ghost" size="sm" className="min-h-11 text-start whitespace-normal" disabled={disabled} onClick={() => copyToAll(group)}>
                  {fmt(t.copyToAll, { n: allVariants.length })}
                </Button>
              </div>
            )}
          </section>
        );
      })}

      {picking ? (
        <div className="space-y-2 rounded-[var(--radius)] border border-line p-3">
          <div className="relative">
            <IconSearch aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
            <Input
              type="text"
              dir="auto"
              autoComplete="off"
              aria-label={t.searchProducts}
              placeholder={t.searchProducts}
              value={search}
              disabled={disabled}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 ps-9"
            />
          </div>
          <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-[0.5rem] border border-line">
            {catalogLoading &&
              [0, 1, 2].map((i) => (
                <li key={i} aria-hidden className="px-3 py-4">
                  <SkeletonBar className={i === 1 ? "w-1/2" : "w-2/3"} />
                </li>
              ))}
            {!catalogLoading && shown.length === 0 && <li className="px-3 py-3 text-sm text-ink-soft">{t.noMatch}</li>}
            {shown.map((product) => {
              const list = product.variants ?? [];
              const added = list.every((v) => usedVariants.has(v.id));
              const prices = list.map((v) => Number(v.priceAmount));
              const low = Math.min(...prices);
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    disabled={disabled || added || full}
                    onClick={() => addProduct(product)}
                    className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-start text-sm text-ink hover:bg-paper-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:text-ink-soft disabled:hover:bg-transparent"
                  >
                    <span className="min-w-0 truncate">
                      <bdi>{product.name}</bdi>
                    </span>
                    <span className="shrink-0 text-xs text-ink-soft tabular-nums">{added ? t.alreadyAdded : formatMoney(low, currency)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!catalogComplete && <p className="text-xs text-ink-soft">{fmt(t.catalogCapped, { n: PRICE_LIST_CATALOG_CAP })}</p>}
          {rows.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setPicking(false)}>
              {t.closePicker}
            </Button>
          )}
        </div>
      ) : (
        <Button type="button" variant="outline" className="min-h-11" disabled={disabled || full} onClick={() => setPicking(true)}>
          <IconPlus className="size-4" aria-hidden />
          {t.addProduct}
        </Button>
      )}
      {full && <p className="text-xs font-medium text-accent-dark">{fmt(t.tooManyPrices, { max: PRICE_LIST_LIMITS.pricesMax })}</p>}
    </div>
  );
}

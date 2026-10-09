import { useEffect, useId, useMemo, useState } from "react";
import { IconPlus } from "@/components/icons";
import { Button, Input } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";
import { INVENTORY_STRINGS } from "./inventoryStrings";

export interface PickVariant {
  variantId: string;
  productId: string;
  productName: string;
  /** Its options or SKU; "" for a product's only variant. */
  detail: string;
  /** Words after the variant in the list, e.g. "12 available". */
  note?: string;
  /** Listed but not choosable (nothing free to move, say). */
  disabled?: boolean;
}

/**
 * "Add a product" for a list of variant lines (a transfer, a purchase order):
 * choose the product, then its variant, then Add — the same two selects the
 * order's "Edit items" dialog uses. A variant already on the list is shown
 * as added and can't be chosen twice (the API takes one line per variant).
 */
export function VariantAddRow({
  variants,
  loading = false,
  failed = false,
  taken,
  onAdd,
  legend,
  query,
  onQuery,
  disabled = false,
  onSelect,
}: {
  variants: PickVariant[];
  loading?: boolean;
  failed?: boolean;
  /** Variant ids already on the list. */
  taken: ReadonlySet<string>;
  onAdd: (variant: PickVariant) => void;
  legend?: string;
  /** Pass both for a search box above the selects (a list the server cuts short). */
  query?: string;
  onQuery?: (query: string) => void;
  disabled?: boolean;
  /**
   * For a field that holds one variant instead of a list to add to (a stock
   * lot's product, handoff 230): told the current choice whenever it changes
   * (null while there is none), and the Add button is left out.
   */
  onSelect?: (variant: PickVariant | null) => void;
}) {
  const t = useT(INVENTORY_STRINGS);
  const searchId = useId();
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");

  const products = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of variants) if (!seen.has(v.productId)) seen.set(v.productId, v.productName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [variants]);
  const ofProduct = useMemo(() => variants.filter((v) => v.productId === productId), [variants, productId]);
  const free = (v: PickVariant) => !v.disabled && !taken.has(v.variantId);
  const chosen = ofProduct.find((v) => v.variantId === variantId);

  // A new product, or the chosen variant just added: move to the next one that can still be added.
  useEffect(() => {
    if (!productId) {
      if (variantId) setVariantId("");
      return;
    }
    if (chosen && free(chosen)) return;
    const next = ofProduct.find(free) ?? ofProduct[0];
    setVariantId(next?.variantId ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, ofProduct, taken]);

  // A search that no longer lists the chosen product clears the choice.
  useEffect(() => {
    if (productId && !loading && !products.some((p) => p.id === productId)) setProductId("");
  }, [products, productId, loading]);

  // A one-variant field hears each change of the choice (see `onSelect`).
  const selectedId = chosen && free(chosen) ? chosen.variantId : null;
  useEffect(() => {
    onSelect?.(variants.find((v) => v.variantId === selectedId) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const optionText = (v: PickVariant) =>
    [v.detail || t.singleVariant, taken.has(v.variantId) ? t.alreadyAdded : v.note].filter(Boolean).join(" — ");

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium text-ink">{legend ?? t.addProduct}</legend>
      {onQuery && (
        <div>
          <label htmlFor={searchId} className="sr-only">
            {t.searchProducts}
          </label>
          <Input
            id={searchId}
            type="search"
            dir="auto"
            autoComplete="off"
            maxLength={100}
            value={query ?? ""}
            placeholder={t.searchProducts}
            onChange={(e) => onQuery(e.target.value)}
            className="h-11"
          />
        </div>
      )}
      <div className={onSelect ? "grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]" : "grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto]"}>
        <Select value={productId} disabled={loading} onChange={(e) => setProductId(e.target.value)} className="h-11" aria-label={t.product}>
          <option value="">{loading ? t.pickerLoading : t.chooseProduct}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select
          value={variantId}
          disabled={!productId || ofProduct.length === 0}
          onChange={(e) => setVariantId(e.target.value)}
          className="h-11"
          aria-label={t.variant}
        >
          {ofProduct.map((v) => (
            <option key={v.variantId} value={v.variantId} disabled={!free(v)}>
              {optionText(v)}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="outline"
          // Left out of a one-variant field: its choice is reported as it is made.
          className={onSelect ? "hidden" : "min-h-11"}
          disabled={!chosen || !free(chosen)}
          onClick={() => {
            if (chosen && free(chosen)) onAdd(chosen);
          }}
        >
          <IconPlus className="size-4" aria-hidden />
          {t.add}
        </Button>
      </div>
      {failed ? (
        <p role="alert" className="text-xs text-danger">
          {t.pickerFailed}
        </p>
      ) : (
        !loading && products.length === 0 && <p className="text-xs text-ink-soft">{t.pickerEmpty}</p>
      )}
    </fieldset>
  );
}

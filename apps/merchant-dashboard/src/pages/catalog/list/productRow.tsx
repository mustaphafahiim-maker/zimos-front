import { useMemo } from "react";
import { productPreorderOf, type Product, type ProductMedia, type Variant } from "@store-builder/api-client";
import { StatusBadge } from "@/components/StatusBadge";
import { getIntlLocale, getLocale, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { formatMoney, formatProductCode, parseMoney } from "@/lib/format";
import { primaryImage } from "@/lib/media";
import { pluralOf } from "@/lib/plural";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCatalogLabels } from "../catalogLabels";
import { PreorderBadge } from "../components/PreorderBadge";
import { ProductFlag } from "./ProductFlag";
import type { CatalogSort } from "./useCatalogQuery";

const STRINGS = {
  en: {
    noWeight: "No weight",
    noWeightHint: "A variant has no weight. Shipping uses your default item weight for it.",
    soldOut: "Sold out",
    variants_one: "1 variant",
    variants_other: "{n} variants",
    notTracked: "Not tracked",
    noVariants: "No variants",
    defaultVariant: "Default",
  },
  ar: {
    noWeight: "من غير وزن",
    noWeightHint: "فيه نوع من غير وزن. الشحن هيستخدم الوزن الافتراضي بداله.",
    soldOut: "خلص",
    variants_one: "نوع واحد",
    variants_two: "نوعين",
    variants_few: "{n} أنواع",
    variants_other: "{n} نوع",
    notTracked: "مش متتبّع",
    noVariants: "من غير أنواع",
    defaultVariant: "الافتراضي",
  },
} satisfies Messages;

/** A product as a row of the list draws it: worked out once, for the table, the cards and the grid alike. */
export interface ProductRowView {
  product: Product;
  /** The product's own page. */
  to: string;
  /** "#482910573", or null on a response without the code. */
  code: string | null;
  image: ProductMedia | null;
  /**
   * The variants the row speaks for — its price range, its stock, what can be
   * edited in place: the active ones. When none is active (an archived
   * product: archiving takes its variants down with it) all of them, so the
   * row still says what the product costs.
   */
  variants: Variant[];
  currency: string;
  /** The lowest price among `variants`, minor units; null without variants. */
  priceMin: number | null;
  /** "250.00 EGP", or "250.00 – 320.00 EGP" across variants; null without variants. */
  priceLabel: string | null;
  /** The quantity is counted: a physical product with "Track quantity" on. */
  tracked: boolean;
  /** Units on hand across `variants`; null when not counted or without variants. */
  stockTotal: number | null;
  /** Counted, nothing left to sell on any variant, and not taking pre-orders. */
  soldOut: boolean;
  /** A live physical product with an active variant that has no weight set. */
  missingWeight: boolean;
  /** Price and stock can be changed from the list: not archived, and `variants` are active ones. */
  editable: boolean;
  /** Its page in the store; null for an archived product, which the store does not show. */
  storeUrl: string | null;
}

/** "قميص كتان / M": a variant's option values, else its SKU, else `fallback`. */
export function variantName(variant: Variant, fallback: string): string {
  return Object.values(variant.optionValues ?? {}).filter(Boolean).join(" / ") || variant.sku || fallback;
}

/** 25000 (minor units) → "250"; 19950 → "199.50": the price as the edit field starts with it. */
export function priceInput(minor: string | number | null | undefined): string {
  const major = parseMoney(minor) / 100;
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}

/** Digital products and services have no stock to count; neither has a physical one with "Track quantity" off. */
export function productTracked(product: Product): boolean {
  if (product.productType === "digital" || product.productType === "service") return false;
  // backend catalog/stockTracking.js; the Product type does not name the field yet.
  return (product as Product & { trackInventory?: boolean }).trackInventory !== false;
}

/** One amount, or "low – high" with the currency said once. */
function priceRange(low: number, high: number, currency: string): string {
  if (low === high) return formatMoney(low, currency);
  let from: string;
  try {
    from = new Intl.NumberFormat(getLocale() === "ar" ? "ar-EG" : "en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(low / 100);
  } catch {
    from = (low / 100).toFixed(2);
  }
  return `${from} – ${formatMoney(high, currency)}`;
}

function buildRow(product: Product, workspaceId: string): ProductRowView {
  const all = product.variants ?? [];
  const active = all.filter((variant) => variant.status === "active");
  const variants = active.length > 0 ? active : all;
  const archived = product.status === "archived";
  const prices = variants.map((variant) => parseMoney(variant.priceAmount));
  const currency = variants[0]?.currency ?? "EGP";
  const tracked = productTracked(product);
  const priceMin = prices.length > 0 ? Math.min(...prices) : null;

  return {
    product,
    to: `/catalog/${product.id}`,
    code: formatProductCode(product.productCode),
    image: primaryImage(product),
    variants,
    currency,
    priceMin,
    priceLabel: priceMin === null ? null : priceRange(priceMin, Math.max(...prices), currency),
    tracked,
    stockTotal: tracked && variants.length > 0 ? variants.reduce((sum, variant) => sum + variant.stockOnHand, 0) : null,
    soldOut:
      tracked &&
      !archived &&
      active.length > 0 &&
      !productPreorderOf(product) &&
      active.every((variant) => !variant.allowOverselling && variant.stockOnHand - variant.reservedStock <= 0),
    missingWeight: product.productType === "physical" && !archived && active.some((variant) => variant.weightGrams === null),
    editable: !archived && active.length > 0,
    storeUrl: archived ? null : `${STOREFRONT_URL}/store/${workspaceId}/products/${product.slug}`,
  };
}

/** The rows of the list, worked out when the products change — not on every tick of a checkbox. */
export function useProductRows(products: readonly Product[]): ProductRowView[] {
  const workspaceId = useWorkspaceId();
  const { locale } = useLocale();
  return useMemo(
    () => products.map((product) => buildRow(product, workspaceId)),
    // Money is written in the language's digits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, workspaceId, locale]
  );
}

/**
 * The rows in the order asked for. The API has one order and no sort, so this
 * arranges what is loaded; products without a price (or without counted stock)
 * go last in the orders that need one.
 */
export function sortRows(rows: ProductRowView[], sort: CatalogSort): ProductRowView[] {
  if (sort === "default") return rows;
  const lastIfNull = (a: number | null, b: number | null, direction: 1 | -1): number => {
    if (a === null) return b === null ? 0 : 1;
    if (b === null) return -1;
    return direction * (a - b);
  };
  const out = [...rows];
  switch (sort) {
    case "newest":
      out.sort((a, b) => Date.parse(b.product.createdAt) - Date.parse(a.product.createdAt));
      break;
    case "name": {
      const collator = new Intl.Collator(getIntlLocale(), { numeric: true, sensitivity: "base" });
      out.sort((a, b) => collator.compare(a.product.name, b.product.name));
      break;
    }
    case "price_asc":
      out.sort((a, b) => lastIfNull(a.priceMin, b.priceMin, 1));
      break;
    case "price_desc":
      out.sort((a, b) => lastIfNull(a.priceMin, b.priceMin, -1));
      break;
    case "stock_asc":
      out.sort((a, b) => lastIfNull(a.stockTotal, b.stockTotal, 1));
      break;
  }
  return out;
}

/** The words every shape of the row shares. */
export function useProductRowText() {
  const t = useT(STRINGS);
  return useMemo(
    () => ({
      /** «٣ أنواع» */
      variantCount: (count: number) => pluralOf(t, "variants", count),
      notTracked: t.notTracked,
      noVariants: t.noVariants,
      defaultVariant: t.defaultVariant,
    }),
    [t]
  );
}

/** The status chip. It travels into the product page's header (lib/viewTransition.ts). */
export function ProductStatusChip({ product }: { product: Product }) {
  const labels = useCatalogLabels();
  return (
    <span data-vt-part="status" className="inline-flex">
      <StatusBadge value={product.status} text={labels.status(product.status)} />
    </span>
  );
}

/** The small chips after the status: sold out, no weight, pre-orders. Nothing when none applies. */
export function ProductFlags({ row }: { row: ProductRowView }) {
  const t = useT(STRINGS);
  return (
    <>
      {row.soldOut && <ProductFlag tone="danger">{t.soldOut}</ProductFlag>}
      {row.missingWeight && (
        <ProductFlag tone="attention" title={t.noWeightHint}>
          {t.noWeight}
        </ProductFlag>
      )}
      <PreorderBadge product={row.product} />
    </>
  );
}

/** The row (table), card (phone) or tile (grid) of a product, as it is in the page now. */
export function productRowElement(productId: string): Element | null {
  return document.querySelector(`[data-product-row="${productId}"]`);
}

/** Things in a row that are pressed for themselves: a press on one is not a press on the row. */
const ROW_CONTROLS = "a, button, input, label, select, textarea, [role='button'], [role='menuitem']";

/** Whether a click that reached the row was meant for the row: inside it, not on one of its controls, not the end of a text selection. */
export function isRowPress(target: EventTarget, row: HTMLElement): boolean {
  if (!(target instanceof Element) || !row.contains(target)) return false;
  const control = target.closest(ROW_CONTROLS);
  if (control && control !== row && row.contains(control)) return false;
  return (window.getSelection()?.toString() ?? "") === "";
}

/** Puts `value` on the clipboard; false when the browser would not. */
export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // No permission, or an origin without the clipboard API: the old selection way still works there.
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }
}

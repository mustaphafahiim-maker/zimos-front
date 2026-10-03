/**
 * Catalog additions of lane 3 (backend: src/modules/catalog/productPage.js and
 * the catalog routes): the product's display priority, special-offer line,
 * external references, option display types, product page settings and
 * structured content (features, testimonials, FAQs).
 *
 * The fields ride on the existing product endpoints
 * (/workspaces/:workspaceId/catalog/products/:productId, products.manage) and
 * on the public product (/store/:workspaceId/products/:idOrSlug). All exported
 * names here start with `catalog` / `Catalog`, or name a product-page type.
 *
 * `pageSettings` keeps the backend's snake_case keys. The server stores only
 * what was sent and fills the rest with defaults on the public product, so a
 * PATCH should send the whole object.
 */
import type { ApiClient } from "../client";
import type { Product, StorefrontProduct } from "../types";

// ------------------------------------------------------------------ types --

export type ProductOptionDisplayType = "buttons" | "dropdown" | "color" | "image";

export const PRODUCT_OPTION_DISPLAY_TYPES: ProductOptionDisplayType[] = ["buttons", "dropdown", "color", "image"];

export interface ProductOptionDisplay {
  name: string;
  values?: string[];
  displayType?: ProductOptionDisplayType;
  /** value → `#rrggbb`, for displayType "color". */
  swatches?: Record<string, string>;
  /** value → image URL, for displayType "image". */
  images?: Record<string, string>;
}

export interface ProductPageSettings {
  /** "Buy now" goes straight to the checkout instead of the cart. */
  skip_cart: boolean;
  buy_now_text: string | null;
  sticky_buy_button: boolean;
  /** The order form inside the product page. */
  inline_checkout: boolean;
  checkout_before_description: boolean;
  reviews_enabled: boolean;
  hide_header: boolean;
  hide_quantity_selector: boolean;
  /** Left out of every listing; opens by its link only. */
  hidden: boolean;
  hide_related_products: boolean;
  landing_page_id: string | null;
  /** A real deadline: after it the server sells at the compare-at price. */
  countdown: { ends_at: string } | null;
}

export const PRODUCT_PAGE_SETTINGS_DEFAULTS: ProductPageSettings = {
  skip_cart: false,
  buy_now_text: null,
  sticky_buy_button: true,
  inline_checkout: true,
  checkout_before_description: true,
  reviews_enabled: true,
  hide_header: false,
  hide_quantity_selector: false,
  hidden: false,
  hide_related_products: false,
  landing_page_id: null,
  countdown: null,
};

export interface ProductCmsFeature {
  title: string;
  description?: string;
  image?: string | null;
}

export interface ProductCmsTestimonial {
  name: string;
  text: string;
  image?: string | null;
  rating?: number | null;
}

export interface ProductCmsFaq {
  question: string;
  answer: string;
}

export interface ProductCms {
  features: ProductCmsFeature[];
  testimonials: ProductCmsTestimonial[];
  faqs: ProductCmsFaq[];
}

export interface ProductExternalRef {
  platform: string;
  code: string;
}

/** What lane 3 added to the staff product. Absent on a response from before the fields. */
export interface CatalogProductExtras {
  priority?: number;
  specialOfferText?: string | null;
  externalRefs?: ProductExternalRef[];
  pageSettings?: Partial<ProductPageSettings>;
  cms?: Partial<ProductCms>;
}

export type CatalogProduct = Omit<Product, "options"> & CatalogProductExtras & { options: ProductOptionDisplay[] };

export interface CatalogProductPatch extends CatalogProductExtras {
  options?: ProductOptionDisplay[];
}

/** The public product with the page fields the storefront draws from. */
export interface StorefrontProductPage {
  options: ProductOptionDisplay[];
  priority: number;
  specialOfferText: string | null;
  shippingMode: string;
  pageSettings: ProductPageSettings;
  cms: ProductCms;
}

// ---------------------------------------------------------------- helpers --

export function resolveProductPageSettings(stored: Partial<ProductPageSettings> | null | undefined): ProductPageSettings {
  const out = { ...PRODUCT_PAGE_SETTINGS_DEFAULTS };
  if (!stored) return out;
  for (const key of Object.keys(out) as (keyof ProductPageSettings)[]) {
    const value = stored[key];
    if (value !== undefined && value !== "") (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

export function resolveProductCms(stored: Partial<ProductCms> | null | undefined): ProductCms {
  return {
    features: Array.isArray(stored?.features) ? stored.features : [],
    testimonials: Array.isArray(stored?.testimonials) ? stored.testimonials : [],
    faqs: Array.isArray(stored?.faqs) ? stored.faqs : [],
  };
}

/** Reads the page fields off a public product, with defaults for an older response. */
export function storefrontProductPage(product: StorefrontProduct): StorefrontProductPage {
  const raw = product as StorefrontProduct & Partial<StorefrontProductPage>;
  return {
    options: Array.isArray(raw.options) ? raw.options : [],
    priority: raw.priority ?? 0,
    specialOfferText: raw.specialOfferText ?? null,
    shippingMode: raw.shippingMode ?? "standard",
    pageSettings: resolveProductPageSettings(raw.pageSettings),
    cms: resolveProductCms(raw.cms),
  };
}

// -------------------------------------------------------------- endpoints --

const base = (workspaceId: string) => `/workspaces/${workspaceId}/catalog`;

export async function catalogGetProduct(client: ApiClient, workspaceId: string, productId: string): Promise<CatalogProduct> {
  const { product } = await client.request<{ product: CatalogProduct }>(`${base(workspaceId)}/products/${productId}`);
  return product;
}

export async function catalogUpdateProduct(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  patch: CatalogProductPatch
): Promise<CatalogProduct> {
  const { product } = await client.request<{ product: CatalogProduct }>(`${base(workspaceId)}/products/${productId}`, {
    method: "PATCH",
    body: patch,
  });
  return product;
}

// ------------------------------------------------- bulk edit and duplicate --

export type CatalogBulkPrice =
  | { mode: "set"; value: number }
  | { mode: "increase_percent" | "decrease_percent"; value: number };

export interface CatalogBulkChanges {
  status?: "draft" | "active" | "archived";
  /** "extra_fee" needs an amount per product, so it is not a bulk choice. */
  shippingMode?: "standard" | "free";
  collection?: { id: string; action: "add" | "remove" };
  /** Applied to every active variant of the selected products (minor units for "set"). */
  price?: CatalogBulkPrice;
}

export interface CatalogBulkResult {
  updated: number;
  variantsRepriced: number;
}

/** One row of the variant table: the variant and only the fields that changed. */
export interface CatalogVariantRowPatch {
  id: string;
  sku?: string | null;
  barcode?: string | null;
  priceAmount?: number;
  compareAtAmount?: number | null;
  costAmount?: number | null;
  /** The count on hand; the server records the difference as an adjustment. */
  stockOnHand?: number;
  allowOverselling?: boolean;
  status?: "active" | "archived";
}

/** 422 PRODUCT_NOT_FOUND when an id is not in this store — nothing is changed then. */
export async function catalogBulkEditProducts(
  client: ApiClient,
  workspaceId: string,
  productIds: string[],
  changes: CatalogBulkChanges
): Promise<CatalogBulkResult> {
  return client.request<CatalogBulkResult>(`${base(workspaceId)}/products/bulk`, {
    method: "POST",
    body: { productIds, changes },
  });
}

/** A draft copy with the variants (no stock, no SKU), offers and collections. */
export async function catalogDuplicateProduct(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  name?: string
): Promise<CatalogProduct> {
  const { product } = await client.request<{ product: CatalogProduct }>(
    `${base(workspaceId)}/products/${productId}/duplicate`,
    { method: "POST", body: name ? { name } : {} }
  );
  return product;
}

/** 409 DUPLICATE_RESOURCE when a SKU is already used by another variant. */
export async function catalogBulkUpdateVariants(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  variants: CatalogVariantRowPatch[]
): Promise<{ updated: number }> {
  return client.request<{ updated: number }>(`${base(workspaceId)}/products/${productId}/variants/bulk`, {
    method: "PATCH",
    body: { variants },
  });
}

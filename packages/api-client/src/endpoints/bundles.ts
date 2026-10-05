/**
 * Quantity bundles — "buy 2 and save 5%, buy 3 and save 10%", reusable across
 * products (backend: src/modules/bundles).
 *
 * Mounted at /workspaces/:workspaceId/bundles (products.view to read,
 * products.manage to change). All exported names here start with `bundles` /
 * `Bundle`, or name a storefront bundle type.
 *
 * A tier's `discountValue` by `discountType`:
 *   percentage        percent × 100 (500 = 5%)
 *   fixed_price       what the tier's units cost together, minor units
 *   fixed_amount_off  minor units off the tier's units together
 *   buy_x_get_y       how many of the tier's `quantity` units are free
 *
 * The server prices everything: the order, the cart, the shipping quote
 * (its `subtotal` is bundle-priced and `bundleDiscountAmount` says by how
 * much) and each tier per variant on the public product (`product.bundle`).
 *
 * Notable codes: VALIDATION_ERROR (422 — two tiers with the same quantity, a
 * percentage over 100%, free units not below the tier quantity),
 * PRODUCT_NOT_FOUND (422 — assigning a product that is not in this store).
 */
import type { ApiClient } from "../client";
import type { StorefrontProduct } from "../types";

// ------------------------------------------------------------------ types --

export type BundleDiscountType = "percentage" | "fixed_price" | "fixed_amount_off" | "buy_x_get_y";
export type BundleDisplayStyle = "cards" | "radio" | "dropdown";

export const BUNDLE_DISCOUNT_TYPES: BundleDiscountType[] = ["percentage", "fixed_price", "fixed_amount_off", "buy_x_get_y"];
export const BUNDLE_DISPLAY_STYLES: BundleDisplayStyle[] = ["cards", "radio", "dropdown"];
export const BUNDLE_MAX_TIERS = 8;

export interface BundleTierInput {
  title?: string | null;
  quantity: number;
  discountType: BundleDiscountType;
  discountValue: number;
  /** A small highlight on the tier, e.g. "Best seller". */
  label?: string | null;
  stickerText?: string | null;
  /** For tracking and integrations. */
  sku?: string | null;
  freeShipping?: boolean;
  isDefault?: boolean;
}

export interface BundleTierDto extends BundleTierInput {
  id: string;
  position: number;
  freeShipping: boolean;
  isDefault: boolean;
}

export interface BundleProductRef {
  id: string;
  name: string;
  status: string;
  media?: unknown;
}

export interface BundleDto {
  id: string;
  name: string;
  displayStyle: BundleDisplayStyle;
  isActive: boolean;
  tiers: BundleTierDto[];
  productCount: number;
  /** On a single bundle only. */
  products?: BundleProductRef[];
  createdAt: string;
  updatedAt: string;
}

export interface BundlePayload {
  name: string;
  displayStyle?: BundleDisplayStyle;
  isActive?: boolean;
  /** Sent whole: on update it replaces every tier. */
  tiers: BundleTierInput[];
}

/** One tier of a draft, priced by the server for a unit price. */
export interface BundlePreviewTier {
  quantity: number;
  full: number;
  discount: number;
  total: number;
  perUnit: number;
  freeShipping: boolean;
}

/** A tier as the storefront draws it; `prices` is keyed by variant id. */
export interface StorefrontBundleTier {
  id: string;
  title: string | null;
  quantity: number;
  discountType: BundleDiscountType;
  label: string | null;
  stickerText: string | null;
  freeShipping: boolean;
  isDefault: boolean;
  prices: Record<string, { full: number; total: number; discount: number }>;
}

export interface StorefrontBundle {
  id: string;
  name: string;
  displayStyle: BundleDisplayStyle;
  tiers: StorefrontBundleTier[];
}

/** The product's bundle off a public product, or null (none, or an older response). */
export function storefrontProductBundle(product: StorefrontProduct): StorefrontBundle | null {
  const bundle = (product as StorefrontProduct & { bundle?: StorefrontBundle | null }).bundle;
  return bundle && Array.isArray(bundle.tiers) && bundle.tiers.length > 0 ? bundle : null;
}

// -------------------------------------------------------------- endpoints --

const base = (workspaceId: string) => `/workspaces/${workspaceId}/bundles`;

export async function bundlesList(client: ApiClient, workspaceId: string): Promise<BundleDto[]> {
  const { bundles } = await client.request<{ bundles: BundleDto[] }>(base(workspaceId));
  return bundles;
}

export async function bundlesGet(client: ApiClient, workspaceId: string, bundleId: string): Promise<BundleDto> {
  const { bundle } = await client.request<{ bundle: BundleDto }>(`${base(workspaceId)}/${bundleId}`);
  return bundle;
}

export async function bundlesCreate(client: ApiClient, workspaceId: string, payload: BundlePayload): Promise<BundleDto> {
  const { bundle } = await client.request<{ bundle: BundleDto }>(base(workspaceId), { method: "POST", body: payload });
  return bundle;
}

export async function bundlesUpdate(
  client: ApiClient,
  workspaceId: string,
  bundleId: string,
  payload: Partial<BundlePayload>
): Promise<BundleDto> {
  const { bundle } = await client.request<{ bundle: BundleDto }>(`${base(workspaceId)}/${bundleId}`, {
    method: "PATCH",
    body: payload,
  });
  return bundle;
}

/** The bundle's products simply stop having a bundle. */
export async function bundlesDelete(client: ApiClient, workspaceId: string, bundleId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/${bundleId}`, { method: "DELETE" });
}

/** Exactly these products use the bundle (a product has one bundle at most). */
export async function bundlesSetProducts(
  client: ApiClient,
  workspaceId: string,
  bundleId: string,
  productIds: string[]
): Promise<BundleDto> {
  const { bundle } = await client.request<{ bundle: BundleDto }>(`${base(workspaceId)}/${bundleId}/products`, {
    method: "PUT",
    body: { productIds },
  });
  return bundle;
}

/** Prices a draft's tiers for one unit price — the form's live preview. */
export async function bundlesPreview(
  client: ApiClient,
  workspaceId: string,
  tiers: BundleTierInput[],
  unitAmount: number,
  signal?: AbortSignal
): Promise<BundlePreviewTier[]> {
  const body = await client.request<{ tiers: BundlePreviewTier[] }>(`${base(workspaceId)}/preview`, {
    method: "POST",
    body: { tiers, unitAmount },
    signal,
  });
  return body.tiers;
}

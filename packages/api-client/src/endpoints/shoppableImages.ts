/**
 * Shoppable images (backend: src/modules/shoppableImages): a picture with
 * clickable points, each linked to a product.
 *
 * Staff routes: /workspaces/:workspaceId/shoppable-images (products.view /
 * products.manage). Public: /store/:workspaceId/shoppable-images/:slugOrId.
 *
 * Notable codes: PRODUCT_NOT_FOUND (422 — a point names a missing product).
 */
import type { ApiClient } from "../client";
import type { StorefrontProduct } from "../types";

/** `x` and `y` are percentages (0–100) of the image's width and height. */
export interface ShoppableHotspot {
  x: number;
  y: number;
  productId: string;
}

export interface ShoppableImage {
  id: string;
  title: string;
  /** Its public page is /looks/<slug> on the storefront. */
  slug: string;
  imageUrl: string;
  hotspots: ShoppableHotspot[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppableImagePayload {
  title: string;
  slug?: string | null;
  imageUrl: string;
  hotspots?: ShoppableHotspot[];
  isActive?: boolean;
}

/** The storefront's view: each point carries its product, priced by the server. */
export interface PublicShoppableImage {
  id: string;
  title: string;
  slug: string;
  imageUrl: string;
  hotspots: { x: number; y: number; product: StorefrontProduct }[];
}

const shoppableBase = (workspaceId: string) => `/workspaces/${workspaceId}/shoppable-images`;

export async function shoppableImagesList(client: ApiClient, workspaceId: string): Promise<ShoppableImage[]> {
  const { images } = await client.request<{ images: ShoppableImage[] }>(shoppableBase(workspaceId));
  return images;
}

export async function shoppableImagesCreate(client: ApiClient, workspaceId: string, payload: ShoppableImagePayload): Promise<ShoppableImage> {
  const { image } = await client.request<{ image: ShoppableImage }>(shoppableBase(workspaceId), { method: "POST", body: payload });
  return image;
}

export async function shoppableImagesUpdate(
  client: ApiClient,
  workspaceId: string,
  imageId: string,
  payload: Partial<ShoppableImagePayload>
): Promise<ShoppableImage> {
  const { image } = await client.request<{ image: ShoppableImage }>(`${shoppableBase(workspaceId)}/${imageId}`, { method: "PATCH", body: payload });
  return image;
}

export async function shoppableImagesDelete(client: ApiClient, workspaceId: string, imageId: string): Promise<void> {
  await client.request<unknown>(`${shoppableBase(workspaceId)}/${imageId}`, { method: "DELETE" });
}

/** Storefront: by slug or id. Points whose product is no longer active are left out. */
export async function storeGetShoppableImage(client: ApiClient, workspaceRef: string, slugOrId: string): Promise<PublicShoppableImage> {
  const { image } = await client.request<{ image: PublicShoppableImage }>(`/store/${workspaceRef}/shoppable-images/${encodeURIComponent(slugOrId)}`, { auth: false });
  return image;
}

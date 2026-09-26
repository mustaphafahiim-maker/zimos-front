import { cache } from "react";
import type { CSSProperties } from "react";
import {
  ApiError,
  type StorefrontCollection,
  type StorefrontMeta,
  type StorefrontProductDetail,
} from "@store-builder/api-client";
import { brandVars } from "./brandTheme";
import { createServerStorefrontApiClient } from "./serverApiClient";

/**
 * Store metadata, deduped per request. The layout needs it for the brand
 * colours and every page under it needs the name/currency, so `cache()` keeps
 * that to a single API call per render instead of one per component.
 *
 * Returns null for an unknown workspace so callers can `notFound()`.
 */
export const getStoreMeta = cache(async (workspaceId: string): Promise<StorefrontMeta | null> => {
  const client = await createServerStorefrontApiClient();
  try {
    return await client.getStorefrontMeta(workspaceId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
});

/**
 * One product, deduped per request so `generateMetadata` and the page share a
 * single API call. Null on 404.
 */
export const getStorefrontProduct = cache(
  async (workspaceId: string, idOrSlug: string): Promise<StorefrontProductDetail | null> => {
    const client = await createServerStorefrontApiClient();
    try {
      return await client.getStorefrontProduct(workspaceId, idOrSlug);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }
);

/**
 * The store's public collections, deduped per request the same way as
 * `getStoreMeta` — the store layout reads this once for the mobile category
 * strip, and it costs nothing extra when the home page's fallback catalogue
 * (`page.tsx`) also asks for the collection list in the same render, since
 * both would otherwise fire the same request. Empty, not thrown, on any
 * failure: a strip with nothing to show just doesn't render.
 */
export const getStoreCollections = cache(
  async (workspaceId: string): Promise<StorefrontCollection[]> => {
    const client = await createServerStorefrontApiClient();
    try {
      return await client.listStorefrontCollections(workspaceId);
    } catch {
      return [];
    }
  }
);

/**
 * Inline custom properties for the store wrapper. Anything the merchant has not
 * set is left out entirely, so the stylesheet's own default palette (which is
 * light/dark aware) still applies — a single inline hex could not be.
 *
 * The mapping itself (colours with a contrast-picked foreground, plus the font
 * and corner choices) lives in ./brandTheme, so the editor preview can apply
 * unsaved changes exactly the same way.
 */
export function brandStyle(themeSettings: Record<string, unknown> | undefined): CSSProperties {
  return brandVars(themeSettings) as CSSProperties;
}

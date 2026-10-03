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

/** What the API tells an unavailable store's page: just enough to name it. */
export interface UnavailableStore {
  name: string;
  slug: string;
  defaultLocale?: string | null;
  logoUrl?: string | null;
}

export type StoreState =
  | { kind: "ok"; store: StorefrontMeta }
  | { kind: "unavailable"; store: UnavailableStore }
  | { kind: "missing" };

/** The API's answer for every public route of a restricted store. */
export function isStoreUnavailable(err: unknown): boolean {
  return err instanceof ApiError && err.status === 423 && err.code === "STORE_UNAVAILABLE";
}

/**
 * The store, whether it is serving, and whether it exists — deduped per
 * request. The layout reads this to draw either the store or the "currently
 * unavailable" page (a store suspended by the platform, or one whose
 * subscription has lapsed past its grace day answers 423 STORE_UNAVAILABLE on
 * every route).
 */
export const getStoreState = cache(async (workspaceId: string): Promise<StoreState> => {
  const client = await createServerStorefrontApiClient();
  try {
    return { kind: "ok", store: await client.getStorefrontMeta(workspaceId) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { kind: "missing" };
    if (isStoreUnavailable(err)) {
      const details = (err as ApiError).details as { store?: UnavailableStore } | undefined;
      return { kind: "unavailable", store: details?.store ?? { name: "", slug: workspaceId } };
    }
    throw err;
  }
});

/**
 * Store metadata, deduped per request. The layout needs it for the brand
 * colours and every page under it needs the name/currency, so `cache()` keeps
 * that to a single API call per render instead of one per component.
 *
 * Returns null for an unknown workspace so callers can `notFound()` — and for
 * an unavailable one, whose pages the layout never renders.
 */
export const getStoreMeta = cache(async (workspaceId: string): Promise<StorefrontMeta | null> => {
  const state = await getStoreState(workspaceId);
  return state.kind === "ok" ? state.store : null;
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
      // The layout shows the store as unavailable; metadata just stays empty.
      if (isStoreUnavailable(err)) return null;
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

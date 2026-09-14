import { cache } from "react";
import type { PageTree } from "@store-builder/api-client";
import { RESERVED_THEME_PATHS, THEME_PAGE_PATHS, type ThemePageKey } from "@store-builder/store-renderer";
import { createServerStorefrontApiClient } from "./serverApiClient";

/**
 * A published theme page (product top/bottom, collection intro) for this
 * store, or null when the merchant hasn't published one. Never throws: a
 * missing or broken theme block must not take a product page down.
 */
export const getThemePageTree = cache(async (workspaceId: string, key: ThemePageKey): Promise<PageTree | null> => {
  try {
    const client = await createServerStorefrontApiClient();
    const result = await client.getStorefrontPage(workspaceId, THEME_PAGE_PATHS[key]);
    if (result.kind !== "page") return null;
    const tree = result.data.page.tree;
    return tree?.sections?.length ? tree : null;
  } catch {
    return null;
  }
});

/** Theme-only pages are rendered around product/collection templates, never on their own URL. */
export function isReservedThemePath(path: string): boolean {
  const normalized = `/${path.replace(/^\/+|\/+$/g, "").toLowerCase()}`;
  return RESERVED_THEME_PATHS.includes(normalized);
}

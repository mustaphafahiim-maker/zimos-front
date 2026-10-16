import { permanentRedirect, redirect } from "next/navigation";
import { storefrontRedirectLookup, type StorefrontRedirect } from "@store-builder/api-client";
import { URL_REDIRECTS_ENABLED } from "./features";
import { createServerStorefrontApiClient } from "./serverApiClient";
import { getStoreBasePath } from "./storeRoute";
import { addressOf, isPermanent, redirectTarget, type RedirectQuery } from "./urlRedirects";

/**
 * For a server page that is about to answer "not found": asks the store whether this address was moved, and when it was, ends
 * the render with a real redirect — permanent (308) for the merchant's 301,
 * temporary (307) for a 302 — so search engines follow it too. Returns
 * normally when there is nothing to follow, and the page calls `notFound()`
 * as before.
 *
 *   if (!product) {
 *     await redirectIfMoved(workspaceId, `/products/${slug}`);
 *     notFound();
 *   }
 *
 * `path` is store-relative and decoded; `query` is the part of the page's
 * searchParams that belongs to the address (all of it for a page, only
 * `collection` for the products list). `visit` is the whole of them, when
 * that is more: its campaign parameters follow the shopper to the new address.
 * A locked or unavailable store and an API out of reach all read as "not
 * moved": the page's own answer stands.
 */
export async function redirectIfMoved(workspaceId: string, path: string, query?: RedirectQuery, visit: RedirectQuery | undefined = query): Promise<void> {
  if (!URL_REDIRECTS_ENABLED) return;
  const asked = addressOf(path, query);
  let found: StorefrontRedirect | null = null;
  let basePath = "";
  try {
    const client = await createServerStorefrontApiClient();
    [found, basePath] = await Promise.all([storefrontRedirectLookup(client, workspaceId, asked), getStoreBasePath(workspaceId)]);
  } catch {
    return;
  }
  if (!found) return;
  const target = redirectTarget(found, basePath, addressOf(path, visit), visit);
  if (!target) return;
  // Outside the try: both end the render by throwing.
  if (isPermanent(found)) permanentRedirect(target);
  redirect(target);
}

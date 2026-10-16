import { LOCALE_COOKIE } from "./localeCookie";
import { STORE_PREVIEW_COOKIE } from "./storePreview";

/**
 * Lets a CDN in front of the storefront (Cloudflare) keep a public store page
 * for a minute and serve it while it fetches a fresh one, instead of every
 * visit rendering it here. Off unless the server's STOREFRONT_EDGE_CACHE is
 * exactly "true"; off, every page keeps Next's own `private, no-store`.
 *
 * Only pages that render the same for every visitor qualify: the store's home,
 * catalogue, product, policy, learn and look pages. Anything with a shopper or
 * an order in it — cart, checkout, orders, payment, downloads, tracking,
 * funnels, previews — never does. The app's own navigations to those pages
 * qualify too: Next hides them from the proxy, but their URL carries `_rsc`,
 * a hash of the router headers the payload depends on, so a cache keyed on
 * the full URL (query string included) never serves one in place of another
 * or of the page itself.
 *
 * Two cookies change what a page renders: the shopper's chosen language and
 * a staff preview. A request carrying either (or a preview link) stays
 * private. The CDN must be told the same (skip the cache when either cookie
 * is present), because a cached copy is served without asking this server.
 */
export const EDGE_CACHE_CONTROL = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

/** The cookies that change a page's HTML; a request with one is never cached. */
export const PERSONAL_COOKIES = [LOCALE_COOKIE, STORE_PREVIEW_COOKIE] as const;

/** Store-relative paths that render the same for every visitor. */
const PUBLIC_PAGE = /^\/(?:products(?:\/[^/]+)?|policies\/[^/]+|learn(?:\/[^/]+)?|looks\/[^/]+)?\/?$/;

/**
 * The path inside the store: `/store/<workspace>/products/x` → `/products/x`
 * for the internal shape; a store's own host already serves store paths.
 */
export function storePathOf(pathname: string): string {
  const internal = /^\/store\/[^/]+(\/.*)?$/.exec(pathname);
  if (internal) return internal[1] ?? "/";
  return pathname;
}

export function edgeCacheControl(input: {
  enabled: boolean;
  method: string;
  pathname: string;
  cookieNames: readonly string[];
  /** A preview token in the link (it also sets the preview cookie). */
  previewLink: boolean;
  /** What the proxy answered: only a plain 200 pass-through or rewrite qualifies. */
  status: number;
  redirected: boolean;
}): string | null {
  if (!input.enabled) return null;
  if (input.method !== "GET" && input.method !== "HEAD") return null;
  if (input.status !== 200 || input.redirected || input.previewLink) return null;
  if (input.cookieNames.some((name) => (PERSONAL_COOKIES as readonly string[]).includes(name))) return null;
  return PUBLIC_PAGE.test(storePathOf(input.pathname)) ? EDGE_CACHE_CONTROL : null;
}

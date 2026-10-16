/**
 * Staff preview of a store the public can't see yet — a draft, not
 * subscribed yet. The API serves such a store only to a request carrying a
 * staff preview token (X-Store-Preview) and answers everyone else exactly as
 * for a store that doesn't exist.
 *
 * The token reaches this app as `?storePreview=<token>` (the dashboard's
 * "preview store" link) or from the editor's preview post. The proxy keeps it
 * in a cookie for this browser and hands it to server components as a request
 * header; the browser client reads the cookie. The API checks the token on
 * every call — it is signed, short-lived and names one store — so nothing
 * here grants anything by itself, and a token for another store is ignored.
 *
 * `?paymentsPreview=` (the payments page's test-checkout link) is a staff
 * preview token too, so it counts here as well.
 */
export const STORE_PREVIEW_PARAM = "storePreview";
export const PAYMENTS_PREVIEW_PARAM = "paymentsPreview";
export const STORE_PREVIEW_COOKIE = "zimos_store_preview";
/** Set by the proxy only; server components forward it as X-Store-Preview. */
export const STORE_PREVIEW_HEADER = "x-zimos-store-preview";
/** As long as the API's token lives. */
export const STORE_PREVIEW_MAX_AGE = 2 * 60 * 60;

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{10,400}\.[A-Za-z0-9_-]{10,100}$/;

export function isTokenShaped(value: string | null | undefined): value is string {
  return typeof value === "string" && TOKEN_SHAPE.test(value);
}

/** The cookie's attributes: cross-site frames (the dashboard's preview) need SameSite=None, which needs https. */
export function storePreviewCookieOptions(secure: boolean) {
  return {
    path: "/",
    maxAge: STORE_PREVIEW_MAX_AGE,
    sameSite: secure ? ("none" as const) : ("lax" as const),
    secure,
    // Read by the browser client too, to send with its own API calls.
    httpOnly: false,
  };
}

/** In the browser: this tab's preview token, if any. */
export function readStorePreviewCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${STORE_PREVIEW_COOKIE}=`));
  const value = match ? decodeURIComponent(match.slice(STORE_PREVIEW_COOKIE.length + 1)) : undefined;
  return isTokenShaped(value) ? value : undefined;
}

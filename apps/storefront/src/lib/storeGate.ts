/**
 * Store gates (frontend-handoff 197): a store behind a password or a
 * coming-soon page, and the age question before entering.
 *
 * The API decides who gets in. While a gate is on, every store route but the
 * open ones answers 423 STORE_LOCKED; a right password gives a 30-day token
 * that every store call then carries as X-Store-Gate. The token is kept in a
 * cookie, not localStorage, because the server components fetch the store's
 * pages too: the server client (lib/serverApiClient) reads it from the
 * request, the browser client (lib/apiClient) from `document.cookie`. It names
 * one store and one password version, so another store's token or an old one
 * is simply refused by the API.
 *
 * The age answer is the shopper's own, remembered for the browser session (a
 * cookie without an expiry, so the server can render the store straight away
 * on the next page instead of flashing the question).
 */

export const STORE_GATE_COOKIE = "zimos_store_gate";

/** `<workspaceId>.<passwordVersion>.<expiresAtMs>.<hmac hex>` — the API's own shape (storeGate.issueToken). */
const TOKEN_SHAPE = /^[0-9a-f-]{36}\.\d{1,9}\.\d{10,16}\.[0-9a-f]{64}$/i;

export function isGateTokenShaped(value: string | null | undefined): value is string {
  return typeof value === "string" && TOKEN_SHAPE.test(value);
}

/**
 * Route segments under a store that stay open while it is locked — the API's
 * own list (modules/storeGate OPEN): order tracking and the thank-you page,
 * payments, the old offer link (it forwards to the order), downloads,
 * courses, subscriptions, the affiliate portal, and the editor's preview.
 * They skip the age question too: whoever reaches them already bought.
 * Funnels (`f`) are open unless the merchant locked them.
 */
export const OPEN_SEGMENTS: ReadonlySet<string> = new Set([
  "track",
  "orders",
  "pay",
  "offer",
  "downloads",
  "learn",
  "subscriptions",
  "affiliate",
  "preview",
]);

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

function secureContext(): boolean {
  return typeof location !== "undefined" && location.protocol === "https:";
}

/** In the browser: this visitor's unlock token, if any. */
export function readStoreGateCookie(): string | undefined {
  const value = readCookie(STORE_GATE_COOKIE);
  return isGateTokenShaped(value) ? value : undefined;
}

/** After a right password: kept as long as the API's token lives. */
export function saveStoreGateToken(token: string, maxAgeSeconds: number) {
  const age = Math.max(60, Math.min(Math.floor(maxAgeSeconds) || 0, 30 * 86400));
  document.cookie = `${STORE_GATE_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${age}; samesite=lax${secureContext() ? "; secure" : ""}`;
}

/** Dropping a token the store no longer takes (opened, or the password changed): runs before the page's own scripts. */
export const CLEAR_GATE_COOKIE_SCRIPT = `document.cookie="${STORE_GATE_COOKIE}=; path=/; max-age=0; samesite=lax"`;

/** One cookie per store, so stores sharing a host (development, /store/<id>) don't answer for each other. */
export function ageCookieName(storeId: string): string {
  return `zimos_age_${storeId.replace(/[^0-9a-z]/gi, "").slice(0, 16)}`;
}

/** "Yes, I'm old enough", for the rest of this browser session. */
export function rememberAgeConfirmed(storeId: string) {
  document.cookie = `${ageCookieName(storeId)}=1; path=/; samesite=lax${secureContext() ? "; secure" : ""}`;
}

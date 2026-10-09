/**
 * The header that carries a signed-in shopper's token on the storefront calls
 * made for that shopper (account pages, wishlist, rewards). The API has to
 * list it in its storefront CORS allowlist before a browser may send it.
 *
 * Nothing here keeps or reads a token: the storefront does that
 * (apps/storefront/src/lib/shopperToken.ts) and passes it in. No token means
 * no header, so a caller without one sends exactly what it sent before.
 */
export const SHOPPER_TOKEN_HEADER = "X-Shopper-Token";

/** Longer than any token the API issues; anything past it is not one. */
const MAX_SHOPPER_TOKEN_LENGTH = 512;
const SHOPPER_TOKEN_SHAPE = /^[A-Za-z0-9._~+/=-]+$/;

/** True for a value that can be sent as the header: a short string of token characters only. */
export function isShopperToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_SHOPPER_TOKEN_LENGTH &&
    SHOPPER_TOKEN_SHAPE.test(value)
  );
}

/** The header for `token`, or none when there is no usable token. Spread into a request's `headers`. */
export function shopperTokenHeaders(token: string | null | undefined): Record<string, string> {
  return isShopperToken(token) ? { [SHOPPER_TOKEN_HEADER]: token } : {};
}

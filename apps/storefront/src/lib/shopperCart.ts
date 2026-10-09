import type { ApiClient } from "@store-builder/api-client";
import { createStorefrontApiClient } from "./apiClient";
import { readToken } from "./shopperSession";

/**
 * The cart, priced for the signed-in shopper (handoff 205). The API prices a
 * cart's plain lines with the shopper's price lists whenever a cart call
 * carries their X-Shopper-Token — and the checkout pins the same prices — so
 * every cart call sends it while there is one.
 *
 * CartProvider sits in the root layout, above the store's own context: it
 * knows the route's `[workspaceId]` (a UUID or a slug) but not the store's
 * UUID, which is what the token is kept under. ShopperCartPrices
 * (components/rewards) tells this module which UUID a route segment stands
 * for, and re-reads the cart whenever who is signed in changes.
 */

/** The store's UUID by the route segment it was reached by. */
const storeIds = new Map<string, string>();
/** The token the last cart call of a route segment carried: undefined before any call, null for none. */
const sentTokens = new Map<string, string | null>();

export function rememberStoreId(routeRef: string, storeId: string) {
  if (routeRef && storeId) storeIds.set(routeRef, storeId);
}

/** What the last cart call for this route segment was priced for; undefined while no call was made yet. */
export function cartTokenSent(routeRef: string): string | null | undefined {
  return sentTokens.get(routeRef);
}

const CART_PATH = /^\/store\/([^/]+)\/cart(?:\/|$|\?)/;

/**
 * The storefront client CartProvider talks through: the same one as
 * everywhere else, whose cart calls also carry the signed-in shopper's token.
 * Nothing else is added to any other call.
 */
export function createCartApiClient(): ApiClient {
  const client = createStorefrontApiClient();
  const send = client.request.bind(client) as ApiClient["request"];
  client.request = function request<T>(path: string, opts?: Parameters<ApiClient["request"]>[1]): Promise<T> {
    const match = CART_PATH.exec(path);
    if (!match) return send<T>(path, opts);
    const routeRef = decodeURIComponent(match[1]);
    const token = readToken(storeIds.get(routeRef) ?? routeRef);
    sentTokens.set(routeRef, token);
    if (!token) return send<T>(path, opts);
    return send<T>(path, { ...opts, headers: { ...opts?.headers, "X-Shopper-Token": token } });
  };
  return client;
}

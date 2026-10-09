import type { ApiClient } from "@store-builder/api-client";

/**
 * Funnels on a locked store (frontend-handoff 312).
 *
 * A "coming soon" or password store can keep its funnels open. The API then
 * answers what a funnel's checkout asks — places, payment methods, the
 * shipping quote, the delivery estimate and slots, checkout sessions, uploads
 * and the checkout itself — only when the call names a live funnel of the
 * store, and 423 STORE_LOCKED otherwise.
 *
 * The handoff names the `X-Funnel-Id` header for that. A browser cannot send
 * it: the API's CORS answer does not allow the header, so the preflight fails
 * and the call never leaves the page. The API reads the same id from the
 * query (`funnelId`), so that is where it travels — on a funnel's own pages
 * (`/f/<funnelId>/…`) and on those calls only. Nothing changes on the store's
 * own pages: they show the gate as before.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** A funnel's pages: its steps (/f/<funnelId>/<sessionId>) and its generic pages (/f/<funnelId>/p/<key>). */
const FUNNEL_PAGE = new RegExp(`(?:^|/)f/(${UUID})(?:/|$)`, "i");

/** The calls the API opens for a live funnel — the same list as its store gate (backend storeGate: FUNNEL_CHECKOUT). */
const FUNNEL_CHECKOUT_CALL =
  /^\/store\/[^/?]+\/(?:checkout|checkout-sessions|shipping-quote|payment-methods|places|delivery-estimate|delivery-slots|uploads)(?:\/|\?|$)/;

/** The funnel a page address belongs to; null on the store's own pages. */
export function funnelIdOfPath(pathname: string): string | null {
  return FUNNEL_PAGE.exec(pathname)?.[1] ?? null;
}

/** The funnel whose page is showing; null on the server and on the store's own pages. */
export function currentFunnelId(): string | null {
  return typeof window === "undefined" ? null : funnelIdOfPath(window.location.pathname);
}

/**
 * An API path with the funnel named in its query, when it is one of the funnel
 * checkout's calls and names none yet (payment methods already carry theirs).
 */
export function withFunnelId(path: string, funnelId: string | null): string {
  if (!funnelId || !FUNNEL_CHECKOUT_CALL.test(path)) return path;
  const at = path.indexOf("?");
  if (at < 0) return `${path}?funnelId=${encodeURIComponent(funnelId)}`;
  const query = new URLSearchParams(path.slice(at + 1));
  if (query.get("funnelId")) return path;
  // An empty one would reach the API as two values, which it reads as none.
  query.delete("funnelId");
  query.set("funnelId", funnelId);
  return `${path.slice(0, at)}?${query.toString()}`;
}

type Send = ApiClient["request"];
type RawSend = (path: string, init: RequestInit) => Promise<Response>;

/**
 * The storefront client, whose funnel-checkout calls name the funnel whenever
 * a funnel page is showing. The page is read at call time, so one client
 * serves a shopper who moves between the store and a funnel.
 */
export function funnelAware<T extends ApiClient>(client: T): T {
  const send = client.request.bind(client) as Send;
  client.request = function request<R>(path: string, opts?: Parameters<Send>[1]): Promise<R> {
    return send<R>(withFunnelId(path, currentFunnelId()), opts);
  };
  // A photo upload is multipart: it leaves through the client's raw sender, which `request` never sees.
  const inner = client as unknown as { rawFetch?: RawSend };
  if (typeof inner.rawFetch === "function") {
    const raw = inner.rawFetch.bind(client);
    inner.rawFetch = (path, init) => raw(withFunnelId(path, currentFunnelId()), init);
  }
  return client;
}

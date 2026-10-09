/**
 * Shopper self-service on orders: cancel, change the address (backend
 * shopperAccounts/orderSelfService.js; frontend-handoff 220 and 287).
 *
 * Staff (orders.manage):
 *   GET/PUT /workspaces/:ws/order-self-service → OrderSelfServiceSettings
 *     minutes: how long after placing the order the shopper may still act
 *     (5–10080), or null for "until it ships".
 *
 * Shopper (public), /store/:ws/orders/:orderId/self-service — the order is the
 * shopper's by X-Shopper-Token (a signed-in account), or by the order's
 * tracking token (`?token=` on GET, `token` in the body on POST):
 *   GET            → OrderSelfServiceState
 *   POST /cancel   { token?, reason? ≤ 300 } → { cancelled: true }
 *                  409 CANCEL_NOT_ALLOWED (shipped, cancelled, paid online, confirmed, or too late).
 *   POST /address  { token?, address } → { shippingAddress, note }
 *                  The new address replaces the old one field by field: anything left out is
 *                  cleared, so send every field. 409 ADDRESS_CHANGE_NOT_ALLOWED;
 *                  422 SHIPPING_PLACE_UNAVAILABLE for a place the store does not deliver to;
 *                  the shipping price is not recalculated.
 *   404 when the order is not this shopper's; 429 like order tracking.
 *
 * All exported names are prefixed `orderSelfService` / `OrderSelfService`.
 */
import type { ApiClient } from "../client";

// ---------------------------------------------------------------- staff --

export interface OrderSelfServiceRule {
  enabled: boolean;
  /** Minutes after the order was placed; null = until it ships. */
  minutes: number | null;
}

export interface OrderSelfServiceSettings {
  cancel: OrderSelfServiceRule;
  address: OrderSelfServiceRule;
}

/** The window the API takes: five minutes to a week. */
export const ORDER_SELF_SERVICE_MIN_MINUTES = 5;
export const ORDER_SELF_SERVICE_MAX_MINUTES = 10080;

export function orderSelfServiceSettingsGet(client: ApiClient, workspaceId: string): Promise<OrderSelfServiceSettings> {
  return client.request<OrderSelfServiceSettings>(`/workspaces/${workspaceId}/order-self-service`);
}

export function orderSelfServiceSettingsSave(
  client: ApiClient,
  workspaceId: string,
  body: OrderSelfServiceSettings
): Promise<OrderSelfServiceSettings> {
  return client.request<OrderSelfServiceSettings>(`/workspaces/${workspaceId}/order-self-service`, { method: "PUT", body });
}

// -------------------------------------------------------------- shopper --

/** How the shopper names the order: the tracking link's token, or their account's order. */
export type OrderSelfServiceRef = { token: string } | { orderId: string; shopperToken: string };

export interface OrderSelfServiceState {
  canCancel: boolean;
  canChangeAddress: boolean;
  /** The last moment to cancel; null when the store set no time limit (or cancelling is off). */
  cancelUntil: string | null;
  addressUntil: string | null;
}

/** Every field of the delivery address; a field left out is cleared (handoff 287). */
export interface OrderSelfServiceAddress {
  /** ISO 3166 alpha-2; the order keeps its own when left out. */
  country?: string;
  province: string;
  city: string;
  area?: string | null;
  addressLine: string;
  /** The deepest place picked from the store's own list. */
  placeId?: string | null;
  /** ≤ 20 characters. */
  postalCode?: string | null;
  /** For the courier, ≤ 500 characters. */
  notes?: string | null;
}

/** The cancellation reason and the courier note, at most this long. */
export const ORDER_SELF_SERVICE_REASON_MAX = 300;
export const ORDER_SELF_SERVICE_NOTES_MAX = 500;

/**
 * The order id a tracking token carries. The token is "<order id, base64url>.<signature>"
 * (backend storefront/orderTrackingExtras.js tokenFor); the tracking answer itself has no
 * order id, and the self-service routes need one in the path. Null when it is not such a token.
 */
export function orderSelfServiceOrderId(trackingToken: string): string | null {
  const encoded = String(trackingToken || "").split(".")[0];
  if (!/^[A-Za-z0-9_-]{22}$/.test(encoded)) return null;
  try {
    const binary = atob(`${encoded.replace(/-/g, "+").replace(/_/g, "/")}==`);
    if (binary.length !== 16) return null;
    let hex = "";
    for (let i = 0; i < binary.length; i++) hex += binary.charCodeAt(i).toString(16).padStart(2, "0");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return null;
  }
}

function target(workspaceRef: string, ref: OrderSelfServiceRef): { path: string; headers: Record<string, string>; token?: string } | null {
  const orderId = "token" in ref ? orderSelfServiceOrderId(ref.token) : ref.orderId;
  if (!orderId) return null;
  const path = `/store/${workspaceRef}/orders/${encodeURIComponent(orderId)}/self-service`;
  return "token" in ref ? { path, headers: {}, token: ref.token } : { path, headers: { "X-Shopper-Token": ref.shopperToken } };
}

const NOTHING: OrderSelfServiceState = { canCancel: false, canChangeAddress: false, cancelUntil: null, addressUntil: null };

/** What the shopper may still do on the order. A token that names no order answers "nothing". */
export async function orderSelfServiceGet(client: ApiClient, workspaceRef: string, ref: OrderSelfServiceRef): Promise<OrderSelfServiceState> {
  const to = target(workspaceRef, ref);
  if (!to) return NOTHING;
  const query = to.token ? `?token=${encodeURIComponent(to.token)}` : "";
  return client.request<OrderSelfServiceState>(`${to.path}${query}`, { auth: false, headers: to.headers });
}

/** Cancels the order through the store's own cancellation (stock released, courier booking cancelled). */
export function orderSelfServiceCancel(
  client: ApiClient,
  workspaceRef: string,
  ref: OrderSelfServiceRef,
  reason?: string
): Promise<{ cancelled: boolean }> {
  const to = target(workspaceRef, ref);
  if (!to) return Promise.reject(new Error("Not a tracking token"));
  const text = (reason ?? "").trim().slice(0, ORDER_SELF_SERVICE_REASON_MAX);
  return client.request<{ cancelled: boolean }>(`${to.path}/cancel`, {
    method: "POST",
    auth: false,
    headers: to.headers,
    body: { ...(to.token ? { token: to.token } : {}), ...(text ? { reason: text } : {}) },
  });
}

/** Replaces the order's delivery address. The shipping price stays; the store confirms any difference. */
export function orderSelfServiceChangeAddress(
  client: ApiClient,
  workspaceRef: string,
  ref: OrderSelfServiceRef,
  address: OrderSelfServiceAddress
): Promise<{ shippingAddress: OrderSelfServiceAddress; note: string }> {
  const to = target(workspaceRef, ref);
  if (!to) return Promise.reject(new Error("Not a tracking token"));
  return client.request<{ shippingAddress: OrderSelfServiceAddress; note: string }>(`${to.path}/address`, {
    method: "POST",
    auth: false,
    headers: to.headers,
    body: { ...(to.token ? { token: to.token } : {}), address },
  });
}

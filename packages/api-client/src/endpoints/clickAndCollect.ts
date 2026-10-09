/**
 * Click and collect: the shopper picks the order up at one of the store's stock locations
 * (backend src/modules/clickAndCollect; frontend-handoff 225; locations are item 206).
 *
 * Staff, /workspaces/:ws/click-and-collect:
 *   GET /  (orders.view)      → PickupSettings
 *   PUT /  (shipping.manage)    PickupSettings → the saved settings
 *       `locations` is keyed by stock location id; texts up to 300 characters. Locations must be
 *       this store's, and when `enabled` at least one must be on (422 on `locations`).
 *   GET /orders?status=&locationId=&limit=&offset= (orders.view) → { total, pickups }
 *   POST /orders/:orderId/ready   (orders.manage) → { pickup, emailed }
 *       Emails the shopper the place and the code when the order has an email.
 *       409 PICKUP_NOT_PENDING, 409 ORDER_CANCELLED.
 *   POST /orders/:orderId/collect (orders.manage) { code: "713997" } → { pickup }
 *       The order becomes delivered. 422 PICKUP_CODE_WRONG; 409 PICKUP_NOT_OPEN, ORDER_CANCELLED.
 *
 * Shopper:
 *   GET /store/:ws/pickup/locations?variantIds=a,b → 404 while off, else { locations }
 *       (`available`: every given variant has a free unit there; null without `variantIds`).
 *   Checkout body `pickupLocationId` in place of `shippingAddress`: any address sent is dropped,
 *       the address fields are not required, shipping is 0 and `shippingOption` is ignored.
 *       422 on `pickupLocationId`; 409 PICKUP_OUT_OF_STOCK { variantIds }.
 *   The 201 carries `pickup: { code, location }`; the order has the tag `pickup` and
 *       `shippingSnapshot.pickup = { locationId, name, address }`.
 *   GET /store/:ws/pickup/orders/:orderId?token=<tracking token> (or X-Shopper-Token) → { pickup }
 *       with `code` (null once collected or cancelled). 404 when the order is not a pickup.
 *
 * All exported names are prefixed `pickup` / `Pickup` / `PICKUP`.
 */
import { ApiError, type ApiClient } from "../client";
import { apiErrorDetails, apiFieldProblems, isApiErrorCode } from "../errors";

export interface PickupText {
  ar?: string;
  en?: string;
}

// ---------------------------------------------------------------- staff --

export interface PickupLocationSettings {
  enabled: boolean;
  /** How to collect: where to go, what to bring. */
  instructions: PickupText | null;
  /** Opening hours, as the store writes them. */
  hours: PickupText | null;
}

export interface PickupSettings {
  enabled: boolean;
  /** By stock location id. */
  locations: Record<string, PickupLocationSettings>;
}

/** Each text, at most this long. */
export const PICKUP_TEXT_MAX = 300;

/** The tag a click-and-collect order carries. */
export const PICKUP_ORDER_TAG = "pickup";

/** The pickup code is always this many digits. */
export const PICKUP_CODE_LENGTH = 6;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/click-and-collect`;

export function pickupSettingsGet(client: ApiClient, workspaceId: string): Promise<PickupSettings> {
  return client.request<PickupSettings>(base(workspaceId));
}

export function pickupSettingsSave(client: ApiClient, workspaceId: string, body: PickupSettings): Promise<PickupSettings> {
  return client.request<PickupSettings>(base(workspaceId), { method: "PUT", body });
}

export const PICKUP_STATUSES = ["pending", "ready", "collected", "cancelled"] as const;
export type PickupStatus = (typeof PICKUP_STATUSES)[number];

/** The place as it was when the order was placed. */
export interface PickupPlace {
  id: string;
  name: string;
  address: string | null;
  instructions: PickupText | null;
  hours: PickupText | null;
}

export interface Pickup {
  orderId: string;
  status: PickupStatus;
  location: PickupPlace;
  readyAt: string | null;
  collectedAt: string | null;
}

export interface PickupOrderSummary {
  id: string;
  orderNumber: string;
  /** Minor units, as a string. */
  totalAmount: string;
  currency: string;
  customerName: string | null;
  phone: string | null;
  paymentMethod: string;
  financialState: string;
  createdAt: string;
}

export interface PickupListItem extends Pickup {
  order: PickupOrderSummary;
}

export interface PickupListQuery {
  status?: PickupStatus;
  locationId?: string;
  /** 1–200, 50 by default. */
  limit?: number;
  offset?: number;
}

/** The page size the list asks for by default, and the most it gives. */
export const PICKUP_LIST_LIMIT_MAX = 200;

export function pickupList(client: ApiClient, workspaceId: string, query: PickupListQuery = {}): Promise<{ total: number; pickups: PickupListItem[] }> {
  const qs = new URLSearchParams();
  if (query.status) qs.set("status", query.status);
  if (query.locationId) qs.set("locationId", query.locationId);
  if (query.limit) qs.set("limit", String(query.limit));
  if (query.offset) qs.set("offset", String(query.offset));
  const s = qs.toString();
  return client.request<{ total: number; pickups: PickupListItem[] }>(`${base(workspaceId)}/orders${s ? `?${s}` : ""}`);
}

/** "Ready": the shopper is emailed the place and the code when the order has an email (`emailed`). */
export function pickupMarkReady(client: ApiClient, workspaceId: string, orderId: string): Promise<{ pickup: Pickup; emailed: boolean }> {
  return client.request<{ pickup: Pickup; emailed: boolean }>(`${base(workspaceId)}/orders/${orderId}/ready`, { method: "POST" });
}

/** "Hand over": the code the shopper shows. The order becomes delivered. */
export async function pickupCollect(client: ApiClient, workspaceId: string, orderId: string, code: string): Promise<Pickup> {
  const { pickup } = await client.request<{ pickup: Pickup }>(`${base(workspaceId)}/orders/${orderId}/collect`, {
    method: "POST",
    body: { code },
  });
  return pickup;
}

/** 422 PICKUP_CODE_WRONG: the typed code is not this order's. */
export function isPickupCodeWrong(err: unknown): boolean {
  return isApiErrorCode(err, "PICKUP_CODE_WRONG");
}

/**
 * The pickup changed under the page: already marked ready / collected / cancelled
 * (409 PICKUP_NOT_PENDING, PICKUP_NOT_OPEN) or its order was cancelled (409 ORDER_CANCELLED).
 * The list should be read again.
 */
export function isPickupStale(err: unknown): boolean {
  return isApiErrorCode(err, "PICKUP_NOT_PENDING") || isApiErrorCode(err, "PICKUP_NOT_OPEN") || isApiErrorCode(err, "ORDER_CANCELLED");
}

/** The place a pickup order was placed for (`shippingSnapshot.pickup`); null for a delivered order. */
export interface OrderPickupPlace {
  locationId: string;
  name: string;
  address: string | null;
}

export function orderPickupOf(order: unknown): OrderPickupPlace | null {
  const raw = (order as { shippingSnapshot?: { pickup?: unknown } | null } | null | undefined)?.shippingSnapshot?.pickup as
    | Partial<OrderPickupPlace>
    | null
    | undefined;
  if (!raw || typeof raw !== "object" || typeof raw.locationId !== "string") return null;
  return { locationId: raw.locationId, name: typeof raw.name === "string" ? raw.name : "", address: typeof raw.address === "string" && raw.address ? raw.address : null };
}

// -------------------------------------------------------------- shopper --

export interface StorefrontPickupLocation {
  id: string;
  name: string;
  address: string | null;
  instructions: PickupText | null;
  hours: PickupText | null;
  /** Every asked variant has a free unit there; null when no variants were asked about. */
  available: boolean | null;
}

/** Most variant ids the API reads in one call. */
export const PICKUP_VARIANT_IDS_MAX = 50;

/** The places to pick up from; null while the store offers none (404). Never cached by the API. */
export async function storefrontPickupLocations(
  client: ApiClient,
  workspaceRef: string,
  variantIds: readonly string[] = []
): Promise<StorefrontPickupLocation[] | null> {
  const ids = [...new Set(variantIds)].slice(0, PICKUP_VARIANT_IDS_MAX);
  try {
    const { locations } = await client.request<{ locations: StorefrontPickupLocation[] }>(
      `/store/${workspaceRef}/pickup/locations${ids.length ? `?variantIds=${ids.join(",")}` : ""}`,
      { auth: false }
    );
    return Array.isArray(locations) && locations.length > 0 ? locations : null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** What the checkout body gains: the place, in place of a delivery address. */
export interface PickupCheckoutFields {
  pickupLocationId?: string;
}

/** What the checkout's 201 adds for a pickup order. */
export interface PickupCheckoutAnswer {
  pickup?: { code: string; location: PickupPlace };
}

/**
 * Why a checkout was refused over its pickup:
 *   place  422 on `pickupLocationId` — pickup is not offered at that place (any more)
 *   stock  409 PICKUP_OUT_OF_STOCK — some items are not on the shelf there (`variantIds`)
 * null for any other error. The places should be read again after either.
 */
export type PickupProblem = { kind: "place" } | { kind: "stock"; variantIds: string[] };

export function checkoutPickupProblemOf(err: unknown): PickupProblem | null {
  if (isApiErrorCode(err, "PICKUP_OUT_OF_STOCK")) {
    const ids = apiErrorDetails<{ variantIds?: unknown }>(err)?.variantIds;
    return { kind: "stock", variantIds: Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [] };
  }
  return apiFieldProblems(err).some((p) => p.field === "pickupLocationId") ? { kind: "place" } : null;
}

/** The shopper's view of their pickup. */
export interface StorefrontPickup extends Pickup {
  /** The six digits to show at the counter; null once collected or cancelled. */
  code: string | null;
}

/** How the shopper names the order: its tracking token, or their signed-in account. */
export type PickupOrderProof = { token: string } | { shopperToken: string };

/** The order's pickup; null when the order is not a pickup (or not this shopper's): 404. */
export async function storefrontPickupOrder(
  client: ApiClient,
  workspaceRef: string,
  orderId: string,
  proof: PickupOrderProof
): Promise<StorefrontPickup | null> {
  const byToken = "token" in proof;
  try {
    const { pickup } = await client.request<{ pickup: StorefrontPickup }>(
      `/store/${workspaceRef}/pickup/orders/${encodeURIComponent(orderId)}${byToken ? `?token=${encodeURIComponent(proof.token)}` : ""}`,
      { auth: false, headers: byToken ? {} : { "X-Shopper-Token": proof.shopperToken } }
    );
    return pickup ?? null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Shopper returns (backend handoff item 186: src/modules/returns/shopperReturns.js).
 *
 * Staff (orders.manage):
 *   GET/PUT /workspaces/:ws/shopper-returns
 *     → { enabled, windowDays (1–365, default 14), photoRequiredFor: [reason codes] }
 *   The existing returns lists (GET /workspaces/:ws/returns, GET /orders/:id/returns)
 *   now carry `source` ("merchant" | "shopper") and `photos` [{ uploadId, url, expiresAt }]
 *   — signed links that work for a few minutes; listing again makes new ones.
 *
 * Shopper (public, /store/:ws/returns): the order is named by the tracking
 * link's token, or by `orderId` + `X-Shopper-Token` for a signed-in shopper
 * (item 185).
 *   GET  /eligibility?token=… | ?orderId=…  → ShopperReturnEligibility
 *        404 unknown order, 401 SHOPPER_NOT_SIGNED_IN.
 *   POST /  { token | orderId, reasonCode, reasonDetail? (≤280), items, photoUploadIds? (≤4) }
 *        → 201 { return }. Photos are uploaded first (POST /store/:ws/uploads,
 *        uploadCustomerPhoto) and sent with the same X-Visitor-Id.
 *        409 RETURN_NOT_POSSIBLE (details.reason), 422 on items.N.quantity /
 *        photoUploadIds.
 */
import type { ApiClient } from "../client";
import type { ReturnItemLine, ReturnReasonCode, ReturnRequest, ReturnStatus } from "../types";

/** Every reason a return can name, in the order the API lists them. */
export const RETURN_REASON_CODES: readonly ReturnReasonCode[] = [
  "damaged",
  "defective",
  "wrong_item",
  "not_as_described",
  "no_longer_wanted",
  "arrived_late",
  "other",
];

/** At most this many photos on one shopper return. */
export const SHOPPER_RETURN_MAX_PHOTOS = 4;
/** The shopper's own words, at most this long. */
export const SHOPPER_RETURN_DETAIL_MAX = 280;

// ------------------------------------------------------------- staff ----

export interface ShopperReturnsSettings {
  enabled: boolean;
  /** Days after delivery the shopper may ask (1–365). */
  windowDays: number;
  /** Reasons that need a photo of the problem. */
  photoRequiredFor: ReturnReasonCode[];
}

export function shopperReturnsSettingsGet(client: ApiClient, workspaceId: string): Promise<ShopperReturnsSettings> {
  return client.request<ShopperReturnsSettings>(`/workspaces/${workspaceId}/shopper-returns`);
}

export function shopperReturnsSettingsSave(
  client: ApiClient,
  workspaceId: string,
  body: ShopperReturnsSettings
): Promise<ShopperReturnsSettings> {
  return client.request<ShopperReturnsSettings>(`/workspaces/${workspaceId}/shopper-returns`, {
    method: "PUT",
    body,
  });
}

/** Who opened a return: the merchant from the order page, or the shopper. */
export type ReturnSource = "merchant" | "shopper";

/** One photo the shopper attached; `url` is signed and short-lived. */
export interface ReturnPhoto {
  uploadId: string;
  url: string;
  expiresAt: string;
}

/** A return as the staff lists now send it. */
export type ReturnRequestWithPhotos = ReturnRequest & {
  source?: ReturnSource;
  photos?: ReturnPhoto[];
};

/** "shopper" for a return the customer asked for; "merchant" otherwise (older rows too). */
export function returnSourceOf(ret: ReturnRequest): ReturnSource {
  return (ret as ReturnRequestWithPhotos).source === "shopper" ? "shopper" : "merchant";
}

/** The return's photos (none on a merchant's return). */
export function returnPhotosOf(ret: ReturnRequest): ReturnPhoto[] {
  const photos = (ret as ReturnRequestWithPhotos).photos;
  return Array.isArray(photos) ? photos.filter((p) => p && typeof p.url === "string" && p.url) : [];
}

// ----------------------------------------------------------- shopper ----

/** How the shopper names the order: the tracking link's token, or their account's order. */
export type ShopperReturnOrderRef = { token: string } | { orderId: string; shopperToken: string };

/** Why a return cannot be asked for now. `off`: the store takes returns by contact only. */
export type ShopperReturnRefusal = "off" | "cancelled" | "not_delivered" | "window_closed" | "already_requested";

export interface ShopperReturnLine {
  orderItemId: string;
  name: string;
  variantOptions: Record<string, string> | null;
  quantity: number;
  /** How many can still be asked for (ordered minus open returns). */
  returnable: number;
}

/** A return on the order, as the shopper sees it. */
export interface ShopperReturnSummary {
  id: string;
  status: ReturnStatus;
  /** "code" or "code: the words typed with it". */
  reason: string;
  items: ReturnItemLine[];
  source: ReturnSource;
  createdAt: string;
}

export interface ShopperReturnEligibility {
  eligible: boolean;
  reason: ShopperReturnRefusal | null;
  /** The last moment to ask; null until the order is delivered. */
  deadline: string | null;
  windowDays: number;
  reasons: ReturnReasonCode[];
  photoRequiredFor: ReturnReasonCode[];
  items: ShopperReturnLine[];
  returns: ShopperReturnSummary[];
}

export interface ShopperReturnPayload {
  reasonCode: ReturnReasonCode;
  reasonDetail?: string;
  items: ReturnItemLine[];
  photoUploadIds?: string[];
}

function refQuery(ref: ShopperReturnOrderRef): string {
  return "token" in ref ? `token=${encodeURIComponent(ref.token)}` : `orderId=${encodeURIComponent(ref.orderId)}`;
}

function refHeaders(ref: ShopperReturnOrderRef): Record<string, string> {
  return "token" in ref ? {} : { "X-Shopper-Token": ref.shopperToken };
}

/** Whether the order can be returned now, what is left to return and the returns it already has. */
export function shopperReturnEligibility(
  client: ApiClient,
  workspaceId: string,
  ref: ShopperReturnOrderRef
): Promise<ShopperReturnEligibility> {
  return client.request<ShopperReturnEligibility>(`/store/${workspaceId}/returns/eligibility?${refQuery(ref)}`, {
    auth: false,
    headers: refHeaders(ref),
  });
}

/** Asks for a return. Send the same `visitorId` the photos were uploaded with. */
export async function shopperReturnRequest(
  client: ApiClient,
  workspaceId: string,
  ref: ShopperReturnOrderRef,
  payload: ShopperReturnPayload,
  visitorId: string
): Promise<ShopperReturnSummary> {
  const which = "token" in ref ? { token: ref.token } : { orderId: ref.orderId };
  const { return: created } = await client.request<{ return: ShopperReturnSummary }>(`/store/${workspaceId}/returns`, {
    method: "POST",
    body: { ...which, ...payload },
    auth: false,
    headers: { ...refHeaders(ref), "X-Visitor-Id": visitorId },
  });
  return created;
}

/** `details.reason` of a 409 RETURN_NOT_POSSIBLE, when the error is one. */
export function shopperReturnRefusalOf(err: unknown): ShopperReturnRefusal | null {
  const e = err as { code?: string; details?: { error?: { details?: { reason?: unknown } } } } | null;
  if (!e || e.code !== "RETURN_NOT_POSSIBLE") return null;
  const reason = e.details?.error?.details?.reason;
  return typeof reason === "string" ? (reason as ShopperReturnRefusal) : null;
}

/**
 * Returns: exchanges, courier return pickup, the decision the shopper hears, cancelling
 * (backend handoff items 372 and 396; src/modules/returns).
 *
 * Staff (orders.manage), /workspaces/:ws:
 *   GET/PUT /shopper-returns                 … + `exchanges` (boolean)
 *   PATCH  /returns/:id   { action, note?, notifyCustomer?, exchangeShippingAmount? } → { return }
 *          approving an exchange makes the replacement order (`exchangeOrderId`). 409 RETURN_NOT_PENDING.
 *   POST   /returns/:id/pickup  { carrierCode, carrierAddress?, notes? } | { carrierCode: "manual", waybillNumber }
 *          → 201 { return }. 409 RETURN_NOT_APPROVED / RETURN_PICKUP_EXISTS (details.pickupStatus) /
 *          CARRIER_NOT_CONNECTED, 422 CARRIER_NO_RETURN_PICKUP / CARRIER_ADDRESS_UNMATCHED, 424 CARRIER_BOOKING_NOT_SAVED.
 *   POST   /returns/:id/pickup/sync → { return }. 409 RETURN_NO_PICKUP / RETURN_PICKUP_MANUAL,
 *          422 CARRIER_NO_RETURN_PICKUP_STATUS.
 *   DELETE /returns/:id/pickup  { acknowledgeManualCancel? } → { return }
 *   POST   /returns/:id/cancel  { note?, acknowledgeManualCancel? } → { return }
 *          409 RETURN_PICKUP_COLLECTED / RETURN_PICKUP_CANCEL_FAILED / RETURN_PICKUP_MANUAL_CANCEL_REQUIRED /
 *          RETURN_NOT_CANCELLABLE, 422 CARRIER_PERMISSION_DENIED.
 *
 * Shopper (public), /store/:ws/returns:
 *   GET /eligibility → + `exchanges`, items[].exchangeOptions, returns[].{resolution, decisionNote, decidedAt,
 *          exchangeOrderNumber, pickup}
 *   POST /           → + `resolution` ("refund" | "exchange") and items[].exchangeVariantId
 *          422 VALIDATION_ERROR on `resolution` / `items.N.exchangeVariantId`.
 *
 * Amounts are integer minor units.
 */
import type { ApiClient } from "../client";
import type { CarrierAddressInput, CarrierInfo, ReturnReasonCode, ReturnRequest } from "../types";
import type {
  ShopperReturnEligibility,
  ShopperReturnLine,
  ShopperReturnOrderRef,
  ShopperReturnSummary,
  ShopperReturnsSettings,
} from "./shopperReturns";

export type ReturnResolution = "refund" | "exchange";

/** Where a booked return pickup stands. A pickup booked before item 396 has none: read it as `requested`. */
export type ReturnPickupStatus = "requested" | "picked_up" | "in_transit" | "returned_to_merchant" | "failed" | "cancelled";

export interface ReturnPickup {
  /** A courier's code, or "manual" for a pickup booked outside ZIMOS. */
  carrierCode: string;
  waybillNumber: string | null;
  trackingUrl: string | null;
  carrierShipmentId?: string | null;
  bookedAt: string;
  bookedBy?: string | null;
  status?: ReturnPickupStatus;
  /** The courier's own words. */
  carrierStatus?: { code?: string | null; value?: string | null } | null;
  statusAt?: string | null;
  reference?: string | null;
  labelUrl?: string | null;
  cancelledAt?: string | null;
  cancelMode?: string | null;
}

/** One returned line; an exchange names the variant the shopper wants instead. */
export interface ReturnCaseLine {
  orderItemId: string;
  quantity: number;
  exchangeVariantId?: string | null;
}

/** A return as the staff lists send it since items 372 / 396. */
export type ReturnCase = Omit<ReturnRequest, "items" | "status"> & {
  status: ReturnRequest["status"] | "cancelled";
  items: ReturnCaseLine[];
  resolution?: ReturnResolution;
  exchangeOrderId?: string | null;
  decisionNote?: string | null;
  decidedAt?: string | null;
  pickup?: ReturnPickup | null;
};

/** The same return, read with the fields of items 372 / 396. */
export function returnCaseOf(ret: ReturnRequest): ReturnCase {
  return ret as unknown as ReturnCase;
}

export function returnPickupStatusOf(pickup: Pick<ReturnPickup, "status"> | null | undefined): ReturnPickupStatus | null {
  return pickup ? (pickup.status ?? "requested") : null;
}

/** A pickup that still stands (not cancelled): booking another is refused. */
export function returnPickupIsLive(pickup: ReturnPickup | null | undefined): boolean {
  return Boolean(pickup) && returnPickupStatusOf(pickup) !== "cancelled";
}

export function returnIsCancelled(ret: ReturnRequest): boolean {
  return (ret.status as string) === "cancelled";
}

// ------------------------------------------------------------- staff ----

export type ShopperReturnsSettingsWithExchanges = ShopperReturnsSettings & { exchanges?: boolean };

export interface ReturnDecisionPayload {
  action: "approve" | "reject";
  /** Shown to the shopper (≤ 500). */
  note?: string;
  /** false: no email, push or automation for this decision. Left out: the store's email switch decides. */
  notifyCustomer?: boolean;
  /** Exchanges: what the replacement order charges for shipping (minor units). */
  exchangeShippingAmount?: number;
}

export async function returnDecide(client: ApiClient, workspaceId: string, returnId: string, payload: ReturnDecisionPayload): Promise<ReturnRequest> {
  const { return: updated } = await client.request<{ return: ReturnRequest }>(`/workspaces/${workspaceId}/returns/${returnId}`, {
    method: "PATCH",
    body: payload,
  });
  return updated;
}

export type ReturnPickupPayload =
  | { carrierCode: "manual"; waybillNumber: string }
  | { carrierCode: string; carrierAddress?: CarrierAddressInput; notes?: string };

export async function returnPickupBook(client: ApiClient, workspaceId: string, returnId: string, payload: ReturnPickupPayload): Promise<ReturnRequest> {
  const { return: updated } = await client.request<{ return: ReturnRequest }>(`/workspaces/${workspaceId}/returns/${returnId}/pickup`, {
    method: "POST",
    body: payload,
  });
  return updated;
}

export async function returnPickupSync(client: ApiClient, workspaceId: string, returnId: string): Promise<ReturnRequest> {
  const { return: updated } = await client.request<{ return: ReturnRequest }>(`/workspaces/${workspaceId}/returns/${returnId}/pickup/sync`, {
    method: "POST",
  });
  return updated;
}

export async function returnPickupCancel(
  client: ApiClient,
  workspaceId: string,
  returnId: string,
  options: { acknowledgeManualCancel?: boolean } = {}
): Promise<ReturnRequest> {
  const { return: updated } = await client.request<{ return: ReturnRequest }>(`/workspaces/${workspaceId}/returns/${returnId}/pickup`, {
    method: "DELETE",
    body: options.acknowledgeManualCancel ? { acknowledgeManualCancel: true } : {},
  });
  return updated;
}

export async function returnCancel(
  client: ApiClient,
  workspaceId: string,
  returnId: string,
  options: { note?: string; acknowledgeManualCancel?: boolean } = {}
): Promise<ReturnRequest> {
  const { return: updated } = await client.request<{ return: ReturnRequest }>(`/workspaces/${workspaceId}/returns/${returnId}/cancel`, {
    method: "POST",
    body: { ...(options.note ? { note: options.note } : {}), ...(options.acknowledgeManualCancel ? { acknowledgeManualCancel: true } : {}) },
  });
  return updated;
}

/** What a courier can do with return pickups (GET /carriers → capabilities). */
export function carrierReturnPickup(carrier: CarrierInfo | undefined): { book: boolean; status: boolean; cancel: boolean } {
  const caps = (carrier?.capabilities ?? {}) as { returnPickup?: boolean; returnPickupStatus?: boolean; returnPickupCancel?: boolean };
  return { book: caps.returnPickup === true, status: caps.returnPickupStatus === true, cancel: caps.returnPickupCancel === true };
}

// ----------------------------------------------------------- shopper ----

export interface ShopperExchangeOption {
  variantId: string;
  options: Record<string, string> | null;
  inStock: boolean;
}

export type ShopperReturnLineWithExchange = ShopperReturnLine & { exchangeOptions?: ShopperExchangeOption[] };

/** A return on the order, as the shopper sees it since items 372 / 396. */
export type ShopperReturnCase = Omit<ShopperReturnSummary, "items" | "status"> & {
  status: ShopperReturnSummary["status"] | "cancelled";
  items: ReturnCaseLine[];
  resolution?: ReturnResolution;
  decisionNote?: string | null;
  decidedAt?: string | null;
  exchangeOrderNumber?: string | null;
  pickup?: Pick<ReturnPickup, "carrierCode" | "waybillNumber" | "trackingUrl" | "bookedAt" | "status"> | null;
};

/** Whether the store takes exchanges for this order. */
export function shopperExchangesOn(eligibility: ShopperReturnEligibility): boolean {
  return (eligibility as ShopperReturnEligibility & { exchanges?: boolean }).exchanges === true;
}

export function shopperExchangeOptionsOf(line: ShopperReturnLine): ShopperExchangeOption[] {
  const options = (line as ShopperReturnLineWithExchange).exchangeOptions;
  return Array.isArray(options) ? options : [];
}

export function shopperReturnCaseOf(ret: ShopperReturnSummary): ShopperReturnCase {
  return ret as unknown as ShopperReturnCase;
}

export interface ShopperExchangePayload {
  reasonCode: ReturnReasonCode;
  reasonDetail?: string;
  resolution: ReturnResolution;
  items: ReturnCaseLine[];
  photoUploadIds?: string[];
}

/** Asks for a return or an exchange. Send the same `visitorId` the photos were uploaded with. */
export async function shopperReturnOrExchange(
  client: ApiClient,
  workspaceId: string,
  ref: ShopperReturnOrderRef,
  payload: ShopperExchangePayload,
  visitorId: string
): Promise<ShopperReturnSummary> {
  const which = "token" in ref ? { token: ref.token } : { orderId: ref.orderId };
  const headers: Record<string, string> = { "X-Visitor-Id": visitorId };
  if (!("token" in ref)) headers["X-Shopper-Token"] = ref.shopperToken;
  const { return: created } = await client.request<{ return: ShopperReturnSummary }>(`/store/${workspaceId}/returns`, {
    method: "POST",
    body: { ...which, ...payload },
    auth: false,
    headers,
  });
  return created;
}

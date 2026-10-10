/**
 * Returns: exchanges and the decision the shopper hears (backend
 * src/modules/returns; exchanges need STORE_FEATURES return_exchanges).
 *
 * Staff (orders.manage), /workspaces/:ws:
 *   GET/PUT /shopper-returns                 … + `exchanges` (boolean)
 *   PATCH  /returns/:id   { action, note?, notifyCustomer?, exchangeShippingAmount? } → { return }
 *          approving an exchange makes the replacement order (`exchangeOrderId`). 409 RETURN_NOT_PENDING.
 *
 * Shopper (public), /store/:ws/returns:
 *   GET /eligibility → + `exchanges`, items[].exchangeOptions, returns[].{resolution, decisionNote, decidedAt,
 *          exchangeOrderNumber}
 *   POST /           → + `resolution` ("refund" | "exchange") and items[].exchangeVariantId
 *          422 VALIDATION_ERROR on `resolution` / `items.N.exchangeVariantId`.
 *
 * Amounts are integer minor units.
 */
import type { ApiClient } from "../client";
import { SHOPPER_TOKEN_HEADER } from "../shopperToken";
import type { ReturnReasonCode, ReturnRequest } from "../types";
import type { ShopperReturnEligibility, ShopperReturnLine, ShopperReturnOrderRef, ShopperReturnSummary, ShopperReturnsSettings } from "./shopperReturns";

export type ReturnResolution = "refund" | "exchange";

/** One returned line; an exchange names the variant the shopper wants instead. */
export interface ReturnCaseLine {
  orderItemId: string;
  quantity: number;
  exchangeVariantId?: string | null;
}

/** A return as the staff lists send it. */
export type ReturnCase = Omit<ReturnRequest, "items"> & {
  items: ReturnCaseLine[];
  resolution?: ReturnResolution;
  exchangeOrderId?: string | null;
  decisionNote?: string | null;
  decidedAt?: string | null;
};

/** The same return, read with those fields. */
export function returnCaseOf(ret: ReturnRequest): ReturnCase {
  return ret as unknown as ReturnCase;
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

// ----------------------------------------------------------- shopper ----

export interface ShopperExchangeOption {
  variantId: string;
  options: Record<string, string> | null;
  inStock: boolean;
}

export type ShopperReturnLineWithExchange = ShopperReturnLine & { exchangeOptions?: ShopperExchangeOption[] };

/** A return on the order, as the shopper sees it. */
export type ShopperReturnCase = Omit<ShopperReturnSummary, "items"> & {
  items: ReturnCaseLine[];
  resolution?: ReturnResolution;
  decisionNote?: string | null;
  decidedAt?: string | null;
  exchangeOrderNumber?: string | null;
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
  if (!("token" in ref)) headers[SHOPPER_TOKEN_HEADER] = ref.shopperToken;
  const { return: created } = await client.request<{ return: ShopperReturnSummary }>(`/store/${workspaceId}/returns`, {
    method: "POST",
    body: { ...which, ...payload },
    auth: false,
    headers,
  });
  return created;
}

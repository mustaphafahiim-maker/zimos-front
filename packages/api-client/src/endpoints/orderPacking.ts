/**
 * Picking and packing orders (backend: orders/pickList.js, orders/packingSlips.js,
 * orders/scanToPack.js; frontend-handoff 226, 244 + 294, 249).
 *
 *   POST /workspaces/:ws/orders/documents/pick-list?as=json|base64            orders.view
 *     body { orderIds (1–500) } or { readyToShip: true }, optional locationId.
 *     Cancelled orders are left out; 422 NO_ORDERS_SELECTED when nothing is left to pick.
 *   POST /workspaces/:ws/orders/documents/packing-slips?size=A5|A4&as=base64  orders.view
 *     body { orderIds (1–200), note? ≤ 300 } → one page per order, in the order given.
 *     Cancelled orders get no slip and come back in `skipped`; 422 NO_ORDERS_SELECTED
 *     (details.skipped) when every order is cancelled.
 *   POST /workspaces/:ws/orders/:orderId/pack/check   { scans }                 orders.manage
 *   POST /workspaces/:ws/orders/:orderId/pack/confirm { scans, force?, note? }  orders.manage
 *     404 order, 409 ORDER_CANCELLED, 409 PACK_NOT_COMPLETE (details.lines, details.unknown),
 *     422 on `note` when forced without one. Confirm adds the tag `packed` to the order.
 *
 * Nothing is stored between pack calls: the page keeps the scans and sends all of them each time.
 * All exported names are prefixed `orderPick` / `orderPacking` / `orderPack`.
 */
import { ApiError, type ApiClient } from "../client";
import { apiErrorDetails } from "../errors";

const documents = (workspaceId: string) => `/workspaces/${workspaceId}/orders/documents`;

function pdfBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType || "application/pdf" });
}

// ------------------------------------------------------------ pick list --

/** A pick list takes at most this many orders. */
export const ORDER_PICK_LIST_MAX = 500;

/** The orders ticked in the list, or every order at stage "ready to ship" (oldest first, up to 500). */
export type OrderPickListRequest = ({ orderIds: string[] } | { readyToShip: true }) & {
  /** Keeps only the orders this stock location ships (handoff 206). */
  locationId?: string | null;
};

/** Which lot to take a line from, first expiring first (handoff 230). */
export interface OrderPickListLot {
  lotId: string;
  lotCode: string;
  /** "YYYY-MM-DD", or null for a lot without a date. */
  expiresOn: string | null;
  take: number;
  expired: boolean;
}

export interface OrderPickListLine {
  /** Null for a line with no variant (a custom line). */
  variantId: string | null;
  productId: string | null;
  name: string;
  options: Record<string, string>;
  sku: string | null;
  imageUrl: string | null;
  /** Pieces to take off the shelf for every order of this list. */
  quantity: number;
  orders: Array<{ orderId: string; orderNumber: string; quantity: number }>;
  lots?: OrderPickListLot[];
}

export interface OrderPickListLocation {
  /** Null: the store's main stock, when it has no stock locations. */
  locationId: string | null;
  name: string | null;
  /** Sorted by SKU, then name. */
  lines: OrderPickListLine[];
}

export interface OrderPickList {
  orderCount: number;
  unitCount: number;
  locations: OrderPickListLocation[];
}

export function orderPickList(client: ApiClient, workspaceId: string, request: OrderPickListRequest): Promise<OrderPickList> {
  return client.request<OrderPickList>(`${documents(workspaceId)}/pick-list?as=json`, { method: "POST", body: request });
}

/** The same list as a printable A4 PDF (tick box, quantity, name, options, SKU, the orders). */
export async function orderPickListPdf(
  client: ApiClient,
  workspaceId: string,
  request: OrderPickListRequest
): Promise<{ pdf: Blob; orderCount: number }> {
  const answer = await client.request<{ base64: string; contentType: string; orderCount: number }>(
    `${documents(workspaceId)}/pick-list?as=base64`,
    { method: "POST", body: request }
  );
  return { pdf: pdfBlob(answer.base64, answer.contentType), orderCount: answer.orderCount };
}

// -------------------------------------------------------- packing slips --

/** One PDF of packing slips takes at most this many orders. */
export const ORDER_PACKING_SLIPS_MAX = 200;
/** The note at the bottom of every slip, at most this long. */
export const ORDER_PACKING_NOTE_MAX = 300;

export type OrderPackingSlipSize = "A5" | "A4";

export interface OrderPackingSlips {
  pdf: Blob;
  /** How many slips the PDF holds. */
  printed: number;
  /** Ids of the cancelled orders left out (handoff 294). */
  skipped: string[];
}

/** One page per order to put in the parcel. `note` goes at the bottom of each. */
export async function orderPackingSlipsPdf(
  client: ApiClient,
  workspaceId: string,
  orderIds: string[],
  opts: { size?: OrderPackingSlipSize; note?: string } = {}
): Promise<OrderPackingSlips> {
  const note = (opts.note ?? "").trim();
  const answer = await client.request<{ base64: string; contentType: string; printed: number; skipped?: string[] }>(
    `${documents(workspaceId)}/packing-slips?size=${opts.size ?? "A5"}&as=base64`,
    { method: "POST", body: { orderIds, ...(note ? { note } : {}) } }
  );
  return { pdf: pdfBlob(answer.base64, answer.contentType), printed: answer.printed, skipped: answer.skipped ?? [] };
}

/** True for the 422 both documents answer when no order is left to print (all cancelled, none ready to ship). */
export function orderPackingNothingToPrint(err: unknown): boolean {
  return err instanceof ApiError && err.code === "NO_ORDERS_SELECTED";
}

// --------------------------------------------------------- scan to pack --

/** The tag a confirmed pack puts on the order; the orders list filters by it (?tag=packed). */
export const ORDER_PACKED_TAG = "packed";
/** One check or confirm takes at most this many scans, each at most ORDER_PACK_SCAN_LENGTH characters. */
export const ORDER_PACK_SCANS_MAX = 2000;
export const ORDER_PACK_SCAN_LENGTH = 120;
/** Why an order is packed without every scan, at most this long. */
export const ORDER_PACK_NOTE_MAX = 300;

/** One variant of the order: a pile to fill (a variant on two lines, or in a bundle, is one pile). */
export interface OrderPackLine {
  variantId: string;
  name: string;
  options: Record<string, string>;
  sku: string | null;
  barcode: string | null;
  expected: number;
  scanned: number;
  done: boolean;
  missing: number;
  over: number;
}

export interface OrderPackCheck {
  order: { id: string; orderNumber: string; packed: boolean };
  lines: OrderPackLine[];
  /** Lines with no variant: nothing to scan, the packer checks them by hand. */
  manual: Array<{ name: string; quantity: number }>;
  /** Codes that match no line of this order (wrong item), as scanned. */
  unknown: string[];
  /** Lines scanned more often than ordered. */
  over: Array<{ variantId: string; name: string; over: number }>;
  /** Every line scanned exactly and no unknown code. */
  complete: boolean;
  progress: { scanned: number; expected: number };
}

const pack = (workspaceId: string, orderId: string) => `/workspaces/${workspaceId}/orders/${orderId}/pack`;

/** What each line expects against everything scanned so far. A scan matches a barcode or a SKU, any case. */
export function orderPackCheck(client: ApiClient, workspaceId: string, orderId: string, scans: string[]): Promise<OrderPackCheck> {
  return client.request<OrderPackCheck>(`${pack(workspaceId, orderId)}/check`, { method: "POST", body: { scans } });
}

/** Marks the order packed. An incomplete list needs `force` with a `note`. */
export function orderPackConfirm(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  body: { scans: string[]; force?: boolean; note?: string }
): Promise<{ packed: boolean; complete: boolean }> {
  return client.request<{ packed: boolean; complete: boolean }>(`${pack(workspaceId, orderId)}/confirm`, {
    method: "POST",
    body,
  });
}

/** What a 409 PACK_NOT_COMPLETE names: the lines as they stand and the wrong codes; null for any other error. */
export function orderPackNotComplete(err: unknown): { lines: OrderPackLine[]; unknown: string[] } | null {
  if (!(err instanceof ApiError) || err.code !== "PACK_NOT_COMPLETE") return null;
  const details = apiErrorDetails<{ lines?: OrderPackLine[]; unknown?: string[] }>(err);
  return { lines: Array.isArray(details?.lines) ? details.lines : [], unknown: Array.isArray(details?.unknown) ? details.unknown : [] };
}

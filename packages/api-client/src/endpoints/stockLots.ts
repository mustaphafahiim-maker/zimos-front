/**
 * Stock lots with expiry dates (backend: frontend-handoff item 230, src/modules/stockLots).
 * Read inventory.view, change inventory.manage.
 *
 * A lot is a batch of one variant with a code and an expiry date, kept beside
 * the variant's stock count (which stays the one the store sells from). When an
 * order ships, its units come off the variant's lots, first expiring first.
 *
 * /workspaces/:ws/stock-lots:
 *   GET   /?variantId=&status=&withinDays=&limit= → { alertDays, lots } — first expiring first,
 *         lots without a date last (limit ≤ 500, default 100).
 *   POST  / StockLotInput                → 201 { lot }. `addToStock: true` (the default) adds the
 *         units to stock; `false` only labels units already on hand — 422 on `quantity` when the
 *         shelf holds fewer units without a lot.
 *   PATCH /:lotId StockLotPatch          → { lot }
 *   POST  /:lotId/write-off { quantity?, reason? } → { lot, writtenOff }: the units leave stock
 *         (all that is left without `quantity`). 422 LOT_NOT_ENOUGH past what the lot has left;
 *         422 INSUFFICIENT_STOCK when the shelf itself holds fewer.
 *   PUT   /settings { alertDays: 1–365 } → { alertDays }
 *
 * All exported names are prefixed `stockLot` / `StockLot`.
 */
import type { ApiClient } from "../client";
import { apiFieldProblems, isApiErrorCode } from "../errors";

/**
 * active: still holds units (an expired lot with units left is one too);
 * expiring: holds units, not expired, and its date is within `withinDays`;
 * expired: holds units past their date; empty: nothing left.
 */
export type StockLotStatus = "active" | "expiring" | "expired" | "empty";

export const STOCK_LOT_STATUSES: readonly StockLotStatus[] = ["active", "expiring", "expired", "empty"];

/** Most lots one read answers with. */
export const STOCK_LOTS_MAX_ROWS = 500;
/** A lot code is at most this long. */
export const STOCK_LOT_CODE_MAX = 60;
export const STOCK_LOT_NOTE_MAX = 300;
export const STOCK_LOT_REASON_MAX = 200;

export interface StockLot {
  id: string;
  variantId: string;
  /** Missing when the variant could not be read. */
  productName?: string;
  sku?: string | null;
  /** The stock location (item 206) it sits at; null = the default / the whole store. */
  locationId: string | null;
  lotCode: string;
  /** "YYYY-MM-DD", or null for a lot without a date. */
  expiresOn: string | null;
  quantityReceived: number;
  quantityRemaining: number;
  purchaseOrderId: string | null;
  note: string | null;
  /** Set when a write-off emptied it. */
  writtenOffAt: string | null;
  /** Its date is before today. */
  expired: boolean;
  createdAt: string;
}

export interface StockLotList {
  /** How many days before the expiry the team is warned (the store's setting). */
  alertDays: number;
  lots: StockLot[];
}

export interface StockLotQuery {
  variantId?: string;
  status?: StockLotStatus;
  /** For `expiring`: 1–365; left out, the store's alert days. */
  withinDays?: number;
  /** 1–500; the API's default is 100. */
  limit?: number;
}

export interface StockLotInput {
  variantId: string;
  /** 1–60 characters. */
  lotCode: string;
  /** "YYYY-MM-DD" */
  expiresOn: string | null;
  /** 1–1,000,000 */
  quantity: number;
  /** Default true. False labels units already on hand instead of adding new ones. */
  addToStock?: boolean;
  locationId?: string | null;
  purchaseOrderId?: string | null;
  /** Up to 300 characters. */
  note?: string | null;
}

export interface StockLotPatch {
  lotCode?: string;
  expiresOn?: string | null;
  note?: string | null;
}

export interface StockLotWriteOff {
  /** ≥ 1 and at most what the lot has left; left out, all of it. */
  quantity?: number;
  /** Up to 200 characters; it names the stock movement. */
  reason?: string | null;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/stock-lots`;

export function stockLotsList(client: ApiClient, workspaceId: string, query: StockLotQuery = {}): Promise<StockLotList> {
  const qs = new URLSearchParams();
  if (query.variantId) qs.set("variantId", query.variantId);
  if (query.status) qs.set("status", query.status);
  if (query.withinDays) qs.set("withinDays", String(query.withinDays));
  if (query.limit) qs.set("limit", String(query.limit));
  const s = qs.toString();
  return client.request<StockLotList>(`${base(workspaceId)}${s ? `?${s}` : ""}`);
}

export async function stockLotCreate(client: ApiClient, workspaceId: string, body: StockLotInput): Promise<StockLot> {
  const { lot } = await client.request<{ lot: StockLot }>(base(workspaceId), { method: "POST", body });
  return lot;
}

export async function stockLotUpdate(client: ApiClient, workspaceId: string, lotId: string, body: StockLotPatch): Promise<StockLot> {
  const { lot } = await client.request<{ lot: StockLot }>(`${base(workspaceId)}/${lotId}`, { method: "PATCH", body });
  return lot;
}

/** Takes expired or damaged units out of stock; answers the lot as it is now and how many left. */
export function stockLotWriteOff(
  client: ApiClient,
  workspaceId: string,
  lotId: string,
  body: StockLotWriteOff = {}
): Promise<{ lot: StockLot; writtenOff: number }> {
  return client.request<{ lot: StockLot; writtenOff: number }>(`${base(workspaceId)}/${lotId}/write-off`, { method: "POST", body });
}

export async function stockLotSaveAlertDays(client: ApiClient, workspaceId: string, alertDays: number): Promise<number> {
  const answer = await client.request<{ alertDays: number }>(`${base(workspaceId)}/settings`, { method: "PUT", body: { alertDays } });
  return answer.alertDays;
}

/**
 * For the 422 `stockLotCreate` answers when `addToStock` is off and the shelf holds
 * fewer units without a lot than asked: how many it does hold. null for any other error.
 */
export function stockLotUnlabelledUnits(err: unknown): number | null {
  const problem = apiFieldProblems(err).find((p) => p.field === "quantity");
  const match = problem ? /only (\d+) units?/i.exec(problem.message) : null;
  return match ? Number(match[1]) : null;
}

/**
 * For a write-off's 422 LOT_NOT_ENOUGH: how many units the lot has left, read from the
 * server's English sentence (kept as `messageEn` when the answer was translated).
 * null for any other error, or when the sentence does not say.
 */
export function stockLotUnitsLeft(err: unknown): number | null {
  if (!isApiErrorCode(err, "LOT_NOT_ENOUGH")) return null;
  const body = err.details as { error?: { messageEn?: unknown } } | null | undefined;
  const english = body && typeof body === "object" && typeof body.error?.messageEn === "string" ? body.error.messageEn : err.message;
  const match = /has (\d+) units? left/i.exec(english);
  return match ? Number(match[1]) : null;
}

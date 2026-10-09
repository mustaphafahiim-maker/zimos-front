/**
 * Parcels of an order (backend handoff items 375, 354, 351, 387; src/modules/orders + shipping).
 *
 * 375 — an order sent as several parcels (orders.view to read, orders.manage / shipping.manage to ship):
 *   GET  /workspaces/:ws/orders/:id/shipments/plan → { plan: ParcelPlan }
 *   POST /workspaces/:ws/orders/:id/shipments      CreateShipmentPayload + { items?, codAmount? }
 *        409 SHIPMENT_ITEMS_UNAVAILABLE (details.items), 409 SHIPMENT_ALREADY_EXISTS,
 *        422 VALIDATION_ERROR on items[n].orderItemId / codAmount, 422 COD_EXCEEDS_DUE (details.maxCodAmount).
 *   GET  /workspaces/:ws/orders/:id/waybill?shipmentId=… → one parcel's waybill (PDF);
 *        without it 422 SHIPMENT_REQUIRED (details.shipmentIds) when two or more live parcels remain.
 *
 * 354 — a parcel that came back undelivered:
 *   GET  /workspaces/:ws/orders/:id/restock-return → RestockReturnPreview
 *   POST /workspaces/:ws/orders/:id/restock-return → RestockReturnResult
 *        409 ORDER_NOT_RETURNED / ORDER_WAS_DELIVERED / SHIPMENT_ALREADY_EXISTS / ORDER_ALREADY_RESTOCKED.
 *
 * 351 — PATCH …/shipments/:id { status: "cancelled" } cancels a courier booking at the courier first:
 *        409 CARRIER_CANCEL_FAILED, 422 CARRIER_PERMISSION_DENIED, 409 CARRIER_NOT_CONNECTED,
 *        503 CARRIERS_NOT_CONFIGURED, 404 NOT_FOUND — each may carry details.manualCancelAllowed,
 *        after which { status: "cancelled", acknowledgeManualCancel: true } is accepted.
 *
 * 387 — tracking for manual and imported waybills (shipping.manage):
 *   GET/PUT /workspaces/:ws/shipping/tracking-provider → TrackingProviderSettings
 *   POST …/shipments/:id/sync also reads a manual shipment when tracking is on
 *        (409 SHIPMENT_NO_WAYBILL, 502 TRACKING_PROVIDER_FAILED).
 *
 * Amounts are integer minor units.
 */
import type { ApiClient } from "../client";
import { apiErrorCode, apiErrorDetails } from "../errors";
import type { CreateShipmentPayload, Shipment, ShipmentStatus, ShipmentSyncResult } from "../types";

// ------------------------------------------------------------ 375 ----

/** Units of one order line carried by a parcel. */
export interface ParcelItem {
  orderItemId: string;
  quantity: number;
}

/** Where one line of the order stands. */
export interface ParcelPlanLine {
  orderItemId: string;
  productName: string;
  variantOptions: Record<string, string> | null;
  sku: string | null;
  quantity: number;
  /** False for a digital or service line: never in a parcel. */
  shippable: boolean;
  /** A pre-order line's ship date (YYYY-MM-DD), or null. */
  preorderShipsAt: string | null;
  inShipments: number;
  delivered: number;
  remaining: number;
}

export interface ParcelPlanShipment {
  id: string;
  status: ShipmentStatus;
  carrierCode: string;
  waybillNumber: string | null;
  trackingCode: string;
  /** null: the whole order. */
  items: ParcelItem[] | null;
  codAmount: number | string | null;
  createdAt: string;
}

export interface ParcelPlan {
  orderId: string;
  paymentMethod: string;
  unitsRemaining: number;
  codRemaining: number | string;
  lines: ParcelPlanLine[];
  /** The next parcel the server would send; null when nothing is left. */
  suggested: {
    wholeOrder: boolean;
    items: ParcelItem[];
    codAmount: number | string | null;
    heldBack: ParcelItem[] | string[];
  } | null;
  shipments: ParcelPlanShipment[];
}

export async function parcelPlan(client: ApiClient, workspaceId: string, orderId: string): Promise<ParcelPlan> {
  const { plan } = await client.request<{ plan: ParcelPlan }>(`/workspaces/${workspaceId}/orders/${orderId}/shipments/plan`);
  return plan;
}

/** A shipment as the order now carries it: the units it holds and its own amount to collect. */
export type ParcelShipment = Shipment & {
  items?: ParcelItem[] | null;
  codAmount?: number | string | null;
  trackingState?: ShipmentTrackingState | null;
  trackingNextPollAt?: string | null;
  trackingFailures?: number;
};

export type ParcelCreatePayload = CreateShipmentPayload & {
  /** The units in this parcel. Left out: the whole order, or everything still to send. */
  items?: ParcelItem[];
  /** COD orders, split parcels only: what the courier collects for this parcel. */
  codAmount?: number;
};

export async function parcelCreate(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  payload: ParcelCreatePayload
): Promise<ParcelShipment> {
  const { shipment } = await client.request<{ shipment: ParcelShipment }>(`/workspaces/${workspaceId}/orders/${orderId}/shipments`, {
    method: "POST",
    body: payload,
  });
  return shipment;
}

/** The units a shipment row carries, when it is a part of the order. */
export function parcelItemsOf(shipment: Shipment): ParcelItem[] | null {
  const items = (shipment as ParcelShipment).items;
  return Array.isArray(items) && items.length > 0 ? items : null;
}

/** Its own amount to collect (minor units), when it is a part of a COD order. */
export function parcelCodOf(shipment: Shipment): number | null {
  const cod = (shipment as ParcelShipment).codAmount;
  if (cod === null || cod === undefined || cod === "") return null;
  const n = Number(cod);
  return Number.isFinite(n) ? n : null;
}

/** `details.maxCodAmount` of a 422 COD_EXCEEDS_DUE. */
export function parcelMaxCodOf(err: unknown): number | null {
  if (apiErrorCode(err) !== "COD_EXCEEDS_DUE") return null;
  const max = Number(apiErrorDetails<{ maxCodAmount?: number | string }>(err)?.maxCodAmount);
  return Number.isFinite(max) ? max : null;
}

/** `details.shipmentIds` of a 422 SHIPMENT_REQUIRED. */
export function parcelChoicesOf(err: unknown): string[] {
  if (apiErrorCode(err) !== "SHIPMENT_REQUIRED") return [];
  const ids = apiErrorDetails<{ shipmentIds?: unknown }>(err)?.shipmentIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

/** The waybill PDF of one parcel (or of the order when `shipmentId` is left out). */
export async function parcelWaybillPdf(client: ApiClient, workspaceId: string, orderId: string, shipmentId?: string): Promise<Blob> {
  const raw = client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> };
  const query = shipmentId ? `?shipmentId=${encodeURIComponent(shipmentId)}` : "";
  const res = await raw.rawFetch(`/workspaces/${workspaceId}/orders/${orderId}/waybill${query}`, {
    headers: { Accept: "application/pdf" },
  });
  return res.blob();
}

// ------------------------------------------------------------ 354 ----

export interface RestockReturnUnit {
  variantId: string;
  quantity: number;
  sku: string | null;
  productName: string;
  optionValues: Record<string, string> | null;
}

export type RestockReturnRefusal = "not_returned" | "was_delivered" | "shipment_active" | "nothing_held";

export interface RestockReturnPreview {
  canRestock: boolean;
  reason: RestockReturnRefusal | null;
  units: RestockReturnUnit[];
  /** When the order was last restocked; null if never, or booked again since. */
  restockedAt: string | null;
}

export interface RestockReturnResult {
  orderId: string;
  units: RestockReturnUnit[];
  restockedAt: string;
}

export function restockReturnPreview(client: ApiClient, workspaceId: string, orderId: string): Promise<RestockReturnPreview> {
  return client.request<RestockReturnPreview>(`/workspaces/${workspaceId}/orders/${orderId}/restock-return`);
}

export function restockReturnRun(client: ApiClient, workspaceId: string, orderId: string): Promise<RestockReturnResult> {
  return client.request<RestockReturnResult>(`/workspaces/${workspaceId}/orders/${orderId}/restock-return`, { method: "POST" });
}

// ------------------------------------------------------------ 351 ----

/** True when a refused shipment cancel may be repeated with `acknowledgeManualCancel`. */
export function shipmentManualCancelAllowed(err: unknown): boolean {
  return apiErrorDetails<{ manualCancelAllowed?: boolean }>(err)?.manualCancelAllowed === true;
}

// ------------------------------------------------------------ 387 ----

export interface TrackingProviderOption {
  code: string;
  name: string;
  sandbox: boolean;
  available: boolean;
}

export interface TrackingProviderSettings {
  trackingProvider: { enabled: boolean; provider: string | null };
  providers: TrackingProviderOption[];
  polling: { intervalMinutes: number; maxAgeDays: number };
}

export function trackingProviderGet(client: ApiClient, workspaceId: string): Promise<TrackingProviderSettings> {
  return client.request<TrackingProviderSettings>(`/workspaces/${workspaceId}/shipping/tracking-provider`);
}

export function trackingProviderSave(
  client: ApiClient,
  workspaceId: string,
  body: { enabled: boolean; provider?: string }
): Promise<TrackingProviderSettings> {
  return client.request<TrackingProviderSettings>(`/workspaces/${workspaceId}/shipping/tracking-provider`, { method: "PUT", body });
}

/** What the tracking provider last said about a manual shipment's waybill. */
export interface ShipmentTrackingState {
  provider: string;
  courier?: string | null;
  lastCheckedAt: string | null;
  lastCheckpointAt?: string | null;
  lastStatus?: string | null;
  failedWaybill?: string | null;
}

export function shipmentTrackingOf(shipment: Shipment): { state: ShipmentTrackingState | null; failures: number } {
  const s = shipment as ParcelShipment;
  return { state: s.trackingState ?? null, failures: Number(s.trackingFailures ?? 0) || 0 };
}

/** POST …/sync on a manual shipment: the usual answer plus what the provider added. */
export type TrackedSyncResult = Omit<ShipmentSyncResult, "shipment"> & {
  shipment: ParcelShipment;
  tracking?: { provider: string; newCheckpoints: number } | null;
};

export function trackedShipmentSync(client: ApiClient, workspaceId: string, orderId: string, shipmentId: string): Promise<TrackedSyncResult> {
  return client.request<TrackedSyncResult>(`/workspaces/${workspaceId}/orders/${orderId}/shipments/${shipmentId}/sync`, { method: "POST" });
}

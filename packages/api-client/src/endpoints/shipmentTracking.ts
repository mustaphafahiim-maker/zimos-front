/**
 * A parcel that came back, and tracking for manual and imported waybills
 * (backend src/modules/orders and src/modules/shipping).
 *
 * A parcel that came back undelivered:
 *   GET  /workspaces/:ws/orders/:id/restock-return → RestockReturnPreview
 *   POST /workspaces/:ws/orders/:id/restock-return → RestockReturnResult
 *        409 ORDER_NOT_RETURNED / ORDER_WAS_DELIVERED / SHIPMENT_ALREADY_EXISTS / ORDER_ALREADY_RESTOCKED.
 *
 * Tracking for manual and imported waybills (shipping.manage):
 *   GET/PUT /workspaces/:ws/shipping/tracking-provider → TrackingProviderSettings
 *   POST …/shipments/:id/sync also reads a manual shipment when tracking is on
 *        (409 SHIPMENT_NO_WAYBILL, 502 TRACKING_PROVIDER_FAILED).
 */
import type { ApiClient } from "../client";
import type { Shipment, ShipmentSyncResult } from "../types";

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

// ------------------------------------------------ tracking provider ----

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

/** A shipment with what the tracking provider keeps on it. */
export type TrackedShipment = Shipment & {
  trackingState?: ShipmentTrackingState | null;
  trackingFailures?: number;
};

export function shipmentTrackingOf(shipment: Shipment): { state: ShipmentTrackingState | null; failures: number } {
  const s = shipment as TrackedShipment;
  return { state: s.trackingState ?? null, failures: Number(s.trackingFailures ?? 0) || 0 };
}

/** POST …/sync on a manual shipment: the usual answer plus what the provider added. */
export type TrackedSyncResult = Omit<ShipmentSyncResult, "shipment"> & {
  shipment: TrackedShipment;
  tracking?: { provider: string; newCheckpoints: number } | null;
};

export function trackedShipmentSync(client: ApiClient, workspaceId: string, orderId: string, shipmentId: string): Promise<TrackedSyncResult> {
  return client.request<TrackedSyncResult>(`/workspaces/${workspaceId}/orders/${orderId}/shipments/${shipmentId}/sync`, { method: "POST" });
}

/**
 * "Ship selected" with a connected courier (backend:
 * src/modules/shipping/bulkShipping.js). Mounted at
 * /workspaces/:workspaceId/shipment-batches (orders.manage).
 *
 *   POST /preview          which orders are ready, which have no place on the
 *                          courier's list, and which cannot ship — nothing booked
 *   POST /                 202: a batch the carriers queue books order by order
 *   GET  /                 the latest 20 batches, with counts
 *   GET  /:batchId         one batch with every order's result
 *   POST /:batchId/retry   202: the failed orders go to the courier again
 *
 * `addresses` maps an order id to the courier place chosen for it (one id
 * per level of the courier's list, top first). A booking is never repeated
 * on its own: only the merchant sends a failed order again. All exported
 * names are prefixed `shipmentBatch` / `ShipmentBatch`.
 */
import type { ApiClient } from "../client";
import type { CarrierPlaceRef } from "../types";
import type { CarrierRegion } from "./carrierRegions";

export type ShipmentBatchAddresses = Record<string, { path: string[] }>;

type PlaceSummary = Pick<CarrierRegion, "code" | "level" | "nameAr" | "nameEn">;

export interface ShipmentBatchPreview {
  carrierCode: string;
  carrierName: string;
  /** The courier's address levels, top first. */
  levels: string[];
  total: number;
  ready: { orderId: string; orderNumber: string; place: CarrierPlaceRef[] }[];
  /** No place on the courier's list. `region` set: fix it on the areas map and every order from there follows. */
  missing: {
    orderId: string;
    orderNumber: string;
    province: string | null;
    city: string | null;
    region: PlaceSummary | null;
    governorate: PlaceSummary | null;
    code: string;
  }[];
  /** Cannot ship at all (not confirmed, not paid, already shipped…). */
  blocked: {
    orderId: string;
    orderNumber: string | null;
    code: string;
    message: string;
  }[];
}

export type ShipmentBatchStatus = "queued" | "running" | "done";
export type ShipmentBatchItemStatus =
  | "pending"
  | "booking"
  | "booked"
  | "failed";

export interface ShipmentBatchItem {
  orderId: string;
  orderNumber: string | null;
  status: ShipmentBatchItemStatus;
  waybillNumber: string | null;
  shipmentId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
  updatedAt: string;
}

export interface ShipmentBatch {
  id: string;
  carrierCode: string;
  status: ShipmentBatchStatus;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  counts: { total: number; pending: number; booked: number; failed: number };
  /** Absent in the list. */
  items?: ShipmentBatchItem[];
}

const base = (workspaceId: string) =>
  `/workspaces/${workspaceId}/shipment-batches`;

export function shipmentBatchPreview(
  client: ApiClient,
  workspaceId: string,
  body: {
    carrierCode: string;
    orderIds: string[];
    addresses?: ShipmentBatchAddresses;
  },
): Promise<ShipmentBatchPreview> {
  return client.request<ShipmentBatchPreview>(`${base(workspaceId)}/preview`, {
    method: "POST",
    body,
  });
}

export async function shipmentBatchStart(
  client: ApiClient,
  workspaceId: string,
  body: {
    carrierCode: string;
    orderIds: string[];
    addresses?: ShipmentBatchAddresses;
    notes?: string;
  },
): Promise<ShipmentBatch> {
  const { batch } = await client.request<{ batch: ShipmentBatch }>(
    base(workspaceId),
    { method: "POST", body },
  );
  return batch;
}

export async function shipmentBatchList(
  client: ApiClient,
  workspaceId: string,
): Promise<ShipmentBatch[]> {
  const { batches } = await client.request<{ batches: ShipmentBatch[] }>(
    base(workspaceId),
  );
  return batches;
}

export async function shipmentBatchGet(
  client: ApiClient,
  workspaceId: string,
  batchId: string,
): Promise<ShipmentBatch> {
  const { batch } = await client.request<{ batch: ShipmentBatch }>(
    `${base(workspaceId)}/${batchId}`,
  );
  return batch;
}

export async function shipmentBatchRetry(
  client: ApiClient,
  workspaceId: string,
  batchId: string,
  body: { orderIds?: string[]; addresses?: ShipmentBatchAddresses } = {},
): Promise<ShipmentBatch> {
  const { batch } = await client.request<{ batch: ShipmentBatch }>(
    `${base(workspaceId)}/${batchId}/retry`,
    {
      method: "POST",
      body,
    },
  );
  return batch;
}

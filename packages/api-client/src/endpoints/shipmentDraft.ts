import type { ApiClient } from "../client";

/**
 * The shipping card's "Save as draft" (orders/shipmentDraft.js): the shipment
 * being prepared, kept on the order without booking. A manual shipment's
 * draft has carrierCode "manual" and `manual`. Cleared when a shipment is created.
 */
export interface ShipmentDraftInput {
  carrierCode: string;
  /** The courier's address: city/district ids, a path of area ids, or typed names. */
  address?: { cityId?: string; districtId?: string; path?: string[]; names?: string[] };
  tierId?: string;
  notes?: string;
  manual?: { carrierName?: string; waybillNumber?: string; trackingUrl?: string };
}

export interface ShipmentDraft extends ShipmentDraftInput {
  savedAt: string;
  savedBy: { id: string; name: string | null } | null;
}

/** The order's saved draft (GET /orders/:id carries it as `shipmentDraft`), or null. */
export function shipmentDraftOf(order: object | null | undefined): ShipmentDraft | null {
  const draft = (order as { shipmentDraft?: unknown } | null | undefined)?.shipmentDraft;
  return draft && typeof draft === "object" && typeof (draft as ShipmentDraft).carrierCode === "string" ? (draft as ShipmentDraft) : null;
}

export async function ordersSaveShipmentDraft(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  draft: ShipmentDraftInput
): Promise<ShipmentDraft> {
  const { shipmentDraft } = await client.request<{ shipmentDraft: ShipmentDraft }>(
    `/workspaces/${workspaceId}/orders/${orderId}/shipment-draft`,
    { method: "PUT", body: draft }
  );
  return shipmentDraft;
}

export async function ordersDiscardShipmentDraft(client: ApiClient, workspaceId: string, orderId: string): Promise<void> {
  await client.request<void>(`/workspaces/${workspaceId}/orders/${orderId}/shipment-draft`, { method: "DELETE" });
}

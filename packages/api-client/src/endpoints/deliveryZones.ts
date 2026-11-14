/**
 * Delivery zones inside a city (backend: shipping/deliveryZones.js), mounted
 * at /workspaces/:workspaceId/delivery-zones (shipping.manage). Checkout uses
 * them only while the shipping setting `deliveryZonesEnabled` is on.
 */
import type { ApiClient } from "../client";

export interface DeliveryZone {
  id: string;
  name: string;
  /** Minor units. */
  feeAmount: number;
  /** Minor units; null = no minimum of its own. */
  minOrderAmount: number | null;
  etaMinutes: number | null;
  active: boolean;
  sortOrder: number;
}

export type DeliveryZoneInput = Partial<Pick<DeliveryZone, "name" | "feeAmount" | "minOrderAmount" | "etaMinutes" | "active">>;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/delivery-zones`;

export async function deliveryZonesList(client: ApiClient, workspaceId: string): Promise<DeliveryZone[]> {
  const { zones } = await client.request<{ zones: DeliveryZone[] }>(base(workspaceId));
  return zones;
}

export async function deliveryZoneCreate(
  client: ApiClient,
  workspaceId: string,
  input: DeliveryZoneInput & { name: string; feeAmount: number },
): Promise<DeliveryZone> {
  const { zone } = await client.request<{ zone: DeliveryZone }>(base(workspaceId), { method: "POST", body: input });
  return zone;
}

export async function deliveryZoneUpdate(client: ApiClient, workspaceId: string, zoneId: string, input: DeliveryZoneInput): Promise<DeliveryZone> {
  const { zone } = await client.request<{ zone: DeliveryZone }>(`${base(workspaceId)}/${zoneId}`, { method: "PATCH", body: input });
  return zone;
}

export async function deliveryZoneDelete(client: ApiClient, workspaceId: string, zoneId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/${zoneId}`, { method: "DELETE" });
}

/** Every one of the store's zones, once, in the new order. */
export async function deliveryZonesReorder(client: ApiClient, workspaceId: string, ids: string[]): Promise<DeliveryZone[]> {
  const { zones } = await client.request<{ zones: DeliveryZone[] }>(`${base(workspaceId)}/order`, { method: "PUT", body: { ids } });
  return zones;
}

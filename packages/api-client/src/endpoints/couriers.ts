/**
 * A store's own couriers (backend: modules/couriers), mounted at
 * /workspaces/:workspaceId/couriers. Listing needs orders.view; changing the
 * list needs shipping.manage. 409 COURIER_NAME_TAKEN for a name already used
 * (any case); 409 COURIER_IN_USE when deleting one who carried orders.
 */
import type { ApiClient } from "../client";

export interface Courier {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  createdAt: string;
}

export interface CourierInput {
  name?: string;
  phone?: string | null;
  active?: boolean;
}

/** A name typed as the courier before the store had couriers, and how many parcels carry it. */
export interface CourierLegacyName {
  name: string;
  shipments: number;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/couriers`;

export async function couriersList(client: ApiClient, workspaceId: string): Promise<Courier[]> {
  const { couriers } = await client.request<{ couriers: Courier[] }>(base(workspaceId));
  return couriers;
}

export async function couriersLegacyNames(client: ApiClient, workspaceId: string): Promise<CourierLegacyName[]> {
  const { names } = await client.request<{ names: CourierLegacyName[] }>(`${base(workspaceId)}/legacy-names`);
  return names;
}

/** `linkedShipments`: parcels typed with this name before, now linked to the courier. */
export async function courierCreate(
  client: ApiClient,
  workspaceId: string,
  input: CourierInput & { name: string },
): Promise<{ courier: Courier; linkedShipments: number }> {
  return client.request(base(workspaceId), { method: "POST", body: input });
}

export async function courierUpdate(
  client: ApiClient,
  workspaceId: string,
  courierId: string,
  input: CourierInput,
): Promise<{ courier: Courier; linkedShipments: number }> {
  return client.request(`${base(workspaceId)}/${courierId}`, { method: "PATCH", body: input });
}

export async function courierDelete(client: ApiClient, workspaceId: string, courierId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/${courierId}`, { method: "DELETE" });
}

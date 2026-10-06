/**
 * Shipping groups (backend: shipping/shippingProfiles.js), mounted at
 * /workspaces/:workspaceId/shipping/profiles (shipping.manage).
 *
 * A group's price for a destination is its governorate price (keys are the
 * shipping settings' governorate codes) or else its flat price. An order
 * pays the dearest price that applies to its products.
 */
import type { ApiClient } from "../client";

export interface ShippingProfile {
  id: string;
  name: string;
  /**
   * The currency its prices are in; null = the store's. A group in another
   * currency prices a funnel that sells in it and holds no products.
   */
  currency: string | null;
  /** Minor units; null = no price of its own outside the listed governorates. */
  flatAmount: number | null;
  governorateAmounts: Record<string, number>;
  productCount: number;
}

export type ShippingProfileInput = Partial<Pick<ShippingProfile, "name" | "currency" | "flatAmount" | "governorateAmounts">>;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/shipping/profiles`;

export async function shippingProfilesList(client: ApiClient, workspaceId: string): Promise<ShippingProfile[]> {
  const { profiles } = await client.request<{ profiles: ShippingProfile[] }>(base(workspaceId));
  return profiles;
}

export async function shippingProfileGet(
  client: ApiClient,
  workspaceId: string,
  profileId: string,
): Promise<{ profile: ShippingProfile; products: Array<{ id: string; name: string; status: string }> }> {
  return client.request(`${base(workspaceId)}/${profileId}`);
}

export async function shippingProfileCreate(client: ApiClient, workspaceId: string, input: ShippingProfileInput & { name: string }): Promise<ShippingProfile> {
  const { profile } = await client.request<{ profile: ShippingProfile }>(base(workspaceId), { method: "POST", body: input });
  return profile;
}

export async function shippingProfileUpdate(client: ApiClient, workspaceId: string, profileId: string, input: ShippingProfileInput): Promise<ShippingProfile> {
  const { profile } = await client.request<{ profile: ShippingProfile }>(`${base(workspaceId)}/${profileId}`, { method: "PATCH", body: input });
  return profile;
}

/** The products in the group, replaced as a whole (a product is in one group at most). */
export async function shippingProfileSetProducts(client: ApiClient, workspaceId: string, profileId: string, productIds: string[]): Promise<ShippingProfile> {
  const { profile } = await client.request<{ profile: ShippingProfile }>(`${base(workspaceId)}/${profileId}/products`, { method: "PUT", body: { productIds } });
  return profile;
}

export async function shippingProfileDelete(client: ApiClient, workspaceId: string, profileId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/${profileId}`, { method: "DELETE" });
}

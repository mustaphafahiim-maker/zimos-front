/**
 * Shipping options the shopper chooses between (backend:
 * shipping/shippingOptions.js), mounted at
 * /workspaces/:workspaceId/shipping/options (shipping.manage).
 *
 * `standard` is always offered at the store's normal price (only its name
 * and delivery time are set here); each extra option either adds `amount`
 * to it (`add`, e.g. express) or costs exactly `amount` (`fixed`, e.g.
 * pickup). No extra option = no choice at checkout.
 */
import type { ApiClient } from "../client";

export interface ShippingOptionStandard {
  nameAr: string | null;
  nameEn: string | null;
  daysMin: number | null;
  daysMax: number | null;
}

export interface ShippingOptionExtra extends ShippingOptionStandard {
  key: string;
  mode: "add" | "fixed";
  /** Minor units. */
  amount: number;
  active: boolean;
}

export interface ShippingOptionsSettings {
  standard: ShippingOptionStandard;
  extra: ShippingOptionExtra[];
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/shipping/options`;

export async function shippingOptionsGet(client: ApiClient, workspaceId: string): Promise<ShippingOptionsSettings> {
  const { options } = await client.request<{ options: ShippingOptionsSettings }>(base(workspaceId));
  return options;
}

export async function shippingOptionsSave(client: ApiClient, workspaceId: string, settings: ShippingOptionsSettings): Promise<ShippingOptionsSettings> {
  const { options } = await client.request<{ options: ShippingOptionsSettings }>(base(workspaceId), { method: "PUT", body: settings });
  return options;
}

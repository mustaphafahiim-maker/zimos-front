/**
 * VIP tiers (backend: frontend-handoff item 218, src/modules/vipTiers).
 *
 * Customers move up by what they spent — or how many orders they placed — on
 * DELIVERED orders, over a window of days or ever. A tier's perks (a percent
 * off plain lines, free shipping, more loyalty points) apply to a signed-in
 * shopper at checkout. The merchant sets every number.
 *
 * Dashboard, /workspaces/:ws/vip-tiers:
 *   GET  /                       (customers.view)   → VipSettings
 *   PUT  /  VipSettingsPayload   (discounts.manage) → VipSettings   (422 on `tiers` when enabled with none)
 *   GET  /customers/:customerId  (customers.view)   → CustomerVip
 *
 * Storefront:
 *   GET /store/:ws/account/vip (X-Shopper-Token; 401 SHOPPER_NOT_SIGNED_IN) → ShopperVip
 *   Checkout with X-Shopper-Token: plain lines are priced `percentOff` lower (the lowest of
 *   normal, price list and VIP wins), the order ships free when the tier says so, and loyalty
 *   points are multiplied on delivery. The cart and the shipping quote do not know the tier.
 *
 * A threshold is minor units with basis "spent" (net of refunds), a count of orders with "orders".
 */
import type { ApiClient } from "../client";

export type VipBasis = "spent" | "orders";

/** A tier's name in the store's languages; at least one is set. */
export interface VipTierName {
  ar?: string;
  en?: string;
}

/** What a tier gives. */
export interface VipTierPerks {
  /** 0–50, off the normal price of plain lines. */
  percentOff: number;
  freeShipping: boolean;
  /** 1–5: loyalty points earned × this (1 = no change). */
  pointsMultiplier: number;
}

export interface VipTier extends VipTierPerks {
  id: string;
  name: VipTierName;
  /** Minor units ("spent") or a number of orders ("orders"). */
  threshold: number;
}

export interface VipSettings {
  enabled: boolean;
  basis: VipBasis;
  /** How far back delivered orders count, 30–1825 days; null for ever. */
  windowDays: number | null;
  /** By threshold, lowest first. */
  tiers: VipTier[];
}

export interface VipSettingsPayload {
  enabled: boolean;
  basis: VipBasis;
  windowDays: number | null;
  /** A tier without an id is new: the API gives it one. */
  tiers: Array<Omit<VipTier, "id"> & { id?: string }>;
}

/** The API's limits, for the form's own checks. */
export const VIP_LIMITS = {
  tiersMax: 6,
  nameMax: 40,
  percentMax: 50,
  multiplierMin: 1,
  multiplierMax: 5,
  windowMin: 30,
  windowMax: 1825,
  thresholdMax: 1_000_000_000_000,
} as const;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/vip-tiers`;

export function vipTiersGet(client: ApiClient, workspaceId: string): Promise<VipSettings> {
  return client.request<VipSettings>(base(workspaceId));
}

export function vipTiersSave(client: ApiClient, workspaceId: string, body: VipSettingsPayload): Promise<VipSettings> {
  return client.request<VipSettings>(base(workspaceId), { method: "PUT", body });
}

/** A tier as a customer or a shopper is told about it. */
export interface VipTierInfo extends VipTierPerks {
  id: string;
  name: VipTierName;
}

/** The tier above, and what is still missing to reach it (minor units or orders, by the basis). */
export interface VipNextTier {
  id: string;
  name: VipTierName;
  missing: number;
}

export interface CustomerVip {
  /** null below the first tier. */
  tier: VipTierInfo | null;
  /** null at the top tier. */
  next: VipNextTier | null;
  /** What the customer's delivered orders come to; null while the store has no tiers running. */
  standing: { basis: VipBasis; value: number; spent: number; orders: number } | null;
}

export function vipCustomerGet(client: ApiClient, workspaceId: string, customerId: string): Promise<CustomerVip> {
  return client.request<CustomerVip>(`${base(workspaceId)}/customers/${customerId}`);
}

// ----------------------------------------------------------- storefront --

export interface ShopperVip {
  /** False when the store runs no tiers: everything else is then empty. */
  enabled: boolean;
  basis?: VipBasis;
  tier: VipTierInfo | null;
  next: VipNextTier | null;
  /** The shopper's amount spent (minor units) or orders, by the basis. */
  standing?: { value: number } | null;
  /** Every tier of the store, lowest first. */
  tiers: Array<VipTierInfo & { threshold: number }>;
}

/** The signed-in shopper's tier, the next one and every tier of the store. */
export function shopperVip(client: ApiClient, workspaceRef: string, token: string): Promise<ShopperVip> {
  return client.request<ShopperVip>(`/store/${workspaceRef}/account/vip`, {
    auth: false,
    headers: { "X-Shopper-Token": token },
  });
}

/** A tier's name in the reader's language, falling back to the other one. */
export function vipTierName(name: VipTierName | null | undefined, language: string): string {
  const ar = name?.ar?.trim() ?? "";
  const en = name?.en?.trim() ?? "";
  return language.toLowerCase().startsWith("ar") ? ar || en : en || ar;
}

/** Whether a tier gives anything at all. */
export function vipTierHasPerks(tier: VipTierPerks | null | undefined): boolean {
  return Boolean(tier && (tier.percentOff > 0 || tier.freeShipping || tier.pointsMultiplier > 1));
}

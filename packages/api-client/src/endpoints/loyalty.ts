/**
 * Loyalty points (backend: frontend-handoff item 203, src/modules/loyalty).
 *
 * Customers earn points on delivered orders and spend them at checkout. The
 * merchant sets every number; with no earn rate or point value the programme
 * stays off.
 *
 * Dashboard, /workspaces/:ws/loyalty:
 *   GET  /                              (customers.view)   → LoyaltyOverview
 *   PUT  /  LoyaltySettingsPayload      (discounts.manage) → { settings, active }
 *   GET  /customers/:customerId         (customers.view)   → LoyaltyAccount (last 200 changes)
 *   POST /customers/:customerId/adjust  (customers.manage) { points: ±int, note } → { balance, applied }
 *        The balance never goes below 0: `applied` is what really moved.
 *
 * Storefront:
 *   GET /store/:ws/loyalty              → { program | null } (public, cached 5 minutes)
 *   GET /store/:ws/account/loyalty      → ShopperLoyalty (X-Shopper-Token; 401 SHOPPER_NOT_SIGNED_IN)
 *   Checkout: `loyaltyPoints` (int) with X-Shopper-Token, with cash on delivery or an online
 *   payment (not bank transfer). On field `loyaltyPoints`: 401 SHOPPER_NOT_SIGNED_IN,
 *   422 LOYALTY_OFF, LOYALTY_TOO_FEW, LOYALTY_NOT_ENOUGH. The 201 adds `loyalty` (LoyaltyRedemption).
 *
 * Points are whole numbers. Money is integer minor units (sent as a string in the ledger).
 */
import { ApiError, type ApiClient } from "../client";
import { apiErrorDetails } from "../errors";

export interface LoyaltySettings {
  /** What the merchant switched: the programme only runs when the two rates are set too (`active`). */
  enabled: boolean;
  /** Points per 1 unit of the store currency spent (0.01–1000), or null when unset. */
  earnPointsPerUnit: number | null;
  /** What one point is worth, in minor units (10 = EGP 0.10), or null when unset. */
  pointValue: number | null;
  /** Fewest points a shopper may use on an order (≥ 1). */
  minRedeemPoints: number;
  /** Most of an order's total points may pay, 1–100. */
  maxRedeemPercent: number;
  /** Days without earning or spending after which a balance expires (30–1825), or null for never. */
  expiryDays: number | null;
}

export interface LoyaltyOverview {
  settings: LoyaltySettings;
  /** Enabled and fully set: shoppers earn and spend. */
  active: boolean;
  currency: string;
  customersWithPoints: number;
  outstandingPoints: number;
  /** Minor units, as a string; null while no point value is set. */
  outstandingWorth: string | null;
}

export interface LoyaltySettingsPayload {
  enabled: boolean;
  /** Required when `enabled`. */
  earnPointsPerUnit?: number | null;
  /** Required when `enabled`. */
  pointValue?: number | null;
  minRedeemPoints?: number;
  maxRedeemPercent?: number;
  expiryDays?: number | null;
}

/** The API's limits, for the form's own checks. */
export const LOYALTY_LIMITS = {
  earnMin: 0.01,
  earnMax: 1000,
  pointValueMin: 1,
  pointValueMax: 1_000_000,
  minRedeemMax: 10_000_000,
  expiryMin: 30,
  expiryMax: 1825,
  adjustMax: 10_000_000,
  noteMax: 200,
} as const;

/**
 * Why a balance moved: earned on a delivered order, spent, held for an unpaid
 * online order, given back (the hold was not needed, or the order ended),
 * a refund of a points payment, taken back after a return or cancel, expired,
 * changed by staff, or the reward for an invited friend's delivered order
 * (handoff 222).
 */
export type LoyaltyTransactionKind = "earn" | "redeem" | "hold" | "release" | "refund" | "reverse" | "expire" | "adjust" | "referral";

/** One change of a balance; `points` is signed (−500 for a spend). */
export interface LoyaltyTransaction {
  id: string;
  kind: LoyaltyTransactionKind;
  points: number;
  balanceAfter: number;
  /** The money those points stood for (minor units), when the change was a payment. */
  amount: string | null;
  currency: string | null;
  orderId: string | null;
  /** Staff's reason on `adjust`; the system's own remark otherwise (not for display). */
  note: string | null;
  createdAt: string;
}

export interface LoyaltyAccount {
  balance: number;
  /** What the balance is worth, minor units; null while no point value is set. */
  worth: string | null;
  currency: string;
  /** When the balance expires if nothing is earned or spent; null for never or an empty balance. */
  expiresAt: string | null;
  /** Newest first. */
  history: LoyaltyTransaction[];
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/loyalty`;

export function loyaltyGet(client: ApiClient, workspaceId: string): Promise<LoyaltyOverview> {
  return client.request<LoyaltyOverview>(base(workspaceId));
}

/** Answers only the settings and `active`: keep the counts of the last `loyaltyGet`. */
export function loyaltySave(
  client: ApiClient,
  workspaceId: string,
  body: LoyaltySettingsPayload
): Promise<Pick<LoyaltyOverview, "settings" | "active">> {
  return client.request<Pick<LoyaltyOverview, "settings" | "active">>(base(workspaceId), { method: "PUT", body });
}

export function loyaltyCustomerGet(client: ApiClient, workspaceId: string, customerId: string): Promise<LoyaltyAccount> {
  return client.request<LoyaltyAccount>(`${base(workspaceId)}/customers/${customerId}`);
}

export function loyaltyCustomerAdjust(
  client: ApiClient,
  workspaceId: string,
  customerId: string,
  body: { points: number; note: string }
): Promise<{ balance: number; applied: number }> {
  return client.request<{ balance: number; applied: number }>(`${base(workspaceId)}/customers/${customerId}/adjust`, {
    method: "POST",
    body,
  });
}

// ----------------------------------------------------------- storefront --

/** What a store tells its shoppers about the programme; null when it is off. */
export interface LoyaltyProgram {
  earnPointsPerUnit: number;
  pointValue: number;
  minRedeemPoints: number;
  maxRedeemPercent: number;
  expiryDays: number | null;
  currency: string;
}

export async function storeLoyaltyProgram(client: ApiClient, workspaceRef: string): Promise<LoyaltyProgram | null> {
  const { program } = await client.request<{ program: LoyaltyProgram | null }>(`/store/${workspaceRef}/loyalty`, { auth: false });
  return program;
}

export interface ShopperLoyalty extends LoyaltyAccount {
  program: LoyaltyProgram | null;
}

/** The signed-in shopper's points (last 50 changes). */
export function shopperLoyalty(client: ApiClient, workspaceRef: string, token: string): Promise<ShopperLoyalty> {
  return client.request<ShopperLoyalty>(`/store/${workspaceRef}/account/loyalty`, {
    auth: false,
    headers: { "X-Shopper-Token": token },
  });
}

/**
 * The points one unit of a product earns: price ÷ one currency unit × the earn
 * rate, rounded down (the server works the order's own figure out on delivery).
 */
export function loyaltyPointsFor(priceMinor: number, program: Pick<LoyaltyProgram, "earnPointsPerUnit"> | null | undefined): number {
  if (!program || !(program.earnPointsPerUnit > 0) || !(priceMinor > 0)) return 0;
  return Math.floor((priceMinor / 100) * program.earnPointsPerUnit);
}

/** What the checkout's 201 adds when points came with the order. */
export interface LoyaltyRedemption {
  applied: boolean;
  /** True with an online payment: held until the gateway is paid, given back if it never is. */
  held?: boolean;
  /** Points really used — fewer than asked when the order could not take them all. */
  points?: number;
  /** Their worth, minor units. */
  amount?: string;
  /** Points left. */
  balance?: number;
  currency?: string;
  /** When not applied: "unusable", "nothing_due", "error" or "covers_order_cod_unavailable". */
  reason?: string;
}

/** The checkout body's points field (with the X-Shopper-Token header). */
export interface LoyaltyCheckoutFields {
  loyaltyPoints?: number;
}

/**
 * Why a checkout refused the points, when they were the reason: "signed_out",
 * "off" (the store has no programme now), "too_few" (under the minimum),
 * "not_enough" (more than the balance), "bank_transfer", or null.
 */
export type LoyaltyRefusal = "signed_out" | "off" | "too_few" | "not_enough" | "bank_transfer";

export function loyaltyRefusalOf(err: unknown): LoyaltyRefusal | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === "LOYALTY_OFF") return "off";
  if (err.code === "LOYALTY_TOO_FEW") return "too_few";
  if (err.code === "LOYALTY_NOT_ENOUGH") return "not_enough";
  // The other refusals carry their own code and name the field in `details`.
  const details = apiErrorDetails<unknown>(err);
  const named = Array.isArray(details) && details.some((d) => !!d && (d as { field?: unknown }).field === "loyaltyPoints");
  if (!named) return null;
  if (err.code === "SHOPPER_NOT_SIGNED_IN") return "signed_out";
  return "bank_transfer";
}

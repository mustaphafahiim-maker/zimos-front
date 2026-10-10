/**
 * Customer referral programme, "invite a friend" (backend
 * src/modules/customerReferrals). Not the merchant's own "refer & earn" nor
 * the marketers' referral links.
 *
 * A signed-in shopper gets a code and a link (`/?ref=CODE`). A friend who
 * checks out with `referralCode` gets the friend's offer on their FIRST order
 * in the store; the inviter is rewarded once that order is delivered, and a
 * cancelled or returned order cancels the invite. The merchant sets every number.
 *
 * Dashboard, /workspaces/:ws/customer-referrals (read customers.view, save discounts.manage):
 *   GET  /      → CustomerReferralSettings
 *   PUT  /      CustomerReferralSettings → the same
 *        422 on `friend` when enabled with no percent and no free shipping;
 *        422 on `referrer.type` when the reward is points and the loyalty programme is off.
 *   GET  /list?status=&customerId=&limit=&offset= → { referrals, total }
 *        `customerId` matches the inviter OR the friend.
 *
 * Storefront:
 *   GET /store/:ws/account/referral (X-Shopper-Token; 401 SHOPPER_NOT_SIGNED_IN) → ShopperReferral
 *   GET /store/:ws/referrals/:code → StoreReferralCheck — for the banner of a `?ref=` landing
 *   Checkout: `referralCode`. Refused with 422 on field `referralCode` (referralRefusalOf).
 *   The friend's percent comes off plain lines' prices, free shipping off the order; the order is
 *   tagged `referral`.
 *
 * Money is integer minor units; a reward in points is a whole number of points.
 */
import type { ApiClient } from "../client";
import { shopperTokenHeaders } from "../shopperToken";
import { apiFieldProblems } from "../errors";

export type ReferralRewardType = "store_credit" | "points";

/** What the invited friend gets on a first order. */
export interface ReferralFriendOffer {
  /** 0–50. */
  percentOff: number;
  freeShipping: boolean;
}

/** What the inviter gets once the friend's order is delivered: minor units of store credit, or points. */
export interface ReferralReward {
  type: ReferralRewardType;
  amount: number;
}

export interface CustomerReferralSettings {
  enabled: boolean;
  friend: ReferralFriendOffer;
  referrer: ReferralReward;
  /** The friend's order total that earns the reward (minor units); null for any order. */
  minOrderAmount: number | null;
  /** How many friends one customer is rewarded for, 1–1000; null for no limit. */
  maxRewardsPerReferrer: number | null;
}

/** The API's limits, for the form's own checks. */
export const CUSTOMER_REFERRAL_LIMITS = {
  percentMax: 50,
  rewardMin: 1,
  rewardMax: 1_000_000_000,
  minOrderMax: 1_000_000_000_000,
  maxRewardsMax: 1000,
} as const;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/customer-referrals`;

export function customerReferralsGet(client: ApiClient, workspaceId: string): Promise<CustomerReferralSettings> {
  return client.request<CustomerReferralSettings>(base(workspaceId));
}

export function customerReferralsSave(client: ApiClient, workspaceId: string, body: CustomerReferralSettings): Promise<CustomerReferralSettings> {
  return client.request<CustomerReferralSettings>(base(workspaceId), { method: "PUT", body });
}

/**
 * Why a save was refused, when the settings themselves were the reason: the
 * friend gets nothing ("friend_offer"), or points are the reward while the
 * loyalty programme is off ("loyalty_off").
 */
export type CustomerReferralProblem = "friend_offer" | "loyalty_off";

export function customerReferralProblemOf(err: unknown): CustomerReferralProblem | null {
  for (const problem of apiFieldProblems(err)) {
    if (problem.field === "friend") return "friend_offer";
    if (problem.field === "referrer.type") return "loyalty_off";
  }
  return null;
}

/** Waiting for the friend's order to be delivered, rewarded, or cancelled. */
export type CustomerReferralStatus = "pending" | "rewarded" | "void";

export type CustomerReferralVoidReason = "cancelled" | "returned" | "below_minimum" | "limit_reached" | "program_off";

export interface CustomerReferral {
  id: string;
  status: CustomerReferralStatus;
  voidReason: CustomerReferralVoidReason | null;
  /** What the inviter was given; null until rewarded. */
  reward: ReferralReward | null;
  rewardedAt: string | null;
  createdAt: string;
  /** The friend's order. */
  order: { id: string; orderNumber: string; totalAmount: string; currency: string } | null;
  referrer?: { id: string; name: string | null };
  friend?: { id: string; name: string | null };
}

export interface CustomerReferralListQuery {
  status?: CustomerReferralStatus;
  /** Invites this customer sent, and the one they came in by. */
  customerId?: string;
  /** 1–200, 50 when left out. */
  limit?: number;
  offset?: number;
}

export interface CustomerReferralPage {
  /** Newest first. */
  referrals: CustomerReferral[];
  total: number;
}

export function customerReferralsList(client: ApiClient, workspaceId: string, query: CustomerReferralListQuery = {}): Promise<CustomerReferralPage> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.customerId) params.set("customerId", query.customerId);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));
  const qs = params.toString();
  return client.request<CustomerReferralPage>(`${base(workspaceId)}/list${qs ? `?${qs}` : ""}`);
}

// ----------------------------------------------------------- storefront --

/** The offer as the store tells its shoppers (the minimum as a string of minor units). */
export interface ShopperReferralOffer {
  friend: ReferralFriendOffer;
  referrer: ReferralReward;
  minOrderAmount: string | null;
}

/** One invite as its inviter sees it: the friend is never named. */
export interface ShopperReferralRow {
  id: string;
  status: CustomerReferralStatus;
  reward: ReferralReward | null;
  rewardedAt: string | null;
  createdAt: string;
}

export type ShopperReferral =
  | { enabled: false }
  | {
      enabled: true;
      code: string;
      /** Store-relative: "/?ref=CODE". */
      path: string;
      offer: ShopperReferralOffer;
      stats: { pending: number; rewarded: number };
      /** Newest first, 50 at most. */
      referrals: ShopperReferralRow[];
    };

/** The signed-in shopper's invite: their code, the offer, and how their invites went. */
export function shopperReferral(client: ApiClient, workspaceRef: string, token: string): Promise<ShopperReferral> {
  return client.request<ShopperReferral>(`/store/${workspaceRef}/account/referral`, {
    auth: false,
    headers: shopperTokenHeaders(token),
  });
}

export type StoreReferralCheck = { valid: true; code: string; friend: ReferralFriendOffer } | { valid: false };

/** Invite codes are 6–7 letters and digits; the API takes up to 16 characters. */
export const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9]{4,16}$/;

/** Whether a code is a running invite, and what the friend gets — for the banner of a `?ref=` landing. */
export function storeReferralCheck(client: ApiClient, workspaceRef: string, code: string): Promise<StoreReferralCheck> {
  return client.request<StoreReferralCheck>(`/store/${workspaceRef}/referrals/${encodeURIComponent(code)}`, { auth: false });
}

/** The checkout body's invite field. */
export interface ReferralCheckoutFields {
  referralCode?: string;
}

/**
 * Why a checkout refused the invite, when it was the reason: the code is not
 * one ("invalid"), it is the shopper's own ("own"), the shopper has ordered
 * here before ("not_first"), or the store stopped its programme ("off").
 */
export type ReferralRefusal = "invalid" | "own" | "not_first" | "off";

export function referralRefusalOf(err: unknown): ReferralRefusal | null {
  const problem = apiFieldProblems(err).find((p) => p.field === "referralCode");
  if (!problem) return null;
  // The API words these four in English whatever the page's language (`details` is never translated).
  if (/own invite/i.test(problem.message)) return "own";
  if (/first order/i.test(problem.message)) return "not_first";
  if (/no invite program/i.test(problem.message)) return "off";
  return "invalid";
}

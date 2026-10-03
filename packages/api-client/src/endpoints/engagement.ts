/**
 * Social proof, the newsletter sign-up and referral link results (backend:
 * src/modules/offers/engagement.js; lane 3).
 *
 * Staff: GET/PUT /workspaces/:id/offers/social-proof and /offers/newsletter,
 * GET /offers/referrals (products.view / products.manage; a PUT takes the
 * whole setting). Shopper: under /store/:id. All exported names here start
 * with `engagement` / `Engagement`, or `storefront`.
 *
 * Social proof is built only from real, confirmed orders of the last seven
 * days; with fewer than `minimumOrders` of them the store shows nothing.
 *
 * Notable codes: NEWSLETTER_OFF (404), VALIDATION_ERROR (422 — a bad phone, a
 * discount without a code).
 */
import type { ApiClient } from "../client";

export interface EngagementSocialProof {
  enabled: boolean;
  position: "bottom_start" | "bottom_end";
  /** Before the first notification. */
  delaySeconds: number;
  /** Between notifications. */
  intervalSeconds: number;
  maxPerSession: number;
  pages: "all" | "product";
  showName: boolean;
  showCity: boolean;
}

export interface EngagementSocialProofState {
  socialProof: EngagementSocialProof;
  /** Confirmed orders of the last seven days that can be shown right now. */
  realOrders: number;
  minimumOrders: number;
}

export interface EngagementNewsletter {
  enabled: boolean;
  placement: "footer" | "popup";
  /** For the popup. */
  delaySeconds: number;
  title: string | null;
  text: string | null;
  askName: boolean;
  askEmail: boolean;
  /** A discount with a code, handed to whoever subscribes; null for none. */
  discountId: string | null;
}

export interface EngagementReferralRow {
  /** The code in ?ref=, lower-cased. */
  ref: string;
  orders: number;
  confirmedOrders: number;
  /** Minor units. */
  revenue: number;
  lastOrderAt: string;
}

export interface StorefrontSocialProofItem {
  firstName: string | null;
  city: string | null;
  productName: string;
  productSlug: string;
  imageUrl: string | null;
  at: string;
}

export interface StorefrontSocialProof {
  position: "bottom_start" | "bottom_end";
  delaySeconds: number;
  intervalSeconds: number;
  maxPerSession: number;
  pages: "all" | "product";
  items: StorefrontSocialProofItem[];
}

export interface StorefrontNewsletter {
  placement: "footer" | "popup";
  delaySeconds: number;
  title: string | null;
  text: string | null;
  askName: boolean;
  askEmail: boolean;
  hasCoupon: boolean;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/offers`;

export async function engagementGetSocialProof(client: ApiClient, workspaceId: string): Promise<EngagementSocialProofState> {
  return client.request<EngagementSocialProofState>(`${base(workspaceId)}/social-proof`);
}

export async function engagementSaveSocialProof(
  client: ApiClient,
  workspaceId: string,
  settings: EngagementSocialProof
): Promise<EngagementSocialProof> {
  return (await client.request<{ socialProof: EngagementSocialProof }>(`${base(workspaceId)}/social-proof`, { method: "PUT", body: settings }))
    .socialProof;
}

export async function engagementGetNewsletter(client: ApiClient, workspaceId: string): Promise<EngagementNewsletter> {
  return (await client.request<{ newsletter: EngagementNewsletter }>(`${base(workspaceId)}/newsletter`)).newsletter;
}

export async function engagementSaveNewsletter(
  client: ApiClient,
  workspaceId: string,
  settings: EngagementNewsletter
): Promise<EngagementNewsletter> {
  return (await client.request<{ newsletter: EngagementNewsletter }>(`${base(workspaceId)}/newsletter`, { method: "PUT", body: settings }))
    .newsletter;
}

/** Orders and revenue per ?ref= code over the last `days` (default 30). */
export async function engagementReferrals(client: ApiClient, workspaceId: string, days = 30): Promise<EngagementReferralRow[]> {
  return (await client.request<{ referrals: EngagementReferralRow[] }>(`${base(workspaceId)}/referrals?days=${days}`)).referrals;
}

/** Null when social proof is off or there are too few real orders. */
export async function storefrontSocialProof(client: ApiClient, workspaceId: string): Promise<StorefrontSocialProof | null> {
  return (await client.request<{ socialProof: StorefrontSocialProof | null }>(`/store/${workspaceId}/social-proof`, { auth: false })).socialProof;
}

export async function storefrontNewsletter(client: ApiClient, workspaceId: string): Promise<StorefrontNewsletter | null> {
  return (await client.request<{ newsletter: StorefrontNewsletter | null }>(`/store/${workspaceId}/newsletter`, { auth: false })).newsletter;
}

/** Subscribes the shopper; the answer carries the coupon when the form promises one. `website` is the honeypot. */
export async function storefrontSubscribe(
  client: ApiClient,
  workspaceId: string,
  payload: { fullName?: string; phone: string; email?: string; website?: string }
): Promise<{ subscribed: boolean; couponCode: string | null }> {
  return client.request<{ subscribed: boolean; couponCode: string | null }>(`/store/${workspaceId}/newsletter/subscribe`, {
    method: "POST",
    body: payload,
    auth: false,
  });
}

/**
 * Affiliates (backend: src/modules/affiliates).
 *
 * Staff routes: /workspaces/:workspaceId/affiliates, permission
 * affiliates.manage. The marketer's portal is public at
 * /store/:workspaceId/affiliate: a code by SMS, then a portal token sent as
 * the `X-Affiliate-Token` header.
 *
 * Notable codes: AFFILIATE_CODE_TAKEN, AFFILIATE_PHONE_TAKEN (409),
 * AFFILIATE_HAS_COMMISSIONS (409), NOTHING_TO_PAY (409), INVALID_PHONE (422),
 * INVALID_CODE / EXPIRED (422), TOO_MANY_ATTEMPTS / OTP_RATE_LIMITED (429),
 * AFFILIATE_SESSION_EXPIRED (401).
 */
import type { ApiClient } from "../client";

export type AffiliateCommissionType = "percent" | "fixed";
export type AffiliateStatus = "active" | "paused";
export type CommissionStatus = "pending" | "approved" | "paid" | "void";

/** Money by commission status (minor units) and the referred orders that still count. */
export interface AffiliateTotals {
  orders: number;
  pending: string;
  approved: string;
  paid: string;
  void: string;
}

export interface Affiliate {
  id: string;
  name: string;
  phone: string;
  /** The `?ref=` value of their links. */
  code: string;
  commissionType: AffiliateCommissionType;
  /** percent: basis points (1000 = 10%). fixed: minor units per order. */
  commissionValue: number;
  /** Empty = every product earns. */
  productIds: string[];
  status: AffiliateStatus;
  notes: string | null;
  createdAt: string;
  totals?: AffiliateTotals;
}

export interface AffiliatePayload {
  name: string;
  phone: string;
  code: string;
  commissionType: AffiliateCommissionType;
  commissionValue: number;
  productIds?: string[];
  status?: AffiliateStatus;
  notes?: string | null;
}

export interface AffiliateCommission {
  id: string;
  affiliateId: string;
  affiliateName: string;
  orderNumber: string;
  orderId: string;
  orderTotal: string;
  /** The products' value the commission was worked out on. */
  baseAmount: string;
  amount: string;
  currency: string;
  status: CommissionStatus;
  orderedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface AffiliatePayout {
  id: string;
  affiliateId?: string;
  amount: string;
  currency: string;
  method: string | null;
  note: string | null;
  paidAt: string;
}

/** What the marketer sees in the portal. Orders carry no customer data. */
export interface AffiliatePortal {
  affiliate: { name: string; code: string; commissionType: AffiliateCommissionType; commissionValue: number };
  storeName: string;
  currency: string;
  totals: AffiliateTotals;
  products: { id: string; name: string; slug: string }[];
  orders: { orderNumber: string; orderedAt: string; amount: string; currency: string; status: CommissionStatus }[];
  payouts: AffiliatePayout[];
}

const affiliatesBase = (workspaceId: string) => `/workspaces/${workspaceId}/affiliates`;

export async function affiliatesList(client: ApiClient, workspaceId: string): Promise<{ affiliates: Affiliate[]; currency: string }> {
  return client.request(affiliatesBase(workspaceId));
}

export async function affiliatesCreate(client: ApiClient, workspaceId: string, payload: AffiliatePayload): Promise<Affiliate> {
  const { affiliate } = await client.request<{ affiliate: Affiliate }>(affiliatesBase(workspaceId), { method: "POST", body: payload });
  return affiliate;
}

export async function affiliatesUpdate(client: ApiClient, workspaceId: string, affiliateId: string, payload: Partial<AffiliatePayload>): Promise<Affiliate> {
  const { affiliate } = await client.request<{ affiliate: Affiliate }>(`${affiliatesBase(workspaceId)}/${affiliateId}`, { method: "PATCH", body: payload });
  return affiliate;
}

/** Only an affiliate with no commissions; otherwise pause them. */
export async function affiliatesDelete(client: ApiClient, workspaceId: string, affiliateId: string): Promise<void> {
  await client.request<unknown>(`${affiliatesBase(workspaceId)}/${affiliateId}`, { method: "DELETE" });
}

export async function affiliatesCommissions(
  client: ApiClient,
  workspaceId: string,
  params: { affiliateId?: string; status?: CommissionStatus; limit?: number } = {}
): Promise<AffiliateCommission[]> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") search.set(key, String(value));
  const query = search.toString();
  const { commissions } = await client.request<{ commissions: AffiliateCommission[] }>(`${affiliatesBase(workspaceId)}/commissions${query ? `?${query}` : ""}`);
  return commissions;
}

/** The payments recorded for one affiliate, newest first. */
export async function affiliatesPayouts(client: ApiClient, workspaceId: string, affiliateId: string): Promise<AffiliatePayout[]> {
  const { payouts } = await client.request<{ payouts: AffiliatePayout[] }>(`${affiliatesBase(workspaceId)}/${affiliateId}/payouts`);
  return payouts;
}

/** Marks every approved commission of the affiliate as paid, under one payout. */
export async function affiliatesRecordPayout(
  client: ApiClient,
  workspaceId: string,
  affiliateId: string,
  payload: { method?: string; note?: string } = {}
): Promise<{ id: string; amount: string; currency: string; commissions: number; paidAt: string }> {
  const { payout } = await client.request<{ payout: { id: string; amount: string; currency: string; commissions: number; paidAt: string } }>(
    `${affiliatesBase(workspaceId)}/${affiliateId}/payouts`,
    { method: "POST", body: payload }
  );
  return payout;
}

// ------------------------------------------------------------------ portal --

/** Always answers `sent` — it does not reveal whether the phone is an affiliate. */
export async function affiliatePortalRequestCode(client: ApiClient, workspaceRef: string, phone: string): Promise<void> {
  await client.request<unknown>(`/store/${workspaceRef}/affiliate/request-code`, { method: "POST", body: { phone }, auth: false });
}

export async function affiliatePortalVerify(client: ApiClient, workspaceRef: string, phone: string, code: string): Promise<{ token: string; expiresInSeconds: number }> {
  return client.request(`/store/${workspaceRef}/affiliate/verify`, { method: "POST", body: { phone, code }, auth: false });
}

export async function affiliatePortalOverview(client: ApiClient, workspaceRef: string, token: string): Promise<AffiliatePortal> {
  return client.request<AffiliatePortal>(`/store/${workspaceRef}/affiliate/me`, { auth: false, headers: { "X-Affiliate-Token": token } });
}

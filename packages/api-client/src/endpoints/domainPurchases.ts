/**
 * Buy a domain in the dashboard (handoff item 176; backend domains/purchases.js,
 * contract in domains/registrar/README.md): search a name, buy it, and the
 * store is connected to it with its DNS set by the platform; it renews itself
 * unless auto-renew is switched off. All under /workspaces/:workspaceId/domains,
 * permission domain.manage.
 *
 *   GET   /search?q=my store                 → { query, results: [{ domain, available, price, renewalPrice }] }
 *   POST  /purchases                         → 201 { purchase }   (live store; the plan's domain limit applies)
 *   GET   /purchases                         → { purchases }
 *   PATCH /purchases/:purchaseId             { autoRenew } → { purchase }
 *   POST  /purchases/:purchaseId/renew       { years: 1-10 } → { purchase }
 *
 * Prices are the registrar's, in minor units, and may be null (the registrar
 * gave none). They are shown as sent, never computed here. A purchase sends
 * back the price the merchant was shown (`acceptPrice`, null when none was
 * shown); a different quote stops it.
 *
 * Codes: VALIDATION_ERROR (422, a query without letters/digits), DOMAIN_PRICE_CHANGED
 * (409, details.price = the new quote), DOMAIN_UNAVAILABLE (409), DOMAIN_PURCHASE_FAILED
 * (502, nothing was charged), DOMAIN_NOT_ACTIVE (409 on renew), PLAN_LIMIT_REACHED
 * (402, details.limit "domains"), SUBSCRIPTION_REQUIRED (draft store), and the
 * codes of connecting a domain (STORE_NOT_SET_UP, DOMAIN_TAKEN).
 */
import type { ApiClient } from "../client";

/** An amount in the currency's minor units, as the registrar quoted it. */
export interface DomainPrice {
  amount: number;
  currency: string;
}

export interface DomainSearchResult {
  domain: string;
  available: boolean;
  /** First-year price; null when the registrar gave none ("price on request"). */
  price: DomainPrice | null;
  renewalPrice: DomainPrice | null;
}

export interface DomainSearchResponse {
  query: string;
  results: DomainSearchResult[];
}

export type DomainPurchaseStatus = "pending" | "active" | "failed" | "expired";

export interface DomainPurchase {
  id: string;
  hostname: string;
  status: DomainPurchaseStatus;
  /** The registrar adapter that handled it ("sandbox" until a real one is configured). */
  registrar: string;
  years: number;
  price: DomainPrice | null;
  autoRenew: boolean;
  expiresAt: string | null;
  lastRenewedAt?: string | null;
  lastError: string | null;
  /** The store domain it was connected as. */
  domainId: string | null;
  createdAt?: string;
}

export interface DomainPurchaseInput {
  domain: string;
  years: number;
  autoRenew: boolean;
  /** The price the merchant was shown and confirmed; null when none was shown. */
  acceptPrice: DomainPrice | null;
}

/** `details` of a 409 DOMAIN_PRICE_CHANGED: the registrar's new quote. */
export interface DomainPriceChangedDetails {
  price: DomainPrice | null;
}

const base = (workspaceId: string) => "/workspaces/" + workspaceId + "/domains";

export function domainSearch(client: ApiClient, workspaceId: string, q: string): Promise<DomainSearchResponse> {
  return client.request<DomainSearchResponse>(base(workspaceId) + "/search?q=" + encodeURIComponent(q));
}

export async function domainPurchasesList(client: ApiClient, workspaceId: string): Promise<DomainPurchase[]> {
  const { purchases } = await client.request<{ purchases: DomainPurchase[] }>(base(workspaceId) + "/purchases");
  return purchases ?? [];
}

export async function domainPurchaseCreate(
  client: ApiClient,
  workspaceId: string,
  input: DomainPurchaseInput
): Promise<DomainPurchase> {
  const { purchase } = await client.request<{ purchase: DomainPurchase }>(base(workspaceId) + "/purchases", {
    method: "POST",
    body: input,
  });
  return purchase;
}

export async function domainPurchaseSetAutoRenew(
  client: ApiClient,
  workspaceId: string,
  purchaseId: string,
  autoRenew: boolean
): Promise<DomainPurchase> {
  const { purchase } = await client.request<{ purchase: DomainPurchase }>(base(workspaceId) + "/purchases/" + purchaseId, {
    method: "PATCH",
    body: { autoRenew },
  });
  return purchase;
}

export async function domainPurchaseRenew(
  client: ApiClient,
  workspaceId: string,
  purchaseId: string,
  years: number
): Promise<DomainPurchase> {
  const { purchase } = await client.request<{ purchase: DomainPurchase }>(
    base(workspaceId) + "/purchases/" + purchaseId + "/renew",
    { method: "POST", body: { years } }
  );
  return purchase;
}

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
 *   GET   /purchases/:purchaseId/renew-quote?years=1-10 → { hostname, years, price, expiresAt }
 *   POST  /purchases/:purchaseId/renew       { years: 1-10, acceptPrice? } → { purchase }
 *
 * Prices are the registrar's, in minor units, and may be null (the registrar
 * gave none). They are shown as sent, never computed here. A purchase — and a
 * renewal since the frontend request of 2026-10-06 — sends back the price the
 * merchant was shown (`acceptPrice`, null when none was shown); a different
 * quote stops it.
 *
 * Order of checks (frontend request 2026-10-06): everything that could stop
 * the store from using the domain (STORE_NOT_SET_UP: no website yet; the
 * www/root on another store; plan limit; price) is checked before the
 * registrar registers anything. A failure after registering answers 502
 * DOMAIN_CONNECT_FAILED: the domain WAS bought, support finishes connecting
 * it, and the purchase is listed `failed` with its `lastError`.
 *
 * Codes: VALIDATION_ERROR (422, a query without letters/digits), DOMAIN_PRICE_CHANGED
 * (409, details.price = the new quote), DOMAIN_UNAVAILABLE (409), STORE_NOT_SET_UP (409),
 * DOMAIN_PURCHASE_FAILED (502, nothing was charged), DOMAIN_CONNECT_FAILED (502, bought
 * but not connected yet), DOMAIN_NOT_ACTIVE (409 on renew and its quote), PLAN_LIMIT_REACHED
 * (402, details.limit "domains"), SUBSCRIPTION_REQUIRED (draft store), DOMAIN_TAKEN.
 */
import type { ApiClient } from "../client";
import type { StoreDomain, StoreDomainCounterpart } from "./storeDesign";

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
  /** Set once the registrar registered it — also on a `failed` purchase that was bought but not connected. */
  expiresAt: string | null;
  lastRenewedAt?: string | null;
  /** The server's own (English) words about the last failure, for support; screens show their own wording. */
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

/** What renewing a bought domain for `years` costs now, as the registrar quotes it. */
export interface DomainRenewQuote {
  hostname: string;
  years: number;
  /** For the whole length; null when the registrar gave none ("price on request"). */
  price: DomainPrice | null;
  /** The expiry date after renewing. */
  expiresAt: string;
}

/**
 * A domain's www / root counterpart as the overview sends it since the
 * frontend request of 2026-10-06: `dnsManaged` when we created its record
 * ourselves (a root domain bought here), so the merchant has none to add.
 */
export type StoreDomainCounterpartWithDns = StoreDomainCounterpart & { dnsManaged?: boolean };

/** Whether the platform created the counterpart's (www / root) record itself. Absent (older server) means no. */
export function domainCounterpartDnsManaged(domain: StoreDomain): boolean {
  return (domain.counterpart as StoreDomainCounterpartWithDns | null | undefined)?.dnsManaged === true;
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

/** The price of renewing for `years` (1–10) and the new expiry; 409 DOMAIN_NOT_ACTIVE unless active or expired. */
export function domainPurchaseRenewQuote(
  client: ApiClient,
  workspaceId: string,
  purchaseId: string,
  years: number
): Promise<DomainRenewQuote> {
  return client.request<DomainRenewQuote>(
    base(workspaceId) + "/purchases/" + purchaseId + "/renew-quote?years=" + encodeURIComponent(String(years))
  );
}

/**
 * Renews now. `acceptPrice` is the quote the merchant confirmed (null when it
 * had no price); another current price stops it with 409 DOMAIN_PRICE_CHANGED.
 * Left out, the server renews without comparing (the behaviour before quotes).
 */
export async function domainPurchaseRenew(
  client: ApiClient,
  workspaceId: string,
  purchaseId: string,
  years: number,
  acceptPrice?: DomainPrice | null
): Promise<DomainPurchase> {
  const { purchase } = await client.request<{ purchase: DomainPurchase }>(
    base(workspaceId) + "/purchases/" + purchaseId + "/renew",
    { method: "POST", body: acceptPrice === undefined ? { years } : { years, acceptPrice } }
  );
  return purchase;
}

/**
 * Custom domains, the later additions (backend src/modules/domains):
 *
 * - 341 (domainRules.js, domainsGate.js): the deployment rules the overview
 *   reports, the certificate's `moved` state and its detail, a suspended
 *   domain, and the closed section (every path answers 404 ROUTE_NOT_FOUND
 *   when CUSTOM_DOMAINS_ENABLED is set to anything but "true").
 * - 325 / 326 (purchases.js): the selling price, the domain owner's details.
 * - 385 (purchaseDns.js): a bought domain's own DNS records and its transfer
 *   code (store owner only).
 *
 * All under /workspaces/:workspaceId/domains, permission domain.manage. The
 * base types stay in storeDesign.ts / domainPurchases.ts; the new fields are
 * read through the helpers below. Every export is prefixed `domain` / `Domain`.
 */
import type { ApiClient } from "../client";
import { isApiErrorCode } from "../errors";
import type { StoreDomain, StoreDomainsOverview } from "./storeDesign";
import type { DomainPrice, DomainPurchase } from "./domainPurchases";

const base = (workspaceId: string) => "/workspaces/" + workspaceId + "/domains";

// ------------------------------------------------------------------ 341 ----

/** `none` | `pending` | `issued` | `failed` | `moved` (issued, but the domain no longer points at the store). */
export type DomainCertificateState = "none" | "pending" | "issued" | "failed" | "moved";

export type DomainSuspendedReason = "store_suspended" | "plan";

/** What the overview adds to each domain since item 341. Absent on an older server. */
export interface DomainStateExtras {
  /** The provider's reason as a sentence, shown as it is; or null. */
  sslDetail: string | null;
  suspended: boolean;
  suspendedReason: DomainSuspendedReason | null;
  /** After this time an unverified domain can no longer be verified, and is removed; null = it waits for ever. */
  verifyBy: string | null;
}

export function domainStateExtras(domain: StoreDomain): DomainStateExtras {
  const d = domain as StoreDomain & Partial<DomainStateExtras>;
  return {
    sslDetail: d.sslDetail ?? null,
    suspended: d.suspended === true,
    suspendedReason: d.suspendedReason ?? null,
    verifyBy: d.verifyBy ?? null,
  };
}

/** The server's deployment rules, as the overview reports them. */
export interface DomainDeploymentRules {
  /** No root domains and no buying: only www.example.com / shop.example.com. */
  subdomainsOnly: boolean;
  /** The most domains one store may hold (verified or not); null = only the plan's limit. */
  maxPerStore: number | null;
  /** Days an unverified domain waits before it is removed; null = for ever. */
  pendingTtlDays: number | null;
}

export function domainDeploymentRules(overview: StoreDomainsOverview | null | undefined): DomainDeploymentRules {
  const o = (overview ?? {}) as Partial<DomainDeploymentRules>;
  return {
    subdomainsOnly: o.subdomainsOnly === true,
    maxPerStore: typeof o.maxPerStore === "number" ? o.maxPerStore : null,
    pendingTtlDays: typeof o.pendingTtlDays === "number" ? o.pendingTtlDays : null,
  };
}

/** The whole section is closed on this server: a domains path answered like a path that does not exist. */
export function isDomainsSectionClosed(err: unknown): boolean {
  return isApiErrorCode(err, "ROUTE_NOT_FOUND");
}

/** `details` of a 400 APEX_NOT_SUPPORTED: the subdomain to connect instead. */
export interface DomainApexNotSupportedDetails {
  suggestion?: string;
}

// ------------------------------------------------------------------ 326 ----

/** The domain owner's (registrant's) details, as the registrar needs them. */
export interface DomainOwnerContact {
  fullName: string;
  organization?: string | null;
  email: string;
  /** 1–3 digits, without the +. */
  phoneCountryCode: string;
  /** 4–14 digits: the national number without its leading 0. */
  phone: string;
  address1: string;
  address2?: string | null;
  city: string;
  /** The governorate. */
  state: string;
  postalCode: string;
  /** ISO-2. */
  country: string;
}

export interface DomainRegistrant {
  /** False in the sandbox: the form can be skipped there. */
  required: boolean;
  /** The details saved by an earlier purchase, or null. */
  contact: DomainOwnerContact | null;
}

export function domainRegistrantGet(client: ApiClient, workspaceId: string): Promise<DomainRegistrant> {
  return client.request<DomainRegistrant>(base(workspaceId) + "/registrant");
}

/**
 * Buys a domain, with the owner's details when given (left out, the saved
 * ones are used; 422 DOMAIN_CONTACT_REQUIRED when the registrar needs them and
 * none is saved). Same answer and codes as `domainPurchaseCreate`, plus 502
 * REGISTRAR_REFUSED / REGISTRAR_UNAVAILABLE and 503 DOMAIN_PRICE_UNAVAILABLE.
 */
export async function domainPurchaseCreateWithOwner(
  client: ApiClient,
  workspaceId: string,
  input: { domain: string; years: number; autoRenew: boolean; acceptPrice: DomainPrice | null; contact?: DomainOwnerContact | null }
): Promise<DomainPurchase> {
  const { contact, ...rest } = input;
  const { purchase } = await client.request<{ purchase: DomainPurchase }>(base(workspaceId) + "/purchases", {
    method: "POST",
    body: contact ? { ...rest, contact } : rest,
  });
  return purchase;
}

// ------------------------------------------------------------------ 385 ----

/** What a bought domain's row adds since item 385. */
export interface DomainPurchaseManage {
  /** When the owner took the transfer code; null otherwise. */
  transferUnlockedAt: string | null;
  /** Its registrar lets the DNS records be edited here. */
  dnsRecords: boolean;
  /** Its registrar hands out the transfer code. */
  transferCode: boolean;
}

export function domainPurchaseManage(purchase: DomainPurchase): DomainPurchaseManage {
  const p = purchase as DomainPurchase & { transferUnlockedAt?: string | null; manage?: { dnsRecords?: boolean; transferCode?: boolean } };
  return {
    transferUnlockedAt: p.transferUnlockedAt ?? null,
    dnsRecords: p.manage?.dnsRecords === true,
    transferCode: p.manage?.transferCode === true,
  };
}

export type DomainDnsRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT";

export interface DomainDnsRecord {
  /** One of the editable types, or another one the zone holds (`editable: false`). */
  type: string;
  /** The full name: ahmedstore.com, www.ahmedstore.com. */
  name: string;
  /** "@" for the domain itself, or the label: www, mail, _zimos-verify. */
  host: string;
  value: string;
  /** MX only. */
  priority?: number | null;
  ttl: number;
  /** The store's own record: never sent back, never editable. */
  locked: boolean;
  /** routing | redirect | verification (locked); email_* (written for the store's sending domain); or null. */
  purpose: string | null;
  /** Locked rows: false = not in the zone yet, written on the next save. */
  present?: boolean;
  /** Unlocked rows: false = a type that can't be edited here. */
  editable?: boolean;
}

export interface DomainDnsRecords {
  hostname: string;
  registrar: string;
  records: DomainDnsRecord[];
  limits: { maxRecords: number; types: string[] };
}

/** One of the merchant's records as the PUT takes it. `priority` only for MX; `ttl` 60–86400, default 300. */
export interface DomainDnsRecordInput {
  type: string;
  /** "@", a label like "mail", or the full name. */
  name: string;
  value: string;
  priority?: number;
  ttl?: number;
}

const dnsPath = (workspaceId: string, purchaseId: string) => base(workspaceId) + "/purchases/" + purchaseId + "/dns-records";

export function domainDnsRecordsGet(client: ApiClient, workspaceId: string, purchaseId: string): Promise<DomainDnsRecords> {
  return client.request<DomainDnsRecords>(dnsPath(workspaceId, purchaseId));
}

/**
 * Replaces all of the merchant's records (every unlocked row; never the locked
 * ones). 422 VALIDATION_ERROR with `records[i].field` problems; 409
 * DNS_RECORDS_UNSUPPORTED / DOMAIN_REGISTRAR_CHANGED / DOMAIN_NOT_ACTIVE; 501
 * DOMAIN_DNS_UNSUPPORTED; 502 REGISTRAR_REFUSED / REGISTRAR_UNAVAILABLE.
 */
export function domainDnsRecordsReplace(
  client: ApiClient,
  workspaceId: string,
  purchaseId: string,
  records: DomainDnsRecordInput[]
): Promise<DomainDnsRecords> {
  return client.request<DomainDnsRecords>(dnsPath(workspaceId, purchaseId), { method: "PUT", body: { records } });
}

export interface DomainTransferCode {
  hostname: string;
  /** Shown once: it is not stored anywhere. */
  authCode: string;
  unlocked: boolean;
  autoRenew: boolean;
  /** The server's own (English) note. */
  note: string;
  purchase: DomainPurchase;
}

/**
 * Unlocks the domain and asks its registrar for the transfer code. Store owner
 * only (403 NOT_STORE_OWNER), with their password (422 on `password`), 5 tries
 * an hour (429), 501 DOMAIN_TRANSFER_UNSUPPORTED where the registrar has none.
 */
export function domainTransferCode(client: ApiClient, workspaceId: string, purchaseId: string, password: string): Promise<DomainTransferCode> {
  return client.request<DomainTransferCode>(base(workspaceId) + "/purchases/" + purchaseId + "/transfer-code", {
    method: "POST",
    body: { password },
  });
}

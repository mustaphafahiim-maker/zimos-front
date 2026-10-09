/**
 * Customer privacy requests: a copy of my data, delete my account (backend: frontend-handoff
 * item 235, src/modules/privacyRequests).
 *
 * Storefront, /store/:ws/account/privacy (X-Shopper-Token; 401 SHOPPER_NOT_SIGNED_IN):
 *   GET  /export              → the shopper's data as JSON (CustomerDataExport)
 *   POST /erase { reason? }   → 201 { request } pending — 200 with the same request when asked again
 *   GET  /                    → { requests: ShopperPrivacyRequest[] }
 *
 * Dashboard, /workspaces/:ws/privacy-requests (read customers.view, act customers.manage):
 *   GET  /?status=&kind=                 → { requests, pending }
 *   POST /:requestId/complete { force?, note? } → { request } — erases the customer.
 *        409 CUSTOMER_HAS_OPEN_ORDERS while an order is still on its way (send `force` to erase
 *        anyway); 409 REQUEST_NOT_PENDING.
 *   POST /:requestId/decline { note }    → { request } — the note is required
 *   GET  /customers/:customerId/export   (customers.manage) → CustomerDataExport
 *   POST /customers/:customerId/erase { force?, note? } → { erased: true } — logged as a completed request
 *
 * Erase can't be undone: the customer becomes "Deleted customer" with no phone, email, company,
 * tax ID or addresses; their orders keep amounts, lines and country/governorate/city but lose
 * name, phone, email and street; saved cards, sign-in codes and wishlist are deleted; review
 * author names are hidden; the shopper is signed out.
 */
import type { ApiClient } from "../client";

export type PrivacyRequestKind = "export" | "erase";
export type PrivacyRequestStatus = "pending" | "completed" | "declined";

export interface PrivacyRequest {
  id: string;
  customerId: string | null;
  kind: PrivacyRequestKind;
  status: PrivacyRequestStatus;
  /** "Mona A. · …2311": enough to recognise the request after the erase. */
  requesterLabel: string | null;
  /** What the shopper wrote. */
  reason: string | null;
  /** The store's note. */
  decisionNote: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface PrivacyRequestList {
  /** Newest first, at most 200. */
  requests: PrivacyRequest[];
  /** Requests waiting for a decision, whatever the filter. */
  pending: number;
}

/** Longest reason or note the API takes. */
export const PRIVACY_NOTE_MAX = 500;

/** The customer's name once erased, as the API writes it. */
export const ERASED_CUSTOMER_NAME = "Deleted customer";

/**
 * A copy of everything the store holds about one customer: `{ exportedAt, profile, addresses,
 * savedAddresses, orders, loyalty, storeCredit, wishlist }`. Saved as a file, never rendered.
 */
export type CustomerDataExport = { exportedAt: string } & Record<string, unknown>;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/privacy-requests`;

export function privacyRequestsList(
  client: ApiClient,
  workspaceId: string,
  query: { status?: PrivacyRequestStatus; kind?: PrivacyRequestKind } = {}
): Promise<PrivacyRequestList> {
  const qs = new URLSearchParams();
  if (query.status) qs.set("status", query.status);
  if (query.kind) qs.set("kind", query.kind);
  const s = qs.toString();
  return client.request<PrivacyRequestList>(`${base(workspaceId)}${s ? `?${s}` : ""}`);
}

/** Erases the customer behind a pending erase request. */
export async function privacyRequestComplete(
  client: ApiClient,
  workspaceId: string,
  requestId: string,
  body: { force?: boolean; note?: string | null } = {}
): Promise<PrivacyRequest> {
  const { request } = await client.request<{ request: PrivacyRequest }>(`${base(workspaceId)}/${requestId}/complete`, {
    method: "POST",
    body,
  });
  return request;
}

export async function privacyRequestDecline(client: ApiClient, workspaceId: string, requestId: string, note: string): Promise<PrivacyRequest> {
  const { request } = await client.request<{ request: PrivacyRequest }>(`${base(workspaceId)}/${requestId}/decline`, {
    method: "POST",
    body: { note },
  });
  return request;
}

export function privacyCustomerExport(client: ApiClient, workspaceId: string, customerId: string): Promise<CustomerDataExport> {
  return client.request<CustomerDataExport>(`${base(workspaceId)}/customers/${customerId}/export`);
}

/** Erases a customer now (asked by phone, for example). */
export function privacyCustomerErase(
  client: ApiClient,
  workspaceId: string,
  customerId: string,
  body: { force?: boolean; note?: string | null } = {}
): Promise<{ erased: true }> {
  return client.request<{ erased: true }>(`${base(workspaceId)}/customers/${customerId}/erase`, { method: "POST", body });
}

// ----------------------------------------------------------- storefront --

/** A request as its shopper sees it. */
export interface ShopperPrivacyRequest {
  id: string;
  kind: PrivacyRequestKind;
  status: PrivacyRequestStatus;
  /** The store's note. */
  decisionNote: string | null;
  createdAt: string;
  completedAt: string | null;
}

const shopperBase = (workspaceRef: string) => `/store/${workspaceRef}/account/privacy`;
const shopper = (token: string) => ({ auth: false, headers: { "X-Shopper-Token": token } });

/** The signed-in shopper's requests, newest first (the last 20). */
export async function shopperPrivacyRequests(client: ApiClient, workspaceRef: string, token: string): Promise<ShopperPrivacyRequest[]> {
  const { requests } = await client.request<{ requests: ShopperPrivacyRequest[] }>(shopperBase(workspaceRef), shopper(token));
  return requests;
}

/** The shopper's own data. Each call is logged by the store as a completed export request. */
export function shopperPrivacyExport(client: ApiClient, workspaceRef: string, token: string): Promise<CustomerDataExport> {
  return client.request<CustomerDataExport>(`${shopperBase(workspaceRef)}/export`, shopper(token));
}

/** Asks the store to erase the account. Answers the request already waiting when there is one. */
export async function shopperPrivacyErase(client: ApiClient, workspaceRef: string, token: string, reason?: string): Promise<ShopperPrivacyRequest> {
  const { request } = await client.request<{ request: ShopperPrivacyRequest }>(`${shopperBase(workspaceRef)}/erase`, {
    ...shopper(token),
    method: "POST",
    body: reason && reason.trim() ? { reason: reason.trim() } : {},
  });
  return request;
}

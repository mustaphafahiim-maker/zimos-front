/**
 * Business customers (backend: frontend-handoff item 228, src/modules/businessCustomers).
 *
 * A customer who buys as a company: a company name and a tax ID, and a tax
 * exemption only the store grants (with a note, e.g. the certificate seen).
 *
 * Dashboard, /workspaces/:ws/customers/:customerId/business:
 *   GET  (customers.view)   → CustomerBusiness
 *   PUT  (customers.manage) any of { companyName ≤ 200, taxId ≤ 40, taxExempt, taxExemptNote ≤ 300 }
 *        (an empty string clears a text) → CustomerBusiness
 *
 * Storefront, /store/:ws/account/business (X-Shopper-Token; 401 SHOPPER_NOT_SIGNED_IN):
 *   GET → ShopperBusiness
 *   PUT { companyName?, taxId? } → ShopperBusiness. Changing the tax ID of an exempt
 *       customer turns the exemption off until the store checks it again.
 *
 * The exemption applies to an order the customer places signed in (checkout with
 * X-Shopper-Token, under their own phone) or one the team enters for them; a guest
 * checkout with the same phone is taxed. Exempt means no tax is added: a price that
 * already includes tax is not lowered. The order keeps `company`, `taxId` and
 * `taxExempt: true` in its contact snapshot, and the invoice prints them.
 */
import type { ApiClient } from "../client";

export interface CustomerBusiness {
  companyName: string | null;
  taxId: string | null;
  taxExempt: boolean;
  /** The team's note on the exemption (what was checked). Never shown to the shopper. */
  taxExemptNote: string | null;
}

/** The longest texts the API takes. */
export const BUSINESS_LIMITS = { companyName: 200, taxId: 40, taxExemptNote: 300 } as const;

/** What the PUT takes: only the keys sent change; "" clears a text. */
export interface CustomerBusinessInput {
  companyName?: string;
  taxId?: string;
  taxExempt?: boolean;
  taxExemptNote?: string;
}

const staffPath = (workspaceId: string, customerId: string) => `/workspaces/${workspaceId}/customers/${customerId}/business`;

export function customerBusinessGet(client: ApiClient, workspaceId: string, customerId: string): Promise<CustomerBusiness> {
  return client.request<CustomerBusiness>(staffPath(workspaceId, customerId));
}

export function customerBusinessSave(
  client: ApiClient,
  workspaceId: string,
  customerId: string,
  body: CustomerBusinessInput
): Promise<CustomerBusiness> {
  return client.request<CustomerBusiness>(staffPath(workspaceId, customerId), { method: "PUT", body });
}

// ----------------------------------------------------------- storefront --

/** The signed-in shopper's own company details; the exemption is the store's to give. */
export interface ShopperBusiness {
  companyName: string | null;
  taxId: string | null;
  taxExempt: boolean;
}

export function shopperBusiness(client: ApiClient, workspaceRef: string, token: string): Promise<ShopperBusiness> {
  return client.request<ShopperBusiness>(`/store/${workspaceRef}/account/business`, {
    auth: false,
    headers: { "X-Shopper-Token": token },
  });
}

export function shopperBusinessSave(
  client: ApiClient,
  workspaceRef: string,
  token: string,
  body: { companyName?: string; taxId?: string }
): Promise<ShopperBusiness> {
  return client.request<ShopperBusiness>(`/store/${workspaceRef}/account/business`, {
    method: "PUT",
    auth: false,
    headers: { "X-Shopper-Token": token },
    body,
  });
}

// --------------------------------------------------------------- orders --

/** What an order's `contactSnapshot` carries for a business customer (each only when it applies). */
export interface OrderBusinessSnapshot {
  company?: string;
  taxId?: string;
  taxExempt?: boolean;
}

/** The business part of an order's contact snapshot, or null for an order without any. */
export function orderBusinessOf(order: { contactSnapshot?: unknown } | null | undefined): OrderBusinessSnapshot | null {
  const snapshot = order?.contactSnapshot as (OrderBusinessSnapshot & Record<string, unknown>) | null | undefined;
  if (!snapshot || typeof snapshot !== "object") return null;
  const company = typeof snapshot.company === "string" && snapshot.company.trim() ? snapshot.company.trim() : undefined;
  const taxId = typeof snapshot.taxId === "string" && snapshot.taxId.trim() ? snapshot.taxId.trim() : undefined;
  const taxExempt = snapshot.taxExempt === true;
  if (!company && !taxId && !taxExempt) return null;
  return { ...(company ? { company } : {}), ...(taxId ? { taxId } : {}), ...(taxExempt ? { taxExempt: true } : {}) };
}

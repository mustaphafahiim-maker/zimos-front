/**
 * RFM customer scores (backend: frontend-handoff item 237, src/modules/rfm).
 *
 * Each customer with at least one delivered order is scored 1–5 on recency (R), frequency (F)
 * and money (M) by quintile among this store's own customers (refunds off, test and cancelled
 * orders left out), and falls into one of nine groups. Worked out on request; nothing here
 * sends messages.
 *
 * Dashboard, /workspaces/:ws/rfm (customers.view):
 *   GET /                                    → RfmOverview — every group in a fixed order, zeros included
 *   GET /customers?label=&sort=&limit=&offset= → { total, customers } — an unknown label answers 422
 *   GET /customers/:customerId               → { rfm } — null when the customer has no delivered order
 */
import type { ApiClient } from "../client";

/** The groups, in the order the API lists them. */
export const RFM_LABELS = [
  "champions",
  "cant_lose",
  "at_risk",
  "loyal",
  "new",
  "potential",
  "lost",
  "hibernating",
  "need_attention",
] as const;

export type RfmLabel = (typeof RFM_LABELS)[number];

export function isRfmLabel(value: unknown): value is RfmLabel {
  return typeof value === "string" && (RFM_LABELS as readonly string[]).includes(value);
}

export interface RfmLabelSummary {
  label: RfmLabel;
  customers: number;
  /** What the group spent, minor units as a string. */
  spent: string;
  avgOrders: number;
}

export interface RfmOverview {
  /** Customers with at least one delivered order. */
  total: number;
  computedAt: string;
  labels: RfmLabelSummary[];
}

export interface RfmCustomer {
  customerId: string;
  /** Missing on the single-customer answer. */
  fullName: string | null;
  lastOrderAt: string;
  daysSinceLastOrder: number;
  /** Delivered orders. */
  orders: number;
  /** Minor units as a string, refunds taken off. */
  spent: string;
  /** Each 1–5; 5 is best. */
  scores: { r: number; f: number; m: number };
  label: RfmLabel;
}

export type RfmSort = "spent" | "recent" | "orders";

export interface RfmCustomersQuery {
  label?: RfmLabel;
  sort?: RfmSort;
  /** 1–200, default 50. */
  limit?: number;
  offset?: number;
}

export interface RfmCustomersPage {
  total: number;
  customers: RfmCustomer[];
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/rfm`;

export function rfmOverview(client: ApiClient, workspaceId: string): Promise<RfmOverview> {
  return client.request<RfmOverview>(base(workspaceId));
}

export function rfmCustomers(client: ApiClient, workspaceId: string, query: RfmCustomersQuery = {}): Promise<RfmCustomersPage> {
  const qs = new URLSearchParams();
  if (query.label) qs.set("label", query.label);
  if (query.sort) qs.set("sort", query.sort);
  if (query.limit) qs.set("limit", String(query.limit));
  if (query.offset) qs.set("offset", String(query.offset));
  const s = qs.toString();
  return client.request<RfmCustomersPage>(`${base(workspaceId)}/customers${s ? `?${s}` : ""}`);
}

/** One customer's scores and group; null while they have no delivered order. */
export async function rfmCustomerGet(client: ApiClient, workspaceId: string, customerId: string): Promise<RfmCustomer | null> {
  const { rfm } = await client.request<{ rfm: RfmCustomer | null }>(`${base(workspaceId)}/customers/${customerId}`);
  return rfm;
}

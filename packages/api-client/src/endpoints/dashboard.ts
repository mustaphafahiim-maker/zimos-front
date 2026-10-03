/**
 * Dashboard-wide helpers (backend: src/modules/dashboard): global search, the
 * setup guide and the member's sidebar shortcuts.
 *
 * Mounted at /workspaces/:workspaceId. Any active member may call them; a
 * search group the member's role cannot see comes back empty.
 */
import type { ApiClient } from "../client";

export interface SearchOrderHit {
  id: string;
  orderNumber: string;
  customerName: string | null;
  totalAmount: string;
  currency: string;
  createdAt: string;
}

export interface SearchProductHit {
  id: string;
  name: string;
  productCode: string | null;
  status: string;
  imageUrl: string | null;
}

export interface SearchCustomerHit {
  id: string;
  fullName: string | null;
  phone: string;
  totalOrders: number;
}

export interface SearchFunnelHit {
  id: string;
  name: string;
  status: string;
}

export interface DashboardSearchResult {
  orders: SearchOrderHit[];
  products: SearchProductHit[];
  customers: SearchCustomerHit[];
  funnels: SearchFunnelHit[];
}

export type SetupStepKey = "product" | "website" | "payment" | "shipping" | "domain" | "pixel" | "order";

export interface SetupGuide {
  steps: { key: SetupStepKey; done: boolean; optional: boolean }[];
  /** Required steps done / required steps in all. */
  completed: number;
  total: number;
  percent: number;
  done: boolean;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}`;

/** Up to five matches per group. Fewer than two characters returns nothing. */
export async function dashboardSearch(client: ApiClient, workspaceId: string, q: string, signal?: AbortSignal): Promise<DashboardSearchResult> {
  return client.request<DashboardSearchResult>(`${base(workspaceId)}/search?q=${encodeURIComponent(q)}`, { signal });
}

export async function dashboardSetupGuide(client: ApiClient, workspaceId: string): Promise<SetupGuide> {
  return client.request<SetupGuide>(`${base(workspaceId)}/setup-guide`);
}

/** The dashboard routes this member pinned, in order. */
export async function dashboardGetShortcuts(client: ApiClient, workspaceId: string): Promise<string[]> {
  const { shortcuts } = await client.request<{ shortcuts: string[] }>(`${base(workspaceId)}/shortcuts`);
  return shortcuts;
}

/** Replaces the list. At most 8 routes, each like "/orders". */
export async function dashboardSetShortcuts(client: ApiClient, workspaceId: string, shortcuts: string[]): Promise<string[]> {
  const result = await client.request<{ shortcuts: string[] }>(`${base(workspaceId)}/shortcuts`, { method: "PUT", body: { shortcuts } });
  return result.shortcuts;
}

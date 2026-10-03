/**
 * All my stores and "duplicate store" (backend: src/modules/stores).
 *
 * GET /me/stores/overview needs only a signed-in user: it lists the stores
 * they are an active member of. POST /workspaces/:id/duplicate needs
 * workspace.manage on the source store; the copy is owned by the caller and
 * counts against their plan's store limit (PLAN_LIMIT_REACHED, like a new
 * store).
 */
import type { ApiClient } from "../client";
import type { Workspace } from "../types";

export type StoreAlertCode = "suspended" | "billing_restricted" | "draft" | "pending_confirmation" | "low_stock";

export interface StoreAlert {
  code: StoreAlertCode;
  count?: number;
}

export interface StoreOverview {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  currency: string;
  status: "active" | "suspended";
  /** Built but not subscribed yet: the public cannot see it. */
  draft: boolean;
  role: { key: string; name: string };
  isOwner: boolean;
  /** null when the member's role does not show order figures. */
  ordersToday: number | null;
  /** Minor units of `currency`. */
  salesToday: string | null;
  /** 0–100 over COD orders decided in the last 30 days; null when none were. */
  confirmationRate: number | null;
  /** Delivered COD money not settled by couriers yet; null without financial_reports.view. */
  heldByCouriers: { amount: string; orders: number } | null;
  alerts: StoreAlert[];
}

export interface StoreDuplicatePayload {
  name: string;
  /** What to copy. Everything by default. */
  include?: { products?: boolean; website?: boolean; shipping?: boolean };
}

export interface StoreDuplicateResult {
  workspace: Workspace;
  copied: {
    collections: number;
    products: number;
    variants: number;
    offers: number;
    websites: number;
    pages: number;
    shippingZones: number;
    shippingRates: number;
    taxRates: number;
  };
}

export async function storesOverview(client: ApiClient): Promise<StoreOverview[]> {
  const { stores } = await client.request<{ stores: StoreOverview[] }>("/me/stores/overview");
  return stores;
}

/** Products, design and settings into a new store — never orders or customers. */
export async function storesDuplicate(client: ApiClient, workspaceId: string, payload: StoreDuplicatePayload): Promise<StoreDuplicateResult> {
  return client.request<StoreDuplicateResult>(`/workspaces/${workspaceId}/duplicate`, { method: "POST", body: payload });
}

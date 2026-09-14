/**
 * Real platform-admin endpoints on the ZIMOS backend.
 *
 *   GET /api/v1/admin/workspaces → { workspaces: AdminOverviewRow[] }  (JSON)
 *   GET /api/v1/admin/dashboard  → HTML table (same rows, server-rendered)
 *
 * Both require `users.platform_admin = true`; a non-admin token gets 403.
 * Merchant endpoints are used only for per-workspace counts and degrade to
 * `null` on 403/404 so callers can fall back to mock numbers.
 */
import type { Workspace } from "@store-builder/api-client";
import { apiClient, API_BASE_URL } from "./apiClient";
import { ApiError, getErrorMessage } from "./errors";
import { slugify } from "@/mock/store";

export interface AdminOverviewRow {
  workspaceId: string;
  workspaceName: string;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  orderCount: number;
}

export type RealState = "ok" | "forbidden" | "unauthorized" | "unreachable" | "error";

export interface RealStatus {
  state: RealState;
  message: string | null;
  checkedAt: string;
}

export function classifyError(err: unknown): RealStatus {
  const checkedAt = new Date().toISOString();
  if (err instanceof ApiError) {
    if (err.status === 403) return { state: "forbidden", message: "This account is not a platform admin (403).", checkedAt };
    if (err.status === 401) return { state: "unauthorized", message: "Session expired (401).", checkedAt };
    if (err.status === 0 || err.status >= 502) return { state: "unreachable", message: getErrorMessage(err), checkedAt };
    return { state: "error", message: getErrorMessage(err), checkedAt };
  }
  if (err instanceof TypeError) return { state: "unreachable", message: "Can't reach the backend.", checkedAt };
  return { state: "error", message: getErrorMessage(err), checkedAt };
}

let rowsCache: AdminOverviewRow[] | null = null;
let lastStatus: RealStatus | null = null;

export async function fetchAdminWorkspaces(): Promise<{ rows: AdminOverviewRow[] }> {
  try {
    const res = await apiClient.request<{ workspaces?: AdminOverviewRow[] } | AdminOverviewRow[]>("/admin/workspaces");
    const rows = Array.isArray(res) ? res : (res.workspaces ?? []);
    rowsCache = rows;
    lastStatus = { state: "ok", message: null, checkedAt: new Date().toISOString() };
    return { rows };
  } catch (err) {
    lastStatus = classifyError(err);
    throw err;
  }
}

export function getCachedOverviewRow(workspaceId: string): AdminOverviewRow | null {
  return rowsCache?.find((r) => r.workspaceId === workspaceId) ?? null;
}

export function getLastRealStatus(): RealStatus | null {
  return lastStatus;
}

/** Map a backend overview row to the api-client Workspace shape the mock layer enriches. */
export function overviewRowToWorkspace(row: AdminOverviewRow): Workspace {
  const anchor = row.trialEndsAt ?? row.currentPeriodEnd;
  const created = anchor ? new Date(new Date(anchor).getTime() - 14 * 86_400_000) : new Date();
  return {
    id: row.workspaceId,
    name: row.workspaceName,
    slug: slugify(row.workspaceName) || row.workspaceId.slice(0, 8),
    createdAt: created.toISOString(),
    ownerUserId: "",
    status: row.status,
  };
}

export interface RealDashboard {
  workspaces: RealStatus & { rows: AdminOverviewRow[] };
  dashboard: RealStatus;
}

/** Real control-tower inputs. Never throws — each call reports its own status. */
export async function loadRealDashboard(): Promise<RealDashboard> {
  let rows: AdminOverviewRow[] = [];
  let wsStatus: RealStatus;
  try {
    rows = (await fetchAdminWorkspaces()).rows;
    wsStatus = { state: "ok", message: null, checkedAt: new Date().toISOString() };
  } catch (err) {
    wsStatus = classifyError(err);
  }
  let dashStatus: RealStatus;
  try {
    // Returns server-rendered HTML; a 200 means the admin dashboard is available.
    await apiClient.request<string>("/admin/dashboard", { headers: { Accept: "text/html" } });
    dashStatus = { state: "ok", message: null, checkedAt: new Date().toISOString() };
  } catch (err) {
    dashStatus = classifyError(err);
  }
  return { workspaces: { ...wsStatus, rows }, dashboard: dashStatus };
}

export function adminDashboardUrl(): string {
  return `${API_BASE_URL.replace(/\/+$/, "")}/admin/dashboard`;
}

export interface RealWorkspaceCounts {
  orders: { count: number; more: boolean } | null;
  products: { count: number; more: boolean } | null;
  status: RealStatus;
}

/** Real orders/products counts via merchant endpoints; null when the admin isn't a member. */
export async function fetchWorkspaceCounts(workspaceId: string): Promise<RealWorkspaceCounts> {
  let status: RealStatus = { state: "ok", message: null, checkedAt: new Date().toISOString() };
  const settle = async <T,>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        status = { state: "forbidden", message: "Workspace not found for this account (404).", checkedAt: status.checkedAt };
      } else {
        status = classifyError(err);
        if (status.state === "forbidden") status.message = "Not a member of this workspace (403).";
      }
      return null;
    }
  };
  const [orders, products] = await Promise.all([
    settle(apiClient.listOrders(workspaceId, { limit: 100 })),
    settle(apiClient.listProducts(workspaceId, { limit: 100 })),
  ]);
  return {
    orders: orders ? { count: orders.orders.length, more: !!orders.nextCursor } : null,
    products: products ? { count: products.products.length, more: !!products.nextCursor } : null,
    status,
  };
}

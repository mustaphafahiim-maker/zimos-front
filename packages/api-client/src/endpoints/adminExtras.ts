/**
 * Platform console: queues, the app catalogue, dropshipping suppliers, monthly
 * usage, the delivery network in aggregate and a store's support access
 * (backend: src/modules/platformAdmin/platformExtraRoutes.js).
 *
 * All under /admin, each behind a platform permission: system.view (queues),
 * templates.view / templates.manage (apps, suppliers), subscriptions.view
 * (usage), risk.view (network), workspaces.view (support access).
 */
import type { ApiClient } from "../client";
import type { AppCategory, AppText } from "./apps";
import type { SupportAccessGrant } from "./security";

// ------------------------------------------------------------------ queues --

export interface AdminQueueStats {
  name: string;
  pending: number;
  active: number;
  failed: number;
  completedLastDay: number;
  oldestPendingAt: string | null;
}

export interface AdminQueueSchedule {
  name: string;
  everyMs: number | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: "ok" | "failed" | null;
  lastError: string | null;
  lastDurationMs: number | null;
}

export interface AdminQueues {
  driver: "postgres" | "bullmq";
  queues: AdminQueueStats[];
  schedules: AdminQueueSchedule[];
  /** Domain events written but not yet handed to the queue. */
  outbox: { pending: number; oldestPendingAt: string | null };
}

export interface AdminQueueJob {
  id: string;
  queue: string;
  name: string;
  status: "pending" | "active" | "failed" | "completed";
  attempts: number;
  maxAttempts: number;
  workspaceId: string | null;
  lastError: string | null;
  runAt: string;
  createdAt: string;
  finishedAt: string | null;
}

export async function adminQueues(client: ApiClient): Promise<AdminQueues> {
  return client.request<AdminQueues>("/admin/system/queues");
}

export async function adminQueueJobs(
  client: ApiClient,
  params: { status?: "failed" | "pending" | "active"; queue?: string; limit?: number } = {}
): Promise<AdminQueueJob[]> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") query.set(key, String(value));
  const { jobs } = await client.request<{ jobs: AdminQueueJob[] }>(`/admin/system/queues/jobs${query.toString() ? `?${query}` : ""}`);
  return jobs;
}

export async function adminRetryQueueJob(client: ApiClient, jobId: string): Promise<void> {
  await client.request(`/admin/system/queues/jobs/${encodeURIComponent(jobId)}/retry`, { method: "POST" });
}

// ----------------------------------------------------------- app catalogue --

export interface AdminCatalogueApp {
  key: string;
  name: AppText;
  description: AppText | null;
  category: string;
  kind: "feature" | "integration";
  availability: "available" | "coming_soon" | "removed";
  isTest: boolean;
  isActive: boolean;
  displayOrder: number;
  /** Minor units as a string; null = free. */
  priceAmount: string | null;
  currency: string | null;
  billing: "once" | "monthly" | null;
  installs: number;
}

export interface AdminCatalogue {
  apps: AdminCatalogueApp[];
  categories: AppCategory[];
  /** Outside services connected through an install link, across all stores. */
  externalInstalls: number;
}

export interface AdminCatalogueAppUpdate {
  isActive?: boolean;
  displayOrder?: number;
  priceAmount?: number | null;
  currency?: string | null;
  billing?: "once" | "monthly" | null;
}

export async function adminCatalogue(client: ApiClient): Promise<AdminCatalogue> {
  return client.request<AdminCatalogue>("/admin/apps");
}

export async function adminUpdateCatalogueApp(client: ApiClient, key: string, changes: AdminCatalogueAppUpdate): Promise<AdminCatalogueApp> {
  const { app } = await client.request<{ app: AdminCatalogueApp }>(`/admin/apps/${key}`, { method: "PATCH", body: changes });
  return app;
}

// --------------------------------------------------------------- suppliers --

export interface AdminSuppliers {
  providers: Array<{ code: string; name: string; isTest: boolean; stores: number; orders: number }>;
  planned: Array<{ code: string; name: string }>;
}

export async function adminSuppliers(client: ApiClient): Promise<AdminSuppliers> {
  return client.request<AdminSuppliers>("/admin/dropship/providers");
}

// ------------------------------------------------------------------- usage --

export interface AdminUsageTotals {
  stores: number;
  orders: number;
  messages: number;
  aiRequests: number;
  storageBytes: number;
}

export interface AdminUsage {
  period: string;
  periods: string[];
  totals: AdminUsageTotals;
  stores: Array<{ workspaceId: string; name: string; slug: string; orders: number; messages: number; aiRequests: number; storageBytes: number }>;
}

export async function adminUsage(client: ApiClient, period?: string): Promise<AdminUsage> {
  return client.request<AdminUsage>(`/admin/usage${period ? `?period=${period}` : ""}`);
}

// -------------------------------------------------------- delivery network --

export interface AdminNetworkStats {
  totals: {
    customers: number;
    orders: number;
    delivered: number;
    returned: number;
    rejected: number;
    cancelledAfterConfirm: number;
    spamReports: number;
    seenInSeveralStores: number;
  };
  /** Delivered / (delivered + returned), in basis points. Null with no finished order. */
  deliveryRateBp: number | null;
  bands: Array<{ band: "good" | "mixed" | "poor" | "no_history"; customers: number }>;
}

export async function adminNetworkStats(client: ApiClient): Promise<AdminNetworkStats> {
  return client.request<AdminNetworkStats>("/admin/risk/network-stats");
}

// ---------------------------------------------------------- support access --

export async function adminSupportAccess(client: ApiClient, workspaceId: string): Promise<SupportAccessGrant | null> {
  const { active } = await client.request<{ active: SupportAccessGrant | null }>(`/admin/workspaces/${workspaceId}/support-access`);
  return active;
}

/**
 * What a store used this month and what its plan allows (backend:
 * src/modules/billing/usageCounters.js and planLimits.js).
 *
 * GET /workspaces/:workspaceId/billing/usage — billing.manage. Counters are
 * recounted by the worker every 15 minutes. A limit of `null` means the plan
 * sets none. Where a limit is reached the API answers 402 PLAN_LIMIT_REACHED
 * with details { limit, allowed, used }.
 */
import type { ApiClient } from "../client";

export interface UsagePeriod {
  /** "YYYY-MM" (UTC). */
  period: string;
  orders: number;
  messages: number;
  aiRequests: number;
  storageBytes: number;
  updatedAt: string | null;
}

export type PlanLimitKey = "members" | "stores" | "domains" | "leads" | "storage_bytes" | "funnels_per_month";

export interface WorkspaceUsage {
  period: string;
  current: UsagePeriod;
  history: UsagePeriod[];
  /** leads = new contacts from forms and the newsletter this month (the `leads` limit). */
  seats: { members: number | null; domains: number | null; leads?: number | null };
  limits: Record<PlanLimitKey, number | null>;
}

export async function usageGet(client: ApiClient, workspaceId: string): Promise<WorkspaceUsage> {
  return client.request<WorkspaceUsage>(`/workspaces/${workspaceId}/billing/usage`);
}

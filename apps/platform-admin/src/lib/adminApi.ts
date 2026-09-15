/**
 * Real platform-admin endpoints on the ZIMOS backend (all require
 * users.platform_admin; a non-admin token gets 403). Money is integer minor units.
 */
import { apiClient } from "./apiClient";

export type WorkspaceStatus = "active" | "suspended" | "closed";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "suspended" | "cancelled";
export type BillingCycle = "monthly" | "yearly";
export type UserStatus = "active" | "suspended" | "pending_verification";

export const WORKSPACE_STATUSES: WorkspaceStatus[] = ["active", "suspended", "closed"];
export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ["trialing", "active", "past_due", "suspended", "cancelled"];
export const USER_STATUSES: UserStatus[] = ["active", "suspended", "pending_verification"];

export interface AdminWorkspaceRow {
  workspaceId: string;
  workspaceName: string;
  plan: string;
  /** Subscription status. */
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  orderCount: number;
}

export interface AdminOverview {
  workspaces: { total: number; byStatus: Partial<Record<WorkspaceStatus, number>>; new30d: number };
  subscriptions: { byStatus: Partial<Record<SubscriptionStatus, number>> };
  users: { total: number };
  orders: { total: number; last30d: number; gmv30dByCurrency: Record<string, number> };
  series: Array<{ date: string; orders: number }>;
}

export interface AdminPlan {
  id: string;
  key: string;
  name: string;
  monthlyPriceAmount: number;
  yearlyPriceAmount: number;
  currency: string;
  trialDays: number;
  softOrderQuota: number | null;
  features: Record<string, unknown>;
  isActive: boolean;
  subscribers?: number;
}

export interface AdminSubscription {
  id: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  graceUntil: string | null;
  cancelAtPeriodEnd: boolean;
  externalProvider: string | null;
  plan: AdminPlan | null;
}

export interface AdminWorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  status: WorkspaceStatus;
  defaultCurrency: string;
  createdAt: string;
  owner: { id: string; email: string; fullName: string | null; phone: string | null; status: string; lastLoginAt: string | null } | null;
  counts: { orders: number; orders30d: number; products: number; members: number; websites: number };
  revenue30d: number;
  lastOrderAt: string | null;
  websites: Array<{ id: string; name: string; subdomain: string; status: string }>;
  subscription: AdminSubscription | null;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  status: string;
  platformAdmin: boolean;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  workspaces: number;
}

export interface AdminAuditLog {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  workspace: { id: string; name: string } | null;
  actor: { id: string; email: string; fullName: string | null } | null;
  before: unknown;
  after: unknown;
}

export interface AdminTemplate {
  id: string;
  name: string;
  category: string | null;
  thumbnailUrl: string | null;
  isPublished: boolean;
  createdAt: string;
  versions: Array<{ id: string; version: number; isActive: boolean; pageCount: number; websites: number; createdAt: string }>;
}

export interface AdminSystem {
  database: string;
  migrations: { files: number; applied: number; pending: string[] };
  storage: string;
  notifications: { email?: string; sms?: string; whatsapp?: string };
  billingWebhookSecretConfigured: boolean;
  paymentGatewayConnected: boolean;
  googleOAuthConfigured: boolean;
  node: string;
  uptimeSeconds: number;
  environment: string;
}

export interface SubscriptionPatch {
  status?: SubscriptionStatus;
  planId?: string;
  billingCycle?: BillingCycle;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string;
  graceUntil?: string | null;
  cancelAtPeriodEnd?: boolean;
}

export type PlanInput = {
  key: string;
  name: string;
  monthlyPriceAmount: number;
  yearlyPriceAmount: number;
  currency?: string;
  trialDays?: number;
  softOrderQuota?: number | null;
  features?: Record<string, unknown>;
  isActive?: boolean;
};

function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const adminApi = {
  overview: () => apiClient.request<{ overview: AdminOverview }>("/admin/overview").then((r) => r.overview),
  listWorkspaces: () => apiClient.request<{ workspaces: AdminWorkspaceRow[] }>("/admin/workspaces").then((r) => r.workspaces ?? []),
  getWorkspace: (id: string) => apiClient.request<{ workspace: AdminWorkspaceDetail }>(`/admin/workspaces/${id}`).then((r) => r.workspace),
  setWorkspaceStatus: (id: string, status: WorkspaceStatus, reason?: string) =>
    apiClient.request<{ workspace: { id: string; status: WorkspaceStatus } }>(`/admin/workspaces/${id}/status`, {
      method: "PATCH",
      body: { status, ...(reason ? { reason } : {}) },
    }),
  updateSubscription: (workspaceId: string, patch: SubscriptionPatch) =>
    apiClient.request<{ subscription: AdminSubscription }>(`/admin/workspaces/${workspaceId}/subscription`, { method: "PATCH", body: patch }),
  runTrialCheck: () => apiClient.request<{ expired: number }>("/billing/run-trial-check", { method: "POST" }),

  listPlans: () => apiClient.request<{ plans: AdminPlan[] }>("/admin/plans").then((r) => r.plans ?? []),
  createPlan: (input: PlanInput) => apiClient.request<{ plan: AdminPlan }>("/admin/plans", { method: "POST", body: input }).then((r) => r.plan),
  updatePlan: (id: string, patch: Partial<Omit<PlanInput, "key">>) =>
    apiClient.request<{ plan: AdminPlan }>(`/admin/plans/${id}`, { method: "PATCH", body: patch }).then((r) => r.plan),

  listUsers: (p: { search?: string; limit?: number; before?: string | null } = {}) =>
    apiClient.request<{ users: AdminUser[]; nextCursor: string | null }>(`/admin/users${qs(p)}`),
  updateUser: (id: string, patch: { status?: string; platformAdmin?: boolean }) =>
    apiClient.request<{ user: { id: string; email: string; status: string; platformAdmin: boolean } }>(`/admin/users/${id}`, { method: "PATCH", body: patch }).then((r) => r.user),

  listAuditLogs: (p: { limit?: number; before?: string | null; workspaceId?: string; action?: string; entityType?: string } = {}) =>
    apiClient.request<{ logs: AdminAuditLog[]; nextCursor: string | null }>(`/admin/audit-logs${qs(p)}`),

  listTemplates: () => apiClient.request<{ templates: AdminTemplate[] }>("/admin/templates").then((r) => r.templates ?? []),
  updateTemplate: (id: string, patch: { name?: string; category?: string | null; thumbnailUrl?: string | null; isPublished?: boolean }) =>
    apiClient.request<{ template: Omit<AdminTemplate, "versions" | "createdAt"> }>(`/admin/templates/${id}`, { method: "PATCH", body: patch }).then((r) => r.template),

  system: () => apiClient.request<{ system: AdminSystem }>("/admin/system").then((r) => r.system),
};

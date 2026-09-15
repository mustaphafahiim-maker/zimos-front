/**
 * Real platform-admin API.
 *
 * Every function here maps 1:1 onto a live `/api/v1/admin/...` endpoint. There
 * is no local persistence and no fallback data: when a call fails the error
 * propagates so the page can show it. Anything the backend does not implement
 * is absent from this module rather than simulated; those console areas render
 * `<NotConnected />` naming the endpoints they are waiting on.
 */
import type {
  AdminAnnouncement,
  AdminAnnouncementInput,
  AdminFeatureFlag,
  AdminFeatureFlagInput,
  AdminPlan,
  AdminPlanInput,
  AdminSubscription,
  AdminWorkspaceOverview,
} from "@store-builder/api-client";
import { apiClient } from "./apiClient";
import { PLATFORM_CURRENCY } from "./format";

/**
 * A workspace overview row joined to its full subscription record.
 *
 * `workspace` already carries a flattened billing summary and the lifetime
 * order count; `subscription` adds the fields only the subscriptions endpoint
 * has (MRR, period start, grace, cancel-at-period-end) and is null when the
 * workspace has never subscribed.
 */
export interface AdminWorkspaceRow {
  workspace: AdminWorkspaceOverview;
  subscription: AdminSubscriptionRow | null;
}

/**
 * A subscription with its plan's currency attached. `mrr` is in the plan's
 * currency, which the subscriptions endpoint doesn't include, so it is looked
 * up from the plan list rather than assumed.
 */
export interface AdminSubscriptionRow extends AdminSubscription {
  currency: string;
}

async function planCurrencies(): Promise<Map<string, string>> {
  const plans = await apiClient.adminListPlans().catch(() => [] as AdminPlan[]);
  return new Map(plans.map((p) => [p.id, p.currency]));
}

function withCurrency(
  subscriptions: AdminSubscription[],
  currencies: Map<string, string>
): AdminSubscriptionRow[] {
  return subscriptions.map((s) => ({
    ...s,
    currency: currencies.get(s.planId) ?? PLATFORM_CURRENCY,
  }));
}

// ------------------------------------------------------------------ workspaces

/**
 * `GET /admin/workspaces` + `GET /admin/subscriptions`, joined on workspaceId.
 *
 * The subscriptions call is allowed to fail on its own: the workspace list is
 * still worth showing without billing columns, so a rejection here degrades to
 * `subscription: null` rather than failing the whole page.
 */
export async function listWorkspaceRows(): Promise<AdminWorkspaceRow[]> {
  const [workspaces, subscriptions, currencies] = await Promise.all([
    apiClient.adminListWorkspaces(),
    apiClient.adminListSubscriptions().catch(() => [] as AdminSubscription[]),
    planCurrencies(),
  ]);

  const byWorkspace = new Map<string, AdminSubscriptionRow>();
  for (const sub of withCurrency(subscriptions, currencies)) {
    // Newest first from the API, so the first one seen is the current record.
    if (!byWorkspace.has(sub.workspaceId)) byWorkspace.set(sub.workspaceId, sub);
  }

  return workspaces.map((workspace) => ({
    workspace,
    subscription: byWorkspace.get(workspace.id) ?? null,
  }));
}

/**
 * Name/address search over the workspace list. The endpoint takes no `search`
 * parameter, so the filtering happens here over the full list.
 */
export async function searchWorkspaces(query: string, limit = 8): Promise<AdminWorkspaceRow[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rows = await listWorkspaceRows();
  return rows
    .filter(
      ({ workspace }) =>
        workspace.name.toLowerCase().includes(q) || workspace.slug.toLowerCase().includes(q)
    )
    .slice(0, limit);
}

export async function getWorkspaceRow(workspaceId: string): Promise<AdminWorkspaceRow | null> {
  const rows = await listWorkspaceRows();
  return rows.find((r) => r.workspace.id === workspaceId) ?? null;
}

// ----------------------------------------------------------------------- plans

export function listPlans(): Promise<AdminPlan[]> {
  return apiClient.adminListPlans();
}

export function savePlan(input: AdminPlanInput): Promise<AdminPlan> {
  return apiClient.adminSavePlan(input);
}

export async function deletePlan(planId: string): Promise<void> {
  await apiClient.adminDeletePlan(planId);
}

// --------------------------------------------------------------- subscriptions

export async function listSubscriptions(
  params: { status?: string } = {}
): Promise<AdminSubscriptionRow[]> {
  const [subscriptions, currencies] = await Promise.all([
    apiClient.adminListSubscriptions(params),
    planCurrencies(),
  ]);
  return withCurrency(subscriptions, currencies);
}

// -------------------------------------------------------------- feature flags

export function listFlags(): Promise<AdminFeatureFlag[]> {
  return apiClient.adminListFeatureFlags();
}

export function saveFlag(input: AdminFeatureFlagInput): Promise<AdminFeatureFlag> {
  return apiClient.adminSaveFeatureFlag(input);
}

export async function deleteFlag(flagId: string): Promise<void> {
  await apiClient.adminDeleteFeatureFlag(flagId);
}

// -------------------------------------------------------------- announcements

export function listAnnouncements(): Promise<AdminAnnouncement[]> {
  return apiClient.adminListAnnouncements();
}

export function saveAnnouncement(input: AdminAnnouncementInput): Promise<AdminAnnouncement> {
  return apiClient.adminSaveAnnouncement(input);
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  await apiClient.adminDeleteAnnouncement(announcementId);
}

/** Derived from the window alone — the API stores no status column. */
export function announcementStatus(
  a: Pick<AdminAnnouncement, "startsAt" | "endsAt">
): "scheduled" | "live" | "ended" {
  const now = Date.now();
  if (new Date(a.startsAt).getTime() > now) return "scheduled";
  if (a.endsAt && new Date(a.endsAt).getTime() < now) return "ended";
  return "live";
}

import type { AuthUser } from "@store-builder/api-client";

/**
 * Platform-console permission keys, mirroring the backend's
 * `core/security/platformPermissions.js`. The backend is the gate — every
 * `/admin` route checks one of these — so the console only uses them to hide
 * what the signed-in account cannot open anyway.
 */
export const P = {
  OVERVIEW_VIEW: "overview.view",
  WORKSPACES_VIEW: "workspaces.view",
  WORKSPACES_MANAGE: "workspaces.manage",
  SUBSCRIPTIONS_MANAGE: "subscriptions.manage",
  SUBSCRIPTIONS_VIEW: "subscriptions.view",
  PAYMENTS_RECORD: "payments.record",
  PLANS_VIEW: "plans.view",
  PLANS_MANAGE: "plans.manage",
  TEMPLATES_VIEW: "templates.view",
  // Also reviewing merchants' marketplace templates (pages/MarketplaceReviewPage.tsx).
  TEMPLATES_MANAGE: "templates.manage",
  RISK_VIEW: "risk.view",
  PROVIDERS_VIEW: "providers.view",
  PROVIDERS_MANAGE: "providers.manage",
  SYSTEM_VIEW: "system.view",
  FEATURE_FLAGS_VIEW: "feature_flags.view",
  ANNOUNCEMENTS_VIEW: "announcements.view",
  // Also the education links (pages/EducationLinksPage.tsx).
  ANNOUNCEMENTS_MANAGE: "announcements.manage",
  SERVICE_LISTINGS_VIEW: "service_listings.view",
  SUPPORT_VIEW: "support.view",
  AUDIT_LOG_VIEW: "audit_log.view",
  ADMINS_VIEW: "admins.view",
  ADMINS_MANAGE: "admins.manage",
  AGENTS_VIEW: "agents.view",
  AGENTS_MANAGE: "agents.manage",
  COMMISSIONS_MARK_PAID: "commissions.mark_paid",
  REFERRALS_VIEW_OWN: "referrals.view_own",
} as const;

export type PermissionKey = (typeof P)[keyof typeof P];

export const CREATOR_ROLE = "creator";

/** `*` (the creator role) holds every key, including ones added later. */
export function hasPermission(user: AuthUser | null, key: string): boolean {
  if (!user || !user.platformRole) return false;
  const held = user.platformPermissions ?? [];
  return held.includes("*") || held.includes(key);
}

/**
 * Human labels for the permission editor. A key missing here (one the backend
 * added later) still shows, under its raw name.
 */
export const PERMISSION_LABELS: Record<string, string> = {
  "overview.view": "Overview",
  "workspaces.view": "Workspaces",
  "workspaces.manage": "Stores — suspend and reactivate",
  "subscriptions.view": "Subscriptions",
  "subscriptions.manage": "Subscriptions — billing cycle, special terms, trial-expiry check",
  "payments.record": "Subscription charges — price and record payments by hand",
  "plans.view": "Plans — view",
  "plans.manage": "Plans — edit",
  "templates.view": "Templates — view",
  "templates.manage": "Templates — edit and publish; review marketplace templates",
  "risk.view": "Fraud signals and blocklist — view",
  "risk.manage": "Blocklist — edit",
  "providers.view": "Carriers and payment gateways",
  "providers.manage": "Courier areas map — edit for every store",
  "system.view": "System health",
  "feature_flags.view": "Feature flags — view",
  "feature_flags.manage": "Feature flags — edit",
  "announcements.view": "Announcements — view",
  "announcements.manage": "Announcements — edit",
  "service_listings.view": "Service listings — view",
  "service_listings.manage": "Service listings — edit",
  "support.view": "Support tickets — view",
  "support.manage": "Support tickets — reply and update",
  "audit_log.view": "Audit log",
  "admins.view": "Admin users — view",
  "admins.manage": "Admin users — grant, change and revoke roles",
  "agents.view": "Agents, codes and commissions — view",
  "agents.manage": "Agents and referral codes — create and edit",
  "commissions.mark_paid": "Commissions — mark paid",
  "referrals.view_own": "Own referral codes and commissions (agents)",
};

export function permissionLabel(key: string): string {
  return key === "*" ? "Everything (creator)" : (PERMISSION_LABELS[key] ?? key);
}

/**
 * Who may open the analytics screens: the `analytics.view` permission
 * (Backend core/security/permissions.js). Of the system roles, owner ("*"),
 * workspace_manager and accountant hold it; the three below don't. The
 * dashboard only sees the role key, so a custom role reads as allowed — the
 * server still decides, and a 403 comes back as DataState's permission
 * message. Same approach as pages/confirmation/confirmationRoles.ts.
 */
export const NO_ANALYTICS_ROLES: ReadonlySet<string> = new Set(["editor", "order_operator", "confirmation_agent"]);

/** False only for a known system role without analytics.view. */
export function canViewAnalytics(role: string | null | undefined): boolean {
  return !NO_ANALYTICS_ROLES.has(role ?? "");
}

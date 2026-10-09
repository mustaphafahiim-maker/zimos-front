/**
 * Who may open and change the inventory screens (handoff 206/207): reading
 * needs `inventory.view`, changing needs `inventory.manage` (backend
 * core/security/permissions.js). The dashboard only sees the role key, so a
 * custom role reads as allowed — the server still decides, and a 403 comes
 * back as DataState's permission message. Same approach as
 * lib/analyticsAccess.ts.
 */

/** System roles without `inventory.view`: the sidebar entry is hidden for them. */
export const NO_INVENTORY_ROLES: ReadonlySet<string> = new Set(["confirmation_agent", "accountant"]);

/** System roles that may look at stock but not change it. */
const VIEW_ONLY_ROLES: ReadonlySet<string> = new Set(["editor", "order_operator", "fulfillment"]);

/** System roles without `orders.manage`: they see where an order ships from but cannot move it. */
const NO_ORDER_MANAGE_ROLES: ReadonlySet<string> = new Set(["editor", "confirmation_agent", "fulfillment", "accountant"]);

/** False only for a known system role without inventory.manage. */
export function canManageInventory(role: string | null | undefined): boolean {
  return !NO_INVENTORY_ROLES.has(role ?? "") && !VIEW_ONLY_ROLES.has(role ?? "");
}

/** False only for a known system role without orders.manage. */
export function canManageOrders(role: string | null | undefined): boolean {
  return !NO_ORDER_MANAGE_ROLES.has(role ?? "");
}

/** Who may open Settings → Plan & billing (the upgrade link), as components/AccessBanner.tsx has it. */
export function canSeeBilling(role: string | null | undefined): boolean {
  return role === "owner" || role === "accountant";
}

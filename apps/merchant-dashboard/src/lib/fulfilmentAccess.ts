/**
 * Who may change delivery slots, holiday mode and store pickup (* 216, 225). Reading all three needs `orders.view`; saving delivery slots and
 * holiday mode needs `workspace.manage`, store pickup `shipping.manage`, and
 * the daily work (move an order's slot, mark a pickup ready, hand it over)
 * `orders.manage` (backend core/security/permissions.js).
 *
 * The dashboard only sees the role key, so a custom role reads as allowed —
 * the server still decides, and a 403 is worded where it happens. Same
 * approach as lib/inventoryAccess.ts.
 */

/** System roles without `workspace.manage`: only the owner and the store manager hold it. */
const NO_WORKSPACE_MANAGE_ROLES: ReadonlySet<string> = new Set(["editor", "order_operator", "confirmation_agent", "fulfillment", "accountant"]);

/** System roles without `shipping.manage`. */
const NO_SHIPPING_MANAGE_ROLES: ReadonlySet<string> = new Set(["editor", "confirmation_agent", "accountant"]);

/** System roles without `orders.manage`. */
const NO_ORDER_MANAGE_ROLES: ReadonlySet<string> = new Set(["editor", "confirmation_agent", "fulfillment", "accountant"]);

/** System roles without `orders.view`: the three features' screens answer 403 for them. */
const NO_ORDER_VIEW_ROLES: ReadonlySet<string> = new Set(["editor"]);

/** False only for a known system role without workspace.manage. */
export function canManageStoreSettings(role: string | null | undefined): boolean {
  return !NO_WORKSPACE_MANAGE_ROLES.has(role ?? "");
}

/** False only for a known system role without shipping.manage. */
export function canManageShipping(role: string | null | undefined): boolean {
  return !NO_SHIPPING_MANAGE_ROLES.has(role ?? "");
}

/** False only for a known system role without orders.manage. */
export function canManageOrderFulfilment(role: string | null | undefined): boolean {
  return !NO_ORDER_MANAGE_ROLES.has(role ?? "");
}

/** False only for a known system role without orders.view. */
export function canViewOrderFulfilment(role: string | null | undefined): boolean {
  return !NO_ORDER_VIEW_ROLES.has(role ?? "");
}

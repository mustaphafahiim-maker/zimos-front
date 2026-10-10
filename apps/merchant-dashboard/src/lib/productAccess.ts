/**
 * Who may change the catalog: reading needs `products.view`, changing needs
 * `products.manage` (backend core/security/permissions.js). Used by the
 * screens that change products in bulk or through their settings — the sheet
 * update, scheduled sales, product specifications and
 * bought-together (223).
 *
 * The dashboard only sees the role key, so a custom role reads as allowed —
 * the server still decides, and a 403 comes back as DataState's permission
 * message. Same approach as lib/inventoryAccess.ts.
 */

/** System roles with `products.view` but without `products.manage`. */
const VIEW_ONLY_ROLES: ReadonlySet<string> = new Set(["order_operator", "fulfillment"]);

/** System roles without `products.view`. */
const NO_PRODUCTS_ROLES: ReadonlySet<string> = new Set(["confirmation_agent", "accountant"]);

/** False only for a known system role without products.manage. */
export function canManageProducts(role: string | null | undefined): boolean {
  return !VIEW_ONLY_ROLES.has(role ?? "") && !NO_PRODUCTS_ROLES.has(role ?? "");
}

/** False only for a known system role without products.view. */
export function canViewProducts(role: string | null | undefined): boolean {
  return !NO_PRODUCTS_ROLES.has(role ?? "");
}

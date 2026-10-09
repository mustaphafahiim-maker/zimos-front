/**
 * Who may change customers (handoffs 209, 235, 248): reading needs
 * `customers.view`, merging, erasing, exporting and deleting a follow-up need
 * `customers.manage` (backend core/security/permissions.js). The dashboard only
 * sees the role key, so a custom role reads as allowed — the server still
 * decides, and a 403 comes back as a message. Same approach as
 * lib/inventoryAccess.ts.
 */

/**
 * The surface of a list on the Customers page: one sheet around the table from
 * md up, nothing on a phone, where DataTable turns every row into its own card
 * (the recipe of pages/giftCards/GiftCardsPage.tsx).
 */
export const TABLE_SHEET =
  "md:overflow-hidden md:rounded-[var(--radius-card)] md:bg-paper-raised md:shadow-[var(--shadow-card)] md:ring-1 md:ring-line";

/** System roles that see customers but can't manage them. */
const VIEW_ONLY_ROLES: ReadonlySet<string> = new Set(["order_operator", "confirmation_agent"]);

/** System roles without `customers.view` at all. */
const NO_CUSTOMER_ROLES: ReadonlySet<string> = new Set(["editor", "fulfillment", "accountant"]);

/** System roles without `users.manage`: they can't read the team list. */
const NO_TEAM_LIST_ROLES: ReadonlySet<string> = new Set(["editor", "order_operator", "confirmation_agent", "fulfillment", "accountant"]);

/** False only for a known system role without customers.manage. */
export function canManageCustomers(role: string | null | undefined): boolean {
  return !VIEW_ONLY_ROLES.has(role ?? "") && !NO_CUSTOMER_ROLES.has(role ?? "");
}

/** False only for a known system role without users.manage (the follow-up form then offers "me" and "the whole team"). */
export function canListTeam(role: string | null | undefined): boolean {
  return !NO_TEAM_LIST_ROLES.has(role ?? "");
}

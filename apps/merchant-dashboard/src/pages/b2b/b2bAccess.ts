/**
 * Who may change what on the business-customer and pay-on-account screens
 * (handoff 228, 229; backend core/security/permissions.js):
 *
 *   customers.view    read a customer's business details, their statement and the balances list
 *   customers.manage  change the business details, the exemption, the limit and the terms
 *   orders.manage     record a payment on an on-account order
 *
 * The dashboard only sees the role key, so a custom role reads as allowed —
 * the server still decides, and a 403 comes back as the card's or the page's
 * permission message. Same approach as lib/inventoryAccess.ts.
 */
import { canManageOrders } from "@/lib/inventoryAccess";

/** System roles without `customers.view`. */
const NO_CUSTOMER_VIEW_ROLES: ReadonlySet<string> = new Set(["editor", "fulfillment", "accountant"]);

/** System roles that may look at customers but not change them. */
const CUSTOMER_VIEW_ONLY_ROLES: ReadonlySet<string> = new Set(["order_operator", "confirmation_agent"]);

/** False only for a known system role without customers.view. */
export function canViewCustomers(role: string | null | undefined): boolean {
  return !NO_CUSTOMER_VIEW_ROLES.has(role ?? "");
}

/** False only for a known system role without customers.manage. */
export function canManageCustomers(role: string | null | undefined): boolean {
  return canViewCustomers(role) && !CUSTOMER_VIEW_ONLY_ROLES.has(role ?? "");
}

/** False only for a known system role without orders.manage. */
export function canRecordPayments(role: string | null | undefined): boolean {
  return canManageOrders(role);
}

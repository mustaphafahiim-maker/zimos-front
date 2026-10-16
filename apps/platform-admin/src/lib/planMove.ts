/**
 * A pay-per-order store's move to a monthly or annual plan, as a charge row
 * in the console names it (billing_invoices.target_plan_id): null for any
 * other charge.
 */
export function planMoveLabel(charge: {
  status: string;
  targetPlanId?: string | null;
  targetPlanName?: string | null;
  targetBillingCycle?: "monthly" | "yearly" | null;
  voidReason?: "cancelled" | "replaced" | "expired" | null;
}): string | null {
  if (!charge.targetPlanId) return null;
  const cycle = charge.targetBillingCycle === "yearly" ? "annual" : "monthly";
  const label = `Move from pay per order to ${charge.targetPlanName ?? "another plan"} (${cycle})`;
  if (charge.status === "pending") return `${label} — switches when paid`;
  if (charge.status === "void") return `${label} — ${VOID_REASON[charge.voidReason ?? "cancelled"]}, not due`;
  return label;
}

const VOID_REASON = { cancelled: "cancelled by the store", replaced: "replaced by another move", expired: "expired unpaid" } as const;

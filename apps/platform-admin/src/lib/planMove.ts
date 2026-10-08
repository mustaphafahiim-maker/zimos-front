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
}): string | null {
  if (!charge.targetPlanId) return null;
  const cycle = charge.targetBillingCycle === "yearly" ? "annual" : "monthly";
  const label = `Move from pay per order to ${charge.targetPlanName ?? "another plan"} (${cycle})`;
  return charge.status === "pending" ? `${label} — switches when paid` : label;
}

/** Why a charge stopped asking for money (billing_invoices.void_reason). */
type VoidReason = "cancelled" | "replaced" | "expired" | "cancelled_by_merchant" | "voided_by_admin" | "payment_failed";

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
  voidReason?: VoidReason | null;
}): string | null {
  if (!charge.targetPlanId) return null;
  const cycle = charge.targetBillingCycle === "yearly" ? "annual" : "monthly";
  const label = `Move from pay per order to ${charge.targetPlanName ?? "another plan"} (${cycle})`;
  if (charge.status === "pending") return `${label} — switches when paid`;
  if (charge.status === "void") return `${label} — ${voidReasonText(charge.voidReason)}, not due`;
  return label;
}

/**
 * Why any other void charge (a renewal) is not due; null for a move's
 * (planMoveLabel says it) and for a charge that isn't void.
 */
export function voidLabel(charge: { status: string; targetPlanId?: string | null; voidReason?: VoidReason | null }): string | null {
  if (charge.status !== "void" || charge.targetPlanId) return null;
  const reason = voidReasonText(charge.voidReason);
  return `${reason.charAt(0).toUpperCase()}${reason.slice(1)}, not due`;
}

const voidReasonText = (reason: VoidReason | null | undefined) => VOID_REASON[reason ?? "cancelled"] ?? VOID_REASON.cancelled;

const VOID_REASON: Record<VoidReason, string> = {
  cancelled: "cancelled by the store",
  replaced: "replaced by another move",
  expired: "expired unpaid",
  cancelled_by_merchant: "cancelled by the store",
  voided_by_admin: "voided in the console",
  payment_failed: "its payment didn't go through",
};

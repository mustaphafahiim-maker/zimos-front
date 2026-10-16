import type { BillingPhase } from "@store-builder/api-client";
import type { Tone } from "@/components/StatusBadge";

/**
 * Billing constants and labels shared by the console's billing screens.
 * The annual price is always this many months of the monthly price
 * (billing/planPricing.js in the backend) — two months free.
 */
export const ANNUAL_PRICE_MONTHS = 10;

export const BILLING_PHASE_LABELS: Record<BillingPhase, { label: string; tone: Tone }> = {
  ok: { label: "Paid up", tone: "success" },
  expiring: { label: "Expiring in 3 days or less", tone: "warning" },
  payment_due: { label: "Payment due", tone: "warning" },
  grace: { label: "Expired — grace day", tone: "danger" },
  restricted: { label: "Expired — restricted", tone: "danger" },
  draft: { label: "Draft — not subscribed", tone: "info" },
};

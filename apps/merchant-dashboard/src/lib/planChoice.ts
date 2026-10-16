import type { BillingCycle } from "@store-builder/api-client";

/**
 * The plan picked on the sign-up form, kept across the Google round trip so
 * the plan page an account made through Google lands on starts from it.
 * Session storage: this tab, until it closes.
 */
const KEY = "zimos.signupPlan";

export function rememberPlanChoice(choice: { planId: string | null; billingCycle: BillingCycle }) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    // Private mode: the plan page simply starts with nothing chosen.
  }
}

export function recallPlanChoice(): { planId: string | null; billingCycle: BillingCycle } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { planId?: unknown; billingCycle?: unknown };
    return {
      planId: typeof parsed.planId === "string" ? parsed.planId : null,
      billingCycle: parsed.billingCycle === "yearly" ? "yearly" : "monthly",
    };
  } catch {
    return null;
  }
}

export function forgetPlanChoice() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}

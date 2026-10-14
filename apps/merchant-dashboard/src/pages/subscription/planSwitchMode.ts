import type { SubscriptionPlans } from "@store-builder/api-client";
import type { PlanSwitchText } from "./planSwitchStrings";

/** Whether this subscription changes plan by itself through /billing/plan-switch (the server says so). */
export function selfServeSwitch(view: SubscriptionPlans): boolean {
  return Boolean(view.planSwitch?.enabled && view.planSwitch.mode === "switch");
}

/** The words for the reason the server gives when support decides (flag on, mode "support"); null otherwise. */
export function supportReasonText(view: SubscriptionPlans, s: PlanSwitchText): string | null {
  const sw = view.planSwitch;
  if (!sw?.enabled || sw.mode !== "support") return null;
  if (sw.reason === "MANUAL_PRICING") return s.reasonManual;
  if (sw.reason === "SPECIAL_TERMS_ACTIVE") return s.reasonSpecial;
  if (sw.reason === "PLAN_CHANGE_NEEDS_SUPPORT") return s.reasonClosed;
  return null;
}

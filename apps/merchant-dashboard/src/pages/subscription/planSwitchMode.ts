import type { SubscriptionPlans } from "@store-builder/api-client";
import type { PlanSwitchText } from "./planSwitchStrings";

/** A number of hours in words (as formatDays does for days): "48 hours", "٤٨ ساعة". */
export function formatHours(hours: number, locale: "ar" | "en"): string {
  if (locale === "en") return hours === 1 ? "1 hour" : `${hours} hours`;
  const n = new Intl.NumberFormat("ar-EG").format(hours);
  if (hours === 1) return "ساعة واحدة";
  if (hours === 2) return "ساعتان";
  if (hours >= 3 && hours <= 10) return `${n} ساعات`;
  return `${n} ساعة`;
}

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

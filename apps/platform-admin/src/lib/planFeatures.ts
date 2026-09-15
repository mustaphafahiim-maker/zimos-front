import type { PlanFeatureKey } from "@store-builder/api-client";

/**
 * Display labels for the feature keys the backend stores in `plans.features`.
 * The keys are the contract; this is only how they are named in the UI.
 */
export const PLAN_FEATURES: Array<{ key: PlanFeatureKey; label: string }> = [
  { key: "custom_domain", label: "Custom domain" },
  { key: "funnels", label: "Sales funnels" },
  { key: "whatsapp_confirmation", label: "WhatsApp order confirmation" },
  { key: "abandoned_cart", label: "Abandoned cart recovery" },
  { key: "multi_warehouse", label: "Multiple warehouses" },
  { key: "api_access", label: "API access" },
  { key: "staff_accounts", label: "Staff accounts" },
  { key: "advanced_analytics", label: "Advanced analytics" },
  { key: "remove_branding", label: "Remove platform branding" },
  { key: "priority_support", label: "Priority support" },
];

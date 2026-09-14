import type { AdminRole, PlanFeatureKey } from "./types";

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

export const ADMIN_ROLES: Array<{ value: AdminRole; label: string; description: string }> = [
  { value: "super_admin", label: "Super admin", description: "Full access, including admin users and plans." },
  { value: "support", label: "Support", description: "Workspaces, tickets and announcements." },
  { value: "finance", label: "Finance", description: "Subscriptions, plans and billing actions." },
  { value: "ops", label: "Ops", description: "Providers, risk and system health." },
  { value: "read_only", label: "Read only", description: "Can view everything, change nothing." },
];

export const COUNTRIES: Record<string, string> = {
  EG: "Egypt",
  SA: "Saudi Arabia",
  AE: "United Arab Emirates",
  KW: "Kuwait",
  JO: "Jordan",
  MA: "Morocco",
};

export const TEMPLATE_CATEGORIES = ["Fashion", "Beauty", "Electronics", "Home", "Food", "General"];
export const APP_CATEGORIES = ["Marketing", "Shipping", "Payments", "Analytics", "Customer service", "Productivity"];

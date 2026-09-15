import type { ComponentType } from "react";
import { Activity, Building2, CreditCard, LayoutDashboard, LayoutTemplate, Layers, ScrollText, Users } from "lucide-react";

type L = { en: string; ar: string };

export interface NavItem {
  label: L;
  to: string;
  icon: ComponentType<{ className?: string }>;
  keywords?: string;
}

export interface NavGroup {
  id: string;
  label: L | null;
  items: NavItem[];
}

/** Only pages backed by real /admin endpoints. */
export const NAV_GROUPS: NavGroup[] = [
  { id: "overview", label: null, items: [{ label: { en: "Overview", ar: "نظرة عامة" }, to: "/", icon: LayoutDashboard, keywords: "dashboard kpi" }] },
  {
    id: "merchants",
    label: { en: "Merchants", ar: "التجار" },
    items: [
      { label: { en: "Workspaces", ar: "مساحات العمل" }, to: "/workspaces", icon: Building2, keywords: "stores merchants" },
      { label: { en: "Users", ar: "المستخدمين" }, to: "/users", icon: Users, keywords: "accounts admins" },
      { label: { en: "Subscriptions", ar: "الاشتراكات" }, to: "/subscriptions", icon: CreditCard, keywords: "billing trial" },
      { label: { en: "Plans", ar: "الباقات" }, to: "/plans", icon: Layers, keywords: "pricing" },
    ],
  },
  {
    id: "marketplace",
    label: { en: "Marketplace", ar: "السوق" },
    items: [{ label: { en: "Templates", ar: "القوالب" }, to: "/templates", icon: LayoutTemplate, keywords: "themes" }],
  },
  {
    id: "system",
    label: { en: "System", ar: "النظام" },
    items: [
      { label: { en: "Audit log", ar: "سجل العمليات" }, to: "/audit-log", icon: ScrollText, keywords: "history" },
      { label: { en: "System health", ar: "صحة النظام" }, to: "/system-health", icon: Activity, keywords: "migrations database" },
    ],
  },
];

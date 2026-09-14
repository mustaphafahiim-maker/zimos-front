import type { ComponentType } from "react";
import {
  Activity,
  Ban,
  Building2,
  CreditCard,
  DatabaseBackup,
  Factory,
  FileText,
  Flag,
  Gavel,
  LayoutDashboard,
  LayoutTemplate,
  Layers,
  LifeBuoy,
  ListChecks,
  Megaphone,
  MessageCircle,
  Puzzle,
  Receipt,
  ScrollText,
  Settings,
  ShieldAlert,
  Truck,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  keywords?: string;
}

export interface NavGroup {
  id: string;
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { id: "overview", label: null, items: [{ label: "Overview", to: "/", icon: LayoutDashboard, keywords: "dashboard control tower alerts" }] },
  {
    id: "merchants",
    label: "Merchants",
    items: [
      { label: "Workspaces", to: "/workspaces", icon: Building2, keywords: "stores merchants" },
      { label: "Users", to: "/users", icon: Users, keywords: "accounts people" },
      { label: "Subscriptions", to: "/subscriptions", icon: CreditCard, keywords: "billing" },
      { label: "Plans", to: "/plans", icon: Layers, keywords: "pricing" },
      { label: "Finance", to: "/finance", icon: Receipt, keywords: "revenue mrr invoices payouts refunds" },
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    items: [
      { label: "Templates", to: "/templates", icon: LayoutTemplate, keywords: "themes" },
      { label: "Suppliers", to: "/suppliers", icon: Factory },
      { label: "Apps", to: "/apps", icon: Puzzle },
      { label: "Content", to: "/content", icon: FileText, keywords: "cms marketing faq changelog hero" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { label: "Carriers", to: "/carriers", icon: Truck, keywords: "shipping" },
      { label: "Payment gateways", to: "/payment-gateways", icon: Wallet },
      { label: "WhatsApp numbers", to: "/whatsapp-numbers", icon: MessageCircle },
      { label: "Jobs & queues", to: "/jobs", icon: ListChecks, keywords: "cron background retry" },
    ],
  },
  {
    id: "risk",
    label: "Risk",
    items: [
      { label: "Fraud signals", to: "/fraud-signals", icon: ShieldAlert },
      { label: "Blocklist", to: "/blocklist", icon: Ban },
      { label: "Moderation", to: "/moderation", icon: Gavel, keywords: "reports abuse" },
    ],
  },
  {
    id: "support",
    label: "Support",
    items: [
      { label: "Tickets", to: "/tickets", icon: LifeBuoy },
      { label: "Announcements", to: "/announcements", icon: Megaphone },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { label: "Settings", to: "/settings", icon: Settings, keywords: "maintenance legal templates webhooks api keys integrations" },
      { label: "Feature flags", to: "/feature-flags", icon: Flag },
      { label: "Admin users & roles", to: "/admin-users", icon: UserCog, keywords: "permissions 2fa staff" },
      { label: "Audit log", to: "/audit-log", icon: ScrollText },
      { label: "System health", to: "/system-health", icon: Activity },
      { label: "Backups", to: "/backups", icon: DatabaseBackup, keywords: "snapshots restore export" },
    ],
  },
];

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Blocks,
  Boxes,
  Building2,
  Coins,
  CreditCard,
  Filter,
  FlaskConical,
  Globe,
  Handshake,
  Headphones,
  Home,
  LayoutTemplate,
  Megaphone,
  MessageCircle,
  Package,
  PackageOpen,
  RotateCcw,
  Settings,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  Target,
  TrendingUp,
  Truck,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Small pill next to the label, e.g. "New". */
  badge?: string;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/**
 * Sidebar structure. Order mirrors a merchant's day: what came in, what to
 * confirm, what to ship, then money, then growth tooling, then configuration.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { label: "Home", to: "/", icon: Home },
      { label: "All stores", to: "/stores", icon: Building2 },
    ],
  },
  {
    label: "Sell",
    items: [
      { label: "Orders", to: "/orders", icon: ShoppingBag },
      { label: "Order pipeline", to: "/orders/pipeline", icon: Filter },
      { label: "Call center", to: "/call-center", icon: Headphones, badge: "New" },
      { label: "WhatsApp inbox", to: "/inbox", icon: MessageCircle, badge: "New" },
      { label: "Abandoned checkouts", to: "/abandoned-checkouts", icon: ShoppingCart },
      { label: "Returns & RTO", to: "/returns", icon: RotateCcw },
      { label: "Fraud protection", to: "/fraud", icon: ShieldAlert },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Profit & loss", to: "/profit", icon: TrendingUp, badge: "New" },
      { label: "COD settlements", to: "/settlements", icon: Coins, badge: "New" },
      { label: "Payments", to: "/payments", icon: CreditCard },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", to: "/catalog", icon: Package },
      { label: "Inventory", to: "/inventory", icon: Boxes },
      { label: "Suppliers", to: "/suppliers", icon: PackageOpen, badge: "New" },
      { label: "Customers", to: "/customers", icon: Users },
      { label: "Reviews", to: "/reviews", icon: Star },
    ],
  },
  {
    label: "Grow",
    items: [
      { label: "Ads & media buying", to: "/ads", icon: Target, badge: "New" },
      { label: "Funnels", to: "/funnels", icon: Workflow },
      { label: "Offers & bundles", to: "/offers", icon: Zap },
      { label: "A/B tests", to: "/experiments", icon: FlaskConical },
      { label: "Discounts", to: "/discounts", icon: Tag },
      { label: "Pixels & tracking", to: "/marketing", icon: Megaphone },
      { label: "Automations", to: "/automations", icon: Sparkles },
      { label: "Affiliates", to: "/affiliates", icon: Handshake },
    ],
  },
  {
    label: "Storefront",
    items: [
      { label: "Website", to: "/website", icon: Globe },
      { label: "Templates", to: "/templates", icon: LayoutTemplate },
      { label: "Shipping & carriers", to: "/shipping", icon: Truck },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", to: "/analytics", icon: BarChart3 },
      { label: "Apps", to: "/apps", icon: Blocks },
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
];

/** Flat list, kept for anything that still iterates the old shape. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

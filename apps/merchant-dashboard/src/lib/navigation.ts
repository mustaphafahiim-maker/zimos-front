import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Blocks,
  Boxes,
  CreditCard,
  Filter,
  FlaskConical,
  Globe,
  Home,
  LayoutTemplate,
  Megaphone,
  Package,
  PhoneCall,
  Settings,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Tag,
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
 * confirm, what to ship, then growth tooling, then configuration.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ label: "Home", to: "/", icon: Home }],
  },
  {
    label: "Sell",
    items: [
      { label: "Orders", to: "/orders", icon: ShoppingBag },
      { label: "Order pipeline", to: "/orders/pipeline", icon: Filter },
      { label: "Confirmation queue", to: "/confirmation-queue", icon: PhoneCall },
      { label: "Abandoned checkouts", to: "/abandoned-checkouts", icon: ShoppingCart },
      { label: "Fraud protection", to: "/fraud", icon: ShieldAlert },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", to: "/catalog", icon: Package },
      { label: "Inventory", to: "/inventory", icon: Boxes },
      { label: "Customers", to: "/customers", icon: Users },
    ],
  },
  {
    label: "Grow",
    items: [
      { label: "Funnels", to: "/funnels", icon: Workflow },
      { label: "Offers & bundles", to: "/offers", icon: Zap },
      { label: "A/B tests", to: "/experiments", icon: FlaskConical },
      { label: "Discounts", to: "/discounts", icon: Tag },
      { label: "Marketing & pixels", to: "/marketing", icon: Megaphone },
      { label: "Automations", to: "/automations", icon: Sparkles },
    ],
  },
  {
    label: "Storefront",
    items: [
      { label: "Website", to: "/website", icon: Globe },
      { label: "Templates", to: "/templates", icon: LayoutTemplate },
      { label: "Shipping & carriers", to: "/shipping", icon: Truck },
      { label: "Payments", to: "/payments", icon: CreditCard },
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

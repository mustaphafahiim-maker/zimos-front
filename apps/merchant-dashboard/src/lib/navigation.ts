import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  ClipboardCheck,
  Globe,
  Headset,
  Images,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Package,
  PiggyBank,
  Settings,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tag,
  Truck,
  Undo2,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import type { Messages } from "@/i18n/LocaleContext";

export type NavKey =
  | "overview"
  | "orders"
  | "confirmationQueue"
  | "callCenter"
  | "abandonedCheckouts"
  | "returns"
  | "settlements"
  | "inbox"
  | "automations"
  | "marketing"
  | "fraud"
  | "analytics"
  | "profit"
  | "media"
  | "catalog"
  | "reviews"
  | "customers"
  | "discounts"
  | "shipping"
  | "website"
  | "funnels"
  | "settings";

/** Group headings. Separate from NavKey so a group and an item may share a name. */
export type NavGroupKey = "sell" | "store" | "catalog" | "grow" | "insights";

export interface NavItem {
  /** Key into NAV_LABELS — the visible label is resolved per locale. */
  key: NavKey;
  to: string;
  icon: LucideIcon;
}

export interface NavGroup {
  /** Stable id, used to persist the collapsed state. */
  id: string;
  /** Key into NAV_GROUP_LABELS, or null for an unheaded group. */
  labelKey: NavGroupKey | null;
  items: NavItem[];
  /**
   * false hides the collapse toggle entirely — this section is always fully
   * shown. Reserved for a small number of groups a merchant must never lose
   * track of (building the store is the whole point of the product), so a
   * stray click can't hide "Website" or "Funnels" the way a collapsed group
   * normally would. Every other group defaults to collapsible.
   */
  collapsible?: boolean;
}

/**
 * Sidebar structure. Order mirrors a merchant's day: what came in, what to
 * confirm, then building the store itself, then the catalog behind it, then
 * growth tooling.
 *
 * "Store" is deliberately early, right after Sell, and never collapses:
 * building the website and the sales funnels are the two tools a merchant
 * reaches for constantly, and burying either of them one click away from
 * "gone" — as a collapsed accordion section can — is exactly the confusion
 * this group exists to prevent. Compare Shopify's "Online Store" and
 * EasyOrders' "إدارة المتجر" / "التسويق": both keep store-building and its
 * companion landing-page/funnel tool in one place a merchant can't collapse
 * away by accident.
 *
 * Every entry here must map to a route in App.tsx — the sidebar is not a
 * roadmap. Features the backend does not serve yet stay out until they do.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    labelKey: null,
    items: [{ key: "overview", to: "/", icon: LayoutDashboard }],
  },
  {
    id: "sell",
    labelKey: "sell",
    items: [
      { key: "orders", to: "/orders", icon: ShoppingBag },
      { key: "confirmationQueue", to: "/confirmation-queue", icon: ClipboardCheck },
      { key: "callCenter", to: "/call-center", icon: Headset },
      { key: "abandonedCheckouts", to: "/abandoned-checkouts", icon: ShoppingCart },
      { key: "returns", to: "/returns", icon: Undo2 },
      { key: "settlements", to: "/settlements", icon: Wallet },
      { key: "fraud", to: "/fraud", icon: ShieldAlert },
    ],
  },
  {
    id: "store",
    labelKey: "store",
    collapsible: false,
    items: [
      { key: "website", to: "/website", icon: Globe },
      { key: "funnels", to: "/funnels", icon: Workflow },
      { key: "shipping", to: "/shipping", icon: Truck },
    ],
  },
  {
    id: "catalog",
    labelKey: "catalog",
    items: [
      { key: "catalog", to: "/catalog", icon: Package },
      { key: "reviews", to: "/reviews", icon: Star },
      { key: "customers", to: "/customers", icon: Users },
      { key: "media", to: "/media", icon: Images },
    ],
  },
  {
    id: "grow",
    labelKey: "grow",
    items: [
      { key: "inbox", to: "/inbox", icon: MessageCircle },
      { key: "automations", to: "/automations", icon: Bot },
      { key: "marketing", to: "/marketing", icon: Megaphone },
      { key: "discounts", to: "/discounts", icon: Tag },
    ],
  },
  {
    id: "insights",
    labelKey: "insights",
    items: [
      { key: "analytics", to: "/analytics", icon: BarChart3 },
      { key: "profit", to: "/profit", icon: PiggyBank },
    ],
  },
  {
    id: "config",
    labelKey: null,
    items: [{ key: "settings", to: "/settings", icon: Settings }],
  },
];

/** Flat list, for anything that iterates items without caring about grouping. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** The nav item a pathname belongs to (longest matching prefix), if any. */
export function findNavItem(pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const item of NAV_ITEMS) {
    const match =
      item.to === "/"
        ? pathname === "/"
        : pathname === item.to || pathname.startsWith(`${item.to}/`);
    if (match && (!best || item.to.length > best.to.length)) best = item;
  }
  return best;
}

/** Sidebar / drawer labels. Read with `useT(NAV_LABELS)`. */
export const NAV_LABELS = {
  en: {
    overview: "Overview",
    orders: "Orders",
    confirmationQueue: "Confirmation Queue",
    callCenter: "Call Centre",
    abandonedCheckouts: "Abandoned Checkouts",
    returns: "Returns",
    settlements: "COD Settlements",
    fraud: "Fraud Protection",
    inbox: "WhatsApp Inbox",
    automations: "Automations",
    marketing: "Marketing Pixels",
    catalog: "Catalog",
    reviews: "Reviews",
    customers: "Customers",
    media: "Media Library",
    discounts: "Discounts",
    analytics: "Analytics",
    profit: "Profit",
    shipping: "Shipping & Tax",
    website: "Website",
    funnels: "Funnels",
    settings: "Settings",
  },
  ar: {
    overview: "نظرة عامة",
    orders: "الطلبات",
    confirmationQueue: "قائمة التأكيد",
    callCenter: "الكول سنتر",
    abandonedCheckouts: "السلات المتروكة",
    returns: "المرتجعات",
    settlements: "تحصيل الشحن",
    fraud: "الحماية من النصب",
    inbox: "صندوق واتساب",
    automations: "الأتمتة",
    marketing: "بيكسلات الإعلانات",
    catalog: "الكتالوج",
    reviews: "التقييمات",
    customers: "العملاء",
    media: "مكتبة الصور",
    discounts: "الخصومات",
    analytics: "التحليلات",
    profit: "الأرباح",
    shipping: "الشحن والضرائب",
    website: "الموقع",
    funnels: "مسارات البيع",
    settings: "الإعدادات",
  },
} satisfies Messages<NavKey>;

/** Group headings. Read with `useT(NAV_GROUP_LABELS)`. */
export const NAV_GROUP_LABELS = {
  en: {
    sell: "Sell",
    store: "Store",
    catalog: "Catalog",
    grow: "Grow",
    insights: "Insights",
  },
  ar: {
    sell: "البيع",
    store: "المتجر",
    catalog: "الكتالوج",
    grow: "النمو",
    insights: "التقارير",
  },
} satisfies Messages<NavGroupKey>;

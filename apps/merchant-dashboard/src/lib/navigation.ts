import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bot,
  ClipboardCheck,
  Globe,
  Headset,
  Home,
  Images,
  Layers,
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
  | "webAnalytics"
  | "realtime"
  | "profit"
  | "media"
  | "catalog"
  | "collections"
  | "reviews"
  | "customers"
  | "discounts"
  | "shipping"
  | "website"
  | "funnels"
  | "settings";

/** Group headings. Separate from NavKey so a group and an item may share a name. */
export type NavGroupKey = "channels";

export interface NavItem {
  /** Key into NAV_LABELS — the visible label is resolved per locale. */
  key: NavKey;
  to: string;
  icon: LucideIcon;
  /**
   * Sub-pages, shown under the item only while it (or one of them) is the
   * current section — the way Shopify's admin keeps the rail short.
   */
  children?: NavItem[];
}

export interface NavGroup {
  /** Stable id. */
  id: string;
  /** Key into NAV_GROUP_LABELS, or null for an unheaded group. */
  labelKey: NavGroupKey | null;
  items: NavItem[];
  /** Pinned to the bottom of the rail, below everything else. */
  pinned?: boolean;
}

/**
 * Sidebar structure, in the shape merchants know from Shopify's admin: a
 * short list of top-level sections, each opening its sub-pages only while
 * you are in it; the sales channels under their own heading; shipping and
 * settings pinned at the bottom.
 *
 * Every entry here must map to a route in App.tsx — the sidebar is not a
 * roadmap. Features the backend does not serve yet stay out until they do.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    labelKey: null,
    items: [
      { key: "overview", to: "/", icon: Home },
      {
        key: "orders",
        to: "/orders",
        icon: ShoppingBag,
        children: [
          { key: "confirmationQueue", to: "/confirmation-queue", icon: ClipboardCheck },
          { key: "callCenter", to: "/call-center", icon: Headset },
          { key: "abandonedCheckouts", to: "/abandoned-checkouts", icon: ShoppingCart },
          { key: "returns", to: "/returns", icon: Undo2 },
          { key: "settlements", to: "/settlements", icon: Wallet },
          { key: "fraud", to: "/fraud", icon: ShieldAlert },
        ],
      },
      {
        key: "catalog",
        to: "/catalog",
        icon: Package,
        children: [
          { key: "collections", to: "/catalog/collections", icon: Layers },
          { key: "reviews", to: "/reviews", icon: Star },
          { key: "media", to: "/media", icon: Images },
        ],
      },
      { key: "customers", to: "/customers", icon: Users },
      {
        key: "marketing",
        to: "/marketing",
        icon: Megaphone,
        children: [
          { key: "automations", to: "/automations", icon: Bot },
          { key: "inbox", to: "/inbox", icon: MessageCircle },
        ],
      },
      { key: "discounts", to: "/discounts", icon: Tag },
      {
        key: "analytics",
        to: "/analytics",
        icon: BarChart3,
        children: [
          { key: "webAnalytics", to: "/analytics/web", icon: Globe },
          { key: "realtime", to: "/analytics/realtime", icon: Activity },
          { key: "profit", to: "/profit", icon: PiggyBank },
        ],
      },
    ],
  },
  {
    id: "channels",
    labelKey: "channels",
    items: [
      {
        key: "website",
        to: "/website",
        icon: Globe,
        children: [{ key: "funnels", to: "/funnels", icon: Workflow }],
      },
    ],
  },
  {
    id: "config",
    labelKey: null,
    pinned: true,
    items: [
      { key: "shipping", to: "/shipping", icon: Truck },
      { key: "settings", to: "/settings", icon: Settings },
    ],
  },
];

/** Flat list, for anything that iterates items without caring about nesting. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) =>
  g.items.flatMap((item) => [item, ...(item.children ?? [])])
);

function matches(item: NavItem, pathname: string): boolean {
  return item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

/** The nav item a pathname belongs to (longest matching prefix), if any. */
export function findNavItem(pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const item of NAV_ITEMS) {
    if (matches(item, pathname) && (!best || item.to.length > best.to.length)) best = item;
  }
  return best;
}

/** True while `pathname` is inside `item` or any of its sub-pages. */
export function isInSection(item: NavItem, pathname: string): boolean {
  const current = findNavItem(pathname);
  if (!current) return false;
  return current.to === item.to || (item.children ?? []).some((c) => c.to === current.to);
}

/** Sidebar / drawer labels. Read with `useT(NAV_LABELS)`. */
export const NAV_LABELS = {
  en: {
    overview: "Home",
    orders: "Orders",
    confirmationQueue: "Confirmation queue",
    callCenter: "Call centre",
    abandonedCheckouts: "Abandoned checkouts",
    returns: "Returns",
    settlements: "COD settlements",
    fraud: "Fraud protection",
    inbox: "WhatsApp inbox",
    automations: "Automations",
    marketing: "Marketing",
    catalog: "Products",
    collections: "Collections",
    reviews: "Reviews",
    customers: "Customers",
    media: "Media library",
    discounts: "Discounts",
    analytics: "Analytics",
    webAnalytics: "Web analytics",
    realtime: "Realtime",
    profit: "Profit",
    shipping: "Shipping & tax",
    website: "Online store",
    funnels: "Funnels",
    settings: "Settings",
  },
  ar: {
    overview: "الرئيسية",
    orders: "الطلبات",
    confirmationQueue: "قائمة التأكيد",
    callCenter: "الكول سنتر",
    abandonedCheckouts: "السلات المتروكة",
    returns: "المرتجعات",
    settlements: "تحصيل الشحن",
    fraud: "الحماية من النصب",
    inbox: "صندوق واتساب",
    automations: "الأتمتة",
    marketing: "التسويق",
    catalog: "المنتجات",
    collections: "التصنيفات",
    reviews: "التقييمات",
    customers: "العملاء",
    media: "مكتبة الصور",
    discounts: "الخصومات",
    analytics: "التحليلات",
    webAnalytics: "زيارات الموقع",
    realtime: "الآن مباشر",
    profit: "الأرباح",
    shipping: "الشحن والضرائب",
    website: "المتجر الإلكتروني",
    funnels: "مسارات البيع",
    settings: "الإعدادات",
  },
} satisfies Messages<NavKey>;

/** Group headings. Read with `useT(NAV_GROUP_LABELS)`. */
export const NAV_GROUP_LABELS = {
  en: { channels: "Sales channels" },
  ar: { channels: "قنوات البيع" },
} satisfies Messages<NavGroupKey>;

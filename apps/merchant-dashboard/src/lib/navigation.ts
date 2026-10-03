import type { LucideIcon } from "lucide-react";
import {
  FileDown,
  Activity,
  BadgeDollarSign,
  BarChart3,
  Bot,
  ClipboardCheck,
  CreditCard,
  Gift,
  Globe,
  History,
  Images,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  Package,
  PiggyBank,
  Settings,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Star,
  Store,
  Tag,
  Target,
  Truck,
  Undo2,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import type { Messages } from "@/i18n/LocaleContext";
import { NO_ANALYTICS_ROLES } from "@/lib/analyticsAccess";

export type NavKey =
  | "overview"
  | "orders"
  | "confirmationQueue"
  | "fraud"
  | "returns"
  | "abandonedCarts"
  | "catalog"
  | "reviews"
  | "customers"
  | "discounts"
  | "offers"
  | "shipping"
  | "payments"
  | "website"
  | "funnels"
  | "analytics"
  | "webAnalytics"
  | "attribution"
  | "realtime"
  | "settings"
  | "support"
  | "settlements"
  | "inbox"
  | "automations"
  | "marketing"
  | "profit"
  | "ads"
  | "media"
  | "digital"
  | "storeSettings"
  | "apps"
  | "activity";

/** Group headings. Separate from NavKey so a group and an item may share a name. */
export type NavGroupKey = "sell" | "catalog" | "grow" | "reports" | "storefront";

export interface NavItem {
  /** Key into NAV_LABELS — the visible label is resolved per locale. */
  key: NavKey;
  to: string;
  icon: LucideIcon;
  /**
   * Role keys that don't see this entry: the system roles the backend refuses
   * for the page's API (the page still handles a 403 for any other role).
   * Entries without it are shown to everyone, as before.
   */
  hiddenForRoles?: ReadonlySet<string>;
}

export interface NavGroup {
  /** Stable id, used to persist the collapsed state. */
  id: string;
  /** Key into NAV_GROUP_LABELS, or null for an unheaded group. */
  labelKey: NavGroupKey | null;
  items: NavItem[];
}

/**
 * Sidebar structure. Order mirrors a merchant's day: what came in, what to
 * confirm, what slipped away or looks suspicious, then getting it delivered
 * (and back); then the catalog behind it, growth tooling, and the storefront
 * and its settings.
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
      { key: "abandonedCarts", to: "/abandoned-carts", icon: ShoppingCart },
      { key: "fraud", to: "/fraud", icon: ShieldAlert },
      { key: "shipping", to: "/shipping", icon: Truck },
      { key: "payments", to: "/payments", icon: CreditCard },
      { key: "returns", to: "/returns", icon: Undo2 },
      { key: "settlements", to: "/settlements", icon: Wallet },
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
      { key: "digital", to: "/digital", icon: FileDown },
    ],
  },
  {
    id: "grow",
    labelKey: "grow",
    items: [
      { key: "funnels", to: "/funnels", icon: Workflow },
      { key: "offers", to: "/offers", icon: Gift },
      { key: "discounts", to: "/discounts", icon: Tag },
      { key: "marketing", to: "/marketing", icon: Megaphone },
      { key: "automations", to: "/automations", icon: Bot },
      { key: "inbox", to: "/inbox", icon: MessageCircle },
    ],
  },
  {
    id: "reports",
    labelKey: "reports",
    items: [
      { key: "analytics", to: "/analytics", icon: BarChart3, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "webAnalytics", to: "/analytics/web", icon: LineChart, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "attribution", to: "/analytics/attribution", icon: Target, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "realtime", to: "/analytics/realtime", icon: Activity, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "profit", to: "/profit", icon: PiggyBank, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "ads", to: "/ads", icon: BadgeDollarSign, hiddenForRoles: NO_ANALYTICS_ROLES },
    ],
  },
  {
    id: "storefront",
    labelKey: "storefront",
    items: [
      { key: "website", to: "/website", icon: Globe },
      { key: "storeSettings", to: "/store-settings", icon: Store },
    ],
  },
  {
    id: "config",
    labelKey: null,
    items: [
      { key: "apps", to: "/apps", icon: LayoutGrid },
      { key: "settings", to: "/settings", icon: Settings },
      { key: "activity", to: "/activity", icon: History },
      { key: "support", to: "/support", icon: LifeBuoy },
    ],
  },
];

/** Whether a role sees an entry (see NavItem.hiddenForRoles). */
export function isNavItemVisible(item: NavItem, role: string | null | undefined): boolean {
  return !item.hiddenForRoles?.has(role ?? "");
}

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
    confirmationQueue: "Confirmation queue",
    fraud: "Fraud protection",
    returns: "Returns",
    abandonedCarts: "Lost orders",
    catalog: "Catalog",
    reviews: "Reviews",
    customers: "Contacts",
    discounts: "Discounts",
    offers: "Offers",
    shipping: "Shipping & Tax",
    payments: "Payments",
    website: "Website",
    funnels: "Funnels",
    analytics: "Analytics",
    webAnalytics: "Web analytics",
    attribution: "Sales attribution",
    realtime: "Realtime",
    apps: "Apps",
    activity: "Activity log",
    settings: "Settings",
    support: "Contact support",
    settlements: "COD settlements",
    inbox: "WhatsApp inbox",
    automations: "Automations",
    marketing: "Marketing",
    profit: "Profit",
    ads: "Ad campaigns",
    media: "Media library",
    digital: "Digital products",
    storeSettings: "Store settings",
  },
  ar: {
    overview: "نظرة عامة",
    orders: "الطلبات",
    confirmationQueue: "قائمة التأكيد",
    fraud: "الحماية من الاحتيال",
    returns: "المرتجعات",
    abandonedCarts: "الطلبات المفقودة",
    catalog: "الكتالوج",
    reviews: "التقييمات",
    customers: "جهات الاتصال",
    discounts: "الخصومات",
    offers: "العروض",
    shipping: "الشحن والضرائب",
    payments: "المدفوعات",
    website: "الموقع",
    funnels: "مسارات البيع",
    analytics: "التحليلات",
    webAnalytics: "زيارات الموقع",
    attribution: "مصادر المبيعات",
    realtime: "مباشر الآن",
    apps: "التطبيقات",
    activity: "سجل النشاط",
    settings: "الإعدادات",
    support: "تواصل مع الدعم",
    settlements: "تحصيل الشحن",
    inbox: "صندوق واتساب",
    automations: "الأتمتة",
    marketing: "التسويق",
    profit: "الأرباح",
    ads: "الحملات الإعلانية",
    media: "مكتبة الصور",
    digital: "المنتجات الرقمية",
    storeSettings: "إعدادات المتجر",
  },
} satisfies Messages<NavKey>;

/** Group headings. Read with `useT(NAV_GROUP_LABELS)`. */
export const NAV_GROUP_LABELS = {
  en: {
    sell: "Sell",
    catalog: "Catalog",
    grow: "Grow",
    reports: "Reports",
    storefront: "Storefront",
  },
  ar: {
    sell: "البيع",
    catalog: "الكتالوج",
    grow: "النمو",
    reports: "التقارير",
    storefront: "واجهة المتجر",
  },
} satisfies Messages<NavGroupKey>;

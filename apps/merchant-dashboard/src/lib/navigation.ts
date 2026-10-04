import type { LucideIcon } from "lucide-react";
import {
  FileDown,
  GraduationCap,
  MousePointerClick,
  Handshake,
  Repeat,
  UsersRound,
  Sparkles,
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
  | "ai"
  | "affiliates"
  | "subscriptions"
  | "services"
  | "shoppableImages"
  | "courses"
  | "storeSettings"
  | "apps"
  | "activity";

/** Group headings. Separate from NavKey so a group and an item may share a name. */
export type NavGroupKey = "orders" | "products" | "customers" | "marketing" | "store" | "analytics" | "money";

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
 * Sidebar structure, in the order a merchant thinks about the business: the
 * orders that came in and what each one needs, what is being sold, who bought
 * it, how more people are brought in, the store they land on, the numbers, and
 * the money (getting paid, shipping). Admin and help sit at the bottom.
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
    id: "orders",
    labelKey: "orders",
    items: [
      { key: "orders", to: "/orders", icon: ShoppingBag },
      { key: "confirmationQueue", to: "/confirmation-queue", icon: ClipboardCheck },
      { key: "abandonedCarts", to: "/abandoned-carts", icon: ShoppingCart },
      { key: "returns", to: "/returns", icon: Undo2 },
      { key: "fraud", to: "/fraud", icon: ShieldAlert },
    ],
  },
  {
    id: "products",
    labelKey: "products",
    items: [
      { key: "catalog", to: "/catalog", icon: Package },
      { key: "reviews", to: "/reviews", icon: Star },
      { key: "digital", to: "/digital", icon: FileDown },
      { key: "courses", to: "/courses", icon: GraduationCap },
      { key: "subscriptions", to: "/subscriptions", icon: Repeat },
      { key: "media", to: "/media", icon: Images },
    ],
  },
  {
    id: "customers",
    labelKey: "customers",
    items: [
      { key: "customers", to: "/customers", icon: Users },
      { key: "inbox", to: "/inbox", icon: MessageCircle },
    ],
  },
  {
    id: "marketing",
    labelKey: "marketing",
    items: [
      { key: "marketing", to: "/marketing", icon: Megaphone },
      { key: "offers", to: "/offers", icon: Gift },
      { key: "discounts", to: "/discounts", icon: Tag },
      { key: "automations", to: "/automations", icon: Bot },
      { key: "affiliates", to: "/affiliates", icon: UsersRound },
      { key: "ai", to: "/ai", icon: Sparkles },
    ],
  },
  {
    id: "store",
    labelKey: "store",
    items: [
      { key: "website", to: "/website", icon: Globe },
      { key: "funnels", to: "/funnels", icon: Workflow },
      { key: "shoppableImages", to: "/shoppable-images", icon: MousePointerClick },
      { key: "storeSettings", to: "/store-settings", icon: Store },
    ],
  },
  {
    id: "analytics",
    labelKey: "analytics",
    items: [
      { key: "analytics", to: "/analytics", icon: BarChart3, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "realtime", to: "/analytics/realtime", icon: Activity, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "webAnalytics", to: "/analytics/web", icon: LineChart, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "attribution", to: "/analytics/attribution", icon: Target, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "profit", to: "/profit", icon: PiggyBank, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "ads", to: "/ads", icon: BadgeDollarSign, hiddenForRoles: NO_ANALYTICS_ROLES },
    ],
  },
  {
    id: "money",
    labelKey: "money",
    items: [
      { key: "payments", to: "/payments", icon: CreditCard },
      { key: "settlements", to: "/settlements", icon: Wallet },
      { key: "shipping", to: "/shipping", icon: Truck },
    ],
  },
  {
    id: "config",
    labelKey: null,
    items: [
      { key: "apps", to: "/apps", icon: LayoutGrid },
      { key: "settings", to: "/settings", icon: Settings },
      { key: "activity", to: "/activity", icon: History },
      { key: "services", to: "/services", icon: Handshake },
      { key: "support", to: "/support", icon: LifeBuoy },
    ],
  },
];

/** The group an item sits in — the first crumb of the page's breadcrumb. */
export function findNavGroup(item: NavItem): NavGroup | undefined {
  return NAV_GROUPS.find((group) => group.items.includes(item));
}

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
    overview: "Home",
    orders: "Orders",
    confirmationQueue: "Confirmation queue",
    fraud: "Fraud protection",
    returns: "Returns",
    abandonedCarts: "Lost orders",
    catalog: "Products",
    reviews: "Reviews",
    customers: "Customers",
    discounts: "Discounts",
    offers: "Offers",
    shipping: "Shipping & Tax",
    payments: "Payments",
    website: "Website",
    funnels: "Funnels",
    analytics: "Overview & reports",
    webAnalytics: "Store traffic",
    attribution: "Sales sources",
    realtime: "Live now",
    apps: "Apps",
    activity: "Activity log",
    settings: "Settings",
    support: "Contact support",
    settlements: "COD settlements",
    inbox: "WhatsApp inbox",
    automations: "Automations",
    marketing: "Marketing",
    profit: "Profit",
    ads: "Ad spend",
    media: "Media library",
    digital: "Digital products",
    ai: "AI studio",
    affiliates: "Affiliates",
    subscriptions: "Subscriptions",
    services: "Services",
    shoppableImages: "Shoppable images",
    courses: "Courses",
    storeSettings: "Store settings",
  },
  ar: {
    overview: "الرئيسية",
    orders: "الطلبات",
    confirmationQueue: "قائمة التأكيد",
    fraud: "الحماية من الاحتيال",
    returns: "المرتجعات",
    abandonedCarts: "الطلبات المفقودة",
    catalog: "المنتجات",
    reviews: "التقييمات",
    customers: "العملاء",
    discounts: "الخصومات",
    offers: "العروض",
    shipping: "الشحن والضرائب",
    payments: "المدفوعات",
    website: "الموقع",
    funnels: "مسارات البيع",
    analytics: "النظرة العامة والتقارير",
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
    ads: "مصاريف الإعلانات",
    media: "مكتبة الصور",
    digital: "المنتجات الرقمية",
    ai: "استوديو الذكاء الاصطناعي",
    affiliates: "المسوّقون بالعمولة",
    subscriptions: "الاشتراكات",
    services: "الخدمات",
    shoppableImages: "الصور التفاعلية",
    courses: "الكورسات",
    storeSettings: "إعدادات المتجر",
  },
} satisfies Messages<NavKey>;

/** Group headings. Read with `useT(NAV_GROUP_LABELS)`. */
export const NAV_GROUP_LABELS = {
  en: {
    orders: "Orders",
    products: "Products",
    customers: "Customers",
    marketing: "Marketing",
    store: "Online store",
    analytics: "Analytics",
    money: "Money & shipping",
  },
  ar: {
    orders: "الطلبات",
    products: "المنتجات",
    customers: "العملاء",
    marketing: "التسويق",
    store: "المتجر",
    analytics: "التحليلات",
    money: "الفلوس والشحن",
  },
} satisfies Messages<NavGroupKey>;

import type { Icon } from "@/components/icons";
import {
  IconActivity,
  IconAdAccounts,
  IconAds,
  IconAffiliates,
  IconAi,
  IconApps,
  IconAttribution,
  IconAutomations,
  IconBlog,
  IconConfirm,
  IconCourses,
  IconCustomers,
  IconDigital,
  IconDiscounts,
  IconFunnels,
  IconGiftCards,
  IconHome,
  IconInbox,
  IconInventory,
  IconLostOrders,
  IconLoyalty,
  IconMarketing,
  IconMedia,
  IconMoreReports,
  IconOffers,
  IconOrders,
  IconPayments,
  IconProducts,
  IconProfit,
  IconProtection,
  IconQuestions,
  IconQuotes,
  IconRealtime,
  IconReferrals,
  IconReports,
  IconReturns,
  IconReviews,
  IconSearch,
  IconServices,
  IconSettings,
  IconSettlements,
  IconShoppableImages,
  IconShipping,
  IconSizeCharts,
  IconStoreCredit,
  IconStoreSettings,
  IconSubscriptions,
  IconSupport,
  IconSynonyms,
  IconWebAnalytics,
  IconWebsite,
} from "@/components/icons";
import type { Messages } from "@/i18n/LocaleContext";
import { NO_ANALYTICS_ROLES } from "@/lib/analyticsAccess";
import { NO_INVENTORY_ROLES } from "@/lib/inventoryAccess";

export type NavKey =
  | "overview"
  | "orders"
  | "confirmationQueue"
  | "fraud"
  | "returns"
  | "quotes"
  | "abandonedCarts"
  | "catalog"
  | "inventory"
  | "reviews"
  | "productQuestions"
  | "sizeCharts"
  | "searchSynonyms"
  | "searchInsights"
  | "customers"
  | "discounts"
  | "offers"
  | "shipping"
  | "payments"
  | "website"
  | "blog"
  | "funnels"
  | "analytics"
  | "storeReports"
  | "webAnalytics"
  | "attribution"
  | "realtime"
  | "settings"
  | "support"
  | "settlements"
  | "paymentLedger"
  | "inbox"
  | "automations"
  | "marketing"
  | "profit"
  | "ads"
  | "adAccounts"
  | "media"
  | "digital"
  | "ai"
  | "affiliates"
  | "giftCards"
  | "loyalty"
  | "storeCredit"
  | "subscriptions"
  | "services"
  | "referrals"
  | "shoppableImages"
  | "courses"
  | "storeSettings"
  | "apps"
  | "activity";

/** Group headings. Separate from NavKey so a group and an item may share a name. */
export type NavGroupKey = "orders" | "products" | "customers" | "marketing" | "store" | "money" | "more";

/**
 * Which queue of work a row's badge counts (components/WorkCounts.tsx):
 * calls due now, confirmed orders with no courier booked, unread messages.
 */
export type NavBadge = "toConfirm" | "toShip" | "unread";

export interface NavItem {
  /** Key into NAV_LABELS — the visible label is resolved per locale. */
  key: NavKey;
  to: string;
  icon: Icon;
  /**
   * Role keys that don't see this entry: the system roles the backend refuses
   * for the page's API (the page still handles a 403 for any other role).
   * Entries without it are shown to everyone, as before.
   */
  hiddenForRoles?: ReadonlySet<string>;
  /**
   * The sidebar entry (its `to`) this page is reached from: a tab, a card or a
   * header link on that page. An item with `under` is not listed in the
   * sidebar — that entry lights up instead — but it stays here so the
   * breadcrumb, ⌘K and pinned shortcuts still know the page.
   */
  under?: string;
  /** A count of waiting work shown on the row (see NavBadge). */
  badge?: NavBadge;
}

export interface NavGroup {
  /** Stable id, used to persist the collapsed state. */
  id: string;
  /** Key into NAV_GROUP_LABELS, or null for an unheaded group. */
  labelKey: NavGroupKey | null;
  items: NavItem[];
}

/**
 * Sidebar structure (docs/ux/REDESIGN_PROMPT.md, Phase 1): seven headings in
 * the order a merchant thinks about the day — the day itself, the orders that
 * came in and what each needs, what is sold, who buys, how more people are
 * brought in, the store they land on, and the money. Other ways to sell start
 * closed; admin and help sit at the bottom.
 *
 * URLs never change here and role rules stay as they were. Every entry must
 * map to a route in App.tsx — the sidebar is not a roadmap.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    labelKey: null,
    items: [{ key: "overview", to: "/", icon: IconHome }],
  },
  {
    id: "orders",
    labelKey: "orders",
    items: [
      { key: "orders", to: "/orders", icon: IconOrders, badge: "toShip" },
      { key: "confirmationQueue", to: "/confirmation-queue", icon: IconConfirm, badge: "toConfirm" },
      { key: "abandonedCarts", to: "/abandoned-carts", icon: IconLostOrders },
      { key: "returns", to: "/returns", icon: IconReturns },
      { key: "fraud", to: "/fraud", icon: IconProtection },
      { key: "quotes", to: "/quotes", icon: IconQuotes },
    ],
  },
  {
    id: "products",
    labelKey: "products",
    items: [
      { key: "catalog", to: "/catalog", icon: IconProducts },
      { key: "inventory", to: "/inventory", icon: IconInventory, hiddenForRoles: NO_INVENTORY_ROLES },
      // Offers, discounts and gift cards become tabs of one hub in Phase 4; until then, three rows.
      { key: "offers", to: "/offers", icon: IconOffers },
      { key: "discounts", to: "/discounts", icon: IconDiscounts, under: "/offers" },
      { key: "giftCards", to: "/gift-cards", icon: IconGiftCards, under: "/offers" },
      { key: "reviews", to: "/reviews", icon: IconReviews },
      { key: "productQuestions", to: "/questions", icon: IconQuestions },
      { key: "sizeCharts", to: "/size-charts", icon: IconSizeCharts, under: "/catalog" },
      { key: "searchSynonyms", to: "/search-synonyms", icon: IconSynonyms, under: "/catalog" },
      { key: "media", to: "/media", icon: IconMedia },
    ],
  },
  {
    id: "customers",
    labelKey: "customers",
    items: [
      { key: "customers", to: "/customers", icon: IconCustomers },
      { key: "inbox", to: "/inbox", icon: IconInbox, badge: "unread" },
      { key: "loyalty", to: "/loyalty", icon: IconLoyalty },
      { key: "storeCredit", to: "/store-credit", icon: IconStoreCredit, under: "/loyalty" },
    ],
  },
  {
    id: "marketing",
    labelKey: "marketing",
    items: [
      { key: "marketing", to: "/marketing", icon: IconMarketing },
      { key: "automations", to: "/automations", icon: IconAutomations },
      { key: "ads", to: "/ads", icon: IconAds, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "adAccounts", to: "/ads/accounts", icon: IconAdAccounts, hiddenForRoles: NO_ANALYTICS_ROLES, under: "/ads" },
      { key: "affiliates", to: "/affiliates", icon: IconAffiliates },
      { key: "ai", to: "/ai", icon: IconAi },
    ],
  },
  {
    id: "store",
    labelKey: "store",
    items: [
      { key: "website", to: "/website", icon: IconWebsite },
      { key: "funnels", to: "/funnels", icon: IconFunnels },
      { key: "blog", to: "/blog", icon: IconBlog },
      { key: "shipping", to: "/shipping", icon: IconShipping },
      { key: "payments", to: "/payments", icon: IconPayments },
      { key: "storeSettings", to: "/store-settings", icon: IconStoreSettings },
    ],
  },
  {
    id: "money",
    labelKey: "money",
    items: [
      { key: "profit", to: "/profit", icon: IconProfit, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "settlements", to: "/settlements", icon: IconSettlements },
      // Handoff 384 / 377: the online payments ledger, payouts and disputes — reached from Payments, found by search.
      { key: "paymentLedger", to: "/payments/transactions", icon: IconSettlements, under: "/payments" },
      // One row for the reports hub; its tabs and the side reports are found by search and light this row up.
      { key: "analytics", to: "/analytics", icon: IconReports, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "storeReports", to: "/analytics/reports", icon: IconMoreReports, hiddenForRoles: NO_ANALYTICS_ROLES, under: "/analytics" },
      { key: "realtime", to: "/analytics/realtime", icon: IconRealtime, hiddenForRoles: NO_ANALYTICS_ROLES, under: "/analytics" },
      { key: "webAnalytics", to: "/analytics/web", icon: IconWebAnalytics, hiddenForRoles: NO_ANALYTICS_ROLES, under: "/analytics" },
      { key: "attribution", to: "/analytics/attribution", icon: IconAttribution, hiddenForRoles: NO_ANALYTICS_ROLES, under: "/analytics" },
      { key: "searchInsights", to: "/analytics/search", icon: IconSearch, hiddenForRoles: NO_ANALYTICS_ROLES, under: "/analytics" },
    ],
  },
  {
    // Ways to sell beyond physical COD products. Few stores use them daily,
    // so the group starts closed; every page is still one ⌘K away.
    id: "more",
    labelKey: "more",
    items: [
      { key: "digital", to: "/digital", icon: IconDigital },
      { key: "courses", to: "/courses", icon: IconCourses },
      { key: "subscriptions", to: "/subscriptions", icon: IconSubscriptions },
      { key: "shoppableImages", to: "/shoppable-images", icon: IconShoppableImages },
      { key: "services", to: "/services", icon: IconServices },
    ],
  },
  {
    id: "config",
    labelKey: null,
    items: [
      { key: "apps", to: "/apps", icon: IconApps },
      { key: "settings", to: "/settings", icon: IconSettings },
      // Reached from Settings (its «كمان» row), not from the sidebar.
      { key: "activity", to: "/activity", icon: IconActivity, under: "/settings" },
      { key: "referrals", to: "/referrals", icon: IconReferrals, under: "/settings" },
      { key: "support", to: "/support", icon: IconSupport },
    ],
  },
];

/** Groups that start open. The rest start closed and still show the page you are on. */
export const NAV_OPEN_BY_DEFAULT: ReadonlySet<string> = new Set(["main", "orders", "products", "customers", "marketing", "store", "money", "config"]);

/** The group an item sits in — the first crumb of the page's breadcrumb. */
export function findNavGroup(item: NavItem): NavGroup | undefined {
  return NAV_GROUPS.find((group) => group.items.includes(item));
}

/** Whether an item has its own line in the sidebar (see NavItem.under). */
export function isSidebarItem(item: NavItem): boolean {
  return !item.under;
}

/** The sidebar entry that lights up for an item: itself, or the entry it sits under. */
export function sidebarHome(item: NavItem | undefined): string | undefined {
  return item ? (item.under ?? item.to) : undefined;
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
    overview: "Today",
    orders: "Orders",
    confirmationQueue: "Confirm orders",
    fraud: "Protection",
    returns: "Returns",
    quotes: "Quotes",
    abandonedCarts: "Lost orders",
    catalog: "Products",
    inventory: "Inventory",
    reviews: "Reviews",
    productQuestions: "Questions",
    sizeCharts: "Size charts",
    searchSynonyms: "Search synonyms",
    searchInsights: "Store search",
    customers: "Customers",
    discounts: "Discounts",
    offers: "Offers & discounts",
    shipping: "Shipping",
    payments: "Payments",
    website: "Store editor",
    blog: "Blog",
    funnels: "Funnels",
    analytics: "Reports",
    storeReports: "More reports",
    webAnalytics: "Store traffic",
    attribution: "Sales sources",
    realtime: "Live now",
    apps: "Apps",
    activity: "Activity log",
    settings: "Settings",
    support: "Contact support",
    settlements: "COD settlements",
    paymentLedger: "Online payments: transactions, payouts, disputes",
    inbox: "Messages",
    automations: "Automations",
    marketing: "Campaigns",
    profit: "Profit",
    ads: "Ads",
    adAccounts: "Ad accounts",
    media: "Media library",
    digital: "Digital products",
    ai: "AI studio",
    affiliates: "Affiliates",
    giftCards: "Gift cards",
    loyalty: "Loyalty & rewards",
    storeCredit: "Store credit balances",
    subscriptions: "Subscriptions",
    services: "Services",
    referrals: "Refer & earn",
    shoppableImages: "Shoppable images",
    courses: "Courses",
    storeSettings: "Store settings",
  },
  ar: {
    overview: "اليوم",
    orders: "الأوردرات",
    confirmationQueue: "تأكيد الأوردرات",
    fraud: "الحماية",
    returns: "المرتجعات",
    quotes: "عروض الأسعار",
    abandonedCarts: "الأوردرات المفقودة",
    catalog: "المنتجات",
    inventory: "المخزون",
    reviews: "التقييمات",
    productQuestions: "الأسئلة",
    sizeCharts: "جداول المقاسات",
    searchSynonyms: "مرادفات البحث",
    searchInsights: "البحث في المتجر",
    customers: "العملاء",
    discounts: "الخصومات",
    offers: "العروض والخصومات",
    shipping: "الشحن",
    payments: "المدفوعات",
    website: "محرر المتجر",
    blog: "المدونة",
    funnels: "مسارات البيع",
    analytics: "التقارير",
    storeReports: "تقارير تانية",
    webAnalytics: "زيارات الموقع",
    attribution: "مصادر المبيعات",
    realtime: "دلوقتي",
    apps: "التطبيقات",
    activity: "سجل النشاط",
    settings: "الإعدادات",
    support: "تواصل مع الدعم",
    settlements: "تحصيل شركات الشحن",
    paymentLedger: "المدفوعات الأونلاين: المعاملات والتحويلات البنكية والنزاعات",
    inbox: "الرسايل",
    automations: "الأتمتة",
    marketing: "الحملات",
    profit: "الأرباح",
    ads: "الإعلانات",
    adAccounts: "حسابات الإعلانات",
    media: "مكتبة الصور",
    digital: "المنتجات الرقمية",
    ai: "استوديو الذكاء الاصطناعي",
    affiliates: "المسوّقون بالعمولة",
    giftCards: "كروت الهدايا",
    loyalty: "الولاء والمكافآت",
    storeCredit: "أرصدة العملاء",
    subscriptions: "الاشتراكات",
    services: "الخدمات",
    referrals: "اكسب من الإحالة",
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
    store: "Store",
    money: "Money & reports",
    more: "More ways to sell",
  },
  ar: {
    orders: "الأوردرات",
    products: "المنتجات",
    customers: "العملاء",
    marketing: "التسويق",
    store: "المتجر",
    money: "الفلوس والتقارير",
    more: "طرق بيع أكتر",
  },
} satisfies Messages<NavGroupKey>;

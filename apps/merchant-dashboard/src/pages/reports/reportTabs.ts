import {
  IconAnnounce,
  IconCash,
  IconCourier,
  IconCustomers,
  IconProducts,
  IconRealtime,
  IconStore,
  type IconComponent,
} from "@/components/icons";
import type { Messages } from "@/i18n/LocaleContext";

/**
 * The seven tabs of the reports hub (ReportsHubPage.tsx), each named after the
 * question it answers. The first one lives at the hub's own address; the
 * others one segment below it. The page shows the tab its address names, so a
 * tab can be linked to, bookmarked and reached with Back.
 */
export type ReportTabKey = "sales" | "journey" | "ads" | "products" | "customers" | "store" | "now";

export interface ReportTabEntry {
  key: ReportTabKey;
  path: string;
  icon: IconComponent;
}

/** The hub's own address, and the first tab's. */
export const REPORTS_HUB_PATH = "/analytics";

/** Where each tab lives. To link to a tab and keep the range, add the current `location.search`. */
export const REPORT_TAB_PATHS: Record<ReportTabKey, string> = {
  // Our Reports page keeps its tabs on one address, so every way back lands on it.
  sales: REPORTS_HUB_PATH,
  journey: REPORTS_HUB_PATH,
  ads: REPORTS_HUB_PATH,
  products: REPORTS_HUB_PATH,
  customers: REPORTS_HUB_PATH,
  store: REPORTS_HUB_PATH,
  now: REPORTS_HUB_PATH,
};

/** The tabs in the order of the bar. */
export const REPORT_TABS: ReportTabEntry[] = [
  { key: "sales", path: REPORT_TAB_PATHS.sales, icon: IconCash },
  { key: "journey", path: REPORT_TAB_PATHS.journey, icon: IconCourier },
  { key: "ads", path: REPORT_TAB_PATHS.ads, icon: IconAnnounce },
  { key: "products", path: REPORT_TAB_PATHS.products, icon: IconProducts },
  { key: "customers", path: REPORT_TAB_PATHS.customers, icon: IconCustomers },
  { key: "store", path: REPORT_TAB_PATHS.store, icon: IconStore },
  { key: "now", path: REPORT_TAB_PATHS.now, icon: IconRealtime },
];

/** The name on each tab. Read with `useT(REPORT_TAB_LABELS)`. */
export const REPORT_TAB_LABELS = {
  en: {
    sales: "Sales & profit",
    journey: "Order journey",
    ads: "Ads",
    products: "Products",
    customers: "Customers",
    store: "Store",
    now: "Right now",
  },
  ar: {
    sales: "المبيعات والربح",
    journey: "رحلة الطلب",
    ads: "الإعلانات",
    products: "المنتجات",
    customers: "العملاء",
    store: "المتجر",
    now: "الآن",
  },
} satisfies Messages<ReportTabKey>;

/** The question each tab answers — its heading (`<ReportTab question={…}>`). Read with `useT(REPORT_TAB_QUESTIONS)`. */
export const REPORT_TAB_QUESTIONS = {
  en: {
    sales: "How much did I really make?",
    journey: "Where am I losing orders?",
    ads: "Which campaign makes money?",
    products: "What sells and what comes back?",
    customers: "Who buys again?",
    store: "Who visits, and where do they leave?",
    now: "What is happening this minute?",
  },
  ar: {
    sales: "كم ربحت فعلًا؟",
    journey: "أين تضيع طلباتي؟",
    ads: "أي حملة تربح؟",
    products: "ما الذي يُباع وما الذي يُرجَع؟",
    customers: "من يشتري مرة أخرى؟",
    store: "من يزور ومن أين يغادر؟",
    now: "ماذا يحدث في هذه الدقيقة؟",
  },
} satisfies Messages<ReportTabKey>;

/**
 * The tab a pathname shows: `/analytics` → sales, `/analytics/ads` → ads (and
 * anything below it, `/analytics/ads/…`). An address the hub does not know
 * shows the first tab.
 */
export function reportTabFromPath(pathname: string): ReportTabKey {
  const path = pathname.replace(/\/+$/, "");
  let found: ReportTabKey = "sales";
  for (const tab of REPORT_TABS) {
    if (tab.path === REPORTS_HUB_PATH) continue;
    if (path === tab.path || path.startsWith(`${tab.path}/`)) found = tab.key;
  }
  return found;
}

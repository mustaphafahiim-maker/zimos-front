import type { Messages } from "@/i18n/LocaleContext";

/**
 * Wording shared by the store reports (handoff 238–242, 245–247, 256, 293):
 * the date range, the CSV button, the list of reports and the few column
 * names several of them use. Each report keeps its own strings beside it.
 */
export const STORE_REPORT_STRINGS = {
  en: {
    back: "Reports",
    moreReports: "More reports",
    moreReportsHint: "Tax, stock and sales, each with a CSV file for your accountant or your supplier.",
    allReports: "All the side reports",
    groupMoney: "Money",
    groupOrders: "Orders",
    groupStock: "Products and stock",
    groupCustomers: "Customers",
    showPeriod: "Show {period}",

    tax: "Tax report",
    taxHint: "Tax collected, refunded and net, month by month and by governorate.",
    orderTimes: "When orders come in",
    orderTimesHint: "The days and hours your orders arrive, for calls and campaigns.",
    collections: "Sales by collection",
    collectionsHint: "Which collections sell, and what was actually delivered.",
    options: "Sales by size and colour",
    optionsHint: "How many of each size and colour sold, for your next supplier order.",
    returns: "Returns",
    returnsHint: "Why orders come back, and the products that come back most.",
    inventoryValue: "Inventory value",
    inventoryValueHint: "What the stock on your shelves is worth at cost.",
    slowStock: "Slow-moving stock",
    slowStockHint: "Products that have not sold for a while, and the money tied up in them.",
    cartOffers: "Cart offers & gifts",
    cartOffersHint: "What each cart offer and free gift brought.",

    downloadCsv: "Download CSV",
    downloading: "Preparing the file…",
    csvFailed: "The file could not be prepared. Try again.",

    rangeLabel: "Date range",
    today: "Today",
    yesterday: "Yesterday",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    month: "This month",
    lastMonth: "Last month",
    "12m": "Last 12 months",
    custom: "Custom dates",
    from: "From",
    to: "To",
    rangeInvalid: "The start date is after the end date. Pick a start on or before the end.",

    product: "Product",
    orders: "Orders",
    units: "Units",
    revenue: "Revenue",
    openProduct: "Open product",
    scheduleSale: "Schedule a sale",
    ordersCount_one: "1 order",
    ordersCount_other: "{n} orders",
    productsCount_one: "1 product",
    productsCount_other: "{n} products",
    showAll: "Show all {n}",
    noCostBadge: "No cost",
    noCost_one: "1 product has no cost — not counted",
    noCost_other: "{n} products have no cost — not counted",
    storeTime: "Times follow the store's time zone ({zone}).",
  },
  ar: {
    back: "التقارير",
    moreReports: "تقارير تانية",
    moreReportsHint: "الضريبة والمخزون والمبيعات، وكل تقرير ينزل ملف CSV للمحاسب أو للمورّد.",
    allReports: "كل التقارير التانية",
    groupMoney: "الفلوس",
    groupOrders: "الأوردرات",
    groupStock: "المنتجات والمخزون",
    groupCustomers: "العملاء",
    showPeriod: "اعرض {period}",

    tax: "تقرير الضريبة",
    taxHint: "الضريبة المحصّلة والمرتجع والصافي، شهر بشهر ومحافظة بمحافظة.",
    orderTimes: "أوقات الأوردرات",
    orderTimesHint: "الأيام والساعات اللي الأوردرات بتيجي فيها، عشان المكالمات والحملات.",
    collections: "المبيعات حسب المجموعة",
    collectionsHint: "أنهي مجموعة بتبيع، وإيه اللي اتسلّم فعلًا.",
    options: "المبيعات حسب المقاس واللون",
    optionsHint: "اتباع كام من كل مقاس ولون، عشان طلبيتك الجاية من المورّد.",
    returns: "المرتجعات",
    returnsHint: "الأوردرات بترجع ليه، وأكتر منتجات بترجع.",
    inventoryValue: "قيمة المخزون",
    inventoryValueHint: "البضاعة اللي على الرف تساوي كام بسعر التكلفة.",
    slowStock: "البضاعة الراكدة",
    slowStockHint: "منتجات بقالها فترة مش بتتباع، والفلوس المحبوسة فيها.",
    cartOffers: "عروض السلة والهدايا",
    cartOffersHint: "كل عرض سلة وكل هدية جابوا إيه.",

    downloadCsv: "نزّل CSV",
    downloading: "بنجهّز الملف…",
    csvFailed: "معرفناش نجهّز الملف. جرّب تاني.",

    rangeLabel: "الفترة",
    today: "النهارده",
    yesterday: "إمبارح",
    "7d": "آخر ٧ أيام",
    "30d": "آخر ٣٠ يوم",
    "90d": "آخر ٩٠ يوم",
    month: "الشهر ده",
    lastMonth: "الشهر اللي فات",
    "12m": "آخر ١٢ شهر",
    custom: "تواريخ محددة",
    from: "من",
    to: "إلى",
    rangeInvalid: "تاريخ البداية بعد تاريخ النهاية. اختار بداية قبل النهاية أو في نفس يومها.",

    product: "المنتج",
    orders: "أوردرات",
    units: "قطع",
    revenue: "مبيعات",
    openProduct: "اعرض المنتج",
    scheduleSale: "اعمل تخفيض مجدول",
    ordersCount_zero: "مفيش أوردرات",
    ordersCount_one: "أوردر واحد",
    ordersCount_two: "أوردرين",
    ordersCount_few: "{n} أوردرات",
    ordersCount_other: "{n} أوردر",
    productsCount_one: "منتج واحد",
    productsCount_two: "منتجين",
    productsCount_few: "{n} منتجات",
    productsCount_other: "{n} منتج",
    showAll: "اعرض الكل ({n})",
    noCostBadge: "من غير تكلفة",
    noCost_one: "منتج واحد من غير سعر تكلفة — مش داخل في الحساب",
    noCost_two: "منتجين من غير سعر تكلفة — مش داخلين في الحساب",
    noCost_few: "{n} منتجات من غير سعر تكلفة — مش داخلين في الحساب",
    noCost_other: "{n} منتج من غير سعر تكلفة — مش داخلين في الحساب",
    storeTime: "الأوقات بتوقيت المتجر ({zone}).",
  },
} satisfies Messages;

export type StoreReportStrings = (typeof STORE_REPORT_STRINGS)["en"];

/** The reports in the order the list shows them: each one's address under /analytics/reports and its name key. */
export const STORE_REPORT_ROUTES = [
  { slug: "tax", key: "tax" },
  { slug: "order-times", key: "orderTimes" },
  { slug: "sales-by-collection", key: "collections" },
  { slug: "sales-by-option", key: "options" },
  { slug: "returns", key: "returns" },
  { slug: "inventory-value", key: "inventoryValue" },
  { slug: "slow-stock", key: "slowStock" },
  { slug: "cart-offers", key: "cartOffers" },
] as const;

export type StoreReportSlug = (typeof STORE_REPORT_ROUTES)[number]["slug"];
export type StoreReportKey = (typeof STORE_REPORT_ROUTES)[number]["key"];

/** The page that lists them; the same list also closes the Reports page. */
export const STORE_REPORTS_INDEX = "/analytics/reports";

export const storeReportPath = (slug: StoreReportSlug) => `${STORE_REPORTS_INDEX}/${slug}`;

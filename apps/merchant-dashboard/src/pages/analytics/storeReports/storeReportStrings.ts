import type { Messages } from "@/i18n/LocaleContext";

/**
 * Wording shared by the store reports:
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
    moreReports: "تقارير أخرى",
    moreReportsHint: "الضريبة والمخزون والمبيعات، ولكل تقرير ملف CSV للمحاسب أو للمورّد.",
    allReports: "كل التقارير الأخرى",
    groupMoney: "المالية",
    groupOrders: "الطلبات",
    groupStock: "المنتجات والمخزون",
    groupCustomers: "العملاء",
    showPeriod: "عرض {period}",

    tax: "تقرير الضريبة",
    taxHint: "الضريبة المحصّلة والمستردّة والصافي، شهرًا بشهر ومحافظة بمحافظة.",
    orderTimes: "أوقات الطلبات",
    orderTimesHint: "الأيام والساعات التي تصل فيها الطلبات، لتخطيط المكالمات والحملات.",
    collections: "المبيعات حسب المجموعة",
    collectionsHint: "المجموعات الأكثر مبيعًا، وما تم تسليمه فعلًا.",
    options: "المبيعات حسب المقاس واللون",
    optionsHint: "عدد ما بيع من كل مقاس ولون، لطلبيتك القادمة من المورّد.",
    returns: "المرتجعات",
    returnsHint: "أسباب إرجاع الطلبات، والمنتجات الأكثر إرجاعًا.",
    inventoryValue: "قيمة المخزون",
    inventoryValueHint: "قيمة البضاعة الموجودة بسعر التكلفة.",
    slowStock: "البضاعة الراكدة",
    slowStockHint: "منتجات لم تُبع منذ فترة، والمبالغ المجمّدة فيها.",

    downloadCsv: "تنزيل CSV",
    downloading: "جارٍ تجهيز الملف…",
    csvFailed: "تعذّر تجهيز الملف. حاول مرة أخرى.",

    rangeLabel: "الفترة",
    today: "اليوم",
    yesterday: "أمس",
    "7d": "آخر ٧ أيام",
    "30d": "آخر ٣٠ يومًا",
    "90d": "آخر ٩٠ يومًا",
    month: "هذا الشهر",
    lastMonth: "الشهر الماضي",
    "12m": "آخر ١٢ شهرًا",
    custom: "تواريخ محددة",
    from: "من",
    to: "إلى",
    rangeInvalid: "تاريخ البداية بعد تاريخ النهاية. اختر بداية قبل النهاية أو في اليوم نفسه.",

    product: "المنتج",
    orders: "طلبات",
    units: "قطع",
    revenue: "مبيعات",
    openProduct: "عرض المنتج",
    ordersCount_zero: "لا توجد طلبات",
    ordersCount_one: "طلب واحد",
    ordersCount_two: "طلبان",
    ordersCount_few: "{n} طلبات",
    ordersCount_other: "{n} طلبًا",
    productsCount_one: "منتج واحد",
    productsCount_two: "منتجان",
    productsCount_few: "{n} منتجات",
    productsCount_other: "{n} منتجًا",
    showAll: "عرض الكل ({n})",
    noCostBadge: "بدون تكلفة",
    noCost_one: "منتج واحد بدون سعر تكلفة، غير داخل في الحساب",
    noCost_two: "منتجان بدون سعر تكلفة، غير داخلين في الحساب",
    noCost_few: "{n} منتجات بدون سعر تكلفة، غير داخلة في الحساب",
    noCost_other: "{n} منتجًا بدون سعر تكلفة، غير داخلة في الحساب",
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
] as const;

export type StoreReportSlug = (typeof STORE_REPORT_ROUTES)[number]["slug"];
export type StoreReportKey = (typeof STORE_REPORT_ROUTES)[number]["key"];

/** The page that lists them; the same list also closes the Reports page. */
export const STORE_REPORTS_INDEX = "/analytics/reports";

export const storeReportPath = (slug: StoreReportSlug) => `${STORE_REPORTS_INDEX}/${slug}`;

import type { Messages } from "@/i18n/LocaleContext";

/**
 * Every word of the «العملاء» tab of the reports hub (pages/reports/tabs/CustomersTab.tsx and the
 * parts beside this file). Read with `useT(CUSTOMERS_TAB_STRINGS)`.
 *
 * Counted words keep their forms as `<base>_one / _two / _few / _other` and are read with
 * `pluralOf(t, "<base>", count)`; Arabic lists the forms English does not have.
 */
export const CUSTOMERS_TAB_STRINGS = {
  en: {
    // ---- the KPI strip
    newCustomers: "New customers",
    newHint: "Their first order is in this period",
    returningCustomers: "Returning customers",
    returningHint: "Bought before, and again in this period",
    returningRate: "Returning rate",
    returningRateHint: "Of everyone who bought in this period",
    returningRateWas: "It was {rate} {when}",
    whenPrevious: "in the period before",
    whenYear: "on the same days last year",
    vsYear: "vs the same days last year",
    lifetimeValue: "Average customer value",
    lifetimeHint: "Over the store's whole life · {n} orders per customer",
    lifetimeNone: "Nobody has bought yet",
    compareFailed: "We couldn't load the comparison, so the cards show no change.",
    retry: "Try again",

    // ---- the chart
    chartTitle: "New or returning: who brought the sales?",
    chartNote: "New: their first order ever is in this period. Came back: they had bought from you before.",
    legendNew: "New",
    legendReturning: "Came back",
    rowCustomers: "Customers",
    rowOrders: "Orders",
    rowSales: "Sales",
    chartEmpty: "No orders from customers in this period.",
    chartSummary: "New customers against returning ones: customers, orders and sales",
    segmentTitle: "{metric} — {who}: {value} ({share})",

    // ---- the table
    top: "Top customers",
    topNote: "By sales in this period. Press a name to open the customer.",
    customer: "Customer",
    orders: "Orders",
    ordersHint: "The customer's orders placed in this period",
    delivered: "Delivered",
    deliveredHint: "How many of those orders are delivered so far",
    sales: "Sales",
    salesHint: "The value of the customer's orders in this period",
    unnamed: "No name",
    topEmpty: "No customers bought in this period.",

    // ---- the sentence
    ofTen_one: "one in {ten}",
    ofTen_other: "{n} in {ten}",
    ofTenLess: "fewer than one in {ten}",
    customersCount_one: "{n} customer",
    customersCount_other: "{n} customers",
    sayReturning: "In this period, {share} buyers had bought from you before, and they brought in {sales}",
    sayNoneReturned: "All {buyers} who bought in this period are new, and nobody came back to buy again",
    sayLifetime:
      "Few people bought in this period, but over the store's whole life {share} of your customers bought more than once",
    thenDays: " — and those who come back order again after about {days}, so reach them with an offer before then.",
    thenOfferDays: " — a customer of yours usually comes back after about {days}: send an offer to those who bought before.",
    thenOffer: " — send an offer to those who bought before, to bring them back.",
    thenStop: ".",
    sayThin: "Too few customers so far to say who comes back: it takes at least {min} who bought in the period.",
    actLoyalty: "Loyalty program",
    actGroups: "See your best customers",

    // ---- more detail: cohorts
    cohorts: "Do customers come back? Month by month",
    cohortsBy: "By the month of the first order",
    cohortMonths_one: "{n} month",
    cohortMonths_other: "{n} months",
    cohortsNote:
      "Customers by the month of their first order, and the share that ordered again in each month after it. This table covers the store's last months, not the period picked above.",
    cohort: "First order",
    cohortSize: "Customers",
    cohortSizeHint: "How many had their first order in that month",
    cohortMonth: "Month {n}",
    cohortMonthHint: "The share that ordered again in month {n} after the month of their first order",
    cohortNotYet: "Not reached yet",
    cohortsEmpty: "No customers yet to follow month by month.",

    // ---- more detail: lifetime
    lifetime: "Over the store's whole life",
    lifetimeSummary: "Bought from you so far: {customers}",
    lifetimeNote: "These count every order since the first day, and do not change with the period picked above.",
    lifeCustomers: "Customers who bought from you",
    lifeRepeat: "Bought more than once",
    lifeRepeatRate: "Repeat purchase rate",
    lifeRepeatRateHint: "Of all customers, the share that ordered more than once",
    lifeOrders: "Orders per customer",
    lifeOrdersHint: "On average",
    lifeValue: "Average customer value",
    lifeValueHint: "What one customer has bought for in total, on average",
    lifeSecond: "Time to the second order",
    lifeSecondHint: "On average, for those who came back to buy",
    lifeSecondNone: "Nobody has ordered twice yet",
    lifeSecondSameDay: "The same day",

    // ---- the links
    linkCustomers: "All customers",
    linkCustomersHint: "Everyone who bought from you, with their orders and details",
    linkGroups: "Customer groups",
    linkGroupsHint: "Your best customers, and the ones about to leave",
    linkSegments: "Customer segments",
    linkSegmentsHint: "Saved groups you can send offers to",
    linkSurvey: "Survey results",
    linkSurveyHint: "What customers answered on the thank-you page, for the same period",
    linkLoyalty: "Loyalty program",
    linkLoyaltyHint: "Points and rewards that bring a customer back",
  },
  ar: {
    // ---- the KPI strip
    newCustomers: "عملاء جداد",
    newHint: "أول أوردر ليهم في الفترة دي",
    returningCustomers: "عملاء رجعوا تاني",
    returningHint: "اشتروا قبل كده ورجعوا في الفترة دي",
    returningRate: "نسبة اللي رجعوا",
    returningRateHint: "من كل اللي اشتروا في الفترة دي",
    returningRateWas: "كانت {rate} {when}",
    whenPrevious: "في الفترة اللي قبلها",
    whenYear: "في نفس الأيام السنة اللي فاتت",
    vsYear: "عن نفس الأيام السنة اللي فاتت",
    lifetimeValue: "متوسط قيمة العميل",
    lifetimeHint: "على عمر المتجر كله · {n} أوردر للعميل",
    lifetimeNone: "لسه مفيش حد اشترى",
    compareFailed: "معرفناش نجيب المقارنة، فالكروت من غير نسبة التغيّر.",
    retry: "جرّب تاني",

    // ---- the chart
    chartTitle: "جداد ولا راجعين: مين جاب المبيعات؟",
    chartNote: "جديد: أول أوردر ليه في الفترة دي. رجع تاني: اشترى منك قبل كده.",
    legendNew: "جداد",
    legendReturning: "رجعوا تاني",
    rowCustomers: "العملاء",
    rowOrders: "الأوردرات",
    rowSales: "المبيعات",
    chartEmpty: "مفيش أوردرات من عملاء في الفترة دي.",
    chartSummary: "العملاء الجداد قصاد اللي رجعوا تاني: في عدد العملاء والأوردرات والمبيعات",
    segmentTitle: "{metric} — {who}: {value} ({share})",

    // ---- the table
    top: "أكتر العملاء شراءً",
    topNote: "بالمبيعات في الفترة دي. دوس على اسم العميل تفتح صفحته.",
    customer: "العميل",
    orders: "الأوردرات",
    ordersHint: "أوردرات العميل اللي اتطلبت في الفترة دي",
    delivered: "اتسلّم",
    deliveredHint: "اللي اتسلّم من أوردراته دي لحد دلوقتي",
    sales: "المبيعات",
    salesHint: "قيمة أوردرات العميل في الفترة دي",
    unnamed: "من غير اسم",
    topEmpty: "مفيش عملاء اشتروا في الفترة دي.",

    // ---- the sentence
    ofTen_one: "واحد من كل {ten}",
    ofTen_two: "اتنين من كل {ten}",
    ofTen_other: "{n} من كل {ten}",
    ofTenLess: "أقل من واحد من كل {ten}",
    customersCount_one: "عميل واحد",
    customersCount_two: "عميلين",
    customersCount_few: "{n} عملاء",
    customersCount_other: "{n} عميل",
    sayReturning: "{share} من اللي اشتروا في الفترة دي عملاء رجعوا تاني، وجابوا {sales}",
    sayNoneReturned: "كل اللي اشتروا في الفترة دي ({buyers}) عملاء جداد، ومفيش حد رجع يشتري تاني",
    sayLifetime: "قليلين اللي اشتروا في الفترة دي، بس على عمر المتجر كله {share} من عملائك اشتروا أكتر من مرة",
    thenDays: " — واللي بيرجع بيطلب تاني بعد {days} في المتوسط، كلّمه بعرض قبلها.",
    thenOfferDays: " — العميل عندك بيرجع في العادي بعد {days}: ابعت عرض للّي اشتروا قبل كده.",
    thenOffer: " — ابعت للّي اشتروا قبل كده عرض يرجّعهم.",
    thenStop: ".",
    sayThin: "لسه العملاء قليلين ومنقدرش نقول مين بيرجع يشتري: محتاجين على الأقل {min} اشتروا في الفترة.",
    actLoyalty: "برنامج الولاء",
    actGroups: "شوف أحسن عملائك",

    // ---- more detail: cohorts
    cohorts: "العملاء بيرجعوا؟ شهر بشهر",
    cohortsBy: "حسب شهر أول أوردر",
    cohortMonths_one: "شهر واحد",
    cohortMonths_two: "شهرين",
    cohortMonths_few: "{n} شهور",
    cohortMonths_other: "{n} شهر",
    cohortsNote:
      "العملاء حسب شهر أول أوردر، ونسبة اللي طلبوا تاني في كل شهر بعده. الجدول ده عن آخر شهور المتجر، مش عن الفترة اللي فوق.",
    cohort: "أول أوردر",
    cohortSize: "العملاء",
    cohortSizeHint: "عدد اللي أول أوردر ليهم كان في الشهر ده",
    cohortMonth: "الشهر {n}",
    cohortMonthHint: "نسبة اللي طلبوا تاني في الشهر رقم {n} بعد شهر أول أوردر",
    cohortNotYet: "لسه مجاش وقته",
    cohortsEmpty: "لسه مفيش عملاء نتابعهم شهر بشهر.",

    // ---- more detail: lifetime
    lifetime: "أرقام على عمر المتجر كله",
    lifetimeSummary: "اللي اشتروا منك لحد دلوقتي: {customers}",
    lifetimeNote: "الأرقام دي على كل الأوردرات من أول يوم، ومش بتتغيّر بالفترة اللي فوق.",
    lifeCustomers: "عملاء اشتروا منك",
    lifeRepeat: "اشتروا أكتر من مرة",
    lifeRepeatRate: "نسبة تكرار الشراء",
    lifeRepeatRateHint: "من كل العملاء، نسبة اللي طلبوا أكتر من مرة",
    lifeOrders: "الأوردرات للعميل",
    lifeOrdersHint: "في المتوسط",
    lifeValue: "متوسط قيمة العميل",
    lifeValueHint: "اللي العميل الواحد اشترى بيه في المتوسط",
    lifeSecond: "الوقت لحد الأوردر التاني",
    lifeSecondHint: "في المتوسط، للّي رجعوا يشتروا",
    lifeSecondNone: "لسه مفيش حد طلب مرتين",
    lifeSecondSameDay: "في نفس اليوم",

    // ---- the links
    linkCustomers: "كل العملاء",
    linkCustomersHint: "كل اللي اشتروا منك، بأوردراتهم وبياناتهم",
    linkGroups: "تقسيم العملاء",
    linkGroupsHint: "أحسن عملائك، واللي قربوا يسيبوك",
    linkSegments: "شرائح العملاء",
    linkSegmentsHint: "مجموعات محفوظة تبعتلها عروض",
    linkSurvey: "نتائج الاستبيان",
    linkSurveyHint: "إجابات العملاء على استبيان صفحة الشكر، في نفس الفترة",
    linkLoyalty: "برنامج الولاء",
    linkLoyaltyHint: "نقط ومكافآت ترجّع العميل يشتري تاني",
  },
} satisfies Messages;

/** The tab's strings in the viewer's language, as `useT(CUSTOMERS_TAB_STRINGS)` returns them. */
export type CustomersTabStrings = Record<keyof (typeof CUSTOMERS_TAB_STRINGS)["en"], string>;

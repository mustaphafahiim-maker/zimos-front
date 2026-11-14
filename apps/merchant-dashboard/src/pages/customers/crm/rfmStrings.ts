import type { RfmLabel } from "@store-builder/api-client";
import type { Messages } from "@/i18n/LocaleContext";

/**
 * RFM customer groups: the nine groups' names and what each one
 * means, the «تقسيم العملاء» tab, the «المجموعة» filter and the customer
 * page's card. Arabic is formal, as the rest of the dashboard.
 */
export const RFM_STRINGS = {
  en: {
    // groups
    label_champions: "Champions",
    label_cant_lose: "Can't lose them",
    label_at_risk: "At risk",
    label_loyal: "Loyal",
    label_new: "New",
    label_potential: "Promising",
    label_lost: "Lost",
    label_hibernating: "Hibernating",
    label_need_attention: "Need attention",
    help_champions: "Bought a lot, recently",
    help_cant_lose: "Big buyers who have gone quiet",
    help_at_risk: "Bought several times, but not lately",
    help_loyal: "Buy again and again",
    help_new: "Their first order was recent",
    help_potential: "Bought two or three times, recently",
    help_lost: "Bought once or twice, long ago",
    help_hibernating: "Few orders, and none for a while",
    help_need_attention: "In the middle — worth a nudge",
    // groups tab
    intro: "Customers with at least one delivered order, grouped by how recently they bought, how often and how much they spent — compared with your own customers.",
    introNote: "These groups are for looking and for your own work — a call, a VIP tier. Nothing here sends messages.",
    scored_one: "1 customer scored",
    scored_other: "{n} customers scored",
    updated: "Worked out {when}",
    customers_one: "1 customer",
    customers_other: "{n} customers",
    spent: "Spent",
    avgOrders: "Orders each",
    open: "See the customers in “{label}”",
    emptyTitle: "No groups yet",
    emptyHint: "Customers are grouped once their first order is delivered.",
    // filter and list
    groupFilter: "Group",
    anyGroup: "Everyone",
    sortLabel: "Sort by",
    sort_spent: "Spent most",
    sort_recent: "Bought most recently",
    sort_orders: "Most orders",
    listHint: "A group lists customers with a delivered order only, so the search and the other filters don't apply to it.",
    showEveryone: "Show everyone",
    allGroups: "All groups",
    colCustomer: "Customer",
    colGroup: "Group",
    colScores: "Scores",
    colOrders: "Delivered orders",
    colSpent: "Spent",
    colLastOrder: "Last order",
    noName: "Customer without a name",
    scoresLegend: "R: how recently they bought · F: how often · M: how much they spent — from 1 (lowest) to 5 (highest) among your customers.",
    listEmpty: "No customers in this group right now",
    // customer page card
    cardTitle: "Customer group",
    recency: "Bought recently",
    frequency: "Buys often",
    money: "Spends",
    scoreOf: "{n} of 5",
    seeGroup: "See the whole group",
  },
  ar: {
    label_champions: "الأبطال",
    label_cant_lose: "لا يجوز خسارتهم",
    label_at_risk: "في خطر",
    label_loyal: "الأوفياء",
    label_new: "الجدد",
    label_potential: "الواعدون",
    label_lost: "المفقودون",
    label_hibernating: "الخاملون",
    label_need_attention: "يحتاجون إلى اهتمام",
    help_champions: "اشتروا كثيرًا ومؤخرًا",
    help_cant_lose: "كانوا يشترون كثيرًا ثم توقفوا منذ فترة",
    help_at_risk: "اشتروا عدة مرات، لكن ليس مؤخرًا",
    help_loyal: "يعودون للشراء مرة بعد مرة",
    help_new: "أول طلب لهم كان قريبًا",
    help_potential: "اشتروا مرتين أو ثلاثًا مؤخرًا",
    help_lost: "اشتروا مرة أو مرتين منذ زمن",
    help_hibernating: "طلباتهم قليلة ولم يشتروا منذ فترة",
    help_need_attention: "في الوسط، ويحتاجون إلى تذكير",
    intro: "العملاء الذين استلموا طلبًا واحدًا على الأقل، مقسّمون بحسب حداثة شرائهم وعدد مراته وما أنفقوه، مقارنةً بعملائك أنت.",
    introNote: "هذه المجموعات للاطلاع والعمل عليها بنفسك، كمكالمة أو مستوى VIP. لا شيء هنا يرسل رسائل.",
    scored_one: "عميل واحد مقيَّم",
    scored_two: "عميلان مقيَّمان",
    scored_few: "{n} عملاء مقيَّمين",
    scored_other: "{n} عميلًا مقيَّمًا",
    updated: "حُسبت {when}",
    customers_zero: "لا يوجد عملاء",
    customers_one: "عميل واحد",
    customers_two: "عميلان",
    customers_few: "{n} عملاء",
    customers_other: "{n} عميلًا",
    spent: "أنفقوا",
    avgOrders: "طلبات لكل عميل",
    open: "عرض عملاء «{label}»",
    emptyTitle: "لا توجد مجموعات بعد",
    emptyHint: "يُقسَّم العملاء فور تسليم أول طلب لهم.",
    groupFilter: "المجموعة",
    anyGroup: "كل العملاء",
    sortLabel: "الترتيب",
    sort_spent: "الأكثر إنفاقًا",
    sort_recent: "الأحدث شراءً",
    sort_orders: "الأكثر طلبات",
    listHint: "تعرض المجموعة العملاء الذين استلموا طلبًا فقط، لذلك لا يعمل عليها البحث وباقي عوامل التصفية.",
    showEveryone: "عرض كل العملاء",
    allGroups: "كل المجموعات",
    colCustomer: "العميل",
    colGroup: "المجموعة",
    colScores: "الدرجات",
    colOrders: "طلبات مسلَّمة",
    colSpent: "أنفق",
    colLastOrder: "آخر طلب",
    noName: "عميل بدون اسم",
    scoresLegend: "R: حداثة الشراء · F: عدد مرات الشراء · M: ما أنفقه، من ١ (الأقل) إلى ٥ (الأعلى) بين عملائك.",
    listEmpty: "لا يوجد عملاء في هذه المجموعة الآن",
    cardTitle: "مجموعة العميل",
    recency: "حداثة الشراء",
    frequency: "تكرار الشراء",
    money: "الإنفاق",
    scoreOf: "{n} من ٥",
    seeGroup: "عرض كل المجموعة",
  },
} satisfies Messages;

export type RfmStrings = Record<keyof (typeof RFM_STRINGS)["en"], string>;

/** A group's badge colour: how good or how urgent it is. The name always says it too. */
export const RFM_TONE: Record<RfmLabel, "neutral" | "info" | "success" | "warning" | "danger"> = {
  champions: "success",
  loyal: "success",
  new: "info",
  potential: "info",
  need_attention: "warning",
  at_risk: "warning",
  cant_lose: "danger",
  hibernating: "neutral",
  lost: "neutral",
};

export function rfmLabelName(t: RfmStrings, label: RfmLabel): string {
  return t[`label_${label}`];
}

export function rfmLabelHelp(t: RfmStrings, label: RfmLabel): string {
  return t[`help_${label}`];
}

import type { RfmLabel } from "@store-builder/api-client";
import type { Messages } from "@/i18n/LocaleContext";

/**
 * RFM customer groups (handoff 237): the nine groups' names and what each one
 * means, the «تقسيم العملاء» tab, the «المجموعة» filter and the customer
 * page's card. Arabic is the merchant's Egyptian, with the handoff's names.
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
    label_champions: "أبطال",
    label_cant_lose: "مينفعش نخسرهم",
    label_at_risk: "في خطر",
    label_loyal: "أوفياء",
    label_new: "جداد",
    label_potential: "واعدين",
    label_lost: "ضاعوا",
    label_hibernating: "نايمين",
    label_need_attention: "محتاجين اهتمام",
    help_champions: "اشتروا كتير ومؤخرًا",
    help_cant_lose: "كانوا بيشتروا كتير وبقالهم فترة ساكتين",
    help_at_risk: "اشتروا كذا مرة، بس مش قريب",
    help_loyal: "بيرجعوا يشتروا تاني وتالت",
    help_new: "أول طلب ليهم كان قريب",
    help_potential: "اشتروا مرتين أو تلاتة قريب",
    help_lost: "اشتروا مرة أو اتنين من زمان",
    help_hibernating: "طلباتهم قليلة ومن فترة مشتروش",
    help_need_attention: "في النص — محتاجين تفتكرهم",
    intro: "العملاء اللي اتسلّملهم طلب واحد على الأقل، متقسّمين على حسب اشتروا قريب قد إيه، كام مرة، وصرفوا قد إيه — بالمقارنة بعملائك إنت.",
    introNote: "المجموعات دي عشان تشوف وتشتغل عليها بنفسك — مكالمة، مستوى VIP. مفيش حاجة هنا بتبعت رسايل.",
    scored_one: "عميل واحد متقيّم",
    scored_two: "عميلين متقيّمين",
    scored_few: "{n} عملاء متقيّمين",
    scored_other: "{n} عميل متقيّم",
    updated: "اتحسبت {when}",
    customers_zero: "مفيش عملاء",
    customers_one: "عميل واحد",
    customers_two: "عميلين",
    customers_few: "{n} عملاء",
    customers_other: "{n} عميل",
    spent: "صرفوا",
    avgOrders: "طلبات لكل عميل",
    open: "شوف عملاء «{label}»",
    emptyTitle: "لسه مفيش مجموعات",
    emptyHint: "العملاء بيتقسّموا أول ما أول طلب ليهم يتسلّم.",
    groupFilter: "المجموعة",
    anyGroup: "كل العملاء",
    sortLabel: "الترتيب",
    sort_spent: "الأكتر صرفًا",
    sort_recent: "الأحدث شراءً",
    sort_orders: "الأكتر طلبات",
    listHint: "المجموعة بتعرض العملاء اللي اتسلّملهم طلب بس، عشان كده البحث وباقي الفلاتر مش بتشتغل عليها.",
    showEveryone: "اعرض كل العملاء",
    allGroups: "كل المجموعات",
    colCustomer: "العميل",
    colGroup: "المجموعة",
    colScores: "الدرجات",
    colOrders: "طلبات اتسلّمت",
    colSpent: "صرف",
    colLastOrder: "آخر طلب",
    noName: "عميل من غير اسم",
    scoresLegend: "R: اشترى قريب قد إيه · F: بيشتري كام مرة · M: صرف قد إيه — من ١ (الأقل) لـ ٥ (الأعلى) وسط عملائك.",
    listEmpty: "مفيش عملاء في المجموعة دي دلوقتي",
    cardTitle: "مجموعة العميل",
    recency: "اشترى قريب",
    frequency: "بيشتري كتير",
    money: "بيصرف",
    scoreOf: "{n} من ٥",
    seeGroup: "شوف كل المجموعة",
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

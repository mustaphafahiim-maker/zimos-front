import { fmt, type Locale, type Messages } from "@/i18n/LocaleContext";
import { formatPercentValue } from "@/lib/format";
import type { UiEdgeCondition } from "../funnelAdapter";

/**
 * The flow map's own words (toolbar, cards, arrows, split-test chip, the
 * empty map). The sentences the editor's tests pin — the offer line, the
 * empty page, the problem count — stay in FunnelEditorPage.strings.ts.
 */
export const MAP_STRINGS = {
  en: {
    // toolbar
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    zoomNow: "Zoom {pct}",
    fit: "Fit to screen",
    tidy: "Tidy the map",
    tidyHint: "Line the steps up in flow order, yes above no.",
    period: "Numbers for",
    legend: "What the lines mean",
    legendYes: "Accepted the offer",
    legendNo: "Refused the offer",
    legendOrder: "Placed the order",
    legendNext: "Next step",
    legendButton: "A button on the page",
    mapHelp: "Arrow keys move between steps. Enter opens the page. Plus and minus zoom, 0 fits the map.",
    // card
    entry: "Start",
    openPage: "Open page",
    openPageOf: "Open the page of {name}",
    addAfter: "Add a step after {name}",
    insertHere: "Add a step between {from} and {to}",
    pickType: "Add which step?",
    close: "Close",
    stepActions: "Step actions",
    menuOpen: "Open the page",
    menuAdd: "Add the next step",
    menuDelete: "Delete the step",
    // numbers
    visits: "visits",
    orders: "orders",
    signups: "sign-ups",
    reach: "reached",
    noVisits: "No visits yet",
    statsOf: "{visits} visits, {reach} of visitors reached this step",
    arrived: "{pct} of the visitors of {from} reached {to}",
    left: "{pct} left",
    // split test
    abRunning: "A/B test",
    abPaused: "Test paused",
    abDone: "Winner live",
    abOpen: "A/B test on {name}",
    abShare: "{pct} of visitors",
    abVisits: "Visits",
    abOrders: "Orders",
    abRate: "Conversion",
    abLeader: "Leading",
    abWinner: "Winner",
    abOriginal: "Original",
    abLoading: "Loading the numbers…",
    abNoNumbers: "The numbers are in “Tests and settings”.",
    abManage: "Pause it, pick the winner or change the shares from “Tests and settings”.",
    abPausedNote: "Paused: visitors see the original page.",
    abDoneNote: "Finished: every visitor sees the winner's page until the test is deleted.",
    // empty map
    emptyTitle: "Start the funnel from a template",
    emptyBody: "Pick the path closest to how you sell. Every step and page can be changed afterwards, and nothing is saved until you press Save.",
    emptyPrimary: "Start with one product, cash on delivery",
    emptyOthers: "Or pick another path",
    emptyBest: "Best to start with",
    orBlank: "Or add the steps one by one from “Add step”.",
  },
  ar: {
    zoomOut: "صغّر",
    zoomIn: "كبّر",
    zoomNow: "التكبير {pct}",
    fit: "على قد الشاشة",
    tidy: "رتّب الخريطة",
    tidyHint: "رصّ الخطوات بترتيب الفانل، و«وافق» فوق «رفض».",
    period: "الأرقام عن",
    legend: "معنى الخطوط",
    legendYes: "وافق على العرض",
    legendNo: "رفض العرض",
    legendOrder: "عمل الأوردر",
    legendNext: "الخطوة اللي بعدها",
    legendButton: "زرار في الصفحة",
    mapHelp: "الأسهم بتنقلك بين الخطوات. Enter بيفتح الصفحة. زائد وناقص للتكبير، و0 على قد الشاشة.",
    entry: "البداية",
    openPage: "افتح الصفحة",
    openPageOf: "افتح صفحة {name}",
    addAfter: "ضيف خطوة بعد {name}",
    insertHere: "ضيف خطوة بين {from} و{to}",
    pickType: "تضيف أنهي خطوة؟",
    close: "اقفل",
    stepActions: "إجراءات الخطوة",
    menuOpen: "افتح الصفحة",
    menuAdd: "ضيف الخطوة اللي بعدها",
    menuDelete: "احذف الخطوة",
    visits: "زيارة",
    orders: "أوردر",
    signups: "اشتراك",
    reach: "وصلوا",
    noVisits: "لسه مفيش زيارات",
    statsOf: "{visits} زيارة، و{reach} من الزوار وصلوا للخطوة دي",
    arrived: "{pct} من زوار «{from}» وصلوا «{to}»",
    left: "{pct} خرجوا",
    abRunning: "اختبار A/B",
    abPaused: "الاختبار واقف",
    abDone: "الفايز شغّال",
    abOpen: "اختبار A/B على {name}",
    abShare: "{pct} من الزوار",
    abVisits: "زيارات",
    abOrders: "أوردرات",
    abRate: "التحويل",
    abLeader: "متقدّمة",
    abWinner: "الفايزة",
    abOriginal: "الأصلية",
    abLoading: "بنجيب الأرقام…",
    abNoNumbers: "الأرقام موجودة في «الاختبارات والإعدادات».",
    abManage: "وقّفه أو اختار الفايزة أو غيّر النسب من «الاختبارات والإعدادات».",
    abPausedNote: "واقف: الزوار بيشوفوا الصفحة الأصلية.",
    abDoneNote: "خلص: كل الزوار بيشوفوا الصفحة الفايزة لحد ما تحذف الاختبار.",
    emptyTitle: "ابدأ الفانل من قالب",
    emptyBody: "اختار أقرب مسار لطريقة بيعك. أي خطوة أو صفحة تقدر تغيّرها بعدين، ومفيش حاجة بتتحفظ غير لما تدوس حفظ.",
    emptyPrimary: "ابدأ بمنتج واحد والدفع عند الاستلام",
    emptyOthers: "أو اختار مسار تاني",
    emptyBest: "الأنسب للبداية",
    orBlank: "أو ضيف الخطوات واحدة واحدة من «إضافة خطوة».",
  },
} satisfies Messages;

/** The short word an arrow carries, per condition. */
export const ARROW_LABELS: Record<Locale, Record<UiEdgeCondition, string>> = {
  en: { always: "Next", completed_checkout: "Ordered", accepted_offer: "Yes", declined_offer: "No", clicked_through: "Button" },
  ar: { always: "بعدها", completed_checkout: "أوردر", accepted_offer: "وافق", declined_offer: "رفض", clicked_through: "زرار" },
};

/** A count in the language's digits. */
export const num = (n: number) => fmt("{n}", { n });

/** 0.684 -> "68%" in the language's digits; "—" when there is nothing to divide. */
export const pct = (ratio: number | null | undefined) => formatPercentValue(ratio, 0);

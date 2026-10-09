import type { FlaggedOrder } from "@store-builder/api-client";
import type { Messages } from "@/i18n/LocaleContext";

/** Every word of the Flagged tab: the tab, its rows and its Quick Look read it through `useT(FLAGGED_STRINGS)`. */
export const FLAGGED_STRINGS = {
  en: {
    scopeLabel: "Which flagged orders to show",
    scopeOpen: "Awaiting a call",
    scopeAll: "All flagged",
    listLabel: "Flagged orders",
    emptyOpen: "No flagged orders are waiting on a call",
    emptyOpenHow: "An order lands here when one of your rules flags it for review.",
    emptyAll: "No orders have been flagged.",
    noName: "Customer without a name",
    reasons: "Why it was flagged",
    cancelled: "Cancelled",
    pass: "Let it through",
    passed: "Flag cleared on {order}. It carries on as a normal order.",
    passHint: "Letting it through only clears the flag: the order carries on as normal. This does not confirm or ship it.",
    block: "Block and cancel",
    blockTitle: "Block and cancel {order}?",
    blockDescription: "The order is cancelled, its phone number is blocked from ordering, and its internet address is blocked from ordering and from seeing your store.",
    blocking: "Blocking…",
    keep: "Keep the order",
    blocked: "{order} was cancelled and its customer blocked.",
    peek: "Preview order {order}",
    menuLabel: "Actions for order {order}",
    menuOpen: "Open the order",
    menuCall: "Call",
    menuWhatsapp: "WhatsApp",
    menuCopyPhone: "Copy the number",
    menuCopyOrder: "Copy the order number",
    copiedPhone: "The customer's number is copied",
    copiedOrder: "The order number is copied",
    openOrder: "Open order {number}",
    colCustomer: "Customer",
    colReasons: "Why it was flagged",
    colTotal: "Total",
    colStatus: "The call",
    colAction: "Decision",
    placed: "Placed {when}",
    total: "Total",
    customer: "Customer",
    noPhone: "No phone number",
    phoneHidden: "Part of the number is hidden. The order's page has the whole number.",
    queueLink: "Open the confirmation queue",
    moreFlags: "+{n}",
  },
  ar: {
    scopeLabel: "أنهي أوردرات مشكوك فيها تظهر",
    scopeOpen: "مستنية مكالمة",
    scopeAll: "كل المشكوك فيها",
    listLabel: "الأوردرات المشكوك فيها",
    emptyOpen: "مفيش أوردرات مشكوك فيها مستنية مكالمة",
    emptyOpenHow: "الأوردر بييجي هنا لما قاعدة من قواعدك تعلّم عليه للمراجعة.",
    emptyAll: "مفيش أوردر اتعلّم عليه.",
    noName: "عميل من غير اسم",
    reasons: "ليه اتعلّم عليه",
    cancelled: "ملغي",
    pass: "سيبه يعدّي",
    passed: "شلنا العلامة من {order}، وهيكمّل أوردر عادي.",
    passHint: "«سيبه يعدّي» بيشيل العلامة بس: الأوردر بيكمّل عادي، ومش بيتأكد ولا بيتشحن من هنا.",
    block: "احجب والغي",
    blockTitle: "تحجب وتلغي {order}؟",
    blockDescription: "الأوردر هيتلغي، ورقم الموبايل هيتحظر من إنه يعمل أوردرات، وعنوان الإنترنت هيتحظر من الأوردرات ومن إنه يشوف متجرك.",
    blocking: "بنحجب…",
    keep: "سيب الأوردر",
    blocked: "{order} اتلغى والعميل بقى في المحظورين.",
    peek: "معاينة الأوردر {order}",
    menuLabel: "إجراءات الأوردر {order}",
    menuOpen: "افتح الأوردر",
    menuCall: "اتصل",
    menuWhatsapp: "واتساب",
    menuCopyPhone: "انسخ الرقم",
    menuCopyOrder: "انسخ رقم الأوردر",
    copiedPhone: "رقم العميل اتنسخ",
    copiedOrder: "رقم الأوردر اتنسخ",
    openOrder: "افتح الأوردر {number}",
    colCustomer: "العميل",
    colReasons: "ليه اتعلّم عليه",
    colTotal: "الإجمالي",
    colStatus: "المكالمة",
    colAction: "القرار",
    placed: "اتطلب {when}",
    total: "الإجمالي",
    customer: "العميل",
    noPhone: "مفيش رقم موبايل",
    phoneHidden: "جزء من الرقم مخفي. الرقم كامل في صفحة الأوردر.",
    queueLink: "افتح قايمة التأكيد",
    moreFlags: "+{n}",
  },
} satisfies Messages;

// The flags that mean "this one has a record": a blocked customer, a high risk level, a customer
// who keeps refusing. Three flags or more on one order count the same.
const HEAVY_FLAGS: ReadonlySet<string> = new Set(["blacklisted_customer", "high_risk", "high_rejection_customer"]);

/**
 * How strongly a flagged row is tinted (glass/returns-protection.css): red for
 * a heavy flag or a pile of them, amber otherwise. A tint only — the reasons
 * themselves are written on the row, so nothing depends on the colour.
 */
export function riskTone(order: FlaggedOrder): "danger" | "warning" {
  return order.riskFlags.length >= 3 || order.riskFlags.some((flag) => HEAVY_FLAGS.has(flag)) ? "danger" : "warning";
}

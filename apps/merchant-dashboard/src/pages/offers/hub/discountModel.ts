import type { Discount, DiscountStatus, DiscountType } from "@store-builder/api-client";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { fmt, type Messages } from "@/i18n/LocaleContext";

/**
 * What the discounts tab says and how it reads a discount: its status as a
 * merchant means it, its value in a few characters, its dates in a line.
 * Shared by the list, the cards, the filter sheet and the form sheet.
 */
export const DISCOUNT_STRINGS = {
  en: {
    // header and list
    create: "New code",
    createFirst: "Create a discount",
    emptyTitle: "No discounts yet",
    emptyHint: "Create a code customers type when they order, or an automatic discount that applies by itself.",
    searchLabel: "Search discounts",
    searchPlaceholder: "Search by code",
    statusLabel: "Discount status",
    all: "All",
    noMatchTitle: "No discount matches",
    noMatchHint: "Try another code, or clear the search and the filters.",
    clearFilters: "Clear search and filters",
    listLabel: "Discounts",
    caption: "Discount codes and automatic discounts",
    code: "Code",
    type: "Type",
    value: "Value",
    status: "Status",
    usage: "Uses",
    dates: "Dates",
    actions: "Actions",
    automatic: "Automatic",
    type_percentage: "Percentage off",
    type_fixed: "Fixed amount off",
    type_free_shipping: "Free shipping",
    type_buy_x_get_y: "Buy X get Y",
    status_active: "Active",
    status_disabled: "Disabled",
    status_archived: "Archived",
    status_scheduled: "Scheduled",
    status_expired: "Expired",
    noDateLimit: "No date limit",
    dateFrom: "From {date}",
    dateUntil: "Until {date}",
    usesOf: "{used} of {limit} used",
    uses: "{used} used",
    freeShippingShort: "Free shipping",
    // row actions
    open: "Edit",
    copyCode: "Copy the code",
    copied: "“{code}” is copied.",
    copyFailed: "We couldn't copy that. Try again.",
    enable: "Turn on",
    disable: "Turn off",
    archive: "Archive…",
    shareLink: "Share link",
    menuLabel: "Actions for {code}",
    moreActions: "More actions for {code}",
    enabledToast: "Discount turned on.",
    disabledToast: "Discount turned off.",
    archivedToast: "Discount archived.",
    archivedCodeToast: "“{code}” archived.",
    archiveTitle: "Archive this discount?",
    archiveTitleCode: "Archive “{code}”?",
    archiveDescription:
      "A discount that has been redeemed is financial history, so it's archived rather than deleted — it stops applying at checkout and drops off active reporting.",
    archiveConfirm: "Archive discount",
    working: "Archiving…",
    cancel: "Cancel",
    // filters
    filterType: "Discount type",
    filterKind: "Code or automatic",
    kind_code: "With a code",
    kind_automatic: "Automatic",
    filterResults: "Results window",
    filterResultsHint: "The days the orders, revenue and discount figures of each code cover.",
    chipType: "Type: {name}",
    chipKind: "Kind: {name}",
    show_one: "Show 1 discount",
    show_other: "Show {n} discounts",
    resultsFor: "Results for {window}",
    changeWindow: "Change",
    resultsLine: "{orders} · {revenue}",
    // form
    newTitle: "New discount",
    editTitle: "Edit discount",
    percentInvalid: "Enter a percentage between 0 and 100.",
    amountInvalid: "Enter a valid amount.",
    percentTooHigh: "A percentage discount can't exceed 100%.",
    limitInvalid: "Enter a whole number of 1 or more.",
    productsRequired: "Select at least one product, or switch to all products.",
    savedToast: "Discount saved.",
    createdCodeToast: "“{code}” created.",
    createdAutomaticToast: "Automatic discount created.",
    codeHint: "Leave blank for an automatic discount with no code.",
    generate: "Generate",
    percentage: "Percentage",
    percentageHint: "Between 0 and 100.",
    amountOff: "Amount off",
    minimumSubtotal: "Minimum subtotal",
    minimumSubtotalHint: "Optional — the order subtotal must reach this before the discount applies.",
    startsAt: "Starts at",
    endsAt: "Ends at",
    usageLimit: "Usage limit",
    usageLimitHint: "Total redemptions allowed.",
    perCustomerLimit: "Per-customer limit",
    perCustomerLimitHint: "Redemptions allowed per customer.",
    appliesTo: "Applies to",
    allProducts: "All products",
    specificProducts: "Specific products",
    stackable: "Can be combined with other discounts",
    saving: "Saving…",
    save: "Save discount",
    createSubmit: "Create discount",
    loading: "Loading",
    filterProducts: "Filter products…",
    selectedCount: "{count} selected",
    noProducts: "No products yet — add one in Catalog first.",
    noMatch: "No products match.",
    sectionRules: "Limits and dates",
    sectionRulesSummary: "Minimum order, dates, how many uses",
    thisDiscount: "This discount",
    // preview
    previewTitle: "How the shopper sees it",
    previewSample: "An example on a {amount} cart",
    previewShow: "Show the preview",
    previewHide: "Hide the preview",
    previewProduct: "A product from your store",
    previewQty: "× {n}",
    previewSubtotal: "Subtotal",
    previewShipping: "Shipping",
    previewFreeShipping: "Free shipping",
    previewTotal: "Total",
    previewTotalShort: "Total {amount}",
    previewAutomatic: "Automatic discount",
    previewPercentLine: "{percent} off",
    previewFixedLine: "Discount",
    previewMinus: "− {amount}",
    previewBelowMinimum: "This cart is under the minimum ({amount}), so the code would not apply to it.",
    previewSpecific: "Applies only to the products you chose.",
    previewBuyXGetY: "This offer is worked out in the store from what is in the cart.",
    previewNoValue: "Enter the value to see the new total.",
    previewDisclaimer: "For illustration only — the real price is worked out by your store at checkout.",
  },
  ar: {
    create: "كود جديد",
    createFirst: "اعمل خصم",
    emptyTitle: "لسه مفيش خصومات",
    emptyHint: "اعمل كود العميل يكتبه وهو بيعمل الأوردر، أو خصم تلقائي بيتطبّق لوحده.",
    searchLabel: "دوّر في الخصومات",
    searchPlaceholder: "دوّر بالكود",
    statusLabel: "حالة الخصم",
    all: "الكل",
    noMatchTitle: "مفيش خصم بالشكل ده",
    noMatchHint: "جرّب كود تاني، أو امسح البحث والفلاتر.",
    clearFilters: "امسح البحث والفلاتر",
    listLabel: "الخصومات",
    caption: "أكواد الخصم والخصومات التلقائية",
    code: "الكود",
    type: "النوع",
    value: "القيمة",
    status: "الحالة",
    usage: "الاستخدام",
    dates: "الفترة",
    actions: "إجراءات",
    automatic: "تلقائي",
    type_percentage: "خصم بنسبة",
    type_fixed: "خصم بمبلغ ثابت",
    type_free_shipping: "شحن مجاني",
    type_buy_x_get_y: "اشتري X وخد Y",
    status_active: "شغّال",
    status_disabled: "متوقف",
    status_archived: "مؤرشف",
    status_scheduled: "مجدول",
    status_expired: "منتهي",
    noDateLimit: "من غير تاريخ",
    dateFrom: "من {date}",
    dateUntil: "لحد {date}",
    usesOf: "{used} من {limit} استخدام",
    uses: "{used} استخدام",
    freeShippingShort: "شحن مجاني",
    open: "عدّل",
    copyCode: "انسخ الكود",
    copied: "«{code}» اتنسخ.",
    copyFailed: "معرفناش ننسخ. جرّب تاني.",
    enable: "شغّله",
    disable: "وقّفه",
    archive: "أرشفه…",
    shareLink: "لينك المشاركة",
    menuLabel: "إجراءات {code}",
    moreActions: "إجراءات تانية لـ {code}",
    enabledToast: "الخصم اشتغل.",
    disabledToast: "الخصم اتوقف.",
    archivedToast: "الخصم اتأرشف.",
    archivedCodeToast: "«{code}» اتأرشف.",
    archiveTitle: "تأرشف الخصم ده؟",
    archiveTitleCode: "تأرشف «{code}»؟",
    archiveDescription:
      "الخصم اللي العملاء استخدموه جزء من السجل المالي، فبيتأرشف ومش بيتمسح — بيبطّل يتطبّق في الدفع ومش بيظهر بعدها في التقارير الشغّالة.",
    archiveConfirm: "أرشف الخصم",
    working: "بنأرشف…",
    cancel: "إلغاء",
    filterType: "نوع الخصم",
    filterKind: "بكود ولا تلقائي",
    kind_code: "بكود",
    kind_automatic: "تلقائي",
    filterResults: "فترة النتايج",
    filterResultsHint: "الأيام اللي بتغطيها أرقام الأوردرات والمبيعات والخصم لكل كود.",
    chipType: "النوع: {name}",
    chipKind: "الكود: {name}",
    show_one: "اعرض خصم واحد",
    show_two: "اعرض خصمين",
    show_few: "اعرض {n} خصومات",
    show_other: "اعرض {n} خصم",
    resultsFor: "النتايج في {window}",
    changeWindow: "غيّر",
    resultsLine: "{orders} · {revenue}",
    newTitle: "خصم جديد",
    editTitle: "عدّل الخصم",
    percentInvalid: "اكتب نسبة بين 0 و100.",
    amountInvalid: "اكتب مبلغ صحيح.",
    percentTooHigh: "نسبة الخصم مينفعش تزيد عن 100%.",
    limitInvalid: "اكتب رقم صحيح، 1 أو أكتر.",
    productsRequired: "اختار منتج واحد على الأقل، أو اختار «كل المنتجات».",
    savedToast: "الخصم اتحفظ.",
    createdCodeToast: "«{code}» اتعمل.",
    createdAutomaticToast: "اتعمل خصم تلقائي.",
    codeHint: "سيبه فاضي لو عايز خصم تلقائي من غير كود.",
    generate: "ولّد",
    percentage: "النسبة",
    percentageHint: "بين 0 و100.",
    amountOff: "مبلغ الخصم",
    minimumSubtotal: "الحد الأدنى للأوردر",
    minimumSubtotalHint: "اختياري — مجموع الأوردر لازم يوصل للمبلغ ده عشان الخصم يتطبّق.",
    startsAt: "تاريخ البداية",
    endsAt: "تاريخ النهاية",
    usageLimit: "حد الاستخدام",
    usageLimitHint: "إجمالي عدد مرات الاستخدام المسموح.",
    perCustomerLimit: "الحد لكل عميل",
    perCustomerLimitHint: "عدد مرات الاستخدام المسموح لكل عميل.",
    appliesTo: "بيتطبّق على",
    allProducts: "كل المنتجات",
    specificProducts: "منتجات معيّنة",
    stackable: "ينفع يتستخدم مع خصومات تانية",
    saving: "بنحفظ…",
    save: "احفظ الخصم",
    createSubmit: "اعمل الخصم",
    loading: "بنحمّل",
    filterProducts: "دوّر في المنتجات…",
    selectedCount: "اخترت {count}",
    noProducts: "لسه مفيش منتجات — ضيف منتج من صفحة المنتجات الأول.",
    noMatch: "مفيش منتجات بالاسم ده.",
    sectionRules: "الحدود والتواريخ",
    sectionRulesSummary: "الحد الأدنى، التواريخ، عدد مرات الاستخدام",
    thisDiscount: "الخصم ده",
    previewTitle: "العميل هيشوفها كده",
    previewSample: "مثال على سلة بـ {amount}",
    previewShow: "اعرض المعاينة",
    previewHide: "اخفي المعاينة",
    previewProduct: "منتج من متجرك",
    previewQty: "× {n}",
    previewSubtotal: "المجموع",
    previewShipping: "الشحن",
    previewFreeShipping: "شحن مجاني",
    previewTotal: "الإجمالي",
    previewTotalShort: "الإجمالي {amount}",
    previewAutomatic: "خصم تلقائي",
    previewPercentLine: "خصم {percent}",
    previewFixedLine: "خصم",
    previewMinus: "− {amount}",
    previewBelowMinimum: "السلة دي أقل من الحد الأدنى ({amount})، فالكود مش هيتطبّق عليها.",
    previewSpecific: "بيتطبّق على المنتجات اللي اخترتها بس.",
    previewBuyXGetY: "العرض ده بيتحسب في المتجر حسب اللي في السلة.",
    previewNoValue: "اكتب القيمة عشان تشوف الإجمالي الجديد.",
    previewDisclaimer: "للتوضيح بس — السعر الحقيقي بيحسبه متجرك في صفحة الدفع.",
  },
} satisfies Messages;

export type DiscountStrings = (typeof DISCOUNT_STRINGS)["en"];

export const DISCOUNT_TYPES: readonly DiscountType[] = ["percentage", "fixed", "free_shipping", "buy_x_get_y"];

/** Discount type -> its label key in DISCOUNT_STRINGS. */
export const TYPE_LABEL: Record<DiscountType, keyof DiscountStrings> = {
  percentage: "type_percentage",
  fixed: "type_fixed",
  free_shipping: "type_free_shipping",
  buy_x_get_y: "type_buy_x_get_y",
};

export type DisplayStatus = DiscountStatus | "scheduled" | "expired";

export const DISPLAY_STATUSES: readonly DisplayStatus[] = ["active", "scheduled", "expired", "disabled", "archived"];

export const STATUS_LABEL: Record<DisplayStatus, keyof DiscountStrings> = {
  active: "status_active",
  scheduled: "status_scheduled",
  expired: "status_expired",
  disabled: "status_disabled",
  archived: "status_archived",
};

/**
 * `active` on the backend just means "not disabled/archived" — a discount
 * with a future start or a past end is still stored as `active`. Compute the
 * status a merchant actually cares about from the date range on top of it.
 */
export function displayStatus(d: Discount): DisplayStatus {
  if (d.status !== "active") return d.status;
  const now = Date.now();
  if (d.startsAt && new Date(d.startsAt).getTime() > now) return "scheduled";
  if (d.endsAt && new Date(d.endsAt).getTime() < now) return "expired";
  return "active";
}

/** The value in a few characters: percent for %, money for fixed, «شحن مجاني», a dash otherwise. */
export function discountValueLabel(d: Discount, t: DiscountStrings): string {
  switch (d.type) {
    case "percentage":
      return formatPercent(d.value);
    case "fixed":
      return formatMoney(d.value);
    case "free_shipping":
      return t.freeShippingShort;
    default:
      return "—";
  }
}

export function dateRangeLabel(d: Discount, t: DiscountStrings): string {
  if (!d.startsAt && !d.endsAt) return t.noDateLimit;
  if (d.startsAt && !d.endsAt) return fmt(t.dateFrom, { date: formatDate(d.startsAt) });
  if (!d.startsAt && d.endsAt) return fmt(t.dateUntil, { date: formatDate(d.endsAt) });
  return `${formatDate(d.startsAt)} – ${formatDate(d.endsAt)}`;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easy to read aloud

export function generateCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

/** Puts text on the clipboard; false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }
}

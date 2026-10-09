import type { UrlRedirectRefusal, UrlRedirectSource, UrlRedirectStatus } from "@store-builder/api-client";
import type { Messages } from "@/i18n/LocaleContext";

/**
 * The words of Store settings → URL redirects (frontend-handoff 232), shared
 * by the tab, the add / edit dialog and the CSV import. The refusals are the
 * handoff's own sentences.
 */
export const REDIRECT_STRINGS = {
  en: {
    title: "URL redirects",
    description:
      "When a page or product address changes — or you move from another platform — send the old address to the new one, so shoppers and search engines land in the right place.",
    add: "Add redirect",
    importCsv: "Import CSV",
    searchLabel: "Search redirects",
    searchPlaceholder: "Search by old or new address",
    clearSearch: "Clear search",
    filterLabel: "Filter redirects by where they came from",
    filterAll: "All",
    source_manual: "Manual",
    source_auto: "Automatic",
    source_import: "Imported",
    colFrom: "From",
    colTo: "To",
    colType: "Type",
    colHits: "Hits",
    colActions: "Actions",
    status_301: "Permanent 301",
    status_302: "Temporary 302",
    lastHit: "Last hit {when}",
    neverHit: "Not used yet",
    tryIt: "Open {path} in the store",
    edit: "Edit the redirect from {path}",
    remove: "Delete the redirect from {path}",
    count_one: "1 redirect",
    count_other: "{n} redirects",
    emptyTitle: "No redirects yet",
    emptyHint:
      "When a product's or collection's address changes, its redirect is added here by itself. You can also add one yourself, or import a file from your old platform.",
    noMatchTitle: "No redirect matches",
    noMatchHint: "Try another address, or show them all.",
    showAll: "Show all",
    autoNote: "Added by itself when the address changed.",

    newTitle: "New redirect",
    editTitle: "Edit redirect",
    dialogHint: "Shoppers who open the old address are sent to the new one.",
    fromLabel: "Old address",
    fromHint: "The path after your store's address, starting with / — for example /old-page",
    toLabel: "Goes to",
    toHint: "A path in your store (/new-page) or a full link starting with https://",
    typeLabel: "Redirect type",
    permanentHint: "The address changed for good — search engines move the page's ranking to the new one.",
    temporaryHint: "Only for a while — a campaign, or a page being reworked.",
    cancel: "Cancel",
    save: "Save",
    create: "Add redirect",
    saving: "Saving…",
    added: "Redirect added.",
    saved: "Redirect saved.",
    deleted: "Redirect deleted.",
    fromRequired: "Type the old address.",
    fromSlash: "The old address must start with /",
    noSpaces: "An address can't contain spaces.",
    toRequired: "Type where it goes.",
    toShape: "The new address must start with / or https://",
    httpsOnly: "Use an https:// link — http:// isn't accepted.",
    refused_taken: "This path already redirects",
    refused_self: "A redirect cannot point at itself",
    refused_loop: "This would send shoppers round in a loop",
    refused_target: "The new address must start with / or https://",
    refused_path: "The old address must start with / and have no spaces.",

    deleteTitle: "Delete this redirect?",
    deleteBody: "Anyone opening {path} will see “Page not found” instead of being sent on.",
    deleteConfirm: "Delete",
    deleting: "Deleting…",

    importTitle: "Import redirects from CSV",
    importHint: "One line per redirect: the old address, the new one, and 302 when it is temporary.",
    importExample: "Example",
    importRules: "Up to {max} lines. The header line is optional. A path that already redirects is updated.",
    chooseFile: "Choose a CSV file",
    fileChosen: "{name} — {lines}",
    lines_one: "1 line",
    lines_other: "{n} lines",
    pasteLabel: "Or paste the lines here",
    importSubmit: "Import",
    importing: "Importing…",
    importEmpty: "Paste the lines or choose a file first.",
    importTooMany: "More than {max} lines — split the file in two.",
    importUnreadable: "We couldn't read this file. Save it as CSV and try again.",
    importFixFirst: "Fix these lines, then import again:",
    importDone: "{created} added, {updated} updated.",
    importNothing: "Nothing was imported.",
    importErrorsTitle: "These lines were not imported:",
    importLine: "Line {line}: {message}",
    importMore: "Only the first 100 problems are shown.",
    importAgain: "Import another file",
    done: "Done",
    line_shape: "Write it as /old-path,/new-path",
    line_generic: "This line has a problem.",
  },
  ar: {
    title: "تحويل الروابط",
    description:
      "لو عنوان صفحة أو منتج اتغيّر — أو نقلت متجرك من منصة تانية — حوّل العنوان القديم للجديد، عشان العميل وجوجل يوصلوا للمكان الصح.",
    add: "ضيف تحويل",
    importCsv: "استيراد CSV",
    searchLabel: "دوّر في التحويلات",
    searchPlaceholder: "دوّر بالعنوان القديم أو الجديد",
    clearSearch: "امسح البحث",
    filterLabel: "صفّي التحويلات حسب مصدرها",
    filterAll: "الكل",
    source_manual: "يدوي",
    source_auto: "تلقائي",
    source_import: "مستورد",
    colFrom: "من",
    colTo: "إلى",
    colType: "النوع",
    colHits: "عدد الزيارات",
    colActions: "إجراءات",
    status_301: "دائم 301",
    status_302: "مؤقت 302",
    lastHit: "آخر زيارة {when}",
    neverHit: "لسه ما اتستخدمش",
    tryIt: "افتح {path} في المتجر",
    edit: "عدّل تحويل {path}",
    remove: "امسح تحويل {path}",
    count_one: "تحويل واحد",
    count_two: "تحويلين",
    count_few: "{n} تحويلات",
    count_other: "{n} تحويل",
    emptyTitle: "مفيش تحويلات لسه",
    emptyHint:
      "لما تغيّر عنوان منتج أو تصنيف، تحويله بيتضاف هنا لوحده. وتقدر تضيف تحويل بنفسك، أو تستورد ملف من منصتك القديمة.",
    noMatchTitle: "مفيش تحويل مطابق",
    noMatchHint: "جرّب عنوان تاني، أو اعرضهم كلهم.",
    showAll: "اعرض الكل",
    autoNote: "اتضاف لوحده لما العنوان اتغيّر.",

    newTitle: "تحويل جديد",
    editTitle: "تعديل التحويل",
    dialogHint: "اللي يفتح العنوان القديم هيتحوّل للجديد.",
    fromLabel: "العنوان القديم",
    fromHint: "المسار اللي بعد عنوان متجرك، ويبدأ بـ / — مثلًا ‎/old-page",
    toLabel: "يروح على",
    toHint: "مسار في متجرك (‎/new-page) أو لينك كامل يبدأ بـ https://",
    typeLabel: "نوع التحويل",
    permanentHint: "العنوان اتغيّر على طول — جوجل هينقل ترتيب الصفحة للعنوان الجديد.",
    temporaryHint: "لفترة بس — زي حملة، أو صفحة بتتعدّل.",
    cancel: "إلغاء",
    save: "حفظ",
    create: "ضيف التحويل",
    saving: "بنحفظ…",
    added: "التحويل اتضاف.",
    saved: "التحويل اتحفظ.",
    deleted: "التحويل اتمسح.",
    fromRequired: "اكتب العنوان القديم.",
    fromSlash: "العنوان القديم لازم يبدأ بـ /",
    noSpaces: "العنوان مينفعش يكون فيه مسافات.",
    toRequired: "اكتب هيروح على فين.",
    toShape: "العنوان الجديد لازم يبدأ بـ / أو https://",
    httpsOnly: "اللينك لازم يبدأ بـ https:// — ‏http:// مش مقبول.",
    refused_taken: "المسار ده عليه تحويل بالفعل",
    refused_self: "مينفعش يحوّل لنفسه",
    refused_loop: "ده هيعمل لفة مقفولة",
    refused_target: "العنوان الجديد لازم يبدأ بـ / أو https://",
    refused_path: "العنوان القديم لازم يبدأ بـ / ومن غير مسافات.",

    deleteTitle: "تمسح التحويل ده؟",
    deleteBody: "اللي يفتح {path} هيشوف «الصفحة غير موجودة» بدل ما يتحوّل.",
    deleteConfirm: "امسح",
    deleting: "بنمسح…",

    importTitle: "استيراد تحويلات من CSV",
    importHint: "سطر لكل تحويل: العنوان القديم، وبعده الجديد، وبعده 302 لو التحويل مؤقت.",
    importExample: "مثال",
    importRules: "لحد {max} سطر. سطر العناوين اختياري. المسار اللي عليه تحويل بالفعل هيتحدّث.",
    chooseFile: "اختار ملف CSV",
    fileChosen: "{name} — {lines}",
    lines_one: "سطر واحد",
    lines_two: "سطرين",
    lines_few: "{n} سطور",
    lines_other: "{n} سطر",
    pasteLabel: "أو الصق السطور هنا",
    importSubmit: "استورد",
    importing: "بنستورد…",
    importEmpty: "الصق السطور أو اختار ملف الأول.",
    importTooMany: "الملف فيه أكتر من {max} سطر — قسّمه على مرتين.",
    importUnreadable: "معرفناش نقرا الملف ده. احفظه CSV وجرّب تاني.",
    importFixFirst: "صلّح السطور دي وبعدين استورد تاني:",
    importDone: "اتضاف {created} واتحدّث {updated}.",
    importNothing: "مفيش حاجة اتستوردت.",
    importErrorsTitle: "السطور دي ما اتستوردتش:",
    importLine: "سطر {line}: {message}",
    importMore: "بنعرض أول ١٠٠ مشكلة بس.",
    importAgain: "استورد ملف تاني",
    done: "تمام",
    line_shape: "اكتبه بالشكل ده: ‎/old-path,/new-path",
    line_generic: "السطر ده فيه مشكلة.",
  },
} satisfies Messages;

export type RedirectStrings = (typeof REDIRECT_STRINGS)["en"];

export const SOURCE_KEY: Record<UrlRedirectSource, "source_manual" | "source_auto" | "source_import"> = {
  manual: "source_manual",
  auto: "source_auto",
  import: "source_import",
};

export const STATUS_KEY: Record<UrlRedirectStatus, "status_301" | "status_302"> = { 301: "status_301", 302: "status_302" };

export const REFUSAL_KEY: Record<UrlRedirectRefusal, "refused_taken" | "refused_self" | "refused_loop" | "refused_target" | "refused_path"> = {
  taken: "refused_taken",
  self: "refused_self",
  loop: "refused_loop",
  target: "refused_target",
  path: "refused_path",
};

/** What is wrong with an address as typed, before the API is asked: a key of the strings, or null. */
export function fromPathProblem(value: string): "fromRequired" | "fromSlash" | "noSpaces" | null {
  const v = value.trim();
  if (!v) return "fromRequired";
  if (/\s/.test(v)) return "noSpaces";
  if (!v.startsWith("/")) return "fromSlash";
  return null;
}

export function toPathProblem(value: string): "toRequired" | "toShape" | "httpsOnly" | "noSpaces" | null {
  const v = value.trim();
  if (!v) return "toRequired";
  if (/\s/.test(v)) return "noSpaces";
  if (/^http:\/\//i.test(v)) return "httpsOnly";
  if (!v.startsWith("/") && !/^https:\/\/\S+$/i.test(v)) return "toShape";
  return null;
}

/** The API's own sentence for an import line, as a key of the strings where the dashboard has its words. */
export function importLineKey(message: string): "line_shape" | "refused_self" | "refused_loop" | null {
  const text = message.toLowerCase();
  if (/use \/old-path/.test(text)) return "line_shape";
  if (/itself/.test(text)) return "refused_self";
  if (/loop/.test(text)) return "refused_loop";
  return null;
}

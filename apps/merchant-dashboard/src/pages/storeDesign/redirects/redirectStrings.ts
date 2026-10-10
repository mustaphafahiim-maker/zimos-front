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
      "إذا تغيّر عنوان صفحة أو منتج — أو نقلت متجرك من منصة أخرى — حوّل العنوان القديم إلى الجديد، ليصل العميل وجوجل إلى المكان الصحيح.",
    add: "إضافة تحويل",
    importCsv: "استيراد CSV",
    searchLabel: "ابحث في التحويلات",
    searchPlaceholder: "ابحث بالعنوان القديم أو الجديد",
    clearSearch: "مسح البحث",
    filterLabel: "تصفية التحويلات حسب مصدرها",
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
    neverHit: "لم يُستخدم بعد",
    tryIt: "فتح {path} في المتجر",
    edit: "تعديل تحويل {path}",
    remove: "حذف تحويل {path}",
    count_one: "تحويل واحد",
    count_two: "تحويلان",
    count_few: "{n} تحويلات",
    count_other: "{n} تحويلًا",
    emptyTitle: "لا توجد تحويلات بعد",
    emptyHint:
      "عندما تغيّر عنوان منتج أو تصنيف، يُضاف تحويله هنا تلقائيًا. ويمكنك إضافة تحويل بنفسك، أو استيراد ملف من منصتك القديمة.",
    noMatchTitle: "لا يوجد تحويل مطابق",
    noMatchHint: "جرّب عنوانًا آخر، أو اعرضها كلها.",
    showAll: "عرض الكل",
    autoNote: "أُضيف تلقائيًا عندما تغيّر العنوان.",

    newTitle: "تحويل جديد",
    editTitle: "تعديل التحويل",
    dialogHint: "من يفتح العنوان القديم يُحوَّل إلى الجديد.",
    fromLabel: "العنوان القديم",
    fromHint: "المسار الذي يلي عنوان متجرك، ويبدأ بـ / — مثلًا ‎/old-page",
    toLabel: "يُحوَّل إلى",
    toHint: "مسار في متجرك (‎/new-page) أو رابط كامل يبدأ بـ https://",
    typeLabel: "نوع التحويل",
    permanentHint: "تغيّر العنوان نهائيًا — سينقل جوجل ترتيب الصفحة إلى العنوان الجديد.",
    temporaryHint: "لفترة فقط — مثل حملة، أو صفحة قيد التعديل.",
    cancel: "إلغاء",
    save: "حفظ",
    create: "إضافة التحويل",
    saving: "جارٍ الحفظ…",
    added: "تمت إضافة التحويل.",
    saved: "تم حفظ التحويل.",
    deleted: "تم حذف التحويل.",
    fromRequired: "اكتب العنوان القديم.",
    fromSlash: "يجب أن يبدأ العنوان القديم بـ /",
    noSpaces: "لا يجوز أن يحتوي العنوان على مسافات.",
    toRequired: "اكتب العنوان الذي يُحوَّل إليه.",
    toShape: "يجب أن يبدأ العنوان الجديد بـ / أو https://",
    httpsOnly: "يجب أن يبدأ الرابط بـ https:// — ‏http:// غير مقبول.",
    refused_taken: "يوجد تحويل على هذا المسار بالفعل",
    refused_self: "لا يمكن أن يُحوَّل إلى نفسه",
    refused_loop: "سيُنشئ هذا حلقة مغلقة",
    refused_target: "يجب أن يبدأ العنوان الجديد بـ / أو https://",
    refused_path: "يجب أن يبدأ العنوان القديم بـ / وبدون مسافات.",

    deleteTitle: "هل تريد حذف هذا التحويل؟",
    deleteBody: "من يفتح {path} سيرى «الصفحة غير موجودة» بدلًا من أن يُحوَّل.",
    deleteConfirm: "حذف",
    deleting: "جارٍ الحذف…",

    importTitle: "استيراد تحويلات من CSV",
    importHint: "سطر لكل تحويل: العنوان القديم، ثم الجديد، ثم 302 إذا كان التحويل مؤقتًا.",
    importExample: "مثال",
    importRules: "حتى {max} سطر. سطر العناوين اختياري. المسار الذي عليه تحويل بالفعل سيُحدَّث.",
    chooseFile: "اختيار ملف CSV",
    fileChosen: "{name} — {lines}",
    lines_one: "سطر واحد",
    lines_two: "سطران",
    lines_few: "{n} أسطر",
    lines_other: "{n} سطرًا",
    pasteLabel: "أو الصق الأسطر هنا",
    importSubmit: "استيراد",
    importing: "جارٍ الاستيراد…",
    importEmpty: "الصق الأسطر أو اختر ملفًا أولًا.",
    importTooMany: "في الملف أكثر من {max} سطر — قسّمه على مرتين.",
    importUnreadable: "تعذّرت قراءة هذا الملف. احفظه بصيغة CSV وحاول مرة أخرى.",
    importFixFirst: "صحّح هذه الأسطر ثم استورد مرة أخرى:",
    importDone: "أُضيف {created} وحُدِّث {updated}.",
    importNothing: "لم يُستورد شيء.",
    importErrorsTitle: "لم تُستورد هذه الأسطر:",
    importLine: "سطر {line}: {message}",
    importMore: "تُعرض أول ١٠٠ مشكلة فقط.",
    importAgain: "استيراد ملف آخر",
    done: "تم",
    line_shape: "اكتبه بهذا الشكل: ‎/old-path,/new-path",
    line_generic: "في هذا السطر مشكلة.",
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

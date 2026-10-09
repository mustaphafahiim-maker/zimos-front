import { intlLocaleOf } from "@/i18n/LocaleContext";
import type { PluralForms } from "@/lib/plural";
import type { EditorLocale } from "../editorLocale";

/**
 * The words of the editor's start side — the section list, its rows and
 * menus, the library of sections and the saved sections — in the editor's
 * language (EditorLocaleContext, the same switch editorUi() reads).
 *
 * Counted words go through the language's plural rules and digits («عنصرين»,
 * «٣ عناصر», «١١ عنصر»), never a bare number glued to a noun.
 */

/** A count in `locale`: the right plural form, the language's own digits. */
function counted(locale: EditorLocale, n: number, forms: PluralForms): string {
  const tag = intlLocaleOf(locale);
  let rule: Intl.LDMLPluralRule = "other";
  try {
    rule = new Intl.PluralRules(tag).select(n);
  } catch {
    /* an engine without PluralRules: the general form */
  }
  return (forms[rule] ?? forms.other).replace("{n}", new Intl.NumberFormat(tag).format(n));
}

/** A bare figure in the language's digits (a position, a rating). */
function figure(locale: EditorLocale, n: number): string {
  return new Intl.NumberFormat(intlLocaleOf(locale)).format(n);
}

const EN = {
  // --- the section list ---
  listTitle: "Page sections",
  showList: "Show the page's sections",
  hideList: "Hide the page's sections",
  elements: (n: number) => counted("en", n, { one: "1 element", other: "{n} elements" }),
  hidden: "Hidden",
  reorder: (label: string) => `Drag to reorder: ${label}`,
  sortableRole: "movable section",
  rowMenu: (label: string) => `Actions for ${label}`,
  moveUp: "Move up",
  moveDown: "Move down",
  addAfter: "Add a section after it",
  duplicate: "Duplicate",
  hide: "Hide",
  show: "Show",
  saveToLibrary: "Save to my library",
  remove: "Delete",
  removeAria: (label: string) => `Delete ${label}`,
  addHere: "Add a section here",
  emptyPage: "This page is empty — add its first section.",
  addSection: "Add a section",
  announcement: "Announcement bar",
  header: "Header",
  footer: "Footer",
  onEveryPage: "On every page",
  announcementOff: "Off",
  outlineOf: (label: string) => `What is inside ${label}`,
  dragHelp: "Press Space to pick the section up, move it with the arrow keys, and press Space again to drop it. Escape cancels.",
  dragPicked: (label: string) => `Picked up ${label}.`,
  dragOver: (label: string, n: number, total: number) => `${label} is now ${figure("en", n)} of ${figure("en", total)}.`,
  dragDropped: (label: string, n: number, total: number) => `${label} dropped at ${figure("en", n)} of ${figure("en", total)}.`,
  dragCancelled: (label: string) => `Cancelled. ${label} is back where it was.`,

  // --- one element in a section's outline ---
  image: "Image",
  noImage: "No image yet",
  images: (n: number) => counted("en", n, { one: "1 image", other: "{n} images" }),
  rows: (n: number) => counted("en", n, { one: "1 row", other: "{n} rows" }),
  items: (n: number) => counted("en", n, { one: "1 item", other: "{n} items" }),
  products: (n: number) => counted("en", n, { one: "1 product", other: "{n} products" }),
  collections: (n: number) => counted("en", n, { one: "1 collection", other: "{n} collections" }),
  links: (n: number) => counted("en", n, { one: "1 link", other: "{n} links" }),
  steps: (n: number) => counted("en", n, { one: "1 step", other: "{n} steps" }),
  tabs: (n: number) => counted("en", n, { one: "1 tab", other: "{n} tabs" }),
  slides: (n: number) => counted("en", n, { one: "1 slide", other: "{n} slides" }),
  needs: (n: number) => counted("en", n, { one: "1 need", other: "{n} needs" }),
  hours: (n: number) => counted("en", n, { one: "1 hour", other: "{n} hours" }),
  stars: (n: number) => `${figure("en", n)}★`,
  pixels: (n: number) => `${figure("en", n)}px`,
  oneProduct: "One product",
  shoppableImage: "Shoppable image",
  nothingLinked: "Nothing linked yet",
  noAddress: "No address yet",
  form: "Form",
  cart: "Cart",
  livingHero: "Living hero",
  product3d: "3D product",
  nothingWritten: "Nothing written yet",
  currency: "Currency",

  // --- the library of sections ---
  libraryTitle: "Add a section",
  insertAt: (n: number) => `It becomes section ${figure("en", n)} of the page.`,
  insertEnd: "It goes at the end of the page.",
  search: "Search sections",
  searchPlaceholder: "Search — hero, products, FAQ…",
  kinds: "Kind of section",
  all: "All",
  purposeHero: "Hero",
  purposeProducts: "Products",
  purposeOffers: "Offers",
  purposeTrust: "Trust",
  purposeReviews: "Reviews",
  purposeFaq: "FAQ",
  purposeContent: "Content",
  purposeForm: "Forms",
  purposeFooter: "Footer",
  popular: "Most used",
  results: (n: number) => counted("en", n, { one: "1 result", other: "{n} results" }),
  noResults: "No section matches that.",
  clearSearch: "Clear the search",
  searchEverything: "Search every kind",
  addPreset: (label: string) => `Add ${label}`,

  // --- saved sections ---
  saved: "Saved",
  savedTitle: "Saved sections",
  savedHint: "Sections you saved to use again on any page.",
  savedEmptyTitle: "Nothing saved yet",
  savedEmptyBody: "Open «…» beside any section and choose “Save to my library”. It will wait for you here.",
  savedLoadFailed: "We couldn't load your saved sections.",
  retry: "Try again",
  insertCopy: "Add a copy",
  insertLinked: "Add linked",
  linkedHint: "A linked copy follows the saved section: update it, publish, and every linked copy changes.",
  funnelOnly: "This funnel only",
  removeSaved: "Delete from my library",
  removeSavedAria: (name: string) => `Delete ${name} from my library`,
  removeSavedTitle: (name: string) => `Delete “${name}” from your library?`,
  removeSavedBody: "Sections already on your pages stay as they are. Linked copies stop updating.",
  removeSavedConfirm: "Delete it",
  savedRemoved: "Deleted from your library.",
  cancel: "Cancel",

  // --- saving a section ---
  saveSheetTitle: "Save this section",
  saveSheetHint: "Keep it in your library and add it to any page later.",
  saveName: "Its name in your library",
  saveNamePlaceholder: "e.g. Winter offer",
  saveOnlyThisFunnel: "Only for this funnel",
  save: "Save",
  saving: "Saving…",
  savedDone: "Saved to your library.",
};

export type LeftUi = typeof EN;

const AR: LeftUi = {
  listTitle: "أقسام الصفحة",
  showList: "اظهر أقسام الصفحة",
  hideList: "اخفي أقسام الصفحة",
  elements: (n) => counted("ar", n, { one: "عنصر واحد", two: "عنصرين", few: "{n} عناصر", other: "{n} عنصر" }),
  hidden: "مخفي",
  reorder: (label) => `اسحب عشان ترتّب: ${label}`,
  sortableRole: "قسم بيتحرّك",
  rowMenu: (label) => `إجراءات ${label}`,
  moveUp: "طلّعه فوق",
  moveDown: "نزّله تحت",
  addAfter: "ضيف قسم بعده",
  duplicate: "كرّره",
  hide: "اخفيه",
  show: "اظهره",
  saveToLibrary: "احفظه في مكتبتي",
  remove: "امسحه",
  removeAria: (label) => `امسح ${label}`,
  addHere: "ضيف قسم هنا",
  emptyPage: "الصفحة فاضية — ضيف أول قسم.",
  addSection: "ضيف قسم",
  announcement: "شريط الإعلان",
  header: "الهيدر",
  footer: "الفوتر",
  onEveryPage: "على كل الصفحات",
  announcementOff: "مقفول",
  outlineOf: (label) => `اللي جوّه ${label}`,
  dragHelp: "دوس مسافة عشان تمسك القسم، حرّكه بالأسهم، ودوس مسافة تاني عشان تسيبه. Esc بيلغي.",
  dragPicked: (label) => `مسكت ${label}.`,
  dragOver: (label, n, total) => `${label} بقى رقم ${figure("ar", n)} من ${figure("ar", total)}.`,
  dragDropped: (label, n, total) => `${label} اتحط رقم ${figure("ar", n)} من ${figure("ar", total)}.`,
  dragCancelled: (label) => `اتلغى. ${label} رجع مكانه.`,

  image: "صورة",
  noImage: "مفيش صورة لسه",
  images: (n) => counted("ar", n, { one: "صورة واحدة", two: "صورتين", few: "{n} صور", other: "{n} صورة" }),
  rows: (n) => counted("ar", n, { one: "صف واحد", two: "صفّين", few: "{n} صفوف", other: "{n} صف" }),
  items: (n) => counted("ar", n, { one: "عنصر واحد", two: "عنصرين", few: "{n} عناصر", other: "{n} عنصر" }),
  products: (n) => counted("ar", n, { one: "منتج واحد", two: "منتجين", few: "{n} منتجات", other: "{n} منتج" }),
  collections: (n) => counted("ar", n, { one: "مجموعة واحدة", two: "مجموعتين", few: "{n} مجموعات", other: "{n} مجموعة" }),
  links: (n) => counted("ar", n, { one: "لينك واحد", two: "لينكين", few: "{n} لينكات", other: "{n} لينك" }),
  steps: (n) => counted("ar", n, { one: "خطوة واحدة", two: "خطوتين", few: "{n} خطوات", other: "{n} خطوة" }),
  tabs: (n) => counted("ar", n, { one: "تبويب واحد", two: "تبويبين", few: "{n} تبويبات", other: "{n} تبويب" }),
  slides: (n) => counted("ar", n, { one: "شريحة واحدة", two: "شريحتين", few: "{n} شرايح", other: "{n} شريحة" }),
  needs: (n) => counted("ar", n, { one: "احتياج واحد", two: "احتياجين", few: "{n} احتياجات", other: "{n} احتياج" }),
  hours: (n) => counted("ar", n, { one: "ساعة واحدة", two: "ساعتين", few: "{n} ساعات", other: "{n} ساعة" }),
  stars: (n) => `${figure("ar", n)}★`,
  pixels: (n) => `${figure("ar", n)} بكسل`,
  oneProduct: "منتج واحد",
  shoppableImage: "صورة تتسوّق منها",
  nothingLinked: "مفيش لينك لسه",
  noAddress: "مفيش عنوان لسه",
  form: "فورم",
  cart: "السلة",
  livingHero: "واجهة متحركة",
  product3d: "منتج ثلاثي الأبعاد",
  nothingWritten: "مفيش حاجة مكتوبة لسه",
  currency: "العملة",

  libraryTitle: "ضيف قسم",
  insertAt: (n) => `هيبقى القسم رقم ${figure("ar", n)} في الصفحة.`,
  insertEnd: "هيتضاف في آخر الصفحة.",
  search: "دوّر في الأقسام",
  searchPlaceholder: "دوّر — واجهة، منتجات، أسئلة…",
  kinds: "نوع القسم",
  all: "الكل",
  purposeHero: "واجهة",
  purposeProducts: "منتجات",
  purposeOffers: "عروض",
  purposeTrust: "ثقة",
  purposeReviews: "تقييمات",
  purposeFaq: "أسئلة",
  purposeContent: "محتوى",
  purposeForm: "فورم",
  purposeFooter: "فوتر",
  popular: "الأكتر استخدامًا",
  results: (n) => counted("ar", n, { one: "نتيجة واحدة", two: "نتيجتين", few: "{n} نتايج", other: "{n} نتيجة" }),
  noResults: "مفيش قسم بالاسم ده.",
  clearSearch: "امسح البحث",
  searchEverything: "دوّر في كل الأنواع",
  addPreset: (label) => `ضيف ${label}`,

  saved: "محفوظاتي",
  savedTitle: "محفوظاتي",
  savedHint: "أقسام حفظتها عشان تستخدمها تاني في أي صفحة.",
  savedEmptyTitle: "لسه ما حفظتش حاجة",
  savedEmptyBody: "افتح «…» جنب أي قسم واختار «احفظه في مكتبتي». هتلاقيه مستنيك هنا.",
  savedLoadFailed: "معرفناش نجيب أقسامك المحفوظة.",
  retry: "جرّب تاني",
  insertCopy: "ضيف نسخة",
  insertLinked: "ضيف مرتبط",
  linkedHint: "النسخة المرتبطة ماشية مع القسم المحفوظ: عدّله وانشر، وكل النسخ المرتبطة تتغيّر.",
  funnelOnly: "مسار البيع ده بس",
  removeSaved: "امسحه من مكتبتي",
  removeSavedAria: (name) => `امسح ${name} من مكتبتي`,
  removeSavedTitle: (name) => `تمسح «${name}» من مكتبتك؟`,
  removeSavedBody: "الأقسام اللي على صفحاتك هتفضل زي ما هي. النسخ المرتبطة مش هتتحدّث تاني.",
  removeSavedConfirm: "امسحه",
  savedRemoved: "اتمسح من مكتبتك.",
  cancel: "إلغاء",

  saveSheetTitle: "احفظ القسم ده",
  saveSheetHint: "خلّيه في مكتبتك وضيفه لأي صفحة بعدين.",
  saveName: "اسمه في مكتبتك",
  saveNamePlaceholder: "مثلًا: عرض الشتا",
  saveOnlyThisFunnel: "لمسار البيع ده بس",
  save: "احفظ",
  saving: "بيحفظ…",
  savedDone: "اتحفظ في مكتبتك.",
};

export function leftUi(locale: EditorLocale): LeftUi {
  return locale === "ar" ? AR : EN;
}

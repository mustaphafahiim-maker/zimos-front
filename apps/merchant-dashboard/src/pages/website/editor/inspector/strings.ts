import type { EditorLocale } from "../editorLocale";

/**
 * The inspector's own words, in the editor's two languages. Kept beside the
 * inspector instead of in editorLocale.ts (which the whole editor shares and
 * several hands edit at once); read with `inspectorUi(locale)` exactly as
 * `editorUi(locale)` is.
 */

/** A count in the language's own digits («٣», never a stray "3" in Arabic). */
export function inspectorNumber(n: number, locale: EditorLocale): string {
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(n);
  } catch {
    return String(n);
  }
}

export type CountNoun =
  | "picture"
  | "question"
  | "row"
  | "point"
  | "tab"
  | "step"
  | "link"
  | "slide"
  | "card"
  | "video"
  | "category"
  | "need"
  | "change";

const NOUNS_EN: Record<CountNoun, { zero: string; one: string; other: string }> = {
  picture: { zero: "No pictures yet", one: "1 picture", other: "{n} pictures" },
  question: { zero: "No questions yet", one: "1 question", other: "{n} questions" },
  row: { zero: "No rows yet", one: "1 row", other: "{n} rows" },
  point: { zero: "Nothing written yet", one: "1 line", other: "{n} lines" },
  tab: { zero: "No tabs yet", one: "1 tab", other: "{n} tabs" },
  step: { zero: "No steps yet", one: "1 step", other: "{n} steps" },
  link: { zero: "No links yet", one: "1 link", other: "{n} links" },
  slide: { zero: "No slides yet", one: "1 slide", other: "{n} slides" },
  card: { zero: "No cards yet", one: "1 card", other: "{n} cards" },
  video: { zero: "No videos yet", one: "1 video", other: "{n} videos" },
  category: { zero: "No categories yet", one: "1 category", other: "{n} categories" },
  need: { zero: "No needs yet", one: "1 need", other: "{n} needs" },
  change: { zero: "No changes", one: "1 change", other: "{n} changes" },
};

/** Arabic counts: one, two, 3–10, then 11 and up. */
const NOUNS_AR: Record<CountNoun, { zero: string; one: string; two: string; few: string; many: string }> = {
  picture: { zero: "مفيش صور لسه", one: "صورة واحدة", two: "صورتين", few: "{n} صور", many: "{n} صورة" },
  question: { zero: "مفيش أسئلة لسه", one: "سؤال واحد", two: "سؤالين", few: "{n} أسئلة", many: "{n} سؤال" },
  row: { zero: "مفيش صفوف لسه", one: "صف واحد", two: "صفين", few: "{n} صفوف", many: "{n} صف" },
  point: { zero: "مفيش حاجة مكتوبة لسه", one: "سطر واحد", two: "سطرين", few: "{n} سطور", many: "{n} سطر" },
  tab: { zero: "مفيش تبويبات لسه", one: "تبويب واحد", two: "تبويبين", few: "{n} تبويبات", many: "{n} تبويب" },
  step: { zero: "مفيش خطوات لسه", one: "خطوة واحدة", two: "خطوتين", few: "{n} خطوات", many: "{n} خطوة" },
  link: { zero: "مفيش لينكات لسه", one: "لينك واحد", two: "لينكين", few: "{n} لينكات", many: "{n} لينك" },
  slide: { zero: "مفيش شرايح لسه", one: "شريحة واحدة", two: "شريحتين", few: "{n} شرايح", many: "{n} شريحة" },
  card: { zero: "مفيش كروت لسه", one: "كارت واحد", two: "كارتين", few: "{n} كروت", many: "{n} كارت" },
  video: { zero: "مفيش فيديوهات لسه", one: "فيديو واحد", two: "فيديوهين", few: "{n} فيديوهات", many: "{n} فيديو" },
  category: { zero: "مفيش أقسام لسه", one: "قسم واحد", two: "قسمين", few: "{n} أقسام", many: "{n} قسم" },
  need: { zero: "مفيش احتياجات لسه", one: "احتياج واحد", two: "احتياجين", few: "{n} احتياجات", many: "{n} احتياج" },
  change: { zero: "مفيش تغييرات", one: "تغيير واحد", two: "تغييرين", few: "{n} تغييرات", many: "{n} تغيير" },
};

/** «٣ صور», "3 pictures", «مفيش صور لسه» — a counted word in the editor's language. */
export function countWord(noun: CountNoun, n: number, locale: EditorLocale): string {
  const shown = inspectorNumber(n, locale);
  if (locale === "ar") {
    const forms = NOUNS_AR[noun];
    const text = n <= 0 ? forms.zero : n === 1 ? forms.one : n === 2 ? forms.two : n <= 10 ? forms.few : forms.many;
    return text.replace("{n}", shown);
  }
  const forms = NOUNS_EN[noun];
  return (n <= 0 ? forms.zero : n === 1 ? forms.one : forms.other).replace("{n}", shown);
}

const UI_EN = {
  // --- the frame ---
  tabsLabel: "What to change",
  content: "Content",
  style: "Style",
  visibility: "Visibility",
  path: "Where this sits",
  backToSection: (name: string) => `Back to the section: ${name}`,
  sectionActions: "Section actions",
  elementActions: "Element actions",
  duplicateElement: "Duplicate this element",
  moveUp: "Move it up",
  moveDown: "Move it down",
  duplicateSection: "Duplicate the section",
  saveSection: "Save to the library",
  deleteSection: "Delete the section",

  // --- a section's content ---
  elementsTitle: "In this section",
  elementsHint: "Tap anything to edit it.",
  row: (n: string) => `Row ${n}`,
  emptyColumn: "Nothing in this column.",
  editElement: (name: string) => `Edit ${name}`,
  markRules: "Has display rules",
  markHidden: "Hidden on a screen",
  markBound: "Shows live store data",
  noFields: "Nothing to write here. Its look is under Style.",

  // --- a section's style ---
  columnsTitle: "Columns",
  rowSpace: (n: string) => `Row ${n}: space between its columns`,

  // --- visibility ---
  savedTitle: "Reuse this section",
  whoSees: "Who sees what",
  whoSeesHint: "The section itself always shows. Rules are set on each thing inside it.",
  showsToAll: "Shows to everyone",
  showOnTitle: "Screens",
  showOnHint: "Turn a screen off and it is left out of the page at that width.",
  showOnLabel: "Shows on",
  screenDesktop: "Computer",
  screenTablet: "Tablet",
  screenMobile: "Phone",
  hiddenOn: (list: string) => `Hidden on: ${list}`,
  hiddenEverywhere: "Hidden on every screen — shoppers won't see it.",
  whenUpright: "Hide when the phone is upright",
  whenSideways: "Hide when the phone is sideways",
  bindTitle: "Live store data",
  joiner: ", ",

  // --- two languages ---
  arabic: "Arabic",
  english: "English",
  languageOf: (label: string) => `${label}: language`,
  inLanguage: (label: string, language: string) => `${label} — ${language}`,
  stillEmpty: (language: string) => `${language} is still empty`,

  // --- small controls ---
  increase: (label: string) => `Increase ${label}`,
  decrease: (label: string) => `Decrease ${label}`,
  colourDefault: "Default",
  colourClear: "Back to the default",
  colourInherits: "Not set here — it follows the default.",

  // --- where a link goes, in words ---
  linkHome: "Your home page",
  linkProducts: "All your products",
  linkCart: "The cart",
  linkCheckout: "Checkout",
  linkTrack: "Order tracking",
  linkBlog: "Your blog",
  linkProduct: (slug: string) => `A product page: ${slug}`,
  linkCollection: "A collection of products",
  linkPopup: (name: string) => `Opens the popup "${name}"`,
  linkAnchor: (name: string) => `Scrolls to "${name}" on this page`,
  linkPage: (path: string) => `A page of your store: ${path}`,
  linkExternal: (host: string) => `Another website: ${host}`,
  linkWhatsApp: "Opens a WhatsApp chat",
  linkPhone: (number: string) => `Calls ${number}`,
  linkEmail: (address: string) => `Writes an email to ${address}`,
  linkUnclear: "Start with / for a page of your store, or https:// for another website.",
  linkQuick: "Quick picks",
  linkQuickHome: "Home",
  linkQuickProducts: "Products",
  linkQuickCart: "Cart",

  // --- lists of cards ---
  itemMoveUp: (name: string) => `Move ${name} up`,
  itemMoveDown: (name: string) => `Move ${name} down`,
  itemRemove: (name: string) => `Remove ${name}`,
  itemAdd: (noun: string) => `Add ${noun.toLowerCase()}`,
  itemUp: "Up",
  itemDown: "Down",
  itemDelete: "Remove",
  itemsFull: (max: string) => `That's the most it takes (${max}).`,
  itemsEmpty: "Nothing here yet.",

  // --- pictures ---
  fromLibrary: "Choose from the library",

  // --- the style page ---
  screensLabel: "Screen",
  ownChanges: (list: string) => `Has its own changes on: ${list}`,
  onlyThisScreen: (screen: string) => `What you change here is for the ${screen.toLowerCase()} only.`,
  groupText: "Text",
  groupBackground: "Background",
  groupBorder: "Border and corners",
  groupShadow: "Shadow and opacity",
  groupSize: "Size",
  groupSpacing: "Spacing",
  groupSpacingHint: "In pixels. Inside is the room around the content; outside is the gap from its neighbours.",
  groupAdvanced: "Advanced",
  groupMotion: "Entrance",
  groupNamed: "Shared style",
  setCount: (n: string) => `${n} set`,
};

export type InspectorUi = typeof UI_EN;

const UI_AR: InspectorUi = {
  tabsLabel: "عايز تغيّر إيه",
  content: "المحتوى",
  style: "الشكل",
  visibility: "الظهور",
  path: "مكانه في الصفحة",
  backToSection: (name) => `ارجع للقسم: ${name}`,
  sectionActions: "إجراءات القسم",
  elementActions: "إجراءات العنصر",
  duplicateElement: "كرّر العنصر ده",
  moveUp: "حرّكه لفوق",
  moveDown: "حرّكه لتحت",
  duplicateSection: "كرّر القسم",
  saveSection: "احفظه في المكتبة",
  deleteSection: "احذف القسم",

  elementsTitle: "جوّه القسم ده",
  elementsHint: "اضغط على أي حاجة عشان تعدّلها.",
  row: (n) => `الصف ${n}`,
  emptyColumn: "العمود ده فاضي.",
  editElement: (name) => `عدّل ${name}`,
  markRules: "عليه شروط ظهور",
  markHidden: "مخفي على شاشة",
  markBound: "بيعرض بيانات حيّة من المتجر",
  noFields: "مفيش حاجة تتكتب هنا. شكله من «الشكل».",

  columnsTitle: "الأعمدة",
  rowSpace: (n) => `الصف ${n}: المسافة بين أعمدته`,

  savedTitle: "استخدم القسم ده تاني",
  whoSees: "مين بيشوف إيه",
  whoSeesHint: "القسم نفسه بيظهر دايمًا. الشروط بتتحط على كل حاجة جوّاه لوحدها.",
  showsToAll: "بيظهر للكل",
  showOnTitle: "الشاشات",
  showOnHint: "اقفل شاشة، والعنصر يتشال من الصفحة على المقاس ده.",
  showOnLabel: "بيظهر على",
  screenDesktop: "كمبيوتر",
  screenTablet: "تابلت",
  screenMobile: "موبايل",
  hiddenOn: (list) => `مخفي على: ${list}`,
  hiddenEverywhere: "مخفي على كل الشاشات — العملاء مش هيشوفوه.",
  whenUpright: "اخفيه والموبايل واقف",
  whenSideways: "اخفيه والموبايل نايم",
  bindTitle: "بيانات حيّة من المتجر",
  joiner: "، ",

  arabic: "عربي",
  english: "English",
  languageOf: (label) => `${label}: اللغة`,
  inLanguage: (label, language) => `${label} — ${language}`,
  stillEmpty: (language) => `${language} لسه فاضي`,

  increase: (label) => `زوّد ${label}`,
  decrease: (label) => `قلّل ${label}`,
  colourDefault: "الافتراضي",
  colourClear: "رجّع الافتراضي",
  colourInherits: "مش متحدد هنا — ماشي على الافتراضي.",

  linkHome: "الصفحة الرئيسية",
  linkProducts: "كل المنتجات",
  linkCart: "السلة",
  linkCheckout: "إتمام الأوردر",
  linkTrack: "تتبّع الأوردر",
  linkBlog: "المدونة",
  linkProduct: (slug) => `صفحة منتج: ${slug}`,
  linkCollection: "مجموعة منتجات",
  linkPopup: (name) => `بيفتح النافذة «${name}»`,
  linkAnchor: (name) => `بينزل لـ«${name}» في نفس الصفحة`,
  linkPage: (path) => `صفحة في متجرك: ${path}`,
  linkExternal: (host) => `موقع تاني: ${host}`,
  linkWhatsApp: "بيفتح شات واتساب",
  linkPhone: (number) => `بيتصل بـ ${number}`,
  linkEmail: (address) => `بيكتب إيميل لـ ${address}`,
  linkUnclear: "ابدأ بـ / لصفحة في متجرك، أو https:// لموقع تاني.",
  linkQuick: "اختيارات سريعة",
  linkQuickHome: "الرئيسية",
  linkQuickProducts: "المنتجات",
  linkQuickCart: "السلة",

  itemMoveUp: (name) => `حرّك ${name} لفوق`,
  itemMoveDown: (name) => `حرّك ${name} لتحت`,
  itemRemove: (name) => `احذف ${name}`,
  itemAdd: (noun) => `ضيف ${noun}`,
  itemUp: "لفوق",
  itemDown: "لتحت",
  itemDelete: "احذف",
  itemsFull: (max) => `ده أقصى عدد (${max}).`,
  itemsEmpty: "مفيش حاجة هنا لسه.",

  fromLibrary: "اختار من المكتبة",

  screensLabel: "الشاشة",
  ownChanges: (list) => `فيه تغييرات خاصة على: ${list}`,
  onlyThisScreen: (screen) => `اللي بتغيّره هنا لشاشة ال${screen} بس.`,
  groupText: "النص",
  groupBackground: "الخلفية",
  groupBorder: "الإطار والزوايا",
  groupShadow: "الظل والشفافية",
  groupSize: "المقاس",
  groupSpacing: "المسافات",
  groupSpacingHint: "بالبكسل. «جوّه» هي المساحة حوالين المحتوى، و«برّه» هي البعد عن اللي جنبه.",
  groupAdvanced: "متقدّم",
  groupMotion: "حركة الظهور",
  groupNamed: "ستايل مشترك",
  setCount: (n) => `${n} متحدد`,
};

export function inspectorUi(locale: EditorLocale): InspectorUi {
  return locale === "ar" ? UI_AR : UI_EN;
}

import { createContext, useContext } from "react";
import type { PageElementType } from "@store-builder/api-client";

/**
 * Language for the shared page-editor pieces — the field inspector, the block
 * library, the image pickers. The website editor provides the dashboard's own
 * language (LocaleContext); the funnel builder provides the language its
 * merchant picked.
 *
 * English strings stay where they are (ELEMENT_SPECS, BLOCK_PRESETS, the
 * components); this module only holds the Arabic side and falls back to the
 * English value for anything it doesn't know.
 */

export type EditorLocale = "en" | "ar";

export const EditorLocaleContext = createContext<EditorLocale>("en");

export function useEditorLocale(): EditorLocale {
  return useContext(EditorLocaleContext);
}

const ELEMENT_LABEL_AR: Record<PageElementType, string> = {
  heading: "عنوان",
  text: "نص",
  rich_text: "نص طويل",
  image: "صورة",
  gallery: "معرض صور",
  button: "زرار",
  video: "فيديو",
  embed: "تضمين",
  spacer: "مسافة",
  divider: "فاصل",
  icon: "أيقونة",
  list: "قائمة",
  accordion: "أكورديون",
  faq: "أسئلة شائعة",
  testimonial: "رأي عميل",
  countdown: "عدّاد تنازلي",
  form: "نموذج",
  map: "خريطة",
  social_icons: "روابط التواصل",
  product_card: "منتج واحد",
  product_list: "شبكة منتجات",
  collection_list: "المجموعات",
  cart: "السلة",
  shader_hero: "واجهة متحركة",
  product_3d: "منتج مجسّم",
  orbit_gallery: "عرض دوّار",
  scroll_story: "قصة بالسكرول",
  marquee: "شريط جمل متحرك",
  comparison: "جدول مقارنة",
};

/** Keyed "<elementType>.<propKey>" first, then by the bare prop key. */
const FIELD_LABEL_AR: Record<string, string> = {
  text: "النص",
  level: "المستوى",
  src: "الصورة",
  alt: "النص البديل",
  href: "الرابط",
  title: "العنوان",
  images: "الصور",
  columns: "عدد الأعمدة",
  "button.label": "نص الزرار",
  "countdown.label": "النص",
  variant: "الشكل",
  "video.url": "رابط الفيديو",
  "embed.url": "رابط التضمين",
  height: "الارتفاع (px)",
  style: "النمط",
  name: "اسم الأيقونة",
  size: "الحجم (px)",
  "list.items": "العناصر",
  "accordion.items": "الصفوف",
  "faq.items": "الأسئلة",
  quote: "كلام العميل",
  author: "الاسم",
  rating: "التقييم",
  endsInHours: "ينتهي بعد (ساعات)",
  submitLabel: "نص زرار الإرسال",
  "map.address": "العنوان على الخريطة",
  zoom: "درجة التكبير",
  links: "الروابط",
  productId: "معرّف المنتج",
  showPrice: "إظهار السعر",
  showBuyButton: "إظهار زرار الشراء",
  source: "المعروض",
  limit: "العدد",
  subtitle: "السطر التحتاني",
  ctaLabel: "نص الزرار",
  ctaHref: "رابط الزرار",
  modelUrl: "ملف 3D (.glb)",
  collectionId: "المجموعة",
  steps: "الخطوات",
  "marquee.items": "الجمل",
  speed: "السرعة",
  tone: "الشكل",
  usLabel: "اسم عمودك",
  themLabel: "اسم العمود التاني",
  "comparison.rows": "الصفوف",
};

const FIELD_HINT_AR: Record<string, string> = {
  "rich_text.text": "نص عادي بس في المحرر ده — أدوات التنسيق جاية بعدين.",
  "image.alt": "بيوصف الصورة لقارئات الشاشة.",
  "embed.url": "رابط للتضمين. السيرفر بيرفض الـ HTML الخام.",
  "product_card.productId": "سيبه فاضي علشان يتعرض أحدث منتج.",
  "shader_hero.height": "الخلفية بتتحرك بألوان متجرك نفسه.",
  "product_3d.productId": "سيبه فاضي علشان يتعرض أحدث منتج.",
  "product_3d.modelUrl":
    "سيبه فاضي علشان يستخدم ملف الـ GLB المرفوع مع صور المنتج. من غير ملف، البلوك ده بيتخفي.",
  "orbit_gallery.collectionId": "سيبه فاضي علشان يشتغل على الكتالوج كله.",
  "scroll_story.steps": "كل خطوة ليها صورتها وهي بتظهر مع سكرول العميل.",
  "marquee.items":
    "كل جملة كام كلمة بس. الشريط بيقف لما العميل يحط الماوس عليه أو يوصله بالكيبورد، وبيبقى ثابت لأي حد طالب حركة أقل.",
  "comparison.rows": "كلام قصير في كل خانة — أو اكتب yes أو no علشان تظهر علامة صح أو غلط.",
};

/** Keyed "<propKey>.<optionValue>". */
const OPTION_LABEL_AR: Record<string, string> = {
  "variant.primary": "أساسي",
  "variant.secondary": "ثانوي",
  "variant.outline": "بإطار",
  "style.solid": "متصل",
  "style.dashed": "متقطع",
  "source.newest": "الأحدث",
  "source.featured": "المميزة",
  "source.best_selling": "الأكثر مبيعًا",
  "speed.slow": "بطيئة",
  "speed.normal": "عادية",
  "speed.fast": "سريعة",
  "tone.line": "سطر عادي",
  "tone.primary": "كبسولات بلون العلامة",
};

/** Keyed by BlockPreset.key. */
const PRESET_AR: Record<string, { label: string; description: string }> = {
  hero: { label: "واجهة ترحيبية", description: "عنوان كبير وسطر كلام وزرار يدعو للشراء." },
  heading: { label: "عنوان", description: "عنوان قسم لوحده." },
  text: { label: "نص", description: "فقرة كلام." },
  "rich-text": { label: "نص طويل", description: "كلام أطول." },
  list: { label: "قائمة", description: "قائمة نقاط." },
  button: { label: "زرار", description: "زرار واحد يدعو لإجراء." },
  testimonial: { label: "رأي عميل", description: "كلام عميل مع تقييم." },
  faq: { label: "أسئلة شائعة", description: "أسئلة وإجاباتها." },
  accordion: { label: "أكورديون", description: "صفوف بتتفتح وتتقفل." },
  form: { label: "نموذج", description: "نموذج تواصل أو تسجيل." },
  image: { label: "صورة", description: "صورة واحدة، وممكن تبقى رابط." },
  gallery: { label: "معرض صور", description: "مجموعة صور في شبكة." },
  video: { label: "فيديو", description: "فيديو متضمّن." },
  embed: { label: "تضمين", description: "تضمين صفحة خارجية برابط." },
  map: { label: "خريطة", description: "اعرض عنوانك على الخريطة." },
  icon: { label: "أيقونة", description: "أيقونة زخرفية واحدة." },
  social: { label: "روابط التواصل", description: "روابط حساباتك على السوشيال ميديا." },
  products: { label: "شبكة منتجات", description: "شبكة منتجات من الكتالوج." },
  offer: { label: "منتج واحد", description: "ركّز على منتج واحد بزرار شراء." },
  collections: { label: "المجموعات", description: "خلي العميل يتصفح بالمجموعة." },
  countdown: { label: "عدّاد تنازلي", description: "عدّاد يحمّس على عرض لفترة محدودة." },
  cart: { label: "السلة", description: "محتويات سلة العميل." },
  divider: { label: "فاصل", description: "خط أفقي بين الأقسام." },
  spacer: { label: "مسافة", description: "مساحة فاضية بين الأقسام." },

  // الأقسام الجاهزة — بتيجي وفيها كلام مبدئي إنت بتغيّره.
  "living-hero": { label: "واجهة متحركة", description: "شاشة افتتاحية بتتحرك بالراحة بألوان متجرك." },
  "product-3d": { label: "منتج مجسّم", description: "العميل بيلف المنتج بصباعه. محتاج ملف ‎.glb‎." },
  "orbit-gallery": { label: "عرض دوّار", description: "منتجات على أسطوانة بتلف، بدل الشبكة العادية." },
  "scroll-story": { label: "قصة بالسكرول", description: "قبل وبعد، أو إزاي بيتعمل — خطوة خطوة مع السكرول." },
  "hero-trust": {
    label: "واجهة + أسباب ثقة",
    description: "شاشة افتتاحية ومعاها الأسباب اللي تخلي عميل لأول مرة يثق فيك.",
  },
  "living-hero-intro": {
    label: "واجهة متحركة بكلام",
    description: "الشاشة الافتتاحية المتحركة، وفيها عنوان وسطر كلام وزرار جاهزين.",
  },
  features: { label: "مميزاتك", description: "عنوان قصير والمميزات اللي عايز العميل يفتكرها." },
  "why-us": {
    label: "ليه تشتري من عندنا",
    description: "إجابات على اللي بيوقّف العميل عن الشراء — صف لكل قلق.",
  },
  "bundle-offer": { label: "عروض وباقات", description: "سطر عن الباقة، والمنتجات اللي فيها، وزرار لباقي العروض." },
  "before-after": {
    label: "قبل وبعد",
    description: "خطوتين بالسكرول — الحالة قبل وبعد. حط صورة لكل واحدة.",
  },
  "product-showcase-3d": {
    label: "عرض منتج مجسّم",
    description: "عنوان وسطر كلام والمنتج اللي العميل بيلفّه بصباعه.",
  },
  "orbit-showcase": { label: "عرض دوّار بعنوان", description: "عرض دوّار للمنتجات على أسطوانة بتلف، بعنوان فوقه." },
  lookbook: { label: "لوك بوك", description: "شبكة صور بعنوان، لمجموعة أو موسم." },
  "faq-cta": { label: "أسئلة شائعة + خطوة تانية", description: "أسئلة وإجاباتها، وبعدين طريقة يوصلك بيها لباقي الأسئلة." },
  "flash-offer": { label: "عرض لفترة محدودة", description: "عدّاد تنازلي فوق شروط العرض نفسه وزرار شراء." },
  "shipping-returns": {
    label: "الشحن والاستبدال",
    description: "بتشحن فين، وبتستبدل إزاي، وبتقبل إيه — بكلامك إنت.",
  },
  "claims-strip": {
    label: "شريط جمل متحرك",
    description: "سطر جمل قصيرة بيمشي على الصفحة وبيقف لما العميل يبصّ عليه.",
  },
  comparison: {
    label: "جدول مقارنة",
    description: "عمودك جنب البديل، صف بصف — بكلامك إنت ومن غير أسماء.",
  },
  testimonials: {
    label: "آراء العملاء",
    description: "تلات كروت آراء فاضية — إملاها من عملاء حقيقيين عندك.",
  },
};

/** Keyed by SectionSettingSpec.key. */
const SECTION_SETTING_LABEL_AR: Record<string, string> = {
  background: "الخلفية",
  padding: "المسافة فوق وتحت",
  width: "عرض المحتوى",
};

/** Keyed "<settingKey>.<optionValue>". */
const SECTION_SETTING_OPTION_AR: Record<string, string> = {
  "background.none": "بدون",
  "background.paper": "لون الصفحة",
  "background.raised": "لون بارز",
  "background.primary-soft": "لون العلامة الفاتح",
  "padding.compact": "ضيقة",
  "padding.normal": "عادية",
  "padding.roomy": "واسعة",
  "width.normal": "عادي",
  "width.wide": "عريض",
  "width.full": "عرض الشاشة",
};

const GROUP_AR: Record<string, string> = {
  Layout: "التخطيط",
  Content: "المحتوى",
  Media: "الوسائط",
  Commerce: "البيع",
};

export function elementLabel(type: PageElementType, fallback: string, locale: EditorLocale): string {
  return locale === "ar" ? (ELEMENT_LABEL_AR[type] ?? fallback) : fallback;
}

export function fieldLabel(
  type: PageElementType,
  key: string,
  fallback: string,
  locale: EditorLocale
): string {
  if (locale !== "ar") return fallback;
  return FIELD_LABEL_AR[`${type}.${key}`] ?? FIELD_LABEL_AR[key] ?? fallback;
}

export function fieldHint(
  type: PageElementType,
  key: string,
  fallback: string | undefined,
  locale: EditorLocale
): string | undefined {
  if (locale !== "ar" || fallback === undefined) return fallback;
  return FIELD_HINT_AR[`${type}.${key}`] ?? fallback;
}

export function optionLabel(key: string, value: string, fallback: string, locale: EditorLocale): string {
  return locale === "ar" ? (OPTION_LABEL_AR[`${key}.${value}`] ?? fallback) : fallback;
}

export function presetText(
  key: string,
  fallback: { label: string; description: string },
  locale: EditorLocale
): { label: string; description: string } {
  return locale === "ar" ? (PRESET_AR[key] ?? fallback) : fallback;
}

export function sectionSettingLabel(key: string, fallback: string, locale: EditorLocale): string {
  return locale === "ar" ? (SECTION_SETTING_LABEL_AR[key] ?? fallback) : fallback;
}

export function sectionSettingOption(
  key: string,
  value: string,
  fallback: string,
  locale: EditorLocale
): string {
  return locale === "ar" ? (SECTION_SETTING_OPTION_AR[`${key}.${value}`] ?? fallback) : fallback;
}

export function groupLabel(group: string, locale: EditorLocale): string {
  return locale === "ar" ? (GROUP_AR[group] ?? group) : group;
}

const UI_EN = {
  addBlock: "Add a block",
  addBlockHint: "Appended to the bottom of the page.",
  closePanel: "Close panel",
  deleteSection: "Delete section",
  noElements: "This section has no elements to edit.",
  elementCount: (n: number) => `${n} ${n === 1 ? "element" : "elements"}`,
  emptySection: "Empty section",
  andMore: (label: string, n: number) => `${label} + ${n} more`,
  listItem: "Item",
  addItem: (item: string) => `Add ${item.toLowerCase()}`,
  itemAria: (item: string, i: number) => `${item} ${i}`,
  removeItem: (item: string, i: number) => `Remove ${item.toLowerCase()} ${i}`,
  addQuestion: "Add question",
  question: "Question",
  answer: "Answer",
  questionAria: (i: number) => `Question ${i}`,
  answerAria: (i: number) => `Answer ${i}`,
  removeQuestion: (i: number) => `Remove question ${i}`,
  addStep: "Add step",
  stepTitle: "Step title",
  stepBody: "Step text",
  stepTitleAria: (i: number) => `Step ${i} title`,
  stepBodyAria: (i: number) => `Step ${i} text`,
  stepImageAria: (i: number) => `Step ${i} picture`,
  removeStep: (i: number) => `Remove step ${i}`,
  addRow: "Add row",
  rowLabel: "What you're comparing",
  rowUs: "Your column",
  rowThem: "Other column",
  rowLabelAria: (i: number) => `Row ${i}`,
  rowUsAria: (i: number) => `Row ${i} — your column`,
  rowThemAria: (i: number) => `Row ${i} — other column`,
  removeRow: (i: number) => `Remove row ${i}`,
  addLink: "Add link",
  platformAria: (i: number) => `Platform ${i}`,
  linkAria: (i: number) => `Link ${i}`,
  removeLink: (i: number) => `Remove link ${i}`,
  upload: "Upload",
  replace: "Replace",
  removeImage: "Remove image",
  addImages: "Add images",
  clear: "Clear",
  prepareFailed: "Could not prepare the selected image.",
  moveElementUp: (label: string) => `Move ${label} up`,
  moveElementDown: (label: string) => `Move ${label} down`,
  sectionStyle: "Section style",
  sectionStyleHint: "How this whole section sits on the page.",

  // --- the website editor's own frame (header, panes, dialogs) ---
  editorTitle: "Website editor",
  backToWebsite: "Back to website",
  editingPage: (title: string) => `Editing "${title}". Click a section in the preview to change it.`,
  unsavedChanges: "Unsaved changes",
  allSaved: "All changes saved",
  undo: "Undo",
  redo: "Redo",
  save: "Save",
  saving: "Saving…",
  publish: "Publish",
  publishing: "Publishing…",
  publishSaveFirst: "Save your changes first — publishing ships the last saved version.",
  publishHint: "Publish the saved draft of every page",
  cantPublish: "This site can't be published yet:",
  pageSaved: "Page saved.",
  lookSaved: "Store look saved.",
  savedBoth: "Page and store look saved.",
  saveFailed: "Couldn't save the page.",
  lookSaveFailed: "Couldn't save the store look.",
  published: (n: number) => `Site published — revision ${n} is live.`,
  publishFailed: "Couldn't publish the site.",
  noPagesToEdit: "This site has no pages to edit yet.",
  noPages: "This site has no pages yet. Use “New page” above to add one.",
  pageCreated: (title: string) => `"${title}" created.`,
  pageDeleted: (title: string) => `"${title}" deleted.`,

  layersTitle: "Page sections",
  layersHint: "Drag to reorder, click to edit.",
  showLayers: "Show page sections",
  hideLayers: "Hide page sections",
  emptyPage: "This page is empty. Pick a block below to start.",
  addHere: "Add a section here",
  addAbove: "Add a section above",
  addBelow: "Add a section below",
  insertingAt: (n: number) => `Adding as section ${n} of the page.`,
  cancelInsert: "Cancel",
  searchBlocks: "Search blocks",
  noBlocksFound: "No blocks match that search.",
  allGroups: "All",

  previewTitle: "Live preview",
  previewHint: "Your real storefront, unsaved changes included. Click a section to edit it.",
  previewRefresh: "Refresh preview",
  previewDesktop: "Desktop width",
  previewTablet: "Tablet width",
  previewMobile: "Mobile width",
  previewClose: "Close preview",
  previewFrame: "Storefront preview",

  tabSection: "Section",
  tabLook: "Store look",
  pickSection: "Click a section in the preview or in the list to edit it here.",

  deleteSectionTitle: "Delete this section?",
  deleteSectionBody: (label: string) =>
    `"${label}" and its content will be removed from the page. Nothing is deleted until you save.`,
  deletePageTitle: "Delete this page?",
  deletePageBody: (title: string, path: string) =>
    `"${title}" (${path}) and everything on it will be permanently deleted. This can't be undone.`,
  deletePage: "Delete page",
  leaveTitle: "Leave without saving?",
  switchBody: "This page has changes you haven't saved. Switching pages will discard them.",
  switchConfirm: "Discard and switch",
  leaveBody: "You have changes you haven't saved. Leaving the editor will discard them.",
  leaveConfirm: "Discard and leave",

  lookHint:
    "Colours, font, corners and logo for your whole store. They go live on your store as soon as you save — no publishing needed.",
  palettes: "Ready palettes",
  paletteName: (key: string) =>
    ((
      {
        nile: "Nile",
        midnight: "Midnight",
        rose: "Rose",
        forest: "Forest",
        violet: "Violet",
        ocean: "Ocean",
        charcoal: "Charcoal",
      } as Record<string, string>
    )[key] ?? key),
  usePalette: (name: string) => `Use the ${name} palette`,
  primaryColor: "Main colour",
  primaryColorHint: "Buttons, links and highlights.",
  accentColor: "Accent colour",
  accentColorHint: "Badges and small touches.",
  storeDefaultColor: "Not set yet — your store uses the default colour.",
  font: "Font",
  fontName: (key: string) =>
    (({ classic: "Classic", modern: "Modern", tajawal: "Tajawal", system: "System" }) as Record<string, string>)[
      key
    ] ?? key,
  corners: "Corners",
  radiusName: (key: string) =>
    (({ sharp: "Sharp", soft: "Soft", round: "Round" }) as Record<string, string>)[key] ?? key,
  logo: "Logo",
  logoHint: "Shown in your store's header.",
};

export type EditorUi = typeof UI_EN;

const UI_AR: EditorUi = {
  addBlock: "إضافة بلوك",
  addBlockHint: "بيتضاف في آخر الصفحة.",
  closePanel: "إغلاق اللوحة",
  deleteSection: "حذف القسم",
  noElements: "القسم ده مفيهوش عناصر تتعدّل.",
  elementCount: (n) => (n === 1 ? "عنصر واحد" : n === 2 ? "عنصرين" : `${n} عناصر`),
  emptySection: "قسم فاضي",
  andMore: (label, n) => `${label} + ${n} كمان`,
  listItem: "عنصر",
  addItem: (item) => `إضافة ${item}`,
  itemAria: (item, i) => `${item} ${i}`,
  removeItem: (item, i) => `حذف ${item} ${i}`,
  addQuestion: "إضافة سؤال",
  question: "السؤال",
  answer: "الإجابة",
  questionAria: (i) => `السؤال ${i}`,
  answerAria: (i) => `الإجابة ${i}`,
  removeQuestion: (i) => `حذف السؤال ${i}`,
  addStep: "إضافة خطوة",
  stepTitle: "عنوان الخطوة",
  stepBody: "كلام الخطوة",
  stepTitleAria: (i) => `عنوان الخطوة ${i}`,
  stepBodyAria: (i) => `كلام الخطوة ${i}`,
  stepImageAria: (i) => `صورة الخطوة ${i}`,
  removeStep: (i) => `حذف الخطوة ${i}`,
  addRow: "إضافة صف",
  rowLabel: "بتقارن في إيه",
  rowUs: "عمودك",
  rowThem: "العمود التاني",
  rowLabelAria: (i) => `الصف ${i}`,
  rowUsAria: (i) => `الصف ${i} — عمودك`,
  rowThemAria: (i) => `الصف ${i} — العمود التاني`,
  removeRow: (i) => `حذف الصف ${i}`,
  addLink: "إضافة رابط",
  platformAria: (i) => `المنصة ${i}`,
  linkAria: (i) => `الرابط ${i}`,
  removeLink: (i) => `حذف الرابط ${i}`,
  upload: "رفع",
  replace: "تغيير",
  removeImage: "حذف الصورة",
  addImages: "إضافة صور",
  clear: "مسح الكل",
  prepareFailed: "مقدرناش نجهّز الصورة اللي اخترتها.",
  moveElementUp: (label) => `تحريك ${label} لفوق`,
  moveElementDown: (label) => `تحريك ${label} لتحت`,
  sectionStyle: "شكل القسم",
  sectionStyleHint: "القسم كله بيقعد إزاي في الصفحة.",

  editorTitle: "محرر الموقع",
  backToWebsite: "رجوع للموقع",
  editingPage: (title) => `بتعدّل "${title}". دوس على أي قسم في المعاينة علشان تغيّره.`,
  unsavedChanges: "في تعديلات مش محفوظة",
  allSaved: "كل التعديلات محفوظة",
  undo: "تراجع",
  redo: "إعادة",
  save: "حفظ",
  saving: "بيحفظ…",
  publish: "نشر",
  publishing: "بينشر…",
  publishSaveFirst: "احفظ تعديلاتك الأول — النشر بيطلّع آخر نسخة محفوظة.",
  publishHint: "انشر آخر نسخة محفوظة من كل الصفحات",
  cantPublish: "الموقع لسه مينفعش يتنشر:",
  pageSaved: "الصفحة اتحفظت.",
  lookSaved: "شكل المتجر اتحفظ.",
  savedBoth: "الصفحة وشكل المتجر اتحفظوا.",
  saveFailed: "مقدرناش نحفظ الصفحة.",
  lookSaveFailed: "مقدرناش نحفظ شكل المتجر.",
  published: (n) => `الموقع اتنشر — النسخة ${n} شغالة دلوقتي.`,
  publishFailed: "مقدرناش ننشر الموقع.",
  noPagesToEdit: "الموقع ده لسه مفيهوش صفحات تتعدّل.",
  noPages: "الموقع ده لسه مفيهوش صفحات. استخدم “صفحة جديدة” فوق علشان تضيف واحدة.",
  pageCreated: (title) => `"${title}" اتعملت.`,
  pageDeleted: (title) => `"${title}" اتمسحت.`,

  layersTitle: "أقسام الصفحة",
  layersHint: "اسحب علشان ترتّب، ودوس علشان تعدّل.",
  showLayers: "إظهار أقسام الصفحة",
  hideLayers: "إخفاء أقسام الصفحة",
  emptyPage: "الصفحة دي فاضية. اختار بلوك من تحت علشان تبدأ.",
  addHere: "ضيف قسم هنا",
  addAbove: "ضيف قسم فوق",
  addBelow: "ضيف قسم تحت",
  insertingAt: (n) => `هيتضاف كقسم رقم ${n} في الصفحة.`,
  cancelInsert: "إلغاء",
  searchBlocks: "دوّر على بلوك",
  noBlocksFound: "مفيش بلوكات بالاسم ده.",
  allGroups: "الكل",

  previewTitle: "معاينة حيّة",
  previewHint: "ده متجرك الحقيقي بالتعديلات اللي لسه محفظتهاش. دوس على أي قسم علشان تعدّله.",
  previewRefresh: "تحديث المعاينة",
  previewDesktop: "عرض الكمبيوتر",
  previewTablet: "عرض التابلت",
  previewMobile: "عرض الموبايل",
  previewClose: "قفل المعاينة",
  previewFrame: "معاينة المتجر",

  tabSection: "القسم",
  tabLook: "شكل المتجر",
  pickSection: "دوس على أي قسم في المعاينة أو في القائمة علشان تعدّله هنا.",

  deleteSectionTitle: "تحذف القسم ده؟",
  deleteSectionBody: (label) => `"${label}" باللي فيه هيتشال من الصفحة. مفيش حاجة بتتمسح غير لما تحفظ.`,
  deletePageTitle: "تحذف الصفحة دي؟",
  deletePageBody: (title, path) => `"${title}" (${path}) وكل اللي فيها هيتمسحوا نهائي. مفيش رجوع في الخطوة دي.`,
  deletePage: "احذف الصفحة",
  leaveTitle: "تخرج من غير ما تحفظ؟",
  switchBody: "الصفحة دي فيها تعديلات مش محفوظة. لو نقلت لصفحة تانية هتضيع.",
  switchConfirm: "امسحها وانقل",
  leaveBody: "عندك تعديلات مش محفوظة. لو خرجت من المحرر هتضيع.",
  leaveConfirm: "امسحها واخرج",

  lookHint: "الألوان والخط والحواف واللوجو لمتجرك كله. بتتطبق على متجرك أول ما تحفظ — من غير نشر.",
  palettes: "ألوان جاهزة",
  paletteName: (key) =>
    ((
      {
        nile: "النيل",
        midnight: "نص الليل",
        rose: "ورد",
        forest: "غابة",
        violet: "بنفسجي",
        ocean: "بحر",
        charcoal: "فحم",
      } as Record<string, string>
    )[key] ?? key),
  usePalette: (name) => `استخدم ألوان ${name}`,
  primaryColor: "اللون الأساسي",
  primaryColorHint: "الزراير واللينكات والحاجات المميزة.",
  accentColor: "لون التمييز",
  accentColorHint: "العلامات واللمسات الصغيرة.",
  storeDefaultColor: "لسه متحددش — متجرك بيستخدم اللون الافتراضي.",
  font: "الخط",
  fontName: (key) =>
    (({ classic: "كلاسيك", modern: "مودرن", tajawal: "تجوال", system: "خط الجهاز" }) as Record<string, string>)[key] ??
    key,
  corners: "الحواف",
  radiusName: (key) => (({ sharp: "حادة", soft: "ناعمة", round: "مدوّرة" }) as Record<string, string>)[key] ?? key,
  logo: "اللوجو",
  logoHint: "بيظهر فوق في هيدر متجرك.",
};

export function editorUi(locale: EditorLocale): EditorUi {
  return locale === "ar" ? UI_AR : UI_EN;
}

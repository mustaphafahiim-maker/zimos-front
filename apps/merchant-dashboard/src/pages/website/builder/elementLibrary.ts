/**
 * What the builder knows about each element type: its palette entry, default
 * props for a fresh insert, and the inspector fields — generated from exactly
 * the props PageRenderer reads (packages/store-renderer/src/PageRenderer.tsx).
 */
import {
  ICON_PATHS,
  THEME_PAGE_PATHS,
  THEME_PAGE_TITLES,
  createIdFactory,
  type ElementType,
  type L10n,
  type RendererLocale,
  type ThemePageKey,
  type TreeElement,
} from "@store-builder/store-renderer";

export type FieldKind =
  | "text"
  | "textarea"
  | "rich"
  | "number"
  | "select"
  | "toggle"
  | "image"
  | "images"
  | "link"
  | "strList"
  | "qaList"
  | "links"
  | "product"
  | "collection"
  | "datetime"
  | "table";

export interface FieldOption {
  value: string;
  label: L10n;
}

export interface FieldDef {
  key: string;
  kind: FieldKind;
  label: L10n;
  options?: FieldOption[];
  min?: number;
  max?: number;
  hint?: L10n;
  /** The renderer hides the element on the live store while this is empty. */
  required?: boolean;
  defaultValue?: unknown;
}

const L = (ar: string, en: string): L10n => ({ ar, en });
const opt = (value: string, ar: string, en: string = ar): FieldOption => ({ value, label: L(ar, en) });

export const ELEMENT_LABELS: Record<ElementType, L10n> = {
  heading: L("عنوان", "Heading"),
  text: L("نص", "Text"),
  rich_text: L("نص طويل", "Rich text"),
  image: L("صورة", "Image"),
  gallery: L("معرض صور", "Gallery"),
  button: L("زرار", "Button"),
  video: L("فيديو", "Video"),
  embed: L("محتوى مضمّن", "Embed"),
  spacer: L("مسافة", "Spacer"),
  divider: L("خط فاصل", "Divider"),
  icon: L("أيقونة", "Icon"),
  list: L("قائمة نقاط", "List"),
  accordion: L("قائمة بتتفتح", "Accordion"),
  faq: L("أسئلة شائعة", "FAQ"),
  testimonial: L("رأي عميل", "Testimonial"),
  countdown: L("عداد تنازلي", "Countdown"),
  form: L("فورم تواصل", "Contact form"),
  map: L("عنوان وخريطة", "Map"),
  social_icons: L("سوشيال ميديا", "Social links"),
  product_card: L("منتج", "Product"),
  product_list: L("شبكة منتجات", "Product grid"),
  collection_list: L("الأقسام", "Collections"),
  cart: L("السلة", "Cart"),
};

const TITLE: FieldDef = { key: "title", kind: "text", label: L("العنوان", "Title") };
const ICON_OPTIONS: FieldOption[] = [opt("", "من غير", "None"), ...Object.keys(ICON_PATHS).map((k) => opt(k, k, k))];
const QA: FieldDef[] = [TITLE, { key: "items", kind: "qaList", label: L("الأسئلة", "Questions"), required: true }];

export const ELEMENT_FIELDS: Record<ElementType, FieldDef[]> = {
  heading: [
    { key: "text", kind: "textarea", label: L("العنوان", "Heading"), required: true },
    { key: "eyebrow", kind: "text", label: L("سطر صغير فوق العنوان", "Small line above") },
    { key: "level", kind: "select", label: L("مستوى العنوان", "Heading level"), options: [1, 2, 3, 4, 5, 6].map((n) => opt(String(n), `H${n}`)), defaultValue: "2" },
    { key: "size", kind: "select", label: L("الحجم", "Size"), options: [opt("default", "عادي", "Normal"), opt("display", "كبير جدًا", "Display"), opt("sm", "صغير", "Small")] },
  ],
  text: [
    { key: "text", kind: "textarea", label: L("الكلام", "Text"), required: true },
    { key: "size", kind: "select", label: L("الحجم", "Size"), options: [opt("base", "عادي", "Normal"), opt("lead", "مميّز", "Lead"), opt("sm", "صغير", "Small")] },
  ],
  rich_text: [{ key: "text", kind: "rich", label: L("الكلام", "Text"), required: true }],
  image: [
    { key: "src", kind: "image", label: L("الصورة", "Image"), required: true },
    { key: "alt", kind: "text", label: L("وصف الصورة (للقارئ الصوتي وجوجل)", "Alt text (screen readers & SEO)") },
    {
      key: "ratio",
      kind: "select",
      label: L("الأبعاد", "Aspect ratio"),
      options: [opt("", "زي الصورة", "Original"), opt("1/1", "مربعة 1:1", "Square 1:1"), opt("4/5", "4:5"), opt("3/4", "3:4"), opt("4/3", "4:3"), opt("3/2", "3:2"), opt("16/9", "16:9"), opt("21/9", "21:9")],
    },
    { key: "shape", kind: "select", label: L("الشكل", "Shape"), options: [opt("", "عادي", "Normal"), opt("circle", "دايرة", "Circle")] },
    { key: "href", kind: "link", label: L("لينك عند الضغط", "Link on click") },
  ],
  gallery: [
    TITLE,
    { key: "images", kind: "images", label: L("الصور", "Images"), required: true },
    { key: "columns", kind: "number", label: L("عدد الأعمدة", "Columns"), min: 1, max: 6, defaultValue: 3 },
  ],
  button: [
    { key: "label", kind: "text", label: L("كلام الزرار", "Label"), required: true },
    { key: "href", kind: "link", label: L("اللينك", "Link"), required: true },
    {
      key: "variant",
      kind: "select",
      label: L("الشكل", "Style"),
      options: [opt("primary", "أساسي", "Primary"), opt("secondary", "مساعد", "Secondary"), opt("outline", "إطار", "Outline"), opt("link", "لينك", "Link"), opt("light", "فاتح", "Light")],
    },
    { key: "size", kind: "select", label: L("الحجم", "Size"), options: [opt("md", "عادي", "Normal"), opt("lg", "كبير", "Large")] },
    { key: "icon", kind: "select", label: L("أيقونة", "Icon"), options: ICON_OPTIONS },
  ],
  video: [
    TITLE,
    { key: "url", kind: "text", label: L("رابط الفيديو", "Video link"), hint: L("يوتيوب أو فيميو أو ملف mp4", "YouTube, Vimeo or an .mp4 file"), required: true },
    { key: "poster", kind: "image", label: L("صورة الغلاف", "Poster image") },
  ],
  embed: [TITLE, { key: "url", kind: "text", label: L("الرابط (https بس)", "URL (https only)"), required: true }],
  spacer: [{ key: "height", kind: "number", label: L("الارتفاع (بكسل)", "Height (px)"), min: 4, max: 400, defaultValue: 48 }],
  divider: [{ key: "style", kind: "select", label: L("الشكل", "Style"), options: [opt("solid", "خط", "Solid"), opt("dashed", "متقطّع", "Dashed"), opt("short", "قصير", "Short")] }],
  icon: [
    { key: "name", kind: "select", label: L("الأيقونة", "Icon"), options: ICON_OPTIONS },
    { key: "size", kind: "number", label: L("الحجم", "Size"), min: 12, max: 120, defaultValue: 28 },
    { key: "style", kind: "select", label: L("الشكل", "Style"), options: [opt("badge", "في دايرة", "Badge"), opt("plain", "لوحدها", "Plain")] },
    { key: "label", kind: "text", label: L("وصف للقارئ الصوتي", "Accessible label") },
  ],
  list: [
    TITLE,
    { key: "items", kind: "strList", label: L("النقاط", "Items"), required: true },
    { key: "style", kind: "select", label: L("الشكل", "Style"), options: [opt("check", "علامة صح", "Check"), opt("dot", "نقطة", "Dot"), opt("number", "أرقام", "Numbers")] },
  ],
  accordion: QA,
  faq: QA,
  testimonial: [
    { key: "quote", kind: "textarea", label: L("رأي العميل", "Quote"), required: true, hint: L("اكتب رأي حقيقي بس", "Real quotes only") },
    { key: "author", kind: "text", label: L("الاسم", "Name") },
    { key: "role", kind: "text", label: L("المدينة أو الوصف", "City or role") },
    { key: "rating", kind: "number", label: L("التقييم (0-5)", "Rating (0-5)"), min: 0, max: 5, defaultValue: 0 },
  ],
  countdown: [
    { key: "endsAt", kind: "datetime", label: L("العرض بينتهي", "Offer ends"), required: true },
    { key: "label", kind: "text", label: L("الكلام فوق العداد", "Label") },
  ],
  form: [TITLE, { key: "submitLabel", kind: "text", label: L("كلام زرار الإرسال", "Submit label") }],
  map: [TITLE, { key: "address", kind: "textarea", label: L("العنوان", "Address"), required: true }],
  social_icons: [{ key: "links", kind: "links", label: L("اللينكات", "Links"), required: true }],
  product_card: [
    { key: "productId", kind: "product", label: L("المنتج", "Product") },
    TITLE,
    { key: "variant", kind: "select", label: L("الشكل", "Layout"), options: [opt("card", "كارت", "Card"), opt("landing", "صفحة بيع مع فورم الطلب", "Landing with order form")] },
    { key: "showPrice", kind: "toggle", label: L("إظهار السعر", "Show price"), defaultValue: true },
    { key: "showBuyButton", kind: "toggle", label: L("زرار ضيف للسلة", "Add-to-cart button"), defaultValue: true },
  ],
  product_list: [
    TITLE,
    { key: "collectionId", kind: "collection", label: L("من قسم", "From collection") },
    { key: "limit", kind: "number", label: L("عدد المنتجات", "Number of products"), min: 1, max: 48, defaultValue: 8 },
    { key: "columns", kind: "number", label: L("الأعمدة", "Columns"), min: 1, max: 6, defaultValue: 4 },
  ],
  collection_list: [
    TITLE,
    { key: "limit", kind: "number", label: L("عدد الأقسام", "Number of collections"), min: 1, max: 24, defaultValue: 6 },
    { key: "columns", kind: "number", label: L("الأعمدة", "Columns"), min: 1, max: 6, defaultValue: 3 },
  ],
  cart: [TITLE],
};

export const TABLE_FIELDS: FieldDef[] = [{ key: "text", kind: "table", label: L("الجدول", "Table"), required: true }];

/** Palette order in the Add tab. */
export const ELEMENT_PALETTE: ElementType[] = [
  "heading",
  "text",
  "rich_text",
  "button",
  "image",
  "gallery",
  "video",
  "list",
  "faq",
  "testimonial",
  "countdown",
  "icon",
  "spacer",
  "divider",
  "map",
  "social_icons",
  "form",
  "product_card",
  "product_list",
  "collection_list",
  "cart",
  "embed",
];

export function createElement(type: ElementType, locale: RendererLocale): TreeElement {
  const id = createIdFactory(`el${Math.random().toString(36).slice(2, 7)}`)(type);
  const t = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const props: Record<ElementType, Record<string, unknown>> = {
    heading: { text: t("اكتب العنوان هنا", "Write your heading"), level: 2 },
    text: { text: t("اكتب الكلام هنا", "Write your text here") },
    rich_text: { text: t("اكتب هنا الكلام بالتفصيل.", "Write your text in detail.") },
    button: { label: t("اطلب الآن", "Order now"), href: "/?search=1#products", variant: "primary", size: "md" },
    image: { src: "", alt: "", placeholder: true },
    gallery: { images: [], placeholderCount: 3, columns: 3 },
    video: { url: "", placeholder: true },
    embed: { url: "" },
    spacer: { height: 32 },
    divider: { style: "solid" },
    icon: { name: "sparkle", size: 32, style: "badge" },
    list: { items: [t("اكتب نقطة", "First point"), t("اكتب نقطة تانية", "Second point")], style: "check" },
    accordion: { items: [{ q: t("اكتب السؤال", "Question"), a: t("اكتب الإجابة", "Answer") }] },
    faq: { items: [{ q: t("اكتب السؤال", "Question"), a: t("اكتب الإجابة", "Answer") }] },
    testimonial: { quote: "", author: "", rating: 0 },
    countdown: { endsAt: "", label: t("العرض ينتهي خلال", "Offer ends in") },
    form: { title: t("ابعتلنا رسالة", "Send us a message") },
    map: { address: "" },
    social_icons: { links: [] },
    product_card: { productId: "", title: "", showPrice: true, showBuyButton: true, variant: "card" },
    product_list: { title: "", source: "newest", limit: 8, columns: 4 },
    collection_list: { title: "", limit: 6, columns: 3 },
    cart: { title: "" },
  };
  return { id, type, props: props[type] };
}

/** Human page name: theme pages get their friendly title, others their own. */
export function pageDisplayName(page: { title: string; path: string }, locale: RendererLocale): string {
  const key = (Object.keys(THEME_PAGE_PATHS) as ThemePageKey[]).find((k) => THEME_PAGE_PATHS[k] === page.path);
  return key ? THEME_PAGE_TITLES[key][locale] : page.title || page.path;
}

import {
  AlignLeft,
  ChevronDown,
  CircleDot,
  Code2,
  Columns3,
  FormInput,
  Grid3x3,
  Heading1,
  HelpCircle,
  Image,
  Images,
  LayoutGrid,
  List,
  Map,
  Minus,
  MousePointerClick,
  MoveVertical,
  Quote,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Timer,
  Type,
  Video,
  type LucideIcon,
} from "lucide-react";
import type {
  PageColumn,
  PageElement,
  PageElementType,
  PageRow,
  PageSection,
  PageTree,
} from "@store-builder/api-client";
import type { Locale } from "@/i18n/LocaleContext";

/**
 * The editor's model of the backend page tree (modules/pages/pageTree.js).
 *
 * Two things about that tree drive every decision here:
 *
 *  1. Sections are NOT typed. `section.type` is always the literal "section" —
 *     there is no hero/footer discriminator. The only typed nodes are the leaf
 *     `elements`, and their types come from a fixed backend allowlist of 23.
 *     So a "block" in the UI is a *preset*: a section wrapping one row, one
 *     full-width column, and one or more elements.
 *  2. The seeded templates build every section through the same `oneCol`
 *     helper (one row → one span-12 column), so the trees we read back are
 *     always single-column. We write the same shape, and the canvas renders a
 *     section by flattening it — that way a hand-authored multi-column tree
 *     still displays and still round-trips unharmed.
 *
 * All merchant-facing labels here are bilingual (`L10n`) and resolved with
 * `tr(text, locale)`. Only editor chrome is localized — `defaultProps` are
 * saved into the merchant's page tree and stay exactly as they were.
 */

/** A UI string in both dashboard languages. */
export interface L10n {
  en: string;
  ar: string;
}

export function tr(text: L10n, locale: Locale): string {
  return text[locale];
}

// ---------------------------------------------------------------------------
// Field descriptors — what the inspector renders for one element's props
// ---------------------------------------------------------------------------

interface FieldBase {
  key: string;
  label: L10n;
  hint?: L10n;
}

export type FieldSpec =
  /** `ltr` marks technical values (URLs, paths, ids) that read left-to-right. */
  | (FieldBase & { kind: "text"; placeholder?: string; ltr?: boolean })
  | (FieldBase & { kind: "textarea"; placeholder?: string })
  | (FieldBase & { kind: "number"; min?: number; max?: number })
  | (FieldBase & { kind: "boolean" })
  | (FieldBase & { kind: "select"; options: Array<{ value: string; label: L10n }> })
  | (FieldBase & { kind: "image" })
  | (FieldBase & { kind: "stringList"; itemLabel: L10n })
  | (FieldBase & { kind: "imageList" })
  | (FieldBase & { kind: "qaList" })
  | (FieldBase & { kind: "linkList" });

interface ElementSpec {
  label: L10n;
  icon: LucideIcon;
  defaultProps: Record<string, unknown>;
  fields: FieldSpec[];
}

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: { en: `H${n}`, ar: `H${n}` },
}));

// Field labels reused across many element types.
const L_TEXT: L10n = { en: "Text", ar: "النص" };
const L_TITLE: L10n = { en: "Title", ar: "العنوان" };
const L_LINKS_TO: L10n = { en: "Links to", ar: "يوجّه إلى" };
const L_COLUMNS: L10n = { en: "Columns", ar: "عدد الأعمدة" };
const L_HOW_MANY: L10n = { en: "How many", ar: "العدد" };
const L_STYLE: L10n = { en: "Style", ar: "النمط" };

/**
 * One entry per allowed element type. `defaultProps` mirrors the props the
 * seeded templates actually use, so a block added here looks like a block that
 * came from a template.
 */
export const ELEMENT_SPECS: Record<PageElementType, ElementSpec> = {
  heading: {
    label: { en: "Heading", ar: "عنوان" },
    icon: Heading1,
    defaultProps: { text: "New heading", level: 2 },
    fields: [
      { key: "text", label: L_TEXT, kind: "text" },
      { key: "level", label: { en: "Level", ar: "المستوى" }, kind: "select", options: HEADING_LEVELS },
    ],
  },
  text: {
    label: { en: "Text", ar: "نص" },
    icon: AlignLeft,
    defaultProps: { text: "Write something about your store." },
    fields: [{ key: "text", label: L_TEXT, kind: "textarea" }],
  },
  rich_text: {
    label: { en: "Long text", ar: "نص طويل" },
    icon: Type,
    defaultProps: { text: "" },
    fields: [
      {
        key: "text",
        label: L_TEXT,
        kind: "textarea",
        hint: {
          en: "Plain text only in this editor — formatting controls come later.",
          ar: "نص عادي فقط في هذا المحرّر — أدوات التنسيق ستتوفر لاحقًا.",
        },
      },
    ],
  },
  image: {
    label: { en: "Image", ar: "صورة" },
    icon: Image,
    defaultProps: { src: "", alt: "" },
    fields: [
      { key: "src", label: { en: "Image", ar: "الصورة" }, kind: "image" },
      {
        key: "alt",
        label: { en: "Alt text", ar: "النص البديل" },
        kind: "text",
        hint: { en: "Describes the image to screen readers.", ar: "يصف الصورة لقارئات الشاشة." },
      },
      { key: "href", label: L_LINKS_TO, kind: "text", placeholder: "/products", ltr: true },
    ],
  },
  gallery: {
    label: { en: "Gallery", ar: "معرض صور" },
    icon: Images,
    defaultProps: { title: "Gallery", images: [], columns: 3 },
    fields: [
      { key: "title", label: L_TITLE, kind: "text" },
      { key: "images", label: { en: "Images", ar: "الصور" }, kind: "imageList" },
      { key: "columns", label: L_COLUMNS, kind: "number", min: 1, max: 6 },
    ],
  },
  button: {
    label: { en: "Button", ar: "زر" },
    icon: MousePointerClick,
    defaultProps: { label: "Shop now", href: "/products", variant: "primary" },
    fields: [
      { key: "label", label: { en: "Button text", ar: "نص الزر" }, kind: "text" },
      { key: "href", label: L_LINKS_TO, kind: "text", placeholder: "/products", ltr: true },
      {
        key: "variant",
        label: L_STYLE,
        kind: "select",
        options: [
          { value: "primary", label: { en: "Primary", ar: "أساسي" } },
          { value: "secondary", label: { en: "Secondary", ar: "ثانوي" } },
          { value: "outline", label: { en: "Outline", ar: "بإطار" } },
        ],
      },
    ],
  },
  video: {
    label: { en: "Video", ar: "فيديو" },
    icon: Video,
    defaultProps: { url: "", title: "" },
    fields: [
      {
        key: "url",
        label: { en: "Video URL", ar: "رابط الفيديو (URL)" },
        kind: "text",
        placeholder: "https://youtube.com/watch?v=…",
        ltr: true,
      },
      { key: "title", label: L_TITLE, kind: "text" },
    ],
  },
  embed: {
    label: { en: "Embed", ar: "تضمين" },
    icon: Code2,
    defaultProps: { url: "", title: "" },
    fields: [
      {
        key: "url",
        label: { en: "Embed URL", ar: "رابط التضمين (URL)" },
        kind: "text",
        ltr: true,
        hint: {
          en: "A URL to embed. Raw HTML is rejected by the server.",
          ar: "رابط للتضمين. الخادم يرفض أكواد HTML المباشرة.",
        },
      },
      { key: "title", label: L_TITLE, kind: "text" },
    ],
  },
  spacer: {
    label: { en: "Spacer", ar: "مسافة فارغة" },
    icon: MoveVertical,
    defaultProps: { height: 48 },
    fields: [
      { key: "height", label: { en: "Height (px)", ar: "الارتفاع (px)" }, kind: "number", min: 4, max: 400 },
    ],
  },
  divider: {
    label: { en: "Divider", ar: "فاصل" },
    icon: Minus,
    defaultProps: {},
    fields: [
      {
        key: "style",
        label: L_STYLE,
        kind: "select",
        options: [
          { value: "solid", label: { en: "Solid", ar: "متصل" } },
          { value: "dashed", label: { en: "Dashed", ar: "متقطع" } },
        ],
      },
    ],
  },
  icon: {
    label: { en: "Icon", ar: "أيقونة" },
    icon: CircleDot,
    defaultProps: { name: "star", size: 32 },
    fields: [
      { key: "name", label: { en: "Icon name", ar: "اسم الأيقونة" }, kind: "text", placeholder: "star", ltr: true },
      { key: "size", label: { en: "Size (px)", ar: "الحجم (px)" }, kind: "number", min: 8, max: 200 },
    ],
  },
  list: {
    label: { en: "List", ar: "قائمة" },
    icon: List,
    defaultProps: { title: "", items: [] },
    fields: [
      { key: "title", label: L_TITLE, kind: "text" },
      {
        key: "items",
        label: { en: "Items", ar: "العناصر" },
        kind: "stringList",
        itemLabel: { en: "Item", ar: "عنصر" },
      },
    ],
  },
  accordion: {
    label: { en: "Accordion", ar: "قائمة قابلة للطي" },
    icon: ChevronDown,
    defaultProps: { title: "", items: [] },
    fields: [
      { key: "title", label: L_TITLE, kind: "text" },
      { key: "items", label: { en: "Rows", ar: "الصفوف" }, kind: "qaList" },
    ],
  },
  faq: {
    label: { en: "FAQ", ar: "الأسئلة الشائعة" },
    icon: HelpCircle,
    defaultProps: { title: "الأسئلة الشائعة", items: [] },
    fields: [
      { key: "title", label: L_TITLE, kind: "text" },
      { key: "items", label: { en: "Questions", ar: "الأسئلة" }, kind: "qaList" },
    ],
  },
  testimonial: {
    label: { en: "Testimonial", ar: "رأي عميل" },
    icon: Quote,
    defaultProps: { quote: "", author: "", rating: 5 },
    fields: [
      { key: "quote", label: { en: "Quote", ar: "نص الرأي" }, kind: "textarea" },
      { key: "author", label: { en: "Author", ar: "اسم العميل" }, kind: "text" },
      { key: "rating", label: { en: "Rating", ar: "التقييم" }, kind: "number", min: 0, max: 5 },
    ],
  },
  countdown: {
    label: { en: "Countdown", ar: "عدّاد تنازلي" },
    icon: Timer,
    defaultProps: { label: "ينتهي العرض خلال", endsInHours: 24 },
    fields: [
      { key: "label", label: { en: "Label", ar: "النص المرافق" }, kind: "text" },
      {
        key: "endsInHours",
        label: { en: "Ends in (hours)", ar: "ينتهي خلال (ساعات)" },
        kind: "number",
        min: 1,
        max: 8760,
      },
    ],
  },
  form: {
    label: { en: "Form", ar: "نموذج" },
    icon: FormInput,
    defaultProps: { title: "", submitLabel: "Send" },
    fields: [
      { key: "title", label: L_TITLE, kind: "text" },
      { key: "submitLabel", label: { en: "Submit button text", ar: "نص زر الإرسال" }, kind: "text" },
    ],
  },
  map: {
    label: { en: "Map", ar: "خريطة" },
    icon: Map,
    defaultProps: { address: "", zoom: 14 },
    fields: [
      { key: "address", label: { en: "Address", ar: "العنوان" }, kind: "text" },
      { key: "zoom", label: { en: "Zoom", ar: "درجة التكبير" }, kind: "number", min: 1, max: 20 },
    ],
  },
  social_icons: {
    label: { en: "Social links", ar: "روابط التواصل الاجتماعي" },
    icon: Share2,
    defaultProps: { links: [] },
    fields: [{ key: "links", label: { en: "Links", ar: "الروابط" }, kind: "linkList" }],
  },
  product_card: {
    label: { en: "Single product", ar: "منتج واحد" },
    icon: ShoppingBag,
    defaultProps: { title: "", showPrice: true, showBuyButton: true },
    fields: [
      { key: "title", label: L_TITLE, kind: "text" },
      {
        key: "productId",
        label: { en: "Product ID", ar: "معرّف المنتج (ID)" },
        kind: "text",
        ltr: true,
        hint: {
          en: "Leave empty to use the newest product.",
          ar: "اتركه فارغًا لعرض أحدث منتج.",
        },
      },
      { key: "showPrice", label: { en: "Show price", ar: "إظهار السعر" }, kind: "boolean" },
      { key: "showBuyButton", label: { en: "Show buy button", ar: "إظهار زر الشراء" }, kind: "boolean" },
    ],
  },
  product_list: {
    label: { en: "Product grid", ar: "شبكة منتجات" },
    icon: LayoutGrid,
    defaultProps: { title: "Featured products", source: "newest", limit: 8, columns: 4 },
    fields: [
      { key: "title", label: L_TITLE, kind: "text" },
      {
        key: "source",
        label: { en: "Show", ar: "المنتجات المعروضة" },
        kind: "select",
        options: [
          { value: "newest", label: { en: "Newest", ar: "الأحدث" } },
          { value: "featured", label: { en: "Featured", ar: "المميّزة" } },
          { value: "best_selling", label: { en: "Best selling", ar: "الأكثر مبيعًا" } },
        ],
      },
      { key: "limit", label: L_HOW_MANY, kind: "number", min: 1, max: 48 },
      { key: "columns", label: L_COLUMNS, kind: "number", min: 1, max: 6 },
    ],
  },
  collection_list: {
    label: { en: "Collections", ar: "المجموعات" },
    icon: Grid3x3,
    defaultProps: { title: "Shop by collection", limit: 6, columns: 3 },
    fields: [
      { key: "title", label: L_TITLE, kind: "text" },
      { key: "limit", label: L_HOW_MANY, kind: "number", min: 1, max: 24 },
      { key: "columns", label: L_COLUMNS, kind: "number", min: 1, max: 6 },
    ],
  },
  cart: {
    label: { en: "Cart", ar: "سلة التسوق" },
    icon: ShoppingCart,
    defaultProps: { title: "Your cart" },
    fields: [{ key: "title", label: L_TITLE, kind: "text" }],
  },
};

// ---------------------------------------------------------------------------
// Block presets — what the left sidebar offers
// ---------------------------------------------------------------------------

export type BlockGroup = "Layout" | "Content" | "Media" | "Commerce";

export interface BlockPreset {
  /** Stable key, also the id prefix of the section it creates. */
  key: string;
  label: L10n;
  description: L10n;
  icon: LucideIcon;
  group: BlockGroup;
  /** The element types this preset drops into one full-width column. */
  elements: PageElementType[];
}

export const BLOCK_PRESETS: BlockPreset[] = [
  {
    key: "hero",
    label: { en: "Hero", ar: "واجهة رئيسية" },
    description: {
      en: "Big heading, a line of text and a call-to-action button.",
      ar: "عنوان كبير وسطر نصي وزر دعوة لاتخاذ إجراء.",
    },
    icon: Sparkles,
    group: "Layout",
    elements: ["heading", "text", "button"],
  },
  {
    key: "heading",
    label: { en: "Heading", ar: "عنوان" },
    description: { en: "A standalone section title.", ar: "عنوان مستقل لقسم." },
    icon: Heading1,
    group: "Content",
    elements: ["heading"],
  },
  {
    key: "text",
    label: { en: "Text", ar: "نص" },
    description: { en: "A paragraph of copy.", ar: "فقرة نصية." },
    icon: AlignLeft,
    group: "Content",
    elements: ["text"],
  },
  {
    key: "rich-text",
    label: { en: "Long text", ar: "نص طويل" },
    description: { en: "A longer block of copy.", ar: "كتلة نصية أطول." },
    icon: Type,
    group: "Content",
    elements: ["rich_text"],
  },
  {
    key: "list",
    label: { en: "List", ar: "قائمة" },
    description: { en: "A bulleted list of points.", ar: "قائمة نقاط." },
    icon: List,
    group: "Content",
    elements: ["list"],
  },
  {
    key: "button",
    label: { en: "Button", ar: "زر" },
    description: { en: "A single call-to-action button.", ar: "زر واحد لدعوة العميل لاتخاذ إجراء." },
    icon: MousePointerClick,
    group: "Content",
    elements: ["button"],
  },
  {
    key: "testimonial",
    label: { en: "Testimonial", ar: "رأي عميل" },
    description: { en: "A customer quote with a rating.", ar: "رأي أحد العملاء مع تقييم." },
    icon: Quote,
    group: "Content",
    elements: ["testimonial"],
  },
  {
    key: "faq",
    label: { en: "FAQ", ar: "الأسئلة الشائعة" },
    description: { en: "Question-and-answer pairs.", ar: "أسئلة مع إجاباتها." },
    icon: HelpCircle,
    group: "Content",
    elements: ["faq"],
  },
  {
    key: "accordion",
    label: { en: "Accordion", ar: "قائمة قابلة للطي" },
    description: { en: "Collapsible rows of content.", ar: "صفوف محتوى قابلة للطي والفتح." },
    icon: ChevronDown,
    group: "Content",
    elements: ["accordion"],
  },
  {
    key: "form",
    label: { en: "Form", ar: "نموذج" },
    description: { en: "A contact or sign-up form.", ar: "نموذج تواصل أو تسجيل." },
    icon: FormInput,
    group: "Content",
    elements: ["form"],
  },
  {
    key: "image",
    label: { en: "Image", ar: "صورة" },
    description: { en: "One image, optionally linked.", ar: "صورة واحدة، مع رابط اختياري." },
    icon: Image,
    group: "Media",
    elements: ["image"],
  },
  {
    key: "gallery",
    label: { en: "Gallery", ar: "معرض صور" },
    description: { en: "A grid of images.", ar: "شبكة من الصور." },
    icon: Images,
    group: "Media",
    elements: ["gallery"],
  },
  {
    key: "video",
    label: { en: "Video", ar: "فيديو" },
    description: { en: "An embedded video.", ar: "فيديو مضمَّن." },
    icon: Video,
    group: "Media",
    elements: ["video"],
  },
  {
    key: "embed",
    label: { en: "Embed", ar: "تضمين" },
    description: { en: "Embed an external page by URL.", ar: "تضمين صفحة خارجية عبر رابط URL." },
    icon: Code2,
    group: "Media",
    elements: ["embed"],
  },
  {
    key: "map",
    label: { en: "Map", ar: "خريطة" },
    description: { en: "Show your address on a map.", ar: "اعرض عنوانك على الخريطة." },
    icon: Map,
    group: "Media",
    elements: ["map"],
  },
  {
    key: "icon",
    label: { en: "Icon", ar: "أيقونة" },
    description: { en: "A single decorative icon.", ar: "أيقونة زخرفية واحدة." },
    icon: CircleDot,
    group: "Media",
    elements: ["icon"],
  },
  {
    key: "social",
    label: { en: "Social links", ar: "روابط التواصل الاجتماعي" },
    description: { en: "Links to your social profiles.", ar: "روابط لحساباتك على مواقع التواصل." },
    icon: Share2,
    group: "Media",
    elements: ["social_icons"],
  },
  {
    key: "products",
    label: { en: "Product grid", ar: "شبكة منتجات" },
    description: { en: "A grid of products from your catalog.", ar: "شبكة من منتجات متجرك." },
    icon: LayoutGrid,
    group: "Commerce",
    elements: ["product_list"],
  },
  {
    key: "offer",
    label: { en: "Single product", ar: "منتج واحد" },
    description: { en: "Spotlight one product with a buy button.", ar: "إبراز منتج واحد مع زر شراء." },
    icon: ShoppingBag,
    group: "Commerce",
    elements: ["product_card"],
  },
  {
    key: "collections",
    label: { en: "Collections", ar: "المجموعات" },
    description: { en: "Let shoppers browse by collection.", ar: "يتيح للعملاء التصفح حسب المجموعة." },
    icon: Grid3x3,
    group: "Commerce",
    elements: ["collection_list"],
  },
  {
    key: "countdown",
    label: { en: "Countdown", ar: "عدّاد تنازلي" },
    description: { en: "An urgency timer for a limited offer.", ar: "عدّاد يحفّز الشراء لعرض محدود." },
    icon: Timer,
    group: "Commerce",
    elements: ["countdown"],
  },
  {
    key: "cart",
    label: { en: "Cart", ar: "سلة التسوق" },
    description: { en: "The shopper's cart contents.", ar: "محتويات سلة العميل." },
    icon: ShoppingCart,
    group: "Commerce",
    elements: ["cart"],
  },
  {
    key: "divider",
    label: { en: "Divider", ar: "فاصل" },
    description: { en: "A horizontal rule between sections.", ar: "خط أفقي يفصل بين الأقسام." },
    icon: Minus,
    group: "Layout",
    elements: ["divider"],
  },
  {
    key: "spacer",
    label: { en: "Spacer", ar: "مسافة فارغة" },
    description: { en: "Vertical breathing room.", ar: "مساحة رأسية فارغة." },
    icon: MoveVertical,
    group: "Layout",
    elements: ["spacer"],
  },
];

export const BLOCK_GROUPS: BlockGroup[] = ["Layout", "Content", "Media", "Commerce"];

export const BLOCK_GROUP_LABELS: Record<Locale, Record<BlockGroup, string>> = {
  en: { Layout: "Layout", Content: "Content", Media: "Media", Commerce: "Commerce" },
  ar: { Layout: "التخطيط", Content: "المحتوى", Media: "الوسائط", Commerce: "التجارة" },
};

// ---------------------------------------------------------------------------
// Tree construction + immutable edits
// ---------------------------------------------------------------------------

/**
 * Ids only have to be non-empty strings server-side, but the seeded templates
 * use fixed slugs ("hero-h", "hero-btn"), so adding a second hero would collide
 * on the client where we key by id. Every id we mint gets a random suffix.
 */
function uid(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10);
  return `${prefix}-${rand}`;
}

function createElement(type: PageElementType): PageElement {
  return { id: uid(type), type, props: { ...ELEMENT_SPECS[type].defaultProps } };
}

/** One section → one row → one span-12 column, matching the seeder's `oneCol`. */
export function createSection(preset: BlockPreset): PageSection {
  const base = uid(preset.key);
  const column: PageColumn = {
    id: `${base}-c`,
    type: "column",
    span: 12,
    elements: preset.elements.map(createElement),
  };
  const row: PageRow = { id: `${base}-r`, type: "row", columns: [column] };
  return { id: base, type: "section", rows: [row] };
}

/** Every element in a section, in document order, across all rows/columns. */
export function sectionElements(section: PageSection): PageElement[] {
  return (section.rows ?? []).flatMap((row) =>
    (row.columns ?? []).flatMap((col) => col.elements ?? [])
  );
}

const SECTION_LABEL_TEXT: Record<Locale, { empty: string; more: string }> = {
  en: { empty: "Empty section", more: "{label} + {n} more" },
  ar: { empty: "قسم فارغ", more: "{label} + {n} أخرى" },
};

/**
 * A display name for a section. The tree has no section type, so this reads
 * the elements: an exact preset match wins (that's how a template's hero gets
 * called "Hero"), otherwise fall back to the first element's own label.
 */
export function sectionLabel(section: PageSection, locale: Locale = "en"): string {
  const types = sectionElements(section).map((el) => el.type);
  const text = SECTION_LABEL_TEXT[locale];
  if (types.length === 0) return text.empty;
  const match = BLOCK_PRESETS.find(
    (p) => p.elements.length === types.length && p.elements.every((t, i) => t === types[i])
  );
  if (match) return tr(match.label, locale);
  const first = tr(ELEMENT_SPECS[types[0]].label, locale);
  return types.length === 1
    ? first
    : text.more.replace("{label}", first).replace("{n}", String(types.length - 1));
}

export function sectionIcon(section: PageSection): LucideIcon {
  const types = sectionElements(section).map((el) => el.type);
  const match = BLOCK_PRESETS.find(
    (p) => p.elements.length === types.length && p.elements.every((t, i) => t === types[i])
  );
  if (match) return match.icon;
  return types.length > 0 ? ELEMENT_SPECS[types[0]].icon : Columns3;
}

/** Replaces one element (matched by id) anywhere in the section. */
export function replaceElement(
  section: PageSection,
  elementId: string,
  next: PageElement
): PageSection {
  return {
    ...section,
    rows: (section.rows ?? []).map((row) => ({
      ...row,
      columns: (row.columns ?? []).map((col) => ({
        ...col,
        elements: (col.elements ?? []).map((el) => (el.id === elementId ? next : el)),
      })),
    })),
  };
}

export function setElementProp(
  section: PageSection,
  element: PageElement,
  key: string,
  value: unknown
): PageSection {
  const props = { ...(element.props ?? {}), [key]: value };
  return replaceElement(section, element.id, { ...element, props });
}

export function moveSection(sections: PageSection[], from: number, to: number): PageSection[] {
  if (from === to || from < 0 || to < 0 || from >= sections.length || to >= sections.length) {
    return sections;
  }
  const next = sections.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Guards against a page whose `draftData` is null or predates the tree shape.
 * `version` and any `globalStyles` are carried through untouched — the editor
 * has no styling controls in this phase and must not drop what it can't edit.
 */
export function normalizeTree(data: unknown): PageTree {
  if (data && typeof data === "object" && Array.isArray((data as PageTree).sections)) {
    const tree = data as PageTree;
    return { ...tree, version: tree.version ?? 1, sections: tree.sections };
  }
  return { version: 1, sections: [] };
}

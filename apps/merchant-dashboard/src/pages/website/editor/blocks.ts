import {
  AlignLeft,
  BadgeCheck,
  Box,
  Camera,
  ChevronDown,
  CircleDot,
  Code2,
  Columns3,
  Contrast,
  FormInput,
  Gift,
  Grid3x3,
  Heading1,
  HelpCircle,
  Image,
  Images,
  Layers,
  LayoutGrid,
  List,
  Map,
  Megaphone,
  MessageSquareQuote,
  Minus,
  MousePointerClick,
  MoveVertical,
  Orbit,
  Quote,
  Scale,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Table2,
  Timer,
  Truck,
  Type,
  Video,
  Waves,
  Zap,
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
import { editorUi, elementLabel, presetText, type EditorLocale } from "./editorLocale";

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
 */

// ---------------------------------------------------------------------------
// Field descriptors — what the inspector renders for one element's props
// ---------------------------------------------------------------------------

export type FieldSpec =
  | { key: string; label: string; kind: "text"; placeholder?: string; hint?: string }
  | { key: string; label: string; kind: "textarea"; placeholder?: string; hint?: string }
  | { key: string; label: string; kind: "number"; min?: number; max?: number; hint?: string }
  | { key: string; label: string; kind: "boolean"; hint?: string }
  | {
      key: string;
      label: string;
      kind: "select";
      options: Array<{ value: string; label: string }>;
      hint?: string;
    }
  | { key: string; label: string; kind: "image"; hint?: string }
  | { key: string; label: string; kind: "stringList"; itemLabel: string; hint?: string }
  | { key: string; label: string; kind: "imageList"; hint?: string }
  | { key: string; label: string; kind: "qaList"; hint?: string }
  | { key: string; label: string; kind: "stepList"; hint?: string }
  | { key: string; label: string; kind: "compareRows"; hint?: string }
  | { key: string; label: string; kind: "linkList"; hint?: string };

interface ElementSpec {
  label: string;
  icon: LucideIcon;
  defaultProps: Record<string, unknown>;
  fields: FieldSpec[];
}

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `H${n}` }));

/**
 * One entry per allowed element type. `defaultProps` mirrors the props the
 * seeded templates actually use, so a block added here looks like a block that
 * came from a template.
 */
export const ELEMENT_SPECS: Record<PageElementType, ElementSpec> = {
  heading: {
    label: "Heading",
    icon: Heading1,
    defaultProps: { text: "New heading", level: 2 },
    fields: [
      { key: "text", label: "Text", kind: "text" },
      { key: "level", label: "Level", kind: "select", options: HEADING_LEVELS },
    ],
  },
  text: {
    label: "Text",
    icon: AlignLeft,
    defaultProps: { text: "Write something about your store." },
    fields: [{ key: "text", label: "Text", kind: "textarea" }],
  },
  rich_text: {
    label: "Long text",
    icon: Type,
    defaultProps: { text: "" },
    fields: [
      {
        key: "text",
        label: "Text",
        kind: "textarea",
        hint: "Plain text only in this editor — formatting controls come later.",
      },
    ],
  },
  image: {
    label: "Image",
    icon: Image,
    defaultProps: { src: "", alt: "" },
    fields: [
      { key: "src", label: "Image", kind: "image" },
      { key: "alt", label: "Alt text", kind: "text", hint: "Describes the image to screen readers." },
      { key: "href", label: "Links to", kind: "text", placeholder: "/products" },
    ],
  },
  gallery: {
    label: "Gallery",
    icon: Images,
    defaultProps: { title: "Gallery", images: [], columns: 3 },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "images", label: "Images", kind: "imageList" },
      { key: "columns", label: "Columns", kind: "number", min: 1, max: 6 },
    ],
  },
  button: {
    label: "Button",
    icon: MousePointerClick,
    defaultProps: { label: "Shop now", href: "/products", variant: "primary" },
    fields: [
      { key: "label", label: "Button text", kind: "text" },
      { key: "href", label: "Links to", kind: "text", placeholder: "/products" },
      {
        key: "variant",
        label: "Style",
        kind: "select",
        options: [
          { value: "primary", label: "Primary" },
          { value: "secondary", label: "Secondary" },
          { value: "outline", label: "Outline" },
        ],
      },
    ],
  },
  video: {
    label: "Video",
    icon: Video,
    defaultProps: { url: "", title: "" },
    fields: [
      { key: "url", label: "Video URL", kind: "text", placeholder: "https://youtube.com/watch?v=…" },
      { key: "title", label: "Title", kind: "text" },
    ],
  },
  embed: {
    label: "Embed",
    icon: Code2,
    defaultProps: { url: "", title: "" },
    fields: [
      {
        key: "url",
        label: "Embed URL",
        kind: "text",
        hint: "A URL to embed. Raw HTML is rejected by the server.",
      },
      { key: "title", label: "Title", kind: "text" },
    ],
  },
  spacer: {
    label: "Spacer",
    icon: MoveVertical,
    defaultProps: { height: 48 },
    fields: [{ key: "height", label: "Height (px)", kind: "number", min: 4, max: 400 }],
  },
  divider: {
    label: "Divider",
    icon: Minus,
    defaultProps: {},
    fields: [
      {
        key: "style",
        label: "Style",
        kind: "select",
        options: [
          { value: "solid", label: "Solid" },
          { value: "dashed", label: "Dashed" },
        ],
      },
    ],
  },
  icon: {
    label: "Icon",
    icon: CircleDot,
    defaultProps: { name: "star", size: 32 },
    fields: [
      { key: "name", label: "Icon name", kind: "text", placeholder: "star" },
      { key: "size", label: "Size (px)", kind: "number", min: 8, max: 200 },
    ],
  },
  list: {
    label: "List",
    icon: List,
    defaultProps: { title: "", items: [] },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "items", label: "Items", kind: "stringList", itemLabel: "Item" },
    ],
  },
  accordion: {
    label: "Accordion",
    icon: ChevronDown,
    defaultProps: { title: "", items: [] },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "items", label: "Rows", kind: "qaList" },
    ],
  },
  faq: {
    label: "FAQ",
    icon: HelpCircle,
    defaultProps: { title: "الأسئلة الشائعة", items: [] },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "items", label: "Questions", kind: "qaList" },
    ],
  },
  testimonial: {
    label: "Testimonial",
    icon: Quote,
    defaultProps: { quote: "", author: "", rating: 5 },
    fields: [
      { key: "quote", label: "Quote", kind: "textarea" },
      { key: "author", label: "Author", kind: "text" },
      { key: "rating", label: "Rating", kind: "number", min: 0, max: 5 },
    ],
  },
  countdown: {
    label: "Countdown",
    icon: Timer,
    defaultProps: { label: "ينتهي العرض خلال", endsInHours: 24 },
    fields: [
      { key: "label", label: "Label", kind: "text" },
      { key: "endsInHours", label: "Ends in (hours)", kind: "number", min: 1, max: 8760 },
    ],
  },
  form: {
    label: "Form",
    icon: FormInput,
    defaultProps: { title: "", submitLabel: "Send" },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "submitLabel", label: "Submit button text", kind: "text" },
    ],
  },
  map: {
    label: "Map",
    icon: Map,
    defaultProps: { address: "", zoom: 14 },
    fields: [
      { key: "address", label: "Address", kind: "text" },
      { key: "zoom", label: "Zoom", kind: "number", min: 1, max: 20 },
    ],
  },
  social_icons: {
    label: "Social links",
    icon: Share2,
    defaultProps: { links: [] },
    fields: [{ key: "links", label: "Links", kind: "linkList" }],
  },
  product_card: {
    label: "Single product",
    icon: ShoppingBag,
    defaultProps: { title: "", showPrice: true, showBuyButton: true },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "productId", label: "Product ID", kind: "text", hint: "Leave empty to use the newest product." },
      { key: "showPrice", label: "Show price", kind: "boolean" },
      { key: "showBuyButton", label: "Show buy button", kind: "boolean" },
    ],
  },
  product_list: {
    label: "Product grid",
    icon: LayoutGrid,
    defaultProps: { title: "Featured products", source: "newest", limit: 8, columns: 4 },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      {
        key: "source",
        label: "Show",
        kind: "select",
        options: [
          { value: "newest", label: "Newest" },
          { value: "featured", label: "Featured" },
          { value: "best_selling", label: "Best selling" },
        ],
      },
      { key: "limit", label: "How many", kind: "number", min: 1, max: 48 },
      { key: "columns", label: "Columns", kind: "number", min: 1, max: 6 },
    ],
  },
  collection_list: {
    label: "Collections",
    icon: Grid3x3,
    defaultProps: { title: "Shop by collection", limit: 6, columns: 3 },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "limit", label: "How many", kind: "number", min: 1, max: 24 },
      { key: "columns", label: "Columns", kind: "number", min: 1, max: 6 },
    ],
  },
  cart: {
    label: "Cart",
    icon: ShoppingCart,
    defaultProps: { title: "Your cart" },
    fields: [{ key: "title", label: "Title", kind: "text" }],
  },

  // Immersive sections. Each one falls back to a still, readable version on a
  // slow connection, a weak device, or when the shopper asks for less motion —
  // so they are safe to put on a live store.
  shader_hero: {
    label: "Living hero",
    icon: Waves,
    defaultProps: { title: "", subtitle: "", ctaLabel: "", ctaHref: "/products", height: 460 },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "subtitle", label: "Subtitle", kind: "text" },
      { key: "ctaLabel", label: "Button text", kind: "text" },
      { key: "ctaHref", label: "Button links to", kind: "text", placeholder: "/products" },
      {
        key: "height",
        label: "Height",
        kind: "number",
        min: 260,
        max: 760,
        hint: "The background moves in your store's own colours.",
      },
    ],
  },
  product_3d: {
    label: "3D product",
    icon: Box,
    defaultProps: { title: "", productId: "", modelUrl: "" },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      {
        key: "productId",
        label: "Product",
        kind: "text",
        placeholder: "Product id or slug",
        hint: "Leave empty to use the newest product.",
      },
      {
        key: "modelUrl",
        label: "3D file (.glb)",
        kind: "text",
        hint: "Leave empty to use the GLB file uploaded with the product's images. Without one, this block is hidden.",
      },
    ],
  },
  orbit_gallery: {
    label: "Turning carousel",
    icon: Orbit,
    defaultProps: { title: "", limit: 8, collectionId: "" },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "limit", label: "How many", kind: "number", min: 3, max: 16 },
      { key: "collectionId", label: "Collection", kind: "text", hint: "Leave empty for the whole catalogue." },
    ],
  },
  scroll_story: {
    label: "Scroll story",
    icon: Layers,
    defaultProps: { title: "", steps: [] },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "steps", label: "Steps", kind: "stepList", hint: "Each step gets its own picture as the shopper scrolls." },
    ],
  },

  // Storefront sections. Plain HTML and CSS on the shop side — no 3D, no
  // canvas — so they cost a shopper nothing and work on any phone.
  marquee: {
    label: "Claims strip",
    icon: Megaphone,
    defaultProps: { items: [], speed: "normal", tone: "line" },
    fields: [
      {
        key: "items",
        label: "Claims",
        kind: "stringList",
        itemLabel: "Claim",
        hint: "A few words each. The strip pauses when the shopper hovers or tabs into it, and stands still for anyone who asked for less motion.",
      },
      {
        key: "speed",
        label: "Speed",
        kind: "select",
        options: [
          { value: "slow", label: "Slow" },
          { value: "normal", label: "Normal" },
          { value: "fast", label: "Fast" },
        ],
      },
      {
        key: "tone",
        label: "Style",
        kind: "select",
        options: [
          { value: "line", label: "Plain line" },
          { value: "primary", label: "Brand pills" },
        ],
      },
    ],
  },
  comparison: {
    label: "Comparison table",
    icon: Table2,
    defaultProps: { title: "", usLabel: "", themLabel: "", rows: [] },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "usLabel", label: "Your column", kind: "text" },
      { key: "themLabel", label: "Other column", kind: "text" },
      {
        key: "rows",
        label: "Rows",
        kind: "compareRows",
        hint: "Short text in each cell — or write yes or no to get a tick or a cross instead.",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Block presets — what the left sidebar offers
// ---------------------------------------------------------------------------

export interface BlockPreset {
  /** Stable key, also the id prefix of the section it creates. */
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "Layout" | "Content" | "Media" | "Commerce";
  /** The element types this preset drops into one full-width column. */
  elements: PageElementType[];
  /**
   * Optional starting props per element, aligned index-for-index with
   * `elements` and merged over that type's `defaultProps`. Without it two
   * presets built from the same element types would land identical on the
   * canvas, which is what makes a "library" of ready-made sections worth
   * having. A missing entry keeps the plain defaults, so the presets written
   * before this existed are untouched.
   *
   * Every string in here is starting copy the merchant replaces — it says what
   * to write, never what the store promises.
   */
  content?: Array<Record<string, unknown> | undefined>;
  /** Optional starting `section.settings` (see SECTION_SETTING_SPECS). */
  settings?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Section settings — the little bit of look a section carries itself
// ---------------------------------------------------------------------------

/**
 * `section.settings` is a free-form object the backend passes through
 * untouched (pageTree.js only ever checks node *structure*), so the storefront
 * reads it defensively and falls back to the look it always had. Each spec's
 * first option IS that current look, which is why "" and an unknown value both
 * mean "leave it alone".
 */
export interface SectionSettingSpec {
  key: string;
  label: string;
  /** The value that reproduces the storefront's default section look. */
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}

export const SECTION_SETTING_SPECS: SectionSettingSpec[] = [
  {
    key: "background",
    label: "Background",
    defaultValue: "none",
    options: [
      { value: "none", label: "None" },
      { value: "paper", label: "Paper" },
      { value: "raised", label: "Raised" },
      { value: "primary-soft", label: "Brand tint" },
    ],
  },
  {
    key: "padding",
    label: "Vertical space",
    defaultValue: "normal",
    options: [
      { value: "compact", label: "Compact" },
      { value: "normal", label: "Normal" },
      { value: "roomy", label: "Roomy" },
    ],
  },
  {
    key: "width",
    label: "Content width",
    defaultValue: "normal",
    options: [
      { value: "normal", label: "Normal" },
      { value: "wide", label: "Wide" },
      { value: "full", label: "Full width" },
    ],
  },
];

/** The stored value of one section setting, or "" when the section leaves it at the default. */
export function sectionSetting(section: PageSection, key: string): string {
  const settings: unknown = section.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return "";
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

/**
 * Sets one section setting. Choosing the default (or clearing the field) drops
 * the key instead of writing it, so a section the merchant never styled keeps
 * the `settings`-free shape the templates seed.
 */
export function setSectionSetting(section: PageSection, key: string, value: string): PageSection {
  const current: unknown = section.settings;
  const base: Record<string, unknown> =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};
  const spec = SECTION_SETTING_SPECS.find((s) => s.key === key);
  if (value === "" || value === spec?.defaultValue) delete base[key];
  else base[key] = value;
  const next: PageSection = { ...section };
  if (Object.keys(base).length === 0) delete next.settings;
  else next.settings = base;
  return next;
}

export const BLOCK_PRESETS: BlockPreset[] = [
  {
    key: "hero",
    label: "Hero",
    description: "Big heading, a line of text and a call-to-action button.",
    icon: Sparkles,
    group: "Layout",
    elements: ["heading", "text", "button"],
  },
  {
    key: "heading",
    label: "Heading",
    description: "A standalone section title.",
    icon: Heading1,
    group: "Content",
    elements: ["heading"],
  },
  {
    key: "text",
    label: "Text",
    description: "A paragraph of copy.",
    icon: AlignLeft,
    group: "Content",
    elements: ["text"],
  },
  {
    key: "rich-text",
    label: "Long text",
    description: "A longer block of copy.",
    icon: Type,
    group: "Content",
    elements: ["rich_text"],
  },
  {
    key: "list",
    label: "List",
    description: "A bulleted list of points.",
    icon: List,
    group: "Content",
    elements: ["list"],
  },
  {
    key: "button",
    label: "Button",
    description: "A single call-to-action button.",
    icon: MousePointerClick,
    group: "Content",
    elements: ["button"],
  },
  {
    key: "testimonial",
    label: "Testimonial",
    description: "A customer quote with a rating.",
    icon: Quote,
    group: "Content",
    elements: ["testimonial"],
  },
  {
    key: "faq",
    label: "FAQ",
    description: "Question-and-answer pairs.",
    icon: HelpCircle,
    group: "Content",
    elements: ["faq"],
  },
  {
    key: "accordion",
    label: "Accordion",
    description: "Collapsible rows of content.",
    icon: ChevronDown,
    group: "Content",
    elements: ["accordion"],
  },
  {
    key: "form",
    label: "Form",
    description: "A contact or sign-up form.",
    icon: FormInput,
    group: "Content",
    elements: ["form"],
  },
  {
    key: "image",
    label: "Image",
    description: "One image, optionally linked.",
    icon: Image,
    group: "Media",
    elements: ["image"],
  },
  {
    key: "gallery",
    label: "Gallery",
    description: "A grid of images.",
    icon: Images,
    group: "Media",
    elements: ["gallery"],
  },
  {
    key: "video",
    label: "Video",
    description: "An embedded video.",
    icon: Video,
    group: "Media",
    elements: ["video"],
  },
  {
    key: "embed",
    label: "Embed",
    description: "Embed an external page by URL.",
    icon: Code2,
    group: "Media",
    elements: ["embed"],
  },
  {
    key: "map",
    label: "Map",
    description: "Show your address on a map.",
    icon: Map,
    group: "Media",
    elements: ["map"],
  },
  {
    key: "icon",
    label: "Icon",
    description: "A single decorative icon.",
    icon: CircleDot,
    group: "Media",
    elements: ["icon"],
  },
  {
    key: "social",
    label: "Social links",
    description: "Links to your social profiles.",
    icon: Share2,
    group: "Media",
    elements: ["social_icons"],
  },
  {
    key: "products",
    label: "Product grid",
    description: "A grid of products from your catalog.",
    icon: LayoutGrid,
    group: "Commerce",
    elements: ["product_list"],
  },
  {
    key: "offer",
    label: "Single product",
    description: "Spotlight one product with a buy button.",
    icon: ShoppingBag,
    group: "Commerce",
    elements: ["product_card"],
  },
  {
    key: "collections",
    label: "Collections",
    description: "Let shoppers browse by collection.",
    icon: Grid3x3,
    group: "Commerce",
    elements: ["collection_list"],
  },
  {
    key: "countdown",
    label: "Countdown",
    description: "An urgency timer for a limited offer.",
    icon: Timer,
    group: "Commerce",
    elements: ["countdown"],
  },
  {
    key: "cart",
    label: "Cart",
    description: "The shopper's cart contents.",
    icon: ShoppingCart,
    group: "Commerce",
    elements: ["cart"],
  },
  {
    key: "divider",
    label: "Divider",
    description: "A horizontal rule between sections.",
    icon: Minus,
    group: "Layout",
    elements: ["divider"],
  },
  {
    key: "spacer",
    label: "Spacer",
    description: "Vertical breathing room.",
    icon: MoveVertical,
    group: "Layout",
    elements: ["spacer"],
  },
  {
    key: "living-hero",
    label: "Living hero",
    description: "An opening screen that moves slowly in your store's colours.",
    icon: Waves,
    group: "Layout",
    elements: ["shader_hero"],
  },
  {
    key: "product-3d",
    label: "3D product",
    description: "The shopper turns the product with a finger. Needs a .glb file.",
    icon: Box,
    group: "Commerce",
    elements: ["product_3d"],
  },
  {
    key: "orbit-gallery",
    label: "Turning carousel",
    description: "Products on a drum that turns, instead of a flat grid.",
    icon: Orbit,
    group: "Commerce",
    elements: ["orbit_gallery"],
  },
  {
    key: "scroll-story",
    label: "Scroll story",
    description: "Before and after, or how it's made — step by step as the page scrolls.",
    icon: Layers,
    group: "Content",
    elements: ["scroll_story"],
  },

  // -------------------------------------------------------------------------
  // Ready-made sections. Everything above drops a bare element with its own
  // defaults; everything below drops a section that already looks like a
  // section — starting copy per element, and the section settings that keep it
  // from reading as one more stack of text on white.
  //
  // The copy is Egyptian Arabic written AT the merchant ("اكتب هنا…"), never a
  // claim on the store's behalf: no names, no ratings, no delivery times, no
  // guarantees. Anything that would be a promise is left empty on purpose.
  // -------------------------------------------------------------------------
  {
    key: "hero-trust",
    label: "Hero with trust line",
    description: "An opening screen plus the few reasons a first-time shopper should trust you.",
    icon: ShieldCheck,
    group: "Layout",
    elements: ["heading", "text", "button", "list"],
    settings: { padding: "roomy" },
    content: [
      { text: "اكتب هنا الجملة اللي بتوصف متجرك في سطر", level: 1 },
      { text: "اشرح في سطرين بتبيع إيه ولمين، وسيب الباقي للمنتجات." },
      { label: "تسوّق دلوقتي", href: "/products", variant: "primary" },
      {
        title: "",
        items: [
          "اكتب هنا أول سبب يخلي العميل يثق فيك",
          "اكتب هنا سياسة الاستبدال أو الضمان بتاعتك",
          "اكتب هنا طريقة تواصلك مع العملاء",
        ],
      },
    ],
  },
  {
    key: "living-hero-intro",
    label: "Living hero with copy",
    description: "The moving opening screen, with a title, a line of text and a button already in it.",
    icon: Waves,
    group: "Layout",
    elements: ["shader_hero"],
    content: [
      {
        title: "اكتب هنا عنوان الواجهة",
        subtitle: "اكتب سطر واحد يوضّح إيه اللي يميّز متجرك.",
        ctaLabel: "تسوّق دلوقتي",
        ctaHref: "/products",
        height: 520,
      },
    ],
  },
  {
    key: "features",
    label: "Features row",
    description: "A short title and the benefits you want the shopper to remember.",
    icon: BadgeCheck,
    group: "Content",
    elements: ["heading", "text", "list"],
    settings: { background: "paper" },
    content: [
      { text: "ليه تختارنا", level: 2 },
      { text: "اكتب سطر تمهيدي قصير عن اللي بتقدّمه." },
      {
        title: "",
        items: ["اكتب الميزة الأولى", "اكتب الميزة التانية", "اكتب الميزة التالتة"],
      },
    ],
  },
  {
    key: "why-us",
    label: "Why buy from us",
    description: "Answers to what stops a shopper buying — one row per worry.",
    icon: Scale,
    group: "Content",
    elements: ["heading", "accordion"],
    settings: { background: "primary-soft", padding: "roomy" },
    content: [
      { text: "ليه تشتري من عندنا؟", level: 2 },
      {
        title: "",
        items: [
          {
            q: "اكتب هنا اللي بيقلق العميل قبل ما يشتري",
            a: "اكتب هنا إجابتك إنت — من غير ما تقارن بحد بالاسم.",
          },
          { q: "اكتب هنا نقطة تانية بتفرّقك", a: "اكتب هنا تفاصيلها." },
          { q: "اكتب هنا نقطة تالتة", a: "اكتب هنا تفاصيلها." },
        ],
      },
    ],
  },
  {
    key: "bundle-offer",
    label: "Bundles & offers",
    description: "A line about the bundle, the products in it and a button to the rest.",
    icon: Gift,
    group: "Commerce",
    elements: ["heading", "text", "product_list", "button"],
    settings: { background: "paper" },
    content: [
      { text: "عروض وباقات", level: 2 },
      { text: "اشرح في سطر إيه اللي جوه الباقة وإيه شروطها." },
      { title: "", source: "featured", limit: 3, columns: 3 },
      { label: "شوف كل العروض", href: "/products", variant: "primary" },
    ],
  },
  {
    key: "before-after",
    label: "Before & after",
    description: "Two scroll steps — the state before, then after. Add a picture to each.",
    icon: Contrast,
    group: "Content",
    elements: ["scroll_story"],
    settings: { padding: "roomy" },
    content: [
      {
        title: "قبل وبعد",
        steps: [
          { title: "قبل", body: "اكتب هنا وصف الحالة قبل المنتج، وارفع صورتها.", image: "" },
          { title: "بعد", body: "اكتب هنا وصف الحالة بعد المنتج، وارفع صورتها.", image: "" },
        ],
      },
    ],
  },
  {
    key: "product-showcase-3d",
    label: "3D product showcase",
    description: "A title, a line of copy and the product the shopper turns with a finger.",
    icon: Box,
    group: "Commerce",
    elements: ["heading", "text", "product_3d"],
    settings: { background: "paper", padding: "roomy" },
    content: [
      { text: "لفّه بصباعك", level: 2 },
      { text: "اكتب سطر يشجّع العميل يقلّب المنتج بنفسه." },
      { title: "", productId: "", modelUrl: "" },
    ],
  },
  {
    key: "orbit-showcase",
    label: "Turning showcase",
    description: "A titled carousel of products on a drum that turns.",
    icon: Orbit,
    group: "Commerce",
    elements: ["heading", "orbit_gallery"],
    settings: { width: "wide" },
    content: [
      { text: "اختار من مجموعتنا", level: 2 },
      { title: "", limit: 8, collectionId: "" },
    ],
  },
  {
    key: "lookbook",
    label: "Lookbook",
    description: "A titled grid of photos for a collection or a season.",
    icon: Camera,
    group: "Media",
    elements: ["heading", "text", "gallery"],
    settings: { width: "wide" },
    content: [
      { text: "لوك بوك", level: 2 },
      { text: "اكتب سطر عن المجموعة دي، وارفع صورها تحت." },
      { title: "", images: [], columns: 3 },
    ],
  },
  {
    key: "faq-cta",
    label: "FAQ with a next step",
    description: "Questions and answers, then a way to reach you for the rest.",
    icon: HelpCircle,
    group: "Content",
    elements: ["faq", "text", "button"],
    settings: { background: "paper" },
    content: [
      {
        title: "الأسئلة الشائعة",
        items: [
          { q: "اكتب هنا سؤال بيتكرر من العملاء", a: "اكتب هنا إجابتك." },
          { q: "اكتب هنا سؤال تاني", a: "اكتب هنا إجابتك." },
          { q: "اكتب هنا سؤال تالت", a: "اكتب هنا إجابتك." },
        ],
      },
      { text: "لسه عندك سؤال؟ إحنا موجودين." },
      { label: "تواصل معانا", href: "/contact", variant: "outline" },
    ],
  },
  {
    key: "flash-offer",
    label: "Limited-time offer",
    description: "A countdown over the offer's own terms and a buy button.",
    icon: Zap,
    group: "Commerce",
    elements: ["heading", "countdown", "text", "button"],
    settings: { background: "primary-soft", padding: "compact" },
    content: [
      { text: "عرض لفترة محدودة", level: 2 },
      { label: "ينتهي العرض خلال", endsInHours: 48 },
      { text: "اكتب هنا تفاصيل العرض ومدته وشروطه." },
      { label: "اشتري دلوقتي", href: "/products", variant: "primary" },
    ],
  },
  {
    key: "shipping-returns",
    label: "Delivery & returns",
    description: "Where you ship, how you swap and what you accept — in your own words.",
    icon: Truck,
    group: "Content",
    elements: ["heading", "accordion", "text"],
    settings: { background: "paper" },
    content: [
      { text: "الشحن والاستبدال", level: 2 },
      {
        title: "",
        items: [
          { q: "الشحن", a: "اكتب هنا مناطق الشحن ومواعيده وتكلفته." },
          { q: "الاستبدال والاسترجاع", a: "اكتب هنا سياسة الاستبدال والاسترجاع بتاعتك." },
          { q: "الدفع", a: "اكتب هنا طرق الدفع اللي بتقبلها." },
        ],
      },
      { text: "اكتب هنا أي ملاحظة أخيرة عن الطلبات." },
    ],
  },
  {
    key: "claims-strip",
    label: "Claims strip",
    description: "A line of short claims that slides across the page and stops when the shopper looks at it.",
    icon: Megaphone,
    group: "Content",
    elements: ["marquee"],
    settings: { background: "paper", padding: "compact" },
    content: [
      {
        items: [
          "اكتب هنا جملة قصيرة عن خدمتك",
          "اكتب هنا جملة تانية",
          "اكتب هنا جملة تالتة",
        ],
        speed: "normal",
        tone: "line",
      },
    ],
  },
  {
    key: "comparison",
    label: "Comparison table",
    description: "Your column next to the alternative, row by row — in your own words, no names.",
    icon: Table2,
    group: "Content",
    elements: ["heading", "comparison"],
    settings: { background: "paper" },
    content: [
      { text: "قارن بنفسك", level: 2 },
      {
        title: "",
        usLabel: "عندنا",
        themLabel: "غير كده",
        // Column names, not verdicts. Every cell is starting copy the merchant
        // replaces: nothing here claims anything about anybody else.
        rows: [
          { label: "اكتب هنا النقطة اللي بتقارن فيها", us: "اكتب هنا وضعك", them: "اكتب هنا البديل" },
          { label: "اكتب هنا نقطة تانية", us: "اكتب هنا وضعك", them: "اكتب هنا البديل" },
          { label: "اكتب هنا نقطة تالتة", us: "اكتب هنا وضعك", them: "اكتب هنا البديل" },
        ],
      },
    ],
  },
  {
    key: "testimonials",
    label: "Testimonials",
    description: "Three empty quote cards — fill them in from real customers of yours.",
    icon: MessageSquareQuote,
    group: "Content",
    elements: ["heading", "testimonial", "testimonial", "testimonial"],
    settings: { background: "paper", padding: "roomy" },
    content: [
      { text: "آراء العملاء", level: 2 },
      // Left empty on purpose: a quote, a name and a rating are claims about
      // real people, so nothing here may ship with words already in it.
      { quote: "", author: "", rating: 0 },
      { quote: "", author: "", rating: 0 },
      { quote: "", author: "", rating: 0 },
    ],
  },
];

export const BLOCK_GROUPS: BlockPreset["group"][] = ["Layout", "Content", "Media", "Commerce"];

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

/**
 * `content` is a preset's starting props for this one element, laid over the
 * type's own defaults — so a preset states only what it changes and still gets
 * every default key the storefront reader expects.
 */
function createElement(type: PageElementType, content?: Record<string, unknown>): PageElement {
  return { id: uid(type), type, props: { ...ELEMENT_SPECS[type].defaultProps, ...content } };
}

/** One section → one row → one span-12 column, matching the seeder's `oneCol`. */
export function createSection(preset: BlockPreset): PageSection {
  const base = uid(preset.key);
  const column: PageColumn = {
    id: `${base}-c`,
    type: "column",
    span: 12,
    elements: preset.elements.map((type, i) => createElement(type, preset.content?.[i])),
  };
  const row: PageRow = { id: `${base}-r`, type: "row", columns: [column] };
  const section: PageSection = { id: base, type: "section", rows: [row] };
  // Only presets that actually want a look carry `settings`; the rest keep the
  // exact shape the seeded templates write.
  if (preset.settings) section.settings = { ...preset.settings };
  return section;
}

/** Every element in a section, in document order, across all rows/columns. */
export function sectionElements(section: PageSection): PageElement[] {
  return (section.rows ?? []).flatMap((row) =>
    (row.columns ?? []).flatMap((col) => col.elements ?? [])
  );
}

/**
 * A display name for a section. The tree has no section type, so this reads
 * the elements: an exact preset match wins (that's how a template's hero gets
 * called "Hero"), otherwise fall back to the first element's own label.
 */
export function sectionLabel(section: PageSection, locale: EditorLocale = "en"): string {
  const types = sectionElements(section).map((el) => el.type);
  const ui = editorUi(locale);
  if (types.length === 0) return ui.emptySection;
  const match = BLOCK_PRESETS.find(
    (p) => p.elements.length === types.length && p.elements.every((t, i) => t === types[i])
  );
  if (match) return presetText(match.key, match, locale).label;
  const first = elementLabel(types[0], ELEMENT_SPECS[types[0]].label, locale);
  return types.length === 1 ? first : ui.andMore(first, types.length - 1);
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

/** Where an element sits in its own column, or null when it isn't in the section. */
export function elementPosition(
  section: PageSection,
  elementId: string
): { index: number; count: number } | null {
  for (const row of section.rows ?? []) {
    for (const col of row.columns ?? []) {
      const elements = col.elements ?? [];
      const index = elements.findIndex((el) => el.id === elementId);
      if (index !== -1) return { index, count: elements.length };
    }
  }
  return null;
}

/**
 * Moves an element one place up (-1) or down (+1) within its own column. Moves
 * never cross into another column or row — every seeded section is a single
 * column, and silently re-parenting an element in a hand-built multi-column
 * tree would be surprising. A move past either end does nothing.
 */
export function moveElement(section: PageSection, elementId: string, delta: -1 | 1): PageSection {
  return {
    ...section,
    rows: (section.rows ?? []).map((row) => ({
      ...row,
      columns: (row.columns ?? []).map((col) => {
        const elements = col.elements ?? [];
        const from = elements.findIndex((el) => el.id === elementId);
        const to = from + delta;
        if (from === -1 || to < 0 || to >= elements.length) return col;
        const next = elements.slice();
        [next[from], next[to]] = [next[to], next[from]];
        return { ...col, elements: next };
      }),
    })),
  };
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
 * Puts a new section at `index` — 0 is the top of the page, `sections.length`
 * (or anything past it) the bottom, which is where the library appends when
 * no position was picked. A negative or non-integer index is treated as the
 * nearest valid slot rather than dropped: it comes from a click in the
 * preview frame, and the merchant still asked for a section.
 */
export function insertSection(
  sections: PageSection[],
  section: PageSection,
  index: number = sections.length
): PageSection[] {
  const at = Number.isFinite(index)
    ? Math.min(sections.length, Math.max(0, Math.trunc(index)))
    : sections.length;
  const next = sections.slice();
  next.splice(at, 0, section);
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

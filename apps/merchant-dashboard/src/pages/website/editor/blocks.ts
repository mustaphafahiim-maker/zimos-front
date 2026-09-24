import {
  AlarmClock,
  AlignLeft,
  BadgeCheck,
  BarChart3,
  Box,
  Building2,
  Camera,
  ChevronDown,
  CircleDot,
  Clapperboard,
  Code2,
  Columns3,
  Contrast,
  FileText,
  FormInput,
  Frame,
  GalleryHorizontal,
  Gift,
  Grid2x2,
  Grid3x3,
  Heading1,
  HelpCircle,
  Image,
  Images,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  LayoutPanelLeft,
  List,
  ListOrdered,
  Mail,
  Map,
  MapPin,
  Megaphone,
  MessageSquareQuote,
  Milestone,
  Minus,
  MousePointerClick,
  MoveVertical,
  Orbit,
  Package,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Quote,
  Scale,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Table2,
  Tag,
  Timer,
  Truck,
  Type,
  Users,
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
 *     always single-column. Single-element presets write the same shape; the
 *     ready-made sections further down may lay their elements out over
 *     several rows and columns (`BlockPreset.rows`), which is the same tree
 *     with more than one column per row — nothing the backend hasn't always
 *     accepted. The inspector walks rows and columns in order, so a
 *     hand-authored multi-column tree displays and round-trips unharmed too.
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

/**
 * One column of a multi-column preset: how much of the 12-column row it takes,
 * what goes in it, and optionally the starting props of each element and the
 * column's own `settings` (COLUMN_SETTING_SPECS).
 */
export interface PresetColumn {
  span: number;
  elements: PageElementType[];
  content?: Array<Record<string, unknown> | undefined>;
  settings?: Record<string, unknown>;
}

export interface PresetRow {
  columns: PresetColumn[];
  /** Optional starting `row.settings` (ROW_SETTING_SPECS). */
  settings?: Record<string, unknown>;
}

export interface BlockPreset {
  /** Stable key, also the id prefix of the section it creates. */
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "hero" | "trust" | "commerce" | "story" | "convert" | "basics";
  /**
   * The element types this preset drops into one full-width column — or, for
   * a preset with `rows`, every element type in document order (row by row,
   * column by column). Either way it is the section's flattened shape, which
   * is what the library's search, its thumbnail and `sectionLabel` read.
   */
  elements: PageElementType[];
  /**
   * The layout of a multi-column preset. Spans in each row add up to 12, like
   * the storefront's grid. `elements`/`content` below are ignored when this is
   * set — write such a preset through `multiColumn()`, which derives them.
   */
  rows?: PresetRow[];
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
      // The two strong grounds. The storefront re-points the colour tokens
      // inside them, so headings, text, cards and buttons stay legible without
      // any element knowing what it sits on.
      { value: "primary", label: "Brand colour" },
      { value: "ink", label: "Dark" },
    ],
  },
  {
    key: "padding",
    label: "Vertical space",
    defaultValue: "normal",
    options: [
      { value: "tight", label: "Tight" },
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

/**
 * Columns and rows carry the same kind of free-form `settings` object as a
 * section — pageTree.js checks their structure and passes the rest through —
 * and the storefront reads these with the same fallbacks. A column's settings
 * are how a multi-column preset gets its cards and its centred text; a row's,
 * how far apart its columns sit. The first option is, again, today's look.
 *
 * The api-client's `PageColumn`/`PageRow` don't declare `settings` (only
 * elements and sections do), so the editor reads and writes it through the
 * two narrow types below rather than widening the shared ones.
 */
export type ColumnWithSettings = PageColumn & { settings?: Record<string, unknown> };
export type RowWithSettings = PageRow & { settings?: Record<string, unknown> };

export const COLUMN_SETTING_SPECS: SectionSettingSpec[] = [
  {
    key: "surface",
    label: "Surface",
    defaultValue: "none",
    options: [
      { value: "none", label: "None" },
      { value: "card", label: "Card" },
    ],
  },
  {
    key: "align",
    label: "Text alignment",
    defaultValue: "start",
    options: [
      { value: "start", label: "Start" },
      { value: "center", label: "Centre" },
    ],
  },
  {
    key: "verticalAlign",
    label: "Vertical position",
    defaultValue: "start",
    options: [
      { value: "start", label: "Top" },
      { value: "center", label: "Middle" },
      { value: "end", label: "Bottom" },
    ],
  },
];

export const ROW_SETTING_SPECS: SectionSettingSpec[] = [
  {
    key: "gap",
    label: "Space between columns",
    defaultValue: "normal",
    options: [
      { value: "tight", label: "Tight" },
      { value: "normal", label: "Normal" },
      { value: "loose", label: "Loose" },
    ],
  },
];

/** The stored value of one setting on any node, or "" when it is left at the default. */
function readSetting(settings: unknown, key: string): string {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return "";
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

/**
 * One setting written into a node's `settings`. Choosing the default (or
 * clearing the field) drops the key instead of writing it, and dropping the
 * last key drops the object — so a node the merchant never styled keeps the
 * `settings`-free shape the templates seed.
 */
function writeSetting(
  current: unknown,
  specs: SectionSettingSpec[],
  key: string,
  value: string
): Record<string, unknown> | undefined {
  const base: Record<string, unknown> =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};
  const spec = specs.find((s) => s.key === key);
  if (value === "" || value === spec?.defaultValue) delete base[key];
  else base[key] = value;
  return Object.keys(base).length === 0 ? undefined : base;
}

/** The stored value of one section setting, or "" when the section leaves it at the default. */
export function sectionSetting(section: PageSection, key: string): string {
  return readSetting(section.settings, key);
}

/**
 * Sets one section setting. Choosing the default (or clearing the field) drops
 * the key instead of writing it, so a section the merchant never styled keeps
 * the `settings`-free shape the templates seed.
 */
export function setSectionSetting(section: PageSection, key: string, value: string): PageSection {
  const settings = writeSetting(section.settings, SECTION_SETTING_SPECS, key, value);
  const next: PageSection = { ...section };
  if (settings === undefined) delete next.settings;
  else next.settings = settings;
  return next;
}

export function columnSetting(column: PageColumn, key: string): string {
  return readSetting((column as ColumnWithSettings).settings, key);
}

export function rowSetting(row: PageRow, key: string): string {
  return readSetting((row as RowWithSettings).settings, key);
}

/** Sets one setting on the column with this id, wherever it sits in the section. */
export function setColumnSetting(
  section: PageSection,
  columnId: string,
  key: string,
  value: string
): PageSection {
  return {
    ...section,
    rows: (section.rows ?? []).map((row) => ({
      ...row,
      columns: (row.columns ?? []).map((col) => {
        if (col.id !== columnId) return col;
        const settings = writeSetting((col as ColumnWithSettings).settings, COLUMN_SETTING_SPECS, key, value);
        const next: ColumnWithSettings = { ...col };
        if (settings === undefined) delete next.settings;
        else next.settings = settings;
        return next;
      }),
    })),
  };
}

/** Sets one setting on the row with this id. */
export function setRowSetting(section: PageSection, rowId: string, key: string, value: string): PageSection {
  return {
    ...section,
    rows: (section.rows ?? []).map((row) => {
      if (row.id !== rowId) return row;
      const settings = writeSetting((row as RowWithSettings).settings, ROW_SETTING_SPECS, key, value);
      const next: RowWithSettings = { ...row };
      if (settings === undefined) delete next.settings;
      else next.settings = settings;
      return next;
    }),
  };
}

/**
 * Writes a multi-column preset. `elements` is derived from the rows, so the
 * flattened shape the library and `sectionLabel` read can never drift from
 * the layout the preset actually creates.
 */
function multiColumn(
  preset: Omit<BlockPreset, "elements" | "content" | "rows"> & { rows: PresetRow[] }
): BlockPreset {
  return {
    ...preset,
    elements: preset.rows.flatMap((row) => row.columns.flatMap((col) => col.elements)),
  };
}

export const BLOCK_PRESETS: BlockPreset[] = [
  // --------------------------------------------------------------------
  // Six groups, ordered the way a merchant actually builds a page —
  // opening, then trust, then the catalogue, then the story, then the push
  // to act, and finally the raw utility blocks reached for last. Grounded
  // in how real storefronts (Allbirds, Gymshark) lay out a home page, a
  // product page and a footer, rather than by implementation category.
  //
  // Presets range from a single bare element (a heading, a button) to a
  // fully laid-out, multi-column section with starting copy. That copy is
  // Egyptian Arabic written AT the merchant ("اكتب هنا…"), never a claim on
  // the store's behalf: no names, no ratings, no delivery times, no
  // guarantees. Anything that would have to be real to be honest — a
  // statistic, a team member, a customer's words — is a prompt to write
  // it, or left empty.
  // --------------------------------------------------------------------

  // --- Hero & announcement: what a shopper sees first -----------------------
  multiColumn({
    key: "announcement-bar",
    label: "Announcement bar",
    description: "One line in your brand colour across the top — an offer, a shipping note, a date.",
    icon: Megaphone,
    group: "hero",
    settings: { background: "primary", padding: "tight" },
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["text"],
            content: [{ text: "اكتب هنا الجملة اللي عايز كل زائر يشوفها الأول" }],
            settings: { align: "center" },
          },
        ],
      },
    ],
  }),
  {
    key: "hero",
    label: "Hero",
    description: "Big heading, a line of text and a call-to-action button.",
    icon: Sparkles,
    group: "hero",
    elements: ["heading", "text", "button"],
  },
  {
    key: "hero-trust",
    label: "Hero with trust line",
    description: "An opening screen plus the few reasons a first-time shopper should trust you.",
    icon: ShieldCheck,
    group: "hero",
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
  multiColumn({
    key: "hero-split",
    label: "Hero with picture",
    description: "Title, a line of text and a button on one side, your picture on the other.",
    icon: LayoutPanelLeft,
    group: "hero",
    settings: { padding: "roomy" },
    rows: [
      {
        columns: [
          {
            span: 6,
            elements: ["heading", "text", "button"],
            content: [
              { text: "اكتب هنا الجملة اللي بتوصف متجرك في سطر", level: 1 },
              { text: "اشرح في سطرين بتبيع إيه ولمين، وسيب الباقي للصورة." },
              { label: "تسوّق دلوقتي", href: "/products", variant: "primary" },
            ],
            settings: { verticalAlign: "center" },
          },
          { span: 6, elements: ["image"], settings: { verticalAlign: "center" } },
        ],
      },
    ],
  }),
  multiColumn({
    key: "hero-gallery",
    label: "Hero with photo row",
    description: "A centred opening line and button, with three of your photos underneath.",
    icon: GalleryHorizontal,
    group: "hero",
    settings: { padding: "roomy" },
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "text", "button"],
            content: [
              { text: "اكتب هنا عنوان الواجهة", level: 1 },
              { text: "اكتب سطر واحد يوضّح إيه اللي يميّز متجرك." },
              { label: "تسوّق دلوقتي", href: "/products", variant: "primary" },
            ],
            settings: { align: "center" },
          },
        ],
      },
      {
        columns: [{ span: 12, elements: ["gallery"], content: [{ title: "", images: [], columns: 3 }] }],
      },
    ],
  }),
  {
    key: "living-hero",
    label: "Living hero",
    description: "An opening screen that moves slowly in your store's colours.",
    icon: Waves,
    group: "hero",
    elements: ["shader_hero"],
  },
  {
    key: "living-hero-intro",
    label: "Living hero with copy",
    description: "The moving opening screen, with a title, a line of text and a button already in it.",
    icon: Waves,
    group: "hero",
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
  multiColumn({
    key: "video-hero",
    label: "Video opener",
    description: "Your video first, then a centred title, a line and a button.",
    icon: Clapperboard,
    group: "hero",
    settings: { padding: "roomy" },
    rows: [
      { columns: [{ span: 12, elements: ["video"], content: [{ url: "", title: "" }] }] },
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "text", "button"],
            content: [
              { text: "اكتب هنا عنوان الفيديو", level: 1 },
              { text: "اكتب سطر يقول العميل هيشوف إيه في الفيديو." },
              { label: "تسوّق دلوقتي", href: "/products", variant: "primary" },
            ],
            settings: { align: "center" },
          },
        ],
      },
    ],
  }),

  // --- Trust & social proof: why they should believe you --------------------
  multiColumn({
    key: "logo-strip",
    label: "Logo strip",
    description: "A quiet row of six small images — partners, stockists, press — on a paper band.",
    icon: Building2,
    group: "trust",
    settings: { background: "paper", padding: "compact" },
    rows: [{ columns: [{ span: 12, elements: ["gallery"], content: [{ title: "", images: [], columns: 6 }] }] }],
  }),
  {
    key: "claims-strip",
    label: "Claims strip",
    description: "A line of short claims that slides across the page and stops when the shopper looks at it.",
    icon: Megaphone,
    group: "trust",
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
  multiColumn({
    key: "claims-band",
    label: "Claims band",
    description: "A centred title over the sliding strip of short claims.",
    icon: Megaphone,
    group: "trust",
    settings: { background: "paper", padding: "compact" },
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "marquee"],
            content: [
              { text: "اكتب هنا عنوان قصير", level: 3 },
              {
                items: ["اكتب هنا جملة قصيرة عن خدمتك", "اكتب هنا جملة تانية", "اكتب هنا جملة تالتة"],
                speed: "normal",
                tone: "primary",
              },
            ],
            settings: { align: "center" },
          },
        ],
      },
    ],
  }),
  multiColumn({
    key: "trust-badges",
    label: "Trust badges",
    description: "Four small reassurances in a compact row — delivery, returns, payment, support.",
    icon: ShieldCheck,
    group: "trust",
    settings: { background: "paper", padding: "compact" },
    rows: [
      {
        columns: ["truck", "shield", "check", "gift"].map((name) => ({
          span: 3,
          elements: ["icon", "heading", "text"] as PageElementType[],
          content: [{ name, size: 24 }, { text: "اكتب هنا نقطة الثقة", level: 5 }, { text: "اكتب تفصيلها في سطر." }],
          settings: { align: "center" },
        })),
      },
    ],
  }),
  {
    key: "testimonial",
    label: "Testimonial",
    description: "A customer quote with a rating.",
    icon: Quote,
    group: "trust",
    elements: ["testimonial"],
  },
  {
    key: "testimonials",
    label: "Testimonials",
    description: "Three empty quote cards — fill them in from real customers of yours.",
    icon: MessageSquareQuote,
    group: "trust",
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
  multiColumn({
    key: "testimonial-wall",
    label: "Testimonial wall",
    description: "A title and three empty quote cards side by side — fill them from real customers.",
    icon: MessageSquareQuote,
    group: "trust",
    settings: { background: "paper", padding: "roomy" },
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "text"],
            content: [{ text: "آراء العملاء", level: 2 }, { text: "اكتب سطر عن الآراء دي جاية منين." }],
            settings: { align: "center" },
          },
        ],
      },
      {
        // Empty on purpose, like the single-column testimonials above: a quote
        // is a claim about a real person.
        columns: [0, 1, 2].map(() => ({
          span: 4,
          elements: ["testimonial"] as PageElementType[],
          content: [{ quote: "", author: "", rating: 0 }],
        })),
      },
    ],
  }),
  multiColumn({
    key: "testimonial-spotlight",
    label: "Testimonial spotlight",
    description: "One customer's words, large and centred on a brand tint. Empty until you add them.",
    icon: Quote,
    group: "trust",
    settings: { background: "primary-soft", padding: "roomy" },
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "testimonial"],
            content: [{ text: "بيقولوا عننا إيه", level: 2 }, { quote: "", author: "", rating: 0 }],
            settings: { align: "center" },
          },
        ],
      },
    ],
  }),
  {
    key: "comparison",
    label: "Comparison table",
    description: "Your column next to the alternative, row by row — in your own words, no names.",
    icon: Table2,
    group: "trust",
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
  multiColumn({
    key: "comparison-pitch",
    label: "Comparison with a pitch",
    description: "A title and a button beside the us-versus-them table.",
    icon: Table2,
    group: "trust",
    settings: { background: "paper" },
    rows: [
      {
        columns: [
          {
            span: 4,
            elements: ["heading", "text", "button"],
            content: [
              { text: "قارن بنفسك", level: 2 },
              { text: "اكتب سطر يقول العميل يبص على إيه في الجدول." },
              { label: "تسوّق دلوقتي", href: "/products", variant: "primary" },
            ],
            settings: { verticalAlign: "center" },
          },
          {
            span: 8,
            elements: ["comparison"],
            content: [
              {
                title: "",
                usLabel: "عندنا",
                themLabel: "غير كده",
                rows: [
                  { label: "اكتب هنا النقطة اللي بتقارن فيها", us: "اكتب هنا وضعك", them: "اكتب هنا البديل" },
                  { label: "اكتب هنا نقطة تانية", us: "اكتب هنا وضعك", them: "اكتب هنا البديل" },
                  { label: "اكتب هنا نقطة تالتة", us: "اكتب هنا وضعك", them: "اكتب هنا البديل" },
                ],
              },
            ],
          },
        ],
      },
    ],
  }),

  // --- Products & collections: the catalogue itself --------------------------
  {
    key: "products",
    label: "Product grid",
    description: "A grid of products from your catalog.",
    icon: LayoutGrid,
    group: "commerce",
    elements: ["product_list"],
  },
  {
    key: "collections",
    label: "Collections",
    description: "Let shoppers browse by collection.",
    icon: Grid3x3,
    group: "commerce",
    elements: ["collection_list"],
  },
  multiColumn({
    key: "collection-tiles",
    label: "Collection tiles",
    description: "A title and a line over your collections, wide.",
    icon: Grid3x3,
    group: "commerce",
    settings: { width: "wide" },
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "text", "collection_list"],
            content: [
              { text: "تسوّق حسب المجموعة", level: 2 },
              { text: "اكتب سطر يساعد العميل يختار من فين يبدأ." },
              { title: "", limit: 6, columns: 3 },
            ],
          },
        ],
      },
    ],
  }),
  multiColumn({
    key: "featured-product",
    label: "Featured product",
    description: "One product beside the reasons to buy it and a button.",
    icon: ShoppingBag,
    group: "commerce",
    settings: { background: "paper" },
    rows: [
      {
        columns: [
          { span: 6, elements: ["product_card"], content: [{ title: "", showPrice: true, showBuyButton: true }] },
          {
            span: 6,
            elements: ["heading", "list", "button"],
            content: [
              { text: "ليه المنتج ده؟", level: 2 },
              { title: "", items: ["اكتب هنا أول سبب", "اكتب هنا تاني سبب", "اكتب هنا تالت سبب"] },
              { label: "شوف كل المنتجات", href: "/products", variant: "outline" },
            ],
            settings: { verticalAlign: "center" },
          },
        ],
      },
    ],
  }),
  multiColumn({
    key: "product-grid-intro",
    label: "Product grid with intro",
    description: "A title and a line, then a grid of your products.",
    icon: LayoutGrid,
    group: "commerce",
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "text", "product_list"],
            content: [
              { text: "اكتب هنا عنوان المجموعة", level: 2 },
              { text: "اكتب سطر عن المنتجات دي." },
              { title: "", source: "newest", limit: 8, columns: 4 },
            ],
          },
        ],
      },
    ],
  }),
  {
    key: "offer",
    label: "Single product",
    description: "Spotlight one product with a buy button.",
    icon: ShoppingBag,
    group: "commerce",
    elements: ["product_card"],
  },
  {
    key: "bundle-offer",
    label: "Bundles & offers",
    description: "A line about the bundle, the products in it and a button to the rest.",
    icon: Gift,
    group: "commerce",
    elements: ["heading", "text", "product_list", "button"],
    settings: { background: "paper" },
    content: [
      { text: "عروض وباقات", level: 2 },
      { text: "اشرح في سطر إيه اللي جوه الباقة وإيه شروطها." },
      { title: "", source: "featured", limit: 3, columns: 3 },
      { label: "شوف كل العروض", href: "/products", variant: "primary" },
    ],
  },
  multiColumn({
    key: "bundle-tiers",
    label: "Three offers",
    description: "Three products side by side, each with its own buy button — pick one per column.",
    icon: Package,
    group: "commerce",
    settings: { background: "paper", padding: "roomy" },
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "text"],
            content: [{ text: "اختار العرض اللي يناسبك", level: 2 }, { text: "اكتب سطر يفرّق بين التلاتة." }],
            settings: { align: "center" },
          },
        ],
      },
      {
        columns: [0, 1, 2].map(() => ({
          span: 4,
          elements: ["product_card"] as PageElementType[],
          content: [{ title: "", showPrice: true, showBuyButton: true }],
        })),
      },
    ],
  }),
  {
    key: "product-3d",
    label: "3D product",
    description: "The shopper turns the product with a finger. Needs a .glb file.",
    icon: Box,
    group: "commerce",
    elements: ["product_3d"],
  },
  {
    key: "product-showcase-3d",
    label: "3D product showcase",
    description: "A title, a line of copy and the product the shopper turns with a finger.",
    icon: Box,
    group: "commerce",
    elements: ["heading", "text", "product_3d"],
    settings: { background: "paper", padding: "roomy" },
    content: [
      { text: "لفّه بصباعك", level: 2 },
      { text: "اكتب سطر يشجّع العميل يقلّب المنتج بنفسه." },
      { title: "", productId: "", modelUrl: "" },
    ],
  },
  {
    key: "orbit-gallery",
    label: "Turning carousel",
    description: "Products on a drum that turns, instead of a flat grid.",
    icon: Orbit,
    group: "commerce",
    elements: ["orbit_gallery"],
  },
  {
    key: "orbit-showcase",
    label: "Turning showcase",
    description: "A titled carousel of products on a drum that turns.",
    icon: Orbit,
    group: "commerce",
    elements: ["heading", "orbit_gallery"],
    settings: { width: "wide" },
    content: [
      { text: "اختار من مجموعتنا", level: 2 },
      { title: "", limit: 8, collectionId: "" },
    ],
  },
  {
    key: "cart",
    label: "Cart",
    description: "The shopper's cart contents.",
    icon: ShoppingCart,
    group: "commerce",
    elements: ["cart"],
  },

  // --- Features & story: why it matters, how it's made -------------------------
  {
    key: "features",
    label: "Features row",
    description: "A short title and the benefits you want the shopper to remember.",
    icon: BadgeCheck,
    group: "story",
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
    group: "story",
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
  multiColumn({
    key: "feature-grid-3",
    label: "Three feature cards",
    description: "Three cards, each with an icon, a short title and a line — the classic features row.",
    icon: Columns3,
    group: "story",
    settings: { background: "paper" },
    rows: [
      {
        columns: ["star", "heart", "check"].map((name, i) => ({
          span: 4,
          elements: ["icon", "heading", "text"] as PageElementType[],
          content: [
            { name, size: 32 },
            { text: ["اكتب الميزة الأولى", "اكتب الميزة التانية", "اكتب الميزة التالتة"][i], level: 3 },
            { text: "اشرح الميزة دي في سطر أو اتنين." },
          ],
          settings: { surface: "card" },
        })),
      },
    ],
  }),
  multiColumn({
    key: "feature-grid-4",
    label: "Four features",
    description: "Four short points across the page, each with an icon, centred.",
    icon: Grid2x2,
    group: "story",
    rows: [
      {
        columns: ["star", "heart", "check", "gift"].map((name, i) => ({
          span: 3,
          elements: ["icon", "heading", "text"] as PageElementType[],
          content: [
            { name, size: 28 },
            { text: `اكتب الميزة ${["الأولى", "التانية", "التالتة", "الرابعة"][i]}`, level: 4 },
            { text: "اشرحها في سطر." },
          ],
          settings: { align: "center" },
        })),
      },
    ],
  }),
  multiColumn({
    key: "image-text",
    label: "Picture with text",
    description: "Your picture on one side, a title, text and a button on the other.",
    icon: PanelLeft,
    group: "story",
    rows: [
      {
        columns: [
          { span: 5, elements: ["image"], settings: { verticalAlign: "center" } },
          {
            span: 7,
            elements: ["heading", "text", "button"],
            content: [
              { text: "اكتب هنا عنوان الجزء ده", level: 2 },
              { text: "اكتب فقرة قصيرة عن الصورة دي — منتج، قصة، أو طريقة شغل." },
              { label: "اعرف أكتر", href: "/products", variant: "outline" },
            ],
            settings: { verticalAlign: "center" },
          },
        ],
      },
    ],
  }),
  multiColumn({
    key: "text-image",
    label: "Text with picture",
    description: "The same pair mirrored: text first, picture after — alternate the two down a page.",
    icon: PanelRight,
    group: "story",
    rows: [
      {
        columns: [
          {
            span: 7,
            elements: ["heading", "text", "button"],
            content: [
              { text: "اكتب هنا عنوان الجزء ده", level: 2 },
              { text: "اكتب فقرة قصيرة عن الصورة دي — منتج، قصة، أو طريقة شغل." },
              { label: "اعرف أكتر", href: "/products", variant: "outline" },
            ],
            settings: { verticalAlign: "center" },
          },
          { span: 5, elements: ["image"], settings: { verticalAlign: "center" } },
        ],
      },
    ],
  }),
  {
    key: "before-after",
    label: "Before & after",
    description: "Two scroll steps — the state before, then after. Add a picture to each.",
    icon: Contrast,
    group: "story",
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
    key: "scroll-story",
    label: "Scroll story",
    description: "Before and after, or how it's made — step by step as the page scrolls.",
    icon: Layers,
    group: "story",
    elements: ["scroll_story"],
  },
  multiColumn({
    key: "process-story",
    label: "How it's made",
    description: "A title and a line, then three scroll steps — add a picture to each.",
    icon: Layers,
    group: "story",
    settings: { padding: "roomy" },
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "text", "scroll_story"],
            content: [
              { text: "بيتعمل إزاي؟", level: 2 },
              { text: "اكتب سطر يمهّد للخطوات اللي جاية." },
              {
                title: "",
                steps: [
                  { title: "اكتب عنوان الخطوة الأولى", body: "اكتب هنا وصفها، وارفع صورتها.", image: "" },
                  { title: "اكتب عنوان الخطوة التانية", body: "اكتب هنا وصفها، وارفع صورتها.", image: "" },
                  { title: "اكتب عنوان الخطوة التالتة", body: "اكتب هنا وصفها، وارفع صورتها.", image: "" },
                ],
              },
            ],
          },
        ],
      },
    ],
  }),
  multiColumn({
    key: "stats-row",
    label: "Numbers row",
    description: "Four big numbers with a word under each — orders, years, cities. You write the numbers.",
    icon: BarChart3,
    group: "story",
    settings: { background: "paper" },
    rows: [
      {
        columns: [0, 1, 2, 3].map(() => ({
          span: 3,
          elements: ["heading", "text"] as PageElementType[],
          // The number itself is a claim, so it ships as an instruction and
          // the merchant types the real one.
          content: [{ text: "اكتب الرقم", level: 2 }, { text: "اكتب هنا الرقم ده بتاع إيه." }],
          settings: { align: "center" },
        })),
      },
    ],
  }),
  multiColumn({
    key: "steps",
    label: "How it works",
    description: "A title, then three numbered steps across the page.",
    icon: ListOrdered,
    group: "story",
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "text"],
            content: [{ text: "بيشتغل إزاي؟", level: 2 }, { text: "اكتب سطر يمهّد للخطوات." }],
            settings: { align: "center" },
          },
        ],
      },
      {
        columns: ["١", "٢", "٣"].map((n, i) => ({
          span: 4,
          elements: ["heading", "text"] as PageElementType[],
          content: [
            { text: `${n}. اكتب عنوان الخطوة ${["الأولى", "التانية", "التالتة"][i]}`, level: 3 },
            { text: "اشرح الخطوة دي في سطر أو اتنين." },
          ],
          settings: { surface: "card" },
        })),
      },
    ],
  }),
  multiColumn({
    key: "timeline",
    label: "Timeline",
    description: "A title, then your milestones as two lists side by side — earlier ones first.",
    icon: Milestone,
    group: "story",
    settings: { background: "paper" },
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "text"],
            content: [{ text: "قصتنا", level: 2 }, { text: "اكتب سطر عن رحلتك من الأول لدلوقتي." }],
          },
        ],
      },
      {
        columns: [
          {
            span: 6,
            elements: ["list"],
            content: [{ title: "البداية", items: ["اكتب هنا أول محطة وتاريخها", "اكتب هنا المحطة التانية"] }],
          },
          {
            span: 6,
            elements: ["list"],
            content: [{ title: "دلوقتي", items: ["اكتب هنا محطة قريبة", "اكتب هنا اللي جاي"] }],
          },
        ],
      },
    ],
  }),
  multiColumn({
    key: "team",
    label: "Team",
    description: "Three people — a photo, a name and a line each. Fill them in from your own team.",
    icon: Users,
    group: "story",
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "text"],
            content: [{ text: "الفريق", level: 2 }, { text: "اكتب سطر عن مين وراء المتجر." }],
            settings: { align: "center" },
          },
        ],
      },
      {
        columns: [0, 1, 2].map(() => ({
          span: 4,
          elements: ["image", "heading", "text"] as PageElementType[],
          content: [undefined, { text: "اكتب هنا اسم الشخص", level: 3 }, { text: "اكتب هنا دوره في سطر." }],
          settings: { align: "center" },
        })),
      },
    ],
  }),
  {
    key: "lookbook",
    label: "Lookbook",
    description: "A titled grid of photos for a collection or a season.",
    icon: Camera,
    group: "story",
    elements: ["heading", "text", "gallery"],
    settings: { width: "wide" },
    content: [
      { text: "لوك بوك", level: 2 },
      { text: "اكتب سطر عن المجموعة دي، وارفع صورها تحت." },
      { title: "", images: [], columns: 3 },
    ],
  },
  multiColumn({
    key: "collage",
    label: "Photo collage",
    description: "Four pictures in two rows of unequal widths — a wide one beside a narrow one, then swapped.",
    icon: Frame,
    group: "story",
    settings: { width: "wide" },
    rows: [
      { columns: [{ span: 8, elements: ["image"] }, { span: 4, elements: ["image"] }] },
      { columns: [{ span: 4, elements: ["image"] }, { span: 8, elements: ["image"] }] },
    ],
  }),
  multiColumn({
    key: "bento",
    label: "Bento grid",
    description: "Four cards of two sizes — a picture and a line in each, the way app sites show features.",
    icon: LayoutDashboard,
    group: "story",
    // The picture goes in the narrow card and the words in the wide one: a
    // picture sets the row's height, and a wide card of text fills that
    // height far better than a narrow one would.
    rows: [
      {
        columns: [
          {
            span: 8,
            elements: ["heading", "text"],
            content: [
              { text: "اكتب هنا أهم ميزة عندك", level: 3 },
              { text: "اشرحها في سطرين أو تلاتة — الكارت ده عريض علشان الكلام الأهم." },
            ],
            settings: { surface: "card", verticalAlign: "center" },
          },
          {
            span: 4,
            elements: ["image", "heading", "text"],
            content: [undefined, { text: "اكتب هنا ميزة تانية", level: 4 }, { text: "اشرحها في سطر." }],
            settings: { surface: "card" },
          },
        ],
      },
      {
        columns: [
          {
            span: 4,
            elements: ["image", "heading", "text"],
            content: [undefined, { text: "اكتب هنا ميزة تالتة", level: 4 }, { text: "اشرحها في سطر." }],
            settings: { surface: "card" },
          },
          {
            span: 8,
            elements: ["heading", "text"],
            content: [
              { text: "اكتب هنا ميزة رابعة", level: 3 },
              { text: "اشرحها في سطرين أو تلاتة." },
            ],
            settings: { surface: "card", verticalAlign: "center" },
          },
        ],
      },
    ],
  }),
  multiColumn({
    key: "rich-text-band",
    label: "Rich text band",
    description: "A title over a longer piece of writing — your story, your method, your promise.",
    icon: FileText,
    group: "story",
    settings: { background: "paper", padding: "roomy" },
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "rich_text"],
            content: [
              { text: "اكتب هنا عنوان القصة", level: 2 },
              { text: "اكتب هنا الفقرة الطويلة — بدأت إزاي، بتعمل إيه، وليه بتعمله." },
            ],
          },
        ],
      },
    ],
  }),

  // --- FAQ, contact & conversion: answer, reach, close --------------------------
  {
    key: "faq",
    label: "FAQ",
    description: "Question-and-answer pairs.",
    icon: HelpCircle,
    group: "convert",
    elements: ["faq"],
  },
  multiColumn({
    key: "faq-split",
    label: "FAQ in two columns",
    description: "A title and a line on one side, the questions and answers on the other.",
    icon: HelpCircle,
    group: "convert",
    settings: { background: "paper" },
    rows: [
      {
        columns: [
          {
            span: 5,
            elements: ["heading", "text"],
            content: [
              { text: "الأسئلة الشائعة", level: 2 },
              { text: "اكتب سطر يقول للعميل يلاقي هنا إيه، وإزاي يوصلك لو سؤاله مش موجود." },
            ],
          },
          {
            span: 7,
            elements: ["faq"],
            content: [
              {
                title: "",
                items: [
                  { q: "اكتب هنا سؤال بيتكرر من العملاء", a: "اكتب هنا إجابتك." },
                  { q: "اكتب هنا سؤال تاني", a: "اكتب هنا إجابتك." },
                  { q: "اكتب هنا سؤال تالت", a: "اكتب هنا إجابتك." },
                ],
              },
            ],
          },
        ],
      },
    ],
  }),
  {
    key: "faq-cta",
    label: "FAQ with a next step",
    description: "Questions and answers, then a way to reach you for the rest.",
    icon: HelpCircle,
    group: "convert",
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
    key: "accordion",
    label: "Accordion",
    description: "Collapsible rows of content.",
    icon: ChevronDown,
    group: "convert",
    elements: ["accordion"],
  },
  {
    key: "shipping-returns",
    label: "Delivery & returns",
    description: "Where you ship, how you swap and what you accept — in your own words.",
    icon: Truck,
    group: "convert",
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
  multiColumn({
    key: "contact-map",
    label: "Contact with map",
    description: "Your contact form beside your address and a link to it on the map.",
    icon: MapPin,
    group: "convert",
    rows: [
      {
        columns: [
          { span: 6, elements: ["form"], content: [{ title: "اكتب هنا عنوان النموذج", submitLabel: "إرسال" }] },
          {
            span: 6,
            elements: ["heading", "text", "map"],
            content: [
              { text: "تواصل معانا", level: 2 },
              { text: "اكتب هنا مواعيد الرد وطرق التواصل التانية." },
              { address: "", zoom: 14 },
            ],
          },
        ],
      },
    ],
  }),
  {
    key: "form",
    label: "Form",
    description: "A contact or sign-up form.",
    icon: FormInput,
    group: "convert",
    elements: ["form"],
  },
  multiColumn({
    key: "newsletter",
    label: "Newsletter",
    description: "A centred invitation to stay in touch, with the sign-up form under it.",
    icon: Mail,
    group: "convert",
    settings: { background: "primary-soft" },
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "text", "form"],
            content: [
              { text: "اكتب هنا دعوة العميل إنه يفضل متابعك", level: 2 },
              { text: "اكتب سطر يقول هيوصله إيه ولو عايز قد إيه." },
              { title: "", submitLabel: "اشترك" },
            ],
            settings: { align: "center" },
          },
        ],
      },
    ],
  }),
  multiColumn({
    key: "cta-band",
    label: "Call-to-action band",
    description: "A band in your brand colour: one line, one reason, one button.",
    icon: MousePointerClick,
    group: "convert",
    settings: { background: "primary", padding: "roomy" },
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "text", "button"],
            content: [
              { text: "اكتب هنا الجملة اللي بتطلب من العميل يتحرك", level: 2 },
              { text: "اكتب سطر يقول ليه دلوقتي." },
              { label: "ابدأ دلوقتي", href: "/products", variant: "primary" },
            ],
            settings: { align: "center" },
          },
        ],
      },
    ],
  }),
  {
    key: "flash-offer",
    label: "Limited-time offer",
    description: "A countdown over the offer's own terms and a buy button.",
    icon: Zap,
    group: "convert",
    elements: ["heading", "countdown", "text", "button"],
    settings: { background: "primary-soft", padding: "compact" },
    content: [
      { text: "عرض لفترة محدودة", level: 2 },
      { label: "ينتهي العرض خلال", endsInHours: 48 },
      { text: "اكتب هنا تفاصيل العرض ومدته وشروطه." },
      { label: "اشتري دلوقتي", href: "/products", variant: "primary" },
    ],
  },
  multiColumn({
    key: "countdown-band",
    label: "Countdown band",
    description: "A dark band with the offer's title, the timer and a buy button.",
    icon: AlarmClock,
    group: "convert",
    settings: { background: "ink", padding: "compact" },
    rows: [
      {
        columns: [
          {
            span: 12,
            elements: ["heading", "countdown", "button"],
            content: [
              { text: "اكتب هنا اسم العرض", level: 2 },
              { label: "ينتهي العرض خلال", endsInHours: 48 },
              { label: "اشتري دلوقتي", href: "/products", variant: "primary" },
            ],
            settings: { align: "center" },
          },
        ],
      },
    ],
  }),
  multiColumn({
    key: "pricing-tiers",
    label: "Plans",
    description: "Three cards — a name, a line, what's included and a button. You fill in the prices.",
    icon: Tag,
    group: "convert",
    settings: { background: "paper", padding: "roomy" },
    rows: [
      {
        columns: [0, 1, 2].map((i) => ({
          span: 4,
          elements: ["heading", "text", "list", "button"] as PageElementType[],
          content: [
            { text: `اكتب اسم الباقة ${["الأولى", "التانية", "التالتة"][i]}`, level: 3 },
            { text: "اكتب هنا السعر ولمين الباقة دي." },
            { title: "", items: ["اكتب هنا أول حاجة فيها", "اكتب هنا تاني حاجة", "اكتب هنا تالت حاجة"] },
            { label: "اختار الباقة دي", href: "/products", variant: i === 1 ? "primary" : "outline" },
          ],
          settings: { surface: "card" },
        })),
      },
    ],
  }),

  // --- Building blocks: raw utility elements -------------------------------------
  {
    key: "heading",
    label: "Heading",
    description: "A standalone section title.",
    icon: Heading1,
    group: "basics",
    elements: ["heading"],
  },
  {
    key: "text",
    label: "Text",
    description: "A paragraph of copy.",
    icon: AlignLeft,
    group: "basics",
    elements: ["text"],
  },
  {
    key: "rich-text",
    label: "Long text",
    description: "A longer block of copy.",
    icon: Type,
    group: "basics",
    elements: ["rich_text"],
  },
  {
    key: "list",
    label: "List",
    description: "A bulleted list of points.",
    icon: List,
    group: "basics",
    elements: ["list"],
  },
  {
    key: "button",
    label: "Button",
    description: "A single call-to-action button.",
    icon: MousePointerClick,
    group: "basics",
    elements: ["button"],
  },
  {
    key: "image",
    label: "Image",
    description: "One image, optionally linked.",
    icon: Image,
    group: "basics",
    elements: ["image"],
  },
  {
    key: "gallery",
    label: "Gallery",
    description: "A grid of images.",
    icon: Images,
    group: "basics",
    elements: ["gallery"],
  },
  {
    key: "video",
    label: "Video",
    description: "An embedded video.",
    icon: Video,
    group: "basics",
    elements: ["video"],
  },
  {
    key: "embed",
    label: "Embed",
    description: "Embed an external page by URL.",
    icon: Code2,
    group: "basics",
    elements: ["embed"],
  },
  {
    key: "map",
    label: "Map",
    description: "Show your address on a map.",
    icon: Map,
    group: "basics",
    elements: ["map"],
  },
  {
    key: "icon",
    label: "Icon",
    description: "A single decorative icon.",
    icon: CircleDot,
    group: "basics",
    elements: ["icon"],
  },
  {
    key: "social",
    label: "Social links",
    description: "Links to your social profiles.",
    icon: Share2,
    group: "basics",
    elements: ["social_icons"],
  },
  {
    key: "divider",
    label: "Divider",
    description: "A horizontal rule between sections.",
    icon: Minus,
    group: "basics",
    elements: ["divider"],
  },
  {
    key: "spacer",
    label: "Spacer",
    description: "Vertical breathing room.",
    icon: MoveVertical,
    group: "basics",
    elements: ["spacer"],
  },
  multiColumn({
    key: "footer-links",
    label: "Footer links",
    description: "Two lists of links and your social profiles, side by side, for the bottom of a page.",
    icon: PanelBottom,
    group: "basics",
    settings: { background: "paper", padding: "compact" },
    rows: [
      {
        columns: [
          {
            span: 4,
            elements: ["list"],
            content: [{ title: "اكتب عنوان القائمة", items: ["اكتب هنا اسم صفحة", "اكتب هنا اسم صفحة تانية"] }],
          },
          {
            span: 4,
            elements: ["list"],
            content: [{ title: "اكتب عنوان القائمة", items: ["اكتب هنا اسم صفحة", "اكتب هنا اسم صفحة تانية"] }],
          },
          { span: 4, elements: ["social_icons"], content: [{ links: [] }] },
        ],
      },
    ],
  }),
  {
    key: "countdown",
    label: "Countdown",
    description: "An urgency timer for a limited offer.",
    icon: Timer,
    group: "basics",
    elements: ["countdown"],
  },
];

export const BLOCK_GROUPS: BlockPreset["group"][] = ["hero", "trust", "commerce", "story", "convert", "basics"];

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

/**
 * A preset as a section. A single-column preset is one section → one row →
 * one span-12 column, matching the seeder's `oneCol` (ids `-r` / `-c`); a
 * preset with `rows` is the same tree with its rows and columns numbered the
 * way the seeder numbers them (`-r1`, `-r1-c2`, …).
 */
export function createSection(preset: BlockPreset): PageSection {
  const base = uid(preset.key);
  let rows: PageRow[];
  if (preset.rows) {
    rows = preset.rows.map((row, r) => {
      const next: RowWithSettings = {
        id: `${base}-r${r + 1}`,
        type: "row",
        columns: row.columns.map((col, c) => {
          const column: ColumnWithSettings = {
            id: `${base}-r${r + 1}-c${c + 1}`,
            type: "column",
            span: col.span,
            elements: col.elements.map((type, i) => createElement(type, col.content?.[i])),
          };
          if (col.settings) column.settings = { ...col.settings };
          return column;
        }),
      };
      if (row.settings) next.settings = { ...row.settings };
      return next;
    });
  } else {
    const column: PageColumn = {
      id: `${base}-c`,
      type: "column",
      span: 12,
      elements: preset.elements.map((type, i) => createElement(type, preset.content?.[i])),
    };
    rows = [{ id: `${base}-r`, type: "row", columns: [column] }];
  }
  const section: PageSection = { id: base, type: "section", rows };
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
 * The layout of a section as a string — each row's column spans and element
 * types — so two sections (or a section and a preset) with the same shape
 * compare equal. "12:heading,text|4:image/8:text" reads: row of one span-12
 * column, then a row of a span-4 and a span-8 column.
 */
function layoutSignature(rows: Array<{ columns: Array<{ span?: number; elements: Array<{ type: PageElementType }> }> }>): string {
  return rows
    .map((row) =>
      row.columns.map((col) => `${col.span ?? 12}:${col.elements.map((el) => el.type).join(",")}`).join("/")
    )
    .join("|");
}

function presetSignature(preset: BlockPreset): string {
  if (preset.rows) {
    return layoutSignature(
      preset.rows.map((row) => ({
        columns: row.columns.map((col) => ({ span: col.span, elements: col.elements.map((type) => ({ type })) })),
      }))
    );
  }
  return `12:${preset.elements.join(",")}`;
}

/**
 * The preset a section came from, as far as its shape can tell. A section
 * whose rows and columns match a preset exactly is that preset; failing that,
 * the first preset with the same elements in the same order — which is how a
 * template's single-column hero still gets called "Hero", and how a section
 * the merchant re-laid-out keeps its name.
 */
function matchPreset(section: PageSection): BlockPreset | undefined {
  const rows = (section.rows ?? []).map((row) => ({
    columns: (row.columns ?? []).map((col) => ({ span: col.span, elements: col.elements ?? [] })),
  }));
  const signature = layoutSignature(rows);
  const exact = BLOCK_PRESETS.find((p) => presetSignature(p) === signature);
  if (exact) return exact;
  const types = sectionElements(section).map((el) => el.type);
  return BLOCK_PRESETS.find(
    (p) => p.elements.length === types.length && p.elements.every((t, i) => t === types[i])
  );
}

/**
 * A display name for a section. The tree has no section type, so this reads
 * the elements: a preset match wins (that's how a template's hero gets called
 * "Hero"), otherwise fall back to the first element's own label.
 */
export function sectionLabel(section: PageSection, locale: EditorLocale = "en"): string {
  const types = sectionElements(section).map((el) => el.type);
  const ui = editorUi(locale);
  if (types.length === 0) return ui.emptySection;
  const match = matchPreset(section);
  if (match) return presetText(match.key, match, locale).label;
  const first = elementLabel(types[0], ELEMENT_SPECS[types[0]].label, locale);
  return types.length === 1 ? first : ui.andMore(first, types.length - 1);
}

export function sectionIcon(section: PageSection): LucideIcon {
  const match = matchPreset(section);
  if (match) return match.icon;
  const types = sectionElements(section).map((el) => el.type);
  return types.length > 0 ? ELEMENT_SPECS[types[0]].icon : Columns3;
}

/**
 * How many columns a section has across all its rows — one for everything the
 * templates seed, more for the library's laid-out sections. The inspector uses
 * it to decide whether naming each column is worth the space.
 */
export function sectionColumnCount(section: PageSection): number {
  return (section.rows ?? []).reduce((n, row) => n + (row.columns ?? []).length, 0);
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

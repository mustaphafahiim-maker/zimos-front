/**
 * Parametrised section builders. Everything here is expressed ONLY with the
 * backend's allowed element types; the design is selected through
 * `section.settings` / `row.settings` / `column.settings` (which the backend
 * stores without inspecting) and extra element props (also stored as-is).
 *
 * Both SECTION_LIBRARY (default copy) and THEMES (theme copy) call these, so a
 * section inserted from the palette looks exactly like the same section in a
 * theme.
 */
import { col, el, row, section, type IdFactory, type NodeSettings, type TreeSection } from "./tree";

export type Tone = "default" | "surface" | "soft" | "primary" | "secondary" | "dark" | "gradient";

export interface SectionLook {
  tone?: Tone;
  padding?: "none" | "sm" | "md" | "lg";
  width?: "narrow" | "default" | "wide" | "full";
  decor?: boolean;
}

function look(variant: string, l: SectionLook, extra: NodeSettings = {}): NodeSettings {
  return {
    variant,
    tone: l.tone ?? "default",
    padding: l.padding ?? "md",
    width: l.width ?? "default",
    ...(l.decor ? { decor: true } : {}),
    ...extra,
  };
}

export interface Cta {
  label: string;
  href: string;
}

function buttons(id: IdFactory, primary?: Cta, secondary?: Cta, size: "md" | "lg" = "lg") {
  const out = [];
  if (primary) out.push(el(id, "button", { label: primary.label, href: primary.href, variant: "primary", size, icon: "arrow" }));
  if (secondary) out.push(el(id, "button", { label: secondary.label, href: secondary.href, variant: "outline", size }));
  return out;
}

/** Centered "eyebrow + title + intro" header row used above card grids. */
function headerRow(id: IdFactory, c: { eyebrow?: string; title: string; text?: string }, level = 2) {
  const elements = [el(id, "heading", { text: c.title, level, ...(c.eyebrow ? { eyebrow: c.eyebrow } : {}) })];
  if (c.text) elements.push(el(id, "text", { text: c.text, size: "lead" }));
  return row(id, [col(id, elements, 12, { align: "center" })]);
}

export interface HeroCopy {
  eyebrow?: string;
  title: string;
  text: string;
  primary?: Cta;
  secondary?: Cta;
  imageAlt?: string;
}

// ---------------------------------------------------------------------------

export function announcementSection(id: IdFactory, c: { text: string; link?: Cta }, l: SectionLook = {}): TreeSection {
  const elements = [el(id, "text", { text: c.text, size: "sm" })];
  if (c.link) elements.push(el(id, "button", { label: c.link.label, href: c.link.href, variant: "link", size: "md" }));
  return section(id, [row(id, [col(id, elements)])], look("announcement", { tone: "primary", padding: "sm", ...l }, { align: "center" }));
}

export function heroImageSection(id: IdFactory, c: HeroCopy, l: SectionLook = {}, backgroundImage = ""): TreeSection {
  return section(
    id,
    [
      row(id, [
        col(
          id,
          [
            el(id, "heading", { text: c.title, level: 1, size: "display", ...(c.eyebrow ? { eyebrow: c.eyebrow } : {}) }),
            el(id, "text", { text: c.text, size: "lead" }),
            ...buttons(id, c.primary, c.secondary),
          ],
          8,
          { align: "center" }
        ),
      ], { valign: "center" }),
    ],
    look("hero-image", { tone: "gradient", padding: "lg", decor: true, ...l }, { align: "center", backgroundImage })
  );
}

export function heroSplitSection(id: IdFactory, c: HeroCopy, l: SectionLook = {}, opts: { reverse?: boolean; ratio?: string } = {}): TreeSection {
  return section(
    id,
    [
      row(
        id,
        [
          col(id, [
            el(id, "heading", { text: c.title, level: 1, size: "display", ...(c.eyebrow ? { eyebrow: c.eyebrow } : {}) }),
            el(id, "text", { text: c.text, size: "lead" }),
            ...buttons(id, c.primary, c.secondary),
          ], 6, { valign: "center" }),
          col(id, [el(id, "image", { src: "", alt: c.imageAlt ?? "", placeholder: true, ratio: opts.ratio ?? "4/5" })], 6),
        ],
        { valign: "center", reverse: !!opts.reverse }
      ),
    ],
    look("hero-split", { tone: "soft", padding: "lg", decor: true, ...l })
  );
}

export function heroCenteredSection(id: IdFactory, c: HeroCopy, l: SectionLook = {}): TreeSection {
  return section(
    id,
    [
      row(id, [
        col(id, [
          el(id, "heading", { text: c.title, level: 1, size: "display", ...(c.eyebrow ? { eyebrow: c.eyebrow } : {}) }),
          el(id, "text", { text: c.text, size: "lead" }),
          ...buttons(id, c.primary, c.secondary),
        ], 12, { align: "center" }),
      ]),
    ],
    look("hero-centered", { tone: "default", padding: "lg", width: "narrow", ...l }, { align: "center" })
  );
}

/** `level` 2 when used mid-page so the page keeps a single h1. */
export function heroPosterSection(id: IdFactory, c: HeroCopy, l: SectionLook = {}, level: 1 | 2 = 1): TreeSection {
  return section(
    id,
    [
      row(id, [
        col(id, [
          el(id, "heading", { text: c.title, level, size: level === 1 ? "display" : "default", ...(c.eyebrow ? { eyebrow: c.eyebrow } : {}) }),
          el(id, "text", { text: c.text, size: "lead" }),
          ...buttons(id, c.primary, c.secondary),
        ], 12, { align: "center" }),
      ]),
      row(id, [col(id, [el(id, "video", { url: "", poster: "", title: c.imageAlt ?? c.title, placeholder: true })])]),
    ],
    look("hero-poster", { tone: "dark", padding: "lg", ...l }, { align: "center" })
  );
}

export function featuredProductSection(id: IdFactory, c: { eyebrow?: string; title: string; text?: string }, l: SectionLook = {}): TreeSection {
  return section(
    id,
    [
      headerRow(id, c),
      row(id, [col(id, [el(id, "product_card", { title: "", productId: "", variant: "landing", showPrice: true, showBuyButton: true })])]),
    ],
    look("featured-product", { tone: "default", ...l })
  );
}

export function productGridSection(
  id: IdFactory,
  c: { eyebrow?: string; title: string; text?: string; link?: Cta; limit?: number; columns?: number; source?: string },
  l: SectionLook = {}
): TreeSection {
  const rows = [
    headerRow(id, c),
    row(id, [col(id, [el(id, "product_list", { title: "", source: c.source ?? "newest", limit: c.limit ?? 8, columns: c.columns ?? 4 })])]),
  ];
  if (c.link) rows.push(row(id, [col(id, [el(id, "button", { label: c.link.label, href: c.link.href, variant: "outline", size: "md", icon: "arrow" })], 12, { align: "center" })]));
  return section(id, rows, look("product-grid", l));
}

export function collectionListSection(id: IdFactory, c: { eyebrow?: string; title: string; text?: string; limit?: number; columns?: number }, l: SectionLook = {}): TreeSection {
  return section(
    id,
    [headerRow(id, c), row(id, [col(id, [el(id, "collection_list", { title: "", limit: c.limit ?? 6, columns: c.columns ?? 3 })])])],
    look("collections", l)
  );
}

export function imageTextSection(
  id: IdFactory,
  c: { eyebrow?: string; title: string; text: string; bullets?: string[]; cta?: Cta; imageAlt?: string },
  l: SectionLook = {},
  opts: { imageEnd?: boolean; ratio?: string } = {}
): TreeSection {
  const textEls = [
    el(id, "heading", { text: c.title, level: 2, ...(c.eyebrow ? { eyebrow: c.eyebrow } : {}) }),
    el(id, "text", { text: c.text, size: "lead" }),
  ];
  if (c.bullets?.length) textEls.push(el(id, "list", { title: "", items: c.bullets, style: "check" }));
  if (c.cta) textEls.push(el(id, "button", { label: c.cta.label, href: c.cta.href, variant: "primary", size: "md", icon: "arrow" }));
  return section(
    id,
    [
      row(
        id,
        [col(id, [el(id, "image", { src: "", alt: c.imageAlt ?? "", placeholder: true, ratio: opts.ratio ?? "1/1" })], 6), col(id, textEls, 6, { valign: "center" })],
        { valign: "center", reverse: !!opts.imageEnd }
      ),
    ],
    look("image-text", l)
  );
}

export interface IconItem {
  icon: string;
  title: string;
  text: string;
}

export function benefitsSection(id: IdFactory, c: { eyebrow?: string; title: string; text?: string; items: IconItem[] }, l: SectionLook = {}): TreeSection {
  const span = Math.max(3, Math.floor(12 / Math.max(1, c.items.length)));
  return section(
    id,
    [
      headerRow(id, c),
      row(
        id,
        c.items.map((it) =>
          col(id, [el(id, "icon", { name: it.icon, size: 26, style: "badge" }), el(id, "heading", { text: it.title, level: 3 }), el(id, "text", { text: it.text, size: "sm" })], span)
        ),
        { layout: "cards", mobileColumns: c.items.length >= 4 ? 2 : 1 }
      ),
    ],
    look("benefits", { tone: "surface", ...l })
  );
}

export function stepsSection(id: IdFactory, c: { eyebrow?: string; title: string; text?: string; items: Array<{ title: string; text: string }> }, l: SectionLook = {}): TreeSection {
  const span = Math.max(3, Math.floor(12 / Math.max(1, c.items.length)));
  return section(
    id,
    [
      headerRow(id, c),
      row(id, c.items.map((it) => col(id, [el(id, "heading", { text: it.title, level: 3 }), el(id, "text", { text: it.text, size: "sm" })], span)), { layout: "steps" }),
    ],
    look("steps", l)
  );
}

export function trustSection(id: IdFactory, c: { items: IconItem[] }, l: SectionLook = {}): TreeSection {
  const span = Math.max(3, Math.floor(12 / Math.max(1, c.items.length)));
  return section(
    id,
    [
      row(
        id,
        c.items.map((it) => col(id, [el(id, "icon", { name: it.icon, size: 22, style: "badge" }), el(id, "heading", { text: it.title, level: 3, size: "sm" }), el(id, "text", { text: it.text, size: "sm" })], span)),
        { layout: "cards" }
      ),
    ],
    look("trust", { padding: "sm", ...l })
  );
}

export function faqSection(id: IdFactory, c: { eyebrow?: string; title: string; text?: string; items: Array<{ q: string; a: string }> }, l: SectionLook = {}): TreeSection {
  return section(id, [headerRow(id, c), row(id, [col(id, [el(id, "faq", { title: "", items: c.items })])])], look("faq", { width: "narrow", ...l }));
}

export function richTextSection(id: IdFactory, c: { eyebrow?: string; title: string; text: string }, l: SectionLook = {}): TreeSection {
  return section(
    id,
    [row(id, [col(id, [el(id, "heading", { text: c.title, level: 2, ...(c.eyebrow ? { eyebrow: c.eyebrow } : {}) }), el(id, "divider", { style: "short" }), el(id, "rich_text", { text: c.text })])])],
    look("rich-text", { width: "narrow", ...l })
  );
}

export function ctaSection(id: IdFactory, c: { title: string; text: string; primary: Cta; secondary?: Cta }, l: SectionLook = {}): TreeSection {
  return section(
    id,
    [row(id, [col(id, [el(id, "heading", { text: c.title, level: 2 }), el(id, "text", { text: c.text, size: "lead" }), ...buttons(id, c.primary, c.secondary)], 12, { align: "center" })])],
    look("cta", { tone: "gradient", decor: true, width: "narrow", ...l }, { align: "center" })
  );
}

export function gallerySection(id: IdFactory, c: { eyebrow?: string; title: string; text?: string; count?: number; columns?: number }, l: SectionLook = {}): TreeSection {
  return section(
    id,
    [headerRow(id, c), row(id, [col(id, [el(id, "gallery", { title: "", images: [], columns: c.columns ?? 3, placeholderCount: c.count ?? 6 })])])],
    look("gallery", l)
  );
}

export function countdownSection(id: IdFactory, c: { title: string; text: string; label: string; cta?: Cta }, l: SectionLook = {}): TreeSection {
  const elements = [el(id, "heading", { text: c.title, level: 2 }), el(id, "text", { text: c.text }), el(id, "countdown", { label: c.label, endsAt: "" })];
  if (c.cta) elements.push(el(id, "button", { label: c.cta.label, href: c.cta.href, variant: "primary", size: "lg" }));
  return section(id, [row(id, [col(id, elements, 12, { align: "center" })])], look("countdown", { tone: "soft", width: "narrow", ...l }, { align: "center", requires: "countdown" }));
}

export function whatsappSection(id: IdFactory, c: { title: string; text: string; buttonLabel: string }, l: SectionLook = {}): TreeSection {
  return section(
    id,
    [
      row(id, [
        col(
          id,
          [
            el(id, "icon", { name: "whatsapp", size: 30, style: "badge" }),
            el(id, "heading", { text: c.title, level: 2 }),
            el(id, "text", { text: c.text }),
            // href stays empty until the merchant adds their number (https://wa.me/20…): hidden on the live store until then.
            el(id, "button", { label: c.buttonLabel, href: "", variant: "primary", size: "lg", icon: "whatsapp" }),
          ],
          12,
          { align: "center", card: true }
        ),
      ]),
    ],
    look("whatsapp", { tone: "surface", width: "narrow", ...l }, { align: "center" })
  );
}

export function logoStripSection(id: IdFactory, c: { title: string; count?: number }, l: SectionLook = {}): TreeSection {
  const count = c.count ?? 5;
  const span = Math.max(2, Math.floor(12 / count));
  return section(
    id,
    [
      row(id, [col(id, [el(id, "heading", { text: c.title, level: 2, size: "sm" })], 12, { align: "center" })]),
      row(id, Array.from({ length: count }, () => col(id, [el(id, "image", { src: "", alt: "", placeholder: true })], span)), { layout: "logos", mobileColumns: 2 }),
    ],
    look("logos", { padding: "sm", ...l })
  );
}

/** Endless strip of short selling points (list style "marquee"). */
export function marqueeSection(id: IdFactory, c: { items: string[]; icon?: string }, l: SectionLook = {}): TreeSection {
  return section(
    id,
    [row(id, [col(id, [el(id, "list", { title: "", items: c.items, style: "marquee", speed: 30, ...(c.icon ? { icon: c.icon } : {}) })])])],
    look("marquee", { tone: "primary", padding: "sm", width: "full", ...l })
  );
}

/** "Us vs others" table: first column = feature, second = your store (highlighted), ✓ / ✗ render as icons. */
export function comparisonSection(id: IdFactory, c: { eyebrow?: string; title: string; text?: string; table: string }, l: SectionLook = {}): TreeSection {
  return section(
    id,
    [headerRow(id, c), row(id, [col(id, [el(id, "rich_text", { text: c.table, format: "table", variant: "compare" })])])],
    look("comparison", { width: "narrow", ...l })
  );
}

/** Quantity/bundle offer cards; the tier with a badge is highlighted. Prices are written by the merchant. */
export function bundleSection(
  id: IdFactory,
  c: { eyebrow?: string; title: string; text?: string; tiers: Array<{ name: string; text: string; badge?: string; cta: Cta }> },
  l: SectionLook = {}
): TreeSection {
  const span = Math.max(3, Math.floor(12 / Math.max(1, c.tiers.length)));
  return section(
    id,
    [
      headerRow(id, c),
      row(
        id,
        c.tiers.map((tier) =>
          col(
            id,
            [
              el(id, "heading", { text: tier.name, level: 3, ...(tier.badge ? { eyebrow: tier.badge } : {}) }),
              el(id, "text", { text: tier.text }),
              el(id, "button", { label: tier.cta.label, href: tier.cta.href, variant: tier.badge ? "primary" : "outline", size: "md" }),
            ],
            span,
            { align: "center", ...(tier.badge ? { highlight: true } : {}) }
          )
        ),
        { layout: "cards" }
      ),
    ],
    look("bundles", { tone: "surface", ...l })
  );
}

/** Before/after slider (gallery in "compare" mode: first image = before, second = after). */
export function beforeAfterSection(id: IdFactory, c: { eyebrow?: string; title: string; text?: string; beforeLabel: string; afterLabel: string }, l: SectionLook = {}): TreeSection {
  return section(
    id,
    [
      headerRow(id, c),
      row(id, [col(id, [el(id, "gallery", { title: "", images: [], mode: "compare", beforeLabel: c.beforeLabel, afterLabel: c.afterLabel, placeholderCount: 2 })])]),
    ],
    look("before-after", { width: "narrow", ...l })
  );
}

export function spacerSection(id: IdFactory, height = 48): TreeSection {
  return section(id, [row(id, [col(id, [el(id, "spacer", { height })])])], look("spacer", { padding: "none" }));
}

export function dividerSection(id: IdFactory): TreeSection {
  return section(id, [row(id, [col(id, [el(id, "divider", { style: "solid" })])])], look("divider", { padding: "sm" }));
}

export function testimonialsSection(id: IdFactory, c: { eyebrow?: string; title: string; text?: string; count?: number }, l: SectionLook = {}): TreeSection {
  const count = c.count ?? 3;
  const span = Math.max(4, Math.floor(12 / count));
  return section(
    id,
    [
      headerRow(id, c),
      // Empty quotes: nothing renders on the live store until the merchant types real customer words.
      row(id, Array.from({ length: count }, () => col(id, [el(id, "testimonial", { quote: "", author: "", role: "", rating: 0 })], span))),
    ],
    look("testimonials", { tone: "surface", ...l }, { requires: "testimonial" })
  );
}

export function sizeGuideSection(id: IdFactory, c: { title: string; text: string; table: string }, l: SectionLook = {}): TreeSection {
  return section(
    id,
    [row(id, [col(id, [el(id, "heading", { text: c.title, level: 2 }), el(id, "text", { text: c.text, size: "sm" }), el(id, "rich_text", { text: c.table, format: "table" })])])],
    look("size-guide", { width: "narrow", ...l })
  );
}

export function contactInfoSection(id: IdFactory, c: { eyebrow?: string; title: string; text?: string; items: IconItem[] }, l: SectionLook = {}): TreeSection {
  return benefitsSection(id, c, { tone: "default", ...l });
}

export function mapSection(id: IdFactory, c: { title: string; text: string; address: string; placeTitle?: string }, l: SectionLook = {}): TreeSection {
  return section(
    id,
    [
      row(
        id,
        [
          col(id, [el(id, "heading", { text: c.title, level: 2 }), el(id, "text", { text: c.text })], 5, { valign: "center" }),
          col(id, [el(id, "map", { address: c.address, title: c.placeTitle ?? "", zoom: 14 })], 7, { valign: "center" }),
        ],
        { valign: "center" }
      ),
    ],
    look("map", l)
  );
}

export function videoSection(id: IdFactory, c: { title: string; text: string }, l: SectionLook = {}): TreeSection {
  return section(
    id,
    [headerRow(id, c), row(id, [col(id, [el(id, "video", { url: "", poster: "", title: c.title, placeholder: true })])])],
    look("video", { width: "default", ...l })
  );
}

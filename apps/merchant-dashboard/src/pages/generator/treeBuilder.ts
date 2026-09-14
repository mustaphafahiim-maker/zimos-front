import type { PageColumn, PageElement, PageElementType, PageRow, PageSection, PageTree } from "@store-builder/api-client";
import type { Copy } from "./copyEngine";
import { SECTION_KEYS, type Brief, type Overrides, type SectionKey, type StyleOptions } from "./types";

/**
 * Turns a brief + generated copy into a backend-valid PageTree
 * (modules/pages/pageTree.js): section -> row -> column(span 1-12) -> element,
 * only allowlisted element types, props shaped exactly as the storefront
 * renderer (apps/storefront/src/components/page-renderer) reads them.
 *
 * Ids are deterministic (`g-<section>-<role>`) so inline edits (Overrides) and
 * per-section shuffles survive a rebuild.
 */

const ID_PREFIX = "gen-";

/** Storefront routes Next.js resolves before the page builder — never usable as a page path. */
export const RESERVED_SEGMENTS = ["cart", "checkout", "products", "orders", "offer", "track", "store"];

export const PATH_PATTERN = /^[a-z0-9](?:[a-z0-9\-_/]*[a-z0-9])?$/;

export function sectionIdOf(key: SectionKey): string {
  return `${ID_PREFIX}${key}`;
}

export function sectionKeyOf(id: string | undefined): SectionKey | null {
  if (!id?.startsWith(ID_PREFIX)) return null;
  const key = id.slice(ID_PREFIX.length);
  return (SECTION_KEYS as readonly string[]).includes(key) ? (key as SectionKey) : null;
}

/** Where every order button points: the product page's real COD order form. */
export function orderHref(brief: Brief): string {
  return brief.productSlug ? `/products/${brief.productSlug}#order-form` : "/";
}

/** Hours until the merchant's real end date (the storefront countdown only stores a duration). */
export function countdownHours(end: string, now = Date.now()): number | null {
  const t = new Date(end).getTime();
  if (Number.isNaN(t) || t <= now) return null;
  return Math.min(8760, Math.max(1, Math.ceil((t - now) / 3_600_000)));
}

export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n|،|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const el = (id: string, type: PageElementType, props: Record<string, unknown>): PageElement => ({ id, type, props });
const col = (id: string, span: number, elements: PageElement[]): PageColumn => ({ id, type: "column", span, elements });
const row = (id: string, columns: PageColumn[]): PageRow => ({ id, type: "row", columns });

function spanFor(n: number): number {
  return n >= 3 ? 4 : n === 2 ? 6 : 12;
}

function toDigits(n: number, lang: StyleOptions["lang"]): string {
  return lang === "en" ? String(n) : n.toLocaleString("ar-EG");
}

/** Why a section is (not) on the page — used for the checklist hints too. */
export function sectionAvailable(key: SectionKey, brief: Brief): boolean {
  switch (key) {
    case "benefits":
      return brief.benefits.some((b) => b.trim()) || !!brief.description.trim();
    case "box":
      return splitLines(brief.box).length > 0;
    case "proof":
      return brief.quotes.some((q) => q.quote.trim());
    default:
      return true;
  }
}

export function buildTree(brief: Brief, style: StyleOptions, copy: Copy, overrides: Overrides): PageTree {
  const on = (key: SectionKey) => style.sections[key] && sectionAvailable(key, brief);
  const href = orderHref(brief);
  const sections: PageSection[] = [];
  const add = (key: SectionKey, rows: PageRow[]) => {
    if (rows.length) sections.push({ id: sectionIdOf(key), type: "section", rows });
  };
  const images = brief.images.map((m) => m.url).filter(Boolean);

  if (on("hero")) {
    const k = "g-hero";
    const textEls = [
      el(`${k}-h`, "heading", { text: copy.headline, level: 1 }),
      el(`${k}-sub`, "rich_text", { text: copy.sub }),
      ...(copy.priceLine ? [el(`${k}-price`, "heading", { text: copy.priceLine, level: 3 })] : []),
      el(`${k}-btn`, "button", { label: copy.heroCta, href, variant: "primary" }),
    ];
    add(
      "hero",
      images[0]
        ? [row(`${k}-r`, [col(`${k}-c1`, 6, [el(`${k}-img`, "image", { src: images[0], alt: brief.name })]), col(`${k}-c2`, 6, textEls)])]
        : [row(`${k}-r`, [col(`${k}-c1`, 12, textEls)])]
    );
  }

  if (on("benefits")) {
    const k = "g-benefits";
    const benefits = brief.benefits.map((b) => b.trim()).filter(Boolean);
    const rows = [
      row(`${k}-r`, [
        col(`${k}-c`, 12, [
          el(`${k}-h`, "heading", { text: copy.benefitsTitle, level: 2 }),
          ...(benefits.length ? [el(`${k}-intro`, "text", { text: copy.benefitsIntro })] : []),
          ...(brief.description.trim() ? [el(`${k}-desc`, "text", { text: brief.description.trim() })] : []),
          ...(benefits.length ? [el(`${k}-list`, "list", { title: "", items: benefits })] : []),
        ]),
      ]),
    ];
    if (images.length > 1) {
      const gallery = images.slice(1, 7);
      rows.push(
        row(`${k}-r2`, [
          col(`${k}-c2`, 12, [el(`${k}-gallery`, "gallery", { title: "", images: gallery, columns: Math.min(3, gallery.length) })]),
        ])
      );
    }
    add("benefits", rows);
  }

  if (on("how")) {
    const k = "g-how";
    add("how", [
      row(`${k}-r`, [col(`${k}-c`, 12, [el(`${k}-h`, "heading", { text: copy.howTitle, level: 2 })])]),
      row(
        `${k}-r2`,
        copy.steps.map((s, i) =>
          col(`${k}-s${i}`, spanFor(copy.steps.length), [
            el(`${k}-s${i}-h`, "heading", { text: `${toDigits(i + 1, style.lang)}. ${s.title}`, level: 3 }),
            el(`${k}-s${i}-t`, "text", { text: s.text }),
          ])
        )
      ),
    ]);
  }

  if (on("box")) {
    const k = "g-box";
    add("box", [
      row(`${k}-r`, [
        col(`${k}-c`, 12, [
          el(`${k}-h`, "heading", { text: copy.boxTitle, level: 2 }),
          el(`${k}-list`, "list", { title: "", items: splitLines(brief.box) }),
        ]),
      ]),
    ]);
  }

  if (on("proof")) {
    const k = "g-proof";
    const quotes = brief.quotes.filter((q) => q.quote.trim()).slice(0, 3);
    add("proof", [
      row(`${k}-r`, [col(`${k}-c`, 12, [el(`${k}-h`, "heading", { text: copy.proofTitle, level: 2 })])]),
      row(
        `${k}-r2`,
        quotes.map((q, i) =>
          col(`${k}-q${i}`, spanFor(quotes.length), [
            // rating 0 = no stars: we never invent a score the customer didn't give.
            el(`${k}-q${i}-t`, "testimonial", { quote: q.quote.trim(), author: q.author.trim(), rating: 0 }),
          ])
        )
      ),
    ]);
  }

  if (on("guarantee")) {
    const k = "g-guarantee";
    const rows = [
      row(`${k}-r`, [col(`${k}-c`, 12, [el(`${k}-h`, "heading", { text: copy.guaranteeTitle, level: 2 })])]),
      row(
        `${k}-r2`,
        copy.trust.map((item, i) =>
          col(`${k}-t${i}`, spanFor(copy.trust.length), [
            el(`${k}-t${i}-i`, "icon", { name: item.icon, size: 32 }),
            el(`${k}-t${i}-h`, "heading", { text: item.title, level: 4 }),
            el(`${k}-t${i}-x`, "text", { text: item.text }),
          ])
        )
      ),
    ];
    if (brief.guarantee.trim()) {
      rows.push(row(`${k}-r3`, [col(`${k}-c3`, 12, [el(`${k}-g`, "text", { text: brief.guarantee.trim() })])]));
    }
    add("guarantee", rows);
  }

  if (on("faq") && copy.faq.length) {
    const k = "g-faq";
    add("faq", [row(`${k}-r`, [col(`${k}-c`, 12, [el(`${k}-list`, "faq", { title: copy.faqTitle, items: copy.faq })])])]);
  }

  if (on("cta")) {
    const k = "g-cta";
    const hours = style.countdownOn ? countdownHours(style.countdownEnd) : null;
    add("cta", [
      row(`${k}-r`, [
        col(`${k}-c`, 12, [
          el(`${k}-h`, "heading", { text: copy.ctaTitle, level: 2 }),
          el(`${k}-body`, "text", { text: copy.ctaBody }),
          ...(hours !== null && copy.countdownLabel
            ? [el(`${k}-countdown`, "countdown", { label: copy.countdownLabel, endsInHours: hours })]
            : []),
          ...(brief.productId
            ? [el(`${k}-product`, "product_card", { title: "", productId: brief.productId, showPrice: true, showBuyButton: false })]
            : [el(`${k}-btn`, "button", { label: copy.ctaButton, href, variant: "primary" })]),
        ]),
      ]),
    ]);
  }

  if (on("sticky")) {
    const k = "g-sticky";
    add("sticky", [
      row(`${k}-r`, [
        col(`${k}-c`, 12, [
          el(`${k}-text`, "heading", { text: copy.stickyText, level: 3 }),
          el(`${k}-btn`, "button", { label: copy.stickyButton, href, variant: "primary" }),
        ]),
      ]),
    ]);
  }

  const withOverrides = sections.map((s) => ({
    ...s,
    rows: s.rows.map((r) => ({
      ...r,
      columns: r.columns.map((c) => ({
        ...c,
        elements: c.elements.map((e) => (overrides[e.id] ? { ...e, props: { ...e.props, ...overrides[e.id] } } : e)),
      })),
    })),
  }));

  return {
    version: 1,
    globalStyles: {
      accentColor: style.accent,
      generator: { kind: "smart-template", lang: style.lang, tone: style.tone, category: style.category },
    },
    sections: withOverrides,
  };
}

/** Reads one element's string prop out of a tree (for SEO title/description). */
export function findTextProp(tree: PageTree, id: string, prop = "text"): string {
  for (const s of tree.sections)
    for (const r of s.rows)
      for (const c of r.columns)
        for (const e of c.elements) if (e.id === id && typeof e.props?.[prop] === "string") return e.props[prop] as string;
  return "";
}

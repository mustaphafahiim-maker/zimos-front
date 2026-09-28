import type { PageElement, PageSection, PageTree } from "@store-builder/api-client";
import { BLOCK_PRESETS, createSection } from "./editor/blocks";
import type { EditorLocale } from "./editor/editorLocale";

/**
 * The page the theme gallery renders each theme with — built from the editor's
 * own block presets, so it is what the merchant would get by adding them:
 *
 *  - the opening section, headed with the store's own name (and its tagline,
 *    when it has one) — each theme lays this one out its own way;
 *  - the store's real products (the storefront leaves the grid out while
 *    there are none);
 *  - three feature cards, where the theme's card style shows;
 *  - a call-to-action band in the accent colour.
 *
 * Nothing in it names a kind of shop: the rest of the copy is the presets'
 * own neutral prompts, and no picture is involved.
 */
export const SHOWCASE_SECTIONS = ["hero-gallery", "product-grid-intro", "feature-grid-3", "cta-band"] as const;

function preset(key: string) {
  const found = BLOCK_PRESETS.find((p) => p.key === key);
  if (!found) throw new Error(`Unknown block preset "${key}"`);
  return found;
}

/** Every element of a section, in document order. */
function elementsOf(section: PageSection): PageElement[] {
  return (section.rows ?? []).flatMap((row) => (row.columns ?? []).flatMap((column) => column.elements ?? []));
}

export function themeShowcaseTree(
  store: { name: string; tagline?: string | null },
  locale: EditorLocale
): PageTree {
  const sections = SHOWCASE_SECTIONS.map((key) => createSection(preset(key), locale));
  const heroElements = elementsOf(sections[0]);
  const heading = heroElements.find((el) => el.type === "heading");
  const text = heroElements.find((el) => el.type === "text");
  if (heading && store.name.trim()) heading.props = { ...heading.props, text: store.name.trim() };
  if (text && store.tagline?.trim()) text.props = { ...text.props, text: store.tagline.trim() };
  return { version: 1, sections };
}

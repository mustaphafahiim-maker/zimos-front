import type { WebsiteTemplateSummary } from "@store-builder/api-client";

/** Chip value that shows every template. Categories are snake_case, so it can't collide. */
export const ALL_CATEGORIES = "all";

/**
 * The categories the catalogue actually has, in the order they first appear
 * (the API lists templates by name). Templates without one only show under
 * "All".
 */
export function templateCategories(templates: ReadonlyArray<WebsiteTemplateSummary>): string[] {
  const seen = new Set<string>();
  for (const t of templates) {
    if (t.category) seen.add(t.category);
  }
  return [...seen];
}

/**
 * Folds the spellings people type interchangeably so a search still matches:
 * case, Arabic diacritics and tatweel, the alef forms, taa marbuta and alef
 * maqsura.
 */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** The language a template's pages are written in, as the gallery's language switch names it. */
export type TemplateLanguage = "en" | "ar";

/** A template's language: Arabic when it is right-to-left, English otherwise. */
export function templateLanguage(template: Pick<WebsiteTemplateSummary, "rtl">): TemplateLanguage {
  return template.rtl === true ? "ar" : "en";
}

/**
 * Is this language code Arabic? The API spells a store's language in full
 * ("ar-EG"), so the base before any region is what counts.
 */
export function isArabicLocale(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase().split(/[-_]/)[0] === "ar";
}

/** What the console adds to the name of a design's Arabic copy: «XS 01» and «XS 01 عربي». */
const ARABIC_TWIN_SUFFIX = /\s+عربي$/;

const taggedArabic = (template: WebsiteTemplateSummary) => (template.tags ?? []).includes("ar");

/**
 * Templates that are one design in two languages — «XS 01» and its Arabic
 * copy «XS 01 عربي» — as each one's twin, both ways. The Arabic one is
 * right-to-left, tagged `ar`, and named after the English one plus «عربي»;
 * the English one is neither right-to-left nor tagged `ar`. Anything else (a
 * template in one language only, a funnel, a second template under a name
 * already paired) has no twin.
 */
export function templateTwins(templates: ReadonlyArray<WebsiteTemplateSummary>): Map<string, WebsiteTemplateSummary> {
  const english = new Map<string, WebsiteTemplateSummary[]>();
  for (const template of templates) {
    if (template.rtl === true || taggedArabic(template)) continue;
    const name = template.name.trim();
    english.set(name, [...(english.get(name) ?? []), template]);
  }
  const twins = new Map<string, WebsiteTemplateSummary>();
  for (const template of templates) {
    const name = template.name.trim();
    if (template.rtl !== true || !taggedArabic(template) || !ARABIC_TWIN_SUFFIX.test(name)) continue;
    const match = english.get(name.replace(ARABIC_TWIN_SUFFIX, ""))?.find((candidate) => !twins.has(candidate.id));
    if (!match) continue;
    twins.set(match.id, template);
    twins.set(template.id, match);
  }
  return twins;
}

/**
 * The catalogue as the gallery shows it in one language: one card per
 * design. A template with a twin shows only in the chosen language, in the
 * place the first of the two holds in the catalogue, so switching language
 * never moves a card; a template without one always shows.
 */
export function templatesInLanguage(
  templates: ReadonlyArray<WebsiteTemplateSummary>,
  language: TemplateLanguage,
  twins: ReadonlyMap<string, WebsiteTemplateSummary> = templateTwins(templates)
): WebsiteTemplateSummary[] {
  const shown: WebsiteTemplateSummary[] = [];
  const placed = new Set<string>();
  for (const template of templates) {
    const twin = twins.get(template.id);
    if (!twin) {
      shown.push(template);
      continue;
    }
    if (placed.has(template.id)) continue;
    placed.add(template.id);
    placed.add(twin.id);
    shown.push(templateLanguage(template) === language ? template : twin);
  }
  return shown;
}

/** Templates in `category` (or all) whose name contains `query`. */
export function filterTemplates(
  templates: ReadonlyArray<WebsiteTemplateSummary>,
  { category, query }: { category: string; query: string }
): WebsiteTemplateSummary[] {
  const needle = normalizeSearch(query);
  return templates.filter(
    (t) =>
      (category === ALL_CATEGORIES || t.category === category) &&
      (needle === "" || normalizeSearch(t.name).includes(needle))
  );
}

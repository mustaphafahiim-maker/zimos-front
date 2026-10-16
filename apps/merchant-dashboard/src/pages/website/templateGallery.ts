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

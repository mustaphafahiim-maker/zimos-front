import { intlLocaleFor, type Locale } from "./i18n";

/**
 * Small helpers for the store's blog (app/store/[workspaceId]/blog,
 * components/blog). Addresses are store paths, written as if the store were at
 * the root of its own site; StoreLink adds the prefix.
 */

/** A post's address. Slugs keep Arabic letters, so they are encoded. */
export const postHref = (slug: string) => `/blog/${encodeURIComponent(slug)}`;

/** The index, one category of it, one tag of it, or one of its pages. */
export function blogHref({ category, tag, page }: { category?: string | null; tag?: string | null; page?: number } = {}): string {
  const query = new URLSearchParams();
  if (category) query.set("category", category);
  if (tag) query.set("tag", tag);
  if (page && page > 1) query.set("page", String(page));
  const s = query.toString();
  return s ? `/blog?${s}` : "/blog";
}

/** "6 October 2026" in the store's language and digits. */
export function postDate(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocaleFor(locale), { year: "numeric", month: "long", day: "numeric" }).format(date);
}

/** A single query value: the first of a repeated one, trimmed; undefined when empty. */
export function oneParam(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.trim() ? v.trim() : undefined;
}

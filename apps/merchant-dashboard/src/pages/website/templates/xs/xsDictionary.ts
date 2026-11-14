/**
 * The imported templates' English for their Arabic copies: every text an
 * English template shows ("XS 01") beside the text at the same place in its
 * Arabic copy ("XS 01 عربي") — the bands' words, the pages' titles, the
 * header and footer — and the template's products and collections. Read
 * Arabic → English, it fills the English of a store built on an Arabic
 * template (Languages → "Fill the English from the template").
 *
 * Built from the generated templates when they are built (`npm run
 * templates:build`, xsDictionary.test.ts writes xsDictionary.json), never at
 * run time. Which texts count is what the API offers for translation
 * (Backend modules/translations/contentTranslations.js: TEXT_KEYS,
 * STRING_LIST_KEYS and the header's and footer's `label` / `title` / `text`),
 * so every entry is a text a store can be asked to translate.
 */

type Blob = Record<string, unknown>;

/** The API's text props (contentTranslations.js TEXT_KEYS), and its lists of plain strings. */
const TEXT_KEYS = new Set([
  "text", "alt", "title", "label", "name", "author", "heading", "subheading", "subtitle", "kicker", "sub", "badge",
  "body", "quote", "description", "desc", "pain", "caption", "question", "answer", "placeholder",
  "submitLabel", "successMessage", "choiceLabel", "checkboxLabel", "ctaLabel", "buttonLabel", "cartLabel", "saveLabel",
  "usLabel", "themLabel", "us", "them",
  "linkLabel", "button2Label", "eyebrow", "role", "meta", "quoteAuthor", "allLabel", "searchLabel", "searchPlaceholder",
  "loadMoreLabel", "viewLabel", "openLabel", "contactPlaceholder", "messagePlaceholder",
]);
const LIST_KEYS = new Set(["items", "points", "countdownLabels"]);
const SKIP_KEYS = new Set(["bindings", "style", "styles", "responsive", "visibility"]);
/** The header's and footer's words (contentTranslations.js walkShell). */
const SHELL_TEXT_KEYS = new Set(["label", "title", "text"]);
const SHELL_LIST_KEYS = new Set(["messages", "text"]);
const SHELL_SKIP_KEYS = new Set(["colors", "sizes", "show", "logo", "logoImage", "href", "id", "type", "kind", "layout", "width", "align", "hide"]);

const isObject = (value: unknown): value is Blob => value !== null && typeof value === "object" && !Array.isArray(value);
const isNode = (value: unknown): value is Blob => isObject(value) && typeof value.type === "string" && isObject(value.props);

/** An English text and what stands at the same place in the Arabic copy (null: nothing there). */
type Visit = (english: string, arabic: string | null) => void;

function pairTree(en: unknown, ar: unknown, visit: Visit) {
  if (Array.isArray(en)) {
    en.forEach((child, i) => pairTree(child, Array.isArray(ar) ? ar[i] : undefined, visit));
    return;
  }
  if (!isObject(en)) return;
  const other = isObject(ar) ? ar : {};
  for (const [key, value] of Object.entries(en)) {
    if (key === "props" && isObject(value) && typeof en.type === "string") pairProps(value, other.props, visit);
    else if (typeof value === "object") pairTree(value, other[key], visit);
  }
}

function pairProps(en: Blob, ar: unknown, visit: Visit) {
  const other = isObject(ar) ? ar : {};
  for (const [key, value] of Object.entries(en)) {
    if (SKIP_KEYS.has(key)) continue;
    const there = other[key];
    if (typeof value === "string") {
      if (TEXT_KEYS.has(key) && value.trim()) visit(value, typeof there === "string" ? there : null);
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        const at = Array.isArray(there) ? there[i] : undefined;
        if (typeof item === "string") {
          if (LIST_KEYS.has(key) && item.trim()) visit(item, typeof at === "string" ? at : null);
        } else if (isNode(item)) pairTree(item, at, visit);
        else if (isObject(item)) pairProps(item, at, visit);
      });
    } else if (isNode(value)) pairTree(value, there, visit);
    else if (isObject(value)) pairProps(value, there, visit);
  }
}

function pairShell(en: unknown, ar: unknown, visit: Visit) {
  if (Array.isArray(en)) {
    en.forEach((child, i) => pairShell(child, Array.isArray(ar) ? ar[i] : undefined, visit));
    return;
  }
  if (!isObject(en)) return;
  const other = isObject(ar) ? ar : {};
  for (const [key, value] of Object.entries(en)) {
    if (SHELL_SKIP_KEYS.has(key)) continue;
    const there = other[key];
    if (typeof value === "string") {
      if (SHELL_TEXT_KEYS.has(key) && value.trim()) visit(value, typeof there === "string" ? there : null);
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        const at = Array.isArray(there) ? there[i] : undefined;
        if (typeof item === "string") {
          if (SHELL_LIST_KEYS.has(key) && item.trim()) visit(item, typeof at === "string" ? at : null);
        } else pairShell(item, at, visit);
      });
    } else if (isObject(value)) pairShell(value, there, visit);
  }
}

/** A built template as generated/<key>.json holds it. */
export interface TemplateFile {
  key: string;
  version: { globalStyles?: Blob; pages: Array<{ title?: string; builderData?: unknown }> };
}

/** A template's catalogue as xs/products/xsNN.products.json holds it. */
export interface CatalogFile {
  collections?: Array<{ name?: string; nameAr?: string }>;
  products?: Array<{ name?: string; nameAr?: string; description?: string; descriptionAr?: string }>;
}

export interface XsDictionary {
  /** Arabic → English, every text of the Arabic copies the API may be asked to translate. */
  arToEn: Record<string, string>;
  /** Per English template, its texts whose Arabic copy says the same words (a name, a number): nothing to fill. */
  unmatched: Record<string, string[]>;
  /** Per English template, its texts with nothing at the same place in its Arabic copy: a copy out of step. */
  absent: Record<string, string[]>;
  /** Arabic texts that are more than one English text; the first is the one kept in `arToEn`. */
  conflicts: Record<string, string[]>;
  /** Per look ("01"…), the English its own templates give where it differs from `arToEn`'s: a store gets its template's words first. */
  byLook: Record<string, Record<string, string>>;
}

/**
 * The dictionary from each English template and its Arabic copy, and the
 * templates' catalogues. Written in order: the first English for an Arabic
 * text is the one kept.
 */
export function buildXsDictionary(pairs: Array<{ en: TemplateFile; ar: TemplateFile }>, catalogs: CatalogFile[] = []): XsDictionary {
  const enToAr: Array<[string, string]> = [];
  /** The pairs each look's templates give, in order (the catalogues are every look's). */
  const lookPairs = new Map<string, Array<[string, string]>>();
  const unmatched: Record<string, string[]> = {};
  const absent: Record<string, string[]> = {};

  for (const { en, ar } of pairs) {
    const same = new Set<string>();
    const none = new Set<string>();
    const visit: Visit = (english, arabic) => {
      const from = english.trim();
      const to = arabic?.trim() ?? "";
      if (!to) none.add(from);
      else if (to === from) same.add(from);
      else {
        enToAr.push([from, to]);
        const look = lookOf(en);
        if (look) lookPairs.set(look, [...(lookPairs.get(look) ?? []), [from, to]]);
      }
    };
    en.version.pages.forEach((page, i) => {
      const other = ar.version.pages[i];
      if (page.title?.trim()) visit(page.title, other?.title ?? null);
      pairTree(page.builderData, other?.builderData, visit);
    });
    const shell = en.version.globalStyles?.themeSettings;
    const arShell = ar.version.globalStyles?.themeSettings;
    for (const part of ["header", "footer"]) {
      pairShell(isObject(shell) ? shell[part] : undefined, isObject(arShell) ? arShell[part] : undefined, visit);
    }
    if (same.size > 0) unmatched[en.key] = [...same].sort();
    if (none.size > 0) absent[en.key] = [...none].sort();
  }

  for (const catalog of catalogs) {
    for (const item of [...(catalog.collections ?? []), ...(catalog.products ?? [])]) {
      if (item.name?.trim() && item.nameAr?.trim()) enToAr.push([item.name.trim(), item.nameAr.trim()]);
      const described = item as { description?: string; descriptionAr?: string };
      if (described.description?.trim() && described.descriptionAr?.trim()) enToAr.push([described.description.trim(), described.descriptionAr.trim()]);
    }
  }

  // Read the other way: Arabic → English.
  const arToEn = new Map<string, string>();
  const seen = new Map<string, Set<string>>();
  for (const [english, arabic] of enToAr) {
    if (!arToEn.has(arabic)) arToEn.set(arabic, english);
    seen.set(arabic, (seen.get(arabic) ?? new Set()).add(english));
  }
  const conflicts: Record<string, string[]> = {};
  for (const [arabic, englishes] of [...seen].sort(([a], [b]) => a.localeCompare(b))) {
    if (englishes.size > 1) conflicts[arabic] = [...englishes];
  }
  const sorted = [...arToEn].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const byLook: Record<string, Record<string, string>> = {};
  for (const [look, list] of [...lookPairs].sort(([a], [b]) => a.localeCompare(b))) {
    const own = new Map<string, string>();
    for (const [english, arabic] of list) if (!own.has(arabic)) own.set(arabic, english);
    const differs = [...own].filter(([arabic, english]) => arToEn.get(arabic) !== english).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    if (differs.length > 0) byLook[look] = Object.fromEntries(differs);
  }
  return { arToEn: Object.fromEntries(sorted), unmatched, absent, conflicts, byLook };
}

/** The look a template wears (globalStyles.themeSettings.xsLook). */
function lookOf(template: TemplateFile): string | null {
  const settings = template.version.globalStyles?.themeSettings;
  const look = isObject(settings) ? settings.xsLook : null;
  return typeof look === "string" && look ? look : null;
}

/**
 * What the dictionary gives for one text of a store, or null: the store's text
 * is the Arabic as the template wrote it (spaces at the ends aside). With the
 * look the store wears, that look's own English comes first.
 */
export function englishFor(dictionary: Pick<XsDictionary, "arToEn"> & Partial<Pick<XsDictionary, "byLook">>, arabic: string, look?: string | null): string | null {
  const text = arabic.trim();
  if (!text) return null;
  const own = look ? dictionary.byLook?.[look] : undefined;
  if (own && Object.hasOwn(own, text)) return own[text];
  return Object.hasOwn(dictionary.arToEn, text) ? dictionary.arToEn[text] : null;
}

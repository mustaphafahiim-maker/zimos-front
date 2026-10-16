import type { PageElement, PageSection } from "@store-builder/api-client";

/**
 * Item 95, shared by the website and funnel page editors:
 * duplicating a section or an element, and the text a double-click on the
 * canvas edits in place (the storefront's PreviewBridge posts
 * `zimos:edit-text`).
 */

/** A fresh id for a copy: the original's, with an earlier copy's suffix swapped for a new one. */
function copyId(id: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 6)
      : Math.random().toString(36).slice(2, 8);
  const base = (id || "n").replace(/-c[0-9a-z]{6}$/, "");
  return `${base}-c${rand}`;
}

export function cloneElement(element: PageElement): PageElement {
  const copy = JSON.parse(JSON.stringify(element)) as PageElement;
  return { ...copy, id: copyId(element.id) };
}

/** The section and everything in it, each node with a new id. Its look and any saved-section link come along. */
export function duplicateSection(section: PageSection): PageSection {
  const copy = JSON.parse(JSON.stringify(section)) as PageSection;
  return {
    ...copy,
    id: copyId(section.id),
    rows: (copy.rows ?? []).map((row) => ({
      ...row,
      id: copyId(row.id),
      columns: (row.columns ?? []).map((column) => ({
        ...column,
        id: copyId(column.id),
        elements: (column.elements ?? []).map(cloneElement),
      })),
    })),
  };
}

/**
 * A copy of one element, right after it in its column. An HTML block's copy
 * names the same code (customCode/htmlBlocks.js): editing either changes both.
 */
export function duplicateElement(section: PageSection, elementId: string): PageSection {
  let done = false;
  const rows = (section.rows ?? []).map((row) => ({
    ...row,
    columns: (row.columns ?? []).map((column) => {
      const elements = column.elements ?? [];
      const index = elements.findIndex((el) => el.id === elementId);
      if (index < 0 || done) return column;
      done = true;
      return { ...column, elements: [...elements.slice(0, index + 1), cloneElement(elements[index]), ...elements.slice(index + 1)] };
    }),
  }));
  return done ? { ...section, rows } : section;
}

/** The prop a double-click edits, per element type — plain text the renderer shows as it is. */
export const INLINE_TEXT_KEY: Record<string, string> = {
  heading: "text",
  text: "text",
  rich_text: "text",
  button: "label",
  text_link: "text",
};

function boundKeys(element: PageElement): Record<string, unknown> {
  const bindings = (element.props as Record<string, unknown> | undefined)?.bindings;
  return bindings && typeof bindings === "object" && !Array.isArray(bindings) ? (bindings as Record<string, unknown>) : {};
}

/** The elements whose text can be edited on the canvas: those types, unless the text is bound to live data. */
export function inlineTextIds(sections: PageSection[]): string[] {
  const ids: string[] = [];
  for (const section of sections) {
    for (const row of section.rows ?? []) {
      for (const column of row.columns ?? []) {
        for (const element of column.elements ?? []) {
          const key = INLINE_TEXT_KEY[element.type];
          if (key && !boundKeys(element)[key]) ids.push(element.id);
        }
      }
    }
  }
  return ids;
}

// --- a band with many words (an imported template's "xs" bands) -----------------
//
// Such a band is one element whose props hold every word and picture in it
// (a slider's slides, a row of banners). Its markup names no fields, so an
// edit made on the page comes back as "the word-run that read X, the nth of
// the equal ones" and is matched against the props here, in the same order
// the page draws them: the props' own.

/** Prop keys that are never words on the page: addresses, choices, ids. */
const NOT_WORDS = new Set([
  "look", "image", "images", "href", "linkHref", "buttonHref", "button2Href", "url", "collection", "variant", "layout", "icon",
  "align", "headingWeight", "imageRatio", "imageFit", "endsAt", "bindings", "id",
]);
const looksLikeAddress = (value: string) => /^(\/|#|https?:|mailto:|tel:)/i.test(value);
const tidy = (text: string) => text.replace(/\s+/g, " ").trim();
const isWords = (value: string, key: string) => !NOT_WORDS.has(key) && !/(Color|Href)$/.test(key) && value.trim() !== "" && !looksLikeAddress(value.trim());

/** Every string under `value`, in order; `visit` returns a replacement or null to leave it. The same value back when nothing changed. */
function mapStrings(value: unknown, key: string, visit: (text: string, key: string) => string | null): unknown {
  if (typeof value === "string") {
    const next = visit(value, key);
    return next === null ? value : next;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const next = mapStrings(item, key, visit);
      if (next !== item) changed = true;
      return next;
    });
    return changed ? out : value;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, item] of Object.entries(value as Record<string, unknown>)) {
      const next = mapStrings(item, k, visit);
      if (next !== item) changed = true;
      out[k] = next;
    }
    return changed ? out : value;
  }
  return value;
}

const isDeep = (element: PageElement) => element.type.startsWith("xs_");

/** Element id → the word-runs in it that a double-click edits on the page (a paragraph each, for a text of several). */
export function deepTextOf(sections: PageSection[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const section of sections) {
    for (const row of section.rows ?? []) {
      for (const column of row.columns ?? []) {
        for (const element of column.elements ?? []) {
          if (!isDeep(element)) continue;
          const words = new Set<string>();
          mapStrings(element.props ?? {}, "", (text, key) => {
            if (isWords(text, key)) for (const part of text.split(/\n+/)) if (tidy(part)) words.add(tidy(part));
            return null;
          });
          if (words.size > 0) out[element.id] = Array.from(words).slice(0, 600);
        }
      }
    }
  }
  return out;
}

function mapElement(sections: PageSection[], elementId: string, change: (element: PageElement) => PageElement): PageSection[] {
  let changed = false;
  const next = sections.map((section) => {
    let touched = false;
    const rows = (section.rows ?? []).map((row) => ({
      ...row,
      columns: (row.columns ?? []).map((column) => ({
        ...column,
        elements: (column.elements ?? []).map((element) => {
          if (element.id !== elementId) return element;
          const out = change(element);
          if (out !== element) touched = true;
          return out;
        }),
      })),
    }));
    if (!touched) return section;
    changed = true;
    return { ...section, rows };
  });
  return changed ? next : sections;
}

/** One word-run of a many-worded band set from the page: the `nth` of those that read `was`. */
export function replaceDeepWords(sections: PageSection[], elementId: string, was: string, nth: number, text: string): PageSection[] {
  return mapElement(sections, elementId, (element) => {
    let seen = 0;
    let done = false;
    const props = mapStrings(element.props ?? {}, "", (value, key) => {
      if (done || !isWords(value, key)) return null;
      // Paragraphs are separate runs on the page; the breaks between them are kept as they were.
      const parts = value.split(/(\n+)/);
      for (let i = 0; i < parts.length; i += 2) {
        if (tidy(parts[i]) !== was) continue;
        if (seen++ !== nth) continue;
        parts[i] = text;
        done = true;
        return parts.join("");
      }
      return null;
    });
    return done ? { ...element, props: props as PageElement["props"] } : element;
  });
}

/** One picture of a many-pictured band replaced from the page: the `nth` of those whose address is `was`. */
export function replaceDeepAddress(sections: PageSection[], elementId: string, was: string, nth: number, url: string): PageSection[] {
  return mapElement(sections, elementId, (element) => {
    let seen = 0;
    let done = false;
    const props = mapStrings(element.props ?? {}, "", (value) => {
      if (done || value !== was || seen++ !== nth) return null;
      done = true;
      return url;
    });
    return done ? { ...element, props: props as PageElement["props"] } : element;
  });
}

/** The element's text set from the canvas; the same array when nothing changes. */
export function setElementText(sections: PageSection[], elementId: string, text: string, match?: { was: string; nth: number }): PageSection[] {
  if (match) return replaceDeepWords(sections, elementId, match.was, match.nth, text);
  let changed = false;
  const next = sections.map((section) => {
    let touched = false;
    const rows = (section.rows ?? []).map((row) => ({
      ...row,
      columns: (row.columns ?? []).map((column) => ({
        ...column,
        elements: (column.elements ?? []).map((element) => {
          const key = INLINE_TEXT_KEY[element.type];
          if (element.id !== elementId || !key || boundKeys(element)[key]) return element;
          const props = (element.props ?? {}) as Record<string, unknown>;
          if (props[key] === text) return element;
          touched = true;
          return { ...element, props: { ...props, [key]: text } };
        }),
      })),
    }));
    if (!touched) return section;
    changed = true;
    return { ...section, rows };
  });
  return changed ? next : sections;
}

// --- hiding a whole section ---------------------------------------------------
//
// The page tree has no "hidden" flag on a section, and the storefront reads
// none. What it does read is each element's own `settings.style.<device>.hidden`
// (the Style tab's "Hide on this device", ElementStylePanel.tsx): on `base` it
// hides the element at every width unless a device turns it back on. So a
// section is hidden by hiding every element in it on `base`, and shown again
// by taking that off. Its band (background and spacing) stays where it was.

const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const STYLE_DEVICES = ["base", "tablet", "mobile"] as const;

function deviceStyles(element: PageElement): Record<string, unknown> {
  const settings = isPlain(element.settings) ? element.settings : null;
  return settings && isPlain(settings.style) ? settings.style : {};
}

function hiddenOnBase(element: PageElement): boolean {
  const base = deviceStyles(element).base;
  return isPlain(base) && base.hidden === true;
}

/** Hidden at every width: on the base, and no device turns it back on. */
function hiddenEverywhere(element: PageElement): boolean {
  if (!hiddenOnBase(element)) return false;
  const styles = deviceStyles(element);
  return !(["tablet", "mobile"] as const).some((device) => {
    const own = styles[device];
    return isPlain(own) && own.hidden === false;
  });
}

function setElementHidden(element: PageElement, hidden: boolean): PageElement {
  if (hidden ? hiddenEverywhere(element) : !hiddenOnBase(element)) return element;
  const styles = deviceStyles(element);
  const nextStyle: Record<string, unknown> = {};
  for (const device of STYLE_DEVICES) {
    const raw = styles[device];
    const own: Record<string, unknown> = isPlain(raw) ? { ...raw } : {};
    if (hidden) {
      if (device === "base") own.hidden = true;
      else if (own.hidden === false) delete own.hidden;
    } else if (device === "base") {
      delete own.hidden;
    }
    if (Object.keys(own).length > 0) nextStyle[device] = own;
  }
  const current: Record<string, unknown> = isPlain(element.settings) ? element.settings : {};
  const { style: _style, ...rest } = current;
  void _style;
  const settings: Record<string, unknown> = { ...rest };
  if (Object.keys(nextStyle).length > 0) settings.style = nextStyle;
  const { settings: _settings, ...bare } = element;
  void _settings;
  return Object.keys(settings).length > 0 ? { ...bare, settings } : bare;
}

function elementsOf(section: PageSection): PageElement[] {
  return (section.rows ?? []).flatMap((row) => (row.columns ?? []).flatMap((column) => column.elements ?? []));
}

/** Whether the section is hidden from the store: it has elements and every one of them is hidden at every width. */
export function sectionHidden(section: PageSection): boolean {
  const elements = elementsOf(section);
  return elements.length > 0 && elements.every(hiddenEverywhere);
}

/**
 * Hides the section from the store, or shows it again: every element in it
 * gets (or loses) "hidden" on the base device. Showing it leaves a per-device
 * "hide on phone / tablet" where it was. The same section back when nothing changes.
 */
export function setSectionHidden(section: PageSection, hidden: boolean): PageSection {
  let changed = false;
  const rows = (section.rows ?? []).map((row) => ({
    ...row,
    columns: (row.columns ?? []).map((column) => ({
      ...column,
      elements: (column.elements ?? []).map((element) => {
        const next = setElementHidden(element, hidden);
        if (next !== element) changed = true;
        return next;
      }),
    })),
  }));
  return changed ? { ...section, rows } : section;
}

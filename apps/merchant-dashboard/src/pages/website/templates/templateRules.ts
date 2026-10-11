import type { PageElement, PageSection, PageTree } from "@store-builder/api-client";
import {
  COLUMN_SETTING_SPECS,
  ELEMENT_SPECS,
  IMAGE_RATIOS,
  ROW_SETTING_SPECS,
  SECTION_SETTING_SPECS,
  type ColumnWithSettings,
  type RowWithSettings,
  type SectionSettingSpec,
} from "../editor/blocks";
import { SHOWCASE_TYPES } from "../editor/showcaseBlocks";
import { STORE_THEMES, THEME_SPECS } from "../editor/storeThemes";
import type { StoreTemplate } from "./storeTemplates";
import { ART_BASE } from "./templateArt";

/**
 * What every store template written here must keep, checked on the built
 * data: `templateProblems` returns one line per broken rule and nothing for a
 * sound template. The rules are the server's own for a page tree
 * (modules/pages/pageTree.js: ids, node types, the 12-column row) plus ours
 * for a template: only the editor's own elements, only our own stand-in
 * pictures and no address outside the store, a shape on every picture, Arabic
 * words, and a look that is a theme and the fuller footer and nothing else.
 */

type Props = Record<string, unknown>;

const isObject = (value: unknown): value is Props => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value : "");
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const ARABIC = /\p{Script=Arabic}/u;
const HEX = /^#[0-9A-F]{6}$/i;
const PAGE_PATH = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
const RATIOS = new Set(IMAGE_RATIOS.map((r) => r.value));
const BANDS = new Set<string>(SHOWCASE_TYPES);
/** The store's own pages a template may link to besides the ones it brings. */
const BUILT_IN_PAGES = new Set(["/", "/products", "/cart", "/track"]);
/** Props that hold a link. */
const LINK_KEYS = new Set(["href", "buttonHref", "ctaHref"]);

export interface PictureSlot {
  page: string;
  elementId: string;
  type: string;
  url: string;
  /** What gives the picture its box: a shape of its own, or the band or grid it sits in. */
  frame: "ratio" | "slider" | "tile" | "banner" | "gallery";
}

/** Every picture a page tree names, with what holds it in shape. */
export function pictureSlots(page: string, tree: PageTree): PictureSlot[] {
  const slots: PictureSlot[] = [];
  for (const element of elementsOf(tree)) {
    const props = element.props ?? {};
    const add = (url: unknown, frame: PictureSlot["frame"]) => {
      if (text(url).trim()) slots.push({ page, elementId: element.id, type: element.type, url: text(url), frame });
    };
    if (element.type === "image") add(props.src, "ratio");
    if (element.type === "gallery" || element.type === "carousel") for (const url of list(props.images)) add(url, "gallery");
    if (element.type === "hero_slider") {
      for (const slide of list(props.slides)) {
        if (!isObject(slide)) continue;
        add(slide.image, "slider");
        add(slide.mobileImage, "slider");
      }
    }
    if (element.type === "category_tiles") for (const item of list(props.items)) if (isObject(item)) add(item.image, "tile");
    if (element.type === "image_banner") {
      add(props.image, "banner");
      add(props.mobileImage, "banner");
    }
  }
  return slots;
}

export function elementsOf(tree: PageTree): PageElement[] {
  return (tree.sections ?? []).flatMap((section) => (section.rows ?? []).flatMap((r) => (r.columns ?? []).flatMap((c) => c.elements ?? [])));
}

function settingProblems(where: string, settings: unknown, specs: SectionSettingSpec[], extra: string[] = []): string[] {
  if (settings === undefined) return [];
  if (!isObject(settings)) return [`${where}: settings must be an object`];
  const out: string[] = [];
  for (const [key, value] of Object.entries(settings)) {
    const spec = specs.find((s) => s.key === key);
    if (!spec) {
      if (!extra.includes(key)) out.push(`${where}: unknown setting "${key}"`);
    } else if (!spec.options.some((o) => o.value === value)) {
      out.push(`${where}: "${key}" is "${String(value)}", not one of its choices`);
    }
  }
  return out;
}

/** Every string anywhere inside a value, with the key it was found under. */
function strings(value: unknown, key = "", out: Array<[string, string]> = []): Array<[string, string]> {
  if (typeof value === "string") out.push([key, value]);
  else if (Array.isArray(value)) for (const item of value) strings(item, key, out);
  else if (isObject(value)) for (const [k, v] of Object.entries(value)) strings(v, k, out);
  return out;
}

function treeProblems(page: string, tree: PageTree, pages: Set<string>, art: Set<string>): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  const id = (where: string, value: unknown) => {
    if (typeof value !== "string" || value.trim() === "") out.push(`${where}: needs an id`);
    else if (ids.has(value)) out.push(`${where}: the id "${value}" is used twice`);
    else ids.add(value);
  };

  if (tree.version !== 1) out.push(`${page}: the tree's version must be 1`);
  const sections: PageSection[] = tree.sections ?? [];
  if (sections.length === 0) out.push(`${page}: has no sections`);

  for (const section of sections) {
    const at = `${page} › ${section.id}`;
    id(at, section.id);
    if (section.type !== "section") out.push(`${at}: type must be "section"`);
    // A minimum height is left out on purpose: it shrinks a band inside the section.
    out.push(...settingProblems(at, section.settings, SECTION_SETTING_SPECS));
    const rows = section.rows ?? [];
    if (rows.length === 0) out.push(`${at}: has no rows`);
    const holdsBand = rows.some((r) => (r.columns ?? []).some((c) => (c.elements ?? []).some((e) => BANDS.has(e.type))));

    for (const r of rows as RowWithSettings[]) {
      id(`${at} › row`, r.id);
      if (r.type !== "row") out.push(`${at} › ${r.id}: type must be "row"`);
      out.push(...settingProblems(`${at} › ${r.id}`, r.settings, ROW_SETTING_SPECS));
      const columns = (r.columns ?? []) as ColumnWithSettings[];
      if (columns.length === 0) out.push(`${at} › ${r.id}: has no columns`);
      const spans = columns.map((c) => c.span ?? 12);
      if (spans.some((s) => !Number.isInteger(s) || s < 1 || s > 12)) out.push(`${at} › ${r.id}: a column's span must be 1 to 12`);
      if (spans.reduce((a, b) => a + b, 0) !== 12) out.push(`${at} › ${r.id}: its columns must add up to 12, not ${spans.join(" + ")}`);
      if (holdsBand && (columns.length !== 1 || (columns[0].elements ?? []).length !== 1)) out.push(`${at}: a band must be alone in its section`);

      for (const c of columns) {
        id(`${at} › column`, c.id);
        if (c.type !== "column") out.push(`${at} › ${c.id}: type must be "column"`);
        out.push(...settingProblems(`${at} › ${c.id}`, c.settings, COLUMN_SETTING_SPECS));
        if ((c.elements ?? []).length === 0) out.push(`${at} › ${c.id}: has no elements`);
        for (const element of c.elements ?? []) out.push(...elementProblems(page, element, pages, id));
      }
    }
  }

  for (const slot of pictureSlots(page, tree)) {
    const where = `${page} › ${slot.elementId}`;
    if (!slot.url.startsWith(`${ART_BASE}/`)) out.push(`${where}: the picture "${slot.url}" is not one of our own drawings`);
    else if (!art.has(slot.url.slice(ART_BASE.length + 1))) out.push(`${where}: no drawing is made for "${slot.url}"`);
  }
  return out;
}

function elementProblems(page: string, element: PageElement, pages: Set<string>, id: (where: string, value: unknown) => void): string[] {
  const out: string[] = [];
  const at = `${page} › ${element.id}`;
  id(at, element.id);
  if (!Object.hasOwn(ELEMENT_SPECS, element.type)) return [...out, `${at}: "${element.type}" is not an element of the editor`];
  if (!isObject(element.props)) return [...out, `${at}: needs props`];
  const props = element.props;

  if (element.type === "heading" || element.type === "text" || element.type === "rich_text") {
    if (!text(props.text).trim()) out.push(`${at}: has no words`);
  }
  if (element.type === "button" && !text(props.label).trim()) out.push(`${at}: the button has no label`);
  if (element.type === "image") {
    if (!text(props.src).trim()) out.push(`${at}: the picture is empty`);
    if (!RATIOS.has(text(props.ratio))) out.push(`${at}: the picture names no shape, so its box would follow the file's own size`);
    if (!text(props.alt).trim()) out.push(`${at}: the picture has no alt text`);
  }
  if (element.type === "hero_slider") {
    const slides = list(props.slides);
    if (slides.length === 0) out.push(`${at}: the slider has no slides`);
    for (const slide of slides) if (!isObject(slide) || !text(slide.image).trim()) out.push(`${at}: a slide without a picture is not drawn`);
  }
  if (element.type === "image_banner" && !text(props.image).trim()) out.push(`${at}: a banner without a picture is not drawn`);

  for (const [key, value] of strings(props)) {
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(value.trim()) || /https?:/i.test(value)) out.push(`${at}: "${key}" holds an address outside the store`);
    if (LINK_KEYS.has(key) && value.trim() !== "") {
      if (!value.startsWith("/")) out.push(`${at}: the link "${value}" must be a path inside the store`);
      else if (!pages.has(value) && !BUILT_IN_PAGES.has(value)) out.push(`${at}: the link "${value}" leads to no page of this template`);
    }
  }
  // The words a shopper reads are Arabic: a line with letters in it has Arabic ones.
  for (const key of ["text", "label", "heading", "subheading", "title", "quote", "submitLabel", "buttonLabel"]) {
    const value = text(props[key]);
    if (/\p{L}/u.test(value) && !ARABIC.test(value)) out.push(`${at}: "${key}" is not in Arabic`);
  }
  return out;
}

export function templateProblems(template: StoreTemplate, artFiles: Iterable<string>): string[] {
  const out: string[] = [];
  const art = new Set(artFiles);
  const { globalStyles, pages } = template.version;

  if (!/^[a-z]+(?:-[a-z]+)*$/.test(template.key)) out.push(`the key "${template.key}" must be lower-case words joined by hyphens`);
  if (!template.name.trim() || !ARABIC.test(template.name)) out.push("the name must be in Arabic");
  if (!/^[a-z]+(?:_[a-z]+)*$/.test(template.category)) out.push(`the category "${template.category}" is not a category code`);
  if (template.kind !== "store") out.push('the kind must be "store"');
  if (template.rtl !== true) out.push("an Arabic template reads right to left");

  // The look: a theme of the storefront's and the fuller footer, and nothing else.
  const look: Props = globalStyles.themeSettings;
  const theme = text(look.storeTheme);
  if (!(STORE_THEMES as readonly string[]).includes(theme)) out.push(`"${theme}" is not a store theme`);
  if (JSON.stringify(Object.keys(look).sort()) !== JSON.stringify(["footer", "storeTheme"])) {
    out.push(`the look must hold a theme and the footer only, not ${Object.keys(look).join(", ")}`);
  }
  if (JSON.stringify(look.footer) !== JSON.stringify({ layout: "rich" })) out.push("the footer must ask for the fuller layout and nothing else");
  if (!HEX.test(template.primaryColor) || template.primaryColor !== globalStyles.primaryColor) out.push("the colour must be one #rrggbb, the same on the card and in the styles");
  else if ((STORE_THEMES as readonly string[]).includes(theme) && template.primaryColor !== THEME_SPECS[theme as keyof typeof THEME_SPECS].palette.light.accent) {
    out.push("the colour must be the theme's own accent");
  }
  if (JSON.stringify(Object.keys(globalStyles).sort()) !== JSON.stringify(["primaryColor", "themeSettings"])) out.push("the styles hold a colour and a look only");
  if (template.version.sections.length !== 0) out.push("shared sections are not used");

  if (pages.length === 0) out.push("a template needs a page");
  const paths = new Set<string>();
  for (const page of pages) {
    if (!PAGE_PATH.test(page.path)) out.push(`the path "${page.path}" must be "/" or one lower-case word after it`);
    if (paths.has(page.path)) out.push(`two pages use the path "${page.path}"`);
    paths.add(page.path);
    if (!page.title.trim() || !ARABIC.test(page.title)) out.push(`${page.path}: the title must be in Arabic`);
    if (page.pageType !== (page.path === "/" ? "home" : "static")) out.push(`${page.path}: the page type does not match its path`);
  }
  if (!paths.has("/")) out.push("a template needs a home page");

  let nodes = 0;
  for (const page of pages) {
    out.push(...treeProblems(page.path, page.builderData, paths, art));
    nodes += JSON.stringify(page.builderData).split('"id":').length - 1;
  }
  // The server's own ceiling for one page is 10,000 nodes; a whole template stays far under it.
  if (nodes > 2000) out.push(`${nodes} nodes is too many`);
  return out;
}

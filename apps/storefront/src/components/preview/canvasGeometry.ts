/**
 * Reading the preview page's layout for drag and resize on the canvas — what
 * the editor needs to work out where a drag lands (see the editor's
 * lib/canvasDrag.ts). Only the website editor's preview renders the markers
 * these read (PageRenderer's editable mode); a shopper's page has none.
 *
 * Section and element boxes are in document coordinates (viewport + scroll),
 * so a drag stays right while the page scrolls under it.
 */

export const SECTION_ATTR = "data-zimos-section";
export const INDEX_ATTR = "data-zimos-index";
export const ROW_ATTR = "data-zimos-row";
export const COLUMN_ATTR = "data-zimos-column";
export const SPAN_ATTR = "data-zimos-span";
export const EL_ATTR = "data-zimos-el";
export const TYPE_ATTR = "data-zimos-type";

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function byAttr(attr: string, id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${attr}="${CSS.escape(id)}"]`);
}

export const sectionNode = (id: string) => byAttr(SECTION_ATTR, id);
export const rowNode = (id: string) => byAttr(ROW_ATTR, id);
export const columnNode = (id: string) => byAttr(COLUMN_ATTR, id);
export const elementNode = (id: string) => byAttr(EL_ATTR, id);

/** The `<section>` a section marker wraps — absent for a section with no rows. */
export function sectionBody(sectionId: string): HTMLElement | null {
  return sectionNode(sectionId)?.querySelector<HTMLElement>(":scope > section") ?? null;
}

/**
 * An element's box. Its marker is `display: contents` and has no box of its
 * own, so this is the union of what it renders — empty when it renders
 * nothing (an image with no picture yet).
 */
export function elementRect(el: HTMLElement): Rect | null {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rect = range.getBoundingClientRect();
  range.detach?.();
  if (rect.width === 0 && rect.height === 0) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

/** The picture inside an image element — what its corner handle resizes. */
export function imageNode(elementId: string): HTMLImageElement | null {
  return elementNode(elementId)?.querySelector<HTMLImageElement>("img") ?? null;
}

/** The node an image's width is set on while it is being resized: the element's own top box. */
export function imageBox(elementId: string): HTMLElement | null {
  const marker = elementNode(elementId);
  return (marker?.firstElementChild as HTMLElement | null) ?? null;
}

export function isRtl(el: Element): boolean {
  return getComputedStyle(el).direction === "rtl";
}

/** Every section's box, in page order, document coordinates. */
export function sectionBoxes() {
  const y = window.scrollY;
  return Array.from(document.querySelectorAll<HTMLElement>(`[${SECTION_ATTR}]`)).map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      sectionId: el.getAttribute(SECTION_ATTR) ?? "",
      index: Number(el.getAttribute(INDEX_ATTR) ?? 0),
      top: rect.top + y,
      height: rect.height,
    };
  });
}

/**
 * Every column on the page with its elements, in tree order, document
 * coordinates. An element that renders nothing still takes its place in the
 * order (at the bottom of the one before it, zero high), so a drop index
 * always counts the column the way the tree does.
 */
export function columnBoxes() {
  const x = window.scrollX;
  const y = window.scrollY;
  return Array.from(document.querySelectorAll<HTMLElement>(`[${COLUMN_ATTR}]`)).map((col) => {
    const rect = col.getBoundingClientRect();
    let cursor = rect.top + y;
    const elements = Array.from(col.querySelectorAll<HTMLElement>(`:scope > [${EL_ATTR}]`)).map((el) => {
      const box = elementRect(el);
      const top = box ? box.top + y : cursor;
      const height = box ? box.height : 0;
      cursor = top + height;
      return { elementId: el.getAttribute(EL_ATTR) ?? "", top, height };
    });
    return {
      columnId: col.getAttribute(COLUMN_ATTR) ?? "",
      sectionId: col.closest<HTMLElement>(`[${SECTION_ATTR}]`)?.getAttribute(SECTION_ATTR) ?? "",
      top: rect.top + y,
      left: rect.left + x,
      width: rect.width,
      height: rect.height,
      elements,
    };
  });
}

/** A row's columns, in tree order. */
export function rowColumns(row: HTMLElement): HTMLElement[] {
  return Array.from(row.querySelectorAll<HTMLElement>(`:scope > [${COLUMN_ATTR}]`));
}

/** One divider between two neighbouring columns that sit side by side. */
export interface Divider {
  rowId: string;
  /** The first column's index in the row. */
  index: number;
  /** Viewport x of the boundary, and the vertical extent of the pair. */
  x: number;
  top: number;
  height: number;
  spans: number[];
}

/**
 * The column boundaries in a section that can be dragged: neighbours on the
 * same line of the grid, side by side. Below the `md` breakpoint columns stack
 * and there is nothing to drag.
 */
export function sectionDividers(sectionId: string): Divider[] {
  const section = sectionNode(sectionId);
  if (!section) return [];
  const out: Divider[] = [];
  for (const row of Array.from(section.querySelectorAll<HTMLElement>(`[${ROW_ATTR}]`))) {
    const columns = rowColumns(row);
    if (columns.length < 2) continue;
    const spans = columns.map((c) => Number(c.getAttribute(SPAN_ATTR)) || 12);
    const rtl = isRtl(row);
    for (let i = 0; i < columns.length - 1; i++) {
      const a = columns[i].getBoundingClientRect();
      const b = columns[i + 1].getBoundingClientRect();
      const sameLine = Math.abs(a.top - b.top) < 4;
      const sideBySide = rtl ? b.right <= a.left + 1 : b.left >= a.right - 1;
      if (!sameLine || !sideBySide) continue;
      const x = rtl ? (a.left + b.right) / 2 : (a.right + b.left) / 2;
      const top = Math.min(a.top, b.top);
      out.push({
        rowId: row.getAttribute(ROW_ATTR) ?? "",
        index: i,
        x,
        top,
        height: Math.max(a.bottom, b.bottom) - top,
        spans,
      });
    }
  }
  return out;
}

/**
 * What the editor needs to turn a divider drag into spans: where the first
 * column of the pair starts from the row's inline-start edge, the width one
 * span adds (a twelfth of the row plus a gap), and the gap.
 */
export function dividerGeometry(rowId: string, index: number) {
  const row = rowNode(rowId);
  if (!row) return null;
  const columns = rowColumns(row);
  const first = columns[index];
  if (!first || !columns[index + 1]) return null;
  const rowRect = row.getBoundingClientRect();
  const rect = first.getBoundingClientRect();
  const rtl = isRtl(row);
  const style = getComputedStyle(row);
  const gap = parseFloat(style.columnGap) || 0;
  return {
    spans: columns.map((c) => Number(c.getAttribute(SPAN_ATTR)) || 12),
    pairStart: rtl ? rowRect.right - rect.right : rect.left - rowRect.left,
    unit: (rowRect.width + gap) / 12,
    gap,
    rtl,
  };
}

// --- what the canvas selects, patches and ghosts ---------------------------------------

/** On an element's marker: the prop that holds its one picture (PageRenderer, editable mode only). */
export const IMAGE_FIELD_ATTR = "data-zimos-image-field";
/**
 * On an element's marker: the widths at which shoppers don't see it
 * ("desktop tablet mobile", any of them) — or, after a patch, "" for "shown
 * again". On a section's marker: present when the section is hidden.
 */
export const HIDDEN_ATTR = "data-zimos-hidden";
/** The box an element's own style rules target (PageRenderer's StyledElement). */
export const STYLE_BOX_ATTR = "data-zs";

export function styleBox(marker: HTMLElement): HTMLElement | null {
  return marker.querySelector<HTMLElement>(`:scope > [${STYLE_BOX_ATTR}]`);
}

/** The node that shows an element's text: its first box, past its style wrapper. */
export function inlineTextNode(marker: HTMLElement): HTMLElement | null {
  let node = marker.firstElementChild as HTMLElement | null;
  if (node?.hasAttribute(STYLE_BOX_ATTR)) node = node.firstElementChild as HTMLElement | null;
  return node;
}

/** The prop a replaced picture goes into, when the renderer named one for this element. */
export function imageFieldOf(marker: HTMLElement): string | null {
  const field = marker.getAttribute(IMAGE_FIELD_ATTR);
  return field && /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(field) ? field : null;
}

/** The storefront's own breakpoints for per-device element styles (page-renderer/elementStyle.ts). */
export type ViewDevice = "desktop" | "tablet" | "mobile";

export function viewDevice(): ViewDevice {
  const width = window.innerWidth;
  return width <= 639 ? "mobile" : width <= 1023 ? "tablet" : "desktop";
}

/** Whether shoppers at this width don't see the node (an element's marker, or a section's). */
export function isHiddenNow(node: Element): boolean {
  const value = node.getAttribute(HIDDEN_ATTR);
  if (value === null) return false;
  if (node.hasAttribute(SECTION_ATTR)) return true;
  return value.split(" ").includes(viewDevice());
}

/** A section is hidden when it says so itself, or when every element in it is. */
export function sectionHidden(sectionId: string): boolean {
  const section = sectionNode(sectionId);
  if (!section) return false;
  if (section.hasAttribute(HIDDEN_ATTR)) return true;
  const elements = Array.from(section.querySelectorAll(`[${EL_ATTR}]`));
  return elements.length > 0 && elements.every(isHiddenNow);
}

// --- the imported templates' pictures and logos ------------------------------------

/** Where a template band saves a picture ("image", "items.2.image", "images.1"); its header's and footer's logo say "logo". */
export const PIC_ATTR = "data-xs-pic";

export type PictureHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export const PICTURE_HANDLES: readonly PictureHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** A picture of an imported template's band, by where the band saves it. */
export function pictureNode(elementId: string, path: string): HTMLElement | null {
  return elementNode(elementId)?.querySelector<HTMLElement>(`[${PIC_ATTR}="${CSS.escape(path)}"]`) ?? null;
}

/** Every picture of the same list in the band ("items.*.image", "images.*") — or the one picture, when it is in none. */
export function picturesLike(elementId: string, path: string): HTMLElement[] {
  const marker = elementNode(elementId);
  if (!marker) return [];
  const parts = path.split(".");
  if (parts.length === 1) {
    const one = pictureNode(elementId, path);
    return one ? [one] : [];
  }
  const same = parts.length === 3 ? new RegExp(`^${parts[0]}\\.\\d+\\.${parts[2]}$`) : new RegExp(`^${parts[0]}\\.\\d+$`);
  return Array.from(marker.querySelectorAll<HTMLElement>(`[${PIC_ATTR}]`)).filter((el) => same.test(el.getAttribute(PIC_ATTR) ?? ""));
}

/** The box a picture's width is measured against: its nearest ancestor that has one (its <picture> has none). */
export function pictureBox(el: HTMLElement): HTMLElement | null {
  let box = el.parentElement;
  while (box && getComputedStyle(box).display === "contents") box = box.parentElement;
  return box;
}

const OWN_SIZE_ATTRS = ["data-xs-w", "data-xs-h", "data-xs-w-t", "data-xs-h-t", "data-xs-w-m", "data-xs-h-m"];

/**
 * The size the look gives a picture with no size of its own: its own taken
 * off for a moment and put back, in one go, before anything is painted.
 */
export function naturalSize(el: HTMLElement): { width: number; height: number } {
  const saved = OWN_SIZE_ATTRS.map((name) => [name, el.getAttribute(name)] as const);
  const style = el.getAttribute("style");
  for (const name of OWN_SIZE_ATTRS) el.removeAttribute(name);
  for (const property of ["width", "height", "max-width", "object-fit"]) el.style.removeProperty(property);
  const rect = el.getBoundingClientRect();
  for (const [name, value] of saved) if (value !== null) el.setAttribute(name, value);
  if (style === null) el.removeAttribute("style");
  else el.setAttribute("style", style);
  return { width: rect.width, height: rect.height };
}

/** A template header's or footer's logo (components/xs XsHeader, XsFooter). */
export function logoNode(part: "header" | "footer"): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-zimos-shell="${part}"] [${PIC_ATTR}="logo"]`);
}

/** What a logo's size is set on: the header's logo box (the picture fills its height), the footer's picture itself. */
export function logoBox(part: "header" | "footer"): HTMLElement | null {
  const logo = logoNode(part);
  return part === "header" ? (logo?.closest<HTMLElement>(".xs-header__logo") ?? logo) : logo;
}

/** A logo's height with the header's or footer's own sizes switched off for a moment (components/xs/shellSizes). */
export function naturalLogoHeight(part: "header" | "footer"): number {
  const box = logoBox(part);
  if (!box) return 0;
  const sheet = document.querySelector<HTMLStyleElement>(`[data-zimos-shell="${part}"] > style`)?.sheet ?? null;
  const style = box.getAttribute("style");
  box.style.removeProperty("height");
  if (sheet) sheet.disabled = true;
  const height = box.getBoundingClientRect().height;
  if (sheet) sheet.disabled = false;
  if (style === null) box.removeAttribute("style");
  else box.setAttribute("style", style);
  return height;
}

/** The screen the preview shows, as a per-screen setting names it (storefront lib/deviceValue.ts). */
export function settingDevice(): "base" | "tablet" | "mobile" {
  const device = viewDevice();
  return device === "desktop" ? "base" : device;
}

// --- the parts of an imported template's header (lib/xsLayout) ---------------------------

/** A box on the page in document coordinates, from an element — or, for one that takes no box (display: contents), what it holds. */
function docRect(el: HTMLElement): Rect | null {
  const own = el.getBoundingClientRect();
  const rect = own.width === 0 && own.height === 0 ? elementRect(el) : { top: own.top, left: own.left, width: own.width, height: own.height };
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;
  return { top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width, height: rect.height };
}

/** A part of the header, by id. */
export function shellPartNode(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-zimos-shell="header"] [data-xs-part="${CSS.escape(id)}"]`);
}

/** Every zone of the header that shows on this screen, with its parts in order — document coordinates. */
export function shellZones(): Array<{ zone: string; top: number; left: number; width: number; height: number; parts: Array<{ id: string; top: number; left: number; width: number; height: number }> }> {
  const header = document.querySelector<HTMLElement>('[data-zimos-shell="header"]');
  if (!header) return [];
  const out: ReturnType<typeof shellZones> = [];
  for (const zoneEl of Array.from(header.querySelectorAll<HTMLElement>("[data-xs-zone]"))) {
    const zone = zoneEl.getAttribute("data-xs-zone") ?? "";
    const box = docRect(zoneEl);
    if (!zone || !box) continue;
    const parts = Array.from(zoneEl.querySelectorAll<HTMLElement>("[data-xs-part]"))
      .filter((el) => el.closest("[data-xs-zone]") === zoneEl && !el.parentElement?.closest("[data-xs-part]"))
      .flatMap((el) => {
        const rect = docRect(el);
        return rect ? [{ id: el.getAttribute("data-xs-part") ?? "", ...rect }] : [];
      });
    out.push({ zone, ...box, parts });
  }
  return out;
}

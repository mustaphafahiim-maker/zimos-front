import { safeUrl } from "@/components/page-renderer/props";
import { HIDDEN_ATTR, elementNode, inlineTextNode, styleBox } from "./canvasGeometry";
import { OWN_KEYS, ownPatchCss } from "@/components/page-renderer/xs/own";

/**
 * `zimos:patch` — the editor's small edits, applied to the page that is
 * already showing instead of rendering it again. The editor decides what is
 * small enough (its lib/previewBridge.ts `diffTreePatch`); this side only
 * ever touches an element that is on the page, and the full render that
 * follows a moment later replaces everything done here with the server's own.
 *
 *   text      the element's inline text — the node a double-click edits
 *   imageSrc  its picture (the <img>, or a background image)
 *   hidden    a ghost in the editor: 35% opacity and a "hidden" chip (canvasChrome)
 *   style     CSS property → value, the short list below only
 *   own       an imported template's band: its own look, every own prop as it now
 *             stands (page-renderer/xs/own.tsx ownPatchCss, which checks each value)
 *   words     a band's words: each [was, is] — the text that showed, and what it is now
 *   pictures  a band's pictures by their place in its props ("items.2.image" → address)
 *
 * Everything arrives in a message, so every value is checked again here: a
 * property outside the list or a value that is not a plain length, keyword or
 * hex colour is dropped, and a picture must be an http(s) or site URL.
 */

export interface PatchOp {
  elementId: string;
  text?: string;
  imageSrc?: string;
  hidden?: boolean;
  style?: Record<string, string>;
  own?: Record<string, unknown>;
  words?: Array<[string, string]>;
  pictures?: Record<string, string>;
}

const MAX_WORDS = 50;
const PICTURE_PATH = /^[A-Za-z][A-Za-z0-9]*(?:\.[0-9]{1,2}\.[A-Za-z][A-Za-z0-9]*)?(?:\.[0-9]{1,2})?$/;

const MAX_OPS = 500;
const MAX_TEXT = 20_000;
const MAX_URL = 2000;

const LENGTH = "(?:0|[0-9]{1,4}(?:[.][0-9]{1,3})?(?:px|%|rem|em))";
const one = (part: string) => new RegExp(`^${part}$`);
const upToFour = (part: string) => new RegExp(`^${part}(?: ${part}){0,3}$`);
const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const SPACING = upToFour(LENGTH);
const MARGIN = upToFour(`(?:${LENGTH}|auto)`);

/** The properties a patch may set, each with the only values it accepts. */
const PATCH_VALUE: Record<string, RegExp> = {
  color: COLOR,
  "background-color": COLOR,
  "text-align": /^(?:start|center|end|left|right|justify)$/,
  "font-size": one(LENGTH),
  "font-weight": /^(?:[1-9]00|normal|bold)$/,
  padding: SPACING,
  "padding-top": one(LENGTH),
  "padding-bottom": one(LENGTH),
  "padding-inline": SPACING,
  "padding-inline-start": one(LENGTH),
  "padding-inline-end": one(LENGTH),
  "padding-block": SPACING,
  margin: MARGIN,
  "margin-top": one(LENGTH),
  "margin-bottom": one(LENGTH),
  "margin-inline": MARGIN,
  "margin-inline-start": one(`(?:${LENGTH}|auto)`),
  "margin-inline-end": one(`(?:${LENGTH}|auto)`),
  "margin-block": MARGIN,
  "border-radius": upToFour(LENGTH),
  gap: upToFour(LENGTH),
};

/**
 * Colour, size, weight and alignment have to reach the text inside the
 * element, whose own classes set them — the same nodes the page's stylesheet
 * reaches for (page-renderer/elementStyle.ts).
 */
const INHERITED = new Set(["color", "font-size", "font-weight", "text-align"]);
const TEXT_NODES = "h1,h2,h3,h4,h5,h6,p,span,a,li,button,label";

/** Hidden at every width, until the render says exactly where. */
const HIDDEN_EVERYWHERE = "desktop tablet mobile";

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

/** The ops of a `zimos:patch` message, with everything that is not well-formed dropped. */
export function readPatch(raw: unknown): PatchOp[] {
  if (!Array.isArray(raw)) return [];
  const ops: PatchOp[] = [];
  for (const item of raw.slice(0, MAX_OPS)) {
    const o = item as Record<string, unknown> | null;
    if (!o || typeof o !== "object" || !isId(o.elementId)) continue;
    const op: PatchOp = { elementId: o.elementId };
    if (typeof o.text === "string" && o.text.length <= MAX_TEXT) op.text = o.text;
    if (typeof o.imageSrc === "string" && o.imageSrc.length <= MAX_URL) {
      const url = safeUrl(o.imageSrc);
      if (url) op.imageSrc = url;
    }
    if (typeof o.hidden === "boolean") op.hidden = o.hidden;
    if (o.style && typeof o.style === "object" && !Array.isArray(o.style)) {
      const style: Record<string, string> = {};
      for (const [property, value] of Object.entries(o.style as Record<string, unknown>).slice(0, 32)) {
        if (typeof value === "string" && PATCH_VALUE[property]?.test(value)) style[property] = value;
      }
      if (Object.keys(style).length > 0) op.style = style;
    }
    if (o.own && typeof o.own === "object" && !Array.isArray(o.own)) {
      // Only the own props; their values are checked where the rules are made.
      op.own = Object.fromEntries(Object.entries(o.own as Record<string, unknown>).filter(([key]) => OWN_KEYS.includes(key)));
    }
    if (Array.isArray(o.words)) {
      const words = (o.words as unknown[])
        .slice(0, MAX_WORDS)
        .filter((pair): pair is [string, string] => Array.isArray(pair) && pair.length === 2 && pair.every((part) => typeof part === "string" && part.length <= MAX_TEXT) && pair[0].trim() !== "");
      if (words.length > 0) op.words = words;
    }
    if (o.pictures && typeof o.pictures === "object" && !Array.isArray(o.pictures)) {
      const pictures: Record<string, string> = {};
      for (const [path, value] of Object.entries(o.pictures as Record<string, unknown>).slice(0, 40)) {
        const url = typeof value === "string" && value.length <= MAX_URL ? safeUrl(value) : null;
        if (url && PICTURE_PATH.test(path)) pictures[path] = url;
      }
      if (Object.keys(pictures).length > 0) op.pictures = pictures;
    }
    ops.push(op);
  }
  return ops;
}

function setImage(marker: HTMLElement, url: string): boolean {
  const img = marker.querySelector<HTMLImageElement>("img");
  if (img) {
    if (img.getAttribute("src") === url) return false;
    img.removeAttribute("srcset");
    img.src = url;
    return true;
  }
  // No <img>: the element paints its picture as a background.
  const painted = marker.querySelector<HTMLElement>('[style*="background-image"]');
  if (!painted) return false;
  painted.style.backgroundImage = `url(${JSON.stringify(url)})`;
  return true;
}

function setStyle(marker: HTMLElement, style: Record<string, string>): boolean {
  // The element's style box when it has one; an element that never had a
  // style has none yet, so its own first box stands in until the render.
  const box = styleBox(marker) ?? (marker.firstElementChild as HTMLElement | null);
  if (!box) return false;
  for (const [property, value] of Object.entries(style)) {
    if (!PATCH_VALUE[property]?.test(value)) continue;
    box.style.setProperty(property, value, "important");
    if (!INHERITED.has(property)) continue;
    for (const node of Array.from(box.querySelectorAll<HTMLElement>(TEXT_NODES))) {
      node.style.setProperty(property, value, "important");
    }
  }
  return true;
}

/** A band's own look, laid over the page in a stylesheet of its own (replaced by the next patch for that band). */
function setOwn(elementId: string, own: Record<string, unknown>): boolean {
  const css = ownPatchCss(elementId, own);
  let sheet = document.querySelector<HTMLStyleElement>(`style[data-own-patch="${CSS.escape(elementId)}"]`);
  if (!sheet) {
    sheet = document.createElement("style");
    sheet.setAttribute("data-own-patch", elementId);
    document.head.appendChild(sheet);
  }
  if (sheet.textContent === css) return false;
  sheet.textContent = css;
  return true;
}

/** A band's words: every text node that is the old words, whole, becomes the new ones (spaces around kept). */
function setWords(marker: HTMLElement, words: Array<[string, string]>): boolean {
  let changed = false;
  const walker = document.createTreeWalker(marker, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
  for (const node of nodes) {
    if (node.parentElement?.isContentEditable) continue;
    const text = node.data;
    const trimmed = text.trim();
    for (const [was, is] of words) {
      if (trimmed !== was.trim()) continue;
      node.data = text.replace(trimmed, is.trim());
      changed = true;
      break;
    }
  }
  return changed;
}

/** A band's picture by its place: an <img> takes the new address (its other sizes dropped), a painted ground the new picture. */
function setPictures(marker: HTMLElement, pictures: Record<string, string>): boolean {
  let changed = false;
  for (const [path, url] of Object.entries(pictures)) {
    for (const node of Array.from(marker.querySelectorAll<HTMLElement>(`[data-xs-pic="${CSS.escape(path)}"]`))) {
      const img = node instanceof HTMLImageElement ? node : node.querySelector("img");
      if (!img || img.getAttribute("src") === url) continue;
      for (const source of Array.from(img.parentElement?.querySelectorAll("source") ?? [])) source.remove();
      img.removeAttribute("srcset");
      img.src = url;
      changed = true;
    }
    for (const node of Array.from(marker.querySelectorAll<HTMLElement>(`[data-xs-bg="${CSS.escape(path)}"]`))) {
      const ground = `url(${JSON.stringify(url)})`;
      node.style.setProperty("background-image", ground, "important");
      node.style.setProperty("--xs-bg", ground);
      node.style.setProperty("--xs-bg-phone", ground);
      changed = true;
    }
  }
  return changed;
}

/** Applies the ops to the page; true when anything on it changed (the overlay then measures again). */
export function applyPatch(ops: PatchOp[]): boolean {
  let changed = false;
  for (const op of ops) {
    const marker = elementNode(op.elementId);
    if (!marker) continue;
    if (op.text !== undefined) {
      const node = inlineTextNode(marker);
      // Only a node that is nothing but its text, and not one being typed in
      // right now: anything richer is left to the render.
      if (node && !node.isContentEditable && node.childElementCount === 0 && node.textContent !== op.text) {
        node.textContent = op.text;
        changed = true;
      }
    }
    if (op.imageSrc !== undefined && setImage(marker, op.imageSrc)) changed = true;
    if (op.hidden !== undefined) {
      marker.setAttribute(HIDDEN_ATTR, op.hidden ? HIDDEN_EVERYWHERE : "");
      changed = true;
    }
    if (op.style && setStyle(marker, op.style)) changed = true;
    if (op.own && setOwn(op.elementId, op.own)) changed = true;
    if (op.words && setWords(marker, op.words)) changed = true;
    if (op.pictures && setPictures(marker, op.pictures)) changed = true;
  }
  return changed;
}

/**
 * The merchant's head code (custom code → "head"), split into what the server
 * can put in <head> itself and what is left for the browser to insert.
 *
 * Search engines and ad platforms check a domain by reading a <meta> tag from
 * the first response, so head code is rendered by the server (app/layout.tsx).
 * React builds that <head>, so the code is turned into elements: <meta>,
 * <link>, <script>, <style> and <noscript>, each kept exactly as written.
 * Anything else — an element that does not belong in <head>, a tag with an
 * inline event handler or style, stray text — is returned as `rest`, which
 * components/CustomCode.tsx inserts after the page loads, as all head code
 * used to be.
 *
 * Plain module with no imports: the proxy imports the header name from here.
 */

/** Set by the proxy when merchant code may run on this request: the store's ref. */
export const CODE_REF_HEADER = "x-zimos-code";

/** Marks the elements the server put in <head>, so the browser does not add them again. */
export const SERVER_HEAD_ATTR = "data-zimos-head";

export type HeadTag = "meta" | "link" | "script" | "style" | "noscript";

export interface HeadNode {
  tag: HeadTag;
  /** Attribute name (lower case) → value; `true` for a bare boolean attribute. */
  attrs: Record<string, string | true>;
  /** The text of a script, style or noscript. */
  body?: string;
}

const VOID = new Set(["meta", "link"]);
const RAW = new Set(["script", "style", "noscript"]);
const NAME = /^[a-zA-Z][a-zA-Z0-9-]*/;

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };

/** Attribute values as the browser would read them (the common entities). */
function decode(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === "#") {
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[ref.toLowerCase()] ?? whole;
  });
}

/** Where the tag opened at `start` ends (index after its `>`), quotes respected; -1 when it never does. */
function tagEnd(html: string, start: number): number {
  let quote: string | null = null;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ">") return i + 1;
  }
  return -1;
}

function parseAttrs(source: string): Record<string, string | true> {
  const attrs: Record<string, string | true> = {};
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const name = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4];
    if (!(name in attrs)) attrs[name] = value === undefined ? true : decode(value);
  }
  return attrs;
}

/** Index of the `</name>` that closes an element opened before `from`, nesting counted; -1 if none. */
function closingTag(html: string, name: string, from: number): { start: number; end: number } | null {
  const re = new RegExp(`<(/?)${name}(?=[\\s>/])[^>]*>`, "gi");
  re.lastIndex = from;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return { start: m.index, end: m.index + m[0].length };
  }
  return null;
}

/** What React cannot render as written: inline handlers and style strings. */
const needsBrowser = (attrs: Record<string, string | true>) => Object.keys(attrs).some((a) => a.startsWith("on") || a === "style");

export function parseHeadCode(html: string): { nodes: HeadNode[]; rest: string } {
  const nodes: HeadNode[] = [];
  let rest = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      rest += html.slice(i).trim() ? html.slice(i) : "";
      break;
    }
    if (html.slice(i, lt).trim()) rest += html.slice(i, lt);
    if (html.startsWith("<!--", lt)) {
      const close = html.indexOf("-->", lt + 4);
      i = close === -1 ? html.length : close + 3;
      continue;
    }
    const name = NAME.exec(html.slice(lt + 1))?.[0]?.toLowerCase();
    const end = name ? tagEnd(html, lt + 1 + name.length) : -1;
    if (!name || end === -1) {
      // Not a tag (a lone "<", a closing tag out of place): left to the browser.
      rest += html.slice(lt);
      break;
    }
    const attrSource = html.slice(lt + 1 + name.length, html[end - 2] === "/" ? end - 2 : end - 1);
    const attrs = parseAttrs(attrSource);

    if (VOID.has(name)) {
      if (needsBrowser(attrs)) rest += html.slice(lt, end);
      else nodes.push({ tag: name as HeadTag, attrs });
      i = end;
      continue;
    }
    if (RAW.has(name)) {
      const close = html.toLowerCase().indexOf(`</${name}`, end);
      const closeEnd = close === -1 ? html.length : tagEnd(html, close + 2 + name.length);
      const body = html.slice(end, close === -1 ? html.length : close);
      const whole = html.slice(lt, closeEnd === -1 ? html.length : closeEnd);
      if (needsBrowser(attrs)) rest += whole;
      else nodes.push({ tag: name as HeadTag, attrs, body });
      i = closeEnd === -1 ? html.length : closeEnd;
      continue;
    }
    // Anything else is the browser's to place, with its content.
    const close = html[end - 2] === "/" ? null : closingTag(html, name, end);
    const stop = close ? close.end : end;
    rest += html.slice(lt, stop);
    i = stop;
  }
  return { nodes, rest: rest.trim() };
}

// React prop names for the attributes head tags carry.
const PROPS: Record<string, string> = {
  "http-equiv": "httpEquiv",
  charset: "charSet",
  crossorigin: "crossOrigin",
  referrerpolicy: "referrerPolicy",
  class: "className",
  nomodule: "noModule",
  fetchpriority: "fetchPriority",
  hreflang: "hrefLang",
  imagesizes: "imageSizes",
  imagesrcset: "imageSrcSet",
  itemprop: "itemProp",
  "accept-charset": "acceptCharset",
};

const BOOLEAN = new Set(["async", "defer", "nomodule", "disabled"]);

/** A node's attributes as React props. */
export function headNodeProps(node: HeadNode): Record<string, string | boolean> {
  const props: Record<string, string | boolean> = {};
  for (const [name, value] of Object.entries(node.attrs)) {
    props[PROPS[name] ?? name] = BOOLEAN.has(name) ? true : value === true ? "" : value;
  }
  return props;
}

import type { PageElement, PageTree } from "@store-builder/api-client";
import { extraDeclarations, orientationRules } from "./elementStyleExtras";

/**
 * Turns the builder's per-element styles into one stylesheet for the page.
 *
 *   element.settings.style    = { base, tablet, mobile }   (the element's own)
 *   element.settings.styleRef = id of a named style in `globalStyles.named`
 *
 * Desktop is `base`; `tablet` applies from 1023px down and `mobile` from
 * 639px down, each holding only what was changed on that device. A named
 * style sits under the element's own, so editing it restyles every element
 * that references it.
 *
 * The backend validates every value (modules/pages/elementStyle.js), but this
 * file trusts none of that: a declaration is only ever built from a number
 * this code clamps, a keyword it looks up in a table, or a colour it matches
 * against a hex pattern. Nothing from the tree is copied into CSS as text.
 */

type Style = Record<string, unknown>;
type DeviceStyles = { base?: Style; tablet?: Style; mobile?: Style };

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

const SHADOW: Record<string, string> = {
  none: "none",
  sm: "0 1px 2px rgb(0 0 0 / 0.08)",
  md: "0 4px 12px rgb(0 0 0 / 0.12)",
  lg: "0 12px 32px rgb(0 0 0 / 0.18)",
};
const ALIGN: Record<string, string> = { start: "start", center: "center", end: "end" };
const BORDER_STYLE = new Set(["solid", "dashed", "dotted", "none"]);
const WEIGHTS = new Set([300, 400, 500, 600, 700, 800, 900]);

const intIn = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
const colour = (v: unknown): string | null => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : null);

/** The CSS declarations of one device's style. Unknown or bad values produce nothing. */
function declarations(style: Style | undefined): string[] {
  if (!style || typeof style !== "object") return [];
  const out: string[] = [];
  const px = (key: string, prop: string, min: number, max: number) => {
    const n = intIn(style[key], min, max);
    if (n !== null) out.push(`${prop}:${n}px`);
  };
  const col = (key: string, prop: string) => {
    const c = colour(style[key]);
    if (c) out.push(`${prop}:${c}`);
  };

  if (style.hidden === true) out.push("display:none");
  else if (style.hidden === false) out.push("display:block");

  col("color", "color");
  col("background", "background-color");
  px("fontSize", "font-size", 8, 160);
  if (typeof style.fontWeight === "number" && WEIGHTS.has(style.fontWeight)) out.push(`font-weight:${style.fontWeight}`);
  const lineHeight = intIn(style.lineHeight, 80, 300);
  if (lineHeight !== null) out.push(`line-height:${lineHeight / 100}`);

  const borderWidth = intIn(style.borderWidth, 0, 20);
  if (borderWidth !== null) out.push(`border-width:${borderWidth}px`);
  if (typeof style.borderStyle === "string" && BORDER_STYLE.has(style.borderStyle)) {
    out.push(`border-style:${style.borderStyle}`);
  } else if (borderWidth !== null && borderWidth > 0) {
    out.push("border-style:solid");
  }
  col("borderColor", "border-color");
  px("radius", "border-radius", 0, 200);
  if (typeof style.shadow === "string" && SHADOW[style.shadow]) out.push(`box-shadow:${SHADOW[style.shadow]}`);
  const opacity = intIn(style.opacity, 0, 100);
  if (opacity !== null) out.push(`opacity:${opacity / 100}`);

  const width = intIn(style.width, 5, 100);
  if (width !== null) out.push(`width:${width}%`);
  px("maxWidth", "max-width", 50, 2000);

  if (typeof style.align === "string" && ALIGN[style.align]) {
    const align = ALIGN[style.align];
    out.push(`text-align:${align}`);
    // A narrowed element is placed inside its column the same way its text is.
    // Each choice sets both margins, so a device override undoes the one before it.
    if (align === "center") out.push("margin-inline:auto");
    else if (align === "end") out.push("margin-inline:auto 0");
    else out.push("margin-inline:0 auto");
  }
  px("paddingTop", "padding-top", 0, 300);
  px("paddingBottom", "padding-bottom", 0, 300);
  px("paddingStart", "padding-inline-start", 0, 300);
  px("paddingEnd", "padding-inline-end", 0, 300);
  px("marginTop", "margin-top", 0, 300);
  px("marginBottom", "margin-bottom", 0, 300);
  // Gradient/image background, sizes, custom shadow, overflow, cursor.
  out.push(...extraDeclarations(style));
  return out;
}

/**
 * Colour, size and weight have to reach the text inside the element, whose
 * own classes set them; the rest styles the wrapper box.
 */
const INHERITED = ["color:", "font-size:", "font-weight:", "line-height:", "text-align:"];

function rules(selector: string, styles: DeviceStyles): string {
  const block = (style: Style | undefined) => {
    const all = declarations(style);
    if (all.length === 0) return "";
    const inherited = all.filter((d) => INHERITED.some((p) => d.startsWith(p)));
    return (
      `${selector}{${all.join(";")}}` +
      (inherited.length > 0 ? `${selector} :where(h1,h2,h3,h4,h5,h6,p,span,a,li,button,label){${inherited.map((d) => `${d}!important`).join(";")}}` : "")
    );
  };
  const tablet = block(styles.tablet);
  const mobile = block(styles.mobile);
  return (
    block(styles.base) +
    (tablet ? `@media (max-width:1023px){${tablet}}` : "") +
    (mobile ? `@media (max-width:639px){${mobile}}` : "") +
    orientationRules(selector, [styles.base, styles.tablet, styles.mobile])
  );
}

function deviceStyles(raw: unknown): DeviceStyles | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const pick = (key: string) => (r[key] && typeof r[key] === "object" && !Array.isArray(r[key]) ? (r[key] as Style) : undefined);
  return { base: pick("base"), tablet: pick("tablet"), mobile: pick("mobile") };
}

/** Named styles by id, from the site's global styles and then the page's own (the page wins). */
function namedStyles(...sources: unknown[]): Map<string, DeviceStyles> {
  const map = new Map<string, DeviceStyles>();
  for (const source of sources) {
    const named = source && typeof source === "object" ? (source as { named?: unknown }).named : null;
    if (!Array.isArray(named)) continue;
    for (const entry of named) {
      const e = entry as { id?: unknown; style?: unknown } | null;
      const styles = e ? deviceStyles(e.style) : null;
      if (e && typeof e.id === "string" && SAFE_ID.test(e.id) && styles) map.set(e.id, styles);
    }
  }
  return map;
}

function settingsOf(element: PageElement): Record<string, unknown> {
  const s = element.settings;
  return s && typeof s === "object" && !Array.isArray(s) ? (s as Record<string, unknown>) : {};
}

/**
 * The attribute value that ties an element's wrapper to its rules, or null
 * when the element has no style of its own and no named style — such an
 * element gets no wrapper at all and renders exactly as it always did.
 */
export function styleKey(element: PageElement): string | null {
  const s = settingsOf(element);
  const hasOwn = deviceStyles(s.style) !== null;
  const hasRef = typeof s.styleRef === "string" && SAFE_ID.test(s.styleRef);
  if (!hasOwn && !hasRef) return null;
  return typeof element.id === "string" && SAFE_ID.test(element.id) ? element.id : null;
}

/** The whole page's element stylesheet; empty when no element is styled. */
export function pageStyleSheet(tree: PageTree | null, siteStyles?: unknown): string {
  const named = namedStyles(siteStyles, tree?.globalStyles);
  let css = "";
  for (const section of tree?.sections ?? []) {
    for (const row of section?.rows ?? []) {
      for (const column of row?.columns ?? []) {
        for (const element of column?.elements ?? []) {
          const key = styleKey(element);
          if (!key) continue;
          const s = settingsOf(element);
          const selector = `[data-zs="${key}"]`;
          const ref = typeof s.styleRef === "string" ? named.get(s.styleRef) : undefined;
          // The named style first, so the element's own rules (same specificity, later) win.
          if (ref) css += rules(selector, ref);
          const own = deviceStyles(s.style);
          if (own) css += rules(selector, own);
        }
      }
    }
  }
  return css;
}

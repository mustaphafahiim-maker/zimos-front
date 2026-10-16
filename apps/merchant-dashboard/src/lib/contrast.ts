/**
 * Colour contrast for the Store look panel: whether the merchant's accent is
 * readable in a given mode, and — when it isn't — the nearest colour that is.
 *
 * The rule is WCAG 2.1's contrast ratio (relative luminance, (L1 + 0.05) /
 * (L2 + 0.05)) at the AA threshold for normal-size text, 4.5:1, checked for
 * the two ways a storefront uses the accent:
 *
 *  - as a surface under text — every filled button. The storefront writes the
 *    button's label in white or near-black, whichever reads better
 *    (brandTheme.ts `onColor`, mirrored by `labelOn` here), so the check is
 *    that better of the two;
 *  - as text on the store's own grounds — links, prices marked down, small
 *    highlights — on the page background and on a card.
 *
 * Passing both also clears WCAG's 3:1 for non-text contrast (1.4.11) — a
 * button's edge against the page, focus rings, icons — since 4.5 > 3.
 *
 * Pure and dependency-free: vitest covers it directly (contrast.test.ts).
 */

/** WCAG 2.1 AA for normal-size text (success criterion 1.4.3). */
export const MIN_TEXT_CONTRAST = 4.5;

/** The two label colours the storefront chooses between (its `onColor`). */
export const LABEL_LIGHT = "#FFFFFF";
export const LABEL_DARK = "#16211F";

type Rgb = [number, number, number];

/** `#rrggbb` → [r, g, b] in 0–255, or null for anything else. */
export function parseHex(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: Rgb): string {
  const part = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

function channelToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToChannel(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return v * 255;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(channelToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** The label colour the storefront puts on a filled button of this colour. */
export function labelOn(color: string): string {
  return contrastRatio(color, LABEL_LIGHT) >= contrastRatio(color, LABEL_DARK) ? LABEL_LIGHT : LABEL_DARK;
}

/** `a` blended toward `b` by `t` (0–1), in sRGB — what CSS `color-mix(in srgb, …)` does. */
export function mixHex(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return a;
  return toHex([0, 1, 2].map((i) => x[i] * (1 - t) + y[i] * t) as Rgb);
}

/** The grounds an accent is read on, in one mode of one theme. */
export interface AccentGrounds {
  /** The page background. */
  page: string;
  /** A card or panel (for Glass: the frosted pane as it shows over the page). */
  card: string;
}

export interface AccentCheck {
  /** The button label's contrast on the accent (the better of white and ink). */
  label: number;
  /** The accent as text on the page background. */
  onPage: number;
  /** The accent as text on a card. */
  onCard: number;
  /** Which uses fall short of MIN_TEXT_CONTRAST. */
  failing: Array<"label" | "text">;
  ok: boolean;
}

export function checkAccent(accent: string, grounds: AccentGrounds): AccentCheck {
  const label = contrastRatio(accent, labelOn(accent));
  const onPage = contrastRatio(accent, grounds.page);
  const onCard = contrastRatio(accent, grounds.card);
  const failing: AccentCheck["failing"] = [];
  if (label < MIN_TEXT_CONTRAST) failing.push("label");
  if (Math.min(onPage, onCard) < MIN_TEXT_CONTRAST) failing.push("text");
  return { label, onPage, onCard, failing, ok: failing.length === 0 };
}

// --- OKLab / OKLCH, for a suggestion that keeps the merchant's hue ----------

type Lab = [number, number, number];

function rgbToOklab([r, g, b]: Rgb): Lab {
  const lr = channelToLinear(r);
  const lg = channelToLinear(g);
  const lb = channelToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab → linear sRGB; may fall outside 0–1 when the colour is out of gamut. */
function oklabToLinear([L, a, b]: Lab): Rgb {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: Rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

/**
 * The colour at OKLCH lightness `L` with this hue, keeping as much of the
 * chroma as sRGB can show (chroma is halved toward grey until it fits).
 */
function atLightness(L: number, a: number, b: number): string {
  let lo = 0;
  let hi = 1;
  let best: Rgb = oklabToLinear([L, 0, 0]);
  if (inGamut(oklabToLinear([L, a, b]))) return toHex(oklabToLinear([L, a, b]).map(linearToChannel) as Rgb);
  for (let i = 0; i < 20; i++) {
    const k = (lo + hi) / 2;
    const rgb = oklabToLinear([L, a * k, b * k]);
    if (inGamut(rgb)) {
      best = rgb;
      lo = k;
    } else {
      hi = k;
    }
  }
  return toHex(best.map(linearToChannel) as Rgb);
}

/**
 * The nearest readable version of `accent`: same hue, as much of its chroma as
 * fits, lightness moved just far enough — darker in light mode (it has to stand
 * out from a light page and carry white text), lighter in dark mode (from a dark
 * page, carrying near-black text). Null when the accent already passes, or when
 * nothing along that line does (a theme with an unusually mid-tone ground).
 */
export function suggestAccent(accent: string, grounds: AccentGrounds, mode: "light" | "dark"): string | null {
  const rgb = parseHex(accent);
  if (!rgb || checkAccent(accent, grounds).ok) return null;
  const [L0, a, b] = rgbToOklab(rgb);
  const step = mode === "light" ? -0.005 : 0.005;
  for (let L = L0 + step; L >= 0 && L <= 1; L += step) {
    const candidate = atLightness(L, a, b);
    if (checkAccent(candidate, grounds).ok) return candidate;
  }
  return null;
}

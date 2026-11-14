/**
 * The dark look of an imported template ("xs" look): one palette for every
 * look's grounds and words, and each look's own colours (its accents, its
 * dark bands) kept, lightened only where they are words on the dark ground
 * and too dark to read there.
 *
 * Plain JavaScript so the build script (scripts/xs-dark.mjs) and the
 * storefront (the store layout, for a store's own accent) share it.
 *
 * Contrast is WCAG's: 4.5:1 for words, against the lighter of the two dark
 * grounds (the tint), so a colour that passes there passes on the ground too.
 */

/** The grounds and words every light look takes in the dark. */
export const DARK = Object.freeze({
  ground: "#141414",
  tint: "#1f1f1f",
  line: "#353535",
  ink: "#ededed",
  inkSoft: "#c8c8c8",
  muted: "#a8a8a8",
  /** The footer's words, for a look whose footer was a light ground with dark words. */
  footerInk: "#b8b8b8",
  /** A button the template draws in its ink (white words on it) whose ink is too light for them. */
  solid: "#2e2e2e",
});

/** Looks that are dark already, in light mode too: the dark mode leaves them as they are. */
export const NATIVE_DARK_LOOKS = Object.freeze(["19", "22"]);

/** The contrast words need. */
export const WORDS = 4.5;

/** "#abc", "#aabbcc", "#aabbccdd" → [r, g, b, a] (0–255, alpha 0–1); null for anything else. */
export function parseHex(value) {
  const hex = String(value).trim().replace(/^#/, "");
  if (!/^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
  const full = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  const a = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
  return [r, g, b, a];
}

/** "#…", "rgb(…)", "rgba(…)", "white", "black" → [r, g, b, a]; null for anything else. */
export function parseColor(value) {
  const text = String(value).trim().toLowerCase();
  if (text === "white") return [255, 255, 255, 1];
  if (text === "black") return [0, 0, 0, 1];
  if (text.startsWith("#")) return parseHex(text);
  const match = /^rgba?\(([^)]*)\)$/.exec(text);
  if (!match) return null;
  const parts = match[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const [r, g, b] = parts.slice(0, 3).map(Number);
  let a = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : Number(parts[3]);
  if (![r, g, b, a].every(Number.isFinite)) return null;
  a = Math.min(1, Math.max(0, a));
  return [r, g, b, a];
}

export function toHex([r, g, b]) {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance of an opaque colour. */
export function luminance(color) {
  const rgb = typeof color === "string" ? parseColor(color) : color;
  const [r, g, b] = rgb.slice(0, 3).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** How far a colour is from grey (0 grey … 1 pure hue). */
export function saturation(color) {
  const [r, g, b] = (typeof color === "string" ? parseColor(color) : color).slice(0, 3).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/**
 * The colour as words on the dark grounds: itself when it already reads at
 * 4.5:1 on the tint, else the least step toward white that does.
 */
export function lightenToRead(color, on = DARK.tint, ratio = WORDS) {
  const rgb = typeof color === "string" ? parseColor(color) : color;
  if (!rgb) return null;
  for (let step = 0; step <= 100; step += 1) {
    const t = step / 100;
    // Checked as written (two hex digits a channel), not before rounding.
    const hex = toHex(rgb.slice(0, 3).map((c) => c + (255 - c) * t));
    if (contrast(hex, on) >= ratio) return hex;
  }
  return "#ffffff";
}

/** The accent-like tokens a look may use for words as well as for grounds. */
export const ACCENT_TOKENS = Object.freeze(["brand", "accent", "highlight", "button", "badge"]);

/**
 * One look's dark tokens, from its light ones (the `--xs-*` values of its
 * token block; a value that isn't a plain colour falls back to the accent):
 *
 *   the palette's grounds and words;
 *   --xs-footer-ink   the look's own when it is light (a dark footer), the palette's otherwise;
 *   --xs-ink-day      the look's light-mode ink, for words on a coloured ground (a yellow button);
 *   --xs-ink-solid    a ground the template paints in its ink under white words;
 *   --xs-<accent>-text  each accent as words on the dark ground.
 */
export function darkTokensOf(tokens) {
  const colour = (name) => (parseColor(tokens[`--xs-${name}`] ?? "") ? tokens[`--xs-${name}`].trim() : null);
  const ink = colour("ink") ?? "#333333";
  const accent = colour("accent") ?? colour("brand") ?? colour("button") ?? "#6c7ae0";
  const footerInk = colour("footer-ink");
  const out = {
    "--xs-ground": DARK.ground,
    "--xs-tint": DARK.tint,
    "--xs-line": DARK.line,
    "--xs-ink": DARK.ink,
    "--xs-ink-soft": DARK.inkSoft,
    "--xs-muted": DARK.muted,
    "--xs-footer-ink": footerInk && luminance(footerInk) > 0.3 ? footerInk : DARK.footerInk,
    "--xs-ink-day": ink,
    "--xs-ink-solid": contrast(ink, "#ffffff") >= WORDS ? ink : DARK.solid,
  };
  for (const name of ACCENT_TOKENS) out[`--xs-${name}-text`] = lightenToRead(colour(name) ?? accent);
  return out;
}

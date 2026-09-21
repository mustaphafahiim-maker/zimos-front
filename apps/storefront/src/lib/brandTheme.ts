/**
 * The merchant's store look, read out of the workspace's `themeSettings` and
 * turned into the CSS custom properties the `.brand-theme` wrapper carries.
 *
 * Pure on purpose: the store layout (server) and the editor preview's bridge
 * (client, applying unsaved changes live) both need exactly the same mapping,
 * so it lives here rather than beside the server-only API helpers.
 *
 * Every key is optional and read defensively — themeSettings is an opaque blob
 * the backend stores as-is. Anything missing or malformed is simply left out,
 * so the stylesheet's own defaults (which are light/dark aware) still apply.
 * A store that has saved nothing renders exactly as it always has.
 *
 * Keys, all written by the dashboard:
 *  - `primaryColor` / `secondaryColor` — `#rrggbb` (Settings page and the
 *    website editor's "Store look" panel);
 *  - `fontFamily` — one of THEME_FONTS' keys;
 *  - `cornerRadius` — one of THEME_RADII's keys.
 */

/** Matches the keys the dashboard's Settings page writes into themeSettings. */
const HEX = /^#[0-9a-f]{6}$/i;

function hex(themeSettings: Record<string, unknown> | null | undefined, key: string): string | null {
  const raw = themeSettings?.[key];
  return typeof raw === "string" && HEX.test(raw.trim()) ? raw.trim() : null;
}

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(color: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Ink used on brand surfaces too light for white text. Matches --color-ink. */
const ON_LIGHT = "#16211f";
const ON_DARK = "#ffffff";

/**
 * A readable foreground for text sitting on `color`, picked by contrast.
 *
 * The utilities that paint brand surfaces used to hardcode `text-paper-raised`,
 * which is white in light mode and near-black in dark mode. That assumes the
 * brand colour flips with the theme — but it does not: a merchant who saves a
 * deep blue gets near-black text on deep blue in dark mode (measured 1.97:1).
 * Choosing the foreground from the brand colour itself keeps the pair legible
 * whatever hex the merchant picks, in either theme.
 */
function onColor(color: string): string {
  const l = luminance(color);
  const contrast = (other: number) => {
    const [hi, lo] = l > other ? [l, other] : [other, l];
    return (hi + 0.05) / (lo + 0.05);
  };
  return contrast(luminance(ON_DARK)) >= contrast(luminance(ON_LIGHT)) ? ON_DARK : ON_LIGHT;
}

/**
 * Font pairings the merchant can pick. Only families the root layout already
 * loads (Fraunces, Plus Jakarta Sans, Tajawal) or the platform's own system
 * face, so a choice never costs an extra font download. Tajawal stays in every
 * stack because the Latin faces have no Arabic glyphs.
 *
 * `classic` is the stylesheet's own pairing, spelled out for the preview.
 */
const SANS = '"Plus Jakarta Sans", "Tajawal", ui-sans-serif, system-ui, sans-serif';
export const THEME_FONTS: Record<string, { display: string; sans: string }> = {
  classic: { display: '"Fraunces", "Tajawal", ui-serif, Georgia, serif', sans: SANS },
  modern: { display: SANS, sans: SANS },
  tajawal: {
    display: '"Tajawal", ui-sans-serif, system-ui, sans-serif',
    sans: '"Tajawal", ui-sans-serif, system-ui, sans-serif',
  },
  system: {
    display: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Tajawal", sans-serif',
    sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Tajawal", sans-serif',
  },
};

/**
 * Corner rounding. The storefront draws its cards and buttons with Tailwind's
 * `rounded-lg/xl/2xl`, which read `--radius-*`, plus `--radius-card`; moving
 * those four moves the whole store together. `soft` is Tailwind's own scale
 * and the stylesheet's card radius — the look every store had before.
 */
export const THEME_RADII: Record<string, Record<string, string>> = {
  sharp: { "--radius-lg": "0.125rem", "--radius-xl": "0.25rem", "--radius-2xl": "0.25rem", "--radius-card": "0.25rem" },
  soft: { "--radius-lg": "0.5rem", "--radius-xl": "0.75rem", "--radius-2xl": "1rem", "--radius-card": "0.625rem" },
  round: { "--radius-lg": "0.875rem", "--radius-xl": "1.25rem", "--radius-2xl": "1.75rem", "--radius-card": "1.25rem" },
};

function choice(themeSettings: Record<string, unknown> | null | undefined, key: string, table: Record<string, unknown>) {
  const raw = themeSettings?.[key];
  return typeof raw === "string" && Object.hasOwn(table, raw) ? raw : null;
}

/** Every custom property brandVars can write — the preview bridge clears the rest. */
export const BRAND_VAR_NAMES = [
  "--brand-primary",
  "--brand-primary-foreground",
  "--brand-secondary",
  "--brand-secondary-foreground",
  "--font-display",
  "--font-sans",
  ...Object.keys(THEME_RADII.soft),
];

/**
 * The custom properties for a store wrapper. Anything the merchant has not set
 * is left out, so the stylesheet's defaults apply.
 *
 * `complete` (the editor preview only) also spells out the default font and
 * radius, so an unsaved switch back to the defaults beats whatever the store
 * has saved. Colours are never filled in: their defaults differ between light
 * and dark, which a single inline value could not express.
 */
export function brandVars(
  themeSettings: Record<string, unknown> | null | undefined,
  { complete = false }: { complete?: boolean } = {}
): Record<string, string> {
  const vars: Record<string, string> = {};
  const primary = hex(themeSettings, "primaryColor");
  const secondary = hex(themeSettings, "secondaryColor");
  if (primary) {
    vars["--brand-primary"] = primary;
    vars["--brand-primary-foreground"] = onColor(primary);
  }
  if (secondary) {
    vars["--brand-secondary"] = secondary;
    vars["--brand-secondary-foreground"] = onColor(secondary);
  }

  const font = choice(themeSettings, "fontFamily", THEME_FONTS) ?? (complete ? "classic" : null);
  if (font) {
    vars["--font-display"] = THEME_FONTS[font].display;
    vars["--font-sans"] = THEME_FONTS[font].sans;
  }

  const radius = choice(themeSettings, "cornerRadius", THEME_RADII) ?? (complete ? "soft" : null);
  if (radius) Object.assign(vars, THEME_RADII[radius]);

  return vars;
}

/**
 * An unsaved store look sent by the editor with a preview. Validated here
 * because it arrives from a form post or a cross-window message — never
 * trusted as-is.
 */
export interface PreviewTheme {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  cornerRadius?: string;
  /** Undefined leaves the store's saved logo alone; null previews "no logo". */
  logoUrl?: string | null;
}

export function readPreviewTheme(raw: unknown): PreviewTheme | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const theme: PreviewTheme = {};
  const primary = hex(input, "primaryColor");
  const secondary = hex(input, "secondaryColor");
  if (primary) theme.primaryColor = primary;
  if (secondary) theme.secondaryColor = secondary;
  const font = choice(input, "fontFamily", THEME_FONTS);
  if (font) theme.fontFamily = font;
  const radius = choice(input, "cornerRadius", THEME_RADII);
  if (radius) theme.cornerRadius = radius;
  if (input.logoUrl === null) {
    theme.logoUrl = null;
  } else if (typeof input.logoUrl === "string") {
    try {
      const url = new URL(input.logoUrl);
      if (url.protocol === "https:" || url.protocol === "http:") theme.logoUrl = url.href;
    } catch {
      // Not a URL — leave the saved logo alone.
    }
  }
  return theme;
}

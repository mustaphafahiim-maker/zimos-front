/**
 * Merchant store theme settings.
 *
 * The backend stores `workspaces.theme_settings` as an opaque JSONB blob
 * (max 50 top-level keys, ~5KB — see zimos-main workspaceService). This module
 * owns its shape: every reader goes through `normalizeThemeSettings`, which
 * accepts anything (null, a legacy `{ primaryColor, secondaryColor }` blob, a
 * half-written object from an old dashboard) and always returns a complete,
 * safe `ThemeSettings`.
 *
 * Settings are stored as a handful of nested top-level keys (`colors`,
 * `typography`, `shape`, `layout`, `header`, `footer`, `productCard`,
 * `preset`), so they sit alongside any legacy keys already in the blob.
 */

export const ARABIC_FONTS = ["Cairo", "Tajawal", "Noto Sans Arabic", "IBM Plex Sans Arabic", "Almarai"] as const;
export const LATIN_FONTS = ["Inter", "Poppins", "Montserrat"] as const;
export type ArabicFont = (typeof ARABIC_FONTS)[number];
export type LatinFont = (typeof LATIN_FONTS)[number];

export const RADIUS_SCALES = ["sharp", "soft", "rounded", "pill"] as const;
export const BUTTON_STYLES = ["solid", "outline", "soft"] as const;
export const BUTTON_SHAPES = ["square", "rounded", "pill"] as const;
export const DENSITIES = ["compact", "comfortable", "airy"] as const;
export const HEADER_LAYOUTS = ["logo-start", "logo-center"] as const;
export const IMAGE_RATIOS = ["square", "portrait"] as const;
export const BASE_SIZES = [14, 15, 16, 17, 18] as const;
export const THEME_IDS = [
  "nile",
  "souq",
  "luxe",
  "bazaar",
  "lamsa",
  // Niche stores
  "moda",
  "sitara",
  "dahab",
  "glow",
  "oud",
  "tech",
  "turbo",
  "beit",
  "atfal",
  "fit",
  "taza",
  "alifa",
] as const;

export type RadiusScale = (typeof RADIUS_SCALES)[number];
export type ButtonStyle = (typeof BUTTON_STYLES)[number];
export type ButtonShape = (typeof BUTTON_SHAPES)[number];
export type Density = (typeof DENSITIES)[number];
export type HeaderLayout = (typeof HEADER_LAYOUTS)[number];
export type ImageRatio = (typeof IMAGE_RATIOS)[number];
export type BaseSize = (typeof BASE_SIZES)[number];
export type ThemeId = (typeof THEME_IDS)[number];

export interface SocialLink {
  platform: string;
  url: string;
}

export interface ThemeSettings {
  /** Which preset the settings started from ("custom" once edited freely). */
  preset: ThemeId | "custom";
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
    border: string;
    /** "auto" picks white or near-black, whichever contrasts more with primary. */
    buttonText: "auto" | string;
  };
  typography: {
    arabicFont: ArabicFont;
    latinFont: LatinFont;
    baseSize: BaseSize;
  };
  shape: {
    radius: RadiusScale;
    buttonStyle: ButtonStyle;
    buttonShape: ButtonShape;
  };
  layout: {
    density: Density;
  };
  header: {
    layout: HeaderLayout;
    sticky: boolean;
    showSearch: boolean;
    announcement: {
      enabled: boolean;
      text: string;
      href: string;
      background: string;
      color: string;
    };
  };
  footer: {
    columns: 2 | 3 | 4;
    about: string;
    showSocial: boolean;
    social: SocialLink[];
    /** Free text shown as small badges, split on "," or "·" (e.g. "الدفع عند الاستلام, فودافون كاش"). */
    paymentBadges: string;
    /** Empty = "© {year} {store name}". */
    copyright: string;
  };
  productCard: {
    imageRatio: ImageRatio;
    showComparePrice: boolean;
    quickOrder: boolean;
  };
}

/** The "Nile" palette — what a store with no saved settings looks like. */
export const DEFAULT_THEME_SETTINGS: ThemeSettings = Object.freeze({
  preset: "nile",
  colors: {
    primary: "#0f766e",
    secondary: "#f59e0b",
    background: "#ffffff",
    surface: "#f5f7f6",
    text: "#13201d",
    muted: "#5b6865",
    border: "#e2e8e6",
    buttonText: "auto",
  },
  typography: { arabicFont: "Cairo", latinFont: "Inter", baseSize: 16 },
  shape: { radius: "rounded", buttonStyle: "solid", buttonShape: "rounded" },
  layout: { density: "comfortable" },
  header: {
    layout: "logo-start",
    sticky: true,
    showSearch: true,
    announcement: { enabled: false, text: "", href: "", background: "#13201d", color: "#ffffff" },
  },
  footer: { columns: 4, about: "", showSocial: true, social: [], paymentBadges: "", copyright: "" },
  productCard: { imageRatio: "square", showComparePrice: true, quickOrder: true },
}) as ThemeSettings;

// ---------------------------------------------------------------------------
// Coercion helpers
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === "object" && !Array.isArray(v);
const objAt = (o: Obj | undefined, k: string): Obj | undefined => (o && isObj(o[k]) ? (o[k] as Obj) : undefined);

/** "#abc" / "#AABBCC" → "#aabbcc"; anything else → null. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return null;
}

function pick<T extends string | number>(allowed: readonly T[], value: unknown, fallback: T): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Strips control chars and caps length — this text lands in the page chrome. */
function text(value: unknown, fallback: string, max = 200): string {
  if (typeof value !== "string") return fallback;
  // eslint-disable-next-line no-control-regex
  let out = "";
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    out += code < 32 || code === 127 ? " " : ch;
  }
  return out.trim().slice(0, max);
}

function safeLink(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim().slice(0, 500);
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(v)) return v;
  return "";
}

/**
 * Accepts any input and returns complete settings. Unknown keys are dropped,
 * invalid values fall back to `base` (defaults to Nile). Legacy blobs written
 * by the dashboard's Settings page (`primaryColor` / `secondaryColor` at the
 * top level) still colour the store when no `colors` object exists.
 */
export function normalizeThemeSettings(input: unknown, base: ThemeSettings = DEFAULT_THEME_SETTINGS): ThemeSettings {
  const raw: Obj = isObj(input) ? input : {};
  const colors = objAt(raw, "colors");
  const typography = objAt(raw, "typography");
  const shape = objAt(raw, "shape");
  const layout = objAt(raw, "layout");
  const header = objAt(raw, "header");
  const announcement = objAt(header, "announcement");
  const footer = objAt(raw, "footer");
  const card = objAt(raw, "productCard");

  const c = base.colors;
  const color = (key: keyof ThemeSettings["colors"], legacyKey?: string) =>
    normalizeHex(colors?.[key]) ?? (legacyKey ? normalizeHex(raw[legacyKey]) : null) ?? c[key];

  const buttonTextRaw = colors?.buttonText;
  const buttonText = buttonTextRaw === "auto" ? "auto" : (normalizeHex(buttonTextRaw) ?? c.buttonText);

  const social: SocialLink[] = Array.isArray(footer?.social)
    ? (footer!.social as unknown[])
        .filter(isObj)
        .map((s) => ({ platform: text(s.platform, "", 40), url: safeLink(s.url) }))
        .filter((s) => s.url !== "")
        .slice(0, 8)
    : base.footer.social.map((s) => ({ ...s }));

  const columnsRaw = footer?.columns;
  const columns = columnsRaw === 2 || columnsRaw === 3 || columnsRaw === 4 ? columnsRaw : base.footer.columns;

  return {
    preset: pick([...THEME_IDS, "custom"] as const, raw.preset, base.preset),
    colors: {
      primary: color("primary", "primaryColor"),
      secondary: color("secondary", "secondaryColor"),
      background: color("background"),
      surface: color("surface"),
      text: color("text"),
      muted: color("muted"),
      border: color("border"),
      buttonText,
    },
    typography: {
      arabicFont: pick(ARABIC_FONTS, typography?.arabicFont, base.typography.arabicFont),
      latinFont: pick(LATIN_FONTS, typography?.latinFont, base.typography.latinFont),
      baseSize: pick(BASE_SIZES, typography?.baseSize, base.typography.baseSize),
    },
    shape: {
      radius: pick(RADIUS_SCALES, shape?.radius, base.shape.radius),
      buttonStyle: pick(BUTTON_STYLES, shape?.buttonStyle, base.shape.buttonStyle),
      buttonShape: pick(BUTTON_SHAPES, shape?.buttonShape, base.shape.buttonShape),
    },
    layout: { density: pick(DENSITIES, layout?.density, base.layout.density) },
    header: {
      layout: pick(HEADER_LAYOUTS, header?.layout, base.header.layout),
      sticky: bool(header?.sticky, base.header.sticky),
      showSearch: bool(header?.showSearch, base.header.showSearch),
      announcement: {
        enabled: bool(announcement?.enabled, base.header.announcement.enabled),
        text: text(announcement?.text, base.header.announcement.text, 160),
        href: announcement && "href" in announcement ? safeLink(announcement.href) : base.header.announcement.href,
        background: normalizeHex(announcement?.background) ?? base.header.announcement.background,
        color: normalizeHex(announcement?.color) ?? base.header.announcement.color,
      },
    },
    footer: {
      columns,
      about: text(footer?.about, base.footer.about, 400),
      showSocial: bool(footer?.showSocial, base.footer.showSocial),
      social,
      paymentBadges: text(footer?.paymentBadges, base.footer.paymentBadges, 200),
      copyright: text(footer?.copyright, base.footer.copyright, 160),
    },
    productCard: {
      imageRatio: pick(IMAGE_RATIOS, card?.imageRatio, base.productCard.imageRatio),
      showComparePrice: bool(card?.showComparePrice, base.productCard.showComparePrice),
      quickOrder: bool(card?.quickOrder, base.productCard.quickOrder),
    },
  };
}

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

function luminance(hex: string): number {
  const ch = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const LIGHT_ON = "#ffffff";
const DARK_ON = "#111111";

/** Linear sRGB-ish mix of two hex colours (weight = share of `b`). */
export function mixHex(a: string, b: string, weight: number): string {
  const ha = normalizeHex(a) ?? "#000000";
  const hb = normalizeHex(b) ?? "#000000";
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const out = [1, 3, 5].map((i) => Math.round(ch(ha, i) * (1 - weight) + ch(hb, i) * weight));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** White or near-black, whichever reads better on `background`. */
export function readableOn(background: string): string {
  const hex = normalizeHex(background) ?? "#000000";
  return contrastRatio(hex, LIGHT_ON) >= contrastRatio(hex, DARK_ON) ? LIGHT_ON : DARK_ON;
}

// ---------------------------------------------------------------------------
// CSS output
// ---------------------------------------------------------------------------

const RADIUS: Record<RadiusScale, [sm: number, md: number, lg: number]> = {
  sharp: [0, 2, 4],
  soft: [4, 8, 12],
  rounded: [8, 14, 20],
  pill: [12, 20, 28],
};

const BUTTON_RADIUS: Record<ButtonShape, string> = { square: "2px", rounded: "10px", pill: "999px" };

/** [section block padding mobile, desktop, grid gap] */
const DENSITY: Record<Density, [string, string, string]> = {
  compact: ["2rem", "3rem", "1rem"],
  comfortable: ["3rem", "4.5rem", "1.5rem"],
  airy: ["4rem", "6.5rem", "2rem"],
};

function fontStack(first: string, second: string) {
  return `"${first}", "${second}", system-ui, -apple-system, "Segoe UI", sans-serif`;
}

/**
 * CSS custom properties for a store wrapper, as a plain object whose keys are
 * the property names. Works directly as a React `style` prop. Key order is
 * fixed, so output is stable for snapshots / caching.
 */
export function themeCssVariables(input: ThemeSettings | unknown): Record<string, string> {
  const s = normalizeThemeSettings(input);
  const [rsm, rmd, rlg] = RADIUS[s.shape.radius];
  const [padM, padD, gap] = DENSITY[s.layout.density];
  const onPrimary = s.colors.buttonText === "auto" ? readableOn(s.colors.primary) : s.colors.buttonText;

  return {
    "--zr-primary": s.colors.primary,
    // Gradient end stop that keeps on-primary text readable: darker under light text, lighter under dark text.
    "--zr-primary-deep": onPrimary === LIGHT_ON ? mixHex(s.colors.primary, "#000000", 0.28) : mixHex(s.colors.primary, "#ffffff", 0.22),
    "--zr-on-primary": onPrimary,
    "--zr-secondary": s.colors.secondary,
    "--zr-on-secondary": readableOn(s.colors.secondary),
    "--zr-bg": s.colors.background,
    "--zr-surface": s.colors.surface,
    "--zr-text": s.colors.text,
    "--zr-muted": s.colors.muted,
    "--zr-border": s.colors.border,
    "--zr-font-ar": fontStack(s.typography.arabicFont, s.typography.latinFont),
    "--zr-font-latin": fontStack(s.typography.latinFont, s.typography.arabicFont),
    "--zr-font-size": `${s.typography.baseSize}px`,
    "--zr-radius-sm": `${rsm}px`,
    "--zr-radius": `${rmd}px`,
    "--zr-radius-lg": `${rlg}px`,
    "--zr-btn-radius": BUTTON_RADIUS[s.shape.buttonShape],
    "--zr-section-pad": padM,
    "--zr-section-pad-lg": padD,
    "--zr-gap": gap,
    "--zr-ann-bg": s.header.announcement.background,
    "--zr-ann-fg": s.header.announcement.color,
    "--zr-card-ratio": s.productCard.imageRatio === "portrait" ? "4 / 5" : "1 / 1",
  };
}

/** The same variables as a CSS declaration string (for `<style>` / SSR strings). */
export function themeCssText(input: ThemeSettings | unknown, selector = ".zr-theme"): string {
  const vars = themeCssVariables(input);
  return `${selector}{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`;
}

/**
 * Modifier classes that CSS variables can't express (button treatment, card
 * options). Put them on the same wrapper as the variables.
 */
export function themeClassName(input: ThemeSettings | unknown): string {
  const s = normalizeThemeSettings(input);
  return [
    "zr-theme",
    `zr-btnstyle-${s.shape.buttonStyle}`,
    `zr-density-${s.layout.density}`,
    `zr-card-${s.productCard.imageRatio}`,
    s.productCard.showComparePrice ? "" : "zr-card-nocompare",
    s.productCard.quickOrder ? "" : "zr-card-noquick",
  ]
    .filter(Boolean)
    .join(" ");
}

const FONT_WEIGHTS: Record<ArabicFont | LatinFont, string> = {
  Cairo: "400;600;700;800",
  Tajawal: "400;500;700;800",
  "Noto Sans Arabic": "400;600;700;800",
  "IBM Plex Sans Arabic": "400;500;600;700",
  Almarai: "400;700;800",
  Inter: "400;500;600;700;800",
  Poppins: "400;500;600;700",
  Montserrat: "400;500;600;700",
};

/** Google Fonts stylesheet URL for exactly the two selected families. */
export function googleFontsHref(input: ThemeSettings | unknown): string {
  const s = normalizeThemeSettings(input);
  const fam = (name: ArabicFont | LatinFont) => `family=${name.replace(/ /g, "+")}:wght@${FONT_WEIGHTS[name]}`;
  return `https://fonts.googleapis.com/css2?${fam(s.typography.arabicFont)}&${fam(s.typography.latinFont)}&display=swap`;
}

/** Splits the footer's payment badge text into chips. */
export function paymentBadgeList(input: ThemeSettings | unknown): string[] {
  return normalizeThemeSettings(input)
    .footer.paymentBadges.split(/[,،·|]/)
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 8);
}

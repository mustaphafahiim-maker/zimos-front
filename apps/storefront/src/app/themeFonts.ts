import {
  Alexandria,
  Almarai,
  Archivo,
  Baloo_Bhaijaan_2,
  Cairo,
  Cormorant_Garamond,
  Fraunces,
  IBM_Plex_Sans_Arabic,
  Jost,
  Lora,
  Markazi_Text,
  Noto_Naskh_Arabic,
  Nunito,
  Plus_Jakarta_Sans,
  Readex_Pro,
  Rubik,
  Source_Sans_3,
  Space_Grotesk,
  Tajawal,
} from "next/font/google";
import type { StoreThemeKey } from "@/lib/brandTheme";

/**
 * Every typeface a store can be drawn in: the original look's three
 * (Fraunces, Plus Jakarta Sans, Tajawal) and the store themes' own
 * (globals.css, `[data-store-theme]`).
 *
 * `next/font/google` downloads each family at build time and serves it from
 * this app's own `/_next/static/media` — the shopper's browser never talks to
 * Google, so a blocked or slow font CDN can't take a store's type away, and no
 * page waits on a third-party stylesheet before it paints. The root layout
 * imports this module, so the faces are declared on every page of the app.
 *
 * Declared is not downloaded. Each family's `@font-face` rules carry a unicode
 * range, and a browser fetches a file only once text on the page needs it: a
 * store on `bold` downloads Archivo and Cairo, an Arabic store on the original
 * look downloads Tajawal, and nothing else.
 *
 * Nothing here is preloaded, and that is forced, not chosen. next/font decides
 * its preload tags per layout file at build time (every family called with
 * `preload: true` in a layout is preloaded on every route under it), so the
 * store layout can either preload every look's Arabic face on every store or
 * none; it cannot preload one store's. With the files on this origin the
 * first text asks for its face over the connection the page already has, and
 * `display: swap` draws the fallback until it lands — once per visit, the file
 * is cached from then on.
 *
 * Names: this app is built with Turbopack, which registers each face under
 * its real family name. The original look's stacks are written by name in
 * globals.css, lib/brandTheme.ts and lib/storeFonts.tsx, and those names find
 * the faces declared here. No second set of faces may be added under one of
 * these names (a Google Fonts link for Tajawal, say): the two would compete
 * for the same text.
 *
 * Arabic: each stack puts a family with real Arabic glyphs right after the
 * Latin one. The Latin-only faces (Fraunces, Plus Jakarta Sans, Cormorant,
 * Jost, Archivo, Lora, Source Sans, Nunito, Space Grotesk) declare only Latin
 * unicode ranges, so Arabic text falls through to the Arabic face beside it —
 * never to a system default.
 */

// next/font reads these options at build time, so each call spells them out
// as a literal (no shared object): swap, never preloaded.

// The original look. The same weights the Google Fonts link in the root layout
// used to ask for, so nothing is drawn heavier or lighter than it was; Fraunces
// keeps its optical-size axis, which next/font only gives with the whole weight
// range (the link stopped at 500–700).
const fraunces = Fraunces({ display: "swap", preload: false, subsets: ["latin"], axes: ["opsz"] });
const jakarta = Plus_Jakarta_Sans({ display: "swap", preload: false, subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const tajawal = Tajawal({ display: "swap", preload: false, subsets: ["arabic", "latin"], weight: ["400", "500", "700"] });

// The themes.
const cormorant = Cormorant_Garamond({ display: "swap", preload: false, subsets: ["latin"], weight: ["500", "600", "700"] });
const markazi = Markazi_Text({ display: "swap", preload: false, subsets: ["arabic", "latin"] });
const jost = Jost({ display: "swap", preload: false, subsets: ["latin"] });
const plexArabic = IBM_Plex_Sans_Arabic({ display: "swap", preload: false, subsets: ["arabic"], weight: ["300", "400", "500", "600", "700"] });
const archivo = Archivo({ display: "swap", preload: false, subsets: ["latin"] });
const cairo = Cairo({ display: "swap", preload: false, subsets: ["arabic", "latin"] });
const alexandria = Alexandria({ display: "swap", preload: false, subsets: ["arabic", "latin"] });
const lora = Lora({ display: "swap", preload: false, subsets: ["latin"] });
const naskh = Noto_Naskh_Arabic({ display: "swap", preload: false, subsets: ["arabic"] });
const sourceSans = Source_Sans_3({ display: "swap", preload: false, subsets: ["latin"] });
const almarai = Almarai({ display: "swap", preload: false, subsets: ["arabic"], weight: ["300", "400", "700", "800"] });
const baloo = Baloo_Bhaijaan_2({ display: "swap", preload: false, subsets: ["arabic", "latin"] });
const nunito = Nunito({ display: "swap", preload: false, subsets: ["latin"] });
const rubik = Rubik({ display: "swap", preload: false, subsets: ["arabic"] });
const spaceGrotesk = Space_Grotesk({ display: "swap", preload: false, subsets: ["latin"] });
const readex = Readex_Pro({ display: "swap", preload: false, subsets: ["arabic", "latin"] });

type LoadedFont = { style: { fontFamily: string } };

/** A loaded font's own face, and the metric-matched local fallbacks next/font made for it. */
function facesOf(font: LoadedFont): { face: string | undefined; fallbacks: string[] } {
  const [face, ...fallbacks] = font.style.fontFamily
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return { face, fallbacks };
}

/**
 * One `font-family` stack from several loaded fonts: every font's own face
 * first, in order, then their metric-matched fallbacks, then the generic.
 *
 * The order matters. next/font's fallback face for a Latin font is a local
 * Arial/Times with no unicode range — it would draw Arabic if it sat before
 * the Arabic web font. With the real faces first, Arabic always reaches the
 * Arabic face; the fallbacks only stand in while a face is still loading.
 *
 * `arabicFirst` (a right-to-left page) turns the fallbacks round, so the one
 * measured against the Arabic family — the last in the list — is the one that
 * stands in: most of that page's text is Arabic, and it is the text that
 * should move least when its face arrives.
 */
export function fontStack(fonts: LoadedFont[], generic: string, arabicFirst = false): string {
  const faces: string[] = [];
  const fallbacks: string[] = [];
  for (const font of fonts) {
    const own = facesOf(font);
    if (own.face) faces.push(own.face);
    if (arabicFirst) fallbacks.unshift(...own.fallbacks);
    else fallbacks.push(...own.fallbacks);
  }
  return [...faces, ...fallbacks, generic].join(", ");
}

const SERIF = "ui-serif, Georgia, serif";
const SANS = "ui-sans-serif, system-ui, sans-serif";

type FontStacks = { display: string; sans: string };

function themeStacks(arabicFirst: boolean): Record<StoreThemeKey, FontStacks> {
  const stack = (fonts: LoadedFont[], generic: string) => fontStack(fonts, generic, arabicFirst);
  return {
    elegant: { display: stack([cormorant, markazi], SERIF), sans: stack([jost, plexArabic], SANS) },
    bold: { display: stack([archivo, cairo], SANS), sans: stack([archivo, cairo], SANS) },
    minimal: { display: stack([alexandria], SANS), sans: stack([alexandria], SANS) },
    classic: { display: stack([lora, naskh], SERIF), sans: stack([sourceSans, almarai], SANS) },
    warm: { display: stack([baloo], SANS), sans: stack([nunito, rubik], SANS) },
    glass: { display: stack([spaceGrotesk, readex], SANS), sans: stack([readex], SANS) },
    // Tajawal draws this look's body, Arabic and Latin alike, and stands behind Baloo in its headings.
    uokids: { display: stack([baloo, tajawal], SANS), sans: stack([tajawal], SANS) },
  };
}

/** Heading (`--font-display`) and body (`--font-sans`) per theme. */
export const THEME_FONT_STACKS: Record<StoreThemeKey, FontStacks> = themeStacks(false);
const THEME_FONT_STACKS_RTL = themeStacks(true);

function fontRule(selector: string, stacks: FontStacks): string {
  return `${selector}{--font-display:${stacks.display};--font-sans:${stacks.sans}}`;
}

/**
 * The stacks as one small stylesheet, rendered once by the store layout. It is
 * keyed by `data-store-theme`, so switching theme in the editor's preview is
 * an attribute change — every theme's stacks are already on the page. A theme
 * whose right-to-left order differs gets a second rule for `dir="rtl"`.
 */
export const THEME_FONT_CSS = (Object.keys(THEME_FONT_STACKS) as StoreThemeKey[])
  .flatMap((key) => {
    const selector = `.brand-theme[data-store-theme="${key}"]`;
    const ltr = THEME_FONT_STACKS[key];
    const rtl = THEME_FONT_STACKS_RTL[key];
    const rules = [fontRule(selector, ltr)];
    if (rtl.display !== ltr.display || rtl.sans !== ltr.sans) rules.push(fontRule(`${selector}[dir="rtl"]`, rtl));
    return rules;
  })
  .join("\n");

/**
 * The original look's stacks — what a store with no theme, and every page that
 * is not a store, is drawn in. globals.css names the same three families;
 * this rule repeats them with the faces next/font made, which adds their
 * metric-matched fallbacks (the stylesheet cannot know those names), so the
 * text moves less when a face arrives. `html:root` outranks the stylesheet's
 * `:root` wherever the two land in the page.
 */
export const BASE_FONT_CSS = [
  fontRule("html:root", { display: fontStack([fraunces, tajawal], SERIF), sans: fontStack([jakarta, tajawal], SANS) }),
  fontRule('html:root[dir="rtl"]', { display: fontStack([fraunces, tajawal], SERIF, true), sans: fontStack([jakarta, tajawal], SANS, true) }),
].join("\n");

/** The original look's families by the name stacks elsewhere call them. */
const OWN_FACES: Array<{ name: string; font: LoadedFont }> = [
  { name: "Fraunces", font: fraunces },
  { name: "Plus Jakarta Sans", font: jakarta },
  { name: "Tajawal", font: tajawal },
];

function withOwnFaces(stack: string, arabicFirst: boolean): string {
  const out: string[] = [];
  const fallbacks: string[] = [];
  let after = -1;
  for (const part of stack.split(",").map((name) => name.trim()).filter(Boolean)) {
    const bare = part.replace(/^["']|["']$/g, "");
    const own = OWN_FACES.find((entry) => entry.name === bare);
    const loaded = own ? facesOf(own.font) : null;
    if (!loaded?.face) {
      out.push(part);
      continue;
    }
    out.push(loaded.face);
    after = out.length;
    if (arabicFirst) fallbacks.unshift(...loaded.fallbacks);
    else fallbacks.push(...loaded.fallbacks);
  }
  if (after < 0) return stack;
  out.splice(after, 0, ...fallbacks.filter((name) => !out.includes(name)));
  return out.join(", ");
}

/**
 * The store wrapper's inline font variables — a font pairing the merchant
 * picked for the original look (lib/brandTheme THEME_FONTS) or a font of their
 * own with Tajawal behind it (lib/storeFonts) — with the three families named
 * there pointed at the faces declared here and followed by their fallbacks.
 * Anything else in the style, and a stack that names none of the three, is
 * returned as it came.
 */
export function withOwnFontFaces<T extends object>(style: T, arabicFirst: boolean): T {
  const own: Record<string, string> = {};
  for (const [key, value] of Object.entries(style)) {
    if ((key === "--font-display" || key === "--font-sans") && typeof value === "string") own[key] = withOwnFaces(value, arabicFirst);
  }
  return { ...style, ...own };
}

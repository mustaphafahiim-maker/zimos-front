import {
  Alexandria,
  Almarai,
  Archivo,
  Baloo_Bhaijaan_2,
  Cairo,
  Cormorant_Garamond,
  IBM_Plex_Sans_Arabic,
  Jost,
  Lora,
  Markazi_Text,
  Noto_Naskh_Arabic,
  Nunito,
  Readex_Pro,
  Rubik,
  Source_Sans_3,
  Space_Grotesk,
} from "next/font/google";
import type { StoreThemeKey } from "@/lib/brandTheme";

/**
 * The store themes' typefaces (globals.css, `[data-store-theme]`).
 *
 * `next/font/google` downloads each family at build time and serves it from
 * this app's own `/_next/static/media` — the shopper's browser never talks to
 * Google, so a blocked or slow font CDN can't take a theme's type away. (The
 * original look keeps the Google Fonts link in the root layout it always had.)
 *
 * Nothing here is preloaded: every store page imports this module, and only
 * the active theme's two or three families are ever drawn, so a preload tag
 * per family would make every store download all of them. A browser fetches
 * a face only once text uses it; `display: swap` and next/font's metric-matched
 * fallbacks keep the swap from shifting the page.
 *
 * None of these shares a family name with the original look's Fraunces,
 * Plus Jakarta Sans and Tajawal: next/font registers each face under its real
 * name, and a second set of faces for one of those would change which file
 * an original-look store draws with.
 *
 * Arabic: each stack puts a family with real Arabic glyphs right after the
 * Latin one. The Latin-only faces (Cormorant, Jost, Archivo, Lora, Source Sans,
 * Nunito, Space Grotesk) declare only Latin unicode ranges, so Arabic text
 * falls through to the Arabic face beside it — never to a system default.
 */

// next/font reads these options at build time, so each call spells them out
// as a literal (no shared object): swap, never preloaded.
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

/**
 * One `font-family` stack from several loaded fonts: every font's own face
 * first, in order, then their metric-matched fallbacks, then the generic.
 *
 * The order matters. next/font's fallback face for a Latin font is a local
 * Arial/Times with no unicode range — it would draw Arabic if it sat before
 * the Arabic web font. With the real faces first, Arabic always reaches the
 * Arabic face; the fallbacks only stand in while a face is still loading.
 */
export function fontStack(fonts: LoadedFont[], generic: string): string {
  const faces: string[] = [];
  const fallbacks: string[] = [];
  for (const font of fonts) {
    const [face, ...rest] = font.style.fontFamily.split(",").map((name) => name.trim()).filter(Boolean);
    if (face) faces.push(face);
    fallbacks.push(...rest);
  }
  return [...faces, ...fallbacks, generic].join(", ");
}

const SERIF = "ui-serif, Georgia, serif";
const SANS = "ui-sans-serif, system-ui, sans-serif";

/** Heading (`--font-display`) and body (`--font-sans`) per theme. */
export const THEME_FONT_STACKS: Record<StoreThemeKey, { display: string; sans: string }> = {
  elegant: { display: fontStack([cormorant, markazi], SERIF), sans: fontStack([jost, plexArabic], SANS) },
  bold: { display: fontStack([archivo, cairo], SANS), sans: fontStack([archivo, cairo], SANS) },
  minimal: { display: fontStack([alexandria], SANS), sans: fontStack([alexandria], SANS) },
  classic: { display: fontStack([lora, naskh], SERIF), sans: fontStack([sourceSans, almarai], SANS) },
  warm: { display: fontStack([baloo], SANS), sans: fontStack([nunito, rubik], SANS) },
  glass: { display: fontStack([spaceGrotesk, readex], SANS), sans: fontStack([readex], SANS) },
  // Tajawal is the root layout's own face (Arabic and Latin), so it is named, not loaded again.
  uokids: { display: fontStack([baloo], `"Tajawal", ${SANS}`), sans: `"Tajawal", ${SANS}` },
};

/**
 * The stacks as one small stylesheet, rendered once by the store layout. It is
 * keyed by `data-store-theme`, so switching theme in the editor's preview is
 * an attribute change — every theme's stacks are already on the page.
 */
export const THEME_FONT_CSS = (Object.keys(THEME_FONT_STACKS) as StoreThemeKey[])
  .map((key) => {
    const { display, sans } = THEME_FONT_STACKS[key];
    return `.brand-theme[data-store-theme="${key}"]{--font-display:${display};--font-sans:${sans}}`;
  })
  .join("\n");

import { useEffect } from "react";
import { googleFontsHref, type StoreFont } from "@store-builder/api-client";
import { apiBaseUrl } from "@/lib/apiClient";

/**
 * Font pairs the panel offers as one tap: a heading face and a body face from
 * the Google fonts the storefront can already load (api-client
 * endpoints/storeFonts.ts `GOOGLE_FONTS`), every one with Arabic glyphs —
 * Arabic comes first in these stores. Choosing a pair writes the same two
 * references the "any font" selects write (`headingFont` / `bodyFont` as
 * `g:Name`), so it is not a new setting; it works on a theme too, where it
 * goes over the theme's own type.
 */
export interface FontPair {
  key: string;
  heading: string;
  body: string;
  /** The weight the specimen is drawn in — one this family has. */
  weight: number;
}

export const FONT_PAIRS: readonly FontPair[] = [
  { key: "cairo", heading: "Cairo", body: "Cairo", weight: 700 },
  { key: "almarai", heading: "Almarai", body: "Almarai", weight: 700 },
  { key: "plex", heading: "IBM Plex Sans Arabic", body: "IBM Plex Sans Arabic", weight: 600 },
  { key: "messiri", heading: "El Messiri", body: "Tajawal", weight: 700 },
  { key: "amiri", heading: "Amiri", body: "Almarai", weight: 700 },
  { key: "baloo", heading: "Baloo Bhaijaan 2", body: "Almarai", weight: 700 },
  { key: "kufi", heading: "Reem Kufi", body: "Cairo", weight: 600 },
  { key: "lalezar", heading: "Lalezar", body: "Cairo", weight: 400 },
  { key: "readex", heading: "Readex Pro", body: "Readex Pro", weight: 600 },
  { key: "alexandria", heading: "Alexandria", body: "Alexandria", weight: 600 },
];

/** What every card writes in its heading face. */
export const FONT_SPECIMEN = "Aa أب";

/** Arabic text in a Latin-only face falls through to Tajawal, which the dashboard loads. */
const FALLBACK = '"Tajawal", ui-sans-serif, system-ui, sans-serif';

export function googleStack(name: string): string {
  return `"${name}", ${FALLBACK}`;
}

/** The private family name the storefront gives an uploaded font (api-client `fontFamilyName`). */
export function uploadedStack(fontId: string): string {
  return `"zf-${fontId}", ${FALLBACK}`;
}

const LINK_ID = "zimos-font-specimens";
const FACES_ID = "zimos-font-specimen-faces";
const HEX_ID = /^[0-9a-f]{12}$/;
const SAFE_STORE = /^[A-Za-z0-9_-]{1,80}$/;

/**
 * Loads what the font cards need to draw their specimen in the real face:
 *
 *  - the Google families, cut down to the specimen's own letters (`text=`), so
 *    ten families cost a few kilobytes — the dashboard already takes its own
 *    fonts from the same service (index.html);
 *  - the store's uploaded fonts, from the public store API that serves them to
 *    the storefront.
 *
 * Both are left in the page once loaded: reopening the panel draws at once.
 * A face that cannot load falls back to the stack's next family.
 */
export function useFontSpecimens(google: readonly string[], uploaded: readonly StoreFont[], workspaceId: string) {
  const href = googleFontsHref(google);
  const specimenHref = href ? `${href}&text=${encodeURIComponent(FONT_SPECIMEN)}` : null;
  useEffect(() => {
    if (!specimenHref) return;
    let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = LINK_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== specimenHref) link.setAttribute("href", specimenHref);
  }, [specimenHref]);

  const faces = SAFE_STORE.test(workspaceId)
    ? uploaded
        .filter((font) => HEX_ID.test(font.id))
        .map(
          (font) =>
            `@font-face{font-family:"zf-${font.id}";src:url("${apiBaseUrl}/store/${workspaceId}/fonts/${font.id}");font-display:swap}`
        )
        .join("")
    : "";
  useEffect(() => {
    if (!faces) return;
    let style = document.getElementById(FACES_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = FACES_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== faces) style.textContent = faces;
  }, [faces]);
}

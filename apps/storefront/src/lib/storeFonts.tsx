import { fontFamilyName, googleFontsHref, parseFontRef, type FontRef, type PageTree } from "@store-builder/api-client";

/**
 * The store's chosen fonts on its pages (api-client endpoints/storeFonts.ts):
 *
 *   themeSettings.bodyFont / headingFont  the store's body and heading faces,
 *                                          over the theme's own (--font-sans /
 *                                          --font-display)
 *   element style.fontFamily               one element's face (elementStyleExtras.ts)
 *
 * A Google font is loaded with one stylesheet link; an uploaded one with an
 * @font-face pointing at the public store API, which serves it to any domain.
 * Every name reaching CSS comes from parseFontRef's patterns: letters, digits
 * and spaces for a Google name, twelve hex digits for an uploaded font.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");
const SAFE_STORE = /^[A-Za-z0-9_-]{1,80}$/;
// Arabic text in a Latin-only face falls through to Tajawal, which every page declares (app/themeFonts.ts).
const FALLBACK = '"Tajawal", ui-sans-serif, system-ui, sans-serif';

/**
 * Google families this app already serves from its own origin, with every
 * weight the editor offers for them (api-client GOOGLE_FONTS): the faces
 * app/themeFonts.ts declares for the store themes, under their real names. A
 * store or an element that picks one of these needs no stylesheet from Google
 * — the page has the faces already. Keep in step with app/themeFonts.ts: a
 * family that leaves it, or loses a weight there, must leave this list.
 * Tajawal and Plus Jakarta Sans are declared there too, but with fewer weights
 * than the editor offers, so a store that picks them still gets Google's.
 */
const SELF_HOSTED = new Set([
  "Alexandria",
  "Almarai",
  "Baloo Bhaijaan 2",
  "Cairo",
  "IBM Plex Sans Arabic",
  "Jost",
  "Lora",
  "Markazi Text",
  "Noto Naskh Arabic",
  "Nunito",
  "Readex Pro",
  "Rubik",
]);

export function fontStack(ref: FontRef): string {
  return `"${fontFamilyName(ref)}", ${FALLBACK}`;
}

export function storeFontRefs(themeSettings: Record<string, unknown> | null | undefined): { body: FontRef | null; heading: FontRef | null } {
  return { body: parseFontRef(themeSettings?.bodyFont), heading: parseFontRef(themeSettings?.headingFont) };
}

/** The inline variables a chosen body/heading font puts on the store wrapper; empty when none is chosen. */
export function storeFontVars(themeSettings: Record<string, unknown> | null | undefined): Record<string, string> {
  const { body, heading } = storeFontRefs(themeSettings);
  const vars: Record<string, string> = {};
  if (body) vars["--font-sans"] = fontStack(body);
  if (heading) vars["--font-display"] = fontStack(heading);
  return vars;
}

/** Every font the page's elements use, on any device. */
export function treeFontRefs(tree: PageTree | null): FontRef[] {
  const refs: FontRef[] = [];
  for (const section of tree?.sections ?? []) {
    for (const row of section?.rows ?? []) {
      for (const column of row?.columns ?? []) {
        for (const element of column?.elements ?? []) {
          const style = (element.settings as { style?: Record<string, Record<string, unknown> | undefined> } | undefined)?.style;
          if (!style || typeof style !== "object") continue;
          for (const device of ["base", "tablet", "mobile"]) {
            const ref = parseFontRef(style[device]?.fontFamily);
            if (ref) refs.push(ref);
          }
        }
      }
    }
  }
  return refs;
}

/** The Google stylesheet URL and the @font-face rules for some references. */
export function fontAssets(refs: Array<FontRef | null>, store: string): { href: string | null; faces: string } {
  const google = refs
    .filter((r): r is Extract<FontRef, { kind: "google" }> => r?.kind === "google")
    .map((r) => r.name)
    .filter((name) => !SELF_HOSTED.has(name));
  const custom = [...new Set(refs.filter((r): r is Extract<FontRef, { kind: "custom" }> => r?.kind === "custom").map((r) => r.id))];
  const faces = SAFE_STORE.test(store)
    ? custom.map((id) => `@font-face{font-family:"zf-${id}";src:url("${API_BASE}/store/${store}/fonts/${id}");font-display:swap}`).join("")
    : "";
  return { href: googleFontsHref(google), faces };
}

/**
 * Loads the given fonts on the page. Renders nothing when there are none —
 * which is every store that kept its look's own fonts, or picked a family
 * this app serves itself: only a store that really uses a font of Google's
 * opens a connection to Google.
 */
export function FontAssets({ refs, store }: { refs: Array<FontRef | null>; store: string }) {
  const { href, faces } = fontAssets(refs, store);
  if (!href && !faces) return null;
  return (
    <>
      {/* The font files come from a second host; opening that connection now saves a round trip later. */}
      {href && <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />}
      {href && <link rel="stylesheet" href={href} />}
      {/* Built from hex ids and the API base only — see parseFontRef. */}
      {faces && <style dangerouslySetInnerHTML={{ __html: faces }} />}
    </>
  );
}

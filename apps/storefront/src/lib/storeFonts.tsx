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
// Arabic text in a Latin-only face falls through to Tajawal, which the root layout loads.
const FALLBACK = '"Tajawal", ui-sans-serif, system-ui, sans-serif';

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
  const google = refs.filter((r): r is Extract<FontRef, { kind: "google" }> => r?.kind === "google").map((r) => r.name);
  const custom = [...new Set(refs.filter((r): r is Extract<FontRef, { kind: "custom" }> => r?.kind === "custom").map((r) => r.id))];
  const faces = SAFE_STORE.test(store)
    ? custom.map((id) => `@font-face{font-family:"zf-${id}";src:url("${API_BASE}/store/${store}/fonts/${id}");font-display:swap}`).join("")
    : "";
  return { href: googleFontsHref(google), faces };
}

/** Loads the given fonts on the page. Renders nothing when there are none. */
export function FontAssets({ refs, store }: { refs: Array<FontRef | null>; store: string }) {
  const { href, faces } = fontAssets(refs, store);
  if (!href && !faces) return null;
  return (
    <>
      {href && <link rel="stylesheet" href={href} />}
      {/* Built from hex ids and the API base only — see parseFontRef. */}
      {faces && <style dangerouslySetInnerHTML={{ __html: faces }} />}
    </>
  );
}

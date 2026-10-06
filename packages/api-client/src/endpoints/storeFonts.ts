import type { ApiClient } from "../client";

/**
 * Fonts (SPEC §9.3 font family; Lightfunnels' Google and uploaded fonts).
 *
 * A font is referenced by a short string wherever it is used — the store's
 * body and heading fonts (themeSettings.bodyFont / headingFont) and an
 * element's style (style.fontFamily):
 *
 *   g:<Name>  a Google font, e.g. "g:Cairo"
 *   c:<id>    a font the merchant uploaded (backend modules/fonts/storeFonts.js)
 *
 * The storefront turns references into a Google Fonts stylesheet link and
 * @font-face rules for the uploaded ones, served by the public store API.
 */

export interface GoogleFont {
  name: string;
  /** The weights requested from Google; each exists for that family. */
  weights: number[];
  arabic: boolean;
  category: "sans" | "serif" | "display" | "handwriting";
}

/** The Google fonts offered in the editor, Arabic-capable first. */
export const GOOGLE_FONTS: GoogleFont[] = [
  { name: "Cairo", weights: [300, 400, 500, 600, 700, 800], arabic: true, category: "sans" },
  { name: "Tajawal", weights: [300, 400, 500, 700, 800], arabic: true, category: "sans" },
  { name: "Almarai", weights: [300, 400, 700, 800], arabic: true, category: "sans" },
  { name: "IBM Plex Sans Arabic", weights: [300, 400, 500, 600, 700], arabic: true, category: "sans" },
  { name: "Noto Kufi Arabic", weights: [300, 400, 500, 600, 700, 800], arabic: true, category: "sans" },
  { name: "Noto Sans Arabic", weights: [300, 400, 500, 600, 700, 800], arabic: true, category: "sans" },
  { name: "Noto Naskh Arabic", weights: [400, 500, 600, 700], arabic: true, category: "serif" },
  { name: "Readex Pro", weights: [300, 400, 500, 600, 700], arabic: true, category: "sans" },
  { name: "Alexandria", weights: [300, 400, 500, 600, 700, 800], arabic: true, category: "sans" },
  { name: "Rubik", weights: [300, 400, 500, 600, 700, 800], arabic: true, category: "sans" },
  { name: "Vazirmatn", weights: [300, 400, 500, 600, 700, 800], arabic: true, category: "sans" },
  { name: "Mada", weights: [300, 400, 500, 600, 700, 800], arabic: true, category: "sans" },
  { name: "Changa", weights: [300, 400, 500, 600, 700, 800], arabic: true, category: "sans" },
  { name: "Kufam", weights: [400, 500, 600, 700, 800], arabic: true, category: "display" },
  { name: "Reem Kufi", weights: [400, 500, 600, 700], arabic: true, category: "display" },
  { name: "El Messiri", weights: [400, 500, 600, 700], arabic: true, category: "display" },
  { name: "Baloo Bhaijaan 2", weights: [400, 500, 600, 700, 800], arabic: true, category: "display" },
  { name: "Lalezar", weights: [400], arabic: true, category: "display" },
  { name: "Marhey", weights: [300, 400, 500, 600, 700], arabic: true, category: "display" },
  { name: "Amiri", weights: [400, 700], arabic: true, category: "serif" },
  { name: "Markazi Text", weights: [400, 500, 600, 700], arabic: true, category: "serif" },
  { name: "Lateef", weights: [300, 400, 500, 600, 700, 800], arabic: true, category: "serif" },
  { name: "Harmattan", weights: [400, 500, 600, 700], arabic: true, category: "sans" },
  { name: "Aref Ruqaa", weights: [400, 700], arabic: true, category: "handwriting" },
  { name: "Inter", weights: [300, 400, 500, 600, 700, 800], arabic: false, category: "sans" },
  { name: "Poppins", weights: [300, 400, 500, 600, 700, 800], arabic: false, category: "sans" },
  { name: "Montserrat", weights: [300, 400, 500, 600, 700, 800], arabic: false, category: "sans" },
  { name: "Roboto", weights: [300, 400, 500, 700], arabic: false, category: "sans" },
  { name: "Open Sans", weights: [300, 400, 500, 600, 700, 800], arabic: false, category: "sans" },
  { name: "Lato", weights: [300, 400, 700], arabic: false, category: "sans" },
  { name: "Nunito", weights: [300, 400, 500, 600, 700, 800], arabic: false, category: "sans" },
  { name: "Raleway", weights: [300, 400, 500, 600, 700, 800], arabic: false, category: "sans" },
  { name: "Manrope", weights: [300, 400, 500, 600, 700, 800], arabic: false, category: "sans" },
  { name: "Outfit", weights: [300, 400, 500, 600, 700, 800], arabic: false, category: "sans" },
  { name: "Plus Jakarta Sans", weights: [300, 400, 500, 600, 700, 800], arabic: false, category: "sans" },
  { name: "Work Sans", weights: [300, 400, 500, 600, 700, 800], arabic: false, category: "sans" },
  { name: "Jost", weights: [300, 400, 500, 600, 700, 800], arabic: false, category: "sans" },
  { name: "Oswald", weights: [300, 400, 500, 600, 700], arabic: false, category: "display" },
  { name: "Bebas Neue", weights: [400], arabic: false, category: "display" },
  { name: "Playfair Display", weights: [400, 500, 600, 700, 800], arabic: false, category: "serif" },
  { name: "Merriweather", weights: [300, 400, 700], arabic: false, category: "serif" },
  { name: "Lora", weights: [400, 500, 600, 700], arabic: false, category: "serif" },
];

const GOOGLE_NAME = /^[A-Za-z0-9][A-Za-z0-9 ]{1,39}$/;
const CUSTOM_ID = /^[0-9a-f]{12}$/;

export type FontRef = { kind: "google"; name: string } | { kind: "custom"; id: string };

/** A stored reference, or null when it is not one (anything else is ignored, never put in CSS). */
export function parseFontRef(raw: unknown): FontRef | null {
  if (typeof raw !== "string") return null;
  if (raw.startsWith("g:") && GOOGLE_NAME.test(raw.slice(2))) return { kind: "google", name: raw.slice(2) };
  if (raw.startsWith("c:") && CUSTOM_ID.test(raw.slice(2))) return { kind: "custom", id: raw.slice(2) };
  return null;
}

/** The CSS family name of a reference: the Google name, or a private name for an uploaded font. */
export function fontFamilyName(ref: FontRef): string {
  return ref.kind === "google" ? ref.name : `zf-${ref.id}`;
}

/** One Google Fonts stylesheet URL for several families; null when there are none. */
export function googleFontsHref(names: Iterable<string>): string | null {
  const families = [...new Set([...names].filter((n) => GOOGLE_NAME.test(n)))].sort();
  if (families.length === 0) return null;
  const parts = families.map((name) => {
    const known = GOOGLE_FONTS.find((f) => f.name === name);
    const family = name.replace(/ /g, "+");
    // A family outside the list is asked for its regular weight only, which every family has.
    return known && known.weights.length > 1 ? `family=${family}:wght@${known.weights.join(";")}` : `family=${family}`;
  });
  return `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`;
}

// ------------------------------------------------------------- uploads --

export interface StoreFont {
  id: string;
  name: string;
  format: "woff2" | "woff" | "truetype" | "opentype";
  size?: number;
  createdAt?: string;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/fonts`;

/** ApiClient.rawFetch is private to the class (multipart needs it); reached through one typed cast, like catalog.ts. */
function rawFetch(client: ApiClient, path: string, init: RequestInit): Promise<Response> {
  return (client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> }).rawFetch(path, init);
}

export async function storeFontsList(client: ApiClient, workspaceId: string): Promise<StoreFont[]> {
  const { fonts } = await client.request<{ fonts: StoreFont[] }>(base(workspaceId));
  return fonts;
}

/** A WOFF2, WOFF, TTF or OTF file of at most 2MB, under the name the editor shows. */
export async function storeFontsUpload(client: ApiClient, workspaceId: string, file: File, name: string): Promise<StoreFont> {
  const form = new FormData();
  form.append("name", name);
  form.append("file", file, file.name);
  const res = await rawFetch(client, base(workspaceId), { method: "POST", body: form });
  const body = (await res.json()) as { font: StoreFont };
  return body.font;
}

export async function storeFontsDelete(client: ApiClient, workspaceId: string, fontId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/${fontId}`, { method: "DELETE" });
}

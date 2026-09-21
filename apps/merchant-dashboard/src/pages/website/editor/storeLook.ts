import type { Workspace } from "@store-builder/api-client";
import { normalizeHex } from "@/lib/brandColors";
import type { PreviewTheme } from "@/lib/previewBridge";

/**
 * The store's look as the website editor's "Store look" panel edits it. It is
 * workspace-wide, not per page: the colours live in `themeSettings` beside the
 * keys the Settings page already writes (`primaryColor` / `secondaryColor`,
 * see lib/brandColors.ts), the logo is the workspace's own `logoUrl`.
 *
 * The storefront reads every key here in apps/storefront/src/lib/brandTheme.ts
 * — the option keys below must match THEME_FONTS / THEME_RADII there.
 */

export type FontKey = "classic" | "modern" | "tajawal" | "system";
export type RadiusKey = "sharp" | "soft" | "round";

export interface StoreLook {
  /** Null while the store has never saved one — the storefront's own default applies. */
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: FontKey;
  cornerRadius: RadiusKey;
  logoUrl: string | null;
}

/** Font pairings, each drawn in its own face in the panel. Only fonts the storefront already loads. */
export const FONT_OPTIONS: Array<{ value: FontKey; heading: string; body: string }> = [
  { value: "classic", heading: '"Fraunces", "Tajawal", serif', body: '"Plus Jakarta Sans", "Tajawal", sans-serif' },
  { value: "modern", heading: '"Plus Jakarta Sans", "Tajawal", sans-serif', body: '"Plus Jakarta Sans", "Tajawal", sans-serif' },
  { value: "tajawal", heading: '"Tajawal", sans-serif', body: '"Tajawal", sans-serif' },
  { value: "system", heading: 'ui-sans-serif, system-ui, "Segoe UI", "Tajawal", sans-serif', body: 'ui-sans-serif, system-ui, "Segoe UI", "Tajawal", sans-serif' },
];

/** Corner options with the card radius each one gives, for the panel's swatch. */
export const RADIUS_OPTIONS: Array<{ value: RadiusKey; radius: string }> = [
  { value: "sharp", radius: "0.25rem" },
  { value: "soft", radius: "0.625rem" },
  { value: "round", radius: "1.25rem" },
];

/**
 * Ready-made colour pairs. Starting points only — the merchant can still pick
 * any colour for either. `nile` is the platform default pair.
 */
export const PALETTES: Array<{ key: string; primary: string; secondary: string }> = [
  { key: "nile", primary: "#1F5D5B", secondary: "#E2A33D" },
  { key: "midnight", primary: "#1E40AF", secondary: "#F59E0B" },
  { key: "rose", primary: "#BE123C", secondary: "#F4B400" },
  { key: "forest", primary: "#166534", secondary: "#CA8A04" },
  { key: "violet", primary: "#6D28D9", secondary: "#EC4899" },
  { key: "ocean", primary: "#0E7490", secondary: "#FB923C" },
  { key: "charcoal", primary: "#1F2937", secondary: "#D97706" },
];

const FONT_KEYS = new Set<string>(FONT_OPTIONS.map((o) => o.value));
const RADIUS_KEYS = new Set<string>(RADIUS_OPTIONS.map((o) => o.value));

export function readStoreLook(workspace: Pick<Workspace, "themeSettings" | "logoUrl"> | null): StoreLook {
  const ts = workspace?.themeSettings ?? {};
  const color = (key: string) => (typeof ts[key] === "string" ? normalizeHex(ts[key] as string) : null);
  const font = typeof ts.fontFamily === "string" && FONT_KEYS.has(ts.fontFamily) ? (ts.fontFamily as FontKey) : "classic";
  const radius =
    typeof ts.cornerRadius === "string" && RADIUS_KEYS.has(ts.cornerRadius) ? (ts.cornerRadius as RadiusKey) : "soft";
  return {
    primaryColor: color("primaryColor"),
    secondaryColor: color("secondaryColor"),
    fontFamily: font,
    cornerRadius: radius,
    logoUrl: workspace?.logoUrl ?? null,
  };
}

/** What the preview frame lays over the saved look. Unset colours stay unset. */
export function lookToPreview(look: StoreLook): PreviewTheme {
  return {
    ...(look.primaryColor ? { primaryColor: look.primaryColor } : {}),
    ...(look.secondaryColor ? { secondaryColor: look.secondaryColor } : {}),
    fontFamily: look.fontFamily,
    cornerRadius: look.cornerRadius,
    logoUrl: look.logoUrl,
  };
}

/**
 * The PATCH body for a changed look. `themeSettings` is merged, never
 * replaced — it is a shared blob other parts of the product write to too
 * (Settings, the product page countdown, the store language).
 */
export function lookToWorkspacePatch(
  existing: Record<string, unknown> | undefined,
  look: StoreLook
): { logoUrl: string | null; themeSettings: Record<string, unknown> } {
  const themeSettings: Record<string, unknown> = {
    ...(existing ?? {}),
    fontFamily: look.fontFamily,
    cornerRadius: look.cornerRadius,
  };
  if (look.primaryColor) themeSettings.primaryColor = look.primaryColor;
  if (look.secondaryColor) themeSettings.secondaryColor = look.secondaryColor;
  return { logoUrl: look.logoUrl, themeSettings };
}

export function sameLook(a: StoreLook, b: StoreLook): boolean {
  return (
    a.primaryColor === b.primaryColor &&
    a.secondaryColor === b.secondaryColor &&
    a.fontFamily === b.fontFamily &&
    a.cornerRadius === b.cornerRadius &&
    a.logoUrl === b.logoUrl
  );
}

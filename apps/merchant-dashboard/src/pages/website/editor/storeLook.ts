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

/** The panel's own cap on how many rotating lines a merchant can add. */
export const MAX_ANNOUNCEMENT_MESSAGES = 5;

/**
 * The store-wide announcement bar, as this panel edits it. Saved to
 * `themeSettings.header.announcement` in the shape
 * apps/storefront/src/lib/storeAnnouncement.ts's `announcementOf` reads
 * (`text` / `messages` / `href` / `background` / `color`) — see
 * `announcementPatch` below for the exact translation.
 */
export interface StoreAnnouncementLook {
  enabled: boolean;
  /** One or more lines, in rotation order. Never empty while `enabled` survives a save — see `announcementPatch`. */
  messages: string[];
  href: string | null;
  background: string | null;
  color: string | null;
}

export interface StoreLook {
  /** Null while the store has never saved one — the storefront's own default applies. */
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: FontKey;
  cornerRadius: RadiusKey;
  logoUrl: string | null;
  announcement: StoreAnnouncementLook;
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
  const header = ts.header && typeof ts.header === "object" ? (ts.header as Record<string, unknown>) : {};
  return {
    primaryColor: color("primaryColor"),
    secondaryColor: color("secondaryColor"),
    fontFamily: font,
    cornerRadius: radius,
    logoUrl: workspace?.logoUrl ?? null,
    announcement: readAnnouncement(header.announcement),
  };
}

/**
 * Reads a saved `header.announcement` into the panel's editing shape. Mirrors
 * `announcementOf`'s own parsing (an array `messages`, or `text` written as an
 * array, or a single `text`) so a bar saved by a hand-edited workspace, or
 * written some other way, still opens with its lines in place. Missing or
 * malformed input reads as the untouched default: disabled, no messages.
 */
function readAnnouncement(raw: unknown): StoreAnnouncementLook {
  const empty: StoreAnnouncementLook = { enabled: false, messages: [], href: null, background: null, color: null };
  if (!raw || typeof raw !== "object") return empty;
  const a = raw as Record<string, unknown>;

  const rawList = Array.isArray(a.messages) ? a.messages : Array.isArray(a.text) ? a.text : null;
  const fromList = rawList
    ?.filter((m): m is string => typeof m === "string")
    .map((m) => m.trim())
    .filter((m) => m !== "");
  const single = typeof a.text === "string" && a.text.trim() ? [a.text.trim()] : [];
  const messages = fromList && fromList.length > 0 ? fromList : single;

  return {
    // Absent is treated as on, same as `announcementOf` — only an explicit
    // `false` turns it off. A save always writes the key explicitly (see
    // `announcementPatch`), so this only matters for hand-edited data.
    enabled: a.enabled !== false,
    messages,
    href: typeof a.href === "string" && a.href.trim() ? a.href.trim() : null,
    background: typeof a.background === "string" ? normalizeHex(a.background) : null,
    color: typeof a.color === "string" ? normalizeHex(a.color) : null,
  };
}

/**
 * What the preview frame lays over the saved look. Unset colours stay unset.
 *
 * Deliberately silent on `look.announcement`: `PreviewTheme` (this file and
 * its storefront-side twin in brandTheme.ts) only ever carries colours, font,
 * corners and the logo — the two apps share no code, so adding a field here
 * would do nothing until the storefront's `readPreviewTheme` / `PreviewBridge`
 * learned to apply it too. An unsaved announcement-bar edit previews only
 * after a real save and reload; see StoreLookPanel's module doc.
 */
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

  const existingHeader =
    existing?.header && typeof existing.header === "object" ? (existing.header as Record<string, unknown>) : {};
  themeSettings.header = { ...existingHeader, announcement: announcementPatch(look.announcement) };

  return { logoUrl: look.logoUrl, themeSettings };
}

/**
 * The saved shape of `header.announcement`, matching exactly what
 * `announcementOf` in apps/storefront/src/lib/storeAnnouncement.ts expects:
 * `text` for the first (or only) message, `messages` added only when there
 * are genuinely two or more, `href`/`background`/`color` left out entirely
 * when unset (so `announcementOf`'s own optional-field reads see them as
 * absent, exactly as if this bar had never been touched).
 *
 * Turning the bar on with every message left blank is not a state a save can
 * represent as "on" — `announcementOf` would have nothing to show — so it is
 * written as `enabled: false` instead of being refused. The panel warns about
 * this before the merchant saves (see StoreLookPanel's blank-messages hint).
 */
function announcementPatch(a: StoreAnnouncementLook): Record<string, unknown> {
  const messages = a.messages.map((m) => m.trim()).filter((m) => m !== "");
  const patch: Record<string, unknown> = { enabled: a.enabled && messages.length > 0 };
  if (messages.length > 0) {
    patch.text = messages[0];
    if (messages.length > 1) patch.messages = messages;
  }
  if (a.href) patch.href = a.href;
  if (a.background) patch.background = a.background;
  if (a.color) patch.color = a.color;
  return patch;
}

function sameAnnouncement(a: StoreAnnouncementLook, b: StoreAnnouncementLook): boolean {
  return (
    a.enabled === b.enabled &&
    a.href === b.href &&
    a.background === b.background &&
    a.color === b.color &&
    a.messages.length === b.messages.length &&
    a.messages.every((m, i) => m === b.messages[i])
  );
}

export function sameLook(a: StoreLook, b: StoreLook): boolean {
  return (
    a.primaryColor === b.primaryColor &&
    a.secondaryColor === b.secondaryColor &&
    a.fontFamily === b.fontFamily &&
    a.cornerRadius === b.cornerRadius &&
    a.logoUrl === b.logoUrl &&
    sameAnnouncement(a.announcement, b.announcement)
  );
}

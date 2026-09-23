import type { StorefrontMeta } from "@store-builder/api-client";

/** A line the merchant wants above the header, optionally a link. */
export interface StoreAnnouncement {
  text: string;
  href: string | null;
  /** The merchant's own colours for the bar, when they set them. */
  background: string | null;
  color: string | null;
}

/**
 * The announcement bar, read from the public store payload and from nowhere
 * else. Two places it may sit, both merchant-authored:
 *
 *  - `store.settings.announcement` `{ text, href? }` — the plain shape;
 *  - `store.themeSettings.header.announcement` `{ text, href, enabled, … }` —
 *    what the website editor's header panel saves today.
 *
 * Anything missing, disabled or empty yields null and the bar is not drawn:
 * there is no placeholder copy to fall back to.
 */
export function announcementOf(store: StorefrontMeta): StoreAnnouncement | null {
  const withSettings = store as StorefrontMeta & { settings?: Record<string, unknown> };
  const header = store.themeSettings?.header;
  const candidates: unknown[] = [
    withSettings.settings?.announcement,
    header && typeof header === "object" ? (header as Record<string, unknown>).announcement : undefined,
  ];

  for (const raw of candidates) {
    if (!raw || typeof raw !== "object") continue;
    const a = raw as Record<string, unknown>;
    if (a.enabled === false) continue;
    const text = typeof a.text === "string" ? a.text.trim() : "";
    if (!text) continue;
    const href = typeof a.href === "string" && a.href.trim() ? a.href.trim() : null;
    return {
      text,
      href,
      background: hexOrNull(a.background),
      color: hexOrNull(a.color),
    };
  }
  return null;
}

/** Only a plain hex colour is applied inline; anything else falls back to the theme. */
function hexOrNull(value: unknown): string | null {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : null;
}

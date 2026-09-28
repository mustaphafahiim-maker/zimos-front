import type { StorefrontMeta } from "@store-builder/api-client";

/** A line the merchant wants above the header, optionally a link. */
export interface StoreAnnouncement {
  /** The first (or only) message. Always set, even when `messages` is too. */
  text: string;
  /**
   * More than one message to rotate through, `text` first — set only when
   * there genuinely are two or more, so the common single-message case (all
   * the website editor writes today) stays exactly the shape it always was.
   * Read from either `text` or `messages` being an array on the raw payload;
   * see `announcementOf` below.
   */
  messages?: string[];
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

    // Several lines to rotate through: either `messages: string[]` (additive,
    // alongside a plain `text`) or `text` itself written as an array. Neither
    // shape is written by today's editor — it only ever saves one string —
    // but a payload set some other way (a future editor field, a hand-edited
    // workspace) is read and rotated all the same.
    const rawList = Array.isArray(a.messages) ? a.messages : Array.isArray(a.text) ? a.text : null;
    const messages = rawList
      ?.map((m) => (typeof m === "string" ? m.trim() : ""))
      .filter((m) => m !== "");

    const text = messages?.[0] ?? (typeof a.text === "string" ? a.text.trim() : "");
    if (!text) continue;

    const href = typeof a.href === "string" && a.href.trim() ? a.href.trim() : null;
    return {
      text,
      messages: messages && messages.length > 1 ? messages : undefined,
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

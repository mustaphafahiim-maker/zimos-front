import type { SocialLinkConfig } from "./links";

/**
 * ZIMOS's own accounts, shown by <SocialLinks /> in the marketing footer, on
 * the marketing contact page and on the dashboard's support page. This file
 * is the one place to change them: edit `url`, flip `enabled`, or renumber
 * `order` (lowest first).
 *
 * `email` takes a `mailto:` address only; every other platform takes an
 * `https://` link on that platform's own domain, and a wa.me link must hold
 * a valid international number (see `socialHref` in links.ts). An entry
 * that breaks a rule is skipped, never rendered.
 *
 * Everything here is public: it ships in the pages and sits in this repo.
 */
export const SOCIAL_LINKS: readonly SocialLinkConfig[] = [
  { platform: "instagram", url: "https://instagram.com/zimos.co", enabled: true, order: 1 },
  { platform: "facebook", url: "https://facebook.com/zimos.co", enabled: true, order: 2 },
  { platform: "tiktok", url: "https://www.tiktok.com/@zimos.co", enabled: true, order: 3 },
  { platform: "whatsapp", url: "https://wa.me/201501921444", enabled: true, order: 4 },
  { platform: "x", url: "https://x.com/ZimosCo", enabled: true, order: 5 },
  { platform: "email", url: "mailto:zimossupport@gmail.com", enabled: true, order: 6 },
];

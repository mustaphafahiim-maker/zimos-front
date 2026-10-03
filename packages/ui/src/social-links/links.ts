/**
 * The rules behind <SocialLinks />: which entries are shown, in what order,
 * with which link and which accessible name. No React here, so the same
 * rules can check a list that later comes from the API.
 */

export const SOCIAL_PLATFORMS = ["instagram", "facebook", "tiktok", "x", "whatsapp", "email"] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type SocialLocale = "ar" | "en";

/** One entry of the config (config.ts), or of a list from the API later. */
export interface SocialLinkConfig {
  platform: SocialPlatform;
  /** `mailto:` for `email`, `https://` for everything else. `null` = no link yet. */
  url: string | null;
  enabled: boolean;
  /** Lowest first; equal values keep the list's order. */
  order: number;
}

/** An entry that passed every rule, ready to render. */
export interface SocialLinkItem {
  platform: SocialPlatform;
  href: string;
  /** Opens in a new tab: every link except `mailto:`. */
  external: boolean;
}

/**
 * The domains each platform's link may point at: the domain itself or one of
 * its subdomains (`www.`, `m.`). A link elsewhere is skipped, so a typo or a
 * lookalike domain never sits behind a platform's icon.
 */
const PLATFORM_DOMAINS: Record<Exclude<SocialPlatform, "email">, readonly string[]> = {
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com"],
  tiktok: ["tiktok.com"],
  x: ["x.com", "twitter.com"],
  whatsapp: ["wa.me", "whatsapp.com"],
};

/**
 * A wa.me chat link: the number in international form with no `+`, leading
 * zero, spaces or dashes (country code first, 8–15 digits in all), and at
 * most a prefilled `text`.
 */
function isWaMeChat(url: URL): boolean {
  return /^\/[1-9][0-9]{7,14}$/.test(url.pathname) && !url.hash && [...url.searchParams.keys()].every((key) => key === "text");
}

/** One plain address: no display name, no second recipient, no headers, nothing percent-encoded. */
const EMAIL_ADDRESS = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

/** Browsers drop some of these before reading a URL's scheme, so a link that holds one is refused outright. */
function hasSpaceOrControl(value: string): boolean {
  return /\s/.test(value) || [...value].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f);
}

export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return typeof value === "string" && (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

/**
 * The link to render for `platform`, or `null` when there's nothing safe to
 * render: `email` accepts `mailto:` with one address and nothing else; every
 * other platform accepts `https:` on its own domain, with no user, password
 * or port, and a wa.me link must hold a valid number. Anything else —
 * `http:`, `javascript:`, `data:`, a relative path — is `null`.
 */
export function socialHref(platform: unknown, url: unknown): string | null {
  if (!isSocialPlatform(platform) || typeof url !== "string") return null;
  const value = url.trim();
  if (!value || hasSpaceOrControl(value)) return null;

  if (platform === "email") {
    const match = /^mailto:(.+)$/i.exec(value);
    return match && EMAIL_ADDRESS.test(match[1]) ? `mailto:${match[1]}` : null;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return null;
  const host = parsed.hostname.toLowerCase();
  const isOn = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (!PLATFORM_DOMAINS[platform].some(isOn)) return null;
  if (isOn("wa.me") && !isWaMeChat(parsed)) return null;
  return parsed.href;
}

const rank = (order: unknown) => (typeof order === "number" && Number.isFinite(order) ? order : Number.POSITIVE_INFINITY);

/**
 * The entries to show, in order: enabled, with a link that passes
 * `socialHref`, one per platform (the first by order wins). Anything that
 * isn't a list gives `[]`.
 */
export function visibleSocialLinks(links: readonly SocialLinkConfig[] | null | undefined): SocialLinkItem[] {
  if (!Array.isArray(links)) return [];
  const seen = new Set<SocialPlatform>();
  return links
    .map((link: SocialLinkConfig | null | undefined, index) => ({ link, index }))
    .filter(({ link }) => link?.enabled === true)
    .sort((a, b) => rank(a.link?.order) - rank(b.link?.order) || a.index - b.index)
    .flatMap(({ link }) => {
      if (!link) return [];
      const href = socialHref(link.platform, link.url);
      if (!href || seen.has(link.platform)) return [];
      seen.add(link.platform);
      return [{ platform: link.platform, href, external: link.platform !== "email" }];
    });
}

const PLATFORM_LABELS: Record<SocialLocale, Record<SocialPlatform, string>> = {
  ar: {
    instagram: "ZIMOS على إنستغرام",
    facebook: "ZIMOS على فيسبوك",
    tiktok: "ZIMOS على تيك توك",
    x: "ZIMOS على إكس",
    whatsapp: "ZIMOS على واتساب",
    email: "راسل ZIMOS عبر البريد الإلكتروني",
  },
  en: {
    instagram: "ZIMOS on Instagram",
    facebook: "ZIMOS on Facebook",
    tiktok: "ZIMOS on TikTok",
    x: "ZIMOS on X",
    whatsapp: "ZIMOS on WhatsApp",
    email: "Email ZIMOS",
  },
};

const NEW_TAB: Record<SocialLocale, string> = {
  ar: "يفتح في علامة تبويب جديدة",
  en: "opens in a new tab",
};

const LIST_LABEL: Record<SocialLocale, string> = {
  ar: "حسابات ZIMOS",
  en: "ZIMOS accounts",
};

/** The link's accessible name; links that open a new tab say so. */
export function socialLinkLabel(item: Pick<SocialLinkItem, "platform" | "external">, locale: SocialLocale): string {
  const label = PLATFORM_LABELS[locale][item.platform];
  return item.external ? `${label} (${NEW_TAB[locale]})` : label;
}

/** The list's accessible name. */
export function socialListLabel(locale: SocialLocale): string {
  return LIST_LABEL[locale];
}

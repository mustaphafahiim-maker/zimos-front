// Imported as `@store-builder/ui/platform-info`, apart from the package's main
// entry, like `social-links`: no React and no dependency, so the marketing
// site's server and the dashboard can both read it.

import { SOCIAL_LINKS } from "../social-links/config";
import { isSocialPlatform, type SocialLinkConfig, type SocialLocale } from "../social-links/links";

/**
 * The platform's public details as the console saved them (the API's
 * GET /platform-settings/public, PLATFORM_SETTINGS_ENABLED). Each group is
 * `null` until it is saved — or when the API can't be reached, is off, or
 * answers oddly — and the site then shows the values in its own code, as it
 * always did. Text is plain text: render it as text, never as HTML.
 */
export interface LocalizedText {
  ar: string;
  en: string;
}

export interface PlatformContact {
  supportEmail: string | null;
  /** International form, e.g. `+201012345678`. */
  phone: string | null;
  address: LocalizedText;
  hours: LocalizedText;
}

export interface PlatformCompany {
  platformName: string;
  legalName: LocalizedText;
  registration: LocalizedText;
  taxRegistration: string | null;
}

export interface PlatformFooter {
  tagline: LocalizedText;
  rights: LocalizedText;
}

export interface PublicPlatformSettings {
  contact: PlatformContact | null;
  social: { links: SocialLinkConfig[] } | null;
  company: PlatformCompany | null;
  footer: PlatformFooter | null;
}

/** The public endpoint, under the API's base (`…/api/v1`). */
export const PLATFORM_SETTINGS_PATH = "/platform-settings/public";

/** Longer than anything the API accepts: an answer past it is not the API's. */
const MAX_TEXT = 1000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === "string" && value.length <= MAX_TEXT ? value : null);
const filled = (value: unknown): string | null => {
  const t = text(value);
  return t && t.trim() ? t : null;
};
const optional = (value: unknown): string | null | undefined => (value === null ? null : (filled(value) ?? undefined));

function localized(value: unknown): LocalizedText | null {
  if (!isRecord(value)) return null;
  const ar = filled(value.ar);
  const en = filled(value.en);
  return ar && en ? { ar, en } : null;
}

function contactOf(value: unknown): PlatformContact | null {
  if (!isRecord(value)) return null;
  const address = localized(value.address);
  const hours = localized(value.hours);
  const supportEmail = optional(value.supportEmail);
  const phone = optional(value.phone);
  if (!address || !hours || supportEmail === undefined || phone === undefined) return null;
  return { supportEmail, phone, address, hours };
}

function socialOf(value: unknown): { links: SocialLinkConfig[] } | null {
  if (!isRecord(value) || !Array.isArray(value.links)) return null;
  const links = value.links.flatMap((link, index): SocialLinkConfig[] => {
    if (!isRecord(link) || !isSocialPlatform(link.platform) || typeof link.enabled !== "boolean") return [];
    const url = link.url === null ? null : text(link.url);
    const order = typeof link.order === "number" && Number.isFinite(link.order) ? link.order : index + 1;
    return [{ platform: link.platform, url, enabled: link.enabled, order }];
  });
  return { links };
}

function companyOf(value: unknown): PlatformCompany | null {
  if (!isRecord(value)) return null;
  const platformName = filled(value.platformName);
  const legalName = localized(value.legalName);
  const registration = localized(value.registration);
  const taxRegistration = optional(value.taxRegistration);
  if (!platformName || !legalName || !registration || taxRegistration === undefined) return null;
  return { platformName, legalName, registration, taxRegistration };
}

function footerOf(value: unknown): PlatformFooter | null {
  if (!isRecord(value)) return null;
  const tagline = localized(value.tagline);
  const rights = localized(value.rights);
  return tagline && rights ? { tagline, rights } : null;
}

/**
 * The API's answer, read defensively: a group without the expected shape is
 * `null`, so the site falls back to its own values for that group alone.
 * Anything that isn't an answer at all gives `null`.
 */
export function parsePublicPlatformSettings(body: unknown): PublicPlatformSettings | null {
  if (!isRecord(body) || !isRecord(body.settings)) return null;
  const s = body.settings;
  return { contact: contactOf(s.contact), social: socialOf(s.social), company: companyOf(s.company), footer: footerOf(s.footer) };
}

/**
 * Reads the public settings, or `null` on any failure — the API off (404),
 * down, slow (`timeoutMs`) or answering oddly. Never throws, so a page always
 * renders with its own values. `init` goes to fetch as it is (the marketing
 * site passes Next's `next: { revalidate }`).
 */
export async function fetchPublicPlatformSettings(
  apiBaseUrl: string,
  { timeoutMs = 3000, init = {} }: { timeoutMs?: number; init?: Record<string, unknown> } = {}
): Promise<PublicPlatformSettings | null> {
  try {
    const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${PLATFORM_SETTINGS_PATH}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    } as RequestInit);
    if (!res.ok) return null;
    return parsePublicPlatformSettings(await res.json());
  } catch {
    return null;
  }
}

/** The social links to show: the saved list, or the one in the code (SOCIAL_LINKS). */
export function socialLinksOf(settings: PublicPlatformSettings | null | undefined): readonly SocialLinkConfig[] {
  return settings?.social?.links ?? SOCIAL_LINKS;
}

/** One language of a saved text, or `fallback` (the site's own words). */
export function textIn(value: LocalizedText | null | undefined, locale: SocialLocale, fallback: string): string {
  return value?.[locale] ?? fallback;
}

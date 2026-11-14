import { SOCIAL_PLATFORMS, type SocialPlatform } from "@store-builder/ui/social-links";
import type { Localized, SettingsGroup, SettingsValues, SocialLinkSetting } from "@/lib/platformSettingsApi";

/**
 * The Platform settings form's own checks: the API's rules
 * (backend modules/platformSettings/rules.js), run before saving so a mistake
 * is shown on its field at once. The API checks everything again; the domain
 * allowlist comes from the API itself (`rules.socialDomains`), so the two
 * never disagree on it.
 */

/** A field's problem: a key of the page's strings, and what fills it. */
export interface FieldError {
  key:
    | "err_required"
    | "err_tooLong"
    | "err_html"
    | "err_email"
    | "err_phone"
    | "err_senderName"
    | "err_needsUrl"
    | "err_scheme"
    | "err_mailto"
    | "err_domain"
    | "err_credentials"
    | "err_spaces"
    | "err_waNumber"
    | "err_waQuery"
    | "err_invalid";
  params?: Record<string, string | number>;
}

/** Field path (`address.ar`, `links.whatsapp`) → its problem. Empty: the group can be saved. */
export type FieldErrors = Record<string, FieldError>;

export interface FormRules {
  socialDomains: Partial<Record<SocialPlatform, string[]>>;
  limits: Record<string, number>;
}

const EMAIL = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const HTML_TAG = /<[^>]*>/;

function text(errors: FieldErrors, path: string, value: string, max: number, required = true) {
  const v = value.trim();
  if (required && !v) errors[path] = { key: "err_required" };
  else if (HTML_TAG.test(v)) errors[path] = { key: "err_html" };
  else if (v.length > max) errors[path] = { key: "err_tooLong", params: { max } };
}

function localized(errors: FieldErrors, path: string, value: Localized, max: number, required = true) {
  text(errors, `${path}.ar`, value.ar, max, required);
  text(errors, `${path}.en`, value.en, max, required);
}

/** Why a link can't be saved for `platform`, or null when it can. */
export function linkError(platform: SocialPlatform, raw: string, rules: FormRules): FieldError | null {
  const value = raw.trim();
  if (/\s/.test(value)) return { key: "err_spaces" };
  if (platform === "email") {
    const match = /^mailto:(.+)$/i.exec(value);
    return match && EMAIL.test(match[1]) ? null : { key: "err_mailto" };
  }
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  if (!scheme || scheme[1].toLowerCase() !== "https") return { key: "err_scheme" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { key: "err_invalid" };
  }
  if (url.username || url.password || url.port) return { key: "err_credentials" };
  const domains = rules.socialDomains[platform] ?? [];
  const host = url.hostname.toLowerCase();
  if (!domains.some((d) => host === d || host.endsWith(`.${d}`))) return { key: "err_domain", params: { domains: domains.join(", ") } };
  if (platform === "whatsapp") {
    if (!/^\/[1-9][0-9]{7,14}$/.test(url.pathname)) return { key: "err_waNumber" };
    let onlyText = true;
    url.searchParams.forEach((_, key) => {
      if (key !== "text") onlyText = false;
    });
    if (url.hash || !onlyText) return { key: "err_waQuery" };
  }
  return null;
}

const limit = (rules: FormRules, name: string, fallback: number) => rules.limits[name] ?? fallback;

export function validateGroup<G extends SettingsGroup>(group: G, value: SettingsValues[G], rules: FormRules): FieldErrors {
  const errors: FieldErrors = {};
  if (group === "contact") {
    const v = value as SettingsValues["contact"];
    const email = v.supportEmail.trim();
    if (!email) errors.supportEmail = { key: "err_required" };
    else if (!EMAIL.test(email) || email.length > limit(rules, "email", 254)) errors.supportEmail = { key: "err_email" };
    const digits = v.phone.replace(/[\s().-]/g, "").replace(/^\+/, "");
    if (!v.phone.trim()) errors.phone = { key: "err_required" };
    else if (!/^[0-9]{8,15}$/.test(digits)) errors.phone = { key: "err_phone" };
    localized(errors, "address", v.address, limit(rules, "address", 200));
    localized(errors, "hours", v.hours, limit(rules, "hours", 80));
  } else if (group === "social") {
    for (const link of (value as SettingsValues["social"]).links) {
      const url = (link.url ?? "").trim();
      if (!url) {
        if (link.enabled) errors[`links.${link.platform}`] = { key: "err_needsUrl" };
        continue;
      }
      const problem = url.length > limit(rules, "url", 500) ? { key: "err_tooLong" as const, params: { max: limit(rules, "url", 500) } } : linkError(link.platform, url, rules);
      if (problem) errors[`links.${link.platform}`] = problem;
    }
  } else if (group === "company") {
    const v = value as SettingsValues["company"];
    text(errors, "platformName", v.platformName, limit(rules, "platformName", 60));
    localized(errors, "legalName", v.legalName, limit(rules, "legalName", 120));
    localized(errors, "registration", v.registration, limit(rules, "registration", 80));
    text(errors, "taxRegistration", v.taxRegistration, limit(rules, "taxRegistration", 40));
  } else if (group === "footer") {
    const v = value as SettingsValues["footer"];
    localized(errors, "tagline", v.tagline, limit(rules, "tagline", 160));
    localized(errors, "rights", v.rights, limit(rules, "rights", 120));
  } else if (group === "email") {
    const v = value as SettingsValues["email"];
    text(errors, "senderName", v.senderName, limit(rules, "senderName", 70));
    if (!errors.senderName && /["<>\r\n]/.test(v.senderName)) errors.senderName = { key: "err_senderName" };
    localized(errors, "signature", v.signature, limit(rules, "signature", 500), false);
  }
  return errors;
}

/**
 * The social rows the form edits: the saved list in its order, then every
 * other platform the API accepts, off and empty, so any of them can be turned
 * on.
 */
export function socialRows(links: SocialLinkSetting[], platforms: readonly SocialPlatform[] = SOCIAL_PLATFORMS): SocialLinkSetting[] {
  const listed = links.filter((link, i) => links.findIndex((l) => l.platform === link.platform) === i);
  const missing = platforms.filter((p) => !listed.some((l) => l.platform === p)).map((platform) => ({ platform, url: null, enabled: false }));
  return [...listed.map((l) => ({ ...l })), ...missing];
}

/** The top-level fields whose value differs, as the API names them in its history. */
export function changedFields(before: object, after: object): string[] {
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key])).sort();
}

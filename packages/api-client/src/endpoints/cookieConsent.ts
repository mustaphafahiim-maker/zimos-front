import type { ApiClient } from "../client";

/**
 * Cookie consent (backend marketing/cookieConsent.js, frontend-handoff 196).
 *
 *   off      no banner — the store as it always was (the default);
 *   notice   a banner that informs, with one "OK"; tracking runs as usual;
 *   opt_in   "Ask first": the browser pixels, GTM and Clarity wait for the
 *            shopper's "Accept", and the server sends nothing to the ad
 *            platforms for a shopper who did not accept. `countries` limits
 *            who is asked (null = everyone; an unknown country is asked).
 *
 * Dashboard (permission website.edit):
 *   GET /workspaces/:ws/cookie-consent → CookieConsentSettings
 *   PUT same, body CookieConsentSettings → same
 *   (message ≤ 500 characters, buttons ≤ 40; policyUrl https://… or a store
 *   path such as /policies/privacy-policy; an empty `countries` list is null).
 *
 * Storefront: GET /store/:ws → `store.cookieConsent`, `{ mode: "off" }` or the
 * full block. The shopper's choice rides on the event batches as
 * `consent: { marketing }` and on the checkout as `trackingConsent`.
 */

export type CookieConsentMode = "off" | "notice" | "opt_in";
export const COOKIE_CONSENT_MODES: readonly CookieConsentMode[] = ["off", "notice", "opt_in"];

export type CookieConsentLocale = "ar" | "en" | "fr";
export const COOKIE_CONSENT_LOCALES: readonly CookieConsentLocale[] = ["ar", "en", "fr"];

/** The merchant's own wording for one language; a missing or empty one shows the store's default. */
export interface CookieConsentTexts {
  message?: string;
  accept?: string;
  reject?: string;
}

export interface CookieConsentSettings {
  mode: CookieConsentMode;
  /** Two-letter country codes asked under opt_in; null = everyone. */
  countries: string[] | null;
  policyUrl: string | null;
  texts: Partial<Record<CookieConsentLocale, CookieConsentTexts>>;
}

/** Server limits (cookieConsent.js). */
export const COOKIE_CONSENT_LIMITS = { message: 500, button: 40, countries: 250 } as const;

export function cookieConsentGet(client: ApiClient, workspaceId: string): Promise<CookieConsentSettings> {
  return client.request<CookieConsentSettings>(`/workspaces/${workspaceId}/cookie-consent`);
}

export function cookieConsentSave(
  client: ApiClient,
  workspaceId: string,
  body: CookieConsentSettings
): Promise<CookieConsentSettings> {
  return client.request<CookieConsentSettings>(`/workspaces/${workspaceId}/cookie-consent`, { method: "PUT", body });
}

/** A policy link the API takes: a store path ("/policies/privacy-policy") or an https:// address. */
export function isCookiePolicyUrl(value: string): boolean {
  const v = value.trim();
  if (/^\/[^\s]{0,300}$/.test(v)) return true;
  try {
    const url = new URL(v);
    return url.protocol === "https:" && !!url.hostname;
  } catch {
    return false;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

/**
 * The settings from either answer — the dashboard's GET or the store's public
 * `cookieConsent` — read defensively: anything unreadable counts as "off", so
 * a store never gains a banner (or loses its pixels) by accident.
 */
export function cookieConsentOf(raw: unknown): CookieConsentSettings {
  const s = isObject(raw) ? raw : {};
  const mode = COOKIE_CONSENT_MODES.includes(s.mode as CookieConsentMode) ? (s.mode as CookieConsentMode) : "off";
  const countries = Array.isArray(s.countries)
    ? s.countries.filter((c): c is string => typeof c === "string" && /^[A-Za-z]{2}$/.test(c)).map((c) => c.toUpperCase())
    : [];
  const policyUrl = typeof s.policyUrl === "string" && isCookiePolicyUrl(s.policyUrl) ? s.policyUrl.trim() : null;
  const texts: CookieConsentSettings["texts"] = {};
  if (isObject(s.texts)) {
    for (const locale of COOKIE_CONSENT_LOCALES) {
      const t = s.texts[locale];
      if (!isObject(t)) continue;
      const out: CookieConsentTexts = {
        message: text(t.message, COOKIE_CONSENT_LIMITS.message),
        accept: text(t.accept, COOKIE_CONSENT_LIMITS.button),
        reject: text(t.reject, COOKIE_CONSENT_LIMITS.button),
      };
      for (const key of Object.keys(out) as Array<keyof CookieConsentTexts>) if (!out[key]) delete out[key];
      if (Object.keys(out).length) texts[locale] = out;
    }
  }
  return { mode, countries: countries.length ? countries : null, policyUrl, texts };
}

/** GET /store/:ws `cookieConsent`, for the storefront's banner and tracking gate. */
export function storefrontCookieConsentOf(store: unknown): CookieConsentSettings {
  return cookieConsentOf(isObject(store) ? store.cookieConsent : null);
}

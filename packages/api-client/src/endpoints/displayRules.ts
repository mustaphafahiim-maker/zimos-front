import type { ApiClient } from "../client";

/**
 * Element display rules (backend modules/pages/displayRules.js, handoff 191).
 * Any builder element — on a store page or a funnel step — may carry, beside
 * its style:
 *
 *   element.settings.visibility = {
 *     from, until:  ISO dates (either may be missing)
 *     devices:      ["mobile" | "tablet" | "desktop", …]          (any of)
 *     countries:    { mode: "include" | "exclude", list: ["EG", …] }
 *     utm:          { source?: [...], medium?: [...], campaign?: [...] }
 *   }
 *
 * It is saved with the page / step tree as today (no endpoint of its own).
 * Every rule present must pass; inside one list, any value matches.
 *
 * The backend drops elements whose date window is closed from public pages
 * and funnel steps. Device, country and UTM depend on the visitor, so the
 * storefront applies them with `evaluateDisplayRules`, the same logic as the
 * backend's reference `evaluate`.
 */

export type DisplayDevice = "mobile" | "tablet" | "desktop";
export const DISPLAY_DEVICES: readonly DisplayDevice[] = ["mobile", "tablet", "desktop"];

export type DisplayUtmKey = "source" | "medium" | "campaign";
export const DISPLAY_UTM_KEYS: readonly DisplayUtmKey[] = ["source", "medium", "campaign"];

/** Server limits (displayRules.js): ≤250 countries, ≤20 values per UTM key, ≤100 characters each. */
export const DISPLAY_RULE_LIMITS = { countries: 250, utmValues: 20, utmValueLength: 100 } as const;

export interface ElementDisplayRules {
  from?: string | null;
  until?: string | null;
  devices?: DisplayDevice[];
  countries?: { mode: "include" | "exclude"; list: string[] };
  utm?: Partial<Record<DisplayUtmKey, string[]>>;
}

/** GET /store/:ws/visitor-context — public, never cached. */
export interface VisitorContext {
  /** Two-letter country code, or null when the API can't tell. */
  country: string | null;
  device: DisplayDevice | null;
  now: string;
}

export function storefrontVisitorContext(client: ApiClient, workspaceId: string): Promise<VisitorContext> {
  return client.request<VisitorContext>(`/store/${workspaceId}/visitor-context`, { auth: false });
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const validDate = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

/**
 * The element's rules, or null when it has none. Anything malformed is left
 * out rather than trusted (the tree may have been written by hand).
 */
export function displayRulesOf(element: { settings?: unknown } | null | undefined): ElementDisplayRules | null {
  const raw = isObject(element?.settings) ? element.settings.visibility : null;
  if (!isObject(raw)) return null;
  const out: ElementDisplayRules = {};
  if (validDate(raw.from)) out.from = raw.from;
  if (validDate(raw.until)) out.until = raw.until;
  if (Array.isArray(raw.devices)) {
    const devices = raw.devices.filter((d): d is DisplayDevice => DISPLAY_DEVICES.includes(d as DisplayDevice));
    if (devices.length > 0) out.devices = devices;
  }
  if (isObject(raw.countries) && (raw.countries.mode === "include" || raw.countries.mode === "exclude") && Array.isArray(raw.countries.list)) {
    const list = raw.countries.list.filter((c): c is string => typeof c === "string" && /^[A-Z]{2}$/.test(c));
    if (list.length > 0) out.countries = { mode: raw.countries.mode, list };
  }
  if (isObject(raw.utm)) {
    const utm: Partial<Record<DisplayUtmKey, string[]>> = {};
    for (const key of DISPLAY_UTM_KEYS) {
      const values = raw.utm[key];
      if (!Array.isArray(values)) continue;
      const clean = values.filter((v): v is string => typeof v === "string" && v.trim() !== "");
      if (clean.length > 0) utm[key] = clean;
    }
    if (Object.keys(utm).length > 0) out.utm = utm;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Whether the element's date window is open at `now` (true when it has none). */
export function displayDateOpen(rules: ElementDisplayRules, now: number = Date.now()): boolean {
  if (validDate(rules.from) && Date.parse(rules.from) > now) return false;
  if (validDate(rules.until) && Date.parse(rules.until) <= now) return false;
  return true;
}

/**
 * The backend's reference check. An `include` list needs a known country; an
 * `exclude` list lets an unknown one through. Each UTM key present must equal
 * one of its values, ignoring case.
 */
export function evaluateDisplayRules(
  rules: ElementDisplayRules,
  ctx: { now?: number; device?: DisplayDevice | null; country?: string | null; utm?: Partial<Record<DisplayUtmKey, string | null | undefined>> }
): boolean {
  if (!displayDateOpen(rules, ctx.now ?? Date.now())) return false;
  if (rules.devices && rules.devices.length > 0 && !(ctx.device && rules.devices.includes(ctx.device))) return false;
  if (rules.countries) {
    const country = ctx.country ? ctx.country.toUpperCase() : null;
    const listed = !!country && rules.countries.list.includes(country);
    if (rules.countries.mode === "include" && !listed) return false;
    if (rules.countries.mode === "exclude" && listed) return false;
  }
  if (rules.utm) {
    for (const key of DISPLAY_UTM_KEYS) {
      const values = rules.utm[key];
      if (!values) continue;
      const got = String(ctx.utm?.[key] ?? "").trim().toLowerCase();
      if (!values.some((v) => v.trim().toLowerCase() === got)) return false;
    }
  }
  return true;
}

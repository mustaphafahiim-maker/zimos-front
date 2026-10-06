import { storefrontVisitorContext, type CookieConsentMode, type CookieConsentSettings } from "@store-builder/api-client";
import { createStorefrontApiClient } from "./apiClient";

/**
 * The shopper's cookie choice (frontend-handoff 196; backend
 * marketing/cookieConsent.js). The store layout hands the store's
 * `cookieConsent` to components/CookieConsent.tsx, which starts this once the
 * page is in the browser:
 *
 *  - off      nothing changes: no banner, pixels as before, nothing extra sent;
 *  - notice   the banner informs (one "OK"); pixels run as usual;
 *  - opt_in   the browser pixels, GTM and Clarity wait for "Accept"; the
 *             event batches carry `consent: { marketing }` and the checkout
 *             `trackingConsent`, so the server sends nothing to the ad
 *             platforms for a shopper who did not accept. With `countries`,
 *             only visitors from those countries (or an unknown one) are
 *             asked; the others are tracked as on any store.
 *
 * The choice is kept in localStorage for six months, per store. First-party
 * analytics (lib/analyticsEvents.ts) run either way.
 */

export type ConsentChoice = "accepted" | "rejected" | "noticed";

export interface ConsentState {
  /** The store (its UUID) this state belongs to; null until a store page started it. */
  storeId: string | null;
  settings: CookieConsentSettings;
  /** This browser's stored choice: undefined until read (after hydration), null when there is none. */
  choice: ConsentChoice | null | undefined;
  /** Under opt_in, whether this visitor is asked; null while their country is looked up. */
  asked: boolean | null;
  /** The banner re-opened from the footer's "Cookie settings". */
  reopened: boolean;
}

const OFF: CookieConsentSettings = { mode: "off", countries: null, policyUrl: null, texts: {} };
/** Also the server snapshot: nothing is known about the shopper before the browser runs. */
export const INITIAL_CONSENT: ConsentState = { storeId: null, settings: OFF, choice: undefined, asked: null, reopened: false };

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;
const COUNTRY_KEY = "zimos_visitor_country"; // shared with components/page-renderer/DisplayRulesGate
const storageKey = (storeId: string) => `zimos_cookie_consent_${storeId}`;

let state: ConsentState = INITIAL_CONSENT;
let started = "";
/**
 * The store's mode, set while the banner first renders in the browser — before
 * any page effect sends an event, and before the stored choice is read.
 */
let mode: CookieConsentMode = "off";
/** Set once the gated pixels are on this page: their events go straight out; taking consent back needs a reload. */
let pixelsLoaded = false;
/** Ad-pixel events sent while the choice is still being read (a product view, a purchase on load). */
const held: Array<() => void> = [];
const MAX_HELD = 20;
const listeners = new Set<() => void>();

/** The choice is not known yet: not read, or the visitor's country still being looked up. */
const pending = (s: ConsentState) => s.choice === undefined || (s.choice !== "accepted" && s.choice !== "rejected" && s.asked === null);

function update(next: Partial<ConsentState>) {
  state = { ...state, ...next };
  // Nothing tracks until the shopper accepts: what was held for an answer that is "not now" is dropped.
  if (!pending(state) && !marketingAllowed(state)) held.length = 0;
  for (const listener of listeners) listener();
}

/** Called while the banner and the pixel gate render in the browser. */
export function configureConsentMode(next: CookieConsentMode): void {
  if (typeof window !== "undefined") mode = next;
}

/**
 * lib/track.ts: sends an ad-pixel event now, or — on a store that asks first —
 * holds it until the choice is known and the pixels are on the page, then
 * sends it (or drops it if the shopper is asked and has not accepted).
 */
export function whenPixelsMay(send: () => void): void {
  if (mode !== "opt_in" || pixelsLoaded) return send();
  if ((pending(state) || marketingAllowed(state)) && held.length < MAX_HELD) held.push(send);
}

export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function consentSnapshot(): ConsentState {
  return state;
}

function readChoice(storeId: string): ConsentChoice | null {
  try {
    const raw = window.localStorage.getItem(storageKey(storeId));
    const saved = raw ? (JSON.parse(raw) as { choice?: unknown; at?: unknown }) : null;
    if (!saved || typeof saved.at !== "number" || Date.now() - saved.at > SIX_MONTHS_MS) return null;
    return saved.choice === "accepted" || saved.choice === "rejected" || saved.choice === "noticed" ? saved.choice : null;
  } catch {
    return null; // storage blocked: asked again on each page, nothing tracked meanwhile
  }
}

/** The visitor's country (GET /store/:ws/visitor-context), once per visit; null when unknown. */
async function visitorCountry(workspaceId: string): Promise<string | null> {
  try {
    const saved = window.sessionStorage.getItem(COUNTRY_KEY);
    if (saved !== null) return saved || null;
  } catch {
    /* ask the API */
  }
  try {
    const ctx = await storefrontVisitorContext(createStorefrontApiClient(), workspaceId);
    const country = ctx.country ? ctx.country.toUpperCase() : null;
    try {
      window.sessionStorage.setItem(COUNTRY_KEY, country ?? "");
    } catch {
      /* asked again on the next page */
    }
    return country;
  } catch {
    return null;
  }
}

/**
 * Starts the state for one store, in the browser (an effect of the banner and
 * of the pixel gate; the second call is a no-op). `workspaceId` is the route's
 * id, for the visitor-context call.
 */
export function startConsent(storeId: string, workspaceId: string, settings: CookieConsentSettings): void {
  if (typeof window === "undefined") return;
  const key = `${storeId}|${JSON.stringify(settings)}`;
  if (started === key) return;
  started = key;
  const choice = readChoice(storeId);
  const needsCountry = settings.mode === "opt_in" && !!settings.countries && choice !== "accepted" && choice !== "rejected";
  update({ storeId, settings, choice, asked: settings.mode === "opt_in" ? (needsCountry ? null : true) : false, reopened: false });
  if (!needsCountry) return;
  const listed = settings.countries ?? [];
  void visitorCountry(workspaceId).then((country) => {
    // An unknown country is asked, like a listed one.
    if (started === key) update({ asked: !country || listed.includes(country) });
  });
}

/** Whether the ad pixels may run for this shopper now. */
export function marketingAllowed(s: ConsentState = state): boolean {
  if (s.settings.mode !== "opt_in") return true;
  if (s.choice === "accepted") return true;
  if (s.choice === "rejected" || s.choice === undefined) return false;
  return s.asked === false;
}

/** Whether the banner shows now. */
export function bannerOpen(s: ConsentState = state): boolean {
  if (s.settings.mode === "off" || s.choice === undefined) return false;
  if (s.reopened) return true;
  if (s.settings.mode === "notice") return !s.choice;
  return s.choice !== "accepted" && s.choice !== "rejected" && s.asked === true;
}

/** Keeps the shopper's answer for six months and closes the banner. */
export function chooseConsent(choice: ConsentChoice): void {
  if (!state.storeId) return;
  try {
    window.localStorage.setItem(storageKey(state.storeId), JSON.stringify({ choice, at: Date.now() }));
  } catch {
    /* kept for this page only */
  }
  const withdrawn = state.settings.mode === "opt_in" && pixelsLoaded && choice !== "accepted";
  update({ choice, reopened: false });
  // Loaded pixels can't be unloaded: the page starts again without them.
  if (withdrawn) window.location.reload();
}

export function reopenConsent(open: boolean): void {
  update({ reopened: open });
}

/** The gate mounted the pixels (their scripts ran): the held events go out now, in order. */
export function markPixelsLoaded(): void {
  pixelsLoaded = true;
  for (const send of held.splice(0)) send();
}

/** The event batch's `consent` (POST /store/:ws/events): only on a store that asks first. */
export function consentBatchField(): { consent?: { marketing: boolean } } {
  if (typeof window === "undefined" || mode !== "opt_in") return {};
  return { consent: { marketing: state.choice === "accepted" } };
}

/** The checkout's `trackingConsent` (POST /store/:ws/checkout): only on a store that asks first. */
export function trackingConsentField(): { trackingConsent?: boolean } {
  if (typeof window === "undefined" || mode !== "opt_in") return {};
  return { trackingConsent: state.choice === "accepted" };
}

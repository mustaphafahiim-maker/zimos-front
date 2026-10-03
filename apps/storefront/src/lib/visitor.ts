/**
 * Who this shopper is, for everything the storefront reports about them: the
 * checkout autosave (lib/useCheckoutAutosave.ts, through ./visitorId) and the
 * store's own analytics (lib/analyticsEvents.ts). Plain module, no imports and
 * SSR-safe — every function returns a harmless value on the server or when
 * storage is blocked, and nothing here ever throws — so it also runs under
 * Node's test runner (`node --test src/lib/visitor.test.mjs`).
 *
 * One visitor identity, one storage key:
 *  - sessionStorage `zimos_visitor_<workspaceId>` — the visitor id. One per
 *    store per browser tab, so a new tab is a new shopping trip and nothing
 *    outlives the session. This is the id the checkout autosave has always
 *    upserted on (abandoned checkouts are one per visitor), and analytics
 *    events carry the same one, so an abandoned checkout and the visit it came
 *    from share an id.
 *
 * Next to it, for analytics only (a visit, not an identity):
 *  - sessionStorage `zimos_sid` + localStorage `zimos_sid_at` — the analytics
 *    session: ends after 30 idle minutes (Umami / Shopify semantics);
 *  - sessionStorage `zimos_attr` — how the session began (utm, click ids,
 *    external referrer), captured on its first page.
 * No third-party code, no PII: random ids and URL parameters only.
 */

export const VISITOR_KEY_PREFIX = "zimos_visitor_";
export const SESSION_KEY = "zimos_sid";
export const SESSION_AT_KEY = "zimos_sid_at";
export const ATTRIBUTION_KEY = "zimos_attr";

/** An analytics session ends after this much idle time (Shopify uses the same window). */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

export interface Attribution {
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
  landingPage?: string;
  clickIds?: { gclid?: string; fbclid?: string; ttclid?: string };
}

// --- storage --------------------------------------------------------------------

type Store = "local" | "session";

function storage(kind: Store): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function read(kind: Store, key: string): string | null {
  try {
    return storage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(kind: Store, key: string, value: string) {
  try {
    storage(kind)?.setItem(key, value);
  } catch {
    /* private mode / storage disabled — ids just won't survive */
  }
}

// --- visitor id -----------------------------------------------------------------

// The API wants 8–64 characters.
const memoryVisitorIds = new Map<string, string>();

function isValidVisitorId(id: string | null | undefined): id is string {
  return typeof id === "string" && id.length >= 8 && id.length <= 64;
}

function newVisitorId(): string {
  try {
    const id = crypto.randomUUID();
    if (isValidVisitorId(id)) return id;
  } catch {
    // fall through
  }
  const rand = () => Math.random().toString(36).slice(2, 10).padEnd(8, "0");
  return `v${Date.now().toString(36)}${rand()}${rand()}`;
}

/**
 * The visitor id for this store in this tab. When storage or
 * crypto.randomUUID is unavailable (private mode, an insecure origin) the id
 * lives in memory for the life of the page instead.
 */
export function getVisitorId(workspaceId: string): string {
  const key = `${VISITOR_KEY_PREFIX}${workspaceId}`;
  try {
    const stored = window.sessionStorage.getItem(key);
    if (isValidVisitorId(stored)) return stored;
    const id = memoryVisitorIds.get(key) ?? newVisitorId();
    window.sessionStorage.setItem(key, id);
    memoryVisitorIds.set(key, id);
    return id;
  } catch {
    let id = memoryVisitorIds.get(key);
    if (!id) {
      id = newVisitorId();
      memoryVisitorIds.set(key, id);
    }
    return id;
  }
}

// --- analytics session ----------------------------------------------------------

const HEX32 = /^[0-9a-f]{32}$/;

/** 32 lowercase hex characters, from the Web Crypto API when it exists. */
export function randomId(): string {
  const bytes = new Uint8Array(16);
  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(bytes);
    } else {
      throw new Error("no crypto");
    }
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

// In-memory fallbacks so one page still has a stable session when storage is blocked.
let memorySessionId: string | null = null;
let memorySessionAt = 0;

/**
 * The current analytics session. A new id when this tab has none, or when the
 * last activity (any tab) was more than SESSION_IDLE_MS ago; every call
 * refreshes the activity timestamp so the window slides with the shopper.
 */
export function getSessionId(now: number = Date.now()): string {
  const saved = read("session", SESSION_KEY) ?? memorySessionId;
  const at = Number(read("local", SESSION_AT_KEY)) || memorySessionAt;
  const fresh = saved && HEX32.test(saved) && at > 0 && now - at <= SESSION_IDLE_MS;

  let id = fresh ? saved : null;
  if (!id) {
    id = randomId();
    memorySessionId = id;
    write("session", SESSION_KEY, id);
    // A new session starts from a clean attribution: the next page captures it.
    try {
      storage("session")?.removeItem(ATTRIBUTION_KEY);
    } catch {
      /* ignore */
    }
  }
  memorySessionAt = now;
  write("local", SESSION_AT_KEY, String(now));
  return id;
}

// --- attribution ----------------------------------------------------------------

const MAX_PARAM = 200;

function clip(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  return v ? v.slice(0, MAX_PARAM) : undefined;
}

/** Referrer host when it is another site, else undefined. */
export function externalReferrer(referrer: string, ownHost: string): { url: string; host: string } | undefined {
  if (!referrer) return undefined;
  try {
    const url = new URL(referrer);
    if (!url.host || url.host === ownHost) return undefined;
    return { url: referrer.slice(0, 500), host: url.host };
  } catch {
    return undefined;
  }
}

/**
 * Pure version of captureAttribution for the given location — what
 * `?utm_…`, the click ids and the referrer say about how the visit began.
 * Same parameter set as the funnel entry page (app/store/[workspaceId]/f/[ref]).
 */
export function attributionFrom(input: {
  search: string;
  pathname: string;
  referrer: string;
  host: string;
}): Attribution {
  const params = new URLSearchParams(input.search);
  const ref = externalReferrer(input.referrer, input.host);
  const clickIds: Attribution["clickIds"] = {};
  const gclid = clip(params.get("gclid"));
  const fbclid = clip(params.get("fbclid"));
  const ttclid = clip(params.get("ttclid"));
  if (gclid) clickIds.gclid = gclid;
  if (fbclid) clickIds.fbclid = fbclid;
  if (ttclid) clickIds.ttclid = ttclid;

  const out: Attribution = {};
  const source = clip(params.get("utm_source")) ?? ref?.host;
  const medium = clip(params.get("utm_medium"));
  const campaign = clip(params.get("utm_campaign"));
  if (source) out.source = source;
  if (medium) out.medium = medium;
  if (campaign) out.campaign = campaign;
  if (ref) out.referrer = ref.url;
  const landing = `${input.pathname}${input.search}`;
  if (landing) out.landingPage = landing.slice(0, 500);
  if (Object.keys(clickIds).length > 0) out.clickIds = clickIds;
  return out;
}

/**
 * The attribution of the current session: captured from the first page of the
 * session and kept in sessionStorage, so every later page (and every event)
 * reports the same origin. `{}` on the server or when storage is blocked and
 * nothing is known.
 */
export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  const saved = read("session", ATTRIBUTION_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") return parsed as Attribution;
    } catch {
      /* corrupt — recapture */
    }
  }
  let attr: Attribution = {};
  try {
    attr = attributionFrom({
      search: window.location.search,
      pathname: window.location.pathname,
      referrer: document.referrer,
      host: window.location.host,
    });
  } catch {
    return {};
  }
  write("session", ATTRIBUTION_KEY, JSON.stringify(attr));
  return attr;
}

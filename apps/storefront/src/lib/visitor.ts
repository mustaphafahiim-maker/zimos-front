/**
 * First-party visitor identity for the store's own analytics
 * (lib/analyticsEvents.ts): who this browser is, which visit this is, and
 * where the visit came from. Plain module, SSR-safe — every function returns
 * a harmless value on the server or when storage is blocked, and nothing here
 * ever throws. No third-party code, no PII: random ids and URL parameters only.
 *
 * Keys (all prefixed `zimos_`):
 *  - localStorage `zimos_vid`      — the visitor id, created once per browser
 *  - sessionStorage `zimos_sid`    — the session id for this tab
 *  - localStorage `zimos_sid_at`   — when the session was last active
 *  - sessionStorage `zimos_attr`   — the attribution captured on the first page
 */

export const VISITOR_KEY = "zimos_vid";
export const SESSION_KEY = "zimos_sid";
export const SESSION_AT_KEY = "zimos_sid_at";
export const ATTRIBUTION_KEY = "zimos_attr";

/** A session ends after this much idle time (Shopify uses the same window). */
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

// --- ids ------------------------------------------------------------------------

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

// In-memory fallbacks so one page still has stable ids when storage is blocked.
let memoryVisitorId: string | null = null;
let memorySessionId: string | null = null;
let memorySessionAt = 0;

/** Stable per browser: created once and kept in localStorage. */
export function getVisitorId(): string {
  const saved = read("local", VISITOR_KEY);
  if (saved && HEX32.test(saved)) return saved;
  if (!memoryVisitorId) memoryVisitorId = randomId();
  write("local", VISITOR_KEY, memoryVisitorId);
  return memoryVisitorId;
}

/**
 * The current visit. A new id when this tab has none, or when the last activity
 * (any tab) was more than SESSION_IDLE_MS ago; every call refreshes the
 * activity timestamp so the window slides with the shopper.
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

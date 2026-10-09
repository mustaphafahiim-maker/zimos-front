import { whenPixelsMay } from "./cookieConsent";

/**
 * The browser tags of X (Twitter), Taboola, Outbrain, Kwai, Reddit and
 * Microsoft Ads (UET) — backend handoff item 251. lib/adPixels.ts keeps the
 * store's pixels and decides which ones an event is in scope for; this file
 * loads each platform's tag its standard way and words the event for it.
 *
 * Event names are not ours to choose: GET /store/:ws sends, per pixel,
 * `events` — our event → the platform's name, and no entry where the platform
 * has no such event (then nothing is sent). For X the "name" is the event id
 * the merchant made in X Ads Manager.
 *
 *   X          twq('config', id) (its page view comes with it), twq('event', eventId, { value, currency, conversion_id })
 *   Taboola    _tfa.push({ notify: 'event', name, id, revenue, currency, orderid })
 *   Outbrain   obApi('track', name, { orderValue, currency, orderId })
 *   Kwai       kwaiq.load(id), kwaiq.instance(id).page(), .track(name, { value, currency })
 *   Reddit     rdt('init', id), rdt('track', name, { value, currency, transactionId, conversionId })
 *   Microsoft  one UET queue per tag (the first is window.uetq); the page load is the tag's own,
 *              client-side navigation included; uetq.push('event', name, { revenue_value, currency, event_id })
 *
 * Nothing here runs before components/AdPlatformTags mounts, and that sits
 * inside the consent gate (components/CookieConsent): on a store that asks
 * first, no tag is created and no request leaves until the shopper accepts.
 * A pixel scoped to funnels or products is loaded the first time an event is
 * in its scope, like the Snap and Pinterest tags.
 *
 * The order's conversion carries the order id (the same id the server-side
 * copy uses), any other event its own event id, so a platform that also gets
 * the event from the server counts it once.
 */

export type AdTagPlatform = "x" | "taboola" | "outbrain" | "kwai" | "reddit" | "microsoft";
export const AD_TAG_PLATFORMS: readonly AdTagPlatform[] = ["x", "taboola", "outbrain", "kwai", "reddit", "microsoft"];

export function isAdTagPlatform(platform: string): platform is AdTagPlatform {
  return (AD_TAG_PLATFORMS as readonly string[]).includes(platform);
}

export const AD_TAG_EVENTS = [
  "page_view",
  "view_content",
  "add_to_cart",
  "begin_checkout",
  "add_payment_info",
  "purchase",
  "lead",
] as const;
export type AdTagEvent = (typeof AD_TAG_EVENTS)[number];
/** Our event → the platform's name for it; an event the platform does not have is absent. */
export type AdTagEvents = Partial<Record<AdTagEvent, string>>;

/** What this file needs of a store pixel (lib/adPixels.ts StorePixel has it all). */
export interface AdTagPixel {
  platform: string;
  pixelId: string;
  scope: { type: "all" | "funnels" | "products"; ids: string[] };
  events?: AdTagEvents;
}

export interface AdTagData {
  /** Major units, as the other pixels get it. */
  value?: number;
  currency?: string;
  orderId?: string;
  /** The order id for the order's conversion, the event's own id otherwise. */
  dedupeId?: string;
}

const EVENT_NAME = /^[A-Za-z0-9_ -]{1,64}$/;
const X_EVENT_ID = /^tw-[a-z0-9]{3,12}-[a-z0-9]{3,12}$/i;

/** A pixel's `events` from the store metadata, keeping only names of the expected shape. */
export function adTagEventsOf(platform: string, raw: unknown): AdTagEvents | undefined {
  if (!isAdTagPlatform(platform) || !raw || typeof raw !== "object") return undefined;
  const out: AdTagEvents = {};
  for (const event of AD_TAG_EVENTS) {
    const name = (raw as Record<string, unknown>)[event];
    if (typeof name === "string" && (platform === "x" ? X_EVENT_ID : EVENT_NAME).test(name)) out[event] = name;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ------------------------------------------------------------ the globals --

type Fn = (...args: unknown[]) => unknown;
/** A tag's command function before its script arrives: calls wait in a queue the script then drains. */
type Stub = Fn & Record<string, unknown>;
/** One Kwai pixel's own queue: an array whose methods (page, track…) push their call onto it. */
interface KwaiInstance extends Array<unknown> {
  [method: string]: unknown;
  page: Fn;
  track: Fn;
  _u?: string;
}
interface KwaiQueue extends Array<unknown> {
  [method: string]: unknown;
  methods: string[];
  instance: (id: string) => KwaiInstance;
  load: (id: string, options?: Record<string, unknown>) => void;
  _i?: Record<string, KwaiInstance>;
  _t?: Record<string, number>;
  _o?: Record<string, Record<string, unknown>>;
}
type UetQueue = { push: Fn };
type TagWindow = Window & {
  twq?: Stub;
  _tfa?: unknown[];
  obApi?: Stub;
  KwaiAnalyticsObject?: string;
  kwaiq?: KwaiQueue;
  rdt?: Stub;
};

function inject(src: string, id?: string, onLoad?: () => void): void {
  const el = document.createElement("script");
  el.async = true;
  el.src = src;
  if (id) el.id = id;
  if (onLoad) el.onload = onLoad;
  const first = document.getElementsByTagName("script")[0];
  if (first?.parentNode) first.parentNode.insertBefore(el, first);
  else document.head.appendChild(el);
}

/** Drops the keys a tag should not see as "undefined". */
function clean<T extends Record<string, unknown>>(fields: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(fields) as Array<keyof T>) if (fields[key] !== undefined) out[key] = fields[key];
  return out;
}

// ---------------------------------------------------------------------- X --

const xConfigured = new Set<string>();

/** The X base tag; `config` sends that pixel's page view by itself. */
function xConfig(w: TagWindow, pixelId: string): void {
  if (!w.twq) {
    const twq = function (...args: unknown[]) {
      if (typeof twq.exe === "function") (twq.exe as Fn).apply(twq, args);
      else (twq.queue as unknown[]).push(args);
    } as Stub;
    twq.version = "1.1";
    twq.queue = [];
    w.twq = twq;
    inject("https://static.ads-twitter.com/uwt.js");
  }
  if (xConfigured.has(pixelId)) return;
  xConfigured.add(pixelId);
  w.twq("config", pixelId);
}

// ---------------------------------------------------------------- Taboola --

/** One tfa.js serves every account: each event names its own account id. */
function taboolaLoad(w: TagWindow, accountId: string): unknown[] {
  const queue = (w._tfa = w._tfa || []);
  if (!document.getElementById("tb_tfa_script")) inject(`https://cdn.taboola.com/libtrc/unip/${accountId}/tfa.js`, "tb_tfa_script");
  return queue;
}

// --------------------------------------------------------------- Outbrain --

const outbrainLoaded = new Set<string>();

/** An Outbrain event goes to every marketer id on the page, so a scoped one joins on its first match. */
function outbrainLoad(w: TagWindow, marketerId: string): void {
  if (outbrainLoaded.has(marketerId)) return;
  outbrainLoaded.add(marketerId);
  if (w.obApi) {
    const now = w.obApi.marketerId;
    w.obApi.marketerId = (Array.isArray(now) ? now : now ? [now] : []).concat(marketerId);
    return;
  }
  const api = function (...args: unknown[]) {
    if (typeof api.dispatch === "function") (api.dispatch as Fn).apply(api, args);
    else (api.queue as unknown[]).push(args);
  } as Stub;
  api.version = "1.1";
  api.loaded = true;
  api.marketerId = marketerId;
  api.queue = [];
  w.obApi = api;
  inject("https://amplify.outbrain.com/cp/obtp.js");
}

// ------------------------------------------------------------------- Kwai --

const kwaiLoaded = new Set<string>();
const KWAI_SDK = "https://s1.kwai.net/kos/s101/nlav11187/pixel/events.js";

/** Kwai's base code: a queue with deferred methods, one instance per pixel, the SDK loaded per pixel id. */
function kwaiLoad(w: TagWindow, pixelId: string): KwaiQueue {
  if (!w.kwaiq) {
    w.KwaiAnalyticsObject = "kwaiq";
    const queue = [] as unknown as KwaiQueue;
    queue.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    const defer = (target: KwaiQueue | KwaiInstance, method: string) => {
      target[method] = (...args: unknown[]) => {
        target.push([method, ...args]);
      };
    };
    for (const method of queue.methods) defer(queue, method);
    queue.instance = (id: string) => {
      const instance = queue._i?.[id] ?? ([] as unknown as KwaiInstance);
      for (const method of queue.methods) defer(instance, method);
      return instance;
    };
    queue.load = (id: string, options?: Record<string, unknown>) => {
      queue._i = queue._i || {};
      queue._i[id] = [] as unknown as KwaiInstance;
      queue._i[id]._u = KWAI_SDK;
      queue._t = queue._t || {};
      queue._t[id] = Date.now();
      queue._o = queue._o || {};
      queue._o[id] = options || {};
      inject(`${KWAI_SDK}?sdkid=${id}&lib=kwaiq`);
    };
    w.kwaiq = queue;
  }
  if (!kwaiLoaded.has(pixelId)) {
    kwaiLoaded.add(pixelId);
    w.kwaiq.load(pixelId);
  }
  return w.kwaiq;
}

// ----------------------------------------------------------------- Reddit --

const redditInitialised = new Set<string>();

/** A Reddit event goes to every initialised pixel, so a scoped one joins on its first match. */
function redditInit(w: TagWindow, pixelId: string): Stub {
  if (!w.rdt) {
    const rdt = function (...args: unknown[]) {
      if (typeof rdt.sendEvent === "function") (rdt.sendEvent as Fn).apply(rdt, args);
      else (rdt.callQueue as unknown[]).push(args);
    } as Stub;
    rdt.callQueue = [];
    w.rdt = rdt;
    inject("https://www.redditstatic.com/ads/pixel.js");
  }
  if (!redditInitialised.has(pixelId)) {
    redditInitialised.add(pixelId);
    w.rdt("init", pixelId);
  }
  return w.rdt;
}

// ------------------------------------------------------- Microsoft (UET) --

/** UET tag id → the name of its queue on window. Each tag needs its own; the first is the usual `uetq`. */
const uetQueueOf = new Map<string, string>();
let batScript: "none" | "loading" | "ready" = "none";
const uetStarts: Array<() => void> = [];

/**
 * The UET base tag. Events pushed before bat.js arrives wait in a plain array,
 * which the tag takes over; the tag sends its page load itself, and with
 * `enableAutoSpaTracking` the page loads of client-side navigation too.
 */
function uetLoad(w: TagWindow, tagId: string): UetQueue {
  const globals = w as unknown as Record<string, unknown>;
  let name = uetQueueOf.get(tagId);
  if (!name) {
    name = uetQueueOf.size === 0 ? "uetq" : `uetq_${tagId}`;
    uetQueueOf.set(tagId, name);
    const queueName = name;
    globals[queueName] = globals[queueName] || [];
    const start = () => {
      const Uet = globals.UET as (new (options: Record<string, unknown>) => UetQueue) | undefined;
      if (typeof Uet !== "function") return;
      const queue = new Uet({ ti: tagId, enableAutoSpaTracking: true, q: globals[queueName] });
      globals[queueName] = queue;
      queue.push("pageLoad");
    };
    if (batScript === "ready") start();
    else {
      uetStarts.push(start);
      if (batScript === "none") {
        batScript = "loading";
        inject("https://bat.bing.com/bat.js", undefined, () => {
          batScript = "ready";
          for (const run of uetStarts.splice(0)) {
            try {
              run();
            } catch {
              /* one tag failing must not stop the next */
            }
          }
        });
      }
    }
  }
  return globals[name] as UetQueue;
}

// ----------------------------------------------------------------- events --

const of = (pixels: AdTagPixel[], platform: AdTagPlatform) => pixels.filter((p) => p.platform === platform);
/** The fixed-name platforms word an event the same on every pixel: the first pixel's name is everyone's. */
const nameOf = (pixels: AdTagPixel[], event: AdTagEvent) => pixels.find((p) => p.events?.[event])?.events?.[event];

function pageView(w: TagWindow, pixels: AdTagPixel[]): void {
  for (const p of of(pixels, "x")) {
    xConfig(w, p.pixelId); // the first config is the page view of the base tag
    const eventId = p.events?.page_view;
    if (eventId && w.twq) w.twq("event", eventId, {});
  }
  for (const p of of(pixels, "taboola")) {
    const queue = taboolaLoad(w, p.pixelId);
    const name = p.events?.page_view;
    if (name) queue.push({ notify: "event", name, id: Number(p.pixelId) });
  }
  const outbrain = of(pixels, "outbrain");
  if (outbrain.length > 0) {
    for (const p of outbrain) outbrainLoad(w, p.pixelId);
    const name = nameOf(outbrain, "page_view");
    if (name && w.obApi) w.obApi("track", name);
  }
  for (const p of of(pixels, "kwai")) kwaiLoad(w, p.pixelId).instance(p.pixelId).page();
  const reddit = of(pixels, "reddit");
  if (reddit.length > 0) {
    for (const p of reddit) redditInit(w, p.pixelId);
    const name = nameOf(reddit, "page_view");
    if (name && w.rdt) w.rdt("track", name);
  }
  for (const p of of(pixels, "microsoft")) uetLoad(w, p.pixelId); // its page loads are the tag's own
}

function conversion(w: TagWindow, pixels: AdTagPixel[], event: AdTagEvent, data: AdTagData): void {
  // An amount only means something with its currency.
  const value = data.value !== undefined && data.currency ? data.value : undefined;
  const currency = value !== undefined ? data.currency : undefined;

  for (const p of of(pixels, "x")) {
    xConfig(w, p.pixelId);
    const eventId = p.events?.[event];
    if (eventId && w.twq) w.twq("event", eventId, clean({ value, currency, conversion_id: data.dedupeId }));
  }
  for (const p of of(pixels, "taboola")) {
    const queue = taboolaLoad(w, p.pixelId);
    const name = p.events?.[event];
    if (name) queue.push(clean({ notify: "event", name, id: Number(p.pixelId), revenue: value, currency, orderid: data.orderId }));
  }
  const outbrain = of(pixels, "outbrain");
  if (outbrain.length > 0) {
    for (const p of outbrain) outbrainLoad(w, p.pixelId);
    const name = nameOf(outbrain, event);
    if (name && w.obApi) w.obApi("track", name, clean({ orderValue: value, currency, orderId: data.orderId }));
  }
  for (const p of of(pixels, "kwai")) {
    const queue = kwaiLoad(w, p.pixelId);
    const name = p.events?.[event];
    if (name) queue.instance(p.pixelId).track(name, clean({ value, currency }));
  }
  const reddit = of(pixels, "reddit");
  if (reddit.length > 0) {
    for (const p of reddit) redditInit(w, p.pixelId);
    const name = nameOf(reddit, event);
    // conversionId is Reddit's dedup field: the id its Conversions API copy carries.
    if (name && w.rdt) w.rdt("track", name, clean({ value, currency, transactionId: data.orderId, conversionId: data.dedupeId }));
  }
  for (const p of of(pixels, "microsoft")) {
    const queue = uetLoad(w, p.pixelId);
    const name = p.events?.[event];
    if (name) queue.push("event", name, clean({ revenue_value: value, currency, event_id: data.dedupeId }));
  }
}

// ------------------------------------------------------------------ start --

let started = false;
let startedFor = "";
/** Calls made on a page whose tags have not started yet (a product view on load); sent when they do. */
const waiting: Array<() => void> = [];
const MAX_WAITING = 20;

function run(call: () => void): void {
  const safe = () => {
    try {
      call();
    } catch {
      /* a broken third-party script must never break the store */
    }
  };
  if (started) return safe();
  // Not on the page yet. A store that asks first holds the call for the shopper's answer (or drops
  // it); on any other store the tags start with the page, a moment from now.
  whenPixelsMay(() => {
    if (started) safe();
    else if (waiting.length < MAX_WAITING) waiting.push(safe);
  });
}

/**
 * components/AdPlatformTags calls this once the pixels may run: the store-wide
 * tags load and get the first page view, and what waited goes out.
 */
export function startAdPlatformTags(pixels: AdTagPixel[]): void {
  if (typeof window === "undefined") return;
  const mine = pixels.filter((p) => isAdTagPlatform(p.platform));
  const key = mine.map((p) => `${p.platform}:${p.pixelId}:${p.scope.type}`).join("|");
  // Once per set of pixels: React may run the mounting effect twice, and the first page view is sent here.
  if (started && startedFor === key) return;
  started = true;
  startedFor = key;
  try {
    pageView(
      window as TagWindow,
      mine.filter((p) => p.scope.type === "all")
    );
  } catch {
    /* a broken third-party script must never break the store */
  }
  for (const call of waiting.splice(0)) call();
}

/** A page view for these pixels: a navigation inside the store, or scoped pixels joining the visit. */
export function sendAdTagPageView(pixels: AdTagPixel[]): void {
  if (typeof window === "undefined") return;
  const mine = pixels.filter((p) => isAdTagPlatform(p.platform));
  if (mine.length > 0) run(() => pageView(window as TagWindow, mine));
}

/** One commerce event for the pixels it is in scope for. */
export function sendToAdPlatformTags(pixels: AdTagPixel[], event: AdTagEvent, data: AdTagData = {}): void {
  if (typeof window === "undefined") return;
  const mine = pixels.filter((p) => isAdTagPlatform(p.platform));
  if (mine.length === 0) return;
  run(() => (event === "page_view" ? pageView(window as TagWindow, mine) : conversion(window as TagWindow, mine, event, data)));
}

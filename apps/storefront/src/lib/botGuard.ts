import { protectionCheckoutGuard, type ApiClient, type CheckoutGuard } from "@store-builder/api-client";

/**
 * The checkout's bot guard, shopper side (backend: modules/risk/botProtection).
 *
 * The store layout primes it when a store page opens: the server hands out a
 * signed time token, and an order is only accepted with that token, at least
 * `minSeconds` after it was issued, and with the hidden honeypot field empty.
 * When the store asks for an invisible challenge, its token rides along too.
 * Every checkout call goes through `botGuardFields`, which adds those fields
 * and the browser's device id.
 *
 * None of this may cost a real shopper their order: a guard that cannot be
 * fetched sends nothing (the server then decides), a token that is too fresh
 * is simply waited out, and a challenge that cannot run sends no token.
 */

/** A token older than this is replaced before use (the server keeps them 12 hours). */
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;
const DEVICE_KEY = "zimos_device";
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const CHALLENGE_TIMEOUT_MS = 8000;

interface GuardState {
  workspaceId: string;
  guard: CheckoutGuard;
  fetchedAt: number;
}

let state: GuardState | null = null;
let pending: Promise<GuardState | null> | null = null;
let honeypot = "";
let memoryDevice: string | null = null;

/** What the hidden field holds — anything but "" means a bot filled it. */
export function setBotGuardHoneypot(value: string) {
  honeypot = value;
}

/**
 * This browser's own id: one per browser, kept in localStorage. The store
 * uses it to spot several orders from one device and to block a device.
 */
export function getDeviceId(): string {
  try {
    const stored = window.localStorage.getItem(DEVICE_KEY);
    if (stored && stored.length >= 8) return stored;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    window.localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    // Private mode: an id for the life of the page.
    memoryDevice ??= `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    return memoryDevice;
  }
}

async function load(client: ApiClient, workspaceId: string): Promise<GuardState | null> {
  try {
    const guard = await protectionCheckoutGuard(client, workspaceId);
    state = { workspaceId, guard, fetchedAt: Date.now() };
    return state;
  } catch {
    return null;
  }
}

function fresh(workspaceId: string): GuardState | null {
  if (!state || state.workspaceId !== workspaceId) return null;
  if (Date.now() - state.fetchedAt > REFRESH_AFTER_MS) return null;
  return state;
}

/** Fetches the guard for this store unless a fresh one is already held. */
export function primeBotGuard(client: ApiClient, workspaceId: string): Promise<GuardState | null> {
  const held = fresh(workspaceId);
  if (held) return Promise.resolve(held);
  if (!pending) {
    pending = load(client, workspaceId).finally(() => {
      pending = null;
    });
  }
  return pending;
}

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: { sitekey: string; size: "invisible"; callback: (token: string) => void; "error-callback": () => void }
  ) => string;
  execute: (container: HTMLElement) => void;
  remove: (widgetId: string) => void;
}

function loadTurnstile(): Promise<TurnstileApi | null> {
  const existing = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = () => resolve((window as unknown as { turnstile?: TurnstileApi }).turnstile ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

/**
 * Runs the store's invisible challenge and resolves with its token, or null
 * when it cannot run (script blocked, timed out, unknown provider). The
 * sandbox provider has no widget: its passing token is fixed.
 */
async function challengeToken(captcha: NonNullable<CheckoutGuard["captcha"]>): Promise<string | null> {
  if (captcha.provider === "sandbox") return "sandbox-pass";
  if (captcha.provider !== "turnstile" || !captcha.siteKey) return null;
  const api = await loadTurnstile();
  if (!api) return null;
  const siteKey = captcha.siteKey;
  return new Promise<string | null>((resolve) => {
    const holder = document.createElement("div");
    holder.style.display = "none";
    document.body.appendChild(holder);
    let widgetId: string | null = null;
    const finish = (token: string | null) => {
      window.clearTimeout(timer);
      try {
        if (widgetId) api.remove(widgetId);
      } catch {
        // The widget is gone already.
      }
      holder.remove();
      resolve(token);
    };
    const timer = window.setTimeout(() => finish(null), CHALLENGE_TIMEOUT_MS);
    try {
      widgetId = api.render(holder, {
        sitekey: siteKey,
        size: "invisible",
        callback: (token) => finish(token),
        "error-callback": () => finish(null),
      });
      api.execute(holder);
    } catch {
      finish(null);
    }
  });
}

/** The fields to add to a checkout body. Resolves once the token is old enough to be accepted. */
export async function botGuardFields(client: ApiClient, workspaceId: string): Promise<Record<string, string>> {
  const fields: Record<string, string> = { deviceId: getDeviceId() };
  const held = await primeBotGuard(client, workspaceId);
  if (!held || !held.guard.enabled || !held.guard.token) return fields;
  const wait = held.guard.minSeconds * 1000 + 300 - (Date.now() - held.fetchedAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  fields.botToken = held.guard.token;
  fields[held.guard.honeypotField] = honeypot;
  if (held.guard.captcha) {
    const token = await challengeToken(held.guard.captcha);
    if (token) fields.captchaToken = token;
  }
  return fields;
}

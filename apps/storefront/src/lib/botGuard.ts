import { protectionCheckoutGuard, type ApiClient, type CheckoutGuard } from "@store-builder/api-client";

/**
 * The checkout's bot guard, shopper side (backend: modules/risk/botProtection).
 *
 * The store layout primes it when a store page opens: the server hands out a
 * signed time token, and an order is only accepted with that token, at least
 * `minSeconds` after it was issued, and with the hidden honeypot field empty.
 * Every checkout call goes through `botGuardFields`, which adds those fields.
 *
 * None of this may cost a real shopper their order: a guard that cannot be
 * fetched sends nothing (the server then decides), and a token that is too
 * fresh is simply waited out.
 */

/** A token older than this is replaced before use (the server keeps them 12 hours). */
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

interface GuardState {
  workspaceId: string;
  guard: CheckoutGuard;
  fetchedAt: number;
}

let state: GuardState | null = null;
let pending: Promise<GuardState | null> | null = null;
let honeypot = "";

/** What the hidden field holds — anything but "" means a bot filled it. */
export function setBotGuardHoneypot(value: string) {
  honeypot = value;
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

/** The fields to add to a checkout body. Resolves once the token is old enough to be accepted. */
export async function botGuardFields(client: ApiClient, workspaceId: string): Promise<Record<string, string>> {
  const held = await primeBotGuard(client, workspaceId);
  if (!held || !held.guard.enabled || !held.guard.token) return {};
  const wait = held.guard.minSeconds * 1000 + 300 - (Date.now() - held.fetchedAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  return { botToken: held.guard.token, [held.guard.honeypotField]: honeypot };
}

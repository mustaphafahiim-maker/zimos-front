import { isShopperToken, shopperTokenHeaders } from "@store-builder/api-client";
import { SHOPPER_ACCOUNTS_ENABLED } from "./features";

/**
 * Where a signed-in shopper's token for one store is kept between visits.
 *
 * - At most SHOPPER_TOKEN_MAX_AGE_MS (7 days), even when the API grants longer;
 *   a token past its time is thrown away on the next read.
 * - Per store, in localStorage, as { token, expiresAt }.
 * - With SHOPPER_ACCOUNTS_ENABLED off nothing is saved, read or sent.
 * - Only code that calls the API for the shopper may import this. Code that
 *   renders HTML we did not write (components/page-renderer, anything with
 *   dangerouslySetInnerHTML) must not: shopperToken.guard.test.tsx fails if it
 *   does. A script running on the page can still read localStorage, so the
 *   short life is the limit on what a stolen token is worth.
 */
export const SHOPPER_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const KEY_PREFIX = "zimos:shopper:";
const STORE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface ShopperTokenOptions {
  /** Defaults to SHOPPER_ACCOUNTS_ENABLED. */
  enabled?: boolean;
  /** Defaults to window.localStorage; null when there is none. */
  storage?: Storage | null;
  /** Defaults to Date.now(). */
  now?: number;
}

interface Kept {
  token: string;
  expiresAt: number;
}

function storageOf(options: ShopperTokenOptions): Storage | null {
  if (options.storage !== undefined) return options.storage;
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function keyOf(storeId: string): string | null {
  return STORE_ID.test(storeId) ? `${KEY_PREFIX}${storeId}` : null;
}

/**
 * Keeps the token the API gave on sign-in. `expiresInSeconds` is the API's
 * own lifetime for it; the token is kept for that or 7 days, whichever is
 * shorter. Answers whether it was kept.
 */
export function saveShopperToken(
  storeId: string,
  token: string,
  expiresInSeconds?: number | null,
  options: ShopperTokenOptions = {},
): boolean {
  if (!(options.enabled ?? SHOPPER_ACCOUNTS_ENABLED)) return false;
  const key = keyOf(storeId);
  const storage = storageOf(options);
  if (!key || !storage || !isShopperToken(token)) return false;

  const now = options.now ?? Date.now();
  const granted =
    typeof expiresInSeconds === "number" && Number.isFinite(expiresInSeconds) ? expiresInSeconds * 1000 : SHOPPER_TOKEN_MAX_AGE_MS;
  const life = Math.min(granted, SHOPPER_TOKEN_MAX_AGE_MS);
  if (life <= 0) return false;

  const kept: Kept = { token, expiresAt: now + life };
  try {
    storage.setItem(key, JSON.stringify(kept));
    return true;
  } catch {
    return false;
  }
}

/** Forgets the store's token (signing out on this device). */
export function clearShopperToken(storeId: string, options: ShopperTokenOptions = {}): void {
  const key = keyOf(storeId);
  const storage = storageOf(options);
  if (!key || !storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Storage blocked: nothing was kept either.
  }
}

/** The store's token while it is still good, otherwise null (and a stale one is dropped). */
export function readShopperToken(storeId: string, options: ShopperTokenOptions = {}): string | null {
  if (!(options.enabled ?? SHOPPER_ACCOUNTS_ENABLED)) return null;
  const key = keyOf(storeId);
  const storage = storageOf(options);
  if (!key || !storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;

  const now = options.now ?? Date.now();
  let kept: Partial<Kept> | null = null;
  try {
    kept = JSON.parse(raw) as Partial<Kept>;
  } catch {
    kept = null;
  }
  const good =
    kept !== null &&
    isShopperToken(kept.token) &&
    typeof kept.expiresAt === "number" &&
    kept.expiresAt > now &&
    // Never longer than 7 days from now, whatever was written (or the clock did).
    kept.expiresAt <= now + SHOPPER_TOKEN_MAX_AGE_MS;
  if (!good) {
    clearShopperToken(storeId, options);
    return null;
  }
  return kept!.token as string;
}

/** The X-Shopper-Token header for the store's calls, or none. */
export function shopperHeaders(storeId: string, options: ShopperTokenOptions = {}): Record<string, string> {
  return shopperTokenHeaders(readShopperToken(storeId, options));
}

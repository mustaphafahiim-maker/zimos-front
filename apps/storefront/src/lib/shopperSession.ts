"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ApiError,
  apiErrorDetails,
  shopperAccountConfig,
  type ApiClient,
  type ShopperAccountsSettings,
  type ShopperChannel,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "./apiClient";
import type { Dictionary } from "./i18n";
import { useStore } from "./StoreContext";

/**
 * The shopper's own account in one store (frontend-handoff 185). The token
 * the API gives on sign-in (30 days) is kept in localStorage per store and
 * sent as X-Shopper-Token; any 401 SHOPPER_NOT_SIGNED_IN drops it, so the
 * account shows the sign-in again. Signing out is forgetting the token here;
 * "sign out of all devices" asks the API to void every token.
 *
 * Nothing about the account lives in a provider: the header link, the
 * account pages and the checkout read the same token through this module,
 * and every one of them updates when it changes (also from another tab).
 */

const TOKEN_PREFIX = "zimos_shopper_token_";
const tokenKey = (storeId: string) => `${TOKEN_PREFIX}${storeId}`;

const listeners = new Set<() => void>();
/** Set when the API said the token stopped working: the sign-in says so once. */
let droppedByServer = false;

function readToken(storeId: string): string | null {
  if (!storeId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(tokenKey(storeId));
  } catch {
    return null;
  }
}

export function setShopperToken(storeId: string, token: string | null) {
  if (!storeId || typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(tokenKey(storeId), token);
    else window.localStorage.removeItem(tokenKey(storeId));
  } catch {
    /* storage blocked: the session lasts as long as nothing re-reads it */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(TOKEN_PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The signed-in shopper's token for this store; null on the server and when signed out. */
export function useShopperToken(storeId: string | undefined): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readToken(storeId ?? ""),
    () => null
  );
}

/** True once, after the API dropped the token (the sign-in then says "you were signed out"). */
export function takeSignedOutByServer(): boolean {
  const was = droppedByServer;
  droppedByServer = false;
  return was;
}

export function isShopperSignedOutError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401 && err.code === "SHOPPER_NOT_SIGNED_IN";
}

export function isAccountsOffError(err: unknown): boolean {
  return err instanceof ApiError && err.code === "SHOPPER_ACCOUNTS_OFF";
}

// ------------------------------------------------------------- config --

// One request per store for the page's life: the header, the account and the checkout share it.
const configs = new Map<string, Promise<ShopperAccountsSettings>>();

function loadConfig(client: ApiClient, storeId: string, fresh = false): Promise<ShopperAccountsSettings> {
  const known = fresh ? undefined : configs.get(storeId);
  if (known) return known;
  const request = shopperAccountConfig(client, storeId);
  configs.set(storeId, request);
  request.catch(() => {
    if (configs.get(storeId) === request) configs.delete(storeId);
  });
  return request;
}

export type ShopperConfigState =
  | { status: "loading"; config: null; reload: () => void }
  | { status: "error"; config: null; reload: () => void }
  | { status: "ready"; config: ShopperAccountsSettings; reload: () => void };

/** Whether the store offers accounts, and by which channels. */
export function useShopperConfig(): ShopperConfigState {
  const { store } = useStore();
  const storeId = store?.id ?? "";
  const client = useMemo(() => createStorefrontApiClient(), []);
  const [state, setState] = useState<{ key: string; config: ShopperAccountsSettings | null; failed: boolean } | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    loadConfig(client, storeId, nonce > 0)
      .then((config) => {
        if (!cancelled) setState({ key: storeId, config, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ key: storeId, config: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [client, storeId, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const current = state?.key === storeId ? state : null;
  if (current?.config) return { status: "ready", config: current.config, reload };
  if (current?.failed) return { status: "error", config: null, reload };
  return { status: "loading", config: null, reload };
}

// ------------------------------------------------------------ calling --

export interface ShopperApi {
  /** The store's UUID: the token's key and the API's workspace reference. */
  storeId: string;
  token: string | null;
  client: ApiClient;
  /**
   * Runs a signed-in call with the current token. A 401 drops the token
   * (the account falls back to the sign-in) and the error goes on to the caller.
   */
  call: <T>(fn: (client: ApiClient, storeId: string, token: string) => Promise<T>) => Promise<T>;
  signIn: (token: string) => void;
  signOut: () => void;
}

export function useShopperApi(): ShopperApi {
  const { store, locale } = useStore();
  const storeId = store?.id ?? "";
  const token = useShopperToken(storeId);
  // In the page's language, so the API words its errors for this shopper.
  const client = useMemo(() => createStorefrontApiClient({ locale }), [locale]);

  const call = useCallback(
    async <T,>(fn: (client: ApiClient, storeId: string, token: string) => Promise<T>): Promise<T> => {
      const current = readToken(storeId);
      if (!current) throw new ApiError("Sign in again", 401, "SHOPPER_NOT_SIGNED_IN");
      try {
        return await fn(client, storeId, current);
      } catch (err) {
        if (isShopperSignedOutError(err) && readToken(storeId) === current) {
          droppedByServer = true;
          setShopperToken(storeId, null);
        }
        throw err;
      }
    },
    [client, storeId]
  );

  const signIn = useCallback((next: string) => setShopperToken(storeId, next), [storeId]);
  const signOut = useCallback(() => setShopperToken(storeId, null), [storeId]);

  return useMemo(() => ({ storeId, token, client, call, signIn, signOut }), [storeId, token, client, call, signIn, signOut]);
}

// ------------------------------------------------------------- errors --

const SECONDS_SHOWN = 90;

/**
 * Every refusal of the account API in the shopper's language (en/ar/fr,
 * `t.account.errors`). `channel` is the one the shopper used, for
 * SHOPPER_CHANNEL_OFF and for telling a bad email from a bad phone.
 */
export function shopperErrorMessage(err: unknown, t: Dictionary["account"], channel: ShopperChannel = "sms"): string {
  const e = t.errors;
  if (!(err instanceof ApiError)) return e.generic;
  switch (err.code) {
    case "TOO_MANY_CODES": {
      const wait = apiErrorDetails<{ retryAfterSeconds?: number }>(err)?.retryAfterSeconds ?? err.retryAfter ?? 0;
      if (wait > 0 && wait <= SECONDS_SHOWN) return e.waitSeconds(wait);
      if (wait > 0 && wait <= 2 * 60 * 60) return e.waitMinutes(Math.ceil(wait / 60));
      return e.waitLater;
    }
    case "INVALID_PHONE":
      return e.invalidPhone;
    case "SHOPPER_CHANNEL_OFF":
      return channel === "sms" ? e.useEmail : e.usePhone;
    case "INVALID_CODE": {
      const left = apiErrorDetails<{ attemptsLeft?: number }>(err)?.attemptsLeft;
      return typeof left === "number" && left > 0 ? e.invalidCode(left) : e.wrongCode;
    }
    case "CODE_EXPIRED":
      return e.codeExpired;
    case "TOO_MANY_ATTEMPTS":
      return e.tooManyAttempts;
    case "TOO_MANY_ADDRESSES":
      return e.tooManyAddresses(10);
    case "SHOPPER_ACCOUNTS_OFF":
      return t.off;
    case "VALIDATION_ERROR":
      return channel === "email" ? e.invalidEmail : e.invalidPhone;
    case "RATE_LIMITED":
      return e.tooMany;
    default:
      return err.status === 429 ? e.tooMany : e.generic;
  }
}

/** The retry wait of a TOO_MANY_CODES answer, in seconds, when it is short enough to count down. */
export function codeCooldownOf(err: unknown): number {
  if (!(err instanceof ApiError) || err.code !== "TOO_MANY_CODES") return 0;
  const wait = apiErrorDetails<{ retryAfterSeconds?: number }>(err)?.retryAfterSeconds ?? 0;
  return wait > 0 && wait <= SECONDS_SHOWN ? wait : 0;
}

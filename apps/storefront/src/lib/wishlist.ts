"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  ApiError,
  shopperWishlist,
  shopperWishlistAdd,
  shopperWishlistMerge,
  shopperWishlistRemove,
  type Wishlist,
  type WishlistEntry,
} from "@store-builder/api-client";
import type { Dictionary } from "./i18n";
import { isAccountsOffError, isShopperSignedOutError, useShopperApi, useShopperConfig, type ShopperApi } from "./shopperSession";

/**
 * The shopper's wishlist in one store (frontend-handoff 188), shared by every
 * heart on the page and the account's «المفضلة» tab — one request per page,
 * not one per card.
 *
 * Signed in: the API's list (X-Shopper-Token). A guest: hearts kept in this
 * browser (localStorage, per store) and sent to POST /merge right after the
 * shopper signs in, then forgotten here. Hearts are product-wide (no variant):
 * a card has no variant to name, and the list shows no option words.
 *
 * Nothing shows while the store has no shopper accounts (185): the list
 * lives in the account.
 */

type Snapshot = {
  /** Products on the list (the API's when signed in, this browser's otherwise). */
  has: (productId: string) => boolean;
  /** The signed-in shopper's list; null while loading, signed out or failed. */
  list: Wishlist | null;
  status: "guest" | "loading" | "ready" | "error";
  /** A heart being saved: shown filled/empty as asked until the API answers. */
  pending: (productId: string) => boolean;
};

const GUEST_PREFIX = "zimos_wishlist_";
const guestKey = (storeId: string) => `${GUEST_PREFIX}${storeId}`;

interface ServerState {
  token: string;
  list: Wishlist | null;
  failed: boolean;
  loading: Promise<void> | null;
}

const servers = new Map<string, ServerState>();
/** productId → the state the shopper asked for, until the API confirms it. */
const optimistic = new Map<string, boolean>();
/** Set when the API said the store has no accounts after all (a stale config). */
const accountsOff = new Set<string>();

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(GUEST_PREFIX)) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// --------------------------------------------------------------- guest --

function readGuest(storeId: string): WishlistEntry[] {
  if (!storeId || typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(guestKey(storeId)) ?? "[]");
    return Array.isArray(raw) ? raw.filter((e): e is WishlistEntry => typeof e?.productId === "string") : [];
  } catch {
    return [];
  }
}

function writeGuest(storeId: string, entries: WishlistEntry[]) {
  try {
    if (entries.length) window.localStorage.setItem(guestKey(storeId), JSON.stringify(entries));
    else window.localStorage.removeItem(guestKey(storeId));
  } catch {
    /* storage blocked: the hearts last as long as the page */
  }
  emit();
}

// -------------------------------------------------------------- server --

function serverFor(storeId: string, token: string | null): ServerState | null {
  const s = servers.get(storeId);
  return s && token && s.token === token ? s : null;
}

function setList(storeId: string, token: string, list: Wishlist) {
  servers.set(storeId, { token, list, failed: false, loading: null });
  emit();
}

/**
 * Loads the signed-in shopper's list once per token. A guest's hearts kept in
 * this browser go first, through POST /merge, and are then forgotten here.
 */
function ensureLoaded(api: ShopperApi, force = false): Promise<void> {
  const { storeId, token } = api;
  if (!storeId || !token) return Promise.resolve();
  const known = serverFor(storeId, token);
  if (known && !force && (known.list || known.loading || known.failed)) return known.loading ?? Promise.resolve();
  const guest = readGuest(storeId);
  const loading = api
    .call((client, ref, tk) => (guest.length ? shopperWishlistMerge(client, ref, tk, guest) : shopperWishlist(client, ref, tk)))
    .then((list) => {
      if (guest.length) writeGuest(storeId, []);
      setList(storeId, token, list);
    })
    .catch((err) => {
      if (isAccountsOffError(err)) accountsOff.add(storeId);
      const current = servers.get(storeId);
      if (current?.token === token) servers.set(storeId, { ...current, failed: true, loading: null });
      emit();
    });
  servers.set(storeId, { token, list: known?.list ?? null, failed: false, loading });
  emit();
  return loading;
}

/**
 * Right after a sign-in (the account's sign-in calls this): the hearts this
 * browser kept as a guest go to the new account, and the list is ready for
 * every heart on the next page.
 */
export function mergeGuestWishlist(api: ShopperApi, token: string) {
  if (!api.storeId || readGuest(api.storeId).length === 0) return;
  void ensureLoaded({ ...api, token }, true);
}

// ---------------------------------------------------------------- hook --

export interface WishlistApi extends Snapshot {
  /** The store offers accounts: hearts and the tab exist. False while unknown. */
  enabled: boolean;
  signedIn: boolean;
  /** Adds or removes a product; resolves to true when it is now on the list. Throws the API's refusal. */
  toggle: (productId: string) => Promise<boolean>;
  remove: (itemId: string) => Promise<void>;
  reload: () => void;
}

export function useWishlist(): WishlistApi {
  const config = useShopperConfig();
  const api = useShopperApi();
  const { storeId, token } = api;
  const enabled = config.status === "ready" && config.config.enabled && !accountsOff.has(storeId);
  const tick = useSyncExternalStore(subscribe, () => version, () => -1);

  useEffect(() => {
    if (enabled && token) void ensureLoaded(api);
  }, [enabled, token, api]);

  const toggle = useCallback(
    async (productId: string): Promise<boolean> => {
      if (!api.token) {
        const guest = readGuest(storeId);
        const on = guest.some((e) => e.productId === productId);
        writeGuest(storeId, on ? guest.filter((e) => e.productId !== productId) : [{ productId, variantId: null }, ...guest]);
        return !on;
      }
      await ensureLoaded(api);
      const items = serverFor(storeId, api.token)?.list?.items ?? [];
      const mine = items.filter((i) => i.productId === productId);
      const wanted = mine.length === 0;
      optimistic.set(productId, wanted);
      emit();
      try {
        let list: Wishlist | null = null;
        if (wanted) {
          list = await api.call((client, ref, tk) => shopperWishlistAdd(client, ref, tk, { productId }));
        } else {
          for (const item of mine) list = await api.call((client, ref, tk) => shopperWishlistRemove(client, ref, tk, item.id));
        }
        if (list && api.token) setList(storeId, api.token, list);
        return wanted;
      } catch (err) {
        if (isAccountsOffError(err)) accountsOff.add(storeId);
        throw err;
      } finally {
        optimistic.delete(productId);
        emit();
      }
    },
    [api, storeId]
  );

  const remove = useCallback(
    async (itemId: string) => {
      const list = await api.call((client, ref, tk) => shopperWishlistRemove(client, ref, tk, itemId));
      if (api.token) setList(storeId, api.token, list);
    },
    [api, storeId]
  );

  const reload = useCallback(() => void ensureLoaded(api, true), [api]);

  return useMemo(() => {
    // `tick` is the module's version: a new snapshot whenever anything changed.
    void tick;
    const server = serverFor(storeId, token);
    const guestIds = token ? null : new Set(readGuest(storeId).map((e) => e.productId));
    const serverIds = new Set((server?.list?.items ?? []).map((i) => i.productId));
    const status: Snapshot["status"] = !token ? "guest" : server?.list ? "ready" : server?.failed ? "error" : "loading";
    return {
      enabled,
      signedIn: Boolean(token),
      list: server?.list ?? null,
      status,
      has: (productId: string) => optimistic.get(productId) ?? (guestIds ? guestIds.has(productId) : serverIds.has(productId)),
      pending: (productId: string) => optimistic.has(productId),
      toggle,
      remove,
      reload,
    };
  }, [tick, storeId, token, enabled, toggle, remove, reload]);
}

/** A refusal of the wishlist API in the shopper's words (`t.wishlist`). */
export function wishlistErrorMessage(err: unknown, t: Dictionary): string {
  const w = t.wishlist;
  if (!(err instanceof ApiError)) return w.failed;
  if (isShopperSignedOutError(err)) return t.account.signedOut;
  switch (err.code) {
    case "WISHLIST_FULL":
      return w.full;
    case "SHOPPER_ACCOUNTS_OFF":
      return t.account.off;
    case "NOT_FOUND":
      return w.notForSale;
    default:
      return err.status === 429 ? t.account.errors.tooMany : w.failed;
  }
}

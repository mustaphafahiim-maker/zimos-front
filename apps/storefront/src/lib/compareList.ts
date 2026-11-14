"use client";

import { useCallback, useSyncExternalStore } from "react";
import { SPEC_LIMITS } from "@store-builder/api-client";

/**
 * The shopper's compare list: up to four products,
 * kept in this browser per store — «قارن» on a product page adds to it, the
 * compare page reads it. No account and no server state: the list is only
 * ids, with the name and slug each product had when it was added (for the
 * tray's chips and links).
 */

export interface ComparedProduct {
  id: string;
  name: string;
  slug: string;
}

export const COMPARE_MAX = SPEC_LIMITS.compareMax;

const KEY_PREFIX = "zimos_compare_";
const NONE: ComparedProduct[] = [];
const listeners = new Set<() => void>();
// What this page holds, so the list still works (for the page's life) where storage is blocked,
// and so the same array is handed out until it really changes.
const cache = new Map<string, { raw: string; list: ComparedProduct[] }>();

function read(storeId: string): ComparedProduct[] {
  if (!storeId || typeof window === "undefined") return NONE;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(`${KEY_PREFIX}${storeId}`);
  } catch {
    return cache.get(storeId)?.list ?? NONE;
  }
  const known = cache.get(storeId);
  if (known && known.raw === (raw ?? "")) return known.list;
  let list: ComparedProduct[] = NONE;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      list = parsed
        .filter((p): p is ComparedProduct => !!p && typeof p.id === "string" && typeof p.name === "string" && typeof p.slug === "string")
        .slice(0, COMPARE_MAX);
    }
  } catch {
    /* not ours: an empty list */
  }
  cache.set(storeId, { raw: raw ?? "", list });
  return list;
}

function write(storeId: string, list: ComparedProduct[]) {
  const raw = JSON.stringify(list);
  cache.set(storeId, { raw, list });
  try {
    window.localStorage.setItem(`${KEY_PREFIX}${storeId}`, raw);
  } catch {
    /* storage blocked: the list lasts as long as this page */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(KEY_PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export interface CompareList {
  /** In the order they were added. Empty on the server and before hydration. */
  items: ComparedProduct[];
  has: (productId: string) => boolean;
  /** False when the list is full (four products). */
  add: (product: ComparedProduct) => boolean;
  remove: (productId: string) => void;
  clear: () => void;
}

/** The compare list of one store (`storeId` is the store's UUID). */
export function useCompareList(storeId: string | undefined): CompareList {
  const id = storeId ?? "";
  const items = useSyncExternalStore(
    subscribe,
    () => read(id),
    () => NONE
  );
  const add = useCallback(
    (product: ComparedProduct) => {
      const current = read(id);
      if (current.some((p) => p.id === product.id)) return true;
      if (current.length >= COMPARE_MAX) return false;
      write(id, [...current, { id: product.id, name: product.name, slug: product.slug }]);
      return true;
    },
    [id]
  );
  const remove = useCallback((productId: string) => write(id, read(id).filter((p) => p.id !== productId)), [id]);
  const clear = useCallback(() => write(id, []), [id]);
  return { items, has: (productId) => items.some((p) => p.id === productId), add, remove, clear };
}

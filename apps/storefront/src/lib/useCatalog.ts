"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { StorefrontProduct } from "@store-builder/api-client";
import { createStorefrontApiClient } from "./apiClient";

/**
 * The public catalogue, read in the browser. Cart lines only carry a variant,
 * so this is how the cart drawer, the cart page and the checkout show product
 * names and images, and how they pick an order-bump product.
 *
 * One answer is shared by everything on the page that asks: the result is
 * kept at module level per store (and per `limit`), a request already on its
 * way is joined rather than repeated, and a later page of the same visit
 * finds it ready. After FRESH_MS the next caller to mount asks again in the
 * background and keeps showing what it has until the new answer lands.
 *
 * `enabled: false` asks the API nothing (the cart drawer, mounted on every
 * page, has no line to name while the cart is empty); a result another caller
 * already brought is still returned.
 */

/** How long an answer is shown without asking again. */
const FRESH_MS = 5 * 60 * 1000;

interface Entry {
  products: StorefrontProduct[] | null;
  /** When `products` arrived; 0 while there is nothing worth keeping (never asked, or the request failed). */
  fetchedAt: number;
  /** The request on its way, so a second caller joins it. */
  request: Promise<void> | null;
  listeners: Set<() => void>;
}

const entries = new Map<string, Entry>();
/** One lookup map per answer, so every caller hands the same one down. */
const lookups = new WeakMap<StorefrontProduct[], Map<string, StorefrontProduct>>();
const NO_PRODUCTS = new Map<string, StorefrontProduct>();

function entryOf(key: string): Entry {
  let entry = entries.get(key);
  if (!entry) {
    entry = { products: null, fetchedAt: 0, request: null, listeners: new Set() };
    entries.set(key, entry);
  }
  return entry;
}

function publish(entry: Entry, products: StorefrontProduct[], fetchedAt: number) {
  entry.products = products;
  entry.fetchedAt = fetchedAt;
  for (const listen of entry.listeners) listen();
}

function load(workspaceId: string, limit: number) {
  const entry = entryOf(`${workspaceId}:${limit}`);
  if (entry.request) return;
  if (entry.products && entry.fetchedAt > 0 && Date.now() - entry.fetchedAt < FRESH_MS) return;
  entry.request = createStorefrontApiClient()
    .listStorefrontProducts(workspaceId, { limit })
    .then(
      (res) => publish(entry, res.products, Date.now()),
      () => {
        // As before, a failed read is an empty catalogue: the lines fall back to
        // their options. It is not kept, so the next caller to mount asks again.
        if (!entry.products) publish(entry, [], 0);
      }
    )
    .finally(() => {
      entry.request = null;
    });
}

function byVariantOf(products: StorefrontProduct[] | null): Map<string, StorefrontProduct> {
  if (!products) return NO_PRODUCTS;
  let map = lookups.get(products);
  if (!map) {
    map = new Map<string, StorefrontProduct>();
    for (const p of products) for (const v of p.variants) map.set(v.id, p);
    lookups.set(products, map);
  }
  return map;
}

export function useCatalog(workspaceId: string | undefined, limit = 48, { enabled = true }: { enabled?: boolean } = {}) {
  const key = workspaceId ? `${workspaceId}:${limit}` : null;

  const subscribe = useCallback(
    (listen: () => void) => {
      if (!key) return () => {};
      const entry = entryOf(key);
      entry.listeners.add(listen);
      return () => {
        entry.listeners.delete(listen);
      };
    },
    [key]
  );
  const products = useSyncExternalStore(
    subscribe,
    () => (key ? (entries.get(key)?.products ?? null) : null),
    () => null
  );

  useEffect(() => {
    if (workspaceId && enabled) load(workspaceId, limit);
  }, [workspaceId, limit, enabled]);

  return { products, byVariant: byVariantOf(products), loaded: products !== null };
}

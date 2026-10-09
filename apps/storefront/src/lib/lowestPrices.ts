"use client";

import { useEffect, useSyncExternalStore } from "react";
import { LOWEST_PRICES_MAX_IDS, storefrontLowestPrices } from "@store-builder/api-client";
import { createStorefrontApiClient } from "./apiClient";

/**
 * The lowest price a variant really had in the last 30 days (frontend-handoff
 * 234, GET /store/:ws/lowest-prices), for the line shown beside a sale price.
 *
 * A page of product cards asks for many variants at once, so the asks of one
 * moment are sent together — up to 50 ids a call — and every answer is kept
 * for the life of the page. The figure is the server's; nothing here works a
 * price out.
 */

export interface LowestPrice {
  /** Minor units. */
  price: string;
  /** The window the store looked back over, in days. */
  days: number;
}

// `${workspace}:${variant}` → the answer; null once the store was asked and had none (or could not say).
const known = new Map<string, LowestPrice | null>();
const queued = new Map<string, Set<string>>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function flush() {
  timer = null;
  const batches = [...queued.entries()];
  queued.clear();
  const client = createStorefrontApiClient();
  await Promise.all(
    batches.flatMap(([workspaceId, ids]) => {
      const all = [...ids];
      const calls: Promise<void>[] = [];
      for (let i = 0; i < all.length; i += LOWEST_PRICES_MAX_IDS) {
        const chunk = all.slice(i, i + LOWEST_PRICES_MAX_IDS);
        calls.push(
          storefrontLowestPrices(client, workspaceId, chunk)
            .then((answer) => {
              for (const id of chunk) {
                const price = answer.prices[id];
                known.set(`${workspaceId}:${id}`, price ? { price, days: answer.days } : null);
              }
            })
            .catch(() => {
              // No line is better than a wrong one: these variants simply show none.
              for (const id of chunk) known.set(`${workspaceId}:${id}`, null);
            })
        );
      }
      return calls;
    })
  );
  listeners.forEach((l) => l());
}

function ask(workspaceId: string, variantId: string) {
  if (known.has(`${workspaceId}:${variantId}`)) return;
  let ids = queued.get(workspaceId);
  if (!ids) queued.set(workspaceId, (ids = new Set()));
  ids.add(variantId);
  // A short pause gathers the cards of one render into one request.
  if (timer === null) timer = setTimeout(() => void flush(), 40);
}

/** The variant's lowest price of the last 30 days; null until known, and when there is none. Pass no id to ask nothing. */
export function useLowestPrice(workspaceId: string | undefined, variantId: string | null | undefined): LowestPrice | null {
  const key = workspaceId && variantId ? `${workspaceId}:${variantId}` : "";
  useEffect(() => {
    if (workspaceId && variantId) ask(workspaceId, variantId);
  }, [workspaceId, variantId]);
  return useSyncExternalStore(
    subscribe,
    () => (key ? (known.get(key) ?? null) : null),
    () => null
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  SHOPPER_PRICE_LIST_MAX_VARIANTS,
  parseMoney,
  shopperPriceList,
  shopperTierFor,
  type ApiClient,
  type ShopperPriceTier,
  type ShopperVariantPrice,
} from "@store-builder/api-client";
import { useShopperApi } from "@/lib/shopperSession";

/**
 * The signed-in shopper's own prices (handoff 205, GET /store/:ws/price-list):
 * what a variant costs them from each quantity upward, straight from the API —
 * the storefront never works a price out. Every component that asks in the
 * same moment (the product page's note, each cart line) shares one request,
 * and an answer is reused for a minute.
 *
 * A signed-out visitor, a shopper without a price list and a failed read all
 * come out the same way: no price of their own, and the page shows the normal one.
 */

const TTL_MS = 60_000;

interface Known {
  at: number;
  /** null: the shopper pays the normal price for this variant. */
  price: ShopperVariantPrice | null;
}

/** By `${storeId}|${token}|${variantId}`. */
const known = new Map<string, Known>();
/** The shopper's list name(s), by `${storeId}|${token}`. */
const listNames = new Map<string, string | null>();
/** The request being gathered for a shopper, by `${storeId}|${token}`. */
const gathering = new Map<string, { ids: Set<string>; done: Promise<void> }>();

const isFresh = (entry: Known | undefined): entry is Known => Boolean(entry) && Date.now() - (entry as Known).at < TTL_MS;

/** Asks for one variant; the ids asked for in the same tick go out as one request. */
function ask(client: ApiClient, storeId: string, token: string, variantId: string): Promise<void> {
  const scope = `${storeId}|${token}`;
  let batch = gathering.get(scope);
  if (!batch) {
    const ids = new Set<string>();
    const done = new Promise<void>((resolve) => {
      window.setTimeout(() => {
        // Closed: anything asked from now on starts the next request.
        if (gathering.get(scope)?.ids === ids) gathering.delete(scope);
        shopperPriceList(client, storeId, token, [...ids])
          .then((answer) => {
            listNames.set(scope, answer.priceList);
            const prices = new Map(answer.prices.map((price) => [price.variantId, price]));
            for (const id of ids) known.set(`${scope}|${id}`, { at: Date.now(), price: prices.get(id) ?? null });
          })
          .catch(() => {
            // An extra on the page: after a failed read the normal price shows, and it is asked again in a minute.
            for (const id of ids) known.set(`${scope}|${id}`, { at: Date.now(), price: null });
          })
          .finally(resolve);
      }, 0);
    });
    batch = { ids, done };
    gathering.set(scope, batch);
  }
  batch.ids.add(variantId);
  // The API takes 100 ids at a time: a full request closes, and the next id opens another.
  if (batch.ids.size >= SHOPPER_PRICE_LIST_MAX_VARIANTS) gathering.delete(scope);
  return batch.done;
}

export interface ShopperPrice {
  /** True while a signed-in shopper's price is still being read (never for a visitor). */
  loading: boolean;
  /** The variant's prices for this shopper; null when they pay the normal price. */
  price: ShopperVariantPrice | null;
  /** The shopper's price list(s) by name. */
  listName: string | null;
}

const NONE: ShopperPrice = { loading: false, price: null, listName: null };

/** What a variant costs the signed-in shopper, read from the API. */
export function useShopperPrice(variantId: string | null | undefined): ShopperPrice {
  const { storeId, token, client } = useShopperApi();
  const scope = storeId && token ? `${storeId}|${token}` : null;
  const key = scope && variantId ? `${scope}|${variantId}` : null;
  // Bumped when an answer lands, so the component reads the cache again.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!key || !token || !variantId || isFresh(known.get(key))) return;
    let cancelled = false;
    void ask(client, storeId, token, variantId).then(() => {
      if (!cancelled) setTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [key, client, storeId, token, variantId]);

  if (!key || !scope) return NONE;
  const entry = known.get(key);
  // An answer past its minute still shows while the next one is on its way.
  return { loading: !entry, price: entry?.price ?? null, listName: listNames.get(scope) ?? null };
}

export interface YourPrice {
  loading: boolean;
  listName: string | null;
  /** What everyone else pays for a unit, minor units. */
  base: number | null;
  /** What this shopper pays for a unit at this quantity, minor units; null when it is the normal price. */
  unit: number | null;
  /** The quantity the price in `unit` starts from. */
  from: number | null;
  /** Every quantity the shopper pays less from, smallest first. */
  tiers: ShopperPriceTier[];
}

/**
 * The shopper's price for a line of `quantity` units of a variant: the tier it
 * reaches, as the cart and the checkout will price it. `variantId` is left out
 * (null) for a line the price lists never touch — an offer or a bundle.
 */
export function useYourPrice(variantId: string | null | undefined, quantity: number): YourPrice {
  const { loading, price, listName } = useShopperPrice(variantId);
  if (!price) return { loading, listName: null, base: null, unit: null, from: null, tiers: [] };
  const tier = shopperTierFor(price, quantity);
  return {
    loading,
    listName,
    base: parseMoney(price.basePrice),
    unit: tier ? parseMoney(tier.priceAmount) : null,
    from: tier ? tier.minQuantity : null,
    tiers: price.tiers,
  };
}

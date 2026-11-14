"use client";

import { useEffect, useMemo, useState } from "react";
import {
  storefrontProductHasTest,
  storefrontProductTest,
  type StorefrontProduct,
  type StorefrontProductTest,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "./apiClient";
import { getVisitorId } from "./visitorId";

/**
 * A product page's A/B test (catalog/productTests.js), seen by this visitor.
 *
 * The public product says `abTest: true` while a test runs; the page then asks
 * the server which variant this visitor is in (the server pins them — the
 * visitor id is the tab's, lib/visitor) and shows that variant's prices and
 * pictures. The server charges the same price everywhere, so this only has to
 * show it. One request per product, shared by the gallery and the buy box, and
 * asked again after a few minutes in case the merchant ended the test.
 */

const FRESH_MS = 5 * 60 * 1000;
const asked = new Map<string, { at: number; answer: Promise<StorefrontProductTest | null> }>();

function ask(workspaceId: string, productId: string): Promise<StorefrontProductTest | null> {
  const key = `${workspaceId}:${productId}`;
  const hit = asked.get(key);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.answer;
  // A failure shows the product as it is — the server, unassigned, charges that too.
  const answer = storefrontProductTest(createStorefrontApiClient(), workspaceId, productId, getVisitorId(workspaceId)).catch(() => null);
  asked.set(key, { at: Date.now(), answer });
  return answer;
}

/** The product with this visitor's test prices and pictures in place. */
export function applyProductTest<P extends StorefrontProduct>(product: P, test: StorefrontProductTest | null): P {
  if (!test) return product;
  const prices = test.prices ?? {};
  const variants = product.variants.map((v) => (prices[v.id] !== undefined ? { ...v, priceAmount: prices[v.id] } : v));
  return { ...product, variants, ...(test.media && test.media.length > 0 ? { media: test.media } : {}) };
}

/**
 * `product` as this visitor sees it. `pending` is true while the variant is
 * not known yet (only for a product under test): hide what may change.
 */
export function useProductTest<P extends StorefrontProduct>(workspaceId: string, product: P): { product: P; pending: boolean } {
  const testing = storefrontProductHasTest(product);
  const [answer, setAnswer] = useState<{ productId: string; test: StorefrontProductTest | null } | null>(null);

  useEffect(() => {
    if (!testing) return;
    let alive = true;
    void ask(workspaceId, product.id).then((test) => {
      if (alive) setAnswer({ productId: product.id, test });
    });
    return () => {
      alive = false;
    };
  }, [testing, workspaceId, product.id]);

  const known = answer !== null && answer.productId === product.id;
  const test = known ? answer.test : null;
  const shown = useMemo(() => applyProductTest(product, test), [product, test]);
  return { product: shown, pending: testing && !known };
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { StorefrontProduct } from "@store-builder/api-client";
import { createStorefrontApiClient } from "./apiClient";

/**
 * The public catalogue, fetched once in the browser. Cart lines only carry a
 * variant, so this is how the cart/checkout pages show product names and
 * images, and how they pick an order-bump product.
 */
export function useCatalog(workspaceId: string | undefined, limit = 48) {
  const [products, setProducts] = useState<StorefrontProduct[] | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    createStorefrontApiClient()
      .listStorefrontProducts(workspaceId, { limit })
      .then((res) => {
        if (!cancelled) setProducts(res.products);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, limit]);

  const byVariant = useMemo(() => {
    const map = new Map<string, StorefrontProduct>();
    for (const p of products ?? []) for (const v of p.variants) map.set(v.id, p);
    return map;
  }, [products]);

  return { products, byVariant, loaded: products !== null };
}

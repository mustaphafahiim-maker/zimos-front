"use client";

import { useEffect, useMemo, useState } from "react";
import { storefrontProductBumps, type ApiClient, type StorefrontProductBump } from "@store-builder/api-client";
import { orderBumpOf, type OrderBumpOffer } from "@/lib/commerce";
import type { ProductBumpsState } from "./StoreOffers";

/**
 * The order bumps of every product in the cart, for /checkout (SPEC §10.2:
 * the product's own add-ons, not only the store-wide one). One card per
 * offer, however many cart products share it; none for a product already in
 * the cart; `exclude` is the store-wide bump the page shows itself. A rule
 * marked "ticked by default" starts ticked. Same shape as useProductBumps, so
 * ProductBumpCards draws it.
 */
export function useCartBumps(client: ApiClient, workspaceId: string, productIds: string[], exclude?: string | null): ProductBumpsState {
  const key = [...new Set(productIds)].sort().join(",");
  const [rows, setRows] = useState<StorefrontProductBump[]>([]);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!key) {
      setRows([]);
      return;
    }
    let cancelled = false;
    Promise.all(key.split(",").map((id) => storefrontProductBumps(client, workspaceId, id).catch(() => [] as StorefrontProductBump[])))
      .then((lists) => {
        if (cancelled) return;
        const byOffer = new Map<string, StorefrontProductBump>();
        for (const bump of lists.flat()) if (!byOffer.has(bump.offerId)) byOffer.set(bump.offerId, bump);
        const list = [...byOffer.values()];
        setRows(list);
        // After a refusal nothing is ticked for the shopper again.
        setOn(version === 0 ? Object.fromEntries(list.filter((b) => b.preChecked).map((b) => [b.offerId, true])) : {});
      });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId, key, version]);

  const bumps = useMemo(
    () =>
      rows
        .filter((b) => b.offerId !== exclude)
        .map((b) => orderBumpOf(b, key.split(",")))
        .filter((b): b is OrderBumpOffer => b !== null),
    [rows, exclude, key]
  );

  return {
    bumps,
    isOn: (offerId) => Boolean(on[offerId]),
    toggle: (offerId, value) => setOn((current) => ({ ...current, [offerId]: value })),
    selected: bumps.filter((b) => on[b.offerId]),
    reset: () => setVersion((v) => v + 1),
  };
}

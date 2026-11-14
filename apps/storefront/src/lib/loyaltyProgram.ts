"use client";

import { useEffect, useMemo, useState } from "react";
import { storeLoyaltyProgram, type ApiClient, type LoyaltyProgram } from "@store-builder/api-client";
import { createStorefrontApiClient } from "./apiClient";
import { LOYALTY_ENABLED } from "./features";
import { useStore } from "./StoreContext";

/**
 * The store's loyalty programme (GET /store/:ws/loyalty): what a
 * unit of money earns and what a point is worth, or null when the store has
 * none. One request per store for the page's life — the product page, the
 * checkout and the account read the same answer (the API caches it 5 minutes).
 * A failed read is "no programme": points are an extra, never in the way.
 */

const programs = new Map<string, Promise<LoyaltyProgram | null>>();

function load(client: ApiClient, storeRef: string): Promise<LoyaltyProgram | null> {
  const known = programs.get(storeRef);
  if (known) return known;
  const request = storeLoyaltyProgram(client, storeRef).catch(() => {
    // Asked again on the next page: a blip should not hide the programme for the whole visit.
    programs.delete(storeRef);
    return null;
  });
  programs.set(storeRef, request);
  return request;
}

/** undefined while it loads; null when the store has no programme, and always while loyalty points are switched off (lib/features). */
export function useLoyaltyProgram(): LoyaltyProgram | null | undefined {
  const { store } = useStore();
  const storeRef = store?.id ?? "";
  const client = useMemo(() => createStorefrontApiClient(), []);
  const [state, setState] = useState<{ ref: string; program: LoyaltyProgram | null } | null>(null);

  useEffect(() => {
    if (!storeRef || !LOYALTY_ENABLED) return;
    let cancelled = false;
    void load(client, storeRef).then((program) => {
      if (!cancelled) setState({ ref: storeRef, program });
    });
    return () => {
      cancelled = true;
    };
  }, [client, storeRef]);

  if (!LOYALTY_ENABLED) return null;
  return state && state.ref === storeRef ? state.program : undefined;
}

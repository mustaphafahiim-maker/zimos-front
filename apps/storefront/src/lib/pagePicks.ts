"use client";

import { useEffect } from "react";

/**
 * What the shopper picked on a page's own pickers (the builder's
 * variant_selector and bundle_selector) for one product: kept for the visit
 * (sessionStorage) and announced on the page, so the order form beside them
 * and the funnel's checkout start from the same choice.
 */

export type PickKind = "variant" | "offer";
const EVENT = "zimos:pick";
const keyOf = (kind: PickKind, productId: string) => `zimos:pick:${kind}:${productId}`;

export function readPick(kind: PickKind, productId: string): string | null {
  try {
    return window.sessionStorage.getItem(keyOf(kind, productId));
  } catch {
    return null;
  }
}

export function writePick(kind: PickKind, productId: string, value: string) {
  try {
    window.sessionStorage.setItem(keyOf(kind, productId), value);
  } catch {
    /* private mode: the page still follows the pick below */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { kind, productId, value } }));
}

/** Calls `onPick` whenever the shopper picks on this page for this product. */
export function usePick(kind: PickKind, productId: string, onPick: (value: string) => void) {
  useEffect(() => {
    const listener = (e: Event) => {
      const detail = (e as CustomEvent<{ kind: PickKind; productId: string; value: string }>).detail;
      if (detail && detail.kind === kind && detail.productId === productId) onPick(detail.value);
    };
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
  }, [kind, productId, onPick]);
}

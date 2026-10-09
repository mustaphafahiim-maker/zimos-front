import { useLayoutEffect, useSyncExternalStore } from "react";

/**
 * The variants section offers «عدّل الكل في جدول» in its own head. A page that
 * also renders the stand-alone `VariantBulkEditor` button for the same product
 * would then show two doors to one table; this is how the button learns that
 * the section already has it, and steps aside.
 */
const offered = new Map<string, number>();
const listeners = new Set<() => void>();

function tell() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called by the section while it shows the table's entry for this product. */
export function useOffersBulkTable(productId: string, offers: boolean): void {
  // Before paint, so the stand-alone button never shows for a frame beside the section.
  useLayoutEffect(() => {
    if (!offers) return undefined;
    offered.set(productId, (offered.get(productId) ?? 0) + 1);
    tell();
    return () => {
      const left = (offered.get(productId) ?? 1) - 1;
      if (left <= 0) offered.delete(productId);
      else offered.set(productId, left);
      tell();
    };
  }, [productId, offers]);
}

/** Whether a mounted variants section already opens the table for this product. */
export function useBulkTableOffered(productId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => offered.has(productId),
    () => false
  );
}

import { useSyncExternalStore } from "react";
import type { StorefrontProduct } from "@store-builder/api-client";
import { firstImage } from "./product";

/**
 * A variant's own picture (SPEC §7.2; GET /store/:ws/products → variants[].imageUrl).
 *
 *   - the cart shows the line's variant picture, else the product's first;
 *   - the product page's gallery leads with the chosen variant's picture: the
 *     form (ProductLanding) says which variant is chosen and the gallery —
 *     a separate part of the page — listens, through the small store below.
 */

export function variantImageOf(variant: unknown): string | null {
  const url = (variant as { imageUrl?: unknown } | null | undefined)?.imageUrl;
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
}

/** A cart or order line's picture: its variant's, else the product's first. */
export function lineImage(product: StorefrontProduct, variantId: string | null | undefined): string | null {
  const variant = variantId ? product.variants.find((v) => v.id === variantId) : undefined;
  return variantImageOf(variant) ?? firstImage(product);
}

// --- the chosen variant's picture, per product, for the gallery -------------------

const chosen = new Map<string, string | null>();
const listeners = new Set<() => void>();

export function setChosenVariantImage(productId: string, url: string | null): void {
  if ((chosen.get(productId) ?? null) === url) return;
  chosen.set(productId, url);
  for (const listen of listeners) listen();
}

function subscribe(listen: () => void) {
  listeners.add(listen);
  return () => listeners.delete(listen);
}

/** The picture of the variant chosen on this product's page; null until one with a picture is chosen. */
export function useChosenVariantImage(productId: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => chosen.get(productId) ?? null,
    () => null
  );
}

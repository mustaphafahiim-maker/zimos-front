import { useMemo } from "react";
import type { Product, Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatOptions } from "@/lib/format";

/** A price list may name any product of the store, so the editor reads up to this many pages of 200. */
const PAGES = 5;
export const PRICE_LIST_CATALOG_CAP = PAGES * 200;

interface Loaded {
  products: Product[];
  /** False when the store has more products than the editor reads. */
  complete: boolean;
}

async function load(workspaceId: string): Promise<Loaded> {
  const products: Product[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < PAGES; page += 1) {
    // Archived ones too: a list may still hold a price for a product that was archived since.
    const result = await apiClient.listProducts(workspaceId, { status: ["draft", "active", "archived"], limit: 200, cursor });
    products.push(...result.products);
    if (!result.nextCursor) return { products, complete: true };
    cursor = result.nextCursor;
  }
  return { products, complete: false };
}

export interface VariantRef {
  product: Product;
  variant: Variant;
}

/**
 * The store's products for the price list editor (the newest 1,000 at most):
 * the ones that can be picked (draft or on sale), and every variant — archived
 * products included — findable by its id, to name the prices a list holds.
 */
export function usePriceListCatalog() {
  const workspaceId = useWorkspaceId();
  const state = useAsync(() => load(workspaceId), [workspaceId]);
  const all = state.data?.products;
  return useMemo(() => {
    const variants = new Map<string, VariantRef>();
    for (const product of all ?? []) {
      for (const variant of product.variants ?? []) variants.set(variant.id, { product, variant });
    }
    return {
      /** Draft and on-sale products: what the pickers offer. */
      products: (all ?? []).filter((product) => product.status !== "archived"),
      /** Every product id the store still has, when the whole catalogue was read; null otherwise. */
      knownProductIds: state.data?.complete ? new Set((all ?? []).map((product) => product.id)) : null,
      variants,
      complete: state.data?.complete ?? true,
      loading: state.loading,
      error: state.error,
    };
  }, [all, state.data?.complete, state.loading, state.error]);
}

/** "Size: L · Colour: Black" for a variant of a product with options; "" for a product sold one way. */
export function variantOptionsLabel(ref: VariantRef): string {
  if ((ref.product.variants?.length ?? 0) <= 1) return "";
  return formatOptions(ref.variant.optionValues) || ref.variant.sku || "";
}

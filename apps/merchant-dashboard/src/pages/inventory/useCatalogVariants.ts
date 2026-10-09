import { useEffect, useMemo, useState } from "react";
import type { Product, ProductListParams, Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { variantDetail } from "./inventoryText";
import type { PickVariant } from "./VariantAddRow";

/** Most products one read of the catalog returns (the API's cap). */
const CATALOG_LIMIT = 200;

/**
 * The store's products with their variants, for a picker: the first 200,
 * newest first — the list the other pickers in the dashboard read — narrowed
 * by a product-name search once the store has more than fit.
 */
export function useCatalogVariants(workspaceId: string) {
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const catalog = useAsync(
    () =>
      apiClient.listProducts(workspaceId, {
        status: ["active", "draft"],
        limit: CATALOG_LIMIT,
        // The API's list takes a name search; the shared params type predates it.
        ...(q ? { q } : {}),
      } as ProductListParams),
    [workspaceId, q]
  );

  const products: Product[] = useMemo(() => catalog.data?.products ?? [], [catalog.data]);
  const variants = useMemo(() => {
    const out: Array<PickVariant & { variant: Variant }> = [];
    for (const product of products) {
      for (const variant of product.variants ?? []) {
        if (variant.status === "archived") continue;
        out.push({
          variantId: variant.id,
          productId: product.id,
          productName: product.name,
          detail: variantDetail(variant.optionValues, variant.sku),
          variant,
        });
      }
    }
    return out;
  }, [products]);

  return {
    products,
    variants,
    loading: catalog.loading,
    failed: Boolean(catalog.error),
    query,
    setQuery,
    /** True when a search is worth showing: the list was cut short, or one is running. */
    searchable: q !== "" || Boolean(catalog.data?.nextCursor),
  };
}

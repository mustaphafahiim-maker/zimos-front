"use client";

import { useState } from "react";
import type { StorefrontProduct } from "@store-builder/api-client";
import { ProductCard } from "@/components/ProductCard";
import { btnSecondary } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { PAGE_SIZE } from "@/lib/publicApi";
import { useStore } from "@/lib/StoreContext";

/**
 * Product grid with "Load more" over the API's keyset cursor (`nextCursor` →
 * `cursor`). The API orders by id only and has no sort param, so there is no
 * sort control. Parents key this by query so a new search starts fresh.
 */
export function ProductBrowser({
  workspaceId,
  initialProducts,
  initialCursor,
  collectionId,
  search,
  emptyText,
}: {
  workspaceId: string;
  initialProducts: StorefrontProduct[];
  initialCursor: string | null;
  collectionId?: string;
  search?: string;
  emptyText: string;
}) {
  const { t, locale, store } = useStore();
  const [products, setProducts] = useState(initialProducts);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const currency = store?.currency ?? "EGP";

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await createStorefrontApiClient().listStorefrontProducts(workspaceId, {
        limit: PAGE_SIZE,
        cursor,
        collectionId,
        search,
      });
      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.products.filter((p) => !seen.has(p.id))];
      });
      setCursor(res.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (products.length === 0) {
    return (
      <p
        role="status"
        className="mt-8 rounded-2xl border border-dashed border-line-strong bg-paper-raised py-16 text-center text-sm text-ink-soft"
      >
        {emptyText}
      </p>
    );
  }

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} workspaceId={workspaceId} currency={currency} locale={locale} />
        ))}
      </div>
      <div className="mt-8 flex flex-col items-center gap-2" aria-live="polite">
        {error && <p className="text-sm text-danger">{t.browse.loadFailed}</p>}
        {cursor && (
          <button type="button" onClick={loadMore} disabled={loading} aria-busy={loading} className={btnSecondary}>
            {loading ? t.browse.loadingMore : t.browse.loadMore}
          </button>
        )}
      </div>
    </>
  );
}

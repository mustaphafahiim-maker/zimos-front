"use client";

import { useEffect, useState } from "react";
import {
  fillThankYouContent,
  type StorefrontProduct,
  type ThankYouPageSettings,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { ProductCard } from "./ProductCard";
import { card, skeleton } from "./ui";

/**
 * The merchant's own words on the thank-you page (settings → thank-you page):
 * plain text, one paragraph per line, with the order number and the shopper's
 * name filled in. Printed as text — nothing in it is treated as markup.
 */
export function ThankYouMessage({
  page,
  orderNumber,
  customerName,
}: {
  page: ThankYouPageSettings;
  orderNumber: string | null;
  customerName: string | null;
}) {
  if (!page.enabled || !page.content.trim()) return null;
  const paragraphs = fillThankYouContent(page.content, { orderNumber, customerName })
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    <section className={`${card} mt-6 space-y-2 p-5 text-sm leading-relaxed text-ink sm:p-6`}>
      {paragraphs.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </section>
  );
}

/**
 * Products from the collection the merchant chose to show after an order.
 * While they are being read, the grid's outline holds their place (the
 * merchant asked for them, so there is one to hold); an empty or removed
 * collection gives it back.
 */
export function ThankYouProducts({ workspaceId, collectionId }: { workspaceId: string; collectionId: string }) {
  const { t, locale, store } = useStore();
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  // The collection the grid last got an answer for — products, none, or a failure.
  const [answered, setAnswered] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createStorefrontApiClient()
      .listStorefrontProducts(workspaceId, { collectionId, limit: 4 })
      .then((list) => {
        if (cancelled) return;
        setProducts(list.products.slice(0, 4));
        setAnswered(collectionId);
      })
      .catch(() => {
        /* a removed collection simply shows nothing */
        if (!cancelled) setAnswered(collectionId);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, collectionId]);

  if (products.length === 0) {
    if (answered === collectionId) return null;
    return (
      <div aria-hidden className="mt-10">
        <div className={`${skeleton} mx-auto h-7 w-44 max-w-full`} />
        <div className="mt-4 grid grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i}>
              <div className={`${skeleton} aspect-square w-full`} />
              <div className={`${skeleton} mt-3 h-4 w-3/4`} />
              <div className={`${skeleton} mt-2 h-4 w-1/3`} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <section className="mt-10" aria-labelledby="thanks-products-title">
      <h2 id="thanks-products-title" className="text-center text-lg font-semibold text-ink">
        {t.thankYou.moreProducts}
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} currency={store?.currency ?? "EGP"} locale={locale} />
        ))}
      </div>
    </section>
  );
}

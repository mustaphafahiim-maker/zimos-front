import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError, formatMoney } from "@store-builder/api-client";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreMeta } from "@/lib/storeMeta";
import { AddToCartButton } from "@/components/AddToCartButton";
import { StoreLink } from "@/components/StoreRoute";

export const revalidate = 60;

/**
 * Deduped per request so `generateMetadata` and the page itself share one
 * call — the same reason `getStoreMeta` is cached.
 *
 * Returns null for a product that isn't there, so callers can `notFound()`.
 */
const getProduct = cache(async (workspaceId: string, idOrSlug: string) => {
  const client = await createServerStorefrontApiClient();
  return client.getStorefrontProduct(workspaceId, idOrSlug).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
});

/**
 * The canonical URL is built from the product's slug, not from the `idOrSlug`
 * that was asked for: the API answers to either, and only one of them should
 * be the address search engines keep. It stays relative so the store layout's
 * `metadataBase` resolves it onto the store's own subdomain.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string; idOrSlug: string }>;
}): Promise<Metadata> {
  const { workspaceId, idOrSlug } = await params;
  const product = await getProduct(workspaceId, idOrSlug);
  if (!product) return {};

  return {
    title: product.name,
    description: product.description ?? undefined,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description: product.description ?? undefined,
      url: `/products/${product.slug}`,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ workspaceId: string; idOrSlug: string }>;
}) {
  const { workspaceId, idOrSlug } = await params;

  // Both are React-cached, so this shares the fetches the layout and
  // generateMetadata already made.
  const [store, product] = await Promise.all([
    getStoreMeta(workspaceId),
    getProduct(workspaceId, idOrSlug),
  ]);

  if (!store || !product) notFound();

  const defaultOffer = product.offers.find((o) => o.isDefault) ?? product.offers[0];
  const price = defaultOffer?.priceAmount ?? product.variants[0]?.priceAmount;
  // No variant picker yet — default to the first in-stock variant.
  const purchasableVariant =
    product.variants.find((v) => v.inStock) ?? product.variants[0];

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-10">
      <StoreLink href="/" className="text-sm text-primary hover:underline">
        ← Back to {store.name}
      </StoreLink>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="aspect-square rounded-[var(--radius-card)] bg-primary-soft" />

        <div>
          <h1 className="font-display text-2xl font-medium text-ink">{product.name}</h1>
          {price !== undefined && (
            <p className="mt-2 text-xl text-primary-dark">{formatMoney(price, store.currency)}</p>
          )}
          {product.description && (
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">{product.description}</p>
          )}

          <div className="mt-6 space-y-2">
            {product.variants.map((variant) => (
              <div
                key={variant.id}
                className="flex items-center justify-between rounded-[0.5rem] border border-line px-4 py-2 text-sm"
              >
                <span>{Object.values(variant.optionValues).join(" / ") || variant.sku}</span>
                <span className={variant.inStock ? "text-ink-soft" : "text-danger"}>
                  {variant.inStock ? "In stock" : "Out of stock"}
                </span>
              </div>
            ))}
          </div>

          <AddToCartButton
            variantId={purchasableVariant?.id}
            offerId={defaultOffer?.id}
            disabled={!purchasableVariant?.inStock}
          />
        </div>
      </div>
    </main>
  );
}

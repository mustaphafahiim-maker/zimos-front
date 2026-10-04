import type { StorefrontProductDetail } from "@store-builder/api-client";
import { ProductCard } from "@/components/ProductCard";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getDictionary, type Locale } from "@/lib/i18n";

const SHOWN = 4;

/**
 * "Similar products" under a product (SPEC §7.3; page settings →
 * hide_related_products hides it): other products from its first collection,
 * else the store's newest. Nothing when there is nothing else to show.
 */
export async function RelatedProducts({
  workspaceId,
  product,
  currency,
  locale,
}: {
  workspaceId: string;
  product: StorefrontProductDetail;
  currency: string;
  locale: Locale;
}) {
  const client = await createServerStorefrontApiClient();
  const collectionId = ((product as { collectionIds?: string[] }).collectionIds ?? [])[0];
  const others = async (params: { collectionId?: string }) =>
    (await client.listStorefrontProducts(workspaceId, { ...params, limit: SHOWN + 1 }).catch(() => ({ products: [] }))).products.filter(
      (p) => p.id !== product.id
    );
  let products = collectionId ? await others({ collectionId }) : [];
  if (products.length === 0) products = await others({});
  if (products.length === 0) return null;

  const t = getDictionary(locale);
  return (
    <section aria-labelledby="related-products" className="mt-12">
      <h2 id="related-products" className="text-lg font-semibold text-ink">
        {t.catalog.related}
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {products.slice(0, SHOWN).map((p) => (
          <ProductCard key={p.id} product={p} currency={currency} locale={locale} />
        ))}
      </div>
    </section>
  );
}

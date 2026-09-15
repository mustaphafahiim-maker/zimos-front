import Link from "next/link";
import { ApiError, type StorefrontProduct } from "@store-builder/api-client";
import type { CollectionListQuery, ProductGridQuery, ProductRef } from "@store-builder/store-renderer";
import { formatPrice, getDictionary, type Locale } from "@/lib/i18n";
import { getOrderBump } from "@/lib/offers";
import { compareAtOf, defaultOfferOf, firstImage, offerAppliesTo, priceOf, productImages } from "@/lib/product";
import { ratingOf } from "@/lib/publicApi";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStorefrontProduct } from "@/lib/storeMeta";
import { AddToCartButton } from "../AddToCartButton";
import { ArrowIcon, BoxIcon } from "../Icons";
import { ProductCard } from "../ProductCard";
import { ProductGallery } from "../product/ProductGallery";
import { ProductLanding } from "../product/ProductLanding";
import { btnPrimary } from "../ui";

/**
 * Commerce slots for the shared renderer. Async server components that read
 * the public storefront API — shoppers only ever see the merchant's real
 * catalogue. A failed call renders nothing: one misconfigured block must not
 * 500 a live store.
 */

/** Tailwind can't build class names from a runtime number, so map them. */
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-4 lg:grid-cols-6",
};

async function listProducts(workspaceId: string, limit: number, collectionId?: string): Promise<StorefrontProduct[]> {
  try {
    const client = await createServerStorefrontApiClient();
    const { products } = await client.listStorefrontProducts(workspaceId, { limit, collectionId: collectionId || undefined });
    return products;
  } catch {
    return [];
  }
}

async function resolveProduct(workspaceId: string, productId: string) {
  const slugOrId = productId || (await listProducts(workspaceId, 1))[0]?.slug;
  if (!slugOrId) return null;
  try {
    return await getStorefrontProduct(workspaceId, slugOrId);
  } catch (err) {
    if (err instanceof ApiError) return null;
    throw err;
  }
}

function BlockTitle({ children }: { children: string }) {
  if (!children.trim()) return null;
  return <h2 className="mb-5 text-2xl font-bold text-ink">{children}</h2>;
}

/**
 * `product_list`. The public endpoint has no sort parameter, so `source`
 * ("newest" / "featured" / "best_selling") can't be honoured yet and all
 * render catalogue order — better than mislabelling an arbitrary list.
 */
export async function ProductGridBlock({
  query,
  workspaceId,
  currency,
  locale,
}: {
  query: ProductGridQuery;
  workspaceId: string;
  currency: string;
  locale: Locale;
}) {
  const products = await listProducts(workspaceId, query.limit, query.collectionId);
  if (products.length === 0) return null;
  return (
    <div>
      <BlockTitle>{query.title}</BlockTitle>
      <ul className={`grid gap-3 sm:gap-5 ${GRID_COLS[query.columns] ?? GRID_COLS[4]}`}>
        {products.map((product) => (
          <li key={product.id} className="flex">
            <ProductCard product={product} workspaceId={workspaceId} currency={currency} locale={locale} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** `product_card` (variant "card") — one product spotlit beside its details. */
export async function ProductCardBlock({
  productRef,
  workspaceId,
  currency,
  locale,
}: {
  productRef: ProductRef;
  workspaceId: string;
  currency: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const product = await resolveProduct(workspaceId, productRef.productId);
  if (!product) return null;

  const price = priceOf(product);
  const compareAt = compareAtOf(product);
  const variant = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const offer = defaultOfferOf(product);
  const image = firstImage(product);
  const href = `/store/${workspaceId}/products/${product.slug}`;

  return (
    <div>
      <BlockTitle>{productRef.title}</BlockTitle>
      <div className="grid gap-6 rounded-2xl border border-line bg-paper-raised p-4 shadow-card sm:grid-cols-2 sm:p-6">
        <div className="zr-pcard__media overflow-hidden rounded-2xl bg-zimos-cloud">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={product.name} width={600} height={600} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-primary/40">
              <BoxIcon size={56} />
            </div>
          )}
        </div>
        <div className="flex flex-col text-start">
          <h3 className="text-xl font-bold text-ink sm:text-2xl">{product.name}</h3>
          {productRef.showPrice && price !== undefined && (
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-extrabold text-ink">{formatPrice(price, currency, locale)}</span>
              {compareAt && <span className="zr-pcard__compare text-base text-ink-muted line-through">{formatPrice(compareAt, currency, locale)}</span>}
            </p>
          )}
          {product.description && <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-ink-soft">{product.description}</p>}
          <div className="mt-auto space-y-3 pt-5">
            <Link href={`${href}#order-form`} className={`${btnPrimary} w-full`}>
              {t.product.orderNow}
            </Link>
            {productRef.showBuyButton && (
              <AddToCartButton
                variant="secondary"
                variantId={variant?.id}
                offerId={offer && offerAppliesTo(offer, variant?.id) ? offer.id : undefined}
                disabled={!variant?.inStock}
              />
            )}
            <Link href={href} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              {t.renderer.viewDetails}
              <ArrowIcon size={16} className="rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * `product_card` (variant "landing") — the full COD landing block: gallery,
 * variants/bundles and the real quick order form, same as the product page.
 */
export async function FeaturedProductBlock({
  productRef,
  workspaceId,
}: {
  productRef: ProductRef;
  workspaceId: string;
  /** Passed by the renderer for every block; the landing reads the locale from the store context. */
  locale: Locale;
}) {
  const product = await resolveProduct(workspaceId, productRef.productId);
  if (!product) return null;
  const catalogue = await listProducts(workspaceId, 24);
  const bump = getOrderBump(catalogue, [product.id]);

  return (
    <div className="grid gap-6 rounded-2xl border border-line bg-paper-raised p-4 shadow-card sm:p-6 md:grid-cols-2 lg:gap-10">
      <div className="md:sticky md:top-24 md:self-start">
        <ProductGallery images={productImages(product)} name={product.name} />
      </div>
      <ProductLanding workspaceId={workspaceId} product={product} bump={bump} countdownHours={null} rating={ratingOf(product)} headingLevel="h2" />
    </div>
  );
}

export async function AddToCartBlock({ productRef, workspaceId }: { productRef: ProductRef; workspaceId: string }) {
  const product = await resolveProduct(workspaceId, productRef.productId);
  if (!product) return null;
  const variant = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const offer = defaultOfferOf(product);
  return (
    <AddToCartButton
      variantId={variant?.id}
      offerId={offer && offerAppliesTo(offer, variant?.id) ? offer.id : undefined}
      disabled={!variant?.inStock}
    />
  );
}

/** `collection_list` — cards linking to each collection page. */
export async function CollectionListBlock({
  query,
  workspaceId,
  locale,
}: {
  query: CollectionListQuery;
  workspaceId: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  let collections;
  try {
    const client = await createServerStorefrontApiClient();
    collections = await client.listStorefrontCollections(workspaceId);
  } catch {
    return null;
  }
  const shown = collections.slice(0, query.limit);
  if (shown.length === 0) return null;

  return (
    <div>
      <BlockTitle>{query.title}</BlockTitle>
      <ul className={`grid gap-3 sm:gap-4 ${GRID_COLS[query.columns] ?? GRID_COLS[3]}`}>
        {shown.map((collection) => (
          <li key={collection.id} className="flex">
            <Link
              href={`/store/${workspaceId}/collections/${encodeURIComponent(collection.slug || collection.id)}`}
              className="group relative flex min-h-36 w-full flex-col justify-end overflow-hidden rounded-2xl border border-line bg-paper-raised p-5 text-start transition-[border-color,box-shadow] hover:border-primary hover:shadow-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-44"
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,var(--color-primary-soft),transparent_60%)] transition-opacity group-hover:opacity-80"
              />
              <span aria-hidden className="absolute -end-6 -top-6 size-24 rounded-full border-[14px] border-primary/10" />
              <span className="relative text-lg font-bold text-ink">{collection.name}</span>
              {collection.description && <span className="relative mt-1 line-clamp-2 text-sm text-ink-soft">{collection.description}</span>}
              <span className="relative mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                {t.home.heroCta}
                <ArrowIcon size={16} className="transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

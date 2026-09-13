import Link from "next/link";
import { ApiError, type StorefrontProduct } from "@store-builder/api-client";
import { formatPrice, getDictionary, type Locale } from "@/lib/i18n";
import { compareAtOf, defaultOfferOf, firstImage, offerAppliesTo, priceOf } from "@/lib/product";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductCard } from "@/components/ProductCard";
import { BoxIcon } from "@/components/Icons";
import { btnPrimary } from "@/components/ui";
import { CartSummary } from "./CartSummary";
import { COLUMN_CLASS, type Props, bool, num, str } from "./props";

/**
 * The four commerce element types. Each is an async server component that
 * fetches from the public storefront API, so what a shopper sees is the
 * merchant's real catalogue — never sample data.
 *
 * A failed catalogue call renders nothing rather than taking the whole page
 * down: one misconfigured block should not 500 a live storefront.
 */

async function listProducts(workspaceId: string, limit: number): Promise<StorefrontProduct[]> {
  try {
    const client = await createServerStorefrontApiClient();
    const { products } = await client.listStorefrontProducts(workspaceId, { limit });
    return products;
  } catch {
    return [];
  }
}

function BlockTitle({ children }: { children: string }) {
  if (!children.trim()) return null;
  return <h2 className="mb-5 text-2xl font-bold text-ink">{children}</h2>;
}

/**
 * `product_list`.
 *
 * `source` ("newest" | "featured" | "best_selling") is stored by the editor but
 * cannot be honoured yet: the public products endpoint takes only
 * collection/tag/search/limit and always orders by id (see
 * storefrontService.listProducts). All three therefore render the same
 * catalogue order — the alternative, silently mislabelling an arbitrary list as
 * "best selling", would be worse. Wire this up when the API grows a sort param.
 */
export async function ProductListElement({
  props,
  workspaceId,
  currency,
  locale,
}: {
  props: Props;
  workspaceId: string;
  currency: string;
  locale: Locale;
}) {
  const limit = num(props, "limit", 8, 1, 48);
  const columns = num(props, "columns", 4, 1, 6);
  const products = await listProducts(workspaceId, limit);
  if (products.length === 0) return null;

  return (
    <div>
      <BlockTitle>{str(props, "title")}</BlockTitle>
      <div className={`grid gap-3 sm:gap-5 ${COLUMN_CLASS[columns]}`}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} workspaceId={workspaceId} currency={currency} locale={locale} />
        ))}
      </div>
    </div>
  );
}

/**
 * `product_card` — one product, spotlit. `productId` may be a product id or a
 * slug (the API accepts either); when it's empty the editor's own hint says the
 * newest product is used, which here means the first the catalogue returns.
 */
export async function ProductCardElement({
  props,
  workspaceId,
  currency,
  locale,
}: {
  props: Props;
  workspaceId: string;
  currency: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const productId = str(props, "productId").trim();
  const client = await createServerStorefrontApiClient();

  let product: StorefrontProduct | null = null;
  try {
    product = productId
      ? await client.getStorefrontProduct(workspaceId, productId)
      : ((await listProducts(workspaceId, 1))[0] ?? null);
  } catch (err) {
    // A deleted or unpublished product is a 404 — drop the block, don't crash.
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
  }
  if (!product) return null;

  const price = priceOf(product);
  const compareAt = compareAtOf(product);
  const variant = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const offer = defaultOfferOf(product);
  const image = firstImage(product);
  const href = `/store/${workspaceId}/products/${product.slug}`;

  return (
    <div>
      <BlockTitle>{str(props, "title")}</BlockTitle>
      <div className="grid gap-6 rounded-2xl border border-line bg-paper-raised p-5 shadow-card sm:grid-cols-2 sm:p-6">
        <div className="aspect-square overflow-hidden rounded-2xl bg-zimos-cloud dark:bg-primary-soft">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" width={600} height={600} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-primary/40">
              <BoxIcon size={56} />
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <h3 className="text-xl font-bold text-ink">{product.name}</h3>
          {bool(props, "showPrice", true) && price !== undefined && (
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-bold text-ink">{formatPrice(price, currency, locale)}</span>
              {compareAt && (
                <span className="text-base text-ink-muted line-through">{formatPrice(compareAt, currency, locale)}</span>
              )}
            </p>
          )}
          {product.description && (
            <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-ink-soft">{product.description}</p>
          )}
          <div className="mt-auto space-y-3 pt-5">
            <Link href={`${href}#order-form`} className={`${btnPrimary} w-full`}>
              {t.product.orderNow}
            </Link>
            {bool(props, "showBuyButton", true) ? (
              <AddToCartButton
                variant="secondary"
                variantId={variant?.id}
                offerId={offer && offerAppliesTo(offer, variant?.id) ? offer.id : undefined}
                disabled={!variant?.inStock}
              />
            ) : null}
            <Link
              href={href}
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
            >
              {t.renderer.viewDetails}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * `collection_list`. Each card links to the store home filtered by that
 * collection (`?collection=<id>`), which the home catalogue honours through the
 * public products endpoint's `collectionId` filter.
 */
export async function CollectionListElement({
  props,
  workspaceId,
}: {
  props: Props;
  workspaceId: string;
}) {
  const limit = num(props, "limit", 6, 1, 24);
  const columns = num(props, "columns", 3, 1, 6);

  let collections;
  try {
    const client = await createServerStorefrontApiClient();
    collections = await client.listStorefrontCollections(workspaceId);
  } catch {
    return null;
  }
  const shown = collections.slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <div>
      <BlockTitle>{str(props, "title")}</BlockTitle>
      <div className={`grid gap-4 ${COLUMN_CLASS[columns]}`}>
        {shown.map((collection) => (
          <Link
            key={collection.id}
            href={`/store/${workspaceId}?collection=${encodeURIComponent(collection.id)}#products`}
            className="block rounded-2xl border border-line bg-paper-raised p-5 transition-colors hover:border-primary"
          >
            <h3 className="font-semibold text-ink">{collection.name}</h3>
            {collection.description && (
              <p className="mt-1 line-clamp-3 text-sm text-ink-soft">{collection.description}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** `cart` — a live count plus a link into the real cart page. */
export function CartElement({ props, workspaceId }: { props: Props; workspaceId: string }) {
  return <CartSummary title={str(props, "title")} workspaceId={workspaceId} />;
}

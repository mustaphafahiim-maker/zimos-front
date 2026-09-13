import Link from "next/link";
import type { StorefrontProduct } from "@store-builder/api-client";
import { formatPrice, getDictionary, type Locale } from "@/lib/i18n";
import { compareAtOf, discountPercent, firstImage, priceOf } from "@/lib/product";
import { BoxIcon } from "./Icons";

export function ProductCard({
  product,
  workspaceId,
  currency,
  locale,
}: {
  product: StorefrontProduct;
  workspaceId: string;
  currency: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const price = priceOf(product);
  const compareAt = compareAtOf(product);
  const pct = price !== undefined ? discountPercent(price, compareAt) : null;
  const anyInStock = product.variants.some((v) => v.inStock);
  const image = firstImage(product);
  const href = `/store/${workspaceId}/products/${product.slug}`;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-pop">
      <div className="relative aspect-square overflow-hidden bg-zimos-cloud dark:bg-primary-soft">
        {image ? (
          // Merchant media are arbitrary remote URLs (no next/image allowlist).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            width={600}
            height={600}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <BoxIcon size={48} />
          </div>
        )}
        {pct && (
          <span className="absolute start-3 top-3 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white">
            {t.common.save(pct)}
          </span>
        )}
        {!anyInStock && (
          <span className="absolute end-3 top-3 rounded-full bg-paper-raised/95 px-2.5 py-1 text-xs font-semibold text-danger">
            {t.common.outOfStock}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink sm:text-base">
          {/* The whole card is clickable via this stretched link. */}
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-bold text-ink">
            {price !== undefined ? formatPrice(price, currency, locale) : "—"}
          </span>
          {compareAt && (
            <span className="text-sm text-ink-muted line-through">{formatPrice(compareAt, currency, locale)}</span>
          )}
        </p>
        <span
          aria-hidden
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors group-hover:bg-primary/90 group-has-[a:focus-visible]:outline-2 group-has-[a:focus-visible]:outline-offset-2 group-has-[a:focus-visible]:outline-primary"
        >
          {anyInStock ? t.product.orderNow : t.product.viewDetails}
        </span>
      </div>
    </article>
  );
}

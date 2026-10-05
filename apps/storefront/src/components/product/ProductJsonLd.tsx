import type { StorefrontProductDetail } from "@store-builder/api-client";
import { priceOf, productImages } from "@/lib/product";

/**
 * schema.org Product markup for a product page: name, images, the price as an
 * Offer, and an AggregateRating only when the product has real approved
 * reviews — never an invented one. `priceOf` is in minor units; the markup
 * wants a decimal string.
 */
export function ProductJsonLd({
  product,
  url,
  currency,
  storeName,
}: {
  product: StorefrontProductDetail;
  /** The product's public address. */
  url: string;
  currency: string;
  storeName: string;
}) {
  const price = priceOf(product);
  const inStock = product.variants.some((v) => v.inStock);
  // The API sends { average, count } over approved reviews (older builds: a bare number).
  const rating = product.rating as unknown as { average?: number | null; count?: number } | number | null;
  const average = typeof rating === "number" ? rating : (rating?.average ?? null);
  const reviewCount =
    typeof rating === "object" && rating !== null && typeof rating.count === "number"
      ? rating.count
      : Array.isArray(product.reviews)
        ? product.reviews.length
        : 0;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description ? { description: String(product.description).slice(0, 5000) } : {}),
    ...(productImages(product).length > 0 ? { image: productImages(product).slice(0, 8) } : {}),
    brand: { "@type": "Brand", name: storeName },
    url,
    ...(price !== undefined
      ? {
          offers: {
            "@type": "Offer",
            url,
            priceCurrency: currency,
            price: (price / 100).toFixed(2),
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        }
      : {}),
    ...(typeof average === "number" && average > 0 && reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: average.toFixed(1),
            reviewCount,
          },
        }
      : {}),
  };

  // "<" is escaped so nothing in a product name or description can close the script tag.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

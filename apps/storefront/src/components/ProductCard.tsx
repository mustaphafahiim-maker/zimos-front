import { formatMoney, type StorefrontProduct } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";

export function ProductCard({
  product,
  currency,
}: {
  product: StorefrontProduct;
  currency: string;
}) {
  const defaultOffer = product.offers.find((o) => o.isDefault) ?? product.offers[0];
  const price = defaultOffer?.priceAmount ?? product.variants[0]?.priceAmount;
  const anyInStock = product.variants.some((v) => v.inStock);

  return (
    <StoreLink
      href={`/products/${product.slug}`}
      className="group block overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised transition-colors hover:border-primary"
    >
      <div className="aspect-square bg-primary-soft" />
      <div className="p-4">
        <h3 className="font-medium text-ink group-hover:text-primary-dark">{product.name}</h3>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm text-ink-soft">
            {price !== undefined ? formatMoney(price, currency) : "—"}
          </span>
          {!anyInStock && (
            <span className="text-xs font-medium text-danger">Out of stock</span>
          )}
        </div>
      </div>
    </StoreLink>
  );
}

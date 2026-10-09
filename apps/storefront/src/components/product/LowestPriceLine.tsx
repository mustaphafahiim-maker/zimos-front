"use client";

import { parseMoney, type StorefrontProduct } from "@store-builder/api-client";
import { pickText } from "@/lib/i18n";
import { useLowestPrice } from "@/lib/lowestPrices";
import { defaultOfferOf } from "@/lib/product";
import { useStore } from "@/lib/StoreContext";

/**
 * «أقل سعر في آخر 30 يوم: 90 ج» (frontend-handoff 234): beside a sale price,
 * the lowest price the variant really had in the last 30 days, as the store
 * recorded it — the honest reference for "was / now". It is shown only for a
 * variant that is on sale (a compare-at price above its price), and as it is:
 * also when it is below today's price.
 */

const TEXT = {
  en: { line: (days: string, price: string) => `Lowest price in the last ${days} days: ${price}` },
  ar: { line: (days: string, price: string) => `أقل سعر في آخر ${days} يوم: ${price}` },
};

/**
 * The line for one variant. `variantId` is passed only while that variant is on sale.
 *
 * `reserve` keeps the line's place from the first paint for a variant on sale
 * (the product page): the figure is asked for in the browser, and when it
 * lands nothing under it moves. A store that recorded no lowest price keeps
 * the one empty line.
 */
export function LowestPriceLine({
  workspaceId,
  variantId,
  className,
  reserve = false,
}: {
  workspaceId: string;
  variantId?: string | null;
  className?: string;
  reserve?: boolean;
}) {
  const { locale, intlLocale, money } = useStore();
  const text = pickText(TEXT, locale);
  const lowest = useLowestPrice(workspaceId, variantId);
  if (!variantId) return null;
  if (!lowest) return reserve ? <p aria-hidden className={`min-h-4 text-xs ${className ?? ""}`} /> : null;
  return (
    <p className={`text-xs text-ink-soft ${reserve ? "min-h-4 " : ""}${className ?? ""}`}>
      {text.line(new Intl.NumberFormat(intlLocale).format(lowest.days), money(lowest.price))}
    </p>
  );
}

/**
 * The same line on a product card. A card shows its first variant's price, so
 * the line is that variant's — and only when the card's price is the variant's
 * own (not an offer's) and the variant is on sale.
 */
export function CardLowestPrice({ product, className }: { product: StorefrontProduct; className?: string }) {
  const { store } = useStore();
  const variant = product.variants[0];
  const onSale =
    Boolean(variant) &&
    !defaultOfferOf(product) &&
    variant.compareAtAmount !== null &&
    parseMoney(variant.compareAtAmount) > parseMoney(variant.priceAmount);
  if (!store?.workspaceId) return null;
  return <LowestPriceLine workspaceId={store.workspaceId} variantId={onSale ? variant.id : null} className={className} />;
}

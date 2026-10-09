"use client";

import { useState } from "react";
import { cartOffersOf, parseMoney, type Cart, type CartOffer, type StorefrontProduct } from "@store-builder/api-client";
import { useCart } from "@/lib/CartProvider";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { lineImage, variantImageOf } from "@/lib/variantImage";
import { BoxIcon, CheckIcon } from "../Icons";
import { StoreLink } from "../StoreRoute";
import { btnPrimary, focusRing } from "../ui";

/*
 * The cart's offers (handoff 253), under its lines in the drawer and on the
 * cart page, beside the free gifts: "add the matching socks for 20% off". A
 * card per offer the cart can take now — added with the normal add-to-cart
 * call, after which the server prices that line at the offer — and a hint for
 * the offers a little more in the cart would unlock. Every price shown is the
 * server's (`cart.cartOffers`); nothing is worked out here.
 */

const en = {
  title: "Offers for your cart",
  add: "Add to cart",
  adding: "Adding…",
  inCart: "In your cart",
  instead: (price: string) => `instead of ${price}`,
  off: (percent: string) => `${percent} off`,
  overMax: (max: string) => `The offer price is for up to ${max}`,
  locked: (missing: string, product: string, price: string) => `Add ${missing} more to get ${product} for ${price}`,
  progress: (product: string) => `On the way to the offer on ${product}`,
  failed: "Couldn't add it — try again.",
};

const ar: typeof en = {
  title: "عروض لسلتك",
  add: "ضيف للسلة",
  adding: "بنضيف…",
  inCart: "في السلة",
  instead: (price) => `بدل ${price}`,
  off: (percent) => `خصم ${percent}`,
  overMax: (max) => `السعر المخفض لأول ${max} بس`,
  locked: (missing, product, price) => `ضيف بـ ${missing} كمان وخد ${product} بـ ${price}`,
  progress: (product) => `فاضلك قد إيه على عرض ${product}`,
  failed: "معرفناش نضيفه — جرّب تاني.",
};

const fr: typeof en = {
  title: "Offres pour votre panier",
  add: "Ajouter au panier",
  adding: "Ajout…",
  inCart: "Dans votre panier",
  instead: (price) => `au lieu de ${price}`,
  off: (percent) => `−${percent}`,
  overMax: (max) => `Le prix réduit vaut pour ${max} au maximum`,
  locked: (missing, product, price) => `Ajoutez ${missing} pour obtenir ${product} à ${price}`,
  progress: (product) => `En route vers l'offre sur ${product}`,
  failed: "Ajout impossible — réessayez.",
};

const TEXT = { en, ar, fr };

/** The offered product, with its options when it has any ("Socks — White"). */
function offerProductName(offer: CartOffer): string {
  const options = Object.values(offer.variant.optionValues ?? {}).filter(Boolean).join(" / ");
  return options ? `${offer.variant.productName} — ${options}` : offer.variant.productName;
}

function TagIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className}>
      <path d="M3 12.5V4.5A1.5 1.5 0 0 1 4.5 3h8l8.5 8.5a1.5 1.5 0 0 1 0 2.1l-7.4 7.4a1.5 1.5 0 0 1-2.1 0z" />
      <circle cx="8" cy="8" r="1.4" />
    </svg>
  );
}

export function CartOffers({
  cart,
  catalog,
  compact = false,
  className = "",
}: {
  cart: Cart | null | undefined;
  /** The page's catalogue by variant, for the product's picture when the variant has none of its own. */
  catalog?: ReadonlyMap<string, StorefrontProduct>;
  /** The drawer: the cards sit side by side and scroll, and only the nearest locked offer is hinted. */
  compact?: boolean;
  className?: string;
}) {
  const { locale, intlLocale, money } = useStore();
  const text = pickText(TEXT, locale);
  const { addItem } = useCart();
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ ruleId: string; message: string } | null>(null);

  const { offers, locked } = cartOffersOf(cart);
  // Still to add first, then the ones already in the cart.
  const cards = [...offers.filter((o) => !o.inCart), ...offers.filter((o) => o.inCart)];
  // Only an amount away: a product the rule needs can't be named here, so that rule is not hinted.
  const near = locked
    .filter((o) => !o.needsProduct && parseMoney(o.missingAmount) > 0)
    .sort((a, b) => parseMoney(a.missingAmount) - parseMoney(b.missingAmount))
    .slice(0, compact ? 1 : 3);
  if (!cart || (cards.length === 0 && near.length === 0)) return null;

  const currency = cart.currency;
  const subtotal = Number(cart.subtotal) || 0;
  const number = (n: number) => new Intl.NumberFormat(intlLocale).format(n);
  const percent = (n: number) => new Intl.NumberFormat(intlLocale, { style: "percent", maximumFractionDigits: 0 }).format(n / 100);

  async function add(offer: CartOffer) {
    if (pending) return;
    setPending(offer.ruleId);
    setFailure(null);
    try {
      await addItem(offer.variant.variantId, undefined, 1);
    } catch (err) {
      setFailure({ ruleId: offer.ruleId, message: err instanceof Error && err.message ? err.message : text.failed });
    } finally {
      setPending(null);
    }
  }

  const several = compact && cards.length > 1;

  return (
    <section aria-label={text.title} className={`space-y-2 ${className}`.trimEnd()}>
      {!compact && cards.length > 0 && <h2 className="text-base font-semibold text-ink">{text.title}</h2>}
      {cards.length > 0 && (
        <ul className={several ? "-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1" : "grid gap-2"}>
          {cards.map((offer) => {
            const product = catalog?.get(offer.variant.variantId);
            const image = variantImageOf(offer.variant) ?? (product ? lineImage(product, offer.variant.variantId) : null);
            const name = offerProductName(offer);
            const href = `/products/${offer.variant.slug}`;
            const saves = parseMoney(offer.regularPrice) > parseMoney(offer.offerPrice);
            const busy = pending === offer.ruleId;
            return (
              <li
                key={offer.ruleId}
                className={`rounded-xl border bg-paper-raised p-3 ${offer.applied ? "border-success/40" : "border-line"} ${several ? "w-[88%] shrink-0 snap-start" : ""}`.trimEnd()}
              >
                {/* One row where there is room; in a narrow card the button drops under the text and takes the full width. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-line bg-paper">
                    {image ? (
                      // Merchant media are arbitrary remote URLs (no next/image allowlist).
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" width={56} height={56} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-primary/40">
                        <BoxIcon size={22} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-[999_1_9rem]">
                    <p className="flex items-start gap-1 text-xs font-semibold text-primary">
                      <TagIcon size={14} className="mt-px shrink-0" />
                      <bdi className="line-clamp-2 min-w-0">{offer.name}</bdi>
                    </p>
                    <StoreLink href={href} className={`line-clamp-2 rounded text-sm font-semibold text-ink hover:text-primary ${focusRing}`}>
                      {name}
                    </StoreLink>
                    <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-bold text-ink">{money(offer.offerPrice, currency)}</span>
                      {saves && <s className="text-xs text-ink-soft">{text.instead(money(offer.regularPrice, currency))}</s>}
                      {saves && offer.discountPercent !== null && offer.discountPercent > 0 && (
                        <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">{text.off(percent(offer.discountPercent))}</span>
                      )}
                    </p>
                  </div>
                  {offer.inCart ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
                      <CheckIcon size={16} />
                      {text.inCart}
                    </span>
                  ) : (
                    <button type="button" onClick={() => void add(offer)} disabled={pending !== null} aria-busy={busy} className={`${btnPrimary} flex-[1_0_auto]`}>
                      {busy ? text.adding : text.add}
                      <span className="sr-only"> — {name}</span>
                    </button>
                  )}
                </div>
                {offer.overMaxQuantity && <p className="mt-2 rounded-lg bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent-dark">{text.overMax(number(offer.maxQuantity))}</p>}
                {failure?.ruleId === offer.ruleId && (
                  <p role="alert" className="mt-2 text-xs font-medium text-danger">
                    {failure.message}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div aria-live="polite" className="space-y-2 empty:hidden">
        {near.map((offer) => {
          const missing = parseMoney(offer.missingAmount);
          // How far along the cart is, for the bar only — the amount left is the server's.
          const done = Math.max(4, Math.min(96, Math.round((subtotal / (subtotal + missing)) * 100)));
          return (
            <p key={offer.ruleId} className="rounded-xl bg-primary-soft px-3 py-2 text-xs font-medium text-primary">
              <span className="flex items-center gap-2">
                <TagIcon size={16} className="shrink-0" />
                {text.locked(money(missing, currency), offer.variant.productName, money(offer.offerPrice, currency))}
              </span>
              <span
                role="progressbar"
                aria-label={text.progress(offer.variant.productName)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={done}
                className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-paper-raised"
              >
                <span className="block h-full rounded-full bg-current transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${done}%` }} />
              </span>
            </p>
          );
        })}
      </div>
    </section>
  );
}

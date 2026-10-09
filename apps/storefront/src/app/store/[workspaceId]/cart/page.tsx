"use client";

import { CrossSellStrip } from "@/components/offers/StoreOffers";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useParams } from "next/navigation";
import { BoxIcon, CartGlyph } from "@/components/Icons";
import { QuantityStepper } from "@/components/QuantityStepper";
import { StoreLink } from "@/components/StoreRoute";
import { TrustStrip } from "@/components/TrustStrip";
import { storeCards } from "@/lib/storePromises";
import { CartShippingSummary, type CartTotalText } from "@/components/checkout/CartShippingSummary";
import { btnPrimary, btnPrimaryLg, card, container, focusRing, skeleton } from "@/components/ui";
import { linePreviewOf, useCart } from "@/lib/CartProvider";
import { pickText } from "@/lib/i18n";
import { variantLabel } from "@/lib/product";
import { lineImage } from "@/lib/variantImage";
import { useStore } from "@/lib/StoreContext";
import { useHoliday } from "@/lib/storeHoliday";
import { useCatalog } from "@/lib/useCatalog";
import { LineCustomizations } from "@/components/LineCustomizations";
import { CartFreeGifts } from "@/components/gifts/CartFreeGifts";
import { CartOffers } from "@/components/offers/CartOffers";
import { CartBoxSavings } from "@/components/gifts/CartBoxSavings";
import { CartLinePrice } from "@/components/rewards/CartLinePrice";
import { cartOffersOf } from "@store-builder/api-client";
import { CartQuoteRequest } from "@/components/quotes/QuoteRequest";
import { HolidayCheckoutGate } from "@/components/holiday/HolidayCheckoutGate";

/** This page's own words (the rest is the store's dictionary). */
const TEXT = {
  ar: { toCheckout: "كمّل الطلب", browse: "تصفّح المنتجات" },
  en: { toCheckout: "Continue to checkout", browse: "Browse products" },
  fr: { toCheckout: "Continuer la commande", browse: "Voir les produits" },
};

/**
 * How tall the bar at the bottom of a phone screen is while it shows — the
 * store shell's shared variable: the WhatsApp button and the popups read it
 * and sit above the bar instead of under it.
 */
const BOTTOM_BAR_VAR = "--sf-bottom-bar-h";

function useRaiseAboveBar(bar: RefObject<HTMLElement | null>, visible: boolean) {
  useEffect(() => {
    const el = bar.current;
    if (!el || !visible) return;
    // On the store's wrapper, where the shell reads it, and on the document for anything outside it.
    const wrapper = el.closest<HTMLElement>(".brand-theme");
    const targets = wrapper ? [document.documentElement, wrapper] : [document.documentElement];
    const apply = () => {
      // 0 from `lg` up, where the bar is not drawn.
      const height = `${el.offsetHeight}px`;
      for (const target of targets) target.style.setProperty(BOTTOM_BAR_VAR, height);
    };
    apply();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      for (const target of targets) target.style.removeProperty(BOTTOM_BAR_VAR);
    };
  }, [bar, visible]);
}

/**
 * The phone cart's bottom bar: the total and the way to the checkout stay in
 * reach while the shopper goes through the lines. Below `lg` only — a wide
 * screen keeps the summary column beside the lines.
 *
 * It steps aside while the page's own checkout button is on screen (never two
 * at once) and once the shopper has scrolled past the cart into the footer,
 * where it would only cover what is being read. The total is the summary's
 * own line, handed over as text (CartShippingSummary `onTotal`) — nothing is
 * worked out here.
 */
function CartCheckoutBar({
  anchor,
  end,
  regionLabel,
  total,
  busy,
  buttonLabel,
  onGo,
}: {
  /** The page's own checkout button. */
  anchor: RefObject<HTMLElement | null>;
  /** The end of the cart's content. */
  end: RefObject<HTMLElement | null>;
  regionLabel: string;
  total: CartTotalText;
  /** The total is the last one the server sent while a change is on its way. */
  busy: boolean;
  buttonLabel: string;
  onGo: () => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  // null until the page has been measured: the bar never flashes in over a button that is already on screen.
  const [anchorSeen, setAnchorSeen] = useState<boolean | null>(null);
  const [pastEnd, setPastEnd] = useState(false);

  useEffect(() => {
    const target = anchor.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setAnchorSeen(entry.isIntersecting), { threshold: 0.6 });
    io.observe(target);
    return () => io.disconnect();
  }, [anchor]);

  useEffect(() => {
    const target = end.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setPastEnd(entry.isIntersecting || entry.boundingClientRect.top < 0));
    io.observe(target);
    return () => io.disconnect();
  }, [end]);

  const hidden = anchorSeen !== false || pastEnd;
  useRaiseAboveBar(bar, !hidden);

  return (
    <div
      ref={bar}
      role="region"
      aria-label={regionLabel}
      inert={hidden}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-raised/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur transition-transform duration-200 motion-reduce:transition-none lg:hidden ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div
          aria-busy={busy || undefined}
          className={`min-w-0 shrink-0 transition-opacity duration-200 motion-reduce:transition-none ${busy ? "opacity-60" : ""}`}
        >
          <p className="text-xs text-ink-soft">{total.label}</p>
          <p className="truncate text-base font-bold text-ink">{total.value}</p>
        </div>
        <StoreLink href="/checkout" onClick={onGo} className={`${btnPrimary} min-w-0 flex-1`}>
          {buttonLabel}
        </StoreLink>
      </div>
    </div>
  );
}

export default function CartPage() {
  // Still needed for the catalogue lookup — the links go through StoreLink,
  // which resolves this store’s own prefix.
  const { workspaceId } = useParams<{ workspaceId: string }>();
  // A tap answers before the server does (lib/CartProvider): `lines` carry the
  // quantity just tapped, `adding` the lines on their way. The money on screen
  // is always the server's; it dims while a change is still on its way.
  const { cart, isLoading, lines, adding, isSyncing, changeQuantity, removeLine, flushCart, problem } = useCart();
  const { t, money, store, locale } = useStore();
  const text = pickText(TEXT, locale);
  const holiday = useHoliday();
  const hasLines = Boolean(cart) && lines.length > 0;
  // The names and photos of the lines: one answer shared with the drawer and
  // the checkout, and not asked for at all while there is no line to name.
  const { byVariant, loaded } = useCatalog(workspaceId, 48, { enabled: hasLines || adding.length > 0 });

  const currency = cart?.currency;
  const isEmpty = lines.length === 0 && adding.length === 0;

  // The bottom bar: the page's own checkout button, the end of the cart, and
  // the summary's bottom line as it reads on screen.
  const checkoutLink = useRef<HTMLAnchorElement>(null);
  const cartEnd = useRef<HTMLDivElement>(null);
  const [summaryTotal, setSummaryTotal] = useState<CartTotalText | null>(null);

  // Why the last change did not go through, in one line: the server's own words when it gave any.
  const problemText = problem
    ? (problem.message ??
      (problem.kind === "remove" ? t.cart.removeFailed : problem.kind === "add" ? t.product.addFailed : t.cart.updateFailed))
    : null;
  // The merchant's own wording for the checkout button, when they wrote one (Website → Store texts), is the bar's too.
  const ownCheckoutLabel = Boolean(store?.storefrontTexts?.[locale]?.["cart.checkout"]?.trim());

  return (
    <main className={`${container} flex-1 py-8 sm:py-10`}>
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t.cart.title}</h1>

      {isLoading && !cart && adding.length === 0 ? (
        // The page's own shape while the cart resolves, so nothing jumps when it lands.
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]" role="status" aria-busy="true" aria-label={t.cart.loading}>
          <ul className={`${card} divide-y divide-line`}>
            {[0, 1].map((i) => (
              <li key={i} className="flex gap-4 p-4 sm:p-5">
                <span className={`${skeleton} h-20 w-20 shrink-0`} />
                <span className="flex-1 space-y-2 pt-1">
                  <span className={`${skeleton} block h-4 w-2/3`} />
                  <span className={`${skeleton} block h-3 w-1/4`} />
                  <span className={`${skeleton} mt-3 block h-11 w-32`} />
                </span>
              </li>
            ))}
          </ul>
          <div className={`${card} space-y-3 p-5`}>
            <span className={`${skeleton} block h-5 w-1/2`} />
            <span className={`${skeleton} block h-4 w-full`} />
            <span className={`${skeleton} block h-12 w-full`} />
          </div>
        </div>
      ) : isEmpty ? (
        // An empty cart says what to do next, and gives the one way to do it.
        <div className={`${card} mt-8 flex flex-col items-center px-6 py-16 text-center`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <CartGlyph size={32} />
          </span>
          <p className="mt-4 text-lg font-semibold text-ink">{t.cart.empty}</p>
          <p className="mt-1 text-sm text-ink-soft">{t.cart.emptyHint}</p>
          <StoreLink href="/products" className={`${btnPrimary} mt-6`}>
            {text.browse}
          </StoreLink>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div>
            <div aria-live="polite" className="empty:hidden">
              {problemText && <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{problemText}</p>}
            </div>

            <ul className={`${card} divide-y divide-line`}>
              {lines.map(({ line, quantity, syncing, removing }) => {
                const product = byVariant.get(line.variantId);
                // A product the catalogue does not hold keeps what the page that added it said (this visit only).
                const known = product ? undefined : linePreviewOf(line.variantId);
                const name = product?.name ?? known?.name;
                const slug = product?.slug ?? known?.slug;
                // The variant's own picture, else the product's (lib/variantImage).
                const image = product ? lineImage(product, line.variantId) : (known?.image ?? null);
                const options = variantLabel(line.variant);
                return (
                  <li
                    key={line.id}
                    aria-busy={removing || undefined}
                    className={`flex gap-4 p-4 transition-opacity motion-reduce:transition-none sm:p-5 ${removing ? "opacity-50" : ""}`}
                  >
                    {/* A fixed box, so the row keeps its height whether the photo has arrived or not. */}
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-paper">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" width={80} height={80} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : loaded || name ? (
                        <div className="flex h-full w-full items-center justify-center text-primary/40">
                          <BoxIcon size={28} />
                        </div>
                      ) : (
                        <span className={`${skeleton} block h-full w-full rounded-none`} />
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {name && slug ? (
                            <StoreLink
                              href={`/products/${slug}`}
                              className="line-clamp-2 text-sm font-semibold text-ink hover:text-primary"
                            >
                              {name}
                            </StoreLink>
                          ) : name ? (
                            <span className="line-clamp-2 text-sm font-semibold text-ink">{name}</span>
                          ) : loaded ? (
                            <span className="text-sm font-semibold text-ink">{options || t.cart.item}</span>
                          ) : (
                            // The name is on its way with the catalogue: its place is held rather than filled with a stand-in.
                            <span className={`${skeleton} block h-4 w-32`} />
                          )}
                          {name && options && <p className="mt-0.5 text-xs text-ink-soft">{options}</p>}
                          <LineCustomizations customizations={line.customizations} />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          disabled={removing}
                          aria-label={name ? `${t.cart.remove} — ${name}` : undefined}
                          className={`-me-2 -mt-2 inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-medium text-danger hover:underline disabled:opacity-50 ${focusRing}`}
                        >
                          {t.cart.remove}
                        </button>
                      </div>

                      <span className="text-xs text-ink-soft">{t.cart.perUnit(money(line.currentUnitPrice, currency))}</span>
                      {/* A signed-in shopper's own price says so instead: the API marks a list-priced line as "changed" (handoff 205).
                          A line taken at a cart offer's price is marked the same way (handoff 253) and gets no note: its card says the price. */}
                      <CartLinePrice line={line} currency={currency}>
                        {line.priceChanged && !cartOffersOf(cart).offers.some((offer) => offer.applied && offer.variant.variantId === line.variantId) && (
                          <span className="mt-1 text-xs text-accent-dark">{t.cart.priceChanged}</span>
                        )}
                      </CartLinePrice>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        {/* The same stepper the drawer and the product page use. The number moves with the
                            tap; the line's total stays the server's and dims until it answers. */}
                        <QuantityStepper
                          size="sm"
                          value={quantity}
                          disabled={removing}
                          onChange={(next) => changeQuantity(line.id, next)}
                        />
                        <span
                          aria-busy={syncing || undefined}
                          className={`text-base font-bold text-ink transition-opacity motion-reduce:transition-none ${syncing ? "opacity-50" : ""}`}
                        >
                          {money(line.lineTotal, currency)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}

              {/* Lines on their way: the product as the page that added it showed it, nothing priced
                  until the server answers. */}
              {adding.map((add) => {
                const product = byVariant.get(add.variantId);
                const name = add.preview?.name ?? product?.name;
                const image = add.preview?.image ?? (product ? lineImage(product, add.variantId) : null);
                return (
                  <li key={add.key} aria-busy="true" className="flex gap-4 p-4 sm:p-5">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-paper">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" width={80} height={80} decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <span className={`${skeleton} block h-full w-full rounded-none`} />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      {name ? (
                        <span className="line-clamp-2 text-sm font-semibold text-ink">{name}</span>
                      ) : (
                        <span className={`${skeleton} block h-4 w-32`} />
                      )}
                      <span className="text-xs text-ink-soft">{t.product.adding}</span>
                      <span aria-hidden className={`${skeleton} mt-3 block h-11 w-32`} />
                    </div>
                  </li>
                );
              })}
            </ul>
            {hasLines && cart && (
              <>
                <CartFreeGifts cart={cart} className="mt-4" />
                <CartOffers cart={cart} catalog={byVariant} className="mt-4" />
                <CartBoxSavings cart={cart} className="mt-4" />
                <CartQuoteRequest cart={cart} products={byVariant} className="mt-3" />
              </>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {hasLines && cart ? (
              <div className={`${card} p-5`}>
                <h2 className="text-base font-semibold text-ink">{t.cart.summary}</h2>
                {/* Shipping comes from the same quote the order is charged by,
                    once the shopper picks a governorate here or at checkout. */}
                <div className="mt-4">
                  <CartShippingSummary workspaceId={workspaceId} cart={cart} busy={isSyncing} onTotal={setSummaryTotal} />
                </div>
                <HolidayCheckoutGate buttonClassName={`${btnPrimaryLg} mt-5`} noteClassName="mt-4">
                {/* What was just tapped goes out with this tap: the checkout reads the server's cart. */}
                <StoreLink ref={checkoutLink} href="/checkout" onClick={flushCart} className={`${btnPrimaryLg} mt-5`}>
                  {t.cart.checkout}
                </StoreLink>
                </HolidayCheckoutGate>
                <StoreLink
                  href="/"
                  className="mt-2 flex min-h-11 items-center justify-center text-sm font-medium text-primary hover:underline"
                >
                  {t.common.continueShopping}
                </StoreLink>
              </div>
            ) : (
              // The first line is on its way: the summary's place is held, with nothing priced yet.
              <div aria-hidden className={`${card} space-y-3 p-5`}>
                <span className={`${skeleton} block h-5 w-1/2`} />
                <span className={`${skeleton} block h-4 w-full`} />
                <span className={`${skeleton} block h-12 w-full`} />
              </div>
            )}
            <TrustStrip cards={storeCards(store)} locale={locale} compact />
          </aside>
        </div>
      )}

      {/* What goes with the cart: the merchant's cross-sell rule, or what was bought together. */}
      {hasLines && cart && (
        <CrossSellStrip
          workspaceId={workspaceId}
          placement="cart"
          productIds={[...new Set(cart.items.map((line) => byVariant.get(line.variantId)?.id).filter((id): id is string => Boolean(id)))]}
        />
      )}

      {/* Where the cart ends: past it, the bottom bar steps aside. */}
      <div ref={cartEnd} aria-hidden className="h-px" />

      {/* A store that has paused orders has no way to the checkout: the page says why, and there is no bar. */}
      {hasLines && cart && !holiday.paused && (
        <CartCheckoutBar
          anchor={checkoutLink}
          end={cartEnd}
          regionLabel={t.checkoutBar.label}
          total={summaryTotal ?? { label: t.cart.subtotal, value: money(cart.subtotal, currency), stale: false }}
          busy={isSyncing || Boolean(summaryTotal?.stale)}
          buttonLabel={ownCheckoutLabel ? t.cart.checkout : text.toCheckout}
          onGo={flushCart}
        />
      )}
    </main>
  );
}

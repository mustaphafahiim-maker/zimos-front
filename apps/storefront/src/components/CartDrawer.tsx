"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { linePreviewOf, useCart } from "@/lib/CartProvider";
import { variantLabel } from "@/lib/product";
import { lineImage } from "@/lib/variantImage";
import { useStore } from "@/lib/StoreContext";
import { useCatalog } from "@/lib/useCatalog";
import { useDialog, useSheetPresence } from "@/lib/useDialog";
import { StoreLink } from "@/components/StoreRoute";
import { CartShippingSummary } from "@/components/checkout/CartShippingSummary";
import { BoxIcon, CartGlyph, CrossIcon } from "./Icons";
import { QuantityStepper } from "./QuantityStepper";
import { backdrop, btnPrimaryLg, btnSecondary, focusRing, iconBtn, modalLayer, sheet, skeleton } from "./ui";
import { LineCustomizations } from "@/components/LineCustomizations";
import { CartFreeGifts } from "@/components/gifts/CartFreeGifts";
import { CartOffers } from "@/components/offers/CartOffers";
import { CartBoxSavings } from "@/components/gifts/CartBoxSavings";
import { CartLinePrice } from "@/components/rewards/CartLinePrice";
import { HolidayCheckoutGate } from "@/components/holiday/HolidayCheckoutGate";

/**
 * True once the page has gone quiet after it loaded. The closed drawer waits
 * for this before fetching anything ahead of being opened, so it never
 * competes with the page's own first paint.
 */
function usePageSettled(): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setSettled(true), { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(() => setSettled(true), 2000);
    return () => window.clearTimeout(timer);
  }, []);
  return settled;
}

/**
 * The cart as a slide-over, opened by "add to cart" anywhere in the store and
 * by the header's cart icon: the lines, a quantity stepper, the subtotal and
 * shipping (CartShippingSummary, quoted only while the drawer is open) and
 * the two ways out — checkout, or back to browsing. The cart page stays the
 * full view; this is the quick one.
 *
 * It reads the one cart from CartProvider (which also holds its open state),
 * so a change here shows on the cart page and the header count at once. The
 * live region below announces what changed for screen readers, whether the
 * drawer is open or not.
 *
 * A tap answers before the server does (lib/CartProvider): a line being added
 * is drawn at once from what the page knows about the product, a quantity
 * changes with the tap and each line is sent on its own, so one line waiting
 * never holds the others. The money is the server's throughout — while a
 * change is on its way the last totals stay, dimmed.
 *
 * The catalogue that names the lines (lib/useCatalog) is not asked for on a
 * page whose cart is empty: only once there is a line to name, or the drawer
 * opens.
 */
export function CartDrawer() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const {
    cart,
    isLoading,
    itemCount,
    isDrawerOpen,
    closeDrawer,
    lines,
    adding,
    isSyncing,
    changeQuantity,
    removeLine,
    flushCart,
    problem,
  } = useCart();
  const { t, money, intlLocale } = useStore();
  const settled = usePageSettled();
  const { byVariant, loaded } = useCatalog(workspaceId, 48, {
    enabled: isDrawerOpen || adding.length > 0 || (lines.length > 0 && settled),
  });
  const pathname = usePathname();
  const dialogRef = useDialog<HTMLDivElement>({ open: isDrawerOpen, onClose: closeDrawer });
  // In the DOM only while open or sliding out — a closed sheet parked
  // off-screen would widen an RTL page (lib/useDialog).
  const { present, shown } = useSheetPresence(isDrawerOpen);

  // A route change (checkout, a product link in a line) closes the drawer.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      closeDrawer();
    }
  }, [pathname, closeDrawer]);

  // What the live region says: the count once it changes, the first
  // render excluded so a page load does not read the cart out.
  const [announcement, setAnnouncement] = useState("");
  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (lastCount.current === null) {
      lastCount.current = itemCount;
      return;
    }
    if (lastCount.current === itemCount) return;
    lastCount.current = itemCount;
    const timer = window.setTimeout(() => setAnnouncement(itemCount > 0 ? t.shop.itemsInCart(itemCount) : t.cart.empty), 0);
    return () => window.clearTimeout(timer);
  }, [itemCount, t]);

  const currency = cart?.currency;
  const isEmpty = lines.length === 0 && adding.length === 0;
  // The totals and the way to checkout: only once the server has a line to price.
  const hasFooter = Boolean(cart) && lines.length > 0;

  // The drawer may open before its first line has landed, when there is no
  // checkout link yet for focus to start on (useDialog then picks the close
  // button). Once the link is there it takes the focus it would have had —
  // unless the shopper has moved on from the close button themselves.
  const closeButton = useRef<HTMLButtonElement>(null);
  const checkoutLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!isDrawerOpen || !hasFooter) return;
    if (document.activeElement === closeButton.current) checkoutLink.current?.focus({ preventScroll: true });
  }, [isDrawerOpen, hasFooter]);

  // Why the last change did not go through, in one line: the server's own words when it gave any.
  const problemText = problem
    ? (problem.message ??
      (problem.kind === "remove" ? t.cart.removeFailed : problem.kind === "add" ? t.product.addFailed : t.cart.updateFailed))
    : null;

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {present && (
      <div className={modalLayer}>
      <div className={backdrop(shown)} aria-hidden onClick={closeDrawer} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        aria-hidden={!isDrawerOpen}
        inert={!isDrawerOpen}
        className={sheet(shown)}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:px-5">
          <h2 id="cart-drawer-title" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            <CartGlyph className="text-primary" />
            {t.shop.drawerTitle}
            {itemCount > 0 && (
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                {new Intl.NumberFormat(intlLocale).format(itemCount)}
              </span>
            )}
          </h2>
          <button ref={closeButton} type="button" onClick={closeDrawer} aria-label={t.common.close} className={iconBtn}>
            <CrossIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div aria-live="polite" className="empty:hidden">
            {problemText && <p className="mb-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{problemText}</p>}
          </div>

          {isLoading && !cart && adding.length === 0 ? (
            <ul aria-busy="true" aria-label={t.cart.loading} className="space-y-4">
              {[0, 1].map((i) => (
                <li key={i} className="flex gap-3">
                  <span className={`${skeleton} h-20 w-20 shrink-0`} />
                  <span className="flex-1 space-y-2 pt-1">
                    <span className={`${skeleton} block h-4 w-3/4`} />
                    <span className={`${skeleton} block h-3 w-1/3`} />
                    <span className={`${skeleton} block h-11 w-32`} />
                  </span>
                </li>
              ))}
            </ul>
          ) : isEmpty ? (
            <div className="flex flex-col items-center px-4 py-14 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <CartGlyph size={32} />
              </span>
              <p className="mt-4 text-lg font-semibold text-ink">{t.cart.empty}</p>
              <p className="mt-1 text-sm text-ink-soft">{t.cart.emptyHint}</p>
              <button type="button" onClick={closeDrawer} className={`${btnSecondary} mt-6`}>
                {t.common.continueShopping}
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-line">
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
                    className={`flex gap-3 py-4 first:pt-0 transition-opacity motion-reduce:transition-none ${removing ? "opacity-50" : ""}`}
                  >
                    {/* A fixed box, so the row keeps its height whether the photo has arrived or not. */}
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-paper">
                      {image ? (
                        // Merchant media are arbitrary remote URLs (no next/image allowlist).
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
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {name && slug ? (
                            <StoreLink
                              href={`/products/${slug}`}
                              className={`line-clamp-2 rounded text-sm font-semibold text-ink hover:text-primary ${focusRing}`}
                            >
                              {name}
                            </StoreLink>
                          ) : name ? (
                            <span className="line-clamp-2 text-sm font-semibold text-ink">{name}</span>
                          ) : loaded ? (
                            <span className="text-sm font-semibold text-ink">{options || t.cart.item}</span>
                          ) : (
                            <span className={`${skeleton} block h-4 w-32`} />
                          )}
                          {name && options && <p className="mt-0.5 text-xs text-ink-soft">{options}</p>}
                          <LineCustomizations customizations={line.customizations} />
                          <p className="mt-0.5 text-xs text-ink-soft">{t.cart.perUnit(money(line.currentUnitPrice, currency))}</p>
                          <CartLinePrice line={line} currency={currency} />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          disabled={removing}
                          aria-label={`${t.cart.remove}${name ? ` — ${name}` : ""}`}
                          className={`-me-2 -mt-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-soft transition-colors hover:text-danger disabled:opacity-50 ${focusRing}`}
                        >
                          <CrossIcon size={18} />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-3">
                        {/* The number moves with the tap; the line's total stays the server's and dims until it answers. */}
                        <QuantityStepper
                          size="sm"
                          value={quantity}
                          disabled={removing}
                          onChange={(next) => changeQuantity(line.id, next)}
                        />
                        <span
                          aria-busy={syncing || undefined}
                          className={`text-sm font-bold text-ink transition-opacity motion-reduce:transition-none ${syncing ? "opacity-50" : ""}`}
                        >
                          {money(line.lineTotal, currency)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}

              {/* Lines on their way: the product as the page that added it showed it, nothing priced
                  until the server answers. The row is the height of a real one, so nothing moves when it lands. */}
              {adding.map((add) => {
                const product = byVariant.get(add.variantId);
                const name = add.preview?.name ?? product?.name;
                const image = add.preview?.image ?? (product ? lineImage(product, add.variantId) : null);
                return (
                  <li key={add.key} aria-busy="true" className="flex gap-3 py-4 first:pt-0">
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
                      <p className="mt-0.5 text-xs text-ink-soft">{t.product.adding}</p>
                      <span aria-hidden className={`${skeleton} mt-2 block h-11 w-32`} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {hasFooter && cart ? (
          <div className="shrink-0 border-t border-line bg-paper-raised px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5">
            <CartFreeGifts cart={cart} className="mb-3" />
            <CartOffers cart={cart} catalog={byVariant} compact className="mb-3" />
            <CartBoxSavings cart={cart} className="mb-3" />
            <CartShippingSummary workspaceId={workspaceId} cart={cart} enabled={isDrawerOpen} busy={isSyncing} />
            <div className="mt-4 grid gap-2">
              <HolidayCheckoutGate buttonClassName={btnPrimaryLg}>
              {/* What was just tapped goes out with this tap: the checkout reads the server's cart. */}
              <StoreLink ref={checkoutLink} href="/checkout" onClick={flushCart} className={btnPrimaryLg} data-autofocus="">
                {t.cart.checkout}
              </StoreLink>
              </HolidayCheckoutGate>
              <button type="button" onClick={closeDrawer} className={btnSecondary}>
                {t.common.continueShopping}
              </button>
            </div>
          </div>
        ) : adding.length > 0 ? (
          // The first line is on its way: the footer's place is held, with nothing priced yet.
          <div aria-hidden className="shrink-0 space-y-3 border-t border-line bg-paper-raised px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5">
            <span className={`${skeleton} block h-5 w-2/3`} />
            <span className={`${skeleton} block h-12 w-full`} />
            <span className={`${skeleton} block h-11 w-full`} />
          </div>
        ) : null}
      </div>
      </div>
      )}
    </>
  );
}

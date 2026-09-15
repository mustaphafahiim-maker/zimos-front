"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BoxIcon, CartGlyph, CashIcon } from "@/components/Icons";
import { ProductCard } from "@/components/ProductCard";
import { TrustStrip } from "@/components/TrustStrip";
import { btnPrimary, btnPrimaryLg, btnSecondary, card, container } from "@/components/ui";
import { useCart } from "@/lib/CartProvider";
import { firstImage, variantLabel } from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { useCatalog } from "@/lib/useCatalog";

function CartSkeleton() {
  const bone = "rounded-lg bg-line/70 motion-safe:animate-pulse";
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]" aria-busy="true">
      <ul className={`${card} divide-y divide-line`}>
        {[0, 1].map((i) => (
          <li key={i} className="flex gap-4 p-5">
            <div className={`${bone} h-20 w-20 rounded-xl`} />
            <div className="flex-1 space-y-2">
              <div className={`${bone} h-4 w-3/5`} />
              <div className={`${bone} h-3 w-1/4`} />
              <div className={`${bone} mt-4 h-11 w-32`} />
            </div>
          </li>
        ))}
      </ul>
      <div className={`${card} h-56 p-5`}>
        <div className={`${bone} h-5 w-32`} />
        <div className={`${bone} mt-5 h-4 w-full`} />
        <div className={`${bone} mt-3 h-4 w-full`} />
        <div className={`${bone} mt-6 h-12 w-full`} />
      </div>
    </div>
  );
}

export default function CartPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { cart, isLoading, updateItem, removeItem } = useCart();
  const { t, money, locale, store } = useStore();
  const { byVariant, products } = useCatalog(workspaceId);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currency = cart?.currency;
  const isEmpty = !cart || cart.items.length === 0;
  const itemCount = cart?.items.reduce((n, line) => n + line.quantity, 0) ?? 0;

  // Real catalogue products that aren't already in the cart.
  const suggestions = useMemo(() => {
    const inCart = new Set((cart?.items ?? []).map((l) => byVariant.get(l.variantId)?.id).filter(Boolean));
    return (products ?? []).filter((p) => !inCart.has(p.id) && p.variants.some((v) => v.inStock)).slice(0, 4);
  }, [products, cart, byVariant]);

  // Mobile: sticky checkout bar while the summary box is off screen.
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(true);
  useEffect(() => {
    const el = summaryRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setSummaryVisible(entry.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, [isEmpty]);
  const showBar = !isEmpty && !summaryVisible;
  useEffect(() => {
    const root = document.documentElement;
    if (showBar) root.dataset.stickyBar = "";
    else delete root.dataset.stickyBar;
    return () => {
      delete root.dataset.stickyBar;
    };
  }, [showBar]);

  async function run(lineId: string, action: () => Promise<void>, fallback: string) {
    if (pendingId) return;
    setPendingId(lineId);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : fallback);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className={`${container} flex-1 py-8 sm:py-10`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t.cart.title}</h1>
        {!isEmpty && <span className="text-sm text-ink-soft">{t.cart.itemsCount(itemCount)}</span>}
      </div>

      {isLoading && !cart ? (
        <CartSkeleton />
      ) : isEmpty ? (
        <div className={`${card} mt-8 flex flex-col items-center px-6 py-16 text-center`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <CartGlyph size={32} />
          </span>
          <p className="mt-4 text-lg font-semibold text-ink">{t.cart.empty}</p>
          <p className="mt-1 text-sm text-ink-soft">{t.cart.emptyHint}</p>
          <Link href={`/store/${workspaceId}`} className={`${btnSecondary} mt-6`}>
            {t.common.continueShopping}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div>
            <div aria-live="polite" className="empty:hidden">
              {error && <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
            </div>

            <ul className={`${card} divide-y divide-line`}>
              {cart.items.map((line) => {
                const rowBusy = pendingId === line.id;
                const product = byVariant.get(line.variantId);
                const image = product ? firstImage(product) : null;
                const options = variantLabel(line.variant);
                return (
                  <li key={line.id} className={`flex gap-4 p-4 transition-opacity sm:p-5 ${rowBusy ? "opacity-60" : ""}`}>
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-zimos-cloud sm:h-24 sm:w-24 dark:bg-primary-soft">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" width={96} height={96} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-primary/40">
                          <BoxIcon size={28} />
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {product ? (
                            <Link href={`/store/${workspaceId}/products/${product.slug}`} className="line-clamp-2 text-sm font-semibold text-ink hover:text-primary sm:text-base">
                              {product.name}
                            </Link>
                          ) : (
                            <span className="text-sm font-semibold text-ink">{options || t.cart.item}</span>
                          )}
                          {product && options && <p className="mt-0.5 text-xs text-ink-soft">{options}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => run(line.id, () => removeItem(line.id), t.cart.removeFailed)}
                          disabled={rowBusy}
                          className="-me-2 -mt-2 inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-lg px-2 text-xs font-medium text-danger hover:underline disabled:opacity-50"
                        >
                          {t.cart.remove}
                        </button>
                      </div>

                      <span className="text-xs text-ink-soft">{t.cart.perUnit(money(line.currentUnitPrice, currency))}</span>
                      {line.priceChanged && <span className="mt-1 text-xs text-warning">{t.cart.priceChanged}</span>}

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center rounded-xl border border-line-strong">
                          <button
                            type="button"
                            aria-label={t.product.decrease}
                            onClick={() => run(line.id, () => updateItem(line.id, line.quantity - 1), t.cart.updateFailed)}
                            disabled={rowBusy || line.quantity <= 1}
                            className="h-11 w-11 cursor-pointer text-lg text-ink disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="min-w-8 text-center text-sm font-semibold tabular-nums text-ink" aria-live="polite">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={t.product.increase}
                            onClick={() => run(line.id, () => updateItem(line.id, line.quantity + 1), t.cart.updateFailed)}
                            disabled={rowBusy}
                            className="h-11 w-11 cursor-pointer text-lg text-ink disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-base font-bold text-ink">{money(line.lineTotal, currency)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div ref={summaryRef} className={`${card} p-5`}>
              <h2 className="text-base font-semibold text-ink">{t.cart.summary}</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t.cart.subtotal}</dt>
                  <dd className="font-semibold text-ink">{money(cart.subtotal, currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t.checkout.shippingFee}</dt>
                  <dd className="text-ink-soft">{t.cart.shippingAtCheckout}</dd>
                </div>
              </dl>
              <Link href={`/store/${workspaceId}/checkout`} className={`${btnPrimaryLg} mt-5`}>
                {t.cart.checkout}
              </Link>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-ink-soft">
                <CashIcon size={16} />
                {t.cart.codReassure}
              </p>
              <Link href={`/store/${workspaceId}`} className="mt-2 flex min-h-11 items-center justify-center text-sm font-medium text-primary hover:underline">
                {t.common.continueShopping}
              </Link>
            </div>
            <TrustStrip t={t} compact />
          </aside>
        </div>
      )}

      {suggestions.length > 0 && (
        <section className="mt-14" aria-labelledby="suggest-title">
          <h2 id="suggest-title" className="mb-5 text-xl font-semibold text-ink">
            {t.cart.youMayLike}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {suggestions.map((p) => (
              <li key={p.id} className="flex">
                <ProductCard product={p} workspaceId={workspaceId} currency={store?.currency ?? currency ?? "EGP"} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isEmpty && (
        <div
          className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-raised/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-pop backdrop-blur transition-transform duration-200 lg:hidden ${
            showBar ? "translate-y-0" : "translate-y-full"
          }`}
          aria-hidden={!showBar}
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs text-ink-soft">{t.cart.subtotal}</p>
              <p className="truncate text-base font-bold text-ink">{money(cart.subtotal, currency)}</p>
            </div>
            <Link href={`/store/${workspaceId}/checkout`} tabIndex={showBar ? 0 : -1} className={`${btnPrimary} flex-1`}>
              {t.cart.checkout}
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

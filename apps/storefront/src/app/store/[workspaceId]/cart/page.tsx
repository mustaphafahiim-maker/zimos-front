"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { BoxIcon, CartGlyph } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { TrustStrip } from "@/components/TrustStrip";
import { btnPrimaryLg, btnSecondary, card, container } from "@/components/ui";
import { useCart } from "@/lib/CartProvider";
import { firstImage, variantLabel } from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { useCatalog } from "@/lib/useCatalog";

export default function CartPage() {
  // Still needed for the catalogue lookup — the links go through StoreLink,
  // which resolves this store’s own prefix.
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { cart, isLoading, updateItem, removeItem } = useCart();
  const { t, money } = useStore();
  const { byVariant } = useCatalog(workspaceId);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currency = cart?.currency;
  const isEmpty = !cart || cart.items.length === 0;

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
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t.cart.title}</h1>

      {isLoading && !cart ? (
        <p className="mt-10 text-sm text-ink-soft" role="status">
          {t.cart.loading}
        </p>
      ) : isEmpty ? (
        <div className={`${card} mt-8 flex flex-col items-center px-6 py-16 text-center`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <CartGlyph size={32} />
          </span>
          <p className="mt-4 text-lg font-semibold text-ink">{t.cart.empty}</p>
          <p className="mt-1 text-sm text-ink-soft">{t.cart.emptyHint}</p>
          <StoreLink href="/" className={`${btnSecondary} mt-6`}>
            {t.common.continueShopping}
          </StoreLink>
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
                  <li key={line.id} className={`flex gap-4 p-4 sm:p-5 ${rowBusy ? "opacity-60" : ""}`}>
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-paper">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" width={80} height={80} loading="lazy" className="h-full w-full object-cover" />
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
                            <StoreLink
                              href={`/products/${product.slug}`}
                              className="line-clamp-2 text-sm font-semibold text-ink hover:text-primary"
                            >
                              {product.name}
                            </StoreLink>
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
                      {line.priceChanged && <span className="mt-1 text-xs text-accent-dark">{t.cart.priceChanged}</span>}

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center rounded-xl border border-line">
                          <button
                            type="button"
                            aria-label={t.product.decrease}
                            onClick={() => run(line.id, () => updateItem(line.id, line.quantity - 1), t.cart.updateFailed)}
                            disabled={rowBusy || line.quantity <= 1}
                            className="h-11 w-11 cursor-pointer text-lg text-ink disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="min-w-8 text-center text-sm font-semibold tabular-nums text-ink">{line.quantity}</span>
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
            <div className={`${card} p-5`}>
              <h2 className="text-base font-semibold text-ink">{t.cart.summary}</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t.cart.subtotal}</dt>
                  <dd className="font-semibold text-ink">{money(cart.subtotal, currency)}</dd>
                </div>
                {/* The API has no shipping quote for a cart — shipping is
                    priced server-side from the delivery address when the order
                    is placed — so the cart says so rather than showing a total
                    it cannot know. */}
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t.checkout.shippingFee}</dt>
                  <dd className="text-ink-soft">{t.cart.shippingAtCheckout}</dd>
                </div>
              </dl>
              <StoreLink href="/checkout" className={`${btnPrimaryLg} mt-5`}>
                {t.cart.checkout}
              </StoreLink>
              <StoreLink
                href="/"
                className="mt-2 flex min-h-11 items-center justify-center text-sm font-medium text-primary hover:underline"
              >
                {t.common.continueShopping}
              </StoreLink>
            </div>
            <TrustStrip t={t} compact />
          </aside>
        </div>
      )}
    </main>
  );
}

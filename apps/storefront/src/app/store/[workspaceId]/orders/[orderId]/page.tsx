"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { ShopperOrder } from "@store-builder/api-client";
import { CheckIcon, CopyIcon, ShareIcon, WhatsAppIcon } from "@/components/Icons";
import { ProductCard } from "@/components/ProductCard";
import { StatusTimeline } from "@/components/StatusTimeline";
import { btnPrimary, btnSecondary, card, container } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { whatsappNumber } from "@/lib/egypt";
import { getOrderRef, lookupOrder, type OrderRef } from "@/lib/orders";
import { useStore } from "@/lib/StoreContext";
import { useCatalog } from "@/lib/useCatalog";

type Load = { status: "loading" } | { status: "ready"; ref: OrderRef | null; order: ShopperOrder | null } | { status: "error"; ref: OrderRef | null };

/**
 * Thank-you / order confirmation. Everything shown comes from the real order
 * (public lookup with the phone this device used). An order placed from
 * another device can still be tracked with its number and phone.
 */
function Confirmation() {
  const { workspaceId, orderId } = useParams<{ workspaceId: string; orderId: string }>();
  const search = useSearchParams();
  const { t, money, store, locale } = useStore();
  const { products } = useCatalog(workspaceId, 12);

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [storeUrl, setStoreUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    // Device storage and browser APIs are read after mount so SSR and hydration agree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStoreUrl(`${window.location.origin}/store/${workspaceId}`);
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    const ref = getOrderRef(workspaceId, orderId);
    if (!ref) {
      setLoad({ status: "ready", ref: null, order: null });
      return;
    }
    let cancelled = false;
    lookupOrder(createStorefrontApiClient(), workspaceId, { orderId, phone: ref.phone })
      .then((order) => !cancelled && setLoad({ status: "ready", ref, order }))
      .catch(() => !cancelled && setLoad({ status: "error", ref }));
    return () => {
      cancelled = true;
    };
  }, [workspaceId, orderId]);

  const ref = load.status === "loading" ? null : load.ref;
  const order = load.status === "ready" ? load.order : null;
  const orderNumber = order?.orderNumber ?? ref?.orderNumber ?? search.get("number");
  const wa = store?.phone ? whatsappNumber(store.phone) : null;
  const storeName = store?.name ?? "";
  const ordered = new Set((order?.items ?? []).map((i) => i.productId).filter(Boolean));
  const more = (products ?? []).filter((p) => !ordered.has(p.id) && p.variants.some((v) => v.inStock)).slice(0, 4);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: storeName, text: t.thankYou.shareText(storeName), url: storeUrl });
    } catch {
      /* dismissed */
    }
  }

  return (
    <main className={`${container} flex-1 py-10 sm:py-14`}>
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center text-center">
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-success-soft text-success motion-safe:animate-[zr-pop_520ms_cubic-bezier(.2,.9,.3,1.3)_both]">
            <span className="absolute inset-0 rounded-full bg-success/25 motion-safe:animate-[zr-ring_1.2s_ease-out_both]" aria-hidden />
            <CheckIcon size={40} />
          </span>
          <h1 className="mt-5 text-2xl font-bold text-ink sm:text-3xl">{t.thankYou.title}</h1>
          {orderNumber && (
            <p className="mt-3 text-sm text-ink-soft">
              {t.thankYou.orderNumber}:{" "}
              <span dir="ltr" className="font-bold text-ink">
                #{orderNumber}
              </span>
            </p>
          )}
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
            {t.thankYou.callNotice}
            {ref?.phone && (
              <>
                {" "}
                {t.thankYou.onPhone}{" "}
                <span dir="ltr" className="font-semibold text-ink">
                  {ref.phone}
                </span>
              </>
            )}
          </p>
        </div>

        {load.status === "loading" && (
          <div className={`${card} mt-8 h-40 motion-safe:animate-pulse`} aria-busy="true" aria-label={t.common.loading} />
        )}

        {load.status !== "loading" && !order && (
          <div className={`${card} mt-8 p-5 text-center text-sm text-ink-soft sm:p-6`} role="status">
            {load.status === "error" ? t.form.errors.generic : t.thankYou.otherDevice}
            <div className="mt-4">
              <Link href={`/store/${workspaceId}/track`} className={btnSecondary}>
                {t.thankYou.track}
              </Link>
            </div>
          </div>
        )}

        {order && (
          <>
            <section className={`${card} mt-8 p-5 sm:p-6`} aria-labelledby="next-title">
              <h2 id="next-title" className="mb-5 text-lg font-semibold text-ink">
                {t.thankYou.steps}
              </h2>
              <StatusTimeline stage={order.stage} />
            </section>

            <section className={`${card} mt-6 p-5 sm:p-6`} aria-labelledby="summary-title">
              <div className="flex items-center justify-between gap-3">
                <h2 id="summary-title" className="text-lg font-semibold text-ink">
                  {t.thankYou.summary}
                </h2>
                {order.paymentMethod === "cod" && (
                  <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{t.thankYou.payOnDelivery}</span>
                )}
              </div>
              <ul className="mt-4 space-y-3">
                {order.items.map((item, i) => {
                  const options = Object.values(item.options ?? {}).filter(Boolean).join(" / ");
                  return (
                    <li key={i} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0 text-ink">
                        {item.name}
                        {(options || item.offerName) && <span className="block text-xs text-ink-soft">{[item.offerName, options].filter(Boolean).join(" · ")}</span>}
                        <span className="text-xs text-ink-soft"> × {item.quantity}</span>
                      </span>
                      <span className="shrink-0 text-ink">{money(item.lineTotalAmount, order.currency)}</span>
                    </li>
                  );
                })}
              </ul>
              <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t.thankYou.subtotal}</dt>
                  <dd className="text-ink">{money(order.subtotalAmount, order.currency)}</dd>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-success">
                    <dt>{t.thankYou.discount}</dt>
                    <dd>−{money(order.discountAmount, order.currency)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t.thankYou.shipping}</dt>
                  <dd className="text-ink">{money(order.shippingAmount, order.currency)}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-3 text-base font-bold text-ink">
                  <dt>{t.thankYou.total}</dt>
                  <dd>{money(order.totalAmount, order.currency)}</dd>
                </div>
              </dl>
            </section>
          </>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {wa && (
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent(t.thankYou.whatsappMessage(storeName, orderNumber ?? ""))}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btnPrimary} sm:col-span-2`}
            >
              <WhatsAppIcon />
              {t.thankYou.whatsapp}
            </a>
          )}
          <Link href={`/store/${workspaceId}/track`} className={btnSecondary}>
            {t.thankYou.track}
          </Link>
          <Link href={`/store/${workspaceId}`} className={btnSecondary}>
            {t.thankYou.backToStore}
          </Link>
        </div>

        {storeUrl && (
          <section className="mt-8 text-center" aria-labelledby="share-title">
            <h2 id="share-title" className="text-sm font-semibold text-ink">
              {t.thankYou.share}
            </h2>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${t.thankYou.shareText(storeName)} ${storeUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={btnSecondary}
              >
                <WhatsAppIcon size={18} />
                {t.thankYou.shareWhatsapp}
              </a>
              <button type="button" onClick={copyLink} className={btnSecondary}>
                {copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
                <span aria-live="polite">{copied ? t.thankYou.copied : t.thankYou.copyLink}</span>
              </button>
              {canShare && (
                <button type="button" onClick={nativeShare} className={btnSecondary}>
                  <ShareIcon size={18} />
                  {t.thankYou.shareNative}
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      {more.length > 0 && (
        <section className="mx-auto mt-14 max-w-5xl" aria-labelledby="more-title">
          <h2 id="more-title" className="mb-5 text-center text-xl font-semibold text-ink">
            {t.thankYou.moreFromStore}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {more.map((p) => (
              <li key={p.id} className="flex">
                <ProductCard product={p} workspaceId={workspaceId} currency={order?.currency ?? store?.currency ?? "EGP"} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-6 py-16 text-center text-sm text-ink-soft">…</main>}>
      <Confirmation />
    </Suspense>
  );
}

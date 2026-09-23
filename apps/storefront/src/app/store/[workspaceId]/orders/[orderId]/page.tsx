"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BoxIcon, CheckIcon, CopyIcon, ShareIcon, WhatsAppIcon } from "@/components/Icons";
import { OrderTicket } from "@/components/immersive/OrderTicket";
import { StatusTimeline } from "@/components/StatusTimeline";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimary, btnSecondary, card, container, skeleton } from "@/components/ui";
import { whatsappNumber } from "@/lib/egypt";
import { getAcceptedUpsell, getOrderSnapshot } from "@/lib/commerce";
import { useHydrated } from "@/lib/funnelSession";
import { useStore } from "@/lib/StoreContext";
import { storeHref } from "@/lib/storeHref";

/**
 * The thank-you page: the order ticket, what happens next, and the two things
 * a shopper does from here — track the order and tell someone about the store
 * — given their own cards rather than a row of buttons at the bottom.
 *
 * Everything about the order is read on this device (localStorage) after
 * hydration, so the server render and the first client render agree; the
 * order number in the URL covers a device that has nothing saved.
 */
function Confirmation() {
  const { workspaceId, orderId } = useParams<{ workspaceId: string; orderId: string }>();
  const search = useSearchParams();
  const basePath = useStoreBasePath();
  const { t, money, store } = useStore();
  const hydrated = useHydrated();

  const snapshot = hydrated ? getOrderSnapshot(workspaceId, orderId) : null;
  const upsell = hydrated ? getAcceptedUpsell(workspaceId, orderId) : null;
  // The store's shareable address: its own origin on a subdomain, the
  // /store/<workspaceId> path on the shared host.
  const storeUrl = hydrated ? `${window.location.origin}${storeHref(basePath, "/")}` : "";
  const canShare = hydrated && typeof navigator.share === "function";
  // Set by the checkout page when an online payment page could not be opened.
  const paymentFailed = search.get("pay") === "failed";

  const [copied, setCopied] = useState(false);

  const orderNumber = snapshot?.orderNumber ?? search.get("number");
  const currency = snapshot?.currency ?? store?.currency;
  const wa = store?.phone ? whatsappNumber(store.phone) : null;
  const storeName = store?.name ?? "";

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
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckIcon size={32} />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold text-ink sm:text-3xl">{t.thankYou.title}</h1>
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
            {snapshot?.phone && (
              <>
                {" "}
                {t.thankYou.onPhone}{" "}
                <span dir="ltr" className="font-semibold text-ink">
                  {snapshot.phone}
                </span>
              </>
            )}
          </p>
        </div>

        {paymentFailed && (
          <p role="status" className="mt-6 rounded-2xl border border-accent/40 bg-accent-soft px-5 py-4 text-sm text-ink">
            {t.shop.paymentPageFailed}
          </p>
        )}

        {upsell && (
          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary-soft px-5 py-4 text-sm" role="status">
            <p className="font-semibold text-primary">
              {t.upsell.accepted(upsell.name)} — {money(upsell.offerAmount, currency)}
            </p>
            <p className="mt-0.5 text-ink-soft">{t.upsell.acceptedHint}</p>
          </div>
        )}

        {orderNumber ? (
          <div className="mt-8">
            <OrderTicket
              orderNumber={orderNumber}
              total={snapshot?.totalAmount}
              currency={currency}
              storeName={storeName}
              note={t.thankYou.payOnDelivery}
            />
          </div>
        ) : !hydrated ? (
          <div className={`${skeleton} mt-8 h-28 w-full rounded-2xl`} aria-hidden />
        ) : null}

        {/* The two things to do from here, side by side and hard to miss. */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <section className={`${card} flex flex-col p-5`} aria-labelledby="track-title">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <BoxIcon />
            </span>
            <h2 id="track-title" className="mt-3 text-base font-semibold text-ink">
              {t.thankYou.track}
            </h2>
            <p className="mt-1 flex-1 text-sm text-ink-soft">{t.track.subtitle}</p>
            <StoreLink href="/track" className={`${btnPrimary} mt-4 w-full`}>
              {t.thankYou.track}
            </StoreLink>
          </section>

          <section className={`${card} flex flex-col p-5`} aria-labelledby="share-title">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <ShareIcon />
            </span>
            <h2 id="share-title" className="mt-3 text-base font-semibold text-ink">
              {t.thankYou.share}
            </h2>
            <p className="mt-1 flex-1 text-sm text-ink-soft">{t.shop.shareHint}</p>
            <div className="mt-4 grid gap-2">
              <a
                href={storeUrl ? `https://wa.me/?text=${encodeURIComponent(`${t.thankYou.shareText(storeName)} ${storeUrl}`)}` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!storeUrl}
                className={`${btnSecondary} w-full ${storeUrl ? "" : "pointer-events-none opacity-60"}`}
              >
                <WhatsAppIcon size={18} />
                {t.thankYou.shareWhatsapp}
              </a>
              <div className={`grid gap-2 ${canShare ? "grid-cols-2" : ""}`}>
                <button type="button" onClick={copyLink} disabled={!storeUrl} className={btnSecondary}>
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
            </div>
          </section>
        </div>

        {wa && (
          <a
            href={`https://wa.me/${wa}?text=${encodeURIComponent(t.thankYou.whatsappMessage(storeName, orderNumber ?? ""))}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btnSecondary} mt-4 w-full`}
          >
            <WhatsAppIcon />
            {t.thankYou.whatsapp}
          </a>
        )}

        <section className={`${card} mt-6 p-5 sm:p-6`} aria-labelledby="next-title">
          <h2 id="next-title" className="mb-5 text-lg font-semibold text-ink">
            {t.thankYou.steps}
          </h2>
          <StatusTimeline stage={1} />
        </section>

        {snapshot && (
          <section className={`${card} mt-6 p-5 sm:p-6`} aria-labelledby="summary-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="summary-title" className="text-lg font-semibold text-ink">
                {t.thankYou.summary}
              </h2>
              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                {t.thankYou.payOnDelivery}
              </span>
            </div>
            <ul className="mt-4 space-y-3">
              {snapshot.items.map((item, i) => (
                <li key={i} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 text-ink">
                    {item.name}
                    {item.options && <span className="block text-xs text-ink-soft">{item.options}</span>}
                    <span className="text-xs text-ink-soft"> × {item.quantity}</span>
                  </span>
                  <span className="shrink-0 text-ink">{money(item.lineTotal, currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">{t.thankYou.subtotal}</dt>
                <dd className="text-ink">{money(snapshot.subtotalAmount, currency)}</dd>
              </div>
              {snapshot.discountAmount > 0 && (
                <div className="flex justify-between text-success">
                  <dt>{t.thankYou.discount}</dt>
                  <dd>−{money(snapshot.discountAmount, currency)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-soft">{t.thankYou.shipping}</dt>
                <dd className="text-ink">{money(snapshot.shippingAmount, currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-base font-bold text-ink">
                <dt>{t.thankYou.total}</dt>
                <dd>{money(snapshot.totalAmount, currency)}</dd>
              </div>
            </dl>
            {upsell && <p className="mt-3 text-xs text-ink-soft">{t.checkout.finalNote}</p>}
          </section>
        )}

        <div className="mt-8 text-center">
          <StoreLink href="/" className={btnSecondary}>
            {t.thankYou.backToStore}
          </StoreLink>
        </div>
      </div>
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

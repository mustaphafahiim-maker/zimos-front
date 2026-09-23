"use client";

import { Suspense, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BoxIcon, CheckIcon } from "@/components/Icons";
import { useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimaryLg, card, container, skeleton } from "@/components/ui";
import { acceptUpsell, getOrderSnapshot, getUpsellOffer } from "@/lib/commerce";
import { useHydrated } from "@/lib/funnelSession";
import { useStore } from "@/lib/StoreContext";
import { storeHref } from "@/lib/storeHref";
import { useCatalog } from "@/lib/useCatalog";

/**
 * Post-purchase one-click upsell. The order already exists; both answers
 * continue to the thank-you page. Accepting is recorded on this device and
 * confirmed on the merchant’s call — there is no append-to-order endpoint.
 */
function UpsellOfferView() {
  const { workspaceId, orderId } = useParams<{ workspaceId: string; orderId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { t, money } = useStore();
  const { products, loaded } = useCatalog(workspaceId);
  const basePath = useStoreBasePath();
  // Read on this device after hydration (localStorage), so SSR and the first client render agree.
  const hydrated = useHydrated();
  const snapshot = hydrated ? getOrderSnapshot(workspaceId, orderId) : null;
  // Either answer moves on once; a second tap must not record the offer twice.
  const answered = useRef(false);

  const orderNumber = snapshot?.orderNumber ?? search.get("number");
  // A find over a short list; the snapshot is re-read each render, so nothing to memoise on.
  const offer = loaded ? getUpsellOffer(products ?? [], snapshot?.productIds ?? []) : null;

  const thankYouHref = storeHref(
    basePath,
    `/orders/${orderId}${orderNumber ? `?${new URLSearchParams({ number: orderNumber }).toString()}` : ""}`
  );

  function accept() {
    if (answered.current) return;
    answered.current = true;
    if (offer) acceptUpsell(workspaceId, orderId, offer);
    router.push(thankYouHref);
  }

  function decline() {
    if (answered.current) return;
    answered.current = true;
    router.push(thankYouHref);
  }

  return (
    <main className={`${container} flex-1 py-8 sm:py-12`}>
      <div className="mx-auto max-w-2xl">
        <p
          className="flex items-center justify-center gap-2 rounded-xl bg-success-soft px-4 py-2.5 text-center text-sm font-medium text-success"
          role="status"
        >
          <CheckIcon size={18} />
          <span>
            {t.thankYou.received}
            {orderNumber && (
              <>
                {" "}
                <span dir="ltr" className="font-semibold">
                  #{orderNumber}
                </span>
              </>
            )}
          </span>
        </p>

        <div className={`${card} mt-6 overflow-hidden`}>
          <div className="bg-primary px-5 py-3 text-center text-sm font-semibold text-on-primary">{t.upsell.eyebrow}</div>

          {!offer ? (
            // The catalogue is on its way: the card's shape, so nothing jumps when it lands.
            <div className="p-5 sm:p-8" role="status" aria-busy="true" aria-label={t.common.loading}>
              <div className={`${skeleton} mx-auto h-7 w-3/4`} />
              <div className={`${skeleton} mx-auto mt-3 h-4 w-1/2`} />
              <div className="mt-6 grid items-center gap-6 sm:grid-cols-[14rem_1fr]">
                <div className={`${skeleton} mx-auto aspect-square w-full max-w-56 rounded-2xl`} />
                <div className="space-y-3">
                  <div className={`${skeleton} h-6 w-2/3`} />
                  <div className={`${skeleton} h-4 w-full`} />
                  <div className={`${skeleton} h-4 w-5/6`} />
                  <div className={`${skeleton} mt-2 h-9 w-40`} />
                </div>
              </div>
              <div className={`${skeleton} mt-8 h-12 w-full`} />
            </div>
          ) : (
            <div className="p-5 sm:p-8">
              <h1 className="text-center text-2xl font-bold text-ink sm:text-3xl">{t.upsell.title}</h1>
              <p className="mx-auto mt-2 max-w-md text-center text-sm text-ink-soft">{t.upsell.subtitle}</p>

              <div className="mt-6 grid items-center gap-6 sm:grid-cols-[14rem_1fr]">
                <div className="mx-auto aspect-square w-full max-w-56 overflow-hidden rounded-2xl border border-line bg-paper">
                  {offer.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={offer.imageUrl} alt="" width={224} height={224} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-primary/40">
                      <BoxIcon size={64} />
                    </div>
                  )}
                </div>
                <div className="text-center sm:text-start">
                  <h2 className="text-xl font-semibold text-ink">{offer.name}</h2>
                  {offer.description && <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-ink-soft">{offer.description}</p>}
                  <p className="mt-4 flex flex-wrap items-baseline justify-center gap-x-3 sm:justify-start">
                    <span className="text-3xl font-bold text-ink">{money(offer.offerAmount, snapshot?.currency)}</span>
                    <span className="text-lg text-ink-soft line-through">{money(offer.regularAmount, snapshot?.currency)}</span>
                  </p>
                  <p className="mt-1 text-sm font-medium text-success">
                    {t.upsell.save(money(offer.regularAmount - offer.offerAmount, snapshot?.currency))}
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-2">
                <button type="button" onClick={accept} className={btnPrimaryLg}>
                  {t.upsell.yes}
                </button>
                <button
                  type="button"
                  onClick={decline}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline"
                >
                  {t.upsell.no}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function UpsellOfferPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-6 py-16 text-center text-sm text-ink-soft">…</main>}>
      <UpsellOfferView />
    </Suspense>
  );
}

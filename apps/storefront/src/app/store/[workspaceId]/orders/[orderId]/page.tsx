"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { ShopperPaymentStatus, StorefrontUpsellAccepted } from "@store-builder/api-client";
import { CheckIcon, CopyIcon, ShareIcon, WhatsAppIcon } from "@/components/Icons";
import { OrderConfirmationHero, OrderConfirmationSkeleton, OrderSnapshotSummary, type ConfirmationPayment } from "@/components/OrderConfirmation";
import { StatusTimeline } from "@/components/StatusTimeline";
import { ThankYouMessage, ThankYouProducts } from "@/components/ThankYouExtras";
import { formOptionsOf } from "@/lib/orderForm";
import { useStoreBasePath } from "@/components/StoreRoute";
import { btnSecondary, card, container } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { deliveryRangeText, getOrderBuyNotes } from "@/lib/buyInfo";
import { whatsappNumber } from "@/lib/egypt";
import {
  getOrderSnapshot,
  saveOrderSnapshot,
  type OrderSnapshot,
} from "@/lib/commerce";
import { getPaymentToken, usePreviewToken } from "@/lib/payments";
import { useStore } from "@/lib/StoreContext";
import { storeHref } from "@/lib/storeHref";
import { getTrackingToken } from "@/lib/trackingTokens";
import { ThankYouUpsell, CrossSellStrip } from "@/components/offers/StoreOffers";
import { ThankYouDownloads } from "@/components/ThankYouDownloads";
import { ThankYouBuyNotes } from "@/components/ThankYouBuyNotes";
import { ThankYouFulfilment } from "@/components/fulfilment/OrderFulfilmentNotes";
import { OrderUpdatesButton } from "@/components/OrderUpdatesButton";
import { trackPurchaseOnce } from "@/lib/track";
import { useIsClient } from "@/lib/useIsClient";
// What a gift card, points and store credit paid (handoff 201, 203, 204); it falls back to the gift card's own note (189).
import { OrderTendersNote } from "@/components/tenders/OrderTendersNote";
import { tenderOrderOf } from "@/components/tenders/tenderOrders";
// The store's post-purchase survey, under the order summary (handoff 236).
import { PostPurchaseSurvey } from "@/components/survey/PostPurchaseSurvey";

// The ways to pay that go through a gateway: such an order is "paid" only once the gateway said so.
const ONLINE_METHODS = ["card", "wallet", "valu", "kiosk", "paypal"];
// The store's post-purchase offer stays open for half an hour after the order (backend offers/offerRules.js);
// a little over, for a phone whose clock runs ahead. Only used to decide whether to hold the offer's place.
const OFFER_OPEN_MS = 35 * 60 * 1000;

function Confirmation() {
  const { workspaceId, orderId } = useParams<{ workspaceId: string; orderId: string }>();
  const search = useSearchParams();
  const basePath = useStoreBasePath();
  const { t, intlLocale, store } = useStore();

  const [copied, setCopied] = useState(false);

  // Read on this device only once hydrated (localStorage), so SSR and
  // hydration agree.
  const isClient = useIsClient();
  const snapshot = useMemo<OrderSnapshot | null>(
    () => (isClient ? getOrderSnapshot(workspaceId, orderId) : null),
    [isClient, workspaceId, orderId]
  );
  // The store’s shareable address: its own origin on a subdomain, the
  // /store/<workspaceId> path on the shared host.
  const storeUrl = isClient ? `${window.location.origin}${storeHref(basePath, "/")}` : "";
  const canShare = isClient && typeof navigator.share === "function";

  // Purchase, once per order on this device (trackPurchaseOnce remembers it),
  // as soon as the saved order is readable. A device with no snapshot has
  // nothing to value the order with, so it sends nothing rather than a zero.
  // The ref keeps this to one call even when storage is blocked.
  const purchaseTracked = useRef<string | null>(null);
  useEffect(() => {
    if (!snapshot || purchaseTracked.current === snapshot.id) return;
    purchaseTracked.current = snapshot.id;
    trackPurchaseOnce(snapshot.id, {
      valueMinor: snapshot.totalAmount,
      currency: snapshot.currency,
      contentIds: snapshot.contentIds ?? snapshot.productIds,
      numItems: snapshot.items.reduce((sum, item) => sum + item.quantity, 0),
    });
  }, [snapshot]);

  const orderNumber = snapshot?.orderNumber ?? search.get("number");
  const currency = snapshot?.currency ?? store?.currency;
  const wa = store?.phone ? whatsappNumber(store.phone) : null;
  const storeName = store?.name ?? "";
  // The merchant's thank-you settings: their message, the back-home button
  // and a few products from a collection of their choosing.
  const thanks = store?.thankYou;
  const shortMessage = formOptionsOf(store?.checkout).thank_you_message;
  const showBackHome = !thanks?.enabled || thanks.show_back_home_button;

  // What else this browser kept from the checkout's answer: the order's tracking token, what a gift
  // card, points or credit paid, and the delivery window it was placed with.
  const kept = useMemo(
    () =>
      isClient
        ? {
            trackingToken: getTrackingToken(workspaceId, orderId),
            tender: tenderOrderOf(workspaceId, orderId),
            notes: getOrderBuyNotes(workspaceId, orderId),
          }
        : null,
    [isClient, workspaceId, orderId]
  );

  // An order paid through a gateway: its payment is read once (with the token this browser holds),
  // so the page says "paid", "still waiting" or "ran out" — never a promise about a call.
  const method = snapshot?.paymentMethod;
  const online = method !== undefined && ONLINE_METHODS.includes(method);
  const paymentToken = useMemo(() => (isClient && online ? getPaymentToken(workspaceId, orderId) : null), [isClient, online, workspaceId, orderId]);
  const preview = usePreviewToken(workspaceId);
  const [paid, setPaid] = useState<{ orderId: string; state: ShopperPaymentStatus["status"] | "unknown" } | null>(null);
  useEffect(() => {
    if (!paymentToken) return;
    let stale = false;
    createStorefrontApiClient()
      .getOrderPayment(workspaceId, orderId, paymentToken, { previewToken: preview })
      .then((payment) => {
        if (!stale) setPaid({ orderId, state: payment.status });
      })
      .catch(() => {
        if (!stale) setPaid({ orderId, state: "unknown" });
      });
    return () => {
      stale = true;
    };
  }, [workspaceId, orderId, paymentToken, preview]);

  // How the order is paid, as far as this page knows: it words the one sentence under the number.
  let payment: ConfirmationPayment | null;
  if (!isClient) payment = null;
  else if (!snapshot) payment = "elsewhere";
  else if (kept?.tender?.paidInStore) payment = "received";
  else if (method === "bank_transfer") payment = "transfer";
  else if (online) {
    const state = paid && paid.orderId === orderId ? paid.state : null;
    if (!paymentToken) payment = "received";
    else if (state === null) payment = null;
    else if (state === "paid") payment = "paid";
    else if (state === "awaiting_payment") payment = "awaiting";
    else if (state === "expired") payment = "expired";
    else if (state === "cancelled") payment = "cancelled";
    else if (state === "cod") payment = "cod";
    else payment = "received";
  } else if (method === undefined || method === "cod") payment = "cod";
  // Paid later on account, or a way to pay this page does not know: no promise it cannot keep.
  else payment = "received";

  const tender = kept?.tender;
  const partPaid = Boolean(tender && (tender.giftCard?.applied || tender.points?.applied || tender.credit?.applied));
  const deliveryText = kept?.notes?.delivery ? deliveryRangeText(kept.notes.delivery, t.buyInfo, intlLocale) : "";

  // Whether this order can still get the store's post-purchase offer: placed from this browser within
  // the last half hour, to be paid on delivery or through a gateway. Its place is then held from the
  // first paint; any other order is still asked about, and an offer that comes opens its own place.
  const offerLikely = useMemo(() => {
    if (!snapshot) return false;
    const placed = Date.parse(snapshot.createdAt);
    if (!Number.isFinite(placed) || Date.now() - placed > OFFER_OPEN_MS) return false;
    const how = snapshot.paymentMethod;
    return how === undefined || how === "cod" || ONLINE_METHODS.includes(how);
  }, [snapshot]);

  // «تابع طلبك»: the tracking page with the number filled in. In the browser that placed the order
  // it opens the order by itself — it finds the order's token here (lib/trackingTokens), so the
  // token never travels in the address.
  const trackQuery = new URLSearchParams();
  if (orderNumber) trackQuery.set("number", orderNumber);
  if (kept?.trackingToken) trackQuery.set("order", orderId);
  const trackSearch = trackQuery.toString();
  const trackHref = trackSearch ? `/track?${trackSearch}` : "/track";

  // The offer was taken into this order: the server's answer carries the order's new totals, so
  // the page shows what the courier will collect — now, and after a reload (the saved copy is
  // brought up to date, as a funnel's offer does in lib/commerce mergeIntoOrderSnapshot).
  const [upsold, setUpsold] = useState<OrderSnapshot | null>(null);
  function onUpsellAccepted(order: StorefrontUpsellAccepted) {
    if (!snapshot || order.followOn || order.id !== snapshot.id) return;
    const next: OrderSnapshot = {
      ...snapshot,
      subtotalAmount: order.subtotalAmount,
      shippingAmount: order.shippingAmount,
      totalAmount: order.totalAmount,
      items: [...snapshot.items, { name: order.added.productName, options: "", quantity: 1, lineTotal: order.added.amount }],
    };
    saveOrderSnapshot(workspaceId, next);
    setUpsold(next);
  }
  const shown = upsold && upsold.id === snapshot?.id ? upsold : snapshot;

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
    <main className={`${container} flex-1 py-6 sm:py-14`}>
      <div className="mx-auto max-w-2xl">
        {/* The first screen: it went through, what happens next, what to pay and where it goes, the way to follow it. */}
        <OrderConfirmationHero
          orderNumber={orderNumber}
          snapshot={shown}
          ready={isClient}
          payment={payment}
          partPaid={partPaid}
          currency={currency}
          deliveryText={deliveryText}
          trackHref={trackHref}
          payHref={`/pay/${orderId}`}
          showKeepShopping={showBackHome}
        />

        {/* The merchant's own words keep their place right under it. */}
        {shortMessage && <p className="mt-4 text-center text-sm font-medium text-ink">{shortMessage}</p>}
        {thanks && (
          <ThankYouMessage page={thanks} orderNumber={orderNumber} customerName={snapshot?.customerName ?? null} />
        )}

        {/*
          The store's post-purchase offer (Offers → Post-purchase upsell): one tap adds it to this order.
          It sits under the first screen's content, and for an order that can still get one its place is
          held from the first paint, so its arriving moves nothing a shopper is reading; with no offer
          the place closes once.
        */}
        <ThankYouUpsell workspaceId={workspaceId} orderId={orderId} orderNumber={orderNumber} onAccepted={onUpsellAccepted} reserve={offerLikely} />

        <section className={`${card} mt-6 p-5 sm:p-6`} aria-labelledby="next-title">
          <h2 id="next-title" className="mb-5 text-lg font-semibold text-ink">
            {t.thankYou.steps}
          </h2>
          <StatusTimeline stage={1} />
        </section>

        {/* A paid online order's digital products, as soon as the payment is captured. */}
        <ThankYouDownloads workspaceId={workspaceId} orderId={orderId} />

        {/* Notifications about this order on this phone, when the store app is on. */}
        <OrderUpdatesButton workspaceId={workspaceId} orderId={orderId} orderNumber={orderNumber} />

        {/* Lines ordered ahead of stock, with their ship date; the delivery window is said in the first screen. */}
        <ThankYouBuyNotes workspaceId={workspaceId} orderId={orderId} showDelivery={!snapshot} />
        {/* The delivery day and time the shopper chose, or the pickup code and place (handoff 221, 225). */}
        <ThankYouFulfilment workspaceId={workspaceId} orderId={orderId} />

        {shown && (
          <div className="mt-6">
            <OrderSnapshotSummary snapshot={shown} currency={currency} />
          </div>
        )}
        <OrderTendersNote workspaceId={workspaceId} orderId={orderId} />
        <PostPurchaseSurvey workspaceId={workspaceId} orderId={orderId} />

        {/* A question about the order: the store, one tap away. Without a saved order the first screen already offers it. */}
        {wa && snapshot && (
          <a
            href={`https://wa.me/${wa}?text=${encodeURIComponent(t.thankYou.whatsappMessage(storeName, orderNumber ?? ""))}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btnSecondary} mt-6 w-full`}
          >
            <WhatsAppIcon />
            {t.thankYou.whatsapp}
          </a>
        )}

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
                {copied ? t.thankYou.copied : t.thankYou.copyLink}
              </button>
              {canShare && (
                <button type="button" onClick={nativeShare} className={btnSecondary}>
                  <ShareIcon size={18} />
                  {t.thankYou.shareNative}
                </button>
              )}
            </div>
            {/* The answer to "Copy link", said once to a screen reader. */}
            <span role="status" className="sr-only">
              {copied ? t.thankYou.copied : ""}
            </span>
          </section>
        )}

        {/* What goes with what they just bought (Offers → Cross-sell, on the thank-you page); its row is held while it is read. */}
        {snapshot && snapshot.productIds.length > 0 && (
          <CrossSellStrip workspaceId={workspaceId} placement="thank_you" productIds={snapshot.productIds} reserve />
        )}

        {thanks?.enabled && thanks.show_products_from_collection_id && (
          <ThankYouProducts workspaceId={workspaceId} collectionId={thanks.show_products_from_collection_id} />
        )}
      </div>
    </main>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<OrderConfirmationSkeleton />}>
      <Confirmation />
    </Suspense>
  );
}

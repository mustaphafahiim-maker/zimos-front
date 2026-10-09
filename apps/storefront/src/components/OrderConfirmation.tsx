"use client";

import type { ReactNode } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import type { OrderSnapshot } from "@/lib/commerce";
import { governorateName, whatsappNumber } from "@/lib/egypt";
import { pickText, type Locale } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { PhoneIcon, TruckIcon, WhatsAppIcon } from "./Icons";
import { CopyButton } from "./StatusTimeline";
import { StoreLink } from "./StoreRoute";
import { btnGhost, btnPrimaryLg, btnSecondary, card, container, skeleton } from "./ui";
// An order paid later on account (handoff 229) is not paid on delivery: its badge and a line under the totals say so.
import { isOnAccountSnapshot, OnAccountPlacedNote, ThankYouPaymentLabel } from "./business/OnAccountThankYou";

/**
 * The pieces of the store's thank-you page (orders/[orderId]) that a funnel's
 * thank-you step shows too, so a funnel order is confirmed the same way.
 */

/**
 * What the page knows about how the order is paid — it decides the one
 * sentence under the order number:
 *   cod        «هنكلّمك على 01… نأكّد الطلب قبل الشحن»
 *   paid       paid online, being prepared
 *   transfer   a bank / wallet transfer the store is checking
 *   awaiting   an online order not paid yet
 *   received   placed, nothing more known (paid in full by a gift card, on account…)
 *   elsewhere  no saved copy in this browser: the link was opened on another device, or storage is off
 *   expired / cancelled   the online payment ran out, or the order was cancelled
 */
export type ConfirmationPayment = "cod" | "paid" | "transfer" | "awaiting" | "received" | "elsewhere" | "expired" | "cancelled";

const TEXT = {
  en: {
    title: "We got your order",
    copy: "Copy",
    copied: "Copied",
    codBefore: "We'll call you on",
    codAfter: "to confirm your order before it ships.",
    codNoPhone: "We'll call you to confirm your order before it ships.",
    paid: "Payment received — we're getting your order ready to ship.",
    transfer: "We're checking your transfer and will confirm your order as soon as it arrives.",
    awaiting: "We're still waiting for the payment to confirm your order.",
    received: "We received your order and are getting it ready.",
    elsewhere: "Your order is in. Track it any time with the order number and your mobile number.",
    paidBadge: "Paid",
    transferBadge: "Transfer under review",
    awaitingBadge: "Awaiting payment",
    address: "Delivery address",
    track: "Track your order",
    keepShopping: "Keep shopping",
    contactTitle: "Need help? Contact the store",
    call: "Call",
  },
  ar: {
    title: "طلبك وصلنا",
    copy: "نسخ",
    copied: "اتنسخ",
    codBefore: "هنكلّمك على",
    codAfter: "نأكّد الطلب قبل الشحن.",
    codNoPhone: "هنكلّمك نأكّد الطلب قبل الشحن.",
    paid: "دفعك وصل، وبنجهّز طلبك للشحن.",
    transfer: "بنراجع تحويلك، وهنأكّد الطلب أول ما يوصل.",
    awaiting: "لسه مستنيين الدفع عشان نأكّد طلبك.",
    received: "استلمنا طلبك وبنجهّزه.",
    elsewhere: "طلبك متسجّل عندنا. تابعه في أي وقت برقم الطلب ورقم موبايلك.",
    paidBadge: "مدفوع",
    transferBadge: "تحويل قيد المراجعة",
    awaitingBadge: "مستني الدفع",
    address: "عنوان التوصيل",
    track: "تابع طلبك",
    keepShopping: "كمّل تسوّق",
    contactTitle: "محتاج مساعدة؟ كلّم المتجر",
    call: "اتصل",
  },
  fr: {
    title: "Votre commande est bien reçue",
    copy: "Copier",
    copied: "Copié",
    codBefore: "Nous vous appelons au",
    codAfter: "pour confirmer votre commande avant l'expédition.",
    codNoPhone: "Nous vous appelons pour confirmer votre commande avant l'expédition.",
    paid: "Paiement reçu — nous préparons votre commande pour l'expédition.",
    transfer: "Nous vérifions votre virement et confirmerons la commande dès sa réception.",
    awaiting: "Nous attendons encore le paiement pour confirmer votre commande.",
    received: "Nous avons bien reçu votre commande et la préparons.",
    elsewhere: "Votre commande est enregistrée. Suivez-la à tout moment avec son numéro et votre numéro de mobile.",
    paidBadge: "Payée",
    transferBadge: "Virement en vérification",
    awaitingBadge: "En attente de paiement",
    address: "Adresse de livraison",
    track: "Suivre ma commande",
    keepShopping: "Continuer mes achats",
    contactTitle: "Besoin d'aide ? Contactez la boutique",
    call: "Appeler",
  },
};

/**
 * This file's words, with the merchant's own where they wrote some (dashboard →
 * Store texts lays them over the dictionary's `thankYou.*`): a store that
 * reworded its thank-you title, its confirmation notice or its buttons keeps
 * its wording; every other store gets the new, shorter one.
 */
function useConfirmationCopy() {
  const { t, locale, store } = useStore();
  const own = pickText(TEXT, locale);
  const theirs: Record<string, string | undefined> = store?.storefrontTexts?.[locale] ?? {};
  const has = (key: string) => (theirs[key] ?? "").trim() !== "";
  return {
    own,
    title: has("thankYou.title") ? t.thankYou.title : own.title,
    track: has("thankYou.track") ? t.thankYou.track : own.track,
    keepShopping: has("thankYou.backToStore") ? t.thankYou.backToStore : own.keepShopping,
    /** False when the merchant reworded the confirmation notice: theirs is said, with the phone after it as before. */
    ownCallNotice: !has("thankYou.callNotice") && !has("thankYou.onPhone"),
  };
}

/**
 * The calm success mark, «طلبك وصلنا», the order number (one tap copies it) and
 * the one sentence of what happens next, worded for how the order is paid.
 */
export function ConfirmationHeading({
  as: Heading = "h1",
  orderNumber,
  phone,
  payment = "cod",
  pending = false,
}: {
  /** h2 when the heading sits under a merchant-built page. */
  as?: "h1" | "h2";
  orderNumber: string | null;
  phone?: string | null;
  /** How the order is paid, as far as the page knows; cash on delivery when not said (a funnel's thank-you step). */
  payment?: ConfirmationPayment;
  /** The sentence is not known yet (the saved order, or its payment, is still being read): its two lines hold their space. */
  pending?: boolean;
}) {
  const { t } = useStore();
  const copy = useConfirmationCopy();
  const { own } = copy;
  const stopped = payment === "expired" || payment === "cancelled";
  const number = phone ? (
    <bdi dir="ltr" className="font-semibold text-ink">
      {phone}
    </bdi>
  ) : null;

  let sentence: ReactNode;
  if (payment === "cod") {
    sentence = !copy.ownCallNotice ? (
      <>
        {t.thankYou.callNotice}
        {number && (
          <>
            {" "}
            {t.thankYou.onPhone} {number}
          </>
        )}
      </>
    ) : number ? (
      <>
        {own.codBefore} {number} {own.codAfter}
      </>
    ) : (
      own.codNoPhone
    );
  } else if (payment === "expired") sentence = t.payment.expiredHint;
  else if (payment === "cancelled") sentence = null;
  else sentence = own[payment];

  return (
    <div className="flex flex-col items-center text-center">
      <span className={`flex h-14 w-14 items-center justify-center rounded-full ${stopped ? "bg-paper text-ink-soft" : "bg-success-soft text-success"}`}>
        {stopped ? <WarningCircleIcon size={32} aria-hidden /> : <CheckCircleIcon size={34} weight="fill" aria-hidden />}
      </span>
      <Heading className="mt-3 font-display text-2xl font-bold text-ink sm:text-3xl">
        {stopped ? (payment === "expired" ? t.payment.expired : t.payment.cancelled) : copy.title}
      </Heading>
      {orderNumber && (
        // The label sits over the chip, so a long number (ORD-XXXXXXXX-XXXXXXXX) fits a narrow phone whole; it is never cut short.
        <div className="mt-3 flex max-w-full flex-col items-center gap-1">
          <span className="text-xs leading-4 text-ink-soft">{t.thankYou.orderNumber}</span>
          <CopyButton value={orderNumber} copy={own.copy} copied={own.copied}>
            <bdi dir="ltr" className="min-w-0 break-all font-bold tabular-nums text-ink">
              {orderNumber}
            </bdi>
          </CopyButton>
        </div>
      )}
      {/* Two lines are held, so the sentence arriving (or growing by the phone number) moves nothing under it. */}
      <div className="mt-3 flex min-h-12 w-full max-w-md items-start justify-center text-[0.9375rem] leading-6 text-ink-soft">
        {pending ? (
          <span aria-hidden className="flex w-64 max-w-full flex-col items-center gap-2 pt-1">
            <span className={`${skeleton} block h-3.5 w-full`} />
            <span className={`${skeleton} block h-3.5 w-2/3`} />
          </span>
        ) : (
          sentence && <p>{sentence}</p>
        )}
      </div>
    </div>
  );
}

/** What the saved order says about where it goes, when it says so. */
interface SavedAddress {
  addressLine?: string | null;
  area?: string | null;
  city?: string | null;
  province?: string | null;
}

/**
 * The delivery address in two lines — the street, then the area, city and
 * governorate — for a saved order that carries one (`shippingAddress`, shaped
 * as the checkout's answer shapes `shippingAddressSnapshot`). The copy
 * lib/commerce keeps today has no address, so this shows nothing until it
 * does; nothing is guessed.
 */
function addressLinesOf(snapshot: OrderSnapshot, locale: Locale): [string, string] | null {
  const saved = (snapshot as OrderSnapshot & { shippingAddress?: SavedAddress | null }).shippingAddress;
  if (!saved || typeof saved !== "object") return null;
  const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const street = clean(saved.addressLine);
  const province = clean(saved.province);
  const places = [clean(saved.area), clean(saved.city), province ? governorateName(province, locale) : ""].filter(
    (part, i, all) => part && all.indexOf(part) === i
  );
  if (!street && places.length === 0) return null;
  return [street, places.join(locale === "ar" ? "، " : ", ")];
}

/**
 * The first screen of the store's thank-you page, in the order a shopper asks:
 * did it go through (the mark, «طلبك وصلنا», the number) → what happens next
 * (one sentence, by how it is paid) → what do I pay and where is it going →
 * the way to follow it, and a quiet way back to the store.
 *
 * Everything the saved order feeds holds its space until this browser's copy
 * is readable (`ready`), so the screen a shopper is reading does not move. With
 * no copy in this browser — the link was opened on another device — the number,
 * «تابع طلبك» (the tracking form, number filled in) and the store's contact stay.
 */
export function OrderConfirmationHero({
  orderNumber,
  snapshot,
  ready,
  payment,
  partPaid = false,
  currency,
  deliveryText,
  trackHref,
  payHref,
  showKeepShopping,
}: {
  orderNumber: string | null;
  /** The order as this device saved it at checkout; null on another device. */
  snapshot: OrderSnapshot | null;
  /** False during SSR and hydration, when the browser's own copy cannot be read yet. */
  ready: boolean;
  /** Null while an online order's payment is still being read. */
  payment: ConfirmationPayment | null;
  /** A gift card, points or store credit paid part of it: the total stands alone, and the page's own note says what is left. */
  partPaid?: boolean;
  currency: string | undefined;
  /** The delivery window the order was placed with, already in words; "" when none. */
  deliveryText?: string;
  /** Where «تابع طلبك» goes: this order on the tracking page, or its form with the number filled in. */
  trackHref: string;
  /** The order's payment page, for an online order not paid yet. */
  payHref?: string;
  /** The merchant's "back to the store" button setting. */
  showKeepShopping: boolean;
}) {
  const { t, money, locale, store } = useStore();
  const copy = useConfirmationCopy();
  const { own } = copy;
  const stopped = payment === "expired" || payment === "cancelled";
  const address = snapshot ? addressLinesOf(snapshot, locale) : null;
  const wa = store?.phone ? whatsappNumber(store.phone) : null;
  const badge = partPaid
    ? ""
    : payment === "cod"
      ? t.thankYou.payOnDelivery
      : payment === "paid"
        ? own.paidBadge
        : payment === "transfer"
          ? own.transferBadge
          : payment === "awaiting"
            ? own.awaitingBadge
            : "";
  const onAccount = isOnAccountSnapshot(snapshot);

  return (
    <section>
      <ConfirmationHeading orderNumber={orderNumber} phone={snapshot?.phone} payment={payment ?? "received"} pending={!ready || payment === null} />

      {payment === "awaiting" && payHref && (
        <div className="mt-2 flex justify-center">
          <StoreLink href={payHref} className={btnSecondary}>
            {t.payment.resume}
          </StoreLink>
        </div>
      )}

      {!ready ? (
        // The total's row, the one line every saved order has.
        <div aria-hidden className={`${skeleton} mt-4 h-[3.125rem] w-full`} />
      ) : snapshot ? (
        <dl className={`${card} mt-4 divide-y divide-line text-sm`}>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-ink-soft">{t.thankYou.total}</dt>
            <dd className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-base font-bold text-ink">{money(snapshot.totalAmount, currency)}</span>
              {(onAccount || badge) && (
                <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
                  <ThankYouPaymentLabel snapshot={snapshot} fallback={badge} />
                </span>
              )}
            </dd>
          </div>
          {address && (
            <div className="flex items-start gap-3 px-4 py-3 text-start">
              <MapPinIcon size={20} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              <div className="min-w-0">
                <dt className="sr-only">{own.address}</dt>
                <dd>
                  {address[0] && (
                    <span className="block truncate font-medium text-ink" dir="auto">
                      {address[0]}
                    </span>
                  )}
                  {address[1] && <span className="block truncate text-ink-soft">{address[1]}</span>}
                </dd>
              </div>
            </div>
          )}
          {deliveryText && !stopped && (
            <div className="flex items-start gap-3 px-4 py-3 text-start">
              <TruckIcon size={20} className="mt-0.5 shrink-0 text-primary" />
              <div className="min-w-0">
                <dt className="text-ink-soft">{t.buyInfo.deliveryExpected}</dt>
                <dd className="font-semibold text-ink">{deliveryText}</dd>
              </div>
            </div>
          )}
        </dl>
      ) : store?.phone ? (
        <div className={`${card} mt-4 p-4 text-start`}>
          <p className="text-sm font-semibold text-ink">{own.contactTitle}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {wa && (
              <a
                href={`https://wa.me/${wa}?text=${encodeURIComponent(t.thankYou.whatsappMessage(store.name, orderNumber ?? ""))}`}
                target="_blank"
                rel="noopener noreferrer"
                className={btnSecondary}
              >
                <WhatsAppIcon size={20} />
                {t.thankYou.whatsapp}
              </a>
            )}
            <a href={`tel:${store.phone.replace(/[^+0-9]/g, "")}`} className={btnSecondary}>
              <PhoneIcon size={20} />
              {own.call}
              <bdi dir="ltr">{store.phone}</bdi>
            </a>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {stopped ? (
          <StoreLink href="/" className={btnPrimaryLg}>
            {t.payment.backToStore}
          </StoreLink>
        ) : (
          <>
            <StoreLink href={trackHref} className={btnPrimaryLg}>
              {copy.track}
            </StoreLink>
            {showKeepShopping && (
              <StoreLink href="/" className={`${btnGhost} w-full`}>
                {copy.keepShopping}
              </StoreLink>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * The thank-you page before it is there (orders/[orderId]/loading.tsx, and
 * the page's own Suspense fallback): the first screen's outline — the mark,
 * the title, the number, two lines, the total's row and the two buttons —
 * each where the page then puts it, in the page's own frame.
 */
export function OrderConfirmationSkeleton() {
  const { t } = useStore();
  return (
    <main className={`${container} flex-1 py-6 sm:py-14`}>
      <div className="mx-auto max-w-2xl" role="status" aria-busy="true" aria-label={t.common.loading}>
        <div className="flex flex-col items-center">
          {/* Not the `skeleton` recipe: its own corners would win over a circle's. */}
          <span className="block h-14 w-14 animate-pulse rounded-full bg-line/60 motion-reduce:animate-none" />
          <span className={`${skeleton} mt-3 block h-8 w-44 max-w-full sm:h-9`} />
          <span className={`${skeleton} mt-3 block h-4 w-20`} />
          <span className={`${skeleton} mt-1 block h-11 w-64 max-w-full`} />
          <span className="mt-3 flex min-h-12 w-64 max-w-full flex-col items-center gap-2 pt-1">
            <span className={`${skeleton} block h-3.5 w-full`} />
            <span className={`${skeleton} block h-3.5 w-2/3`} />
          </span>
        </div>
        <span className={`${skeleton} mt-4 block h-[3.125rem] w-full`} />
        <span className={`${skeleton} mt-4 block h-12 w-full`} />
        <span className={`${skeleton} mx-auto mt-2 block h-11 w-32`} />
      </div>
    </main>
  );
}

/** The order's lines and totals as this device saved them at checkout. */
export function OrderSnapshotSummary({
  snapshot,
  currency,
  headingLevel: Heading = "h2",
  footnote,
}: {
  snapshot: OrderSnapshot;
  currency: string | undefined;
  headingLevel?: "h2" | "h3";
  footnote?: ReactNode;
}) {
  const { t, money } = useStore();
  const titleId = `summary-title-${snapshot.id}`;

  return (
    <section className={`${card} p-5 sm:p-6`} aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-3">
        <Heading id={titleId} className="text-lg font-semibold text-ink">
          {t.thankYou.summary}
        </Heading>
        <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
          <ThankYouPaymentLabel snapshot={snapshot} fallback={t.thankYou.payOnDelivery} />
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
      <OnAccountPlacedNote snapshot={snapshot} />
      {footnote && <p className="mt-3 text-xs text-ink-soft">{footnote}</p>}
    </section>
  );
}

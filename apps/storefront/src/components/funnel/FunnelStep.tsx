"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
  funnelsAdvance,
  funnelsGetSessionStep,
  funnelsRuntimeErrorKind,
  parseMoney,
  type FunnelOutcomeType,
  type FunnelPublicOfferDto,
  type FunnelStepTypeDto,
  type StorefrontProduct,
} from "@store-builder/api-client";
import { OrderFormFields, fieldId } from "@/components/checkout/OrderFormFields";
import { BoxIcon, CashIcon, CheckIcon } from "@/components/Icons";
import { OrderTicket } from "@/components/immersive/OrderTicket";
import { StatusTimeline } from "@/components/StatusTimeline";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnMetalLg, btnSecondary, card, container, input, label as labelClass } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { getOrderSnapshot, saveOrderSnapshot, snapshotFromOrder } from "@/lib/commerce";
import {
  rememberFollowOn,
  rememberPlacedOrder,
  useFollowOnOrders,
  useHydrated,
  usePlacedOrder,
} from "@/lib/funnelSession";
import {
  EMPTY_ORDER_FORM,
  FIELD_ORDER,
  toCheckoutPayload,
  validateOrderForm,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormValues,
} from "@/lib/orderForm";
import { orderErrorMessage, placeCodOrder } from "@/lib/placeOrder";
import { defaultOfferOf, firstImage, offerAppliesTo, variantLabel } from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { storeHref } from "@/lib/storeHref";
import { track, trackPurchaseOnce } from "@/lib/track";

/**
 * The step chrome of a running funnel: what the shopper *does* on a step,
 * drawn under the page the merchant built for it (rendered by the server page
 * with PageRenderer).
 *
 * The backend routes a funnel on step-level outcomes, not on page elements —
 * POST …/advance with `clicked_through`, `completed_checkout`, `accepted_offer`
 * or `declined_offer` — so each step type gets its own island here:
 *
 *   landing / sales / opt_in / custom → one "Continue" (clicked_through)
 *   checkout                          → the COD order form, then completed_checkout
 *   upsell / downsell                 → "Yes, add it" / "No thanks"
 *   thank_you                         → the confirmation, no advance
 *
 * After an advance the page is refreshed in place: the URL is the session's,
 * and the server reads its new current step.
 */

// --- advancing ---------------------------------------------------------------

function useAdvance(workspaceId: string, funnelId: string, sessionId: string, stepKey: string) {
  const router = useRouter();
  const basePath = useStoreBasePath();
  const { t } = useStore();
  const [pending, setPending] = useState<FunnelOutcomeType | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A ref as well as state: two taps in one frame must not both get through.
  const busy = useRef(false);
  // Set when an advance failed without an answer (network): it may still
  // have landed. The API applies an outcome to whatever step the session is on
  // *now*, so a blind retry could answer the next step — an accepted upsell
  // becoming the downsell's too. Check where the session is first.
  const uncertain = useRef(false);

  async function advance(type: FunnelOutcomeType, orderId?: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(type);
    setError(null);
    const client = createStorefrontApiClient();
    try {
      if (uncertain.current) {
        const now = await funnelsGetSessionStep(client, workspaceId, funnelId, sessionId);
        if (now.done || now.session.currentStepKey !== stepKey) {
          router.refresh();
          return;
        }
        uncertain.current = false;
      }
      const res = await funnelsAdvance(client, workspaceId, funnelId, sessionId, {
        type,
        ...(orderId ? { orderId } : {}),
      });
      if (res.followOnOrder) {
        rememberFollowOn(sessionId, res.followOnOrder);
        trackPurchaseOnce(res.followOnOrder.id, { valueMinor: parseMoney(res.followOnOrder.totalAmount), numItems: 1 });
      }
      // Stays pending: the refreshed step remounts this island.
      router.refresh();
    } catch (err) {
      const kind = funnelsRuntimeErrorKind(err);
      if (!(err instanceof ApiError)) uncertain.current = true;
      busy.current = false;
      setPending(null);
      if (kind === "sessionGone") {
        router.replace(storeHref(basePath, `/f/${funnelId}`));
      } else if (kind === "paused" || kind === "unavailable") {
        router.refresh();
      } else if (kind === "offerNeedsOrder") {
        setError(t.funnel.offerNeedsOrder);
      } else {
        setError(orderErrorMessage(err, t.funnel.advanceFailed));
      }
    }
  }

  return { advance, pending, error };
}

type Flow = ReturnType<typeof useAdvance>;

function ErrorBox({ message }: { message: string | null }) {
  return (
    <div role="alert" aria-live="assertive" className="empty:hidden">
      {message && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{message}</p>}
    </div>
  );
}

/** Fires once per mounted step (Strict Mode's double effect included). */
function useTrackOnce(fire: () => void) {
  const done = useRef(false);
  const latest = useRef(fire);
  useEffect(() => {
    latest.current = fire;
  });
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    latest.current();
  }, []);
}

// --- the island ----------------------------------------------------------------

export function FunnelStepActions({
  workspaceId,
  funnelId,
  sessionId,
  step,
  offer,
  product,
  sessionOrderId,
}: {
  workspaceId: string;
  funnelId: string;
  sessionId: string;
  step: { key: string; name: string; stepType: FunnelStepTypeDto };
  offer: FunnelPublicOfferDto | null;
  product: StorefrontProduct | null;
  sessionOrderId: string | null;
}) {
  const flow = useAdvance(workspaceId, funnelId, sessionId, step.key);
  const { t, store } = useStore();

  useTrackOnce(() => {
    if (step.stepType === "checkout" || step.stepType === "thank_you") return;
    if (offer) {
      track("ViewContent", {
        contentName: offer.name,
        contentIds: [offer.id],
        valueMinor: offer.priceAmount === null ? undefined : parseMoney(offer.priceAmount),
        currency: offer.currency,
      });
    } else {
      track("ViewContent", { contentName: step.name, currency: store?.currency });
    }
  });

  if (step.stepType === "checkout") {
    return (
      <FunnelCheckout workspaceId={workspaceId} funnelId={funnelId} sessionId={sessionId} product={product} flow={flow} />
    );
  }
  if (step.stepType === "upsell" || step.stepType === "downsell") {
    return <FunnelOfferCard offer={offer} canAccept={!!sessionOrderId} flow={flow} />;
  }
  if (step.stepType === "thank_you") {
    return <FunnelOrders workspaceId={workspaceId} sessionId={sessionId} orderId={sessionOrderId} />;
  }

  // landing / sales / opt_in / custom. There is no public opt-in capture
  // endpoint, so opt_in moves on the same way.
  return (
    <section className={`${container} flex flex-col items-center gap-3 pb-16 pt-6`}>
      <div className="w-full max-w-md space-y-3">
        <ErrorBox message={flow.error} />
        <button
          type="button"
          onClick={() => void flow.advance("clicked_through")}
          disabled={!!flow.pending}
          aria-busy={!!flow.pending}
          className={btnMetalLg}
        >
          {flow.pending ? t.common.loading : t.funnel.continue}
        </button>
      </div>
    </section>
  );
}

// --- checkout ------------------------------------------------------------------

const FORM_PREFIX = "funnel";

/**
 * The same COD form as the store's checkout and product quick-order
 * (OrderFormFields + lib/orderForm), placing a Buy-Now order for the product
 * the merchant put on this step through the storefront checkout — tagged with
 * the funnel — then reporting it to the funnel with `completed_checkout`.
 *
 * The order is remembered per session the moment it exists, so a failed
 * advance or a reload only ever retries the advance, never the order.
 */
function FunnelCheckout({
  workspaceId,
  funnelId,
  sessionId,
  product,
  flow,
}: {
  workspaceId: string;
  funnelId: string;
  sessionId: string;
  product: StorefrontProduct | null;
  flow: Flow;
}) {
  const { t, money, store } = useStore();
  const placed = usePlacedOrder(sessionId);
  const [values, setValues] = useState<OrderFormValues>(EMPTY_ORDER_FORM);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const variants = product?.variants ?? [];
  const [variantId, setVariantId] = useState(() => (variants.find((v) => v.inStock) ?? variants[0])?.id ?? "");
  const variant = variants.find((v) => v.id === variantId);
  const offer = product ? defaultOfferOf(product) : undefined;
  const offerId = offer && variant && offerAppliesTo(offer, variant.id) ? offer.id : undefined;
  // What the order engine charges for this line: the offer's price when the
  // line carries the offer, the variant's own price otherwise.
  const unit = offerId && offer ? parseMoney(offer.priceAmount) : variant ? parseMoney(variant.priceAmount) : 0;
  const currency = (offerId ? offer?.currency : variant?.currency) ?? store?.currency;

  useTrackOnce(() => {
    if (!product) return;
    track("InitiateCheckout", { contentIds: [product.id], contentName: product.name, valueMinor: unit, currency, numItems: 1 });
  });

  function onFieldChange(field: OrderFormField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submittingRef.current || flow.pending) return;

    if (placed) {
      await flow.advance("completed_checkout", placed.id);
      return;
    }

    const found = validateOrderForm(values, t);
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    if (invalid.length > 0) {
      setFormError(t.form.errors.summary(invalid.length));
      document.getElementById(fieldId(FORM_PREFIX, invalid[0]))?.focus();
      return;
    }
    if (!product || !variant || !variant.inStock) {
      setFormError(t.form.errors.unavailable);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        ...toCheckoutPayload(values, { item: { variantId: variant.id, offerId, quantity: 1 } }),
        funnelId,
      };
      const order = await placeCodOrder({ client: createStorefrontApiClient(), workspaceId, payload });
      // For the thank-you step, the store's own order page and /track.
      saveOrderSnapshot(workspaceId, snapshotFromOrder(order, payload.contact.phone));
      rememberPlacedOrder(sessionId, { id: order.id, orderNumber: order.orderNumber });
      trackPurchaseOnce(order.id, {
        valueMinor: parseMoney(order.totalAmount),
        currency: order.currency,
        contentIds: [product.id],
        contentName: product.name,
        numItems: 1,
      });
      submittingRef.current = false;
      setSubmitting(false);
      await flow.advance("completed_checkout", order.id);
    } catch (err) {
      submittingRef.current = false;
      setFormError(orderErrorMessage(err, t.form.errors.generic));
      setSubmitting(false);
    }
  }

  if (!product) {
    return (
      <section className={`${container} pb-16 pt-6`}>
        <p className="mx-auto max-w-xl rounded-2xl border border-dashed border-line-strong bg-paper-raised px-6 py-10 text-center text-sm text-ink-soft">
          {t.funnel.noProduct}
        </p>
      </section>
    );
  }

  const image = firstImage(product);
  const busy = submitting || !!flow.pending;

  return (
    <section className={`${container} pb-16 pt-6`} aria-labelledby="funnel-checkout-title">
      <form id="order-form" onSubmit={handleSubmit} noValidate className={`${card} mx-auto max-w-2xl p-5 sm:p-8`}>
        <h2 id="funnel-checkout-title" className="font-display text-xl font-bold text-ink sm:text-2xl">
          {t.funnel.checkoutTitle}
        </h2>

        <div className="mt-5 flex items-center gap-4 rounded-xl border border-line p-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-paper">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" width={64} height={64} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-primary/40">
                <BoxIcon size={28} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-semibold text-ink">{product.name}</p>
            {variant && <p className="text-sm font-bold text-ink">{money(unit, currency)}</p>}
          </div>
        </div>

        {variants.length > 1 && (
          <div className="mt-4">
            <label htmlFor={`${FORM_PREFIX}-variant`} className={labelClass}>
              {t.funnel.chooseVariant}
            </label>
            <select
              id={`${FORM_PREFIX}-variant`}
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              disabled={!!placed || busy}
              className={`${input} cursor-pointer`}
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id} disabled={!v.inStock}>
                  {variantLabel(v) || v.sku}
                  {!v.inStock ? ` — ${t.common.outOfStock}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <fieldset className="mt-6" disabled={!!placed || busy}>
          <legend className="sr-only">{t.checkout.shipping}</legend>
          <OrderFormFields
            idPrefix={FORM_PREFIX}
            values={values}
            errors={errors}
            onChange={onFieldChange}
            showAltPhone
            showEmail
          />
        </fieldset>

        <p className="mt-5 flex items-center gap-2 rounded-xl bg-primary-soft px-4 py-3 text-sm text-ink">
          <CashIcon className="shrink-0 text-primary" />
          {t.checkout.codHint}
        </p>
        <p className="mt-2 text-xs text-ink-soft">{t.checkout.finalNote}</p>

        <div className="mt-5 space-y-3">
          {placed && (
            <p role="status" className="rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">
              {t.funnel.placedNote(placed.orderNumber)}
            </p>
          )}
          <ErrorBox message={formError ?? flow.error} />
          <button type="submit" disabled={busy} aria-busy={busy} className={btnMetalLg}>
            {busy ? t.checkout.placing : placed ? t.funnel.continue : t.checkout.place}
          </button>
        </div>
      </form>
    </section>
  );
}

// --- upsell / downsell -----------------------------------------------------------

/**
 * The offer attached to this step, as the backend sent it. Accepting creates a
 * second order linked to the checkout order (server-side pricing and stock);
 * either answer follows its own edge. Without a checkout order there is
 * nothing to link to, so only "No thanks" is offered.
 */
function FunnelOfferCard({
  offer,
  canAccept,
  flow,
}: {
  offer: FunnelPublicOfferDto | null;
  canAccept: boolean;
  flow: Flow;
}) {
  const { t, money } = useStore();
  const price = offer && offer.priceAmount !== null ? parseMoney(offer.priceAmount) : null;

  return (
    <section className={`${container} pb-16 pt-6`} aria-labelledby="funnel-offer-title">
      <div className={`${card} mx-auto max-w-xl overflow-hidden`}>
        <div className="bg-primary px-5 py-3 text-center text-sm font-semibold text-on-primary">
          {offer?.badge || t.funnel.offerBadge}
        </div>
        <div className="p-5 text-center sm:p-8">
          {offer ? (
            <>
              <h2 id="funnel-offer-title" className="font-display text-2xl font-bold text-ink">
                {offer.name}
              </h2>
              {price !== null && <p className="mt-3 text-3xl font-bold text-ink">{money(price, offer.currency)}</p>}
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{t.funnel.offerHint}</p>
            </>
          ) : (
            <h2 id="funnel-offer-title" className="text-base font-medium text-ink-soft">
              {t.funnel.offerGone}
            </h2>
          )}

          <div className="mt-6 space-y-2">
            {offer && !canAccept && (
              <p role="status" className="rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft">
                {t.funnel.offerNeedsOrder}
              </p>
            )}
            <ErrorBox message={flow.error} />
            {offer && canAccept && (
              <button
                type="button"
                onClick={() => void flow.advance("accepted_offer")}
                disabled={!!flow.pending}
                aria-busy={flow.pending === "accepted_offer"}
                className={btnMetalLg}
              >
                {flow.pending === "accepted_offer" ? t.funnel.accepting : t.funnel.accept}
              </button>
            )}
            <button
              type="button"
              onClick={() => void flow.advance("declined_offer")}
              disabled={!!flow.pending}
              aria-busy={flow.pending === "declined_offer"}
              className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              {flow.pending === "declined_offer" ? t.common.loading : t.funnel.decline}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- thank you -------------------------------------------------------------------

/**
 * The confirmation for a thank-you step, or for a session whose funnel has
 * ended: the checkout order as the store's thank-you page shows it (the order
 * ticket and "what happens next"), plus any offer orders accepted on the way.
 * Order numbers and totals come from this device (the order snapshot saved at
 * checkout, the follow-on orders remembered at accept), read after hydration.
 */
export function FunnelOrders({
  workspaceId,
  sessionId,
  orderId,
}: {
  workspaceId: string;
  sessionId: string;
  orderId: string | null;
}) {
  const { t, money, store } = useStore();
  const basePath = useStoreBasePath();
  const hydrated = useHydrated();
  const placed = usePlacedOrder(sessionId);
  const followOns = useFollowOnOrders(sessionId);

  const snapshot = hydrated && orderId ? getOrderSnapshot(workspaceId, orderId) : null;
  const orderNumber = snapshot?.orderNumber ?? (placed && placed.id === orderId ? placed.orderNumber : null);
  const currency = snapshot?.currency ?? store?.currency;
  const orderHref = (id: string, number: string | null) =>
    storeHref(basePath, `/orders/${id}${number ? `?${new URLSearchParams({ number }).toString()}` : ""}`);

  if (!orderId) {
    return (
      <section className={`${container} pb-16 pt-6`}>
        <div className="mx-auto max-w-md text-center">
          <h2 className="font-display text-2xl font-bold text-ink">{t.funnel.doneTitle}</h2>
          <p className="mt-2 text-sm text-ink-soft">{t.funnel.doneBody}</p>
          <StoreLink href="/" className={`${btnSecondary} mt-6`}>
            {t.thankYou.backToStore}
          </StoreLink>
        </div>
      </section>
    );
  }

  return (
    <section className={`${container} pb-16 pt-6`} aria-labelledby="funnel-thanks-title">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckIcon size={32} />
          </span>
          <h2 id="funnel-thanks-title" className="mt-5 font-display text-2xl font-bold text-ink sm:text-3xl">
            {t.thankYou.title}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">{t.thankYou.callNotice}</p>
        </div>

        {orderNumber && (
          <div className="mt-8">
            <OrderTicket
              orderNumber={orderNumber}
              total={snapshot?.totalAmount}
              currency={currency}
              storeName={store?.name ?? ""}
              note={t.thankYou.payOnDelivery}
            />
          </div>
        )}

        <section className={`${card} mt-6 p-5 sm:p-6`} aria-labelledby="funnel-orders-title">
          <h3 id="funnel-orders-title" className="text-lg font-semibold text-ink">
            {t.funnel.yourOrders}
          </h3>
          <ul className="mt-3 divide-y divide-line">
            <OrderRow
              label={t.thankYou.orderNumber}
              number={orderNumber}
              total={snapshot ? money(snapshot.totalAmount, currency) : null}
              href={orderHref(orderId, orderNumber)}
              linkLabel={t.funnel.viewOrder}
            />
            {followOns.map((o) => (
              <OrderRow
                key={o.id}
                label={t.funnel.extraOrder}
                number={o.orderNumber}
                total={money(parseMoney(o.totalAmount), currency)}
                href={orderHref(o.id, o.orderNumber)}
                linkLabel={t.funnel.viewOrder}
              />
            ))}
          </ul>
        </section>

        <section className={`${card} mt-6 p-5 sm:p-6`} aria-labelledby="funnel-next-title">
          <h3 id="funnel-next-title" className="mb-5 text-lg font-semibold text-ink">
            {t.thankYou.steps}
          </h3>
          <StatusTimeline stage={1} />
        </section>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <StoreLink href="/track" className={btnSecondary}>
            {t.thankYou.track}
          </StoreLink>
          <StoreLink href="/" className={btnSecondary}>
            {t.thankYou.backToStore}
          </StoreLink>
        </div>
      </div>
    </section>
  );
}

function OrderRow({
  label,
  number,
  total,
  href,
  linkLabel,
}: {
  label: string;
  number: string | null;
  total: string | null;
  href: string;
  linkLabel: string;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <span className="min-w-0">
        <span className="block text-ink-soft">{label}</span>
        {number && (
          <span dir="ltr" className="font-semibold text-ink">
            #{number}
          </span>
        )}
      </span>
      <span className="flex items-center gap-3">
        {total && <span className="font-semibold text-ink">{total}</span>}
        <Link href={href} className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
          {linkLabel}
        </Link>
      </span>
    </li>
  );
}

/** A session whose funnel has ended (no outbound edge matched). */
export function FunnelDone({
  workspaceId,
  sessionId,
  orderId,
}: {
  workspaceId: string;
  sessionId: string;
  orderId: string | null;
}) {
  return (
    <main className="flex-1 pt-6">
      <FunnelOrders workspaceId={workspaceId} sessionId={sessionId} orderId={orderId} />
    </main>
  );
}

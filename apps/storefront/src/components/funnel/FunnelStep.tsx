"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, type StorefrontProductDetail } from "@store-builder/api-client";
import { OrderFormFields, fieldId } from "@/components/checkout/OrderFormFields";
import { BoxIcon, CashIcon, CheckIcon } from "@/components/Icons";
import { btnPrimary, btnPrimaryLg, btnSecondary, card, container, input, label as labelClass } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useCart } from "@/lib/CartProvider";
import { getDictionary } from "@/lib/i18n";
import { getOrderRef, rememberOrder } from "@/lib/orders";
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
import {
  advanceFunnel,
  classifyFunnelError,
  type FollowOnOrder,
  type FunnelOffer,
  type FunnelOutcome,
  type FunnelStepType,
} from "@/lib/publicApi";
import { useStore } from "@/lib/StoreContext";

// --- follow-on orders (accepted upsells), remembered per session ------------

const followOnKey = (sessionId: string) => `zimos_funnel_orders_${sessionId}`;

function readFollowOns(sessionId: string): FollowOnOrder[] {
  try {
    const raw = window.localStorage.getItem(followOnKey(sessionId));
    const list = raw ? (JSON.parse(raw) as FollowOnOrder[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function rememberFollowOn(sessionId: string, order: FollowOnOrder) {
  try {
    const list = readFollowOns(sessionId).filter((o) => o.id !== order.id);
    window.localStorage.setItem(followOnKey(sessionId), JSON.stringify([...list, order]));
  } catch {
    /* storage disabled — the order still exists server-side */
  }
}

// --- shared advance hook ------------------------------------------------------

function useAdvance(workspaceId: string, funnelId: string, sessionId: string) {
  const router = useRouter();
  const { t } = useStore();
  const [pending, setPending] = useState<FunnelOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function advance(type: FunnelOutcome, orderId?: string): Promise<boolean> {
    if (pending) return false;
    setPending(type);
    setError(null);
    try {
      const res = await advanceFunnel(createStorefrontApiClient(), workspaceId, funnelId, sessionId, {
        type,
        ...(orderId ? { orderId } : {}),
      });
      if (res.followOnOrder) rememberFollowOn(sessionId, res.followOnOrder);
      // Same URL, new server state: the page re-reads the session's current step.
      router.refresh();
      return true;
    } catch (err) {
      const kind = classifyFunnelError(err);
      if (kind === "sessionGone") {
        router.replace(`/store/${workspaceId}/f/${funnelId}`);
      } else if (kind === "paused" || kind === "notFound") {
        router.refresh();
      } else if (type === "accepted_offer" && err instanceof ApiError && err.status === 422) {
        setError(t.funnel.offerNeedsOrder);
      } else {
        setError(orderErrorMessage(err, t.funnel.advanceFailed));
      }
      setPending(null);
      return false;
    }
  }

  return { advance, pending, error };
}

function ErrorBox({ message }: { message: string | null }) {
  return (
    <div role="alert" aria-live="assertive" className="empty:hidden">
      {message && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{message}</p>}
    </div>
  );
}

// --- step-type islands --------------------------------------------------------

export function FunnelStepActions({
  workspaceId,
  funnelId,
  sessionId,
  stepType,
  offer,
  product,
  sessionOrderId,
}: {
  workspaceId: string;
  funnelId: string;
  sessionId: string;
  stepType: FunnelStepType;
  offer: FunnelOffer | null;
  product: StorefrontProductDetail | null;
  sessionOrderId: string | null;
}) {
  const flow = useAdvance(workspaceId, funnelId, sessionId);
  const { t } = useStore();

  if (stepType === "checkout") {
    return <FunnelCheckout workspaceId={workspaceId} funnelId={funnelId} product={product} flow={flow} />;
  }
  if (stepType === "upsell" || stepType === "downsell") {
    return <FunnelOfferCard offer={offer} flow={flow} />;
  }
  if (stepType === "thank_you") {
    return (
      <section className={`${container} pb-16`}>
        <FunnelOrders workspaceId={workspaceId} sessionId={sessionId} orderId={sessionOrderId} />
      </section>
    );
  }

  // landing / sales / opt_in / custom — a single CTA that routes the "always"
  // or "clicked_through" edge. (The backend has no opt-in capture endpoint, so
  // opt_in advances the same way.)
  return (
    <section className={`${container} flex flex-col items-center gap-3 pb-16 pt-4`}>
      <ErrorBox message={flow.error} />
      <button
        type="button"
        onClick={() => void flow.advance("clicked_through")}
        disabled={!!flow.pending}
        aria-busy={!!flow.pending}
        className={`${btnPrimaryLg} max-w-md`}
      >
        {flow.pending ? t.common.loading : t.funnel.continue}
      </button>
    </section>
  );
}

type Flow = ReturnType<typeof useAdvance>;

const FORM_PREFIX = "funnel";

function FunnelCheckout({
  workspaceId,
  funnelId,
  product,
  flow,
}: {
  workspaceId: string;
  funnelId: string;
  product: StorefrontProductDetail | null;
  flow: Flow;
}) {
  const { t, money, store } = useStore();
  const { cart, clearCart } = useCart();
  const [values, setValues] = useState<OrderFormValues>(EMPTY_ORDER_FORM);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Once the order exists, never place it again — only retry the advance.
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  const variants = product?.variants ?? [];
  const [variantId, setVariantId] = useState(() => (variants.find((v) => v.inStock) ?? variants[0])?.id ?? "");
  const variant = variants.find((v) => v.id === variantId);
  const offer = product ? defaultOfferOf(product) : undefined;
  const offerId = offer && variant && offerAppliesTo(offer, variant.id) ? offer.id : undefined;
  const cartItems = cart?.items ?? [];
  const useCartLines = !product && cartItems.length > 0;

  function onFieldChange(field: OrderFormField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || flow.pending) return;

    if (placedOrderId) {
      await flow.advance("completed_checkout", placedOrderId);
      return;
    }

    const found = validateOrderForm(values, t, store?.checkout);
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    if (invalid.length > 0) {
      setFormError(t.form.errors.summary(invalid.length));
      document.getElementById(fieldId(FORM_PREFIX, invalid[0]))?.focus();
      return;
    }
    if (!useCartLines && (!variant || !variant.inStock)) {
      setFormError(t.form.errors.unavailable);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        ...toCheckoutPayload(values, {
          config: store?.checkout,
          item: useCartLines || !variant ? undefined : { variantId: variant.id, offerId, quantity: 1 },
        }),
        funnelId,
      };
      const order = await placeCodOrder({
        client: createStorefrontApiClient(),
        workspaceId,
        payload,
        cartToken: useCartLines ? cart?.guestToken : undefined,
      });
      rememberOrder(workspaceId, order, payload.contact.phone);
      if (useCartLines) clearCart();
      setPlacedOrderId(order.id);
      setSubmitting(false);
      await flow.advance("completed_checkout", order.id);
    } catch (err) {
      setFormError(orderErrorMessage(err, t.form.errors.generic));
      setSubmitting(false);
    }
  }

  if (!product && !useCartLines) {
    return (
      <section className={`${container} pb-16`}>
        <p className="mx-auto max-w-xl rounded-2xl border border-dashed border-line-strong bg-paper-raised px-6 py-10 text-center text-sm text-ink-soft">
          {t.funnel.noProduct}
        </p>
      </section>
    );
  }

  const image = product ? firstImage(product) : null;
  const busy = submitting || !!flow.pending;

  return (
    <section className={`${container} pb-16`} aria-labelledby="funnel-checkout-title">
      <form onSubmit={handleSubmit} noValidate className={`${card} mx-auto max-w-2xl p-5 sm:p-8`}>
        <h2 id="funnel-checkout-title" className="text-xl font-bold text-ink sm:text-2xl">
          {t.funnel.checkoutTitle}
        </h2>

        {product && (
          <div className="mt-5 flex items-center gap-4 rounded-xl border border-line p-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zimos-cloud dark:bg-primary-soft">
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
              {variant && <p className="text-sm font-bold text-ink">{money(variant.priceAmount, variant.currency)}</p>}
            </div>
          </div>
        )}

        {variants.length > 1 && (
          <div className="mt-4">
            <label htmlFor={`${FORM_PREFIX}-variant`} className={labelClass}>
              {t.funnel.chooseVariant}
            </label>
            <select
              id={`${FORM_PREFIX}-variant`}
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              disabled={!!placedOrderId}
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

        <fieldset className="mt-6" disabled={!!placedOrderId}>
          <legend className="sr-only">{t.checkout.shipping}</legend>
          <OrderFormFields idPrefix={FORM_PREFIX} values={values} errors={errors} onChange={onFieldChange} />
        </fieldset>

        <p className="mt-5 flex items-center gap-2 rounded-xl bg-primary-soft px-4 py-3 text-sm text-ink">
          <CashIcon className="shrink-0 text-primary" />
          {t.checkout.codHint}
        </p>

        <div className="mt-5 space-y-3">
          <ErrorBox message={formError ?? flow.error} />
          <button type="submit" disabled={busy} aria-busy={busy} className={btnPrimaryLg}>
            {busy ? t.checkout.placing : placedOrderId ? t.funnel.retry : t.checkout.place}
          </button>
        </div>
      </form>
    </section>
  );
}

function FunnelOfferCard({ offer, flow }: { offer: FunnelOffer | null; flow: Flow }) {
  const { t, money } = useStore();

  return (
    <section className={`${container} pb-16`} aria-labelledby="funnel-offer-title">
      <div className={`${card} mx-auto max-w-xl overflow-hidden`}>
        <div className="bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground">
          {offer?.badge || t.funnel.offerBadge}
        </div>
        <div className="p-5 text-center sm:p-8">
          <h2 id="funnel-offer-title" className="text-2xl font-bold text-ink">
            {offer?.name ?? t.funnel.offerTitle}
          </h2>
          {offer && (
            <p className="mt-3 text-3xl font-bold text-ink">{money(offer.priceAmount, offer.currency)}</p>
          )}
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{t.funnel.offerHint}</p>

          <div className="mt-6 space-y-2">
            <ErrorBox message={flow.error} />
            {offer && (
              <button
                type="button"
                onClick={() => void flow.advance("accepted_offer")}
                disabled={!!flow.pending}
                aria-busy={flow.pending === "accepted_offer"}
                className={btnPrimaryLg}
              >
                {flow.pending === "accepted_offer" ? t.funnel.accepting : t.funnel.accept}
              </button>
            )}
            <button
              type="button"
              onClick={() => void flow.advance("declined_offer")}
              disabled={!!flow.pending}
              className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t.funnel.decline}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

interface OrderRow {
  id: string;
  orderNumber: string | null;
  total: string | number | null;
  currency?: string;
  extra: boolean;
}

/** The order placed on the checkout step plus any accepted upsell orders. */
export function FunnelOrders({
  workspaceId,
  sessionId,
  orderId,
}: {
  workspaceId: string;
  sessionId: string;
  orderId: string | null;
}) {
  const { t, money } = useStore();
  const [rows, setRows] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    const list: OrderRow[] = [];
    if (orderId) {
      const ref = getOrderRef(workspaceId, orderId);
      list.push({ id: orderId, orderNumber: ref?.orderNumber ?? null, total: null, extra: false });
    }
    for (const o of readFollowOns(sessionId)) {
      list.push({ id: o.id, orderNumber: o.orderNumber, total: o.totalAmount, extra: true });
    }
    // Order numbers come from this device's storage after mount so SSR and
    // hydration agree; this one-time sync is intended.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(list);
  }, [workspaceId, sessionId, orderId]);

  return (
    <div className={`${card} mx-auto max-w-xl p-5 sm:p-8`}>
      <p className="flex items-center gap-2 text-lg font-bold text-ink" role="status">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckIcon size={20} />
        </span>
        {t.funnel.thankYouTitle}
      </p>
      <p className="mt-2 text-sm text-ink-soft">{t.thankYou.callNotice}</p>

      {rows && rows.length > 0 ? (
        <>
          <h2 className="mt-6 text-sm font-semibold text-ink">{t.funnel.yourOrders}</h2>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {rows.map((row) => {
              const q = row.orderNumber ? `?${new URLSearchParams({ number: row.orderNumber })}` : "";
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block text-ink-soft">{row.extra ? t.funnel.extraOrder : t.thankYou.orderNumber}</span>
                    {row.orderNumber && (
                      <span dir="ltr" className="font-semibold text-ink">
                        #{row.orderNumber}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    {row.total !== null && <span className="font-semibold text-ink">{money(row.total, row.currency)}</span>}
                    <Link href={`/store/${workspaceId}/orders/${row.id}${q}`} className="font-medium text-primary hover:underline">
                      {t.funnel.viewOrder}
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : rows ? (
        <p className="mt-4 text-sm text-ink-soft">{t.funnel.noOrders}</p>
      ) : null}

      <Link href={`/store/${workspaceId}`} className={`${btnSecondary} mt-6 w-full`}>
        {t.thankYou.backToStore}
      </Link>
    </div>
  );
}

/** The session has no further step (completed). */
export function FunnelDone({ workspaceId, sessionId, orderId }: { workspaceId: string; sessionId: string; orderId: string | null }) {
  const { t } = useStore();
  return (
    <main className={`${container} flex-1 py-12`}>
      {orderId ? (
        <FunnelOrders workspaceId={workspaceId} sessionId={sessionId} orderId={orderId} />
      ) : (
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-2xl font-bold text-ink">{t.funnel.doneTitle}</h1>
          <p className="mt-2 text-sm text-ink-soft">{t.funnel.doneBody}</p>
          <Link href={`/store/${workspaceId}`} className={`${btnPrimary} mt-6`}>
            {t.common.backToStore}
          </Link>
        </div>
      )}
    </main>
  );
}

/** Paused/unpublished-but-known funnel, or an API failure. Bilingual, like the store 404. */
export function FunnelUnavailable({ kind, onRetry }: { kind: "paused" | "error"; onRetry?: () => void }) {
  const { t, locale, store } = useStore();
  const router = useRouter();
  const otherLang = locale === "ar" ? "en" : "ar";
  const other = getDictionary(otherLang);
  const title = kind === "paused" ? t.funnel.pausedTitle : t.funnel.errorTitle;
  const body = kind === "paused" ? t.funnel.pausedBody : t.funnel.errorBody;
  const otherTitle = kind === "paused" ? other.funnel.pausedTitle : other.funnel.errorTitle;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-ink-soft">{body}</p>
      <p lang={otherLang} dir={otherLang === "ar" ? "rtl" : "ltr"} className="mt-4 max-w-md text-xs text-ink-muted">
        {otherTitle}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {kind === "error" && (
          <button type="button" onClick={() => (onRetry ? onRetry() : router.refresh())} className={btnPrimary}>
            {t.funnel.retry}
          </button>
        )}
        {store && (
          <Link href={`/store/${store.workspaceId}`} className={kind === "error" ? btnSecondary : btnPrimary}>
            {t.notFound.cta}
          </Link>
        )}
      </div>
    </main>
  );
}

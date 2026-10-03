"use client";

import { DiscountRows, MinimumOrderNotice, clearStoredCoupon, useStoredCoupon } from "@/components/offers/CouponBits";
import { takeRecoveryPrefill } from "@/lib/recoveryPrefill";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { CheckoutProgress, type CheckoutStep } from "@/components/checkout/CheckoutProgress";
import { OrderBumpCard } from "@/components/checkout/OrderBumpCard";
import { OrderFormFields, fieldId } from "@/components/checkout/OrderFormFields";
import { PaymentMethodPicker } from "@/components/checkout/PaymentMethodPicker";
import {
  TransferDetails,
  asTransferMethod,
  transferProblem,
  useDepositQuote,
  useTransferCopy,
  type TransferState,
} from "@/components/checkout/TransferDetails";
import type { CheckoutPayload, ManualTransferStoreMethod } from "@store-builder/api-client";
import { FreeShippingHint, ShippingFee } from "@/components/checkout/ShippingFee";
import { ArrowIcon } from "@/components/Icons";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimaryLg, btnSecondary, card, container, input } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useCart } from "@/lib/CartProvider";
import { orderBumpOf } from "@/lib/commerce";
import {
  EMPTY_ORDER_FORM,
  FIELD_ORDER,
  formOptionsOf,
  toCheckoutPayload,
  validateOrderForm,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormValues,
} from "@/lib/orderForm";
import { afterOrder, isOrderBumpRefused, orderErrorMessage, placeCodOrder, serverFieldErrors } from "@/lib/placeOrder";
import { placeOnlineOrder, usePaymentMethods } from "@/lib/payments";
import { variantLabel } from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { getVisitorId } from "@/lib/visitorId";
import { track } from "@/lib/track";
import { useCatalog } from "@/lib/useCatalog";
import { useCheckoutAutosave } from "@/lib/useCheckoutAutosave";
import { useShippingQuote } from "@/lib/useShippingQuote";
import { useShipTo } from "@/lib/shipTo";
import { useFreshCheckoutSettings, useOrderFormFields } from "@/lib/useOrderFormFields";
import { LineCustomizations } from "@/components/LineCustomizations";
import { PolicyLinks } from "@/components/PolicyLinks";
import { CodeSlot } from "@/components/CustomCode";

const FORM_PREFIX = "checkout";

/** Which fields make up each step of the progress indicator. */
const CONTACT_FIELDS: OrderFormField[] = ["fullName", "phone", "altPhone", "email"];
const ADDRESS_FIELDS: OrderFormField[] = FIELD_ORDER.filter((f) => !CONTACT_FIELDS.includes(f) && f !== "notes");

export default function CheckoutPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const basePath = useStoreBasePath();
  const { cart, clearCart } = useCart();
  const { t, money, store } = useStore();
  const [client] = useState(() => createStorefrontApiClient());
  const { fields, reveal } = useOrderFormFields(useFreshCheckoutSettings(client, workspaceId));
  const { byVariant } = useCatalog(workspaceId);

  const [values, setValues] = useState<OrderFormValues>(EMPTY_ORDER_FORM);
  // Arriving from a recovery link (/r/:token): what the shopper had typed comes back, once.
  useEffect(() => {
    const prefill = takeRecoveryPrefill(workspaceId);
    if (prefill) setValues((prev) => ({ ...prev, ...prefill }));
  }, [workspaceId]);
  // The governorate chosen in the cart opens the form (once, and only into an
  // empty field); choosing one here is remembered for the cart in turn.
  const [shipTo, setShipTo] = useShipTo(workspaceId);
  const [adoptedShipTo, setAdoptedShipTo] = useState(false);
  if (!adoptedShipTo && shipTo) {
    setAdoptedShipTo(true);
    // Settings → purchase form: "pre-select the shipping region" can be switched off.
    if (!values.governorate && formOptionsOf(store?.checkout).auto_select_region) {
      setValues((prev) => ({ ...prev, governorate: shipTo }));
    }
  }
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  // A coupon that came with the link (?coupon=CODE) is applied without typing it.
  const linkCoupon = useStoredCoupon(workspaceId);
  useEffect(() => {
    if (linkCoupon) setAppliedCode((current) => current || linkCoupon);
  }, [linkCoupon]);
  const [bumpOn, setBumpOn] = useState(false);
  // Refused by the server since this page loaded (sold out, withdrawn): hidden.
  const [bumpGone, setBumpGone] = useState(false);
  const payment = usePaymentMethods(client, workspaceId);
  const [methodId, setMethodId] = useState<string | null>(null);
  const method = payment.methods.find((m) => m.id === methodId) ?? payment.methods[0];
  const [redirecting, setRedirecting] = useState(false);
  // Manual transfer: the whole order, or the deposit a cash-on-delivery order needs.
  const transferCopy = useTransferCopy();
  const transferMethod = asTransferMethod(method);
  const deposit = useDepositQuote(client, workspaceId, values.phone, method?.method === "cod");
  const [transfer, setTransfer] = useState<{ method: ManualTransferStoreMethod; state: TransferState } | null>(null);
  const needsTransfer = Boolean(transferMethod || deposit);

  const currency = cart?.currency ?? "EGP";
  const items = useMemo(() => cart?.items ?? [], [cart]);
  const autosave = useCheckoutAutosave({ client, workspaceId, values, lines: items });

  // InitiateCheckout once per visit to this page, the first time the cart is
  // known to hold something (the cart loads after mount, so not on render 1).
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || !cart || cart.items.length === 0) return;
    checkoutTracked.current = true;
    track("InitiateCheckout", {
      contentIds: cart.items.map((line) => line.variantId),
      valueMinor: cart.subtotal,
      currency: cart.currency,
      numItems: cart.items.reduce((sum, line) => sum + line.quantity, 0),
    });
  }, [cart]);

  // The merchant's bump — not offered when that product is already in the cart.
  const bump = useMemo(() => {
    if (bumpGone) return null;
    const inCart = items.map((l) => byVariant.get(l.variantId)?.id).filter(Boolean) as string[];
    return orderBumpOf(store?.orderBump, inCart);
  }, [bumpGone, items, byVariant, store?.orderBump]);

  // A ticked bump is not a cart line: the server adds it to the order.
  const bumpInTotals = bumpOn && bump ? bump.priceAmount : 0;
  const subtotal = cart?.subtotal ?? 0;
  // The bump counts toward the parcel's weight as soon as it's ticked.
  const quoteLines = items.map((l) => ({ variantId: l.variantId, offerId: l.offerId, quantity: l.quantity }));
  if (bumpInTotals > 0 && bump) quoteLines.push({ variantId: bump.variantId, offerId: bump.offerId, quantity: 1 });
  const shipping = useShippingQuote({ client, workspaceId, governorate: values.governorate, lines: quoteLines });
  // With no code typed, the store's automatic discount comes off (the code's own amount is settled by the server).
  const automaticOff = appliedCode ? 0 : (shipping.extras.automaticDiscount?.amount ?? 0);
  const total = subtotal + bumpInTotals + shipping.amount - automaticOff;

  // --- progress ------------------------------------------------------------
  // Contact → Address → Confirm above the form, from the same validation the
  // submit runs (with this store's field settings): a step is done once none
  // of its fields has an error. Display only; the form is still one page.
  const liveErrors = validateOrderForm(values, t, fields, { showAltPhone: true });
  const formOptions = formOptionsOf(fields);
  const contactDone = CONTACT_FIELDS.every((f) => !liveErrors[f]);
  const addressDone = ADDRESS_FIELDS.every((f) => !liveErrors[f]);
  const progressDone: CheckoutStep[] = [
    ...(contactDone ? (["contact"] as const) : []),
    ...(addressDone ? (["address"] as const) : []),
  ];
  const progressCurrent: CheckoutStep = !contactDone ? "contact" : !addressDone ? "address" : "confirm";

  function onFieldChange(field: OrderFormField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (field === "governorate") setShipTo(value);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const found = validateOrderForm(values, t, fields, { showAltPhone: true });
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    if (invalid.length > 0) {
      setFormError(t.form.errors.summary(invalid.length));
      document.getElementById(fieldId(FORM_PREFIX, invalid[0]))?.focus();
      return;
    }
    if (!cart || items.length === 0) {
      setFormError(t.form.errors.emptyCart);
      return;
    }

    if (needsTransfer) {
      const problem = transfer ? transferProblem(transfer.method, transfer.state, transferCopy) : transferCopy.needReceipt;
      if (problem) {
        setFormError(problem);
        return;
      }
    }

    const systemNotes: string[] = [];

    setSubmitting(true);
    setFormError(null);
    const checkoutSessionId = await autosave.stop();
    try {
      const payload = {
        ...toCheckoutPayload(values, fields, { discountCode: appliedCode, systemNotes, showAltPhone: true }),
        ...(bumpOn && bump ? { orderBump: { offerId: bump.offerId } } : {}),
        ...(checkoutSessionId ? { checkoutSessionId } : {}),
      };
      if (method.method !== "cod" && !transferMethod) {
        const { next, external } = await placeOnlineOrder({
          client,
          workspaceId,
          basePath,
          payload,
          method,
          cartToken: cart.guestToken,
          visitorId: getVisitorId(workspaceId),
        });
        clearCart();
        if (external) {
          setRedirecting(true);
          window.location.assign(next);
        } else {
          router.push(next);
        }
        return;
      }
      const order = await placeCodOrder({
        client,
        workspaceId,
        // A transfer rides along: the whole order ("bank_transfer"), or a COD deposit.
        payload: (needsTransfer && transfer
          ? { ...payload, ...(transferMethod ? { paymentMethod: "bank_transfer" } : {}), transfer: transfer.state.details }
          : payload) as CheckoutPayload,
        cartToken: cart.guestToken,
        visitorId: getVisitorId(workspaceId),
      });
      clearCart();
      router.push(afterOrder({ workspaceId, basePath, order, phone: payload.contact.phone }));
    } catch (err) {
      if (isOrderBumpRefused(err)) {
        // The totals drop the add-on with it; the shopper confirms again.
        setBumpOn(false);
        setBumpGone(true);
      }
      const fromServer = serverFieldErrors(err, t.form.errors);
      const invalid = FIELD_ORDER.filter((k) => fromServer[k]);
      if (invalid.length > 0) {
        // Commit first: a field the server named may be one this form was
        // hiding, and it has to exist before it can take focus.
        flushSync(() => {
          reveal(fromServer);
          setErrors(fromServer);
          setFormError(t.form.errors.summary(invalid.length));
          setSubmitting(false);
        });
        document.getElementById(fieldId(FORM_PREFIX, invalid[0]))?.focus();
      } else {
        setFormError(orderErrorMessage(err, t.form.errors));
        setSubmitting(false);
      }
      autosave.resume();
    }
  }

  return (
    <main className={`${container} flex-1 py-8 sm:py-10`}>
      <StoreLink
        href="/cart"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-ink-soft hover:text-primary"
      >
        <ArrowIcon size={16} className="rotate-180 rtl:rotate-0" />
        {t.checkout.backToCart}
      </StoreLink>
      <h1 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">{t.checkout.title}</h1>

      <div className="mt-6 max-w-xl">
        <CheckoutProgress done={progressDone} current={progressCurrent} />
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <section className={`${card} p-5 sm:p-6`} aria-labelledby="shipping-title">
            <h2 id="shipping-title" className="text-lg font-semibold text-ink">
              {t.checkout.shipping}
            </h2>
            <CodeSlot name="above_form" />
            <div className="mt-4">
              <OrderFormFields
                idPrefix={FORM_PREFIX}
                values={values}
                errors={errors}
                onChange={onFieldChange}
                fields={fields}
                showAltPhone
              />
            </div>
            <CodeSlot name="below_form" />
          </section>

          <section className={`${card} p-5 sm:p-6`} aria-labelledby="payment-title">
            <h2 id="payment-title" className="text-lg font-semibold text-ink">
              {t.checkout.payment}
            </h2>
            <PaymentMethodPicker
              methods={payment.methods}
              value={method.id}
              onChange={setMethodId}
              idPrefix={FORM_PREFIX}
            />
            {(transferMethod || deposit) && (
              <TransferDetails
                key={transferMethod ? transferMethod.id : "deposit"}
                client={client}
                workspaceId={workspaceId}
                methods={transferMethod ? [transferMethod] : deposit!.methods}
                deposit={transferMethod ? undefined : (deposit!.amountType ?? "shipping")}
                amountLabel={
                  transferMethod
                    ? money(total, currency)
                    : deposit!.amountType === "fixed"
                      ? money(deposit!.fixedAmount ?? 0, currency)
                      : shipping.amount > 0
                        ? money(shipping.amount, currency)
                        : null
                }
                idPrefix={FORM_PREFIX}
                onChange={(m, state) => setTransfer({ method: m, state })}
              />
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className={`${card} p-5`} aria-labelledby="summary-title">
            <h2 id="summary-title" className="text-base font-semibold text-ink">
              {t.checkout.summary}
            </h2>
            {items.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">{t.cart.empty}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {items.map((line) => {
                  const product = byVariant.get(line.variantId);
                  const options = variantLabel(line.variant);
                  return (
                    <li key={line.id} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0 text-ink-soft">
                        <span className="line-clamp-2 text-ink">{product?.name ?? (options || t.cart.item)}</span>
                        {product && options && <span className="block text-xs">{options}</span>}
                        <LineCustomizations customizations={line.customizations} />
                        <span className="text-xs"> × {line.quantity}</span>
                      </span>
                      <span className="shrink-0 font-medium text-ink">{money(line.lineTotal, currency)}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Discount code — validated by the backend at checkout (no public preview endpoint). */}
            {formOptions.allow_discount_codes && (
            <div className="mt-5 border-t border-line pt-4">
              <label htmlFor="discount-code" className="mb-1.5 block text-sm font-medium text-ink">
                {t.checkout.discountCode}
              </label>
              {appliedCode ? (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-primary-soft px-3 py-2">
                  <p className="text-xs text-primary" aria-live="polite">
                    {t.checkout.discountPending(appliedCode)}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedCode("");
                      clearStoredCoupon(workspaceId);
                    }}
                    className="min-h-11 shrink-0 cursor-pointer px-2 text-xs font-medium text-ink-soft hover:text-danger"
                  >
                    {t.checkout.removeCode}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    id="discount-code"
                    type="text"
                    autoComplete="off"
                    dir="ltr"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    className={`${input} uppercase`}
                  />
                  <button
                    type="button"
                    onClick={() => codeInput.trim() && setAppliedCode(codeInput.trim())}
                    className={btnSecondary}
                  >
                    {t.checkout.apply}
                  </button>
                </div>
              )}
            </div>
            )}

            <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">{t.checkout.subtotal}</dt>
                <dd className="text-ink">{money(subtotal, currency)}</dd>
              </div>
              {bumpInTotals > 0 && bump && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-soft">{bump.name}</dt>
                  <dd className="text-ink">{money(bump.priceAmount, currency)}</dd>
                </div>
              )}
              {!appliedCode && <DiscountRows extras={shipping.extras} coupon={null} currency={currency} />}
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">{t.checkout.shippingFee}</dt>
                <dd className="text-ink">
                  <ShippingFee line={shipping.line} currency={currency} />
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-line pt-3 text-base font-bold text-ink">
                <dt>{t.checkout.totalEstimate}</dt>
                <dd>{money(total, currency)}</dd>
              </div>
            </dl>
            <MinimumOrderNotice extras={shipping.extras} currency={currency} className="mt-3" />
            <FreeShippingHint
              progress={shipping.freeShipping}
              line={shipping.line}
              currency={currency}
              className="mt-3"
            />
            <p className="mt-2 text-xs text-ink-soft">{t.checkout.finalNote}</p>
            <PolicyLinks className="mt-2" />
          </section>

          {bump && items.length > 0 && (
            <OrderBumpCard bump={bump} checked={bumpOn} onChange={setBumpOn} idPrefix={FORM_PREFIX} />
          )}

          <div role="alert" aria-live="assertive" className="empty:hidden">
            {formError && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</p>}
          </div>

          <button type="submit" disabled={submitting || items.length === 0} className={btnPrimaryLg}>
            {redirecting
              ? t.payment.redirecting
              : submitting
                ? t.checkout.placing
                : method.method === "cod"
                  ? t.checkout.place
                  : t.payment.payNow}
          </button>
        </aside>
      </form>
    </main>
  );
}

"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckoutProgress, type CheckoutStep } from "@/components/checkout/CheckoutProgress";
import { OrderBumpCard } from "@/components/checkout/OrderBumpCard";
import { OrderFormFields, fieldId } from "@/components/checkout/OrderFormFields";
import { PaymentMethodPicker, type PaymentChoice } from "@/components/checkout/PaymentMethodPicker";
import { ArrowIcon, ChevronIcon } from "@/components/Icons";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimaryLg, btnSecondary, card, container, focusRing, input, skeleton } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useCart } from "@/lib/CartProvider";
import { getOrderBump } from "@/lib/commerce";
import {
  ADDRESS_FIELDS,
  CONTACT_FIELDS,
  EMPTY_ORDER_FORM,
  FIELD_ORDER,
  toCheckoutPayload,
  validateField,
  validateOrderForm,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormValues,
} from "@/lib/orderForm";
import { afterOrder, onlinePaymentUrl, orderErrorMessage, placeCodOrder } from "@/lib/placeOrder";
import { variantLabel } from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { storeHref } from "@/lib/storeHref";
import { useCatalog } from "@/lib/useCatalog";
import { usePaymentOptions } from "@/lib/usePaymentOptions";
import { useShippingQuote } from "@/lib/useShippingQuote";

const FORM_PREFIX = "checkout";

/**
 * One form in three sections — contact, address, payment & confirm — with a
 * progress row that fills in as each section validates. Fields are checked as
 * the shopper leaves them, the shipping fee is quoted the moment a governorate
 * is chosen (the same calculation checkout runs), and on a phone the order
 * summary folds up above the form so the fields come first.
 *
 * Online payment (card / wallet) is offered only when the store has Paymob
 * connected; the order is placed the same way, then the shopper is sent to
 * Paymob's hosted page.
 */
export default function CheckoutPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const basePath = useStoreBasePath();
  const { cart, isLoading, addItem, clearCart } = useCart();
  const { t, money } = useStore();
  const [client] = useState(() => createStorefrontApiClient());
  const { products, byVariant, loaded } = useCatalog(workspaceId);
  const online = usePaymentOptions(workspaceId);

  const [values, setValues] = useState<OrderFormValues>(EMPTY_ORDER_FORM);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"idle" | "placing" | "paying">("idle");
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [bumpOn, setBumpOn] = useState(false);
  const [bumpAdded, setBumpAdded] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentChoice>("cod");
  const [summaryOpen, setSummaryOpen] = useState(false);

  const currency = cart?.currency ?? "EGP";
  const items = useMemo(() => cart?.items ?? [], [cart]);
  const quantity = items.reduce((sum, line) => sum + line.quantity, 0);

  const bump = useMemo(() => {
    if (!loaded) return null;
    const inCart = new Set(items.map((l) => byVariant.get(l.variantId)?.id).filter(Boolean) as string[]);
    return getOrderBump(products ?? [], [...inCart]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, products]);

  // Once the bump is a real line in the cart, the cart subtotal already has it.
  const bumpInTotals = bumpOn && bump && !bumpAdded ? bump.priceAmount : 0;
  const subtotal = cart?.subtotal ?? 0;
  const quote = useShippingQuote(workspaceId, {
    governorate: values.governorate,
    subtotal: subtotal + bumpInTotals,
    quantity: quantity + (bumpInTotals > 0 ? 1 : 0),
  });
  const shipping = quote.status === "ready" ? quote.amount : 0;
  const total = subtotal + bumpInTotals + shipping;

  // --- progress ------------------------------------------------------------
  const contactDone = CONTACT_FIELDS.every((f) => !validateField(f, values, t));
  const addressDone = ADDRESS_FIELDS.every((f) => !validateField(f, values, t));
  const done: CheckoutStep[] = [...(contactDone ? ["contact" as const] : []), ...(addressDone ? ["address" as const] : [])];
  const current: CheckoutStep = !contactDone ? "contact" : !addressDone ? "address" : "confirm";

  function onFieldChange(field: OrderFormField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  /** Validation as the shopper leaves a field — an empty optional field stays quiet. */
  function onFieldBlur(field: OrderFormField) {
    const error = validateField(field, values, t);
    setErrors((e) => (e[field] === error ? e : { ...e, [field]: error }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting !== "idle") return;

    const found = validateOrderForm(values, t);
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

    const systemNotes: string[] = [];
    // The picker never offers a method the store cannot take; this only guards a stale choice.
    const method: PaymentChoice = paymentMethod !== "cod" && !online?.[paymentMethod] ? "cod" : paymentMethod;

    setSubmitting("placing");
    setFormError(null);
    try {
      if (bumpOn && bump && !bumpAdded) {
        await addItem(bump.variantId, bump.offerId, 1);
        setBumpAdded(true);
      }

      const payload = toCheckoutPayload(values, { discountCode: appliedCode, systemNotes, paymentMethod: method });
      const order = await placeCodOrder({ client, workspaceId, payload, cartToken: cart.guestToken });
      clearCart();
      const next = afterOrder({ workspaceId, basePath, order, phone: payload.contact.phone });

      if (method === "cod") {
        router.push(next);
        return;
      }

      // Online: the order exists; now open Paymob's page. If that fails the
      // shopper still has their order and lands on its confirmation, which
      // says the payment page could not be opened.
      setSubmitting("paying");
      try {
        const url = await onlinePaymentUrl({ client, workspaceId, orderId: order.id });
        window.location.assign(url);
      } catch {
        const q = new URLSearchParams({ number: order.orderNumber, pay: "failed" });
        router.push(storeHref(basePath, `/orders/${order.id}?${q.toString()}`));
      }
    } catch (err) {
      setFormError(orderErrorMessage(err, t.form.errors.generic));
      setSubmitting("idle");
    }
  }

  const sectionTitle = (n: number, title: string) => (
    <span className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
        {n}
      </span>
      {title}
    </span>
  );

  const shippingCell =
    quote.status === "ready" ? (
      <span className="font-medium text-ink">{quote.amount === 0 ? t.shop.freeShipping : money(quote.amount, quote.currency)}</span>
    ) : quote.status === "loading" ? (
      <span className="text-ink-soft" role="status">
        {t.shop.quoting}
      </span>
    ) : (
      <span className="text-ink-soft">{t.checkout.shippingOnConfirmation}</span>
    );

  const summary = (
    <section id="checkout-summary" className={`${card} p-5`} aria-labelledby="summary-title">
      <h2 id="summary-title" className="text-base font-semibold text-ink">
        {t.checkout.summary}
      </h2>
      {isLoading && !cart ? (
        <ul aria-busy="true" aria-label={t.cart.loading} className="mt-4 space-y-3">
          {[0, 1].map((i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className={`${skeleton} h-4 w-2/3`} />
              <span className={`${skeleton} h-4 w-16`} />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">{t.cart.empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((line) => {
            const product = byVariant.get(line.variantId);
            const options = variantLabel(line.variant);
            return (
              <li key={line.id} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 text-ink-soft">
                  {product || loaded ? (
                    <span className="line-clamp-2 text-ink">{product?.name ?? (options || t.cart.item)}</span>
                  ) : (
                    <span className={`${skeleton} mb-1 block h-4 w-32`} />
                  )}
                  {product && options && <span className="block text-xs">{options}</span>}
                  <span className="text-xs"> × {line.quantity}</span>
                </span>
                <span className="shrink-0 font-medium text-ink">{money(line.lineTotal, currency)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Discount code — validated by the backend at checkout (no public preview endpoint). */}
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
              onClick={() => setAppliedCode("")}
              className={`min-h-11 shrink-0 cursor-pointer rounded-lg px-2 text-xs font-medium text-ink-soft hover:text-danger ${focusRing}`}
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
        <div className="flex justify-between gap-3">
          <dt className="text-ink-soft">{t.checkout.shippingFee}</dt>
          <dd>{shippingCell}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-line pt-3 text-base font-bold text-ink">
          <dt>{quote.status === "ready" ? t.checkout.total : t.checkout.totalEstimate}</dt>
          <dd aria-live="polite">{money(total, currency)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-ink-soft">{t.checkout.finalNote}</p>
    </section>
  );

  return (
    <main className={`${container} flex-1 py-8 sm:py-10`}>
      <StoreLink
        href="/cart"
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-ink-soft hover:text-primary ${focusRing}`}
      >
        <ArrowIcon size={16} className="rotate-180 rtl:rotate-0" />
        {t.checkout.backToCart}
      </StoreLink>
      <h1 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">{t.checkout.title}</h1>

      <div className="mt-6 max-w-xl">
        <CheckoutProgress done={done} current={current} />
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <section className={`${card} p-5 sm:p-6`} aria-labelledby="contact-title">
            <h2 id="contact-title" className="text-lg font-semibold text-ink">
              {sectionTitle(1, t.checkout.contact)}
            </h2>
            <div className="mt-4">
              <OrderFormFields
                idPrefix={FORM_PREFIX}
                fields="contact"
                values={values}
                errors={errors}
                onChange={onFieldChange}
                onBlur={onFieldBlur}
                showAltPhone
                showEmail
              />
            </div>
          </section>

          <section className={`${card} p-5 sm:p-6`} aria-labelledby="shipping-title">
            <h2 id="shipping-title" className="text-lg font-semibold text-ink">
              {sectionTitle(2, t.checkout.shipping)}
            </h2>
            <div className="mt-4">
              <OrderFormFields
                idPrefix={FORM_PREFIX}
                fields="address"
                values={values}
                errors={errors}
                onChange={onFieldChange}
                onBlur={onFieldBlur}
              />
            </div>
            {/* The fee for this destination, the moment it is known. */}
            {quote.status !== "idle" && (
              <p className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-paper px-4 py-3 text-sm">
                <span className="text-ink-soft">{t.checkout.shippingFee}</span>
                {shippingCell}
              </p>
            )}
          </section>

          <section className={`${card} p-5 sm:p-6`} aria-labelledby="payment-title">
            <h2 id="payment-title" className="text-lg font-semibold text-ink">
              {sectionTitle(3, t.checkout.payment)}
            </h2>
            <div className="mt-4">
              <PaymentMethodPicker
                online={online}
                value={paymentMethod}
                onChange={setPaymentMethod}
                idPrefix={FORM_PREFIX}
                disabled={submitting !== "idle"}
              />
            </div>

            {bump && items.length > 0 && (
              <div className="mt-5">
                <OrderBumpCard bump={bump} checked={bumpOn} onChange={setBumpOn} idPrefix={FORM_PREFIX} />
              </div>
            )}

            <div role="alert" aria-live="assertive" className="mt-5 empty:hidden">
              {formError && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting !== "idle" || items.length === 0}
              aria-busy={submitting !== "idle"}
              className={`${btnPrimaryLg} mt-5`}
            >
              {submitting === "paying"
                ? t.shop.redirectingToPayment
                : submitting === "placing"
                  ? t.checkout.placing
                  : paymentMethod === "cod"
                    ? `${t.checkout.place} — ${money(total, currency)}`
                    : t.shop.payOnlineTotal(money(total, currency))}
            </button>
            <p className="mt-3 text-center text-xs text-ink-soft">
              {paymentMethod === "cod" ? t.checkout.codHint : paymentMethod === "wallet" ? t.shop.payWalletHint : t.shop.payCardHint}
            </p>
          </section>
        </div>

        {/* Second in the DOM so it takes the narrow column on a wide screen; on a
            phone `order-first` lifts it above the form, folded to one line with the total. */}
        <aside className="order-first space-y-4 lg:order-none lg:sticky lg:top-24 lg:self-start">
          <button
            type="button"
            onClick={() => setSummaryOpen((o) => !o)}
            aria-expanded={summaryOpen}
            aria-controls="checkout-summary"
            className={`flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-line bg-paper-raised px-4 text-sm font-medium text-primary lg:hidden ${focusRing}`}
          >
            <span className="flex items-center gap-2">
              {summaryOpen ? t.shop.hideSummary : t.shop.showSummary}
              <ChevronIcon size={18} className={`transition-transform motion-reduce:transition-none ${summaryOpen ? "rotate-180" : ""}`} />
            </span>
            <span className="text-base font-bold text-ink">{money(total, currency)}</span>
          </button>
          <div className={summaryOpen ? "" : "hidden lg:block"}>{summary}</div>
        </aside>
      </form>
    </main>
  );
}

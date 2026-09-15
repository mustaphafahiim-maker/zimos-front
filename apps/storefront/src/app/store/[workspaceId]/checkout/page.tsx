"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { OrderBumpCard } from "@/components/checkout/OrderBumpCard";
import { OrderFormFields, fieldId } from "@/components/checkout/OrderFormFields";
import { ArrowIcon, CashIcon } from "@/components/Icons";
import { btnPrimaryLg, btnSecondary, card, container, input } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useCart } from "@/lib/CartProvider";
import { getOrderBump } from "@/lib/offers";
import { useShippingQuote } from "@/lib/shipping";
import { useCheckoutSession } from "@/lib/checkoutSession";
import { track } from "@/lib/track";
import {
  EMPTY_ORDER_FORM,
  FIELD_ORDER,
  toCheckoutPayload,
  validateOrderForm,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormValues,
} from "@/lib/orderForm";
import { afterOrder, orderErrorMessage, placeCodOrder } from "@/lib/placeOrder";
import { variantLabel } from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { useCatalog } from "@/lib/useCatalog";

const FORM_PREFIX = "checkout";

export default function CheckoutPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const { cart, addItem, clearCart } = useCart();
  const { t, money } = useStore();
  const [client] = useState(() => createStorefrontApiClient());
  const { products, byVariant, loaded } = useCatalog(workspaceId);

  const [values, setValues] = useState<OrderFormValues>(EMPTY_ORDER_FORM);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [bumpOn, setBumpOn] = useState(false);
  const [bumpAdded, setBumpAdded] = useState(false);

  const currency = cart?.currency ?? "EGP";
  const items = useMemo(() => cart?.items ?? [], [cart]);

  const bump = useMemo(() => {
    if (!loaded) return null;
    const inCart = new Set(items.map((l) => byVariant.get(l.variantId)?.id).filter(Boolean) as string[]);
    return getOrderBump(products ?? [], [...inCart]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, products]);

  // Once the bump is a real line in the cart, the cart subtotal already has it.
  const bumpInTotals = bumpOn && bump && !bumpAdded ? bump.priceAmount : 0;
  const subtotal = cart?.subtotal ?? 0;
  const { amount: shipping } = useShippingQuote(
    workspaceId,
    values.governorate,
    subtotal + bumpInTotals,
    items.reduce((n, l) => n + l.quantity, 0) + (bumpInTotals > 0 ? 1 : 0)
  );
  const total = subtotal + bumpInTotals + (shipping ?? 0);

  // Ad pixels: checkout started, once the cart has loaded.
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || items.length === 0) return;
    checkoutTracked.current = true;
    track("InitiateCheckout", {
      valueMinor: subtotal,
      currency,
      contentIds: items.map((l) => byVariant.get(l.variantId)?.id).filter((id): id is string => !!id),
      numItems: items.reduce((n, l) => n + l.quantity, 0),
    });
  }, [items, subtotal, currency, byVariant]);

  // Lets the merchant follow up if the shopper leaves after typing their number.
  useCheckoutSession(workspaceId, {
    fullName: values.fullName,
    phone: values.phone,
    email: values.email,
    items: items.map((l) => ({ variantId: l.variantId, ...(l.offerId ? { offerId: l.offerId } : {}), quantity: l.quantity })),
  });

  function onFieldChange(field: OrderFormField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

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

    setSubmitting(true);
    setFormError(null);
    try {
      // The bump is a real product: it becomes a real cart line priced by the backend.
      if (bumpOn && bump && !bumpAdded) {
        await addItem(bump.variantId, bump.offerId, 1);
        setBumpAdded(true);
      }

      const payload = toCheckoutPayload(values, { discountCode: appliedCode });
      const order = await placeCodOrder({ client, workspaceId, payload, cartToken: cart.guestToken });
      clearCart();
      router.push(afterOrder(workspaceId, order, payload.contact.phone));
    } catch (err) {
      setFormError(orderErrorMessage(err, t.form.errors.generic));
      setSubmitting(false);
    }
  }

  return (
    <main className={`${container} flex-1 py-8 sm:py-10`}>
      <Link
        href={`/store/${workspaceId}/cart`}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-ink-soft hover:text-primary"
      >
        <ArrowIcon size={16} className="rotate-180 rtl:rotate-0" />
        {t.checkout.backToCart}
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">{t.checkout.title}</h1>

      <form onSubmit={handleSubmit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <section className={`${card} p-5 sm:p-6`} aria-labelledby="shipping-title">
            <h2 id="shipping-title" className="text-lg font-semibold text-ink">
              {t.checkout.shipping}
            </h2>
            <div className="mt-4">
              <OrderFormFields
                idPrefix={FORM_PREFIX}
                values={values}
                errors={errors}
                onChange={onFieldChange}
                showAltPhone
                showEmail
              />
            </div>
          </section>

          <section className={`${card} p-5 sm:p-6`} aria-labelledby="payment-title">
            <h2 id="payment-title" className="text-lg font-semibold text-ink">
              {t.checkout.payment}
            </h2>
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">{t.checkout.payment}</legend>
              <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-primary bg-primary-soft px-4 py-3">
                <input type="radio" name="paymentMethod" value="cod" defaultChecked className="h-5 w-5 accent-primary" />
                <CashIcon className="text-primary" />
                <span>
                  <span className="block text-sm font-semibold text-ink">{t.checkout.cod}</span>
                  <span className="block text-xs text-ink-soft">{t.checkout.codHint}</span>
                </span>
              </label>
              {[t.checkout.card, t.checkout.wallet, t.checkout.bank].map((name) => (
                <label
                  key={name}
                  className="flex min-h-12 cursor-not-allowed items-center gap-3 rounded-xl border border-line px-4 py-2.5 text-sm text-ink-muted"
                >
                  <input type="radio" name="paymentMethod" disabled className="h-5 w-5" />
                  <span>{name}</span>
                  <span className="ms-auto rounded-full bg-zimos-cloud px-2 py-0.5 text-xs dark:bg-primary-soft">
                    {t.checkout.soon}
                  </span>
                </label>
              ))}
            </fieldset>
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
                <dt className="text-ink-soft">{t.checkout.shippingEstimate}</dt>
                <dd className="text-ink">
                  {shipping !== null ? money(shipping, currency) : t.checkout.chooseGovernorateForShipping}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-line pt-3 text-base font-bold text-ink">
                <dt>{t.checkout.totalEstimate}</dt>
                <dd>{money(total, currency)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-ink-muted">{t.checkout.finalNote}</p>
          </section>

          {bump && items.length > 0 && (
            <OrderBumpCard bump={bump} checked={bumpOn} onChange={setBumpOn} idPrefix={FORM_PREFIX} />
          )}

          <div role="alert" aria-live="assertive" className="empty:hidden">
            {formError && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</p>}
          </div>

          <button type="submit" disabled={submitting || items.length === 0} className={btnPrimaryLg}>
            {submitting ? t.checkout.placing : t.checkout.place}
          </button>
        </aside>
      </form>
    </main>
  );
}

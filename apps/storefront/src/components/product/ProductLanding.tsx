"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import {
  parseMoney,
  storefrontProductPage,
  type CheckoutSettings,
  type StorefrontProductDetail,
} from "@store-builder/api-client";
import { useCart } from "@/lib/CartProvider";
import { storeHref } from "@/lib/storeHref";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useShippingQuote } from "@/lib/useShippingQuote";
import { ShippingFee } from "@/components/checkout/ShippingFee";
import { bundlePricing, bundleTiers, type OrderBumpOffer } from "@/lib/commerce";
import {
  EMPTY_ORDER_FORM,
  formOptionsOf,
  FIELD_ORDER,
  quickFormFields,
  toCheckoutPayload,
  validateOrderForm,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormValues,
} from "@/lib/orderForm";
import {
  afterOrder,
  isOrderBumpRefused,
  orderErrorMessage,
  placeCodOrder,
  serverFieldErrors,
  type OrderLine,
} from "@/lib/placeOrder";
import { placeOnlineOrder, usePaymentMethods } from "@/lib/payments";
import { PaymentMethodPicker } from "@/components/checkout/PaymentMethodPicker";
import { useCheckoutAutosave } from "@/lib/useCheckoutAutosave";
import { useOrderFormFields } from "@/lib/useOrderFormFields";
import {
  defaultOfferOf,
  discountPercent,
  findVariant,
  offerAppliesTo,
  optionGroups,
  variantUnitPrice,
} from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { getVisitorId } from "@/lib/visitorId";
import { useStoreBasePath } from "../StoreRoute";
import { CustomFieldInputs, useCustomFieldAnswers } from "./CustomFieldInputs";
import { AddToCartButton } from "../AddToCartButton";
import { QuantityStepper } from "../QuantityStepper";
import { OrderBumpCard } from "../checkout/OrderBumpCard";
import { OrderFormFields, fieldId } from "../checkout/OrderFormFields";
import { CashIcon, CheckIcon } from "../Icons";
import { OfferCountdown } from "./OfferCountdown";
import { OptionPicker } from "./OptionPicker";
import { productPageText } from "./productPageText";
import { btnPrimary, btnPrimaryLg, card } from "../ui";

const FORM_PREFIX = "quick";

/**
 * The buy box of the product page, built as a cash-on-delivery landing:
 * variant pickers → bundle/quantity offer → inline quick order form with an
 * order bump → real COD checkout. "Add to cart" stays as a secondary path.
 */
export function ProductLanding({
  workspaceId,
  product,
  bump: bumpOffer,
  description,
  checkoutSettings,
}: {
  workspaceId: string;
  product: StorefrontProductDetail;
  bump: OrderBumpOffer | null;
  /** Shown above the order form when the product puts its description first. */
  description?: string | null;
  /** From this page's own render, not the layout's — see useFreshCheckoutSettings. */
  checkoutSettings: CheckoutSettings;
}) {
  const { t, money, locale } = useStore();
  const text = productPageText(locale);
  // The product page's settings (SPEC §7.3), defaults filled in.
  const page = useMemo(() => storefrontProductPage(product), [product]);
  // The store's purchase form layout (settings → purchase form) outranks the
  // product's own switch: "one_step" keeps every product page free of the
  // form and sends "Buy now" straight to the checkout.
  const ps =
    formOptionsOf(checkoutSettings).layout === "one_step"
      ? { ...page.pageSettings, inline_checkout: false, skip_cart: true }
      : page.pageSettings;
  const cart = useCart();
  const buyLabel = ps.buy_now_text || (ps.inline_checkout ? t.product.orderNow : text.buyNow);
  const quickFields = useMemo(() => quickFormFields(checkoutSettings), [checkoutSettings]);
  const { fields, reveal } = useOrderFormFields(quickFields);
  const basePath = useStoreBasePath();
  const router = useRouter();
  const [client] = useState(() => createStorefrontApiClient());

  // --- variant selection -------------------------------------------------
  const groups = useMemo(() => optionGroups(product.variants), [product.variants]);
  const initialVariant = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const [selection, setSelection] = useState<Record<string, string>>(() => ({
    ...(initialVariant?.optionValues ?? {}),
  }));
  const variant = groups.length > 0 ? findVariant(product.variants, selection) : initialVariant;
  const available = !!variant?.inStock;

  function isValueAvailable(name: string, value: string) {
    return product.variants.some(
      (v) =>
        v.inStock &&
        v.optionValues?.[name] === value &&
        Object.entries(selection).every(([n, val]) => n === name || v.optionValues?.[n] === val)
    );
  }

  // --- bundles / quantity --------------------------------------------------
  const tiers = useMemo(() => bundleTiers(product), [product]);
  const [quantity, setQuantity] = useState(1);
  const [tierId, setTierId] = useState(
    () => product.offers.find((o) => o.isDefault)?.id ?? tiers[0]?.id ?? ""
  );
  const tier = tiers.find((x) => x.id === tierId);
  const unit = variantUnitPrice(product, variant);
  const pricing = bundlePricing(unit, quantity, tier);
  const compareAtUnit =
    variant?.compareAtAmount && parseMoney(variant.compareAtAmount) > unit ? parseMoney(variant.compareAtAmount) : null;
  const pct = discountPercent(unit, compareAtUnit);

  // The product's custom fields: answered here, sent with the order line.
  const custom = useCustomFieldAnswers(workspaceId, product.id, product.customFields);

  const defaultOffer = defaultOfferOf(product);
  const mainLine: OrderLine | null = variant
    ? tier
      ? { variantId: variant.id, offerId: tier.offerId, quantity: 1 }
      : {
          variantId: variant.id,
          offerId: defaultOffer && offerAppliesTo(defaultOffer, variant.id) ? defaultOffer.id : undefined,
          quantity,
        }
    : null;

  // --- form ----------------------------------------------------------------
  const [values, setValues] = useState<OrderFormValues>(EMPTY_ORDER_FORM);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bumpOn, setBumpOn] = useState(false);
  // Refused by the server since this page loaded (sold out, withdrawn): hidden.
  const [bumpGone, setBumpGone] = useState(false);
  const bump = bumpGone ? null : bumpOffer;
  const payment = usePaymentMethods(client, workspaceId);
  const [methodId, setMethodId] = useState<string | null>(null);
  const method = payment.methods.find((m) => m.id === methodId) ?? payment.methods[0];
  const [redirecting, setRedirecting] = useState(false);

  // The hook keys on the lines' content, so a fresh array each render is fine.
  const autosaveLines: OrderLine[] = mainLine ? [mainLine] : [];
  if (bumpOn && bump) autosaveLines.push({ variantId: bump.variantId, offerId: bump.offerId, quantity: 1 });
  const autosave = useCheckoutAutosave({ client, workspaceId, values, lines: autosaveLines });
  const shipping = useShippingQuote({ client, workspaceId, governorate: values.governorate, lines: autosaveLines });

  const total = pricing.total + (bumpOn && bump ? bump.priceAmount : 0) + shipping.amount;

  function onFieldChange(field: OrderFormField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const found = validateOrderForm(values, t, fields);
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    if (invalid.length > 0) {
      setFormError(t.form.errors.summary(invalid.length));
      document.getElementById(fieldId(FORM_PREFIX, invalid[0]))?.focus();
      return;
    }
    if (!variant || !available || !mainLine) {
      setFormError(t.form.errors.unavailable);
      return;
    }
    if (!custom.check()) {
      setFormError(t.custom.summary);
      return;
    }
    // The answers ride on the line that places the order only: the shipping
    // quote and the autosave above key on the lines and must not re-run per keystroke.
    const customizations = custom.toInput();
    const orderLine: OrderLine = customizations ? { ...mainLine, customizations } : mainLine;
    const visitorId = getVisitorId(workspaceId);

    setSubmitting(true);
    setFormError(null);
    const checkoutSessionId = await autosave.stop();
    // A ticked bump names its offer only; the server adds it to this order.
    const payload = {
      ...toCheckoutPayload(values, fields, { item: orderLine }),
      ...(bumpOn && bump ? { orderBump: { offerId: bump.offerId } } : {}),
      ...(checkoutSessionId ? { checkoutSessionId } : {}),
    };
    try {
      if (method.method !== "cod") {
        const { next, external } = await placeOnlineOrder({
          client,
          workspaceId,
          basePath,
          payload,
          method,
          visitorId,
        });
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
        payload,
        visitorId,
      });
      router.push(afterOrder({ workspaceId, basePath, order, phone: payload.contact.phone }));
    } catch (err) {
      if (custom.showServerProblems(err)) {
        setFormError(t.custom.summary);
        setSubmitting(false);
        autosave.resume();
        return;
      }
      if (isOrderBumpRefused(err)) {
        // The totals above drop the add-on with it; the shopper confirms again.
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

  // --- sticky mobile bar ---------------------------------------------------
  const formRef = useRef<HTMLElement>(null);
  const [formVisible, setFormVisible] = useState(false);
  useEffect(() => {
    const el = formRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // --- buy now without the inline form --------------------------------------
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  async function buyNow() {
    if (!mainLine || !available || buying) return;
    if (custom.fields.length > 0 && !custom.check()) return;
    setBuying(true);
    setBuyError(null);
    try {
      await cart.addItem(
        mainLine.variantId,
        mainLine.offerId,
        mainLine.quantity,
        custom.fields.length > 0 ? custom.toInput() : undefined
      );
      // skip_cart: straight to the checkout; otherwise the cart, to review first.
      router.push(storeHref(basePath, ps.skip_cart ? "/checkout" : "/cart"));
    } catch (err) {
      if (!custom.showServerProblems(err)) {
        setBuyError(err instanceof Error && err.message ? err.message : t.product.addFailed);
      }
      setBuying(false);
    }
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      document.getElementById(fieldId(FORM_PREFIX, "fullName"))?.focus({ preventScroll: true });
    }, 450);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Title + price */}
      <div>
        <h1 className="text-2xl font-bold leading-tight text-ink sm:text-3xl">{product.name}</h1>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-bold text-ink">{money(unit)}</span>
          {compareAtUnit && (
            <span className="text-lg text-ink-soft line-through">
              <span className="sr-only">{t.product.compareAt} </span>
              {money(compareAtUnit)}
            </span>
          )}
          {pct && (
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-sm font-semibold text-primary">
              {t.common.save(pct)}
            </span>
          )}
        </div>
        <p className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${available ? "text-success" : "text-danger"}`}>
          {available && <CheckIcon size={16} />}
          {available
            ? t.common.inStock
            : product.variants.length === 0
              ? t.common.unavailable
              : t.common.outOfStock}
        </p>
      </div>

      {ps.countdown ? <OfferCountdown endsAt={ps.countdown.ends_at} /> : null}

      {/* Variant options */}
      {groups.map((group) => (
        <OptionPicker
          key={group.name}
          group={group}
          display={page.options.find((o) => o.name === group.name)}
          selected={selection[group.name]}
          isAvailable={(value) => isValueAvailable(group.name, value)}
          onSelect={(value) => setSelection((prev) => ({ ...prev, [group.name]: value }))}
        />
      ))}

      {/* Bundle / quantity offer */}
      {tiers.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">{t.product.chooseOffer}</legend>
          <div className="grid gap-2">
            {tiers.map((x) => {
              const selected = tier?.id === x.id;
              const p = bundlePricing(unit, x.quantity, x);
              const badge = x.badge;
              return (
                <label
                  key={x.id}
                  className={`relative flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                    selected ? "border-primary bg-primary-soft" : "border-line bg-paper-raised hover:border-primary"
                  }`}
                >
                  <input
                    type="radio"
                    name="bundle"
                    value={x.id}
                    checked={selected}
                    onChange={() => setTierId(x.id)}
                    className="h-5 w-5 shrink-0 cursor-pointer accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{x.label ?? t.common.piece(x.quantity)}</span>
                      {x.discountPct > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">
                          {t.common.save(x.discountPct)}
                        </span>
                      )}
                      {badge && (
                        <span className="rounded-full border border-primary/30 px-2 py-0.5 text-xs font-medium text-primary">
                          {badge}
                        </span>
                      )}
                    </span>
                    {p.saving > 0 && (
                      <span className="mt-0.5 block text-xs text-success">{t.product.youSave(money(p.saving))}</span>
                    )}
                  </span>
                  <span className="text-end">
                    <span className="block text-base font-bold text-ink">{money(p.total)}</span>
                    {p.saving > 0 && <span className="block text-xs text-ink-soft line-through">{money(p.full)}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {tiers.length === 0 && !ps.hide_quantity_selector && (
        <div className="flex items-center justify-between gap-4">
          <span id="qty-label" className="text-sm font-semibold text-ink">
            {t.product.quantity}
          </span>
          {/* The same stepper the cart page and the cart drawer use. */}
          <QuantityStepper value={quantity} onChange={setQuantity} labelledBy="qty-label" />
        </div>
      )}

      {/* What the shopper fills in for this product (engraving, a note, their photo). */}
      <CustomFieldInputs state={custom} />

      {/* Primary CTA scrolls to the form; add-to-cart is the secondary path. */}
      {page.specialOfferText && (
        <p className="rounded-xl border border-primary/25 bg-primary-soft px-4 py-2.5 text-center text-sm font-semibold text-primary">
          {page.specialOfferText}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={ps.inline_checkout ? scrollToForm : () => void buyNow()}
          disabled={!available || buying}
          className={`${btnPrimary} w-full`}
        >
          {buying ? text.buying : buyLabel}
        </button>
        <AddToCartButton
          variant="secondary"
          variantId={mainLine?.variantId}
          offerId={mainLine?.offerId}
          defaultQuantity={mainLine?.quantity ?? 1}
          disabled={!available}
          customizations={custom.fields.length > 0 ? custom.toInput() : undefined}
          beforeAdd={custom.fields.length > 0 ? custom.check : undefined}
          onAddError={custom.fields.length > 0 ? custom.showServerProblems : undefined}
        />
      </div>

      <p role="alert" className="text-sm font-medium text-danger empty:hidden">{buyError}</p>

      {ps.inline_checkout && !ps.checkout_before_description && description ? (
        <div className="whitespace-pre-line rounded-2xl border border-line bg-paper-raised p-5 text-base leading-relaxed text-ink-soft sm:p-6">
          {description}
        </div>
      ) : null}

      {/* Inline quick order form */}
      {ps.inline_checkout && (
      <section
        ref={formRef}
        id="order-form"
        aria-labelledby="order-form-title"
        className={`${card} scroll-mt-24 border-2 border-primary/25 p-5 sm:p-6`}
      >
        <h2 id="order-form-title" className="flex items-center gap-2 text-lg font-bold text-ink">
          <CashIcon className="text-primary" />
          {t.form.title}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{t.form.subtitle}</p>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
          <OrderFormFields
            idPrefix={FORM_PREFIX}
            values={values}
            errors={errors}
            onChange={onFieldChange}
            fields={fields}
          />

          <dl className="space-y-2 rounded-xl bg-paper p-4 text-sm ">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">
                {product.name} × {tier ? tier.quantity : quantity}
              </dt>
              <dd className="shrink-0 text-ink">{money(pricing.full)}</dd>
            </div>
            {pricing.saving > 0 && (
              <div className="flex justify-between gap-3 text-success">
                <dt>{t.checkout.bundleSaving}</dt>
                <dd className="shrink-0">−{money(pricing.saving)}</dd>
              </div>
            )}
            {bumpOn && bump && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">{bump.name}</dt>
                <dd className="shrink-0 text-ink">{money(bump.priceAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">{t.checkout.shippingFee}</dt>
              <dd className="shrink-0 text-ink">
                <ShippingFee line={shipping.line} />
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold text-ink">
              <dt>{t.form.total}</dt>
              <dd className="shrink-0">{money(total)}</dd>
            </div>
          </dl>

          {bump && <OrderBumpCard bump={bump} checked={bumpOn} onChange={setBumpOn} idPrefix={FORM_PREFIX} />}

          {payment.methods.length > 1 && (
            <PaymentMethodPicker
              methods={payment.methods}
              value={method.id}
              onChange={setMethodId}
              idPrefix={FORM_PREFIX}
            />
          )}

          <div role="alert" aria-live="assertive" className="empty:hidden">
            {formError && (
              <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</p>
            )}
          </div>

          <button type="submit" disabled={submitting || !available} className={btnPrimaryLg}>
            {redirecting
              ? t.payment.redirecting
              : submitting
                ? t.form.submitting
                : `${method.method === "cod" ? t.form.submit : t.payment.payNow} — ${money(total)}`}
          </button>
          {method.method === "cod" && (
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-soft">
              <CashIcon size={16} />
              {t.checkout.codHint}
            </p>
          )}
        </form>
      </section>
      )}

      {/* Sticky mobile bar */}
      {ps.sticky_buy_button && (
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-raised/95 px-4 py-3 shadow-lg backdrop-blur transition-transform duration-200 md:hidden ${
          formVisible ? "translate-y-full" : "translate-y-0"
        }`}
        aria-hidden={formVisible}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-soft">{t.form.total}</p>
            <p className="truncate text-base font-bold text-ink">{money(pricing.total)}</p>
          </div>
          <button
            type="button"
            onClick={ps.inline_checkout ? scrollToForm : () => void buyNow()}
            disabled={!available || buying}
            tabIndex={formVisible ? -1 : 0}
            className={`${btnPrimary} flex-1`}
          >
            {ps.buy_now_text || (ps.inline_checkout ? t.product.stickyOrder : text.buyNow)}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

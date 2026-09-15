"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseMoney, type StorefrontProductDetail } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { bundlePricing, bundleTiers, type OrderBumpOffer } from "@/lib/offers";
import { useShippingQuote } from "@/lib/shipping";
import { useCheckoutSession } from "@/lib/checkoutSession";
import { isEgyptianMobile } from "@/lib/egypt";
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
import { afterOrder, orderErrorMessage, placeCodOrder, type OrderLine } from "@/lib/placeOrder";
import {
  defaultOfferOf,
  discountPercent,
  findVariant,
  offerAppliesTo,
  optionGroups,
  variantUnitPrice,
} from "@/lib/product";
import type { ProductRating } from "@/lib/publicApi";
import { useStore } from "@/lib/StoreContext";
import { AddToCartButton } from "../AddToCartButton";
import { OrderBumpCard } from "../checkout/OrderBumpCard";
import { OrderFormFields, fieldId } from "../checkout/OrderFormFields";
import { RatingSummary } from "./Reviews";
import { CashIcon, CheckIcon } from "../Icons";
import { Countdown } from "./Countdown";
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
  bump,
  countdownHours,
  rating,
  headingLevel = "h1",
}: {
  workspaceId: string;
  product: StorefrontProductDetail;
  bump: OrderBumpOffer | null;
  countdownHours: number | null;
  rating?: ProductRating;
  /** "h2" when embedded in a page-builder section, so the page keeps one h1. */
  headingLevel?: "h1" | "h2";
}) {
  const ProductTitle = headingLevel;
  const { t, money } = useStore();
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
  const realTiers = tiers.length > 0;
  const [quantity, setQuantity] = useState(1);
  const [realTierId, setRealTierId] = useState(() =>
    realTiers ? (product.offers.find((o) => o.isDefault)?.id ?? tiers[0]?.id ?? "") : ""
  );
  const tier = realTiers ? tiers.find((x) => x.id === realTierId) : undefined;
  const unit = variantUnitPrice(product, variant);
  const pricing = bundlePricing(unit, quantity, tier);
  const compareAtUnit =
    variant?.compareAtAmount && parseMoney(variant.compareAtAmount) > unit ? parseMoney(variant.compareAtAmount) : null;
  const pct = discountPercent(unit, compareAtUnit);

  const defaultOffer = defaultOfferOf(product);
  const mainLine: OrderLine | null = variant
    ? realTiers && tier
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

  const bumpAmount = bumpOn && bump ? bump.priceAmount : 0;
  const { amount: shipping } = useShippingQuote(
    workspaceId,
    values.governorate,
    pricing.total + bumpAmount,
    (tier ? tier.quantity : quantity) + (bumpOn && bump ? 1 : 0)
  );
  const total = pricing.total + bumpAmount + (shipping ?? 0);

  // Lets the merchant follow up if the shopper leaves after typing their number.
  useCheckoutSession(workspaceId, {
    fullName: values.fullName,
    phone: values.phone,
    email: values.email,
    items: [
      ...(mainLine ? [mainLine] : []),
      ...(bumpOn && bump ? [{ variantId: bump.variantId, ...(bump.offerId ? { offerId: bump.offerId } : {}), quantity: 1 }] : []),
    ],
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
    if (!variant || !available || !mainLine) {
      setFormError(t.form.errors.unavailable);
      return;
    }

    const bumpLine: OrderLine | null = bumpOn && bump ? { variantId: bump.variantId, offerId: bump.offerId, quantity: 1 } : null;
    const payload = toCheckoutPayload(values, {
      item: bumpLine ? undefined : mainLine,
    });

    setSubmitting(true);
    setFormError(null);
    try {
      const order = await placeCodOrder({
        client,
        workspaceId,
        payload,
        lines: bumpLine ? [mainLine, bumpLine] : undefined,
      });
      router.push(afterOrder(workspaceId, order, payload.contact.phone));
    } catch (err) {
      setFormError(orderErrorMessage(err, t.form.errors.generic));
      setSubmitting(false);
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

  // While the bar is showing, reserve room under the page (CSS in globals.css)
  // so it never hides the footer or the last lines of content.
  useEffect(() => {
    const root = document.documentElement;
    if (formVisible) delete root.dataset.stickyBar;
    else root.dataset.stickyBar = "";
    return () => {
      delete root.dataset.stickyBar;
    };
  }, [formVisible]);

  // Ad pixels: product viewed once per product.
  useEffect(() => {
    track("ViewContent", { valueMinor: unit, currency: variant?.currency, contentIds: [product.id], contentName: product.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  // …and the checkout started the first time the shopper types a valid number.
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || !isEgyptianMobile(values.phone)) return;
    checkoutTracked.current = true;
    track("InitiateCheckout", { valueMinor: pricing.total, currency: variant?.currency, contentIds: [product.id], numItems: tier ? tier.quantity : quantity });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.phone]);

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
        <ProductTitle className="text-2xl font-bold leading-tight text-ink sm:text-3xl">{product.name}</ProductTitle>
        {rating && <RatingSummary rating={rating} />}
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-bold text-ink">{money(unit)}</span>
          {compareAtUnit && (
            <span className="text-lg text-ink-muted line-through">
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
          {available ? t.common.inStock : t.common.outOfStock}
        </p>
      </div>

      {countdownHours ? <Countdown label={t.product.offerEnds} endsInHours={countdownHours} /> : null}

      {/* Variant options */}
      {groups.map((group) => (
        <fieldset key={group.name}>
          <legend className="mb-2 text-sm font-semibold text-ink">
            {group.name}
            {selection[group.name] && <span className="ms-2 font-normal text-ink-soft">{selection[group.name]}</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {group.values.map((value) => {
              const selected = selection[group.name] === value;
              const ok = isValueAvailable(group.name, value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelection((prev) => ({ ...prev, [group.name]: value }))}
                  className={`min-h-11 min-w-11 cursor-pointer rounded-xl border-2 px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    selected
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-line bg-paper-raised text-ink hover:border-line-strong"
                  } ${ok ? "" : "text-ink-muted line-through decoration-1"}`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>
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
                    selected ? "border-primary bg-primary-soft" : "border-line bg-paper-raised hover:border-line-strong"
                  }`}
                >
                  <input
                    type="radio"
                    name="bundle"
                    value={x.id}
                    checked={selected}
                    onChange={() => setRealTierId(x.id)}
                    className="h-5 w-5 shrink-0 cursor-pointer accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{x.label ?? t.common.piece(x.quantity)}</span>
                      {x.discountPct > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
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
                    {p.saving > 0 && <span className="block text-xs text-ink-muted line-through">{money(p.full)}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {!realTiers && (
        <div className="flex items-center justify-between gap-4">
          <span id="qty-label" className="text-sm font-semibold text-ink">
            {t.product.quantity}
          </span>
          <div role="group" aria-labelledby="qty-label" className="inline-flex items-center rounded-xl border border-line-strong bg-paper-raised">
            <button
              type="button"
              aria-label={t.product.decrease}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="h-11 w-11 cursor-pointer text-lg text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <output aria-live="polite" className="min-w-10 text-center text-base font-semibold tabular-nums text-ink">
              {quantity}
            </output>
            <button
              type="button"
              aria-label={t.product.increase}
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              className="h-11 w-11 cursor-pointer text-lg text-ink"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Primary CTA scrolls to the form; add-to-cart is the secondary path. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={scrollToForm} disabled={!available} className={`${btnPrimary} w-full`}>
          {t.product.orderNow}
        </button>
        <AddToCartButton
          variant="secondary"
          variantId={mainLine?.variantId}
          offerId={mainLine?.offerId}
          defaultQuantity={mainLine?.quantity ?? 1}
          disabled={!available}
        />
      </div>

      {/* Inline quick order form */}
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
          <OrderFormFields idPrefix={FORM_PREFIX} values={values} errors={errors} onChange={onFieldChange} />

          <dl className="space-y-2 rounded-xl bg-zimos-cloud p-4 text-sm dark:bg-primary-soft">
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
              <dt className="text-ink-soft">{t.checkout.shippingEstimate}</dt>
              <dd className="shrink-0 text-ink">
                {shipping !== null ? money(shipping) : t.checkout.chooseGovernorateForShipping}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold text-ink">
              <dt>{t.form.total}</dt>
              <dd className="shrink-0">{money(total)}</dd>
            </div>
          </dl>

          {bump && <OrderBumpCard bump={bump} checked={bumpOn} onChange={setBumpOn} idPrefix={FORM_PREFIX} />}

          <div role="alert" aria-live="assertive" className="empty:hidden">
            {formError && (
              <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</p>
            )}
          </div>

          <button type="submit" disabled={submitting || !available} className={btnPrimaryLg}>
            {submitting ? t.form.submitting : `${t.form.submit} — ${money(total)}`}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-soft">
            <CashIcon size={16} />
            {t.checkout.codHint}
          </p>
        </form>
      </section>

      {/* Sticky mobile bar */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-raised/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-pop backdrop-blur transition-transform duration-200 md:hidden ${
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
            onClick={scrollToForm}
            disabled={!available}
            tabIndex={formVisible ? -1 : 0}
            className={`${btnPrimary} flex-1`}
          >
            {t.product.stickyOrder}
          </button>
        </div>
      </div>
    </div>
  );
}

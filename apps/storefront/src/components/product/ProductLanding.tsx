"use client";

import { ConvertedPrice } from "@/components/ConvertedPrice";
import { useEffect, useMemo, useRef, useState, type FormEvent, useCallback } from "react";
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
import { useShippingChoice } from "@/lib/shippingChoice";
import { ShippingOptionPicker } from "../ShippingOptionPicker";
import { ShippingFee } from "@/components/checkout/ShippingFee";
import { bundlePricing, bundleTiers, type OrderBumpOffer } from "@/lib/commerce";
import {
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
import {
  TransferDetails,
  asTransferMethod,
  transferProblem,
  useDepositQuote,
  useTransferCopy,
  type TransferState,
} from "@/components/checkout/TransferDetails";
import type { CheckoutPayload, ManualTransferStoreMethod } from "@store-builder/api-client";
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
import { CodeSlot } from "../CustomCode";
import { CustomFieldInputs, useCustomFieldAnswers } from "./CustomFieldInputs";
import { AddToCartButton } from "../AddToCartButton";
import { QuantityStepper } from "../QuantityStepper";
import { OrderBumpCard } from "../checkout/OrderBumpCard";
import { OrderFormFields, fieldId } from "../checkout/OrderFormFields";
import { CashIcon, CheckIcon } from "../Icons";
import { customFieldsDelta, storefrontProductBundle } from "@store-builder/api-client";
import { readPick, usePick } from "@/lib/pagePicks";
import { useProductTest } from "@/lib/productTest";
import { track } from "@/lib/track";
import { contentIdOf } from "@/lib/contentId";
import { emptyOrderFormFor, useStoreCountry } from "@/lib/storeCountry";
import { BundleAddToCartButton, BundlePicker, useBundleSelection } from "./BundlePicker";
import { ProductBumpCards, useProductBumps } from "../offers/StoreOffers";
import { DiscountRows, MinimumOrderNotice, discountOff, useCouponPreview, useStoredCoupon } from "../offers/CouponBits";
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
  product: listedProduct,
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
  const { t, money, locale, store } = useStore();
  // A running A/B test: this visitor's prices (lib/productTest); the price waits until it is known.
  const { product, pending: testPending } = useProductTest(workspaceId, listedProduct);
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
  // Off on the product (page settings) or for the whole store (purchase form → pre-select a variant):
  // the shopper picks every option before buying.
  const autoSelect = page.pageSettings.auto_select_variant !== false && formOptionsOf(checkoutSettings).auto_select_variant !== false;
  const [selection, setSelection] = useState<Record<string, string>>(() =>
    !autoSelect && groups.length > 0 ? {} : { ...(initialVariant?.optionValues ?? {}) }
  );
  // What the shopper picked on this page's variant_selector / bundle_selector (lib/pagePicks), after hydration.
  useEffect(() => {
    const picked = product.variants.find((v) => v.id === readPick("variant", product.id));
    if (picked) setSelection({ ...(picked.optionValues ?? {}) });
    const offer = readPick("offer", product.id);
    if (offer && product.offers.some((o) => o.id === offer)) setTierId(offer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);
  usePick(
    "variant",
    product.id,
    useCallback((id: string) => {
      const picked = product.variants.find((v) => v.id === id);
      if (picked) setSelection({ ...(picked.optionValues ?? {}) });
    }, [product.variants])
  );
  // Options left to choose (auto_select_variant off): no variant yet, and not "out of stock".
  const choosing = !autoSelect && groups.some((g) => !selection[g.name]);
  const variant = groups.length > 0 ? (choosing ? undefined : findVariant(product.variants, selection)) : initialVariant;
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
  // A reusable quantity bundle (BundlePicker) takes the place of the offer
  // ladder and the quantity stepper; the server prices it.
  const bundle = useMemo(() => storefrontProductBundle(product), [product]);
  const bundleChoice = useBundleSelection({ client, workspaceId, bundle, product, mainVariant: variant });
  const tiers = useMemo(() => (bundle ? [] : bundleTiers(product)), [bundle, product]);
  const [quantity, setQuantity] = useState(1);
  const [tierId, setTierId] = useState(
    () => product.offers.find((o) => o.isDefault)?.id ?? tiers[0]?.id ?? ""
  );
  usePick("offer", product.id, useCallback((id: string) => setTierId(id), []));
  const tier = tiers.find((x) => x.id === tierId);
  // The product's custom fields: answered here, sent with the order line.
  const custom = useCustomFieldAnswers(workspaceId, product.id, product.customFields);
  const unit = variantUnitPrice(product, variant);
  const pricing = bundleChoice ? bundleChoice.pricing : bundlePricing(unit, quantity, tier);
  const compareAtUnit =
    variant?.compareAtAmount && parseMoney(variant.compareAtAmount) > unit ? parseMoney(variant.compareAtAmount) : null;
  const pct = discountPercent(unit, compareAtUnit);

  const defaultOffer = defaultOfferOf(product);
  // The bundle's pieces beyond the first line (another variant per piece).
  const bundleExtraLines: OrderLine[] = bundleChoice ? bundleChoice.lines.slice(1) : [];
  const mainLine: OrderLine | null = bundleChoice
    ? (bundleChoice.lines[0] ?? null)
    : variant
    ? tier
      ? { variantId: variant.id, offerId: tier.offerId, quantity: 1 }
      : {
          variantId: variant.id,
          offerId: defaultOffer && offerAppliesTo(defaultOffer, variant.id) ? defaultOffer.id : undefined,
          quantity,
        }
    : null;

  // --- form ----------------------------------------------------------------
  // The form starts on the store's country (dashboard → General → Country).
  const storeCountry = useStoreCountry();
  const [values, setValues] = useState<OrderFormValues>(() => emptyOrderFormFor(storeCountry));
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bumpOn, setBumpOn] = useState(false);
  // Refused by the server since this page loaded (sold out, withdrawn): hidden.
  const [bumpGone, setBumpGone] = useState(false);
  const bump = bumpGone ? null : bumpOffer;
  // The product's own order bumps (Offers → Order bumps), beside the store-wide one.
  const productBumps = useProductBumps(client, workspaceId, product.id, bumpOffer?.offerId);
  const productBumpsAmount = productBumps.selected.reduce((sum, b) => sum + b.priceAmount, 0);
  const payment = usePaymentMethods(client, workspaceId);
  const [methodId, setMethodId] = useState<string | null>(null);
  const method = payment.methods.find((m) => m.id === methodId) ?? payment.methods[0];
  // Manual transfer: the whole order, or the deposit a cash-on-delivery order needs (as on /checkout).
  const transferCopy = useTransferCopy();
  const transferMethod = asTransferMethod(method);
  const deposit = useDepositQuote(client, workspaceId, values.phone, method?.method === "cod");
  const [transfer, setTransfer] = useState<{ method: ManualTransferStoreMethod; state: TransferState } | null>(null);
  const needsTransfer = Boolean(transferMethod || deposit);
  const [redirecting, setRedirecting] = useState(false);

  // The hook keys on the lines' content, so a fresh array each render is fine.
  const autosaveLines: OrderLine[] = mainLine ? [mainLine, ...bundleExtraLines] : [];
  if (bumpOn && bump) autosaveLines.push({ variantId: bump.variantId, offerId: bump.offerId, quantity: 1 });
  for (const b of productBumps.selected) autosaveLines.push({ variantId: b.variantId, offerId: b.offerId, quantity: 1 });
  const autosave = useCheckoutAutosave({ client, workspaceId, values, lines: autosaveLines });
  // The shopper's shipping option, when the store offers more than one (shippingChoice.ts).
  const shippingChoice = useShippingChoice(useShippingQuote({ client, workspaceId, governorate: values.governorate, country: values.country, lines: autosaveLines }));
  const shipping = shippingChoice.state;

  // A coupon from the link (?coupon=CODE), previewed by the server; with none, the store's automatic discount.
  const linkCoupon = useStoredCoupon(workspaceId);
  const coupon = useCouponPreview(client, workspaceId, formOptionsOf(fields).allow_discount_codes ? linkCoupon : "", autosaveLines);
  // Priced fields the shopper filled in, on every unit of the line they ride on (as the server charges them).
  const fieldsExtra = customFieldsDelta(product.customFields, custom.toInput()) * (mainLine?.quantity ?? 0);
  const total =
    pricing.total +
    fieldsExtra +
    (bumpOn && bump ? bump.priceAmount : 0) +
    productBumpsAmount +
    shipping.amount -
    discountOff(shipping.extras, coupon);

  // The product's view and the start of its order form, for the store's pixels and analytics
  // (SPEC §13.2), once each per page view; ids as the product feed gives them (lib/contentId).
  const viewTracked = useRef<string | null>(null);
  useEffect(() => {
    if (viewTracked.current === product.id) return;
    // A tick later, and marked sent only once it is (an effect can run twice before it sticks).
    const timer = window.setTimeout(() => {
      viewTracked.current = product.id;
      track("ViewContent", {
        contentIds: [contentIdOf(variant ?? initialVariant) ?? product.id],
        contentName: product.name,
        valueMinor: unit,
        currency: store?.currency,
      });
    });
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);
  const checkoutTracked = useRef(false);
  function onFormStart() {
    if (checkoutTracked.current) return;
    checkoutTracked.current = true;
    track("InitiateCheckout", {
      contentIds: [mainLine, ...bundleExtraLines]
        .filter((l): l is OrderLine => !!l)
        .map((l) => contentIdOf(product.variants.find((v) => v.id === l.variantId)) ?? l.variantId),
      contentName: product.name,
      valueMinor: pricing.total,
      currency: store?.currency,
      numItems: [mainLine, ...bundleExtraLines].reduce((sum, l) => sum + (l?.quantity ?? 0), 0),
    });
  }

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
    if (needsTransfer) {
      const problem = transfer ? transferProblem(transfer.method, transfer.state, transferCopy) : transferCopy.needReceipt;
      if (problem) {
        setFormError(problem);
        return;
      }
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
      // Only a coupon the server said applies is sent: a stale link must not fail the order.
      ...toCheckoutPayload(values, fields, { item: orderLine, ...(coupon?.valid ? { discountCode: coupon.code } : {}) }),
      ...shippingChoice.payload,
      ...(bundleExtraLines.length > 0 ? { extraItems: bundleExtraLines } : {}),
      ...(bumpOn && bump ? { orderBump: { offerId: bump.offerId } } : {}),
      ...(productBumps.selected.length > 0
        ? { orderBumps: productBumps.selected.map((b) => ({ offerId: b.offerId })) }
        : {}),
      ...(checkoutSessionId ? { checkoutSessionId } : {}),
    };
    try {
      if (method.method !== "cod" && !transferMethod) {
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
        // A transfer rides along: the whole order ("bank_transfer"), or a COD deposit.
        payload: (needsTransfer && transfer
          ? { ...payload, ...(transferMethod ? { paymentMethod: "bank_transfer" } : {}), transfer: transfer.state.details }
          : payload) as CheckoutPayload,
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
        productBumps.reset();
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
      for (const line of bundleExtraLines) await cart.addItem(line.variantId, undefined, line.quantity);
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
        <h1 className="zt-pdp-title text-2xl font-bold leading-tight text-ink sm:text-3xl">{product.name}</h1>
        <div className={`zt-pdp-price mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1${testPending ? " invisible" : ""}`}>
          <span className="text-3xl font-bold text-ink" data-sale={compareAtUnit ? "" : undefined}>{money(unit)}</span>
          <ConvertedPrice amountMinor={unit} currency={store?.currency ?? "EGP"} className="basis-full order-last" />
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
        <p className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${available ? "text-success" : choosing ? "text-ink-soft" : "text-danger"}`}>
          {available && <CheckIcon size={16} />}
          {available
            ? t.common.inStock
            : choosing
              ? t.shop.chooseOptions
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

      {bundleChoice && <BundlePicker selection={bundleChoice} product={product} mainVariant={variant} />}

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

      {tiers.length === 0 && !bundleChoice && !ps.hide_quantity_selector && (
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
        {bundleChoice && custom.fields.length === 0 ? (
          <BundleAddToCartButton selection={bundleChoice} disabled={!available || !bundleChoice.available} />
        ) : (
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
        )}
      </div>

      <p role="alert" className="text-sm font-medium text-danger empty:hidden">{buyError}</p>

      {ps.inline_checkout && !ps.checkout_before_description && description ? (
        <div className="whitespace-pre-line rounded-2xl border border-line bg-paper-raised p-5 text-base leading-relaxed text-ink-soft sm:p-6">
          {description}
        </div>
      ) : null}

      {ps.inline_checkout && <CodeSlot name="above_form" />}

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

        <form onSubmit={handleSubmit} onFocusCapture={onFormStart} noValidate className="mt-5 space-y-5">
          <OrderFormFields
            idPrefix={FORM_PREFIX}
            values={values}
            errors={errors}
            onChange={onFieldChange}
            fields={fields}
          />
          <ShippingOptionPicker choice={shippingChoice} idPrefix={FORM_PREFIX} />

          <dl className="space-y-2 rounded-xl bg-paper p-4 text-sm ">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">
                {product.name} × {bundleChoice ? bundleChoice.quantity : tier ? tier.quantity : quantity}
              </dt>
              <dd className="shrink-0 text-ink">{money(pricing.full)}</dd>
            </div>
            {fieldsExtra > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">{t.custom.extras}</dt>
                <dd className="shrink-0 text-ink">{money(fieldsExtra)}</dd>
              </div>
            )}
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
            {productBumps.selected.map((b) => (
              <div key={b.offerId} className="flex justify-between gap-3">
                <dt className="text-ink-soft">{b.name}</dt>
                <dd className="shrink-0 text-ink">{money(b.priceAmount)}</dd>
              </div>
            ))}
            <DiscountRows extras={shipping.extras} coupon={coupon} />
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

          <MinimumOrderNotice extras={shipping.extras} />

          {bump && <OrderBumpCard bump={bump} checked={bumpOn} onChange={setBumpOn} idPrefix={FORM_PREFIX} />}
          <ProductBumpCards state={productBumps} idPrefix={FORM_PREFIX} />

          {payment.methods.length > 1 && (
            <PaymentMethodPicker
              methods={payment.methods}
              value={method.id}
              onChange={setMethodId}
              idPrefix={FORM_PREFIX}
            />
          )}
          {(transferMethod || deposit) && (
            <TransferDetails
              key={transferMethod ? transferMethod.id : "deposit"}
              client={client}
              workspaceId={workspaceId}
              methods={transferMethod ? [transferMethod] : deposit!.methods}
              deposit={transferMethod ? undefined : (deposit!.amountType ?? "shipping")}
              amountLabel={
                transferMethod
                  ? money(total)
                  : deposit!.amountType === "fixed"
                    ? money(deposit!.fixedAmount ?? 0)
                    : shipping.amount > 0
                      ? money(shipping.amount)
                      : null
              }
              idPrefix={FORM_PREFIX}
              onChange={(m, state) => setTransfer({ method: m, state })}
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
                : `${method.method === "cod" || transferMethod ? t.form.submit : t.payment.payNow} — ${money(total)}`}
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
      {ps.inline_checkout && <CodeSlot name="below_form" />}

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

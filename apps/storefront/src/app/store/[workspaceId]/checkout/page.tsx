"use client";

import { DiscountRows, MinimumOrderNotice, clearStoredCoupon, useCouponPreview, useStoredCoupon } from "@/components/offers/CouponBits";
import { takeRecoveryPrefill } from "@/lib/recoveryPrefill";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { CheckoutProgress, type CheckoutStep } from "@/components/checkout/CheckoutProgress";
import { OrderBumpCard } from "@/components/checkout/OrderBumpCard";
import { OrderFormFields, fieldId, hasFieldGroups } from "@/components/checkout/OrderFormFields";
import { createOrderFormDrafts } from "@/components/checkout/formDrafts";
import { CheckoutAutosave, type AutosaveHandle } from "@/components/checkout/CheckoutAutosave";
import { CheckoutSummaryFold } from "@/components/checkout/CheckoutSummaryFold";
import { FlashOnChange, busyProps, useHeldWhile } from "@/components/checkout/LiveAmount";
import { useSteadyFocus } from "@/components/checkout/useSteadyFocus";
import { CHECKOUT_TEXT } from "@/components/checkout/checkoutText";
import { BillingAddressFields, billingFieldId, useBillingAddress } from "@/components/checkout/BillingAddressFields";
import { PaymentMethodPicker } from "@/components/checkout/PaymentMethodPicker";
import { ExpressCheckout } from "@/components/checkout/ExpressCheckout";
import { hasPlan, usePlanMethods } from "@/components/product/BillingPlan";
import {
  TransferDetails,
  asTransferMethod,
  transferProblem,
  useTransferCopy,
  type TransferState,
} from "@/components/checkout/TransferDetails";
import { purchaseLimitProblems, type CheckoutPayload, type ManualTransferStoreMethod, type StorefrontQuoteExtras } from "@store-builder/api-client";
import { FreeShippingHint, ShippingFee } from "@/components/checkout/ShippingFee";
import { ArrowIcon } from "@/components/Icons";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimaryLg, btnSecondary, card, container, focusRing, input, skeleton } from "@/components/ui";
import { pickText } from "@/lib/i18n";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useCart } from "@/lib/CartProvider";
import { orderBumpOf } from "@/lib/commerce";
import {
  FIELD_ORDER,
  formOptionsOf,
  toCheckoutPayload,
  validateOrderForm,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormValues,
} from "@/lib/orderForm";
import {
  afterOrder,
  isDiscountRefused,
  isOrderBumpRefused,
  isPlaceRefused,
  orderErrorMessage,
  placeCodOrder,
  serverFieldErrors,
} from "@/lib/placeOrder";
import { placeOnlineOrder, usePaymentMethods } from "@/lib/payments";
import { variantLabel } from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { getVisitorId } from "@/lib/visitorId";
import { track } from "@/lib/track";
import { contentIdOf } from "@/lib/contentId";
import { useCatalog } from "@/lib/useCatalog";
import { CrossSellStrip, ProductBumpCards } from "@/components/offers/StoreOffers";
import { useCartBumps } from "@/components/offers/CartBumps";
import { useShippingQuote, type ShippingLine } from "@/lib/useShippingQuote";
import { useShippingChoice } from "@/lib/shippingChoice";
import { ShippingOptionPicker } from "@/components/ShippingOptionPicker";
import { useShipTo } from "@/lib/shipTo";
import { shareStoreMeta, useFreshCheckoutSettings, useOrderFormFields } from "@/lib/useOrderFormFields";
import { emptyOrderFormFor, useStoreCountry } from "@/lib/storeCountry";
import { LineCustomizations } from "@/components/LineCustomizations";
import { PolicyLinks } from "@/components/PolicyLinks";
import { CodeSlot } from "@/components/CustomCode";
import { useStorePlaces } from "@/lib/useStorePlaces";
import { CheckoutStickyBar, scrollIntoViewSoon } from "@/components/checkout/CheckoutStickyBar";
import { CheckoutSavedAddresses } from "@/components/account/CheckoutSavedAddresses";
import { GiftCardField, useGiftCard } from "@/components/giftCards/GiftCardField";
import { CheckoutTenders, useCheckoutTenders } from "@/components/tenders/CheckoutTenders";
import { CheckoutPerks, useCheckoutPerks } from "@/components/rewards/CheckoutPerks";
// A signed-in business shopper (handoff 228, 229): «ادفع آجل» among the payment methods, and the «معفى» tax line.
import { OnAccountWholeOrderNote, TaxExemptRow, useBusinessCheckout } from "@/components/business/BusinessCheckout";
import { LimitLineNote, useLimitNotes } from "@/components/checkout/LimitLineNote";
import { DeliveryEstimateLine } from "@/components/DeliveryEstimateLine";
import { SupplierMinimumNotice, useSupplierMinimum } from "@/components/checkout/SupplierMinimum";
import { CartFreeGifts } from "@/components/gifts/CartFreeGifts";
import { CartBoxSavings } from "@/components/gifts/CartBoxSavings";
import { GiftOptionsField, GiftWrapRow, useGiftChoice } from "@/components/gifts/GiftOptionsField";
// The delivery day and time slot (handoff 221), pick up in store (225) and a store on holiday (216).
import { DeliverySlotPicker, useDeliverySlot } from "@/components/delivery/DeliverySlotPicker";
import { PickupChoice, usePickupChoice } from "@/components/pickup/PickupChoice";
import { HolidayNote } from "@/components/holiday/HolidayNote";
import { useHolidayCheckout } from "@/lib/storeHoliday";
// The marketing and terms boxes (handoff 374), the deposit a checkout asks for (362), free-shipping and buy-X-get-Y codes (353).
import { CheckoutConsentBoxes, consentTermsId, useCheckoutConsent } from "@/components/checkout/CheckoutConsent";
import { useCheckoutDeposit } from "@/components/checkout/useCheckoutDeposit";
import { CouponCodeNote, couponFreeShippingLabel, couponShortOfUnits } from "@/components/checkout/CouponNotes";

const FORM_PREFIX = "checkout";
const FORM_ERROR_ID = `${FORM_PREFIX}-form-error`;
const SUMMARY_ID = `${FORM_PREFIX}-summary`;

/** A coupon is shown on a line of its own, from the server's preview: no quote extras ride with it. */
const NO_EXTRAS: StorefrontQuoteExtras = { automaticDiscount: null, minimumOrder: null, bundleDiscountAmount: 0 };

const sameLine = (a: ShippingLine, b: ShippingLine) =>
  a.kind === b.kind && (a.kind !== "amount" || (b.kind === "amount" && a.amount === b.amount));
const isPrice = (line: ShippingLine) => line.kind === "amount" || line.kind === "free";
const samePay = (a: { totalLabel: string; total: string }, b: { totalLabel: string; total: string }) =>
  a.totalLabel === b.totalLabel && a.total === b.total;

/** Which fields make up each step of the progress indicator. */
const CONTACT_FIELDS: OrderFormField[] = ["fullName", "phone", "altPhone", "email"];
const ADDRESS_FIELDS: OrderFormField[] = FIELD_ORDER.filter((f) => !CONTACT_FIELDS.includes(f) && f !== "notes");

export default function CheckoutPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const basePath = useStoreBasePath();
  const { cart, clearCart, isLoading } = useCart();
  const { t, money, store, locale, intlLocale } = useStore();
  const text = pickText(CHECKOUT_TEXT, locale);
  // In the page's language, so the API words its errors for this shopper (U-03).
  // One read of the store serves the form settings, the holiday and the gift options (lib/useOrderFormFields shareStoreMeta).
  const client = useMemo(() => shareStoreMeta(createStorefrontApiClient({ locale })), [locale]);
  const { fields: storeFields, reveal } = useOrderFormFields(useFreshCheckoutSettings(client, workspaceId));
  // «توصيل» or «استلام من الفرع» (handoff 225): the places are asked for the cart's variants, and a pickup's form has no address fields.
  const pickup = usePickupChoice({ client, workspaceId, variantIds: (cart?.items ?? []).map((line) => line.variantId), fields: storeFields });
  const fields = pickup.fields;
  // The delivery day and time slot (handoff 221), and a store on holiday (216).
  const deliverySlot = useDeliverySlot({ client, workspaceId, pickup: pickup.isPickup });
  const holiday = useHolidayCheckout({ client, workspaceId });
  const consent = useCheckoutConsent({ client, workspaceId });
  const billing = useBillingAddress(fields);
  const { byVariant } = useCatalog(workspaceId);

  // The form starts on the store's country (dashboard → General → Country).
  const storeCountry = useStoreCountry();
  const [values, setValues] = useState<OrderFormValues>(() => emptyOrderFormFor(storeCountry));
  // What is being typed stays in its field and reaches `values` after a pause or on leaving the field
  // (components/checkout/formDrafts): a keystroke redraws one field, not this page.
  const [drafts] = useState(() => createOrderFormDrafts());
  const [errors, setErrors] = useState<OrderFormErrors>({});
  useEffect(
    () =>
      drafts.connect((typed) => {
        const typedFields = Object.keys(typed) as OrderFormField[];
        setValues((prev) => {
          let next = prev;
          for (const field of typedFields) {
            const value = typed[field];
            if (value !== undefined && next[field] !== value) next = { ...next, [field]: value };
          }
          return next;
        });
        // As a change always did: the form's own error for a field goes once the field is edited.
        setErrors((prev) => {
          let next = prev;
          for (const field of typedFields) if (next[field]) next = { ...next, [field]: undefined };
          return next;
        });
      }),
    [drafts]
  );
  useEffect(() => {
    drafts.settle(values);
  }, [drafts, values]);
  // For code that reads the form later than this render (the saved addresses, once the account answers).
  const liveValues = useMemo(() => drafts.live(values), [drafts, values]);
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
  const [formError, setFormError] = useState<string | null>(null);
  // Where the shopper goes to fix it: the phone's alert above the order bar takes them there.
  const [errorAt, setErrorAt] = useState<{ target: string; kind: "fields" | "other" }>({ target: FORM_ERROR_ID, kind: "other" });
  const [alertOff, setAlertOff] = useState(false);
  // Phones: the summary is a strip at the top that opens in place (components/checkout/CheckoutSummaryFold).
  const [summaryOpen, setSummaryOpen] = useState(false);
  const summaryBody = useRef<HTMLDivElement>(null);
  const fieldsColumn = useRef<HTMLDivElement>(null);
  useSteadyFocus(fieldsColumn);
  const [submitting, setSubmitting] = useState(false);
  // The page's own order button: the phone's bottom bar steps aside while it is on screen.
  const submitRef = useRef<HTMLButtonElement>(null);
  const [codeInput, setCodeInput] = useState("");
  // The server refused the code: said beside it (and in the banner).
  const [codeError, setCodeError] = useState<string | null>(null);
  const [appliedCode, setAppliedCode] = useState("");
  // A coupon that came with the link (?coupon=CODE) is applied without typing it.
  const linkCoupon = useStoredCoupon(workspaceId);
  useEffect(() => {
    if (linkCoupon) setAppliedCode((current) => current || linkCoupon);
  }, [linkCoupon]);
  const [bumpOn, setBumpOn] = useState(false);
  // Refused by the server since this page loaded (sold out, withdrawn): hidden.
  const [bumpGone, setBumpGone] = useState(false);
  const storeMethods = usePaymentMethods(client, workspaceId, undefined, cart?.currency);
  // A product on a plan in the cart is paid by a card that can be saved (product/BillingPlan).
  const planned = hasPlan((cart?.items ?? []).map((line) => byVariant.get(line.variantId)));
  const payment = { ...storeMethods, ...usePlanMethods(storeMethods.methods, planned) };
  // What the store set for the signed-in shopper: «ادفع آجل» joins the methods for an approved one (never with a plan in the cart).
  const business = useBusinessCheckout({ methods: payment.methods, phone: values.phone, blocked: planned });
  const [methodId, setMethodId] = useState<string | null>(null);
  const method = business.methods.find((m) => m.id === methodId) ?? business.methods[0];
  const [redirecting, setRedirecting] = useState(false);
  // Manual transfer: the whole order, or the deposit a cash-on-delivery order needs.
  const transferCopy = useTransferCopy();
  const transferMethod = asTransferMethod(method);
  // Asked once when cash on delivery is picked and again after the code step; a checkout that answers DEPOSIT_REQUIRED opens the box (handoff 362).
  const depositRule = useCheckoutDeposit(client, workspaceId, values.phone, method?.method === "cod", payment.methods);
  const deposit = depositRule.quote;
  const [transfer, setTransfer] = useState<{ method: ManualTransferStoreMethod; state: TransferState } | null>(null);
  const needsTransfer = Boolean(transferMethod || deposit);

  // The store's own places: region → city → area pickers, priced by the picked place (handoff 163/164).
  const places = useStorePlaces({
    client,
    workspaceId,
    country: values.country,
    fields,
    governorate: values.governorate,
    city: values.city,
    onChange: onFieldChange,
  });

  const currency = cart?.currency ?? "EGP";
  const items = useMemo(() => cart?.items ?? [], [cart]);
  const limitNotes = useLimitNotes(cart);
  // The abandoned-checkout autosave listens to the typing itself, from a component of its own (CheckoutAutosave).
  const autosave = useRef<AutosaveHandle>(null);
  // The cart is still being read: the summary waits rather than saying "empty".
  const loadingCart = isLoading && !cart;

  // InitiateCheckout once per visit to this page, the first time the cart is
  // known to hold something (the cart loads after mount, so not on render 1).
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || !cart || cart.items.length === 0) return;
    checkoutTracked.current = true;
    track("InitiateCheckout", {
      contentIds: cart.items.map((line) => contentIdOf(line.variant) ?? line.variantId),
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

  // The cart products' own add-ons (Offers → Order bumps), the store-wide one left to `bump` (CartBumps.tsx).
  const cartBumps = useCartBumps(client, workspaceId, items.map((l) => byVariant.get(l.variantId)?.id).filter(Boolean) as string[], store?.orderBump?.offerId);
  // A ticked bump is not a cart line: the server adds it to the order.
  const bumpInTotals = (bumpOn && bump ? bump.priceAmount : 0) + cartBumps.selected.reduce((sum, b) => sum + b.priceAmount, 0);
  const subtotal = cart?.subtotal ?? 0;
  // Gift wrap and message (handoff 214): a chosen wrap rides the quote and the estimate like a ticked bump.
  const gift = useGiftChoice({ client, workspaceId });
  // The bump counts toward the parcel's weight as soon as it's ticked.
  const quoteLines = items.map((l) => ({ variantId: l.variantId, offerId: l.offerId, quantity: l.quantity }));
  if (bumpOn && bump) quoteLines.push({ variantId: bump.variantId, offerId: bump.offerId, quantity: 1 });
  for (const b of cartBumps.selected) quoteLines.push({ variantId: b.variantId, offerId: b.offerId, quantity: 1 });
  const orderLines = quoteLines.map((l) => ({ variantId: l.variantId, ...(l.offerId ? { offerId: l.offerId } : {}), quantity: l.quantity }));
  if (gift.quoteLine) quoteLines.push(gift.quoteLine);
  // The shopper's shipping option, when the store offers more than one (shippingChoice.ts).
  const shippingChoice = useShippingChoice(
    useShippingQuote({ client, workspaceId, governorate: values.governorate, country: values.country, lines: quoteLines, place: places.address })
  );
  const shipping = shippingChoice.state;
  // A dropshipping supplier's minimum the cart does not reach yet: said in the summary, and the order waits for it (handoff 263).
  const supplierMinimum = useSupplierMinimum(shipping.supplierMinimum, currency);
  // With no code typed, the store's automatic discount comes off (the code's own amount is settled by the server).
  const automaticOff = appliedCode ? 0 : (shipping.extras.automaticDiscount?.amount ?? 0);
  // What the code takes off, asked of the server like the product page's form does (POST /coupon-preview).
  // Shown only: the code is still sent with the order as it always was, and the server settles it.
  const formOptions = formOptionsOf(fields);
  const coupon = useCouponPreview(client, workspaceId, formOptions.allow_discount_codes ? appliedCode : "", orderLines);
  // A free-shipping code: the server says the order ships free, so the summary does too (handoff 353).
  const freeByCode = couponFreeShippingLabel(coupon, locale);
  // An order picked up in store pays no shipping (the API charges none).
  const total = subtotal + bumpInTotals + gift.wrapAmount + (pickup.isPickup || freeByCode ? 0 : shipping.amount) - automaticOff;
  // An order on account goes wholly on the account: the card, the points and the credit stand down while it is chosen.
  const tenderMethod = business.tenderMethod(method);
  const giftCard = useGiftCard({ client, workspaceId, method: tenderMethod, total, currency });
  // A signed-in shopper's loyalty points and store credit, and what they and the card leave to pay (handoff 203, 204).
  const tenders = useCheckoutTenders({ workspaceId, method: tenderMethod, total, currency, giftCard });
  // The signed-in shopper's VIP level and a friend's invite kept from a `?ref=` link: what they take off, said before the order (handoff 218, 222).
  const perks = useCheckoutPerks();

  const couponProblem = codeError ?? (coupon && !coupon.valid ? (couponShortOfUnits(coupon, locale) ?? text.couponInvalid(appliedCode)) : null);

  // --- what is shown while a new quote is on its way --------------------------
  // The last shipping price and total stay on screen, dimmed, until the next answer; nothing is worked out here.
  const quoting = !pickup.isPickup && shipping.line.kind === "calculating";
  const settledLine = useHeldWhile(shipping.line, quoting, sameLine);
  const shownLine = settledLine.held && isPrice(settledLine.value) ? settledLine.value : shipping.line;
  const totalText = money(total, currency);
  const shownTotal = useHeldWhile(totalText, quoting).value;
  // The strip at the top and the bar at the bottom read this one object, so they always say the same.
  const pay = useHeldWhile({ totalLabel: t.checkout.totalEstimate, total: totalText, ...giftCard.stickyBar, ...tenders.stickyBar }, quoting, samePay).value;
  const pieces = items.reduce((sum, line) => sum + line.quantity, 0);

  // --- progress ------------------------------------------------------------
  // Contact → Address → Confirm above the form, from the same validation the
  // submit runs (with this store's field settings): a step is done once none
  // of its fields has an error. Display only; the form is still one page.
  const placePicks = useMemo(
    () => ({ active: places.active, regionId: places.regionId, cityId: places.cityId, hasCities: places.hasCities }),
    [places.active, places.regionId, places.cityId, places.hasCities]
  );
  const liveErrors = useMemo(
    () => validateOrderForm(values, t, fields, { showAltPhone: true, places: placePicks }),
    [values, t, fields, placePicks]
  );
  const grouped = hasFieldGroups(fields, { showAltPhone: true });
  const contactDone = CONTACT_FIELDS.every((f) => !liveErrors[f]);
  const addressDone = ADDRESS_FIELDS.every((f) => !liveErrors[f]);
  const progressDone: CheckoutStep[] = [
    ...(contactDone ? (["contact"] as const) : []),
    ...(addressDone ? (["address"] as const) : []),
  ];
  const progressCurrent: CheckoutStep = !contactDone ? "contact" : !addressDone ? "address" : "confirm";

  // A pick, a saved address, the address search — and every control that is not typed in.
  function onFieldChange(field: OrderFormField, value: string) {
    // Whatever was being typed in that field gives way to it.
    drafts.override(field, value);
    setValues((prev) => (prev[field] === value ? prev : { ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    if (field === "governorate") setShipTo(value);
  }

  /** The order's error line, and where the shopper goes to fix it. */
  function fail(message: string, target: string = FORM_ERROR_ID, kind: "fields" | "other" = "other") {
    setFormError(message);
    setErrorAt({ target, kind });
  }

  /** The phone alert's tap: to the first problem — a field takes the focus, anything else scrolls into view. */
  function showProblem() {
    const stillWrong = FIELD_ORDER.find((k) => errors[k] || liveErrors[k]);
    const target = errorAt.kind === "fields" && stillWrong ? fieldId(FORM_PREFIX, stillWrong) : errorAt.target;
    const el = document.getElementById(target);
    // Something inside the folded summary (the code, the points): it opens first.
    if (el && summaryBody.current?.contains(el) && !summaryOpen) flushSync(() => setSummaryOpen(true));
    if (el && el.matches("input, select, textarea")) el.focus();
    else scrollIntoViewSoon(el ? target : FORM_ERROR_ID);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // What is still being typed counts: the check and the order read the fields as the shopper sees them,
    // and the page's own values follow in the same pass.
    const now = drafts.merge(values);
    drafts.flush();
    setAlertOff(false);

    const found = validateOrderForm(now, t, fields, { showAltPhone: true, places });
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    const billingInvalid = billing.check();
    if (invalid.length > 0 || billingInvalid.length > 0) {
      const first = invalid.length > 0 ? fieldId(FORM_PREFIX, invalid[0]) : billingFieldId(FORM_PREFIX, billingInvalid[0]);
      fail(t.form.errors.summary(invalid.length + billingInvalid.length), first, "fields");
      document.getElementById(first)?.focus();
      return;
    }
    if (!cart || items.length === 0) {
      fail(t.form.errors.emptyCart);
      scrollIntoViewSoon(FORM_ERROR_ID);
      return;
    }
    // Below a supplier's minimum: the page's own button is off; the phone bar's tap lands here and is told why.
    if (supplierMinimum.message) {
      fail(supplierMinimum.message);
      scrollIntoViewSoon(FORM_ERROR_ID);
      return;
    }

    if (needsTransfer) {
      const problem = transfer ? transferProblem(transfer.method, transfer.state, transferCopy) : transferCopy.needReceipt;
      if (problem) {
        fail(problem);
        scrollIntoViewSoon(FORM_ERROR_ID);
        return;
      }
    }

    // Points typed under the minimum or over the balance: said beside the field (which takes focus), before anything is sent.
    const pointsProblem = tenders.check();
    if (pointsProblem) {
      // On a phone the points live in the folded summary: it opens, and the field is asked to take the focus again.
      if (!summaryOpen) {
        flushSync(() => setSummaryOpen(true));
        tenders.check();
      }
      fail(pointsProblem, `${SUMMARY_ID}-title`);
      return;
    }
    // Pickup chosen without a place, or a required delivery day and time not chosen yet: said beside the choice (which takes focus), before anything is sent.
    const pickupMissing = pickup.check();
    const fulfilmentMissing = pickupMissing ?? deliverySlot.check();
    if (fulfilmentMissing) {
      fail(fulfilmentMissing, pickupMissing ? pickup.anchorId : deliverySlot.anchorId);
      return;
    }

    // The terms box, when the store requires it (handoff 374): said under the box, which takes the focus.
    const termsMissing = consent.check(FORM_PREFIX);
    if (termsMissing) {
      fail(termsMissing, consentTermsId(FORM_PREFIX));
      return;
    }

    const systemNotes: string[] = [];

    setSubmitting(true);
    setFormError(null);
    setCodeError(null);
    const checkoutSessionId = await autosave.current?.stop();
    try {
      const payload = {
        ...toCheckoutPayload(now, fields, { discountCode: appliedCode, systemNotes, showAltPhone: true, place: places.address }),
        ...billing.payload(),
        ...shippingChoice.payload,
        // `deliverySlot: { date, slotId }`, and `pickupLocationId` in place of the address (the API drops any address sent with it).
        ...deliverySlot.payload,
        ...pickup.payload,
        ...giftCard.payload,
        ...tenders.payload,
        ...perks.payload,
        ...gift.payload,
        // `acceptsMarketing` / `acceptsTerms`, for the boxes the store shows.
        ...consent.payload,
        ...(bumpOn && bump ? { orderBump: { offerId: bump.offerId } } : {}),
        ...(cartBumps.selected.length > 0 ? { orderBumps: cartBumps.selected.map((b) => ({ offerId: b.offerId })) } : {}),
        ...(checkoutSessionId ? { checkoutSessionId } : {}),
      };
      // «ادفع آجل» is placed like cash on delivery (one request, no gateway), with its own payment method.
      if (method.method !== "cod" && !transferMethod && !business.chosen(method)) {
        const { result, next, external } = await placeOnlineOrder({
          client,
          workspaceId,
          basePath,
          payload,
          method,
          cartToken: cart.guestToken,
          visitorId: getVisitorId(workspaceId),
          shopperToken: tenders.shopperToken,
        });
        tenders.remember(result, true);
        perks.onPlaced();
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
          : { ...payload, ...business.payload(method) }) as CheckoutPayload,
        cartToken: cart.guestToken,
        visitorId: getVisitorId(workspaceId),
        // What the gift card, the points and the credit paid, kept for the thank-you page.
        tenders: { shopperToken: tenders.shopperToken, onResult: (result) => tenders.remember(result, false) },
      });
      perks.onPlaced();
      clearCart();
      router.push(afterOrder({ workspaceId, basePath, order, phone: payload.contact.phone }));
    } catch (err) {
      const giftCardProblem = giftCard.onError(err);
      const tenderProblem = tenders.onError(err);
      const perkProblem = perks.onError(err);
      // A refused delivery slot or pickup place is read again; a store that went on holiday turns the page to "paused" (handoff 221, 225, 216).
      const fulfilmentProblem = deliverySlot.onError(err) ?? pickup.onError(err) ?? holiday.onError(err);
      const businessProblem = business.onError(err, method);
      limitNotes.capture(err);
      if (isOrderBumpRefused(err)) {
        // The totals drop the add-on with it; the shopper confirms again.
        setBumpOn(false);
        setBumpGone(true);
        cartBumps.reset();
      }
      // A place hidden or dropped since the list was read: read it again, so the pickers offer what is left.
      if (isPlaceRefused(err)) places.reload();
      if (isDiscountRefused(err)) setCodeError(orderErrorMessage(err, t.form.errors, locale));
      // Said inside the summary too (beside the code, the card, the points, the line): on a phone it opens.
      if (isDiscountRefused(err) || giftCardProblem || tenderProblem || perkProblem || purchaseLimitProblems(err).length > 0) setSummaryOpen(true);
      const fromServer = serverFieldErrors(err, t.form.errors);
      const invalid = FIELD_ORDER.filter((k) => fromServer[k]);
      // A billing field the server named opens the billing block.
      const billingInvalid = flushSync(() => billing.showServerErrors(err));
      if (invalid.length > 0 || billingInvalid.length > 0) {
        // Commit first: a field the server named may be one this form was
        // hiding, and it has to exist before it can take focus.
        flushSync(() => {
          reveal(fromServer);
          setErrors(fromServer);
          fail(
            t.form.errors.summary(invalid.length + billingInvalid.length),
            invalid.length > 0 ? fieldId(FORM_PREFIX, invalid[0]) : billingFieldId(FORM_PREFIX, billingInvalid[0]),
            "fields"
          );
          setSubmitting(false);
        });
        document.getElementById(invalid.length > 0 ? fieldId(FORM_PREFIX, invalid[0]) : billingFieldId(FORM_PREFIX, billingInvalid[0]))?.focus();
      } else {
        // Committed first, so the message is on the page before it is scrolled to.
        flushSync(() => {
          fail(orderErrorMessage(err, t.form.errors, locale));
          setSubmitting(false);
        });
        scrollIntoViewSoon(FORM_ERROR_ID);
      }
      if (giftCardProblem) setFormError(giftCardProblem);
      if (tenderProblem) setFormError(tenderProblem);
      if (perkProblem) setFormError(perkProblem);
      if (fulfilmentProblem) setFormError(fulfilmentProblem);
      if (businessProblem) setFormError(businessProblem);
      const giftChoiceProblem = gift.onError(err);
      if (giftChoiceProblem) setFormError(giftChoiceProblem);
      const supplierProblem = supplierMinimum.onError(err);
      if (supplierProblem) setFormError(supplierProblem);
      const termsProblem = consent.onError(err);
      if (termsProblem) setFormError(termsProblem);
      // DEPOSIT_REQUIRED: the transfer box opens under the payment methods, the form stays filled (handoff 362).
      if (depositRule.onError(err)) scrollIntoViewSoon("payment-title");
      autosave.current?.resume();
    }
  }

  const emptyCart = !loadingCart && items.length === 0 && !submitting;
  const orderLabel = holiday.pausedLabel
    ? holiday.pausedLabel
    : redirecting
      ? t.payment.redirecting
      : submitting
        ? t.checkout.placing
        : null;
  // The phone's alert steps aside once every field it spoke of is fixed (the page's own line stays until the next try).
  const fieldsLeft = FIELD_ORDER.some((k) => errors[k] || liveErrors[k]) || Object.values(billing.errors).some(Boolean);
  const alertShown = formError !== null && !alertOff && (errorAt.kind !== "fields" || fieldsLeft);
  const shippingBusy = busyProps(quoting);

  // The totals, once: the summary's own list and the short one above the phone's order button draw the same rows.
  const totalsRows = (
    <>
      <div className="flex justify-between gap-3">
        <dt className="text-ink-soft">{t.checkout.subtotal}</dt>
        <dd className="text-ink">{money(subtotal, currency)}</dd>
      </div>
      {bumpOn && bump && (
        <div className="flex justify-between gap-3">
          <dt className="text-ink-soft">{bump.name}</dt>
          <dd className="text-ink">{money(bump.priceAmount, currency)}</dd>
        </div>
      )}
      {cartBumps.selected.map((b) => (
        <div key={b.offerId} className="flex justify-between gap-3">
          <dt className="text-ink-soft">{b.name}</dt>
          <dd className="text-ink">{money(b.priceAmount, currency)}</dd>
        </div>
      ))}
      <GiftWrapRow state={gift} currency={currency} />
      {!appliedCode && <DiscountRows extras={shipping.extras} coupon={null} currency={currency} />}
      <div className="flex justify-between gap-3">
        <dt className="text-ink-soft">{t.checkout.shippingFee}</dt>
        <dd className="text-end text-ink">
          {/* «مجانًا» for an order picked up in store. While a new quote is fetched the last price stays, dimmed. */}
          {pickup.freeLabel ?? freeByCode ?? (
            <span aria-busy={shippingBusy["aria-busy"]} className={`inline-block ${shippingBusy.className}`}>
              <FlashOnChange signal={shownLine.kind === "amount" ? `amount:${shownLine.amount}` : shownLine.kind}>
                <ShippingFee line={shownLine} currency={currency} />
              </FlashOnChange>
            </span>
          )}
        </dd>
      </div>
      <TaxExemptRow state={business} />
      <div className="flex justify-between gap-3 border-t border-line pt-3 text-base font-bold text-ink">
        <dt>
          {t.checkout.totalEstimate}
          {coupon?.valid && coupon.amount > 0 && <span className="ms-1 text-xs font-normal text-ink-soft">({text.beforeCoupon})</span>}
        </dt>
        <dd aria-busy={shippingBusy["aria-busy"]} className={shippingBusy.className}>
          <FlashOnChange signal={shownTotal}>{shownTotal}</FlashOnChange>
        </dd>
      </div>
    </>
  );

  // What the shopper should know before the button. Drawn inside the summary from `lg`, above the button on a phone.
  const orderNotes = (
    <>
      {/* A store on holiday: when the order ships, or that orders are paused (handoff 216). */}
      <HolidayNote view={holiday} className="mt-3" />
      {!pickup.isPickup && <DeliveryEstimateLine estimate={shipping.deliveryEstimate} className="mt-3" />}
      <MinimumOrderNotice extras={shipping.extras} currency={currency} className="mt-3" />
      <SupplierMinimumNotice state={supplierMinimum} className="mt-3" />
      {!pickup.isPickup && <FreeShippingHint progress={shipping.freeShipping} line={shipping.line} currency={currency} className="mt-3" />}
      <p className="mt-2 text-xs text-ink-soft">{t.checkout.finalNote}</p>
      <PolicyLinks className="mt-2" />
    </>
  );

  return (
    <main className={`${container} flex-1 py-6 sm:py-10`}>
      <CheckoutAutosave ref={autosave} client={client} workspaceId={workspaceId} values={values} drafts={drafts} lines={items} />
      <StoreLink
        href="/cart"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-ink-soft hover:text-primary"
      >
        <ArrowIcon size={16} className="rotate-180 rtl:rotate-0" />
        {t.checkout.backToCart}
      </StoreLink>
      <h1 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">{t.checkout.title}</h1>

      <div className="mt-5 max-w-xl">
        <CheckoutProgress done={progressDone} current={progressCurrent} />
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[1fr_24rem] lg:gap-8">
        {/* Second on a phone (the summary strip comes first), the main column from `lg`. */}
        <div ref={fieldsColumn} className="order-2 min-w-0 space-y-6 lg:order-none">
          <section className={`${card} p-5 sm:p-6`} aria-labelledby="shipping-title">
            {/* With the form's own headings («بيانات التواصل», «عنوان الشحن») below, this one is for screen readers only. */}
            <h2 id="shipping-title" className={grouped ? "sr-only" : "text-lg font-semibold text-ink"}>
              {t.checkout.shipping}
            </h2>
            <CodeSlot name="above_form" />
            {/* «توصيل» or «استلام من الفرع», with the pickup places; a pickup has no address form below (handoff 225). */}
            <PickupChoice state={pickup} idPrefix={FORM_PREFIX} className={grouped ? "mb-5" : "mt-4"} />
            <div className={grouped ? "" : "mt-4"}>
              <CheckoutSavedAddresses values={liveValues} onChange={onFieldChange} places={places} />
              <OrderFormFields
                idPrefix={FORM_PREFIX}
                values={values}
                errors={errors}
                onChange={onFieldChange}
                fields={fields}
                showAltPhone
                storePlaces={places}
                drafts={drafts}
                groupTitles={{ contact: t.checkout.contact, address: t.checkout.shipping }}
                foldNote
              />
              {!pickup.isPickup && <ShippingOptionPicker choice={shippingChoice} idPrefix={FORM_PREFIX} />}
              <BillingAddressFields idPrefix={FORM_PREFIX} state={billing} />
            </div>
            <CodeSlot name="below_form" />
          </section>

          {/* Day chips, then that day's slot chips, with the store's note (handoff 221). */}
          <DeliverySlotPicker state={deliverySlot} idPrefix={FORM_PREFIX} />

          <GiftOptionsField state={gift} idPrefix={FORM_PREFIX} />

          <section className={`${card} p-5 sm:p-6`} aria-labelledby="payment-title">
            <h2 id="payment-title" className="text-lg font-semibold text-ink">
              {t.checkout.payment}
            </h2>
            {/* The wallets are only known once the methods have loaded: here they arrive below the fields, never above them. */}
            <ExpressCheckout
              frame="inline"
              methods={payment.methods}
              onChoose={setMethodId}
              submitRef={submitRef}
              busy={submitting || items.length === 0 || holiday.paused}
            />
            <PaymentMethodPicker
              plan={planned ? { blocked: payment.blocked } : null}
              methods={business.methods}
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

        {/* One column from `lg`. On a phone its two parts are placed on their own: the summary first, the rest last. */}
        <div className="contents lg:block lg:space-y-4 lg:sticky lg:top-24 lg:self-start">
          <CheckoutSummaryFold
            id={SUMMARY_ID}
            className="order-1 lg:order-none"
            title={t.checkout.summary}
            note={loadingCart || items.length === 0 ? undefined : text.pieces(pieces, new Intl.NumberFormat(intlLocale).format(pieces))}
            totalLabel={pay.totalLabel}
            total={loadingCart ? "…" : pay.total}
            busy={quoting || loadingCart}
            open={summaryOpen || emptyCart}
            onToggle={() => setSummaryOpen((open) => !open)}
            showLabel={text.showDetails}
            hideLabel={text.hideDetails}
            bodyRef={summaryBody}
          >
            {loadingCart ? (
              <div className="mt-4 space-y-3" role="status" aria-busy="true" aria-label={t.cart.loading}>
                {[0, 1].map((i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <span className={`${skeleton} h-4 w-2/3`} />
                    <span className={`${skeleton} h-4 w-14`} />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="mt-3">
                <p className="text-sm text-ink-soft">{t.cart.empty}</p>
                {emptyCart && (
                  <StoreLink href="/products" className={`${btnSecondary} mt-3 w-full`}>
                    {text.browse}
                  </StoreLink>
                )}
              </div>
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
                        <LimitLineNote notes={limitNotes} productId={product?.id} />
                      </span>
                      <span className="shrink-0 font-medium text-ink">{money(line.lineTotal, currency)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {items.length > 0 && <CartFreeGifts cart={cart} progress={false} className="mt-3" />}
            {items.length > 0 && <CartBoxSavings cart={cart} className="mt-3" />}

            {/* Discount code: the server previews what it takes off (POST /coupon-preview) and settles it on the order. */}
            {formOptions.allow_discount_codes && (
              <div className="mt-5 border-t border-line pt-4">
                <label htmlFor="discount-code" className="mb-1.5 block text-sm font-medium text-ink">
                  {t.checkout.discountCode}
                </label>
                {appliedCode ? (
                  <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${couponProblem ? "bg-danger-soft" : "bg-primary-soft"}`}>
                    <div className="min-w-0 flex-1 text-sm" aria-live="polite">
                      {couponProblem ? (
                        <p className="font-medium text-danger">{couponProblem}</p>
                      ) : coupon?.valid ? (
                        <>
                          <dl className="font-medium">
                            <DiscountRows extras={NO_EXTRAS} coupon={coupon} currency={currency} />
                          </dl>
                          <CouponCodeNote coupon={coupon} className="mt-0.5" />
                          <p className="mt-0.5 text-xs text-ink-soft">{text.couponNote}</p>
                        </>
                      ) : (
                        <p className="text-primary">{t.checkout.discountPending(appliedCode)}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCode("");
                        setCodeError(null);
                        clearStoredCoupon(workspaceId);
                      }}
                      className={`min-h-11 shrink-0 cursor-pointer rounded-lg px-2 text-sm font-medium text-ink-soft hover:text-danger ${focusRing}`}
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
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="done"
                      dir="ltr"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        // Enter applies the code; it never sends the order from here.
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        if (codeInput.trim()) setAppliedCode(codeInput.trim());
                      }}
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

            <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">{totalsRows}</dl>
            {!business.chosen(method) && <GiftCardField state={giftCard} remainder={false} />}
            {!business.chosen(method) && <CheckoutTenders state={tenders} />}
            <OnAccountWholeOrderNote method={method} />
            <CheckoutPerks state={perks} />
            <div className="hidden lg:block">{orderNotes}</div>
          </CheckoutSummaryFold>

          <div className="order-3 space-y-4 lg:order-none">
            {bump && items.length > 0 && (
              <OrderBumpCard bump={bump} checked={bumpOn} onChange={setBumpOn} idPrefix={FORM_PREFIX} />
            )}
            {items.length > 0 && <ProductBumpCards state={cartBumps} idPrefix={`${FORM_PREFIX}-pb`} />}

            {/* Phones: the totals again, right above the button — the summary itself is the strip at the top of the page. */}
            {items.length > 0 && (
              <section className={`${card} p-5 lg:hidden`} aria-label={t.checkout.total}>
                <dl className="space-y-2 text-sm">{totalsRows}</dl>
                {orderNotes}
                <button
                  type="button"
                  onClick={() => {
                    setSummaryOpen(true);
                    scrollIntoViewSoon(`${SUMMARY_ID}-title`);
                  }}
                  className={`mt-1 inline-flex min-h-11 cursor-pointer items-center rounded-lg text-sm font-medium text-primary underline-offset-4 hover:underline ${focusRing}`}
                >
                  {text.openDetails}
                </button>
              </section>
            )}

            {items.length > 0 && <CheckoutConsentBoxes state={consent} idPrefix={FORM_PREFIX} className={`${card} px-5 py-3`} />}

            <div id={FORM_ERROR_ID} role="alert" aria-live="assertive" className="scroll-mt-24 empty:hidden">
              {formError && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</p>}
            </div>

            <button ref={submitRef} type="submit" disabled={submitting || items.length === 0 || supplierMinimum.blocked || holiday.paused || consent.blocked} className={btnPrimaryLg}>
              {orderLabel ?? (method.method === "cod" || business.chosen(method) ? t.checkout.place : t.payment.payNow)}
            </button>
          </div>
        </div>

        {/* Phones: the total and the order button stay in reach while the form is filled in (U-57). */}
        {items.length > 0 && (
          <CheckoutStickyBar
            anchor={submitRef}
            totalLabel={pay.totalLabel}
            total={pay.total}
            busy={quoting}
            buttonLabel={orderLabel ?? (method.method === "cod" || business.chosen(method) ? t.checkoutBar.order : t.payment.payNow)}
            disabled={submitting || holiday.paused}
            alert={
              alertShown && formError
                ? {
                    message: formError,
                    showLabel: text.showProblem,
                    dismissLabel: t.common.close,
                    onShow: showProblem,
                    onDismiss: () => setAlertOff(true),
                  }
                : null
            }
          />
        )}
      </form>

      {/* What goes with the order (Offers → Cross-sell, at checkout). */}
      {items.length > 0 && (
        <CrossSellStrip
          workspaceId={workspaceId}
          placement="checkout"
          productIds={[...new Set(items.map((line) => byVariant.get(line.variantId)?.id).filter((id): id is string => Boolean(id)))]}
        />
      )}
    </main>
  );
}

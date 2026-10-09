"use client";

import { ConvertedPrice } from "@/components/ConvertedPrice";
import { memo, useEffect, useMemo, useRef, useState, type FormEvent, type RefObject, useCallback } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import {
  optionLabelsOf,
  parseMoney,
  storefrontProductPage,
  type CheckoutSettings,
  type ProductOptionDisplay,
  type ProductOptionLabel,
  type StorefrontProductDetail,
  type StorefrontVariant,
} from "@store-builder/api-client";
import { useCart } from "@/lib/CartProvider";
import { storeHref } from "@/lib/storeHref";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useShippingQuote } from "@/lib/useShippingQuote";
import { useShippingChoice } from "@/lib/shippingChoice";
import { ShippingOptionPicker } from "../ShippingOptionPicker";
import { ShippingFee } from "@/components/checkout/ShippingFee";
import { bundlePricing, bundleTiers, type BundleTier, type OrderBumpOffer } from "@/lib/commerce";
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
  isPlaceRefused,
  type OrderLine,
} from "@/lib/placeOrder";
import { placeOnlineOrder, usePaymentMethods } from "@/lib/payments";
import { PaymentMethodPicker } from "@/components/checkout/PaymentMethodPicker";
import { BillingPlanNote, PlanFormTitle, usePlanMethods } from "@/components/product/BillingPlan";
// A signed-in shopper on this page's own order form: their price list's price (handoff 205), VIP level (218) and a friend's invite (222).
import { YourPrice } from "@/components/rewards/YourPrice";
import { useYourPrice } from "@/components/rewards/shopperPrices";
import { CheckoutPerks, useCheckoutPerks } from "@/components/rewards/CheckoutPerks";
import {
  TransferDetails,
  asTransferMethod,
  transferProblem,
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
  firstImage,
  offerAppliesTo,
  optionGroups,
  variantUnitPrice,
  type ProductOptionGroup,
} from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { getVisitorId } from "@/lib/visitorId";
import { useStoreBasePath } from "../StoreRoute";
import { CodeSlot } from "../CustomCode";
import { CustomFieldInputs, useCustomFieldAnswers, type CustomFieldAnswers } from "./CustomFieldInputs";
import { AddToCartButton } from "../AddToCartButton";
import { WishlistHeart } from "../wishlist/WishlistHeart";
import { BackInStock } from "../stockAlert/BackInStock";
import { QuantityStepper } from "../QuantityStepper";
import { OrderBumpCard } from "../checkout/OrderBumpCard";
import { OrderFormFields, fieldId } from "../checkout/OrderFormFields";
import { useStorePlaces, type PlaceAddress } from "@/lib/useStorePlaces";
import { BillingAddressFields, billingFieldId, useBillingAddress } from "../checkout/BillingAddressFields";
import { CashIcon, CheckIcon } from "../Icons";
import { billingPlanOf, customFieldsDelta, storefrontProductBundle } from "@store-builder/api-client";
import { readPick, usePick } from "@/lib/pagePicks";
import { useProductTest } from "@/lib/productTest";
import { track } from "@/lib/track";
import { contentIdOf } from "@/lib/contentId";
import { emptyOrderFormFor, useStoreCountry } from "@/lib/storeCountry";
import { BundleAddToCartButton, BundlePicker, useBundleSelection } from "./BundlePicker";
import { BoxBuilderEntry } from "../gifts/BoxBuilderEntry";
import { ProductBumpCards, useProductBumps } from "../offers/StoreOffers";
import { DiscountRows, MinimumOrderNotice, discountOff, useCouponPreview, useStoredCoupon } from "../offers/CouponBits";
// The marketing and terms boxes (handoff 374), the deposit a checkout asks for (362), free-shipping and buy-X-get-Y codes (353).
import { CheckoutConsentBoxes, useCheckoutConsent } from "../checkout/CheckoutConsent";
import { useCheckoutDeposit } from "../checkout/useCheckoutDeposit";
import { CouponCodeNote, couponFreeShippingLabel } from "../checkout/CouponNotes";
import { OfferCountdown } from "./OfferCountdown";
import { OptionPicker } from "./OptionPicker";
import { SizeGuideLink } from "./SizeGuide";
import { ProductQuoteRequest } from "../quotes/QuoteRequest";
import { LowestPriceLine } from "./LowestPriceLine";
import { setChosenVariantImage, variantImageOf } from "@/lib/variantImage";
import { productPageText } from "./productPageText";
import { btnPrimary, btnPrimaryLg, card } from "../ui";
import { RichText } from "../RichText";
import { ProductBuyNotes, preorderFor, stepperLimits, takesPreorders } from "./ProductBuyNotes";
// This page's own order form on a store that needs a delivery day and time (handoff 221), and on one that paused its orders (216).
import { DeliverySlotPicker, useDeliverySlot } from "../delivery/DeliverySlotPicker";
import { useHoliday } from "@/lib/storeHoliday";
import { BuyAssurances } from "./BuyAssurances";
import type { BuyPromises } from "./buyPromises";
import type { DeliveryTarget } from "../DeliveryEstimateLine";

const FORM_PREFIX = "quick";

/** No place picked yet: the delivery window is asked for the governorate this device saved, else the store's usual one. */
const NO_PLACE: DeliveryTarget = { governorate: "", place: null };

/**
 * How tall the bar at the bottom of a phone screen is while it shows — the
 * store shell's shared variable (the cart page sets the same one): what floats
 * in the corner reads it and sits above the bar.
 */
const BOTTOM_BAR_VAR = "--sf-bottom-bar-h";

/** An option that reads as the size: the size guide's link sits on its title row. */
const SIZE_NAME = /size|taille|مقاس|قياس/i;

type StoreClient = ReturnType<typeof createStorefrontApiClient>;

/**
 * The buy box of the product page, built as a cash-on-delivery landing:
 * variant pickers → bundle/quantity offer → inline quick order form with an
 * order bump → real COD checkout. "Add to cart" stays as a secondary path.
 *
 * Two things keep it quick under a thumb. The order form's own state lives in
 * `QuickOrderForm` below, so a keystroke in it re-renders the form and not
 * the options, the offers and the buttons above it — and a page whose form
 * is off never asks for what only the form needs (payment methods, deposit,
 * places, shipping quote, product bumps). And everything that is only known
 * once the browser has asked (delivery window, points, the size guide's link,
 * the wishlist heart) lands in a place that was kept for it, or under the
 * buttons: the price, the options and the buttons do not move after the page
 * has arrived.
 */
/**
 * The variant a product feed or ad link names (`?variant=<id>`, backend
 * offers/productFeed.js), read on the client: the page opens on it, and its
 * view is reported with that variant's id — the one the catalog item has.
 */
function linkedVariantOf<V extends { id: string }>(variants: V[]): V | undefined {
  if (typeof window === "undefined") return undefined;
  const id = new URLSearchParams(window.location.search).get("variant");
  return id ? variants.find((v) => v.id === id) : undefined;
}

/**
 * The option pickers. Kept apart and memoised: they are the many-buttons part
 * of the box, and nothing but a pick (or another product) re-renders them.
 */
const VariantOptions = memo(function VariantOptions({
  groups,
  displays,
  labels,
  variants,
  preorders,
  selection,
  onPick,
  workspaceId,
  productId,
}: {
  groups: ProductOptionGroup[];
  displays: ProductOptionDisplay[];
  labels: Record<string, ProductOptionLabel> | null;
  variants: StorefrontVariant[];
  /** Sold-out variants still sell, as pre-orders. */
  preorders: boolean;
  selection: Record<string, string>;
  onPick: (name: string, value: string) => void;
  workspaceId: string;
  productId: string;
}) {
  // «دليل المقاسات» rides on the size option's title row (else the first option's): only known once the chart was asked for, and there it pushes nothing down.
  const sized = groups.findIndex((g) => SIZE_NAME.test(g.name) || SIZE_NAME.test(labels?.[g.name]?.name ?? ""));
  const guideAt = sized >= 0 ? sized : 0;
  return (
    <>
      {groups.map((group, index) => (
        <OptionPicker
          key={group.name}
          group={group}
          display={displays.find((o) => o.name === group.name)}
          labels={labels?.[group.name]}
          selected={selection[group.name]}
          isAvailable={(value) =>
            variants.some(
              (v) =>
                (v.inStock || preorders) &&
                v.optionValues?.[group.name] === value &&
                Object.entries(selection).every(([n, val]) => n === group.name || v.optionValues?.[n] === val)
            )
          }
          onSelect={(value) => onPick(group.name, value)}
          aside={index === guideAt ? <SizeGuideLink workspaceId={workspaceId} productId={productId} placement="corner" /> : undefined}
        />
      ))}
    </>
  );
});

/** The bundle / quantity offer ladder; memoised like the options. */
const OfferLadder = memo(function OfferLadder({
  tiers,
  tierId,
  unit,
  onPick,
}: {
  tiers: BundleTier[];
  tierId: string;
  unit: number;
  onPick: (id: string) => void;
}) {
  const { t, money } = useStore();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink">{t.product.chooseOffer}</legend>
      <div className="grid gap-2">
        {tiers.map((x) => {
          const selected = tierId === x.id;
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
                onChange={() => onPick(x.id)}
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
  );
});

export function ProductLanding({
  workspaceId,
  product: listedProduct,
  bump: bumpOffer,
  description,
  checkoutSettings,
  promises = null,
  phoneToolbar = false,
  countdownRunning = true,
}: {
  workspaceId: string;
  product: StorefrontProductDetail;
  bump: OrderBumpOffer | null;
  /** Shown above the order form when the product puts its description first. */
  description?: string | null;
  /** From this page's own render, not the layout's — see useFreshCheckoutSettings. */
  checkoutSettings: CheckoutSettings;
  /** The store's own shipping / returns / COD cards as short lines (buyPromises); null when its trust badges are off. */
  promises?: BuyPromises | null;
  /** The store's theme draws a toolbar along the bottom of a phone (themeSettings.mobileToolbar): the buy bar sits above it. */
  phoneToolbar?: boolean;
  /** False when the offer's deadline had already passed as the page was rendered: no countdown box is drawn. */
  countdownRunning?: boolean;
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
  const basePath = useStoreBasePath();
  const router = useRouter();
  // The page's language rides on the order form's checkout and autosave (X-Store-Locale, handoff 383).
  const [client] = useState(() => createStorefrontApiClient({ locale }));

  // --- variant selection -------------------------------------------------
  const groups = useMemo(() => optionGroups(product.variants), [product.variants]);
  const optionLabels = useMemo(() => optionLabelsOf(product), [product]);
  const initialVariant = product.variants.find((v) => v.inStock) ?? product.variants[0];
  // Off on the product (page settings) or for the whole store (purchase form → pre-select a variant):
  // the shopper picks every option before buying.
  const autoSelect = page.pageSettings.auto_select_variant !== false && formOptionsOf(checkoutSettings).auto_select_variant !== false;
  const [selection, setSelection] = useState<Record<string, string>>(() =>
    !autoSelect && groups.length > 0 ? {} : { ...(initialVariant?.optionValues ?? {}) }
  );
  const pickOption = useCallback((name: string, value: string) => setSelection((prev) => ({ ...prev, [name]: value })), []);
  // What the shopper picked on this page's variant_selector / bundle_selector (lib/pagePicks), after hydration.
  useEffect(() => {
    const picked = product.variants.find((v) => v.id === readPick("variant", product.id));
    if (picked) setSelection({ ...(picked.optionValues ?? {}) });
    // A feed or ad link names its variant: the shopper lands on the one the ad showed.
    const linked = linkedVariantOf(product.variants);
    if (linked) setSelection({ ...(linked.optionValues ?? {}) });
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
  const missing = !autoSelect ? groups.find((g) => !selection[g.name]) : undefined;
  const choosing = Boolean(missing);
  const variant = groups.length > 0 ? (choosing ? undefined : findVariant(product.variants, selection)) : initialVariant;
  // Sold out but taking pre-orders (handoff 195): still for sale, as a pre-order.
  const preorder = preorderFor(product, variant);
  const available = !!variant?.inStock || !!preorder;
  // What the buy buttons read when the chosen variant cannot be bought (handoff 390); null while it can, or while an option is still to pick.
  const soldOutLabel = !available && !choosing && variant ? t.common.outOfStock : null;
  // The gallery leads with the chosen variant's own picture (lib/variantImage).
  const chosenImage = variantImageOf(variant);
  useEffect(() => {
    setChosenVariantImage(product.id, chosenImage);
  }, [product.id, chosenImage]);

  // --- bundles / quantity --------------------------------------------------
  // A reusable quantity bundle (BundlePicker) takes the place of the offer
  // ladder and the quantity stepper; the server prices it.
  const bundle = useMemo(() => storefrontProductBundle(product), [product]);
  const bundleChoice = useBundleSelection({ client, workspaceId, bundle, product, mainVariant: variant });
  const tiers = useMemo(() => (bundle ? [] : bundleTiers(product)), [bundle, product]);
  const [quantity, setQuantity] = useState(() => stepperLimits(product).min ?? 1);
  const [tierId, setTierId] = useState(
    () => product.offers.find((o) => o.isDefault)?.id ?? tiers[0]?.id ?? ""
  );
  usePick("offer", product.id, useCallback((id: string) => setTierId(id), []));
  const tier = tiers.find((x) => x.id === tierId);
  // The product's custom fields: answered here, sent with the order line.
  const custom = useCustomFieldAnswers(workspaceId, product.id, product.customFields);
  const unit = variantUnitPrice(product, variant);
  // A signed-in shopper's own price for a plain line, from the API (handoff 205): the form's total counts with it. Offers and bundles keep their prices.
  const lineOffer = defaultOfferOf(product);
  const yourVariantId = !bundleChoice && !tier && variant && !(lineOffer && offerAppliesTo(lineOffer, variant.id)) ? variant.id : null;
  const yours = useYourPrice(yourVariantId, quantity);
  const pricing = bundleChoice ? bundleChoice.pricing : bundlePricing(yours.unit ?? unit, quantity, tier);
  const holiday = useHoliday();
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
  // A product on a plan is paid by a card that can be saved (product/BillingPlan).
  const plan = billingPlanOf(product);

  // --- what the order form tells the rest of the box --------------------------
  // Where the form says the order goes (its governorate, or the place picked
  // from the store's own list): the delivery window under the buttons follows it.
  const [shipTo, setShipTo] = useState<DeliveryTarget>(NO_PLACE);
  const onShipTo = useCallback(
    (governorate: string, place: PlaceAddress | null) =>
      setShipTo((prev) => (prev.governorate === governorate && prev.place === place ? prev : { governorate, place })),
    []
  );
  // Whether the form's payment methods hold cash on delivery. They start as
  // "cash on delivery only" (lib/payments), and a product on a plan is paid by card.
  const [formTakesCod, setFormTakesCod] = useState(() => !plan);
  // With the form off its methods are never asked for: the store's own COD card speaks then.
  const codOffered = ps.inline_checkout ? formTakesCod : Boolean(promises?.cod);
  const codLine = promises && codOffered ? (promises.cod ?? { title: t.trust.cod, point: null }) : null;

  // The product's view, for the store's pixels and analytics (SPEC §13.2), once
  // per page view; ids as the product feed gives them (lib/contentId).
  const viewTracked = useRef<string | null>(null);
  useEffect(() => {
    if (viewTracked.current === product.id) return;
    // A tick later, and marked sent only once it is (an effect can run twice before it sticks).
    const timer = window.setTimeout(() => {
      viewTracked.current = product.id;
      track("ViewContent", {
        contentIds: [contentIdOf(linkedVariantOf(product.variants) ?? variant ?? initialVariant) ?? product.id],
        contentName: product.name,
        valueMinor: unit,
        currency: store?.currency,
      });
    });
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  // --- sticky mobile bar ---------------------------------------------------
  // With the order form on the page, the bar steps aside while the form is in
  // view; without it, while the page's own buy buttons are.
  const formRef = useRef<HTMLElement>(null);
  const buyRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [buttonsVisible, setButtonsVisible] = useState(false);
  const inlineForm = ps.inline_checkout;
  const stickyBar = ps.sticky_buy_button;
  useEffect(() => {
    const el = formRef.current;
    if (!inlineForm || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [inlineForm]);
  useEffect(() => {
    const el = buyRef.current;
    if (inlineForm || !stickyBar || !el || typeof IntersectionObserver === "undefined") return;
    // Buttons under the theme's toolbar are not on screen yet.
    const io = new IntersectionObserver(([entry]) => setButtonsVisible(entry.isIntersecting), {
      threshold: 0.5,
      rootMargin: phoneToolbar ? "0px 0px -56px 0px" : "0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [inlineForm, stickyBar, phoneToolbar]);
  const barHidden = inlineForm ? formVisible : buttonsVisible;
  // While the bar shows, the shell knows how tall it is.
  useEffect(() => {
    const el = barRef.current;
    if (!stickyBar || barHidden || !el) return;
    const wrapper = el.closest<HTMLElement>(".brand-theme");
    const targets = wrapper ? [document.documentElement, wrapper] : [document.documentElement];
    const apply = () => {
      // 0 from `md` up, where the bar is not drawn.
      const height = `${el.offsetHeight}px`;
      for (const target of targets) target.style.setProperty(BOTTOM_BAR_VAR, height);
    };
    apply();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      for (const target of targets) target.style.removeProperty(BOTTOM_BAR_VAR);
    };
  }, [stickyBar, barHidden]);
  // Above the theme's own toolbar (55px, components/shell/ThemeChrome) when the
  // store has one: there the bar fades instead of sliding down over it.
  const barPlace = phoneToolbar
    ? "bottom-[calc(55px+env(safe-area-inset-bottom,0px))] pb-3"
    : "bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]";
  const barMotion = phoneToolbar
    ? barHidden
      ? "pointer-events-none translate-y-3 opacity-0"
      : "translate-y-0 opacity-100"
    : barHidden
      ? "translate-y-full"
      : "translate-y-0";

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

  // What the cart draws for this line before the server answers (lib/CartProvider).
  const linePreview = { name: product.name, image: chosenImage ?? firstImage(product), slug: product.slug };

  // In stock / choose an option / sold out. Under the price for a product with
  // no options; right under the options otherwise, where the shopper is looking.
  const statusTone = available ? "text-success" : choosing ? "text-ink" : "text-danger";
  const statusText = available
    ? t.common.inStock
    : missing
      ? text.pick(optionLabels?.[missing.name]?.name || missing.name)
      : product.variants.length === 0
        ? t.common.unavailable
        : t.common.outOfStock;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Title + price */}
      <div className="relative">
        {/* The heart shows once the store is known to have accounts: its corner is kept from the start, so the title never re-wraps around it. */}
        <div className="absolute end-0 -top-1.5 sm:-top-1">
          <WishlistHeart productId={product.id} look="page" />
        </div>
        <h1 className="zt-pdp-title pe-14 text-2xl font-bold leading-tight text-ink sm:text-3xl">{product.name}</h1>
        {/* One baseline. In the markup the price leads (the themes style the first child); on screen the saving sits beside it and the old price is what wraps on a narrow phone. */}
        <div className={`zt-pdp-price mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1${testPending ? " invisible" : ""}`}>
          <span className="whitespace-nowrap text-3xl font-bold text-ink" data-sale={compareAtUnit ? "" : undefined}>{money(unit)}</span>
          {/* Only for a shopper viewing another currency: it takes what is left of the price's own line. */}
          <ConvertedPrice amountMinor={unit} currency={store?.currency ?? "EGP"} className="order-last" />
          {compareAtUnit && (
            <span className="order-2 whitespace-nowrap text-lg text-ink-soft line-through">
              <span className="sr-only">{t.product.compareAt} </span>
              {money(compareAtUnit)}
            </span>
          )}
          {pct && (
            <span className="order-1 shrink-0 whitespace-nowrap rounded-full bg-primary-soft px-2.5 py-1 text-sm font-semibold text-primary">
              {t.common.save(pct)}
            </span>
          )}
        </div>
        {/* «أقل سعر في آخر 30 يوم»: only beside a sale price (handoff 234); its line is kept from the first paint. */}
        <LowestPriceLine workspaceId={workspaceId} variantId={compareAtUnit ? variant?.id : null} className="mt-1.5" reserve />
        {groups.length === 0 && (
          <p className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${statusTone}${preorder ? " hidden" : ""}`}>
            {available && <CheckIcon size={16} />}
            {statusText}
          </p>
        )}
        <BillingPlanNote plan={plan} unitMinor={unit} />
        <YourPrice variantId={yourVariantId} quantity={quantity} />
        <ProductBuyNotes product={product} preorder={preorder} />
      </div>

      {ps.countdown ? <OfferCountdown endsAt={ps.countdown.ends_at} running={countdownRunning} /> : null}

      {/* Variant options */}
      {groups.length > 0 && (
        <VariantOptions
          groups={groups}
          displays={page.options}
          labels={optionLabels}
          variants={product.variants}
          preorders={takesPreorders(product)}
          selection={selection}
          onPick={pickOption}
          workspaceId={workspaceId}
          productId={product.id}
        />
      )}
      {/* What the options add up to — «اختار المقاس», in stock, sold out — said right under them and read out when it changes. Its line is always there. */}
      {groups.length > 0 && (
        <p role="status" aria-live="polite" className={`-mt-3 flex min-h-5 items-center gap-1.5 text-sm font-medium ${statusTone}`}>
          {!preorder && available && <CheckIcon size={16} />}
          {preorder ? null : statusText}
        </p>
      )}

      {/* «دليل المقاسات» — only when the product (or its collection) has a size chart. With options it rides on their title row (VariantOptions). */}
      {groups.length === 0 && <SizeGuideLink workspaceId={workspaceId} productId={product.id} />}

      {bundleChoice && <BundlePicker selection={bundleChoice} product={product} mainVariant={variant} />}
      <BoxBuilderEntry product={product} />

      {/* Bundle / quantity offer */}
      {tiers.length > 1 && <OfferLadder tiers={tiers} tierId={tier?.id ?? ""} unit={unit} onPick={setTierId} />}

      {tiers.length === 0 && !bundleChoice && !ps.hide_quantity_selector && (
        <div className="flex items-center justify-between gap-4">
          <span id="qty-label" className="text-sm font-semibold text-ink">
            {t.product.quantity}
          </span>
          {/* The same stepper the cart page and the cart drawer use. */}
          <QuantityStepper value={quantity} onChange={setQuantity} labelledBy="qty-label" {...stepperLimits(product)} />
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
      <div className="flex flex-col gap-3">
        <div ref={buyRef} className="flex flex-col gap-6">
          <BackInStock product={product} variant={variant}>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={ps.inline_checkout ? scrollToForm : () => void buyNow()}
                disabled={!available || buying || holiday.paused}
                className={`${btnPrimary} w-full touch-manipulation`}
              >
                {/* Sold out (handoff 390): the disabled button says so instead of offering to buy. */}
                {holiday.pausedLabel ?? (soldOutLabel ? soldOutLabel : buying ? text.buying : preorder ? t.buyInfo.preorder : buyLabel)}
              </button>
              {bundleChoice && custom.fields.length === 0 ? (
                <BundleAddToCartButton selection={bundleChoice} disabled={!available || !bundleChoice.available} preview={linePreview} />
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
                  preview={linePreview}
                />
              )}
            </div>
          </BackInStock>
        </div>
        {/* الدفع عند الاستلام · الاسترجاع · مدة التوصيل, in the store's own words, and «هتكسب … نقطة». */}
        <BuyAssurances
          cod={available ? codLine : null}
          promises={available ? promises : null}
          target={variant?.inStock ? shipTo : null}
          earnUnit={unit}
        />
      </div>

      <p role="alert" className="text-sm font-medium text-danger empty:hidden">{buyError}</p>

      {/* «اطلب عرض سعر»: a price for a quantity, asked from the store (handoff 219). */}
      <ProductQuoteRequest product={product} variantId={variant?.id} quantity={quantity} />

      {ps.inline_checkout && !ps.checkout_before_description && description ? (
        <div className="rounded-2xl border border-line bg-paper-raised p-5 text-base leading-relaxed text-ink-soft sm:p-6">
          <RichText text={description} />
        </div>
      ) : null}

      {ps.inline_checkout && <CodeSlot name="above_form" />}

      {/* Inline quick order form */}
      {ps.inline_checkout && (
        <QuickOrderForm
          sectionRef={formRef}
          client={client}
          workspaceId={workspaceId}
          product={product}
          checkoutSettings={checkoutSettings}
          bumpOffer={bumpOffer}
          variant={variant}
          available={available}
          mainLine={mainLine}
          bundleExtraLines={bundleExtraLines}
          pricing={pricing}
          pieces={bundleChoice ? bundleChoice.quantity : tier ? tier.quantity : quantity}
          custom={custom}
          promises={promises}
          onShipTo={onShipTo}
          onTakesCod={setFormTakesCod}
        />
      )}
      {ps.inline_checkout && <CodeSlot name="below_form" />}

      {/* Sticky mobile bar */}
      {ps.sticky_buy_button && (
      <div
        ref={barRef}
        data-buy-bar
        data-above-toolbar={phoneToolbar ? "" : undefined}
        role="region"
        aria-label={text.bar}
        aria-hidden={barHidden}
        inert={barHidden}
        className={`fixed inset-x-0 z-40 border-t border-line bg-paper-raised/95 px-4 pt-3 shadow-lg backdrop-blur transition-[transform,opacity] duration-200 motion-reduce:transition-none md:hidden ${barPlace} ${barMotion}`}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 shrink-0">
            <p className="text-xs text-ink-soft">{t.form.total}</p>
            <p className={`truncate text-base font-bold text-ink${testPending ? " invisible" : ""}`}>{money(pricing.total)}</p>
          </div>
          <button
            type="button"
            onClick={ps.inline_checkout ? scrollToForm : () => void buyNow()}
            disabled={!available || buying || holiday.paused}
            className={`${btnPrimary} min-w-0 flex-1 touch-manipulation`}
          >
            {holiday.pausedLabel ?? soldOutLabel ?? (preorder ? t.buyInfo.preorder : ps.buy_now_text || (ps.inline_checkout ? t.product.stickyOrder : text.buyNow))}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

/**
 * The inline quick order form, with everything only it needs: the fields'
 * values, the store's places, the shipping quote, the payment methods, the
 * deposit, the bumps, the coupon, the autosave and the order itself.
 *
 * It is its own component so that typing in it re-renders it alone, and so
 * that none of its requests are made on a page whose form is off. What it
 * sends, and when, is what the buy box always sent.
 */
function QuickOrderForm({
  sectionRef,
  client,
  workspaceId,
  product,
  checkoutSettings,
  bumpOffer,
  variant,
  available,
  mainLine,
  bundleExtraLines,
  pricing,
  pieces,
  custom,
  promises,
  onShipTo,
  onTakesCod,
}: {
  /** The form's own box: the buy buttons scroll to it and the phone bar watches it. */
  sectionRef: RefObject<HTMLElement | null>;
  client: StoreClient;
  workspaceId: string;
  product: StorefrontProductDetail;
  checkoutSettings: CheckoutSettings;
  bumpOffer: OrderBumpOffer | null;
  variant: StorefrontVariant | undefined;
  available: boolean;
  mainLine: OrderLine | null;
  bundleExtraLines: OrderLine[];
  pricing: { full: number; total: number; saving: number };
  /** How many pieces the summary's first row names. */
  pieces: number;
  custom: CustomFieldAnswers;
  promises: BuyPromises | null;
  onShipTo: (governorate: string, place: PlaceAddress | null) => void;
  onTakesCod: (takes: boolean) => void;
}) {
  const { t, money, locale, store } = useStore();
  const basePath = useStoreBasePath();
  const router = useRouter();
  const holiday = useHoliday();
  const quickFields = useMemo(() => quickFormFields(checkoutSettings), [checkoutSettings]);
  const { fields, reveal } = useOrderFormFields(quickFields);
  const billing = useBillingAddress(fields);
  // The order form's perks: the shopper's token prices the order (price lists, VIP level), and a friend's invite rides along.
  const perks = useCheckoutPerks({ enabled: true });
  // The delivery day and time, asked here only when the store refuses an order without one (read once the form is touched); and a store that paused its orders.
  const deliverySlot = useDeliverySlot({ client, workspaceId, requiredOnly: true, lazy: true, enabled: true });

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
  const storeMethods = usePaymentMethods(client, workspaceId);
  // A product on a plan is paid by a card that can be saved (product/BillingPlan).
  const plan = billingPlanOf(product);
  const payment = { ...storeMethods, ...usePlanMethods(storeMethods.methods, Boolean(plan)) };
  const [methodId, setMethodId] = useState<string | null>(null);
  const method = payment.methods.find((m) => m.id === methodId) ?? payment.methods[0];
  // Manual transfer: the whole order, or the deposit a cash-on-delivery order needs (as on /checkout).
  const transferCopy = useTransferCopy();
  const transferMethod = asTransferMethod(method);
  const depositRule = useCheckoutDeposit(client, workspaceId, values.phone, method?.method === "cod", payment.methods);
  const deposit = depositRule.quote;
  const consent = useCheckoutConsent({ client, workspaceId });
  const [transfer, setTransfer] = useState<{ method: ManualTransferStoreMethod; state: TransferState } | null>(null);
  const needsTransfer = Boolean(transferMethod || deposit);
  const [redirecting, setRedirecting] = useState(false);

  // One function for the form's life: the fields and the place pickers are not handed a new one per keystroke.
  const onFieldChange = useCallback((field: OrderFormField, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }, []);

  // The hook keys on the lines' content, so a fresh array each render is fine.
  const autosaveLines: OrderLine[] = mainLine ? [mainLine, ...bundleExtraLines] : [];
  if (bumpOn && bump) autosaveLines.push({ variantId: bump.variantId, offerId: bump.offerId, quantity: 1 });
  for (const b of productBumps.selected) autosaveLines.push({ variantId: b.variantId, offerId: b.offerId, quantity: 1 });
  const autosave = useCheckoutAutosave({ client, workspaceId, values, lines: autosaveLines });
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
  // The shopper's shipping option, when the store offers more than one (shippingChoice.ts).
  const shippingChoice = useShippingChoice(
    useShippingQuote({ client, workspaceId, governorate: values.governorate, country: values.country, lines: autosaveLines, place: places.address })
  );
  const shipping = shippingChoice.state;

  // A coupon from the link (?coupon=CODE), previewed by the server; with none, the store's automatic discount.
  const linkCoupon = useStoredCoupon(workspaceId);
  const coupon = useCouponPreview(client, workspaceId, formOptionsOf(fields).allow_discount_codes ? linkCoupon : "", autosaveLines);
  // A free-shipping code: the server says the order ships free, so the summary does too (handoff 353).
  const freeByCode = couponFreeShippingLabel(coupon, locale);
  // Priced fields the shopper filled in, on every unit of the line they ride on (as the server charges them).
  const fieldsExtra = customFieldsDelta(product.customFields, custom.toInput()) * (mainLine?.quantity ?? 0);
  const total =
    pricing.total +
    fieldsExtra +
    (bumpOn && bump ? bump.priceAmount : 0) +
    productBumpsAmount +
    (freeByCode ? 0 : shipping.amount) -
    discountOff(shipping.extras, coupon);

  // The buy box above follows the form: where the order goes, and whether cash on delivery is among its methods.
  const placeAddress = places.address;
  useEffect(() => {
    onShipTo(values.governorate, placeAddress);
  }, [onShipTo, values.governorate, placeAddress]);
  const takesCod = payment.methods.some((m) => m.method === "cod");
  useEffect(() => {
    onTakesCod(takesCod);
  }, [onTakesCod, takesCod]);

  // The start of the order form, for the store's pixels and analytics (SPEC §13.2), once per page view.
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const found = validateOrderForm(values, t, fields, { places });
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    const billingInvalid = billing.check();
    if (invalid.length > 0 || billingInvalid.length > 0) {
      setFormError(t.form.errors.summary(invalid.length + billingInvalid.length));
      document.getElementById(invalid.length > 0 ? fieldId(FORM_PREFIX, invalid[0]) : billingFieldId(FORM_PREFIX, billingInvalid[0]))?.focus();
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
    // A required delivery day and time not chosen yet: said beside the picker, before anything is sent.
    const slotMissing = deliverySlot.check();
    if (slotMissing) {
      setFormError(slotMissing);
      return;
    }
    // The terms box, when the store requires it (handoff 374).
    const termsMissing = consent.check(FORM_PREFIX);
    if (termsMissing) {
      setFormError(termsMissing);
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
      // Only a coupon the server said applies is sent: a stale link must not fail the order.
      ...toCheckoutPayload(values, fields, { item: orderLine, place: places.address, ...(coupon?.valid ? { discountCode: coupon.code } : {}) }),
      ...billing.payload(),
      ...shippingChoice.payload,
      ...perks.payload,
      ...deliverySlot.payload,
      ...consent.payload,
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
          shopperToken: perks.shopperToken,
        });
        perks.onPlaced();
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
        tenders: { shopperToken: perks.shopperToken },
      });
      perks.onPlaced();
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
      // A place hidden since the list was read: read it again (lib/useStorePlaces).
      if (isPlaceRefused(err)) places.reload();
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
          setFormError(t.form.errors.summary(invalid.length + billingInvalid.length));
          setSubmitting(false);
        });
        document.getElementById(invalid.length > 0 ? fieldId(FORM_PREFIX, invalid[0]) : billingFieldId(FORM_PREFIX, billingInvalid[0]))?.focus();
      } else {
        // A refused invite is said in its own words, with the way on (components/rewards/CheckoutPerks).
        setFormError(perks.onError(err) ?? deliverySlot.onError(err) ?? consent.onError(err) ?? orderErrorMessage(err, t.form.errors, locale));
        setSubmitting(false);
      }
      // DEPOSIT_REQUIRED: the transfer box opens above the button, the form stays filled (handoff 362).
      depositRule.onError(err);
      autosave.resume();
    }
  }

  return (
    <section
      ref={sectionRef}
      id="order-form"
      aria-labelledby="order-form-title"
      className={`${card} scroll-mt-24 border-2 border-primary/25 p-5 sm:p-6`}
    >
      <h2 id="order-form-title" className="flex items-center gap-2 text-lg font-bold text-ink">
        <CashIcon className="text-primary" />
        {plan ? <PlanFormTitle /> : t.form.title}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">{t.form.subtitle}</p>

      <form onSubmit={handleSubmit} onFocusCapture={onFormStart} noValidate className="mt-5 space-y-5">
        <OrderFormFields
          idPrefix={FORM_PREFIX}
          values={values}
          errors={errors}
          onChange={onFieldChange}
          fields={fields}
          storePlaces={places}
        />
        <ShippingOptionPicker choice={shippingChoice} idPrefix={FORM_PREFIX} />
        <BillingAddressFields idPrefix={FORM_PREFIX} state={billing} />
        <DeliverySlotPicker state={deliverySlot} idPrefix={FORM_PREFIX} frame="plain" />

        <dl className="space-y-2 rounded-xl bg-paper p-4 text-sm ">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">
              {product.name} × {pieces}
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
          <CouponCodeNote coupon={coupon} />
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">{t.checkout.shippingFee}</dt>
            <dd className="shrink-0 text-ink">
              {freeByCode ?? <ShippingFee line={shipping.line} />}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold text-ink">
            <dt>{t.form.total}</dt>
            <dd className="shrink-0">{money(total)}</dd>
          </div>
        </dl>

        <MinimumOrderNotice extras={shipping.extras} />
        <CheckoutPerks state={perks} frame="box" />

        {bump && <OrderBumpCard bump={bump} checked={bumpOn} onChange={setBumpOn} idPrefix={FORM_PREFIX} />}
        <ProductBumpCards state={productBumps} idPrefix={FORM_PREFIX} />

        {(payment.methods.length > 1 || plan) && (
          <PaymentMethodPicker
            plan={plan ? { blocked: payment.blocked, trialDays: plan.mode === "subscription" ? plan.trialDays : undefined } : null}
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

        <CheckoutConsentBoxes state={consent} idPrefix={FORM_PREFIX} />

        <div role="alert" aria-live="assertive" className="empty:hidden">
          {formError && (
            <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</p>
          )}
        </div>

        {/* The button and its footnotes are one block: the notes that are not there take no room. */}
        <div className="grid gap-3">
          <button type="submit" disabled={submitting || !available || holiday.paused || consent.blocked} className={`${btnPrimaryLg} touch-manipulation`}>
            {holiday.pausedLabel ??
              (!available && variant
              ? t.common.outOfStock
              : redirecting
              ? t.payment.redirecting
              : submitting
                ? t.form.submitting
                : `${method.method === "cod" || transferMethod ? t.form.submit : t.payment.payNow} — ${money(total)}`)}
          </button>
          {/* «ادفع كاش للمندوب…» as before, with the store's returns line and the delivery window for the place just picked. */}
          <BuyAssurances
            quiet
            cod={method.method === "cod" ? { title: t.checkout.codHint, point: null } : null}
            promises={promises}
            target={variant?.inStock ? { governorate: values.governorate, place: placeAddress } : null}
          />
        </div>
      </form>
    </section>
  );
}

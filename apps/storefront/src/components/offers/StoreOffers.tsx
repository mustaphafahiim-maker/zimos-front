"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  ApiError,
  storefrontAcceptUpsell,
  storefrontCrossSell,
  storefrontExitDownsell,
  storefrontOrderUpsell,
  storefrontProductBumps,
  type ApiClient,
  type CrossSellPlacement,
  type StorefrontExitDownsell,
  type StorefrontProduct,
  type StorefrontProductBump,
  type StorefrontUpsell,
  type StorefrontUpsellAccepted,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { markAddSource } from "@/lib/addSource";
import { orderBumpOf, type OrderBumpOffer } from "@/lib/commerce";
import { useStore } from "@/lib/StoreContext";
import { OrderBumpCard } from "../checkout/OrderBumpCard";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { CheckIcon } from "../Icons";
import { ProductCard } from "../ProductCard";
import { btnPrimary, btnSecondary, card, skeleton } from "../ui";
import { OfferVariantPicker } from "./OfferVariantPicker";
import { OfferTimer, useOfferCountdown } from "./OfferTimer";
import { trackOfferView, useOfferView } from "@/lib/offerViews";
import { pickText } from "@/lib/i18n";

/*
 * The shopper's side of the offer rules (backend modules/offers): a
 * product's own order bumps, cross-sell suggestions, the thank-you page
 * upsell and the exit popup. Every price here is the server's; the browser
 * names offers by id and the server builds the order lines.
 */

const TEXT = {
  en: {
    crossSell: "Goes well with your order",
    upsellEyebrow: "One more thing before we ship",
    upsellAdd: (price: string) => `Add to my order — ${price}`,
    upsellAdding: "Adding…",
    upsellNo: "No, thanks",
    upsellAdded: (name: string) => `${name} was added to your order.`,
    upsellTotal: (total: string) => `Your new total: ${total}, paid on delivery.`,
    upsellNewOrder: (name: string, number: string) => `${name} is on its way as a new order, ${number}.`,
    upsellPaidCard: (total: string) => `${total} was charged to your saved card.`,
    upsellCod: (total: string) => `${total}, paid on delivery.`,
    upsellDeclined: "Your card was declined, so this order is waiting for payment. Your first order is not affected.",
    upsellFollowOnHint: "It comes as a separate order.",
    upsellClosed: "This offer is no longer available. Your order is unchanged.",
    upsellFailed: "We couldn't add it — your order is unchanged. Try again.",
    exitCode: "Your code",
    exitCopy: "Copy code",
    exitCopied: "Copied",
    exitClose: "Close",
    exitHint: "Enter it at checkout.",
  },
  ar: {
    crossSell: "يناسب طلبك",
    upsellEyebrow: "حاجة كمان قبل الشحن",
    upsellAdd: (price: string) => `أضف لطلبي — ${price}`,
    upsellAdding: "جارٍ الإضافة…",
    upsellNo: "لا، شكرًا",
    upsellAdded: (name: string) => `تمت إضافة ${name} إلى طلبك.`,
    upsellTotal: (total: string) => `الإجمالي الجديد: ${total}، الدفع عند الاستلام.`,
    upsellNewOrder: (name: string, number: string) => `${name} جاي في طلب جديد، رقم ${number}.`,
    upsellPaidCard: (total: string) => `اتخصم ${total} من الكارت المحفوظ.`,
    upsellCod: (total: string) => `${total}، الدفع عند الاستلام.`,
    upsellDeclined: "الكارت اترفض، فالطلب ده مستني الدفع. طلبك الأول مش متأثر.",
    upsellFollowOnHint: "هييجي في طلب منفصل.",
    upsellClosed: "هذا العرض لم يعد متاحًا. طلبك كما هو.",
    upsellFailed: "تعذّرت الإضافة — طلبك كما هو. حاول مرة أخرى.",
    exitCode: "الكود",
    exitCopy: "نسخ الكود",
    exitCopied: "تم النسخ",
    exitClose: "إغلاق",
    exitHint: "اكتبه عند إتمام الطلب.",
  },
};

// ------------------------------------------------------------ order bumps --

export interface ProductBumpsState {
  /** The product's bumps as cards, ticked or not. */
  bumps: OrderBumpOffer[];
  isOn: (offerId: string) => boolean;
  toggle: (offerId: string, on: boolean) => void;
  /** The ticked ones. */
  selected: OrderBumpOffer[];
  /** A bump the server refused: untick everything and load them again. */
  reset: () => void;
}

/**
 * A product's own order bumps. `exclude` is the store-wide bump's offer, which
 * the page already shows. A rule marked "ticked by default" starts ticked.
 */
export function useProductBumps(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  exclude?: string | null,
  /** The order's currency: an add-on priced in another one is not offered (a funnel selling in its own). */
  currency?: string | null
): ProductBumpsState {
  const [rows, setRows] = useState<StorefrontProductBump[]>([]);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!productId) {
      setRows([]);
      return;
    }
    storefrontProductBumps(client, workspaceId, productId)
      .then((all) => {
        if (cancelled) return;
        const list = currency ? all.filter((b) => !b.currency || b.currency === currency) : all;
        setRows(list);
        // After a refusal nothing is ticked for the shopper again.
        setOn(version === 0 ? Object.fromEntries(list.filter((b) => b.preChecked).map((b) => [b.offerId, true])) : {});
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId, productId, version, currency]);

  // Each bump on screen counts as seen (lib/offerViews).
  useEffect(() => {
    for (const row of rows) if (row.offerId !== exclude) trackOfferView(workspaceId, "bump", row.id);
  }, [rows, workspaceId, exclude]);

  const bumps = useMemo(
    () =>
      rows
        .filter((b) => b.offerId !== exclude)
        .map((b) => orderBumpOf(b, [productId]))
        .filter((b): b is OrderBumpOffer => b !== null),
    [rows, exclude, productId]
  );

  return {
    bumps,
    isOn: (offerId) => Boolean(on[offerId]),
    toggle: (offerId, value) => setOn((current) => ({ ...current, [offerId]: value })),
    selected: bumps.filter((b) => on[b.offerId]),
    reset: () => setVersion((v) => v + 1),
  };
}

export function ProductBumpCards({ state, idPrefix }: { state: ProductBumpsState; idPrefix: string }) {
  if (state.bumps.length === 0) return null;
  return (
    <>
      {state.bumps.map((bump) => (
        <OrderBumpCard
          key={bump.offerId}
          bump={bump}
          checked={state.isOn(bump.offerId)}
          onChange={(value) => state.toggle(bump.offerId, value)}
          idPrefix={`${idPrefix}-${bump.offerId.slice(0, 8)}`}
        />
      ))}
    </>
  );
}

// -------------------------------------------------------------- cross-sell --

/** "Goes well with your order": the merchant's rule, or what real orders show was bought together. */
export function CrossSellStrip({
  workspaceId,
  productIds,
  placement,
  title,
  reserve = false,
}: {
  workspaceId: string;
  productIds: string[];
  placement: CrossSellPlacement;
  /** Said instead of "Goes well with your order" (the product page's «بيتشروا مع بعض», handoff 223). */
  title?: string;
  /**
   * Hold the strip's place while the store is asked (the thank-you page): a
   * row of card outlines stands in until the answer comes, so the cards
   * arriving push nothing. With nothing to suggest, the place is given back
   * once. Off by default — the other pages render the strip exactly as before.
   */
  reserve?: boolean;
}) {
  const { locale, store } = useStore();
  const text = pickText(TEXT, locale);
  const key = [...productIds].sort().join(",");
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  // The rule that filled the strip (null: bought together), for its numbers (lib/offerViews).
  const [ruleId, setRuleId] = useState<string | null>(null);
  // The products the strip last got an answer for — some, none, or a failure.
  const [answeredKey, setAnsweredKey] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    storefrontCrossSell(createStorefrontApiClient(), workspaceId, key.split(","), placement)
      .then((result) => {
        if (!cancelled) {
          setProducts(result.products);
          setRuleId((result as { ruleId?: string | null }).ruleId ?? null);
          setAnsweredKey(key);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
          setAnsweredKey(key);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, key, placement]);

  useOfferView(workspaceId, "cross_sell", products.length > 0 ? ruleId : null);

  if (products.length === 0) {
    if (!reserve || !key || answeredKey === key) return null;
    // The strip's own outline: its title, then one row of cards (two on a phone, four on a wide screen).
    return (
      <div aria-hidden className="mt-10">
        <div className={`${skeleton} h-6 w-44 max-w-full`} />
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={i > 1 ? "hidden lg:block" : undefined}>
              <div className={`${skeleton} aspect-square w-full`} />
              <div className={`${skeleton} mt-3 h-4 w-3/4`} />
              <div className={`${skeleton} mt-2 h-4 w-1/3`} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <section aria-labelledby={`cross-sell-${placement}`} className="mt-10">
      <h2 id={`cross-sell-${placement}`} className="text-lg font-semibold text-ink">
        {title ?? text.crossSell}
      </h2>
      {/* A quick add from here counts as a cross-sell add (lib/addSource.ts). */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4" onClickCapture={() => markAddSource("cross_sell", ruleId)}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} currency={store?.currency ?? "EGP"} locale={locale} from="cross_sell" />
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------ post-purchase upsell --

// How long the thank-you page holds the offer's place for an answer, and the card for its variant picker.
const UPSELL_WAIT_MS = 6000;
const UPSELL_PICKER_WAIT_MS = 2500;
// How long the offer's place takes to open or close; matches the duration-200 on the row.
const FOLD_MS = 200;

/**
 * A place on the page that can be given back smoothly. Open, it is as tall as
 * what is in it; closed, it takes no room. Between the two the row slides over
 * 200ms (at once for a shopper who asked for less motion) and clips what is in
 * it, which stays drawn until the row has closed. At rest nothing is clipped,
 * so a theme's card shadow shows whole.
 */
function Fold({ open, children }: { open: boolean; children: ReactNode }) {
  const [moving, setMoving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setMoving(true);
  }
  useEffect(() => {
    if (!moving) return;
    const timer = window.setTimeout(() => setMoving(false), FOLD_MS + 60);
    return () => window.clearTimeout(timer);
  }, [moving, open]);

  return (
    <div
      className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
    >
      <div className={open && !moving ? "min-h-0 min-w-0" : "min-h-0 min-w-0 overflow-hidden"} inert={!open} aria-hidden={open ? undefined : true}>
        {open || moving ? children : null}
      </div>
    </div>
  );
}

/**
 * The offer's product, for its variant picker (the same read as
 * OfferVariantPicker's useOfferProduct), and whether that read has answered —
 * the card waits for it, so the picker never arrives under a thumb that is
 * about to press "Add to my order".
 */
function useUpsellProduct(workspaceId: string, idOrSlug: string | null): { product: StorefrontProduct | null; settled: boolean } {
  const [answer, setAnswer] = useState<{ key: string; product: StorefrontProduct | null } | null>(null);
  useEffect(() => {
    if (!idOrSlug) return;
    let cancelled = false;
    createStorefrontApiClient()
      .getStorefrontProduct(workspaceId, idOrSlug)
      .then((p) => {
        if (!cancelled) setAnswer({ key: idOrSlug, product: p as StorefrontProduct });
      })
      .catch(() => {
        // No picker: the offer's own variant.
        if (!cancelled) setAnswer({ key: idOrSlug, product: null });
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, idOrSlug]);
  const current = answer && answer.key === idOrSlug ? answer : null;
  return { product: current?.product ?? null, settled: !idOrSlug || current !== null };
}

/**
 * The thank-you page's offer: one tap adds it to the order just placed (cash
 * on delivery, before anyone has confirmed it). Declining hides it; nothing
 * is added without the tap.
 *
 * With `reserve` the offer's place is held from the first paint by an outline
 * of the card, until the store answers "this offer" or "none": the offer then
 * takes the outline's place, or the place closes once. Only what is asked for
 * at the first paint is held — a place that opened later, only to close again,
 * would move the page twice. An offer that comes with no place held opens its
 * own, smoothly. Taking the offer answers inside the card, at the card's
 * height, so the page under it stays put; "No, thanks" folds it away.
 */
export function ThankYouUpsell({
  workspaceId,
  orderId,
  orderNumber,
  onAccepted,
  reserve = false,
}: {
  workspaceId: string;
  orderId: string;
  orderNumber: string | null;
  onAccepted?: (order: StorefrontUpsellAccepted) => void;
  /** Hold the offer's place with an outline of the card while the store is asked; read once, when the page is first drawn. */
  reserve?: boolean;
}) {
  const { locale, money } = useStore();
  const text = pickText(TEXT, locale);
  const [held] = useState(reserve);
  const [offer, setOffer] = useState<StorefrontUpsell | null>(null);
  // The store answered about an offer for this order — one, none, or a failure.
  const [asked, setAsked] = useState(false);
  // A slow answer is not waited for forever: the place is given back, and a late offer still shows.
  const [gaveUp, setGaveUp] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "declined">("idle");
  const [accepted, setAccepted] = useState<StorefrontUpsellAccepted | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The option the shopper takes it in (OfferVariantPicker), for a product with several.
  const picker = useUpsellProduct(workspaceId, offer ? (offer.productSlug ?? offer.productId) : null);
  const [pickerWaited, setPickerWaited] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  // The offer's real countdown from the order (offers/offerCountdown.js).
  const countdown = useOfferCountdown(offer?.expiresAt);
  // The card's height when the offer is taken: the answer keeps it.
  const cardBox = useRef<HTMLElement>(null);
  const [heldHeight, setHeldHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!orderNumber) return;
    let cancelled = false;
    const giveUp = window.setTimeout(() => setGaveUp(true), UPSELL_WAIT_MS);
    storefrontOrderUpsell(createStorefrontApiClient(), workspaceId, orderId, orderNumber)
      .then((result) => {
        if (!cancelled) setOffer(result);
      })
      .catch(() => {
        /* no offer is a fine thank-you page */
      })
      .finally(() => {
        if (!cancelled) setAsked(true);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(giveUp);
    };
  }, [workspaceId, orderId, orderNumber]);

  useEffect(() => {
    if (!offer) return;
    const timer = window.setTimeout(() => setPickerWaited(true), UPSELL_PICKER_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [offer]);

  // The card shows once its variant picker is known (or was waited for long enough), so it arrives whole.
  const cardReady = offer !== null && (picker.settled || pickerWaited);
  // Nothing left to wait for: the offer is on screen, there is none, or the answer is taking too long.
  const settled = !orderNumber || gaveUp || (asked && (offer === null || cardReady));
  // Counted as seen once it is on screen (lib/offerViews).
  useOfferView(workspaceId, "upsell", cardReady ? offer?.ruleId : null);

  async function accept() {
    if (!offer || !orderNumber || state !== "idle") return;
    setState("busy");
    setError(null);
    try {
      const order = await storefrontAcceptUpsell(createStorefrontApiClient(), workspaceId, orderId, orderNumber, offer.offerId, chosenId ?? undefined);
      setHeldHeight(cardBox.current?.offsetHeight ?? null);
      setAccepted(order);
      onAccepted?.(order);
    } catch (err) {
      const closed = err instanceof ApiError && (err.code === "UPSELL_CLOSED" || err.code === "UPSELL_INVALID");
      setError(closed ? text.upsellClosed : text.upsellFailed);
      if (closed) setOffer(null);
    } finally {
      setState("idle");
    }
  }

  const showOffer = offer !== null && cardReady && state !== "declined";
  const open = accepted !== null || showOffer || (held && !settled);

  let body: ReactNode = null;
  if (accepted) {
    body = (
      <div
        role="status"
        style={heldHeight ? { minHeight: heldHeight } : undefined}
        className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-primary/30 bg-primary-soft px-5 py-6 text-center text-sm"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary">
          <CheckIcon size={22} />
        </span>
        <p className="mt-3 text-base font-semibold text-primary">
          {accepted.followOn ? text.upsellNewOrder(accepted.added.productName, accepted.orderNumber) : text.upsellAdded(accepted.added.productName)}
        </p>
        <p className="mt-1 text-ink-soft">
          {!accepted.followOn
            ? text.upsellTotal(money(accepted.totalAmount, accepted.currency))
            : accepted.payment?.status === "paid"
              ? text.upsellPaidCard(money(accepted.totalAmount, accepted.currency))
              : accepted.payment?.status === "declined"
                ? text.upsellDeclined
                : text.upsellCod(money(accepted.totalAmount, accepted.currency))}
        </p>
      </div>
    );
  } else if (offer && cardReady) {
    const price = Number(offer.priceAmount);
    const compareAt = offer.compareAtAmount === null ? null : Number(offer.compareAtAmount);
    const busy = state === "busy";
    body = (
      <section ref={cardBox} className={`${card} mt-6 border-2 border-primary/30 p-5 sm:p-6`} aria-labelledby="upsell-title">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{text.upsellEyebrow}</p>
        <div className="mt-3 flex gap-4">
          {offer.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={offer.imageUrl} alt="" width={96} height={96} decoding="async" className="h-24 w-24 shrink-0 rounded-xl border border-line object-cover" />
          )}
          <div className="min-w-0">
            <h2 id="upsell-title" className="text-lg font-semibold text-ink">
              {offer.title || offer.productName}
            </h2>
            {offer.title && <p className="text-sm text-ink-soft">{offer.productName}</p>}
            {offer.description && <p className="mt-1 text-sm text-ink-soft">{offer.description}</p>}
            <p className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className="text-xl font-bold text-ink">{money(price, offer.currency)}</span>
              {compareAt && compareAt > price && <span className="text-sm text-ink-soft line-through">{money(compareAt, offer.currency)}</span>}
            </p>
          </div>
        </div>
        <OfferVariantPicker product={picker.product} value={chosenId ?? offer.variantId} onChange={setChosenId} disabled={busy} />
        {/* The countdown starts a tick after the card is drawn: its line is held, so the buttons under it stay put. */}
        <div className={offer.expiresAt ? "flex min-h-11 flex-col items-start" : undefined}>
          <OfferTimer {...countdown} />
        </div>
        {offer.followOn && <p className="mt-2 text-xs text-ink-soft">{text.upsellFollowOnHint}</p>}
        <p role="alert" className="mt-3 text-sm font-medium text-danger empty:hidden">
          {error}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          {/* The tap answers at once — pressed, then "Adding…" — and the result takes the card's place. */}
          <button
            type="button"
            className={`${btnPrimary} min-h-12 touch-manipulation active:translate-y-px`}
            disabled={busy || countdown.ended}
            aria-busy={busy}
            onClick={() => void accept()}
          >
            {busy && <CircleNotchIcon size={18} aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {busy ? text.upsellAdding : text.upsellAdd(money(price, offer.currency))}
          </button>
          <button type="button" className={`${btnSecondary} touch-manipulation`} disabled={busy} onClick={() => setState("declined")}>
            {text.upsellNo}
          </button>
        </div>
      </section>
    );
  } else if (held && !error) {
    // The card's own outline: eyebrow, photo beside three lines, the two buttons.
    body = (
      <div aria-hidden className={`${card} mt-6 border-2 p-5 sm:p-6`}>
        <div className={`${skeleton} h-4 w-36 max-w-full`} />
        <div className="mt-3 flex gap-4">
          <div className={`${skeleton} h-24 w-24 shrink-0`} />
          <div className="min-w-0 flex-1 space-y-2.5 pt-1">
            <div className={`${skeleton} h-5 w-4/5`} />
            <div className={`${skeleton} h-4 w-1/2`} />
            <div className={`${skeleton} h-6 w-24`} />
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className={`${skeleton} h-12 w-full`} />
          <div className={`${skeleton} h-11 w-full sm:w-28`} />
        </div>
      </div>
    );
  }

  return (
    <>
      <Fold open={open}>{body}</Fold>
      {!accepted && !showOffer && error && (
        <p role="status" className="mt-6 rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft">
          {error}
        </p>
      )}
    </>
  );
}

// ------------------------------------------------------------- exit popup --

const SEEN_KEY = (workspaceId: string) => `zimos.exit-offer.${workspaceId}`;

// The pages the popup never shows on: the order form, everything after the order, and funnels.
const NEVER_ON = /\/(checkout|orders|pay|offer|track|f)(\/|$)/;

function pageMatches(pages: StorefrontExitDownsell["pages"], pathname: string): boolean {
  if (NEVER_ON.test(pathname)) return false;
  if (pages === "product") return /\/products\/[^/]+/.test(pathname);
  if (pages === "cart") return /\/cart(\/|$)/.test(pathname);
  return true;
}

/**
 * The merchant's exit popup: shown once per visitor, when they are about to
 * leave (the pointer leaves through the top of the window, or the back
 * button on a phone) or after the delay they set. A message and, when there
 * is one, a real coupon of the store — no timer, no pressure.
 */
export function ExitDownsell({ workspaceId }: { workspaceId: string }) {
  const { locale } = useStore();
  const text = pickText(TEXT, locale);
  const pathname = usePathname() ?? "";
  const [config, setConfig] = useState<StorefrontExitDownsell | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  // The store is asked for its popup once per visit, on the first page the popup could show on —
  // not on the order form or the pages after the order, where it never shows.
  const quiet = NEVER_ON.test(pathname);
  const askedFor = useRef<string | null>(null);

  useEffect(() => {
    if (quiet || askedFor.current === workspaceId) return;
    try {
      if (localStorage.getItem(SEEN_KEY(workspaceId))) return;
    } catch {
      return;
    }
    askedFor.current = workspaceId;
    storefrontExitDownsell(createStorefrontApiClient(), workspaceId)
      .then((result) => {
        if (askedFor.current === workspaceId) setConfig(result);
      })
      .catch(() => {
        /* no popup */
      });
  }, [workspaceId, quiet]);

  const eligible = config !== null && !open && pageMatches(config.pages, pathname);

  useEffect(() => {
    if (!eligible || !config) return;
    const show = () => {
      try {
        if (localStorage.getItem(SEEN_KEY(workspaceId))) return;
        localStorage.setItem(SEEN_KEY(workspaceId), "1");
      } catch {
        return;
      }
      trackOfferView(workspaceId, "exit_downsell", "popup");
      setOpen(true);
    };
    if (config.trigger === "delay") {
      const timer = window.setTimeout(show, config.delaySeconds * 1000);
      return () => window.clearTimeout(timer);
    }
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) show();
    };
    // A phone has no pointer to leave with: the first "back" is answered with the offer.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const onPop = () => show();
    document.addEventListener("mouseout", onLeave);
    if (coarse) {
      window.history.pushState({ zimosExit: true }, "");
      window.addEventListener("popstate", onPop, { once: true });
    }
    return () => {
      document.removeEventListener("mouseout", onLeave);
      window.removeEventListener("popstate", onPop);
    };
  }, [eligible, config, workspaceId]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || !config) return null;

  async function copy() {
    if (!config?.code) return;
    try {
      await navigator.clipboard.writeText(config.code);
      setCopied(true);
    } catch {
      /* the code is on screen to type */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onMouseDown={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-offer-title"
        className={`${card} w-full max-w-md p-6 text-center shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="exit-offer-title" className="text-xl font-bold text-ink">
          {config.title || config.message}
        </h2>
        {config.title && config.message && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{config.message}</p>}
        {config.code && (
          <div className="mt-5">
            <p className="text-xs font-medium text-ink-soft">{text.exitCode}</p>
            <p dir="ltr" className="mt-1 rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft px-4 py-3 text-lg font-bold tracking-widest text-primary">
              {config.code}
            </p>
            <p className="mt-2 text-xs text-ink-soft">{text.exitHint}</p>
          </div>
        )}
        <div className="mt-5 grid gap-2">
          {config.code && (
            <button type="button" className={btnPrimary} onClick={() => void copy()}>
              {copied ? <CheckIcon size={18} /> : null}
              <span aria-live="polite">{copied ? text.exitCopied : text.exitCopy}</span>
            </button>
          )}
          <button ref={closeButton} type="button" className={btnSecondary} onClick={() => setOpen(false)}>
            {text.exitClose}
          </button>
        </div>
      </div>
    </div>
  );
}

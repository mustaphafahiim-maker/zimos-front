"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ApiError, orderTrackingByToken, type TrackResult } from "@store-builder/api-client";
import { latestOrderSnapshot } from "@/lib/commerce";
import { isEgyptianMobile, normalizePhone, whatsappNumber } from "@/lib/egypt";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { useStoreCountry } from "@/lib/storeCountry";
import { getTrackingToken } from "@/lib/trackingTokens";
import { useIsClient } from "@/lib/useIsClient";
import { SearchIcon, WhatsAppIcon } from "./Icons";
import { CopyButton } from "./StatusTimeline";
import { TrackOrderProgress } from "./TrackOrderProgress";
import { TrackOrderNotes } from "./TrackOrderNotes";
import { TrackDeliveryEstimate } from "./TrackDeliveryEstimate";
import { TrackOrderFulfilment } from "./fulfilment/OrderFulfilmentNotes";
import { TrackOrderDownloads } from "./TrackOrderDownloads";
import { TrackOrderTransfer } from "./TrackOrderTransfer";
import { TrackOrderSubscriptions } from "./TrackOrderSubscriptions";
import { ShopperReturns } from "./returns/ShopperReturns";
import { OrderSelfService } from "./OrderSelfService";
import { OrderConfirmFromLink } from "./OrderConfirmFromLink";
import { btnGhost, btnPrimaryLg, btnSecondary, card, container, input, label, skeleton } from "./ui";

const api = createStorefrontApiClient();

// This page's own words; the rest come from the store's dictionary (`t.track`, `t.form`).
const TEXT = {
  en: {
    copy: "Copy",
    copied: "Copied",
    numberPlaceholder: "#1001",
    numberHint: "As written on your order confirmation and in the store's message.",
    missBefore: "We couldn't find order",
    missBetween: "for the mobile",
    missPhone: "Use the same mobile number you ordered with.",
    missNumber: "Copy the order number from your confirmation page or the store's message.",
    linkDead: "This tracking link no longer works. Look your order up with your mobile number and order number.",
    askStore: "Message the store",
    askMessage: (n: string) => `Hello, I'm asking about order ${n}.`,
    another: "Look up another order",
    lastTitle: "Your last order on this phone",
    lastOpen: "Track it",
  },
  ar: {
    copy: "نسخ",
    copied: "اتنسخ",
    numberPlaceholder: "#1001",
    numberHint: "زي ما هو مكتوب في صفحة تأكيد الطلب ورسالة المتجر.",
    missBefore: "ملقيناش طلب رقم",
    missBetween: "على الموبايل",
    missPhone: "اكتب نفس رقم الموبايل اللي طلبت بيه.",
    missNumber: "انسخ رقم الطلب من صفحة تأكيد الطلب أو من رسالة المتجر.",
    linkDead: "اللينك ده مبقاش شغّال. دوّر على طلبك برقم الموبايل ورقم الطلب.",
    askStore: "كلّم المتجر",
    askMessage: (n: string) => `أهلًا، بسأل عن طلب رقم ${n}.`,
    another: "دوّر على طلب تاني",
    lastTitle: "آخر طلب ليك من الموبايل ده",
    lastOpen: "تابعه",
  },
  fr: {
    copy: "Copier",
    copied: "Copié",
    numberPlaceholder: "#1001",
    numberHint: "Tel qu'il figure sur la confirmation de commande et dans le message de la boutique.",
    missBefore: "Aucune commande",
    missBetween: "pour le mobile",
    missPhone: "Utilisez le numéro de mobile avec lequel vous avez commandé.",
    missNumber: "Copiez le numéro de commande depuis la page de confirmation ou le message de la boutique.",
    linkDead: "Ce lien de suivi ne fonctionne plus. Recherchez votre commande avec votre numéro de mobile et son numéro.",
    askStore: "Écrire à la boutique",
    askMessage: (n: string) => `Bonjour, je vous écris au sujet de la commande ${n}.`,
    another: "Rechercher une autre commande",
    lastTitle: "Votre dernière commande sur cet appareil",
    lastOpen: "La suivre",
  },
};

// A round placeholder. Not the `skeleton` recipe: its own corners would win over a circle's.
const skeletonDot = "block shrink-0 animate-pulse rounded-full bg-line/60 motion-reduce:animate-none";

/** A lookup that answered "no such order": by the form (with what was asked for), or by a link that no longer opens one. */
type Miss = { by: "form"; phone: string; number: string } | { by: "link" };

/** The status card's outline — its title, the number, five steps on a rail — while an order is being opened. */
function StatusOutline() {
  return (
    <div className={`${card} p-5 sm:p-6`}>
      <div className="mb-5 flex items-center justify-between gap-2">
        <span className={`${skeleton} block h-6 w-28`} />
        <span className={`${skeleton} block h-11 w-44 max-w-[55%]`} />
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3 pb-6 last:pb-0">
          <span className={`${skeletonDot} h-9 w-9`} />
          <span className="flex-1 space-y-2 pt-1.5">
            <span className={`${skeleton} block h-4 w-1/2`} />
            <span className={`${skeleton} block h-3 w-1/3`} />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * The tracking page before its content is there (track/loading.tsx, and the
 * page's own Suspense fallback): the lookup form's outline, or — for a link
 * that opens an order by itself (`order`) — the status card's.
 */
export function TrackOrderSkeleton({ order = false }: { order?: boolean }) {
  const { t } = useStore();
  return (
    <main className={`${container} flex-1 py-8 sm:py-14`}>
      <div className="mx-auto max-w-xl" role="status" aria-busy="true" aria-label={t.common.loading}>
        {order ? (
          <>
            <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t.track.title}</h1>
            <div className="mt-6">
              <StatusOutline />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center">
              <span className={`${skeleton} block h-14 w-14`} />
              <h1 className="mt-4 text-center text-2xl font-bold text-ink sm:text-3xl">{t.track.title}</h1>
              <span className={`${skeleton} mt-3 block h-4 w-64 max-w-full`} />
            </div>
            <div className={`${card} mt-8 space-y-4 p-5 sm:p-6`}>
              {[0, 1].map((i) => (
                <div key={i}>
                  <span className={`${skeleton} mb-1.5 block h-5 w-28`} />
                  <span className={`${skeleton} block h-11 w-full`} />
                </div>
              ))}
              <span className={`${skeleton} block h-12 w-full`} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export function TrackOrder() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const search = useSearchParams();
  const { t, locale, intlLocale, money, store } = useStore();
  const x = pickText(TEXT, locale);
  // The store's own country's numbers, as its checkout takes them (lib/orderForm validateOrderForm):
  // an Egyptian mobile in Egypt, a full number elsewhere.
  const egypt = useStoreCountry() === "EG";
  const validPhone = (raw: string) => (egypt ? isEgyptianMobile(raw) : /^\+?\d{8,15}$/.test(normalizePhone(raw)));
  const phoneError = egypt ? t.form.errors.phone : t.form.errors.phoneIntl;

  // A signed tracking link (…/track?t=<token>, from the store's messages or "Copy tracking link")
  // opens its order straight away, with no phone number to type. So does the thank-you page's
  // «تابع طلبك» (…/track?number=…&order=<id>) in the browser that placed the order: its token is
  // kept here (lib/trackingTokens), so it never has to travel in the address.
  const linkToken = search.get("t");
  const linkOrder = search.get("order");
  // A link the store sent (…/track?number=ORD-…) arrives with the number filled in.
  const linkNumber = search.get("number");
  const opensItself = Boolean(linkToken || linkOrder);

  const [phone, setPhone] = useState("");
  const [number, setNumber] = useState(() => (linkNumber ?? "").slice(0, 60));
  const [errors, setErrors] = useState<{ phone?: string; number?: string }>({});
  const [status, setStatus] = useState<"idle" | "loading" | "done">(opensItself ? "loading" : "idle");
  /** How the order on screen was asked for: by itself (a link, a saved order) or by the form. */
  const [source, setSource] = useState<"link" | "form">(opensItself ? "link" : "form");
  const [result, setResult] = useState<TrackResult | null>(null);
  /** Set only when the lookup itself failed; a clean miss is `miss`. */
  const [failure, setFailure] = useState<string | null>(null);
  const [miss, setMiss] = useState<Miss | null>(null);
  // Only the latest question is answered on screen.
  const call = useRef(0);
  const statusHeading = useRef<HTMLHeadingElement>(null);

  /** Opens an order by its signed token. True when it opened. */
  const open = useCallback(
    async (token: string, by: "link" | "saved"): Promise<boolean> => {
      const id = ++call.current;
      setSource("link");
      setStatus("loading");
      setFailure(null);
      setMiss(null);
      let found: TrackResult | null = null;
      try {
        found = await orderTrackingByToken(api, workspaceId, token);
      } catch {
        found = null;
      }
      if (id !== call.current) return false;
      setResult(found);
      if (found) setNumber(found.orderNumber);
      else if (by === "link") setMiss({ by: "link" });
      // A saved token that opens nothing falls back to the form, quietly: the number is already in it.
      setSource(found ? "link" : "form");
      setStatus(found || by === "link" ? "done" : "idle");
      return Boolean(found);
    },
    [workspaceId]
  );

  useEffect(() => {
    const token = linkToken ?? (linkOrder ? getTrackingToken(workspaceId, linkOrder) : null);
    if (token) void open(token, linkToken ? "link" : "saved");
    else {
      // Nothing opens by itself after all (this browser holds no token for that order): the form.
      setSource("form");
      setStatus((current) => (current === "loading" ? "idle" : current));
    }
    const calls = call;
    return () => {
      calls.current += 1;
    };
  }, [workspaceId, linkToken, linkOrder, open]);

  // An order found by the form takes the form's place: the reader is taken to it.
  const shownNumber = result?.orderNumber;
  useEffect(() => {
    if (shownNumber && source === "form") statusHeading.current?.focus();
  }, [shownNumber, source]);

  /** Maps a failed lookup onto one of the shopper-facing messages. */
  function lookupError(err: unknown): string {
    if (!(err instanceof ApiError)) return t.track.errors.failed;
    if (err.status === 422) return t.track.errors.invalid;
    if (err.status === 429) {
      const minutes = err.retryAfter ? Math.max(1, Math.ceil(err.retryAfter / 60)) : null;
      return minutes ? t.track.errors.rateLimitedIn(minutes) : t.track.errors.rateLimited;
    }
    return t.track.errors.failed;
  }

  async function lookup(rawPhone: string, rawNumber: string) {
    const id = ++call.current;
    // A "#" typed in front of the order number isn't part of it.
    const asked = rawNumber.replace(/^#/, "").trim();
    setSource("form");
    setStatus("loading");
    setFailure(null);
    setMiss(null);
    setResult(null);
    try {
      // The API takes digits only (it refuses a "+") and normalizes local vs. international itself,
      // as the checkout did.
      const found = await api.trackOrder(workspaceId, normalizePhone(rawPhone).replace(/^\+/, ""), asked);
      if (id !== call.current) return;
      setResult(found);
      if (!found) setMiss({ by: "form", phone: normalizePhone(rawPhone), number: asked });
    } catch (err) {
      if (id !== call.current) return;
      setResult(null);
      setFailure(lookupError(err));
    }
    setStatus("done");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!validPhone(phone)) next.phone = phoneError;
    if (!number.trim()) next.number = t.track.errors.orderNumber;
    setErrors(next);
    if (next.phone) return document.getElementById("track-phone")?.focus();
    if (next.number) return document.getElementById("track-number")?.focus();
    void lookup(phone, number);
  }

  /** Back to the form, for another order. */
  function another() {
    call.current += 1;
    setResult(null);
    setMiss(null);
    setFailure(null);
    setNumber("");
    setSource("form");
    setStatus("idle");
    requestAnimationFrame(() => document.getElementById("track-phone")?.focus());
  }

  // The order this browser placed last, one tap away — no numbers to type.
  const isClient = useIsClient();
  const last = useMemo(() => (isClient ? latestOrderSnapshot(workspaceId) : null), [isClient, workspaceId]);
  async function openLast() {
    if (!last) return;
    const token = getTrackingToken(workspaceId, last.id);
    if (token && (await open(token, "saved"))) {
      // The order took the form's place: the reader is taken to it.
      requestAnimationFrame(() => statusHeading.current?.focus());
      return;
    }
    // No token kept (an older order), or it opens nothing: the order's own phone and number.
    void lookup(last.phone, last.orderNumber);
  }

  // Every amount in one result is in the order's own currency, not the store's
  // current one — an order placed before a currency change still adds up.
  const currency = result?.currency;
  // The order's signed token comes with every answer (by link or by phone + number); returns name the order by it.
  const trackingToken = (result as (TrackResult & { trackingToken?: string }) | null)?.trackingToken ?? null;
  const wa = store?.phone ? whatsappNumber(store.phone) : null;
  // A store that wrote its own words for these (dashboard → Store texts) keeps them.
  const theirs: Record<string, string | undefined> = store?.storefrontTexts?.[locale] ?? {};
  const reworded = (key: string) => (theirs[key] ?? "").trim() !== "";
  const busy = status === "loading";

  // An order is opening by itself: its card's outline, where the card will be.
  if (busy && source === "link") {
    return (
      <main className={`${container} flex-1 py-8 sm:py-14`}>
        <div className="mx-auto max-w-xl">
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t.track.title}</h1>
          <div className="mt-6" role="status" aria-busy="true" aria-label={t.track.searching}>
            <StatusOutline />
          </div>
        </div>
      </main>
    );
  }

  if (result) {
    const hasItems = result.items.length > 0;
    return (
      <main className={`${container} flex-1 py-8 sm:py-14`}>
        <div className="mx-auto max-w-xl">
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t.track.title}</h1>

          {/* A confirmation link (…/track?t=…&confirm=1): the shopper confirms the cash-on-delivery order here (handoff 388). */}
          <OrderConfirmFromLink workspaceId={workspaceId} token={trackingToken} orderNumber={result.orderNumber} total={money(result.totalAmount, currency)} className="mt-6" />

          {/* Where the order is: the timeline, then the courier, the store's notes. */}
          <section className={`${card} mt-6 p-5 sm:p-6`} aria-labelledby="track-status-title">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <h2 id="track-status-title" ref={statusHeading} tabIndex={-1} className="text-lg font-semibold text-ink outline-none">
                {t.track.status}
              </h2>
              <CopyButton value={result.orderNumber} copy={x.copy} copied={x.copied}>
                <bdi dir="ltr" className="min-w-0 break-all font-bold tabular-nums">
                  {result.orderNumber}
                </bdi>
              </CopyButton>
            </div>
            <TrackDeliveryEstimate result={result} className="mb-5" />
            <TrackOrderProgress result={result} />
            {/* The delivery day and time the shopper chose, or the pickup code, place and state (handoff 221, 225). */}
            <TrackOrderFulfilment result={result} workspaceId={workspaceId} />
            <TrackOrderTransfer result={result} workspaceId={workspaceId} />
            <TrackOrderNotes result={result} />
            {result.updatedAt && (
              <p className="mt-5 text-xs text-ink-soft">
                {t.track.lastUpdate}:{" "}
                {new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.updatedAt))}
              </p>
            )}
          </section>

          {/* What is in it and what it costs; then what the shopper can still do. */}
          <section
            className={`${card} mt-4 p-5 sm:p-6`}
            aria-labelledby={hasItems ? "track-items-title" : undefined}
            aria-label={hasItems ? undefined : t.track.total}
          >
            {hasItems && (
              <>
                <h2 id="track-items-title" className="text-lg font-semibold text-ink">
                  {t.track.items}
                </h2>
                <ul className="mt-3 space-y-3">
                  {result.items.map((item, i) => (
                    <li key={i} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0 text-ink">
                        {item.productNameSnapshot}
                        <span className="text-xs text-ink-soft"> × {item.quantity}</span>
                      </span>
                      <span className="shrink-0 text-ink">{money(item.lineTotalAmount, currency)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <dl className={`space-y-2 text-sm ${hasItems ? "mt-4 border-t border-line pt-4" : ""}`}>
              <div className="flex justify-between">
                <dt className="text-ink-soft">{t.track.subtotal}</dt>
                <dd className="text-ink">{money(result.subtotalAmount, currency)}</dd>
              </div>
              {Number(result.discountAmount) > 0 && (
                <div className="flex justify-between text-success">
                  <dt>{t.track.discount}</dt>
                  <dd>−{money(result.discountAmount, currency)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-soft">{t.track.shipping}</dt>
                <dd className="text-ink">{money(result.shippingAmount, currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-base font-bold text-ink">
                <dt>{t.track.total}</dt>
                <dd>{money(result.totalAmount, currency)}</dd>
              </div>
            </dl>

            <TrackOrderDownloads result={result} />

            <TrackOrderSubscriptions result={result} />

            {/* Cancel the order or change its address, while the store allows it (handoff 220); then read the order again. */}
            {trackingToken && (
              <OrderSelfService
                token={trackingToken}
                workspaceId={workspaceId}
                onChanged={() => void orderTrackingByToken(api, workspaceId, trackingToken).then((found) => found && setResult(found), () => undefined)}
              />
            )}

            {/* Return items, when the store lets shoppers ask (handoff 186). */}
            {trackingToken && <ShopperReturns key={trackingToken} token={trackingToken} workspaceId={workspaceId} />}
          </section>

          <div className="mt-4 flex justify-center">
            <button type="button" onClick={another} className={btnGhost}>
              {x.another}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`${container} flex-1 py-8 sm:py-14`}>
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <SearchIcon size={28} />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-ink sm:text-3xl">{t.track.title}</h1>
          <p className="mt-2 text-sm text-ink-soft">{t.track.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className={`${card} mt-8 space-y-4 p-5 sm:p-6`}>
          <div>
            <label htmlFor="track-phone" className={label}>
              {t.form.phone}
            </label>
            <input
              id="track-phone"
              type="tel"
              inputMode="tel"
              autoComplete={egypt ? "tel-national" : "tel"}
              enterKeyHint="next"
              dir="ltr"
              maxLength={20}
              placeholder={egypt ? t.form.phonePlaceholder : undefined}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              onBlur={() => {
                // Said as soon as the field is left, not only on "Track order".
                if (phone.trim() && !validPhone(phone)) setErrors((prev) => ({ ...prev, phone: phoneError }));
              }}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? "track-phone-error" : undefined}
              className={`${input} text-start rtl:text-end`}
            />
            {errors.phone && (
              <p id="track-phone-error" className="mt-1.5 text-sm font-medium text-danger">
                {errors.phone}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="track-number" className={label}>
              {t.track.orderNumber}
            </label>
            <input
              id="track-number"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              dir="ltr"
              maxLength={60}
              placeholder={reworded("track.orderNumberPlaceholder") ? t.track.orderNumberPlaceholder : x.numberPlaceholder}
              value={number}
              onChange={(e) => {
                setNumber(e.target.value);
                if (errors.number) setErrors((prev) => ({ ...prev, number: undefined }));
              }}
              aria-invalid={errors.number ? true : undefined}
              aria-describedby={errors.number ? "track-number-error" : "track-number-hint"}
              className={`${input} text-start rtl:text-end`}
            />
            {errors.number ? (
              <p id="track-number-error" className="mt-1.5 text-sm font-medium text-danger">
                {errors.number}
              </p>
            ) : (
              <p id="track-number-hint" className="mt-1.5 text-[0.8125rem] text-ink-soft">
                {x.numberHint}
              </p>
            )}
          </div>
          <button type="submit" disabled={busy} aria-busy={busy} className={btnPrimaryLg}>
            {busy ? t.track.searching : t.track.submit}
          </button>
        </form>

        {/* What the lookup answered when it found nothing: said aloud, with what to check. */}
        <div role="alert" className="mt-4 empty:hidden">
          {status === "done" && failure && <p className="rounded-2xl bg-danger-soft px-5 py-4 text-sm font-medium text-danger">{failure}</p>}
          {status === "done" && !failure && miss?.by === "link" && (
            <p className="rounded-2xl bg-danger-soft px-5 py-4 text-sm font-medium text-danger">{x.linkDead}</p>
          )}
          {status === "done" && !failure && miss?.by === "form" && (
            <div className="rounded-2xl bg-danger-soft px-5 py-4 text-sm">
              <p className="font-semibold text-danger">
                {reworded("track.notFound") ? (
                  t.track.notFound
                ) : (
                  <>
                    {x.missBefore}{" "}
                    <bdi dir="ltr" className="font-bold">
                      #{miss.number}
                    </bdi>{" "}
                    {x.missBetween}{" "}
                    <bdi dir="ltr" className="font-bold">
                      {miss.phone}
                    </bdi>
                    .
                  </>
                )}
              </p>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-ink">
                <li>{x.missPhone}</li>
                <li>{x.missNumber}</li>
              </ul>
              {wa && (
                <a
                  href={`https://wa.me/${wa}?text=${encodeURIComponent(x.askMessage(miss.number))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${btnSecondary} mt-3 w-full sm:w-auto`}
                >
                  <WhatsAppIcon size={18} />
                  {x.askStore}
                </a>
              )}
            </div>
          )}
        </div>

        {/* Under the form, so its arriving (it is read from this browser once the page is live) pushes nothing. */}
        {last && (
          <section className={`${card} mt-4 flex flex-wrap items-center justify-between gap-3 p-4`} aria-labelledby="track-last-title">
            <div className="min-w-0">
              <h2 id="track-last-title" className="text-sm font-semibold text-ink">
                {x.lastTitle}
              </h2>
              <bdi dir="ltr" className="mt-0.5 block break-all text-sm tabular-nums text-ink-soft">
                {last.orderNumber}
              </bdi>
            </div>
            <button type="button" onClick={() => void openLast()} disabled={busy} className={`${btnSecondary} shrink-0`}>
              {x.lastOpen}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  ApiError,
  QUOTE_LIMITS,
  apiErrorCode,
  apiFieldProblems,
  isApiErrorCode,
  shopperMe,
  shopperQuoteAccept,
  shopperQuoteDecline,
  shopperQuoteGet,
  type ShopperAddress,
  type ShopperAddressInput,
  type ShopperQuote,
  type ShopperQuoteAccepted,
  type ShopperQuoteAddress,
  type QuoteLine,
} from "@store-builder/api-client";
import { AddressForm } from "@/components/account/AddressForm";
import { CheckIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { btnGhost, btnPrimary, btnPrimaryLg, btnSecondary, card, container, input, label as labelClass, skeleton } from "@/components/ui";
import { pickText } from "@/lib/i18n";
import { orderErrorMessage } from "@/lib/placeOrder";
import { readQuoteToken } from "@/lib/quoteTokens";
import { useShopperApi } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";
import { useIsClient } from "@/lib/useIsClient";
import { QUOTE_TEXT } from "./quoteText";

/**
 * A shopper's quote (/quotes/:id, frontend-handoff 219 and 275): where the
 * request stands, the store's price for each product beside its usual price,
 * the total and the day the offer holds until, and — while it is open —
 * «موافق — اطلب» with a delivery address, or «رفض».
 *
 * The page opens the quote with the token this browser kept when the request
 * was sent (lib/quoteTokens); without it there is nothing it may show. Every
 * amount is the server's: the total is the quote's own, and shipping is added
 * by the order the acceptance makes.
 *
 * Accepting twice makes one order: a 409 QUOTE_NOT_OPEN reads the quote again
 * and, when it turns out accepted, shows the success instead of an error.
 */

const STATUS_TONE: Record<ShopperQuote["status"], string> = {
  new: "bg-accent-soft text-accent-dark",
  quoted: "bg-primary-soft text-primary",
  accepted: "bg-success-soft text-success",
  declined: "bg-line/60 text-ink-soft",
  cancelled: "bg-line/60 text-ink-soft",
  expired: "bg-line/60 text-ink-soft",
};

// The store's button recipes in the danger colour, as the order's own "cancel" has them.
const btnDanger = btnPrimary.replace("bg-primary ", "bg-danger ").replace("hover:bg-primary/90", "hover:bg-danger/90");
const btnDangerOutline = btnSecondary.replace(" text-ink ", " text-danger ").replace("hover:border-primary hover:text-primary", "hover:border-danger");

type Phase = "loading" | "missing" | "error" | "ready";

export function QuotePage() {
  const { workspaceId, quoteId } = useParams<{ workspaceId: string; quoteId: string }>();
  const { t, locale, intlLocale, money, store } = useStore();
  const text = pickText(QUOTE_TEXT, locale);
  const uid = useId();
  const shopper = useShopperApi();
  const { client, storeId } = shopper;
  // localStorage is the browser's: read once hydrated, so the server HTML and the first render agree.
  const isClient = useIsClient();
  const token = useMemo(() => (isClient ? readQuoteToken(storeId, quoteId) : null), [isClient, storeId, quoteId]);

  const [phase, setPhase] = useState<Phase>("loading");
  const [quote, setQuote] = useState<ShopperQuote | null>(null);
  /** The order an acceptance on this page just made: its number and its total with shipping. */
  const [accepted, setAccepted] = useState<ShopperQuoteAccepted | null>(null);
  const [mode, setMode] = useState<"accept" | "decline" | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [savedAddress, setSavedAddress] = useState<ShopperAddress | null>(null);
  const call = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const formBox = useRef<HTMLDivElement>(null);

  /** Reads the quote; answers with it, or null when it could not be read. */
  const load = useCallback(async (): Promise<ShopperQuote | null> => {
    if (!token) return null;
    const id = ++call.current;
    try {
      const fresh = await shopperQuoteGet(client, workspaceId, quoteId, token);
      if (id === call.current) {
        setQuote(fresh);
        setPhase("ready");
      }
      return fresh;
    } catch (err) {
      if (id === call.current) setPhase(err instanceof ApiError && (err.status === 404 || err.status === 422) ? "missing" : "error");
      return null;
    }
  }, [client, workspaceId, quoteId, token]);

  useEffect(() => {
    if (!isClient) return;
    if (!token) {
      setPhase("missing");
      return;
    }
    setPhase("loading");
    void load();
  }, [isClient, token, load]);

  // A signed-in shopper's default address starts the delivery form.
  const open = quote?.status === "quoted";
  const { token: shopperToken, call: shopperCall } = shopper;
  useEffect(() => {
    if (!open || !shopperToken) return;
    let alive = true;
    shopperCall((c, id, current) => shopperMe(c, id, current))
      .then(({ addresses }) => {
        if (alive) setSavedAddress(addresses.find((a) => a.isDefault) ?? addresses[0] ?? null);
      })
      .catch(() => {
        /* the form opens empty */
      });
    return () => {
      alive = false;
    };
  }, [open, shopperToken, shopperCall]);

  useEffect(() => {
    if (mode === "accept") formBox.current?.querySelector<HTMLElement>("select, input, textarea")?.focus();
  }, [mode]);

  const date = (iso: string | null) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "long", year: "numeric" }).format(d) : "";
  };
  const count = (n: number) => new Intl.NumberFormat(intlLocale).format(n);

  /** Brings the quote's new state (accepted, declined, changed) to the top of the screen and to the reader. */
  function showResult() {
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ block: "start" });
      resultRef.current?.focus({ preventScroll: true });
    });
  }

  /** The quote was answered or closed elsewhere (a double tap, another tab, the store): show what it is now. */
  async function stale() {
    const fresh = await load();
    setMode(null);
    // Accepted with its order is the success the shopper was after, not a problem to report (handoff 275).
    // An expired quote says so itself.
    if ((fresh?.status === "accepted" && fresh.orderId) || fresh?.status === "expired") setNotice(null);
    else if (fresh) setNotice(text.closedMeanwhile);
    showResult();
  }

  /** The address form's save: the problem to show in the form, or null once the order is placed. */
  async function accept(form: ShopperAddressInput): Promise<string | null> {
    if (!token) return text.missingBody;
    const shippingAddress: ShopperQuoteAddress = {
      country: form.country,
      province: (form.province ?? "").trim(),
      city: form.city,
      ...(form.area ? { area: form.area } : {}),
      addressLine: form.addressLine,
      ...(form.placeId ? { placeId: form.placeId } : {}),
    };
    try {
      const result = await shopperQuoteAccept(client, workspaceId, quoteId, {
        token,
        shippingAddress,
        ...(notes.trim() ? { notes: notes.trim().slice(0, QUOTE_LIMITS.acceptNotes) } : {}),
      });
      setAccepted(result);
      setQuote(result.quote);
      setMode(null);
      setNotice(null);
      showResult();
      return null;
    } catch (err) {
      if (isApiErrorCode(err, "QUOTE_NOT_OPEN") || isApiErrorCode(err, "QUOTE_EXPIRED")) {
        await stale();
        return null;
      }
      // The shopper can't change a quote's quantities: only the store can offer fewer.
      if (isApiErrorCode(err, "INSUFFICIENT_STOCK")) return text.stockProblem;
      if (apiErrorCode(err) === "SHIPPING_PLACE_UNAVAILABLE") return t.form.errors.placeUnavailable;
      const fields = apiFieldProblems(err).map((p) => p.field);
      if (fields.some((f) => f.endsWith("placeId"))) return t.form.errors.placeUnknown;
      if (fields.some((f) => f.endsWith("province"))) return t.form.errors.governorate;
      if (fields.some((f) => f.endsWith("city"))) return t.form.errors.city;
      if (fields.some((f) => f.endsWith("addressLine"))) return t.form.errors.address;
      if (fields.length > 0) return text.addressProblem;
      return orderErrorMessage(err, t.form.errors, locale);
    }
  }

  async function decline() {
    if (!token || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      setQuote(await shopperQuoteDecline(client, workspaceId, quoteId, token));
      setMode(null);
      setNotice(null);
      showResult();
    } catch (err) {
      if (isApiErrorCode(err, "QUOTE_NOT_OPEN")) await stale();
      else setFailure(text.loadFailed);
    } finally {
      setBusy(false);
    }
  }

  if (phase === "loading") {
    return (
      <main className={`${container} flex-1 py-8 sm:py-10`}>
        <div className="mx-auto max-w-3xl" role="status" aria-busy="true" aria-label={text.loading}>
          <span className={`${skeleton} block h-8 w-1/2`} />
          <span className={`${skeleton} mt-3 block h-5 w-1/3`} />
          <div className={`${card} mt-6 space-y-4 p-5`}>
            <span className={`${skeleton} block h-5 w-2/3`} />
            <span className={`${skeleton} block h-5 w-1/2`} />
            <span className={`${skeleton} block h-5 w-3/5`} />
          </div>
        </div>
      </main>
    );
  }

  if (phase !== "ready" || !quote) {
    const missing = phase === "missing";
    return (
      <main className={`${container} flex-1 py-8 sm:py-10`}>
        <div className={`${card} mx-auto max-w-md px-6 py-12 text-center`} role={missing ? undefined : "alert"}>
          <h1 className="text-lg font-semibold text-ink">{missing ? text.missingTitle : text.metaTitle}</h1>
          <p className="mt-2 text-sm text-ink-soft">{missing ? text.missingBody : text.loadFailed}</p>
          <div className="mt-6 grid gap-2">
            {!missing && (
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  setPhase("loading");
                  void load();
                }}
              >
                {text.retry}
              </button>
            )}
            <StoreLink href="/" className={btnSecondary}>
              {text.backToStore}
            </StoreLink>
          </div>
        </div>
      </main>
    );
  }

  const currency = quote.currency ?? store?.currency ?? "EGP";
  const priced = quote.totalAmount !== null;
  const hint = { new: text.newHint, expired: text.expiredHint, declined: text.declinedHint, cancelled: text.cancelledHint, quoted: null, accepted: null }[quote.status];

  return (
    <main className={`${container} flex-1 py-8 sm:py-10`}>
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
            <bdi>{text.heading(quote.number)}</bdi>
          </h1>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[quote.status]}`}>{text.status[quote.status]}</span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          <bdi>{[quote.contact.fullName, quote.contact.company].filter(Boolean).join(" · ")}</bdi>
          {date(quote.createdAt) && <> · {date(quote.createdAt)}</>}
        </p>

        <div ref={resultRef} tabIndex={-1} className="scroll-mt-28 outline-none" aria-live="polite">
          {notice && <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-sm font-medium text-accent-dark">{notice}</p>}

          {quote.status === "accepted" ? (
            <div className="mt-4 rounded-2xl border border-success/30 bg-success-soft px-5 py-4 text-sm">
              <p className="flex items-center gap-2 text-base font-semibold text-success">
                <CheckIcon size={20} />
                {text.acceptedTitle}
              </p>
              {accepted && (
                <p className="mt-1 font-medium text-ink">
                  <bdi>{text.acceptedOrder(accepted.orderNumber)}</bdi> · {text.acceptedTotal(money(accepted.totalAmount, currency))}
                </p>
              )}
              <p className="mt-1 text-ink-soft">{text.acceptedHint}</p>
              <StoreLink
                href={accepted ? `/track?number=${encodeURIComponent(accepted.orderNumber)}` : "/track"}
                className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
              >
                {text.trackOrder}
              </StoreLink>
            </div>
          ) : (
            hint && <p className="mt-4 rounded-xl bg-paper-raised px-4 py-3 text-sm font-medium text-ink ring-1 ring-line">{hint}</p>
          )}
        </div>

        <section className={`${card} mt-6`} aria-labelledby={`${uid}-items`}>
          <h2 id={`${uid}-items`} className="px-4 pt-4 text-base font-semibold text-ink sm:px-5 sm:pt-5">
            {text.items}
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {quote.lines.map((line) => (
              <QuoteLineRow key={line.variantId} line={line} priced={priced} text={text} money={(amount) => money(amount, currency)} count={count} />
            ))}
          </ul>

          {priced && (
            <div className="border-t border-line px-4 py-4 sm:px-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-base font-semibold text-ink">{text.total}</span>
                <span className="text-xl font-bold text-ink tabular-nums">{money(quote.totalAmount, currency)}</span>
              </div>
              {open && <p className="mt-1 text-xs text-ink-soft">{text.plusShipping}</p>}
              {quote.validUntil && quote.status !== "accepted" && (
                <p className={`mt-2 text-sm font-medium ${quote.status === "expired" ? "text-danger" : "text-ink"}`}>{text.validUntil(date(quote.validUntil))}</p>
              )}
            </div>
          )}
        </section>

        {quote.quotedNote && (
          <section className={`${card} mt-4 p-4 sm:p-5`}>
            <h2 className="text-sm font-semibold text-ink">{text.storeNote}</h2>
            <p dir="auto" className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">
              {quote.quotedNote}
            </p>
          </section>
        )}

        {quote.message && (
          <section className="mt-4 rounded-2xl bg-paper px-4 py-3 sm:px-5">
            <h2 className="text-xs font-semibold text-ink-soft">{text.yourMessage}</h2>
            <p dir="auto" className="mt-1 whitespace-pre-line text-sm text-ink">
              {quote.message}
            </p>
          </section>
        )}

        {open && mode === null && (
          <div className="mt-6 grid gap-2 sm:grid-cols-[1fr_auto]">
            <button
              type="button"
              className={btnPrimaryLg}
              onClick={() => {
                setNotice(null);
                setMode("accept");
              }}
            >
              {text.accept}
            </button>
            <button
              type="button"
              className={btnDangerOutline}
              onClick={() => {
                setNotice(null);
                setFailure(null);
                setMode("decline");
              }}
            >
              {text.decline}
            </button>
          </div>
        )}

        {open && mode === "accept" && (
          <div ref={formBox} className="mt-6">
            <AddressForm
              addressOnly
              title={text.addressTitle}
              canBeDefault={false}
              address={savedAddress ? { ...savedAddress, id: "quote", isDefault: false } : null}
              submitLabel={text.accept}
              busyLabel={text.accepting}
              // The accept call takes no postal code.
              withoutPostalCode
              onSave={accept}
              onCancel={() => setMode(null)}
            >
              <div className="sm:col-span-2">
                <label htmlFor={`${uid}-notes`} className={labelClass}>
                  {text.orderNotes}
                  <span className="ms-1 text-xs font-normal text-ink-soft">({t.common.optional})</span>
                </label>
                <textarea
                  id={`${uid}-notes`}
                  value={notes}
                  maxLength={QUOTE_LIMITS.acceptNotes}
                  rows={2}
                  dir="auto"
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${input} min-h-20 resize-y`}
                />
              </div>
              <p className="text-xs text-ink-soft sm:col-span-2">{text.plusShipping}</p>
            </AddressForm>
          </div>
        )}

        {open && mode === "decline" && (
          <div className="mt-6 space-y-4 rounded-2xl border border-line bg-paper p-4 sm:p-5" role="group" aria-labelledby={`${uid}-decline`}>
            <div>
              <h2 id={`${uid}-decline`} className="text-base font-semibold text-ink">
                {text.declineTitle}
              </h2>
              <p className="mt-0.5 text-sm text-ink-soft">{text.declineBody}</p>
            </div>
            {failure && (
              <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                {failure}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setMode(null)} disabled={busy} className={btnGhost}>
                {text.keep}
              </button>
              <button type="button" onClick={() => void decline()} disabled={busy} aria-busy={busy} className={btnDanger}>
                {busy ? text.declining : text.confirmDecline}
              </button>
            </div>
          </div>
        )}

        {!open && (
          <StoreLink href="/" className={`${btnSecondary} mt-6`}>
            {text.backToStore}
          </StoreLink>
        )}
      </div>
    </main>
  );
}

/** One product of the request: how many, the store's usual price, and — once quoted — the price offered and the line's total. */
function QuoteLineRow({
  line,
  priced,
  text,
  money,
  count,
}: {
  line: QuoteLine;
  /** The quote has the store's prices. */
  priced: boolean;
  text: (typeof QUOTE_TEXT)["en"];
  money: (amount: string | null) => string;
  count: (n: number) => string;
}) {
  const options = Object.values(line.optionValues ?? {})
    .filter(Boolean)
    .join(" / ");
  const offered = priced && line.unitPrice !== null;
  const leftOut = priced && line.unitPrice === null;
  // The usual price is crossed out only when the offer is below it; both figures are the server's.
  const lower = offered && line.listPrice !== null && Number(line.listPrice) > Number(line.unitPrice);

  return (
    <li className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5 ${leftOut ? "opacity-70" : ""}`}>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-semibold text-ink">
          <bdi>{line.productName ?? text.unknownProduct}</bdi>
        </p>
        {options && (
          <p className="text-xs text-ink-soft">
            <bdi>{options}</bdi>
          </p>
        )}
        <p className="mt-1 text-sm text-ink">
          {text.quantity}: <span className="font-medium tabular-nums">{count(leftOut ? line.requestedQuantity : line.quantity)}</span>
          {offered && line.quantity !== line.requestedQuantity && <span className="ms-2 text-xs text-ink-soft">{text.askedFor(count(line.requestedQuantity))}</span>}
        </p>
        {line.note && (
          <p dir="auto" className="mt-1 text-xs text-ink-soft">
            {line.note}
          </p>
        )}
      </div>

      <div className="text-end text-sm">
        {leftOut ? (
          <p className="font-medium text-ink-soft">{text.notOffered}</p>
        ) : offered ? (
          <>
            <p className="text-base font-bold text-ink tabular-nums">{money(line.lineTotal)}</p>
            <p className="text-xs text-ink-soft">
              {text.yourPrice}: <span className="font-medium text-ink tabular-nums">{money(line.unitPrice)}</span> {text.each}
            </p>
            {line.listPrice !== null && line.listPrice !== line.unitPrice && (
              <p className="text-xs text-ink-soft">
                {text.listPrice}: <span className={`tabular-nums ${lower ? "line-through" : ""}`}>{money(line.listPrice)}</span>
              </p>
            )}
          </>
        ) : (
          line.listPrice !== null && (
            <p className="text-xs text-ink-soft">
              {text.listPrice}: <span className="font-medium text-ink tabular-nums">{money(line.listPrice)}</span> {text.each}
            </p>
          )
        )}
      </div>
    </li>
  );
}

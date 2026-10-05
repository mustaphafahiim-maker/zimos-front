"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { ApiError, orderTrackingByToken, type TrackResult } from "@store-builder/api-client";
import { isEgyptianMobile, normalizePhone } from "@/lib/egypt";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { useStoreCountry } from "@/lib/storeCountry";
import { SearchIcon } from "./Icons";
import { TrackOrderProgress } from "./TrackOrderProgress";
import { TrackOrderNotes } from "./TrackOrderNotes";
import { TrackOrderDownloads } from "./TrackOrderDownloads";
import { TrackOrderTransfer } from "./TrackOrderTransfer";
import { btnPrimaryLg, card, container, input, label } from "./ui";

const api = createStorefrontApiClient();

export function TrackOrder() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { t, intlLocale, money } = useStore();
  // The store's own country's numbers, as its checkout takes them (lib/orderForm validateOrderForm):
  // an Egyptian mobile in Egypt, a full number elsewhere.
  const egypt = useStoreCountry() === "EG";
  const validPhone = (raw: string) => (egypt ? isEgyptianMobile(raw) : /^\+?\d{8,15}$/.test(normalizePhone(raw)));

  const [phone, setPhone] = useState("");
  const [number, setNumber] = useState("");
  const [errors, setErrors] = useState<{ phone?: string; number?: string }>({});
  // A link the store sent (…/track?number=ORD-…) arrives with the number filled in.
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get("number");
    if (fromLink) setNumber(fromLink.slice(0, 60));
  }, []);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<TrackResult | null>(null);
  /** Set only when the lookup itself failed; a clean miss shows `t.track.notFound`. */
  const [failure, setFailure] = useState<string | null>(null);

  // A signed tracking link (…/track?t=<token>, from the store's messages or "Copy
  // tracking link") opens its order straight away, with no phone number to type.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("t");
    if (!token) return;
    let stale = false;
    setStatus("loading");
    orderTrackingByToken(api, workspaceId, token)
      .then((found) => {
        if (stale) return;
        setResult(found);
        if (found) setNumber(found.orderNumber);
      })
      .catch(() => {
        if (!stale) setResult(null);
      })
      .finally(() => {
        if (!stale) setStatus("done");
      });
    return () => {
      stale = true;
    };
  }, [workspaceId]);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!validPhone(phone)) next.phone = egypt ? t.form.errors.phone : t.form.errors.phoneIntl;
    if (!number.trim()) next.number = t.track.errors.orderNumber;
    setErrors(next);
    if (next.phone) return document.getElementById("track-phone")?.focus();
    if (next.number) return document.getElementById("track-number")?.focus();

    setStatus("loading");
    setFailure(null);
    setResult(null);
    try {
      // The API takes digits only and normalizes local vs. international itself.
      // A "#" typed in front of the order number isn't part of it.
      const found = await api.trackOrder(
        workspaceId,
        // Digits only (the API refuses a "+"); it normalizes the number as the checkout did.
        normalizePhone(phone).replace(/^\+/, ""),
        number.replace(/^#/, "").trim()
      );
      setResult(found);
    } catch (err) {
      setResult(null);
      setFailure(lookupError(err));
    } finally {
      setStatus("done");
    }
  }

  // Every amount in one result is in the order's own currency, not the store's
  // current one — an order placed before a currency change still adds up.
  const currency = result?.currency;

  return (
    <main className={`${container} flex-1 py-10 sm:py-14`}>
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
              dir="ltr"
              placeholder={egypt ? t.form.phonePlaceholder : undefined}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? "track-phone-error" : undefined}
              className={`${input} text-start rtl:text-end`}
            />
            {errors.phone && (
              <p id="track-phone-error" className="mt-1 text-xs font-medium text-danger">
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
              dir="ltr"
              placeholder={t.track.orderNumberPlaceholder}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              aria-invalid={errors.number ? true : undefined}
              aria-describedby={errors.number ? "track-number-error" : undefined}
              className={`${input} text-start rtl:text-end`}
            />
            {errors.number && (
              <p id="track-number-error" className="mt-1 text-xs font-medium text-danger">
                {errors.number}
              </p>
            )}
          </div>
          <button type="submit" disabled={status === "loading"} className={btnPrimaryLg}>
            {status === "loading" ? t.track.searching : t.track.submit}
          </button>
        </form>

        <div aria-live="polite" className="mt-6">
          {status === "done" && !result && (
            <p className="rounded-2xl bg-danger-soft px-5 py-4 text-sm text-danger">
              {failure ?? t.track.notFound}
            </p>
          )}
          {status === "done" && result && (
            <section className={`${card} p-5 sm:p-6`} aria-labelledby="track-status-title">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="track-status-title" className="text-lg font-semibold text-ink">
                  {t.track.status}
                </h2>
                <span dir="ltr" className="text-sm font-bold text-ink">
                  #{result.orderNumber}
                </span>
              </div>
              <TrackOrderProgress result={result} />

              {result.items.length > 0 && (
                <>
                  <h3 className="mt-6 text-sm font-semibold text-ink">{t.track.items}</h3>
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

              <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
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

              <TrackOrderTransfer result={result} workspaceId={workspaceId} />

              <TrackOrderNotes result={result} />

              {result.updatedAt && (
                <p className="mt-5 text-xs text-ink-soft">
                  {t.track.lastUpdate}:{" "}
                  {new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(
                    new Date(result.updatedAt)
                  )}
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

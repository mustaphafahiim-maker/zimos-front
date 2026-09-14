"use client";

import { useId, useState, type FormEvent } from "react";
import { ApiError } from "@store-builder/api-client";
import { btnPrimary, card, input, label as labelClass } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { submitProductReview, type ProductRating, type PublicReview } from "@/lib/publicApi";
import { useStore } from "@/lib/StoreContext";

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span aria-hidden className="inline-flex text-warning" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <svg key={n} viewBox="0 0 24 24" width={size} height={size}>
            <defs>
              <linearGradient id={`star-${n}-${Math.round(fill * 100)}`}>
                <stop offset={`${fill * 100}%`} stopColor="currentColor" />
                <stop offset={`${fill * 100}%`} stopColor="var(--color-line-strong, #cbd5e1)" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#star-${n}-${Math.round(fill * 100)})`}
              d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z"
            />
          </svg>
        );
      })}
    </span>
  );
}

/** Average + count next to the product title; links to the reviews section. */
export function RatingSummary({ rating }: { rating: ProductRating }) {
  const { t, intlLocale } = useStore();
  if (rating.count === 0 || rating.average === null) return null;
  const avg = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 1 }).format(rating.average);
  return (
    <a href="#reviews" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-ink-soft hover:text-primary">
      <Stars value={rating.average} />
      <span className="sr-only">{t.reviews.average(avg)}</span>
      <span aria-hidden className="font-semibold text-ink">
        {avg}
      </span>
      <span>({t.reviews.count(rating.count)})</span>
    </a>
  );
}

export function ReviewsSection({
  workspaceId,
  productId,
  rating,
  reviews,
}: {
  workspaceId: string;
  productId: string;
  rating: ProductRating;
  reviews: PublicReview[];
}) {
  const { t, intlLocale } = useStore();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ rating?: string; phone?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const dateFmt = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" });
  const avg =
    rating.average !== null ? new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 1 }).format(rating.average) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const found: typeof errors = {};
    if (stars < 1 || stars > 5) found.rating = t.reviews.errors.rating;
    if (phone.replace(/\D/g, "").length < 6) found.phone = t.reviews.errors.phone;
    setErrors(found);
    if (found.rating) {
      document.getElementById(`${uid}-star-5`)?.focus();
      return;
    }
    if (found.phone) {
      document.getElementById(`${uid}-phone`)?.focus();
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await submitProductReview(createStorefrontApiClient(), workspaceId, productId, {
        phone: phone.trim(),
        rating: stars,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "NO_DELIVERED_PURCHASE") setFormError(t.reviews.errors.notPurchased);
      else if (err instanceof ApiError && err.status === 422) setFormError(t.reviews.errors.invalid);
      else setFormError(t.reviews.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="reviews-title" className="text-xl font-semibold text-ink">
            {t.reviews.title}
          </h2>
          {avg !== null && (
            <p className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
              <Stars value={rating.average ?? 0} />
              <span>
                {t.reviews.average(avg)} · {t.reviews.count(rating.count)}
              </span>
            </p>
          )}
        </div>
        {!open && !done && (
          <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls={`${uid}-form`} className={btnPrimary}>
            {t.reviews.write}
          </button>
        )}
      </div>

      {done && (
        <p role="status" className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">
          {t.reviews.success}
        </p>
      )}

      {open && !done && (
        <form id={`${uid}-form`} onSubmit={handleSubmit} noValidate className={`${card} mt-4 space-y-4 p-5 sm:p-6`}>
          <p className="text-sm text-ink-soft">{t.reviews.formHint}</p>

          <fieldset aria-describedby={errors.rating ? `${uid}-rating-error` : undefined}>
            <legend className={labelClass}>
              {t.reviews.rating}
              <span className="text-danger" aria-hidden>
                {" "}*
              </span>
            </legend>
            {/* Native radios keep arrow-key navigation and screen-reader semantics. */}
            <div className="flex gap-1" dir="ltr">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="relative cursor-pointer">
                  <input
                    id={`${uid}-star-${n}`}
                    type="radio"
                    name={`${uid}-rating`}
                    value={n}
                    checked={stars === n}
                    onChange={() => {
                      setStars(n);
                      setErrors((p) => ({ ...p, rating: undefined }));
                    }}
                    className="peer sr-only"
                  />
                  <span className="sr-only">{t.reviews.star(n)}</span>
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    width="32"
                    height="32"
                    className={`m-1.5 rounded peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary ${
                      n <= stars ? "text-warning" : "text-line-strong"
                    }`}
                  >
                    <path fill="currentColor" d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z" />
                  </svg>
                </label>
              ))}
            </div>
            {errors.rating && (
              <p id={`${uid}-rating-error`} className="mt-1 text-xs font-medium text-danger">
                {errors.rating}
              </p>
            )}
          </fieldset>

          <div>
            <label htmlFor={`${uid}-comment`} className={labelClass}>
              {t.reviews.comment}
              <span className="ms-1 text-xs font-normal text-ink-muted">({t.common.optional})</span>
            </label>
            <textarea
              id={`${uid}-comment`}
              rows={3}
              maxLength={2000}
              value={comment}
              placeholder={t.reviews.commentPlaceholder}
              onChange={(e) => setComment(e.target.value)}
              className={`${input} min-h-24 resize-y`}
            />
          </div>

          <div>
            <label htmlFor={`${uid}-phone`} className={labelClass}>
              {t.reviews.phone}
              <span className="text-danger" aria-hidden>
                {" "}*
              </span>
            </label>
            <input
              id={`${uid}-phone`}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              dir="ltr"
              required
              maxLength={32}
              value={phone}
              placeholder={t.form.phonePlaceholder}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? `${uid}-phone-error` : undefined}
              onChange={(e) => {
                setPhone(e.target.value);
                setErrors((p) => ({ ...p, phone: undefined }));
              }}
              className={`${input} text-start rtl:text-end`}
            />
            {errors.phone && (
              <p id={`${uid}-phone-error`} className="mt-1 text-xs font-medium text-danger">
                {errors.phone}
              </p>
            )}
          </div>

          <div role="alert" aria-live="assertive" className="empty:hidden">
            {formError && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</p>}
          </div>

          <button type="submit" disabled={submitting} aria-busy={submitting} className={btnPrimary}>
            {submitting ? t.reviews.submitting : t.reviews.submit}
          </button>
        </form>
      )}

      {reviews.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">{t.reviews.noReviews}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {reviews.map((r, i) => (
            <li key={`${r.createdAt}-${i}`} className="rounded-2xl border border-line bg-paper-raised p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Stars value={r.rating} />
                  <span className="sr-only">{t.reviews.star(r.rating)}</span>
                </span>
                {r.createdAt && (
                  <time dateTime={r.createdAt} className="text-xs text-ink-muted">
                    {dateFmt.format(new Date(r.createdAt))}
                  </time>
                )}
              </div>
              {r.comment && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

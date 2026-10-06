"use client";

import { useState, type FormEvent } from "react";
import {
  ApiError,
  storefrontSubmitReview,
  type StorefrontRatingSummary,
  type StorefrontReview,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { getVisitorId } from "@/lib/visitorId";
import { ReviewPhotoPicker, useReviewPhotos } from "./ReviewPhotoPicker";
import { btnPrimary, btnSecondary, card, input, label as labelClass } from "../ui";
import { pickText } from "@/lib/i18n";

/**
 * Reviews on the product page (SPEC §7.7): the average and how the stars
 * split, the approved reviews with their photos, and the form. Only a shopper
 * who received the product can review it — the server checks the order number
 * and the phone against a delivered order — and a new review waits for the merchant's
 * approval, so nothing here is ever invented or shown unmoderated.
 */

const TEXT = {
  en: {
    title: "Customer reviews",
    basedOn: (n: number) => (n === 1 ? "Based on 1 review" : `Based on ${n} reviews`),
    none: "No reviews yet. Bought it? Be the first to review it.",
    verified: "Verified buyer",
    anonymous: "Customer",
    write: "Write a review",
    formTitle: "Your review",
    formHint: "Use the order number and mobile number from your order confirmation. Only customers who received this product can review it.",
    orderNumber: "Order number",
    phone: "Mobile number",
    rating: "Your rating",
    stars: (n: number) => `${n} out of 5`,
    comment: "Your review (optional)",
    submit: "Send review",
    sending: "Sending…",
    cancel: "Cancel",
    thanks: "Thank you! Your review will appear once the store approves it.",
    notBuyer: "We couldn't find a delivered order of this product with this order number and mobile number.",
    phoneRequired: "Enter the mobile number you ordered with.",
    orderRequired: "Enter your order number — it's on your order confirmation.",
    photos: "Photos (optional, up to 3)",
    addPhoto: "Add a photo",
    removePhoto: (n: number) => `Remove photo ${n}`,
    waitPhotos: "Wait for your photos to finish uploading.",
    photoExpired: "A photo has expired — remove it and add it again.",
    tooFast: "Too many tries — wait a minute and try again.",
    failed: "Your review wasn't sent — try again.",
    photoAlt: "Customer photo",
  },
  ar: {
    title: "تقييمات العملاء",
    basedOn: (n: number) => `بناءً على ${n} تقييم`,
    none: "لا توجد تقييمات بعد. اشتريته؟ كن أول من يقيّمه.",
    verified: "مشترٍ موثّق",
    anonymous: "عميل",
    write: "اكتب تقييمًا",
    formTitle: "تقييمك",
    formHint: "اكتب رقم الطلب ورقم الموبايل اللي في تأكيد طلبك. التقييم متاح فقط لمن استلم هذا المنتج.",
    orderNumber: "رقم الطلب",
    phone: "رقم الموبايل",
    rating: "تقييمك",
    stars: (n: number) => `${n} من 5`,
    comment: "رأيك (اختياري)",
    submit: "إرسال التقييم",
    sending: "جارٍ الإرسال…",
    cancel: "إلغاء",
    thanks: "شكرًا لك! سيظهر تقييمك بعد موافقة المتجر.",
    notBuyer: "لم نجد طلبًا مستلَمًا لهذا المنتج برقم الطلب ورقم الموبايل دول.",
    phoneRequired: "اكتب رقم الموبايل الذي طلبت به.",
    orderRequired: "اكتب رقم الطلب — موجود في تأكيد طلبك.",
    photos: "صور (اختياري، لحد 3)",
    addPhoto: "أضف صورة",
    removePhoto: (n: number) => `شيل الصورة ${n}`,
    waitPhotos: "استنى لحد ما الصور تخلص رفع.",
    photoExpired: "صورة انتهت صلاحيتها — شيلها وضيفها تاني.",
    tooFast: "محاولات كتير — استنى دقيقة وجرّب تاني.",
    failed: "لم يتم إرسال تقييمك — حاول مرة أخرى.",
    photoAlt: "صورة من العميل",
  },
};

function Stars({ rating, label, size = "text-base" }: { rating: number; label: string; size?: string }) {
  const full = Math.round(rating);
  return (
    <span role="img" aria-label={label} dir="ltr" className={`${size} leading-none tracking-tight text-primary`}>
      {"★".repeat(full)}
      <span className="text-line">{"★".repeat(5 - full)}</span>
    </span>
  );
}

export function ProductReviews({
  workspaceId,
  productId,
  rating,
  reviews,
  formOnly = false,
}: {
  workspaceId: string;
  productId: string;
  rating: StorefrontRatingSummary;
  reviews: StorefrontReview[];
  /** The builder's review_form element: only the button and the form, no summary or list. */
  formOnly?: boolean;
}) {
  const { locale, intlLocale } = useStore();
  const text = pickText(TEXT, locale);
  const [open, setOpen] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const photos = useReviewPhotos(workspaceId);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (orderNumber.trim().length < 3) {
      setError(text.orderRequired);
      return;
    }
    if (photos.uploading) {
      setError(text.waitPhotos);
      return;
    }
    if (phone.trim().length < 6) {
      setError(text.phoneRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await storefrontSubmitReview(
        createStorefrontApiClient(),
        workspaceId,
        productId,
        {
          orderNumber: orderNumber.trim(),
          phone: phone.trim(),
          rating: stars,
          ...(comment.trim() ? { comment: comment.trim() } : {}),
          ...(photos.ids.length > 0 ? { photoIds: photos.ids } : {}),
        },
        getVisitorId(workspaceId)
      );
      setSent(true);
      setOpen(false);
      photos.reset();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      setError(
        code === "REVIEW_NOT_VERIFIED"
          ? text.notBuyer
          : code === "REVIEW_PHOTO_INVALID"
            ? text.photoExpired
            : err instanceof ApiError && err.status === 429
              ? text.tooFast
              : text.failed
      );
    } finally {
      setBusy(false);
    }
  }

  const date = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(intlLocale, { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <section aria-labelledby="product-reviews-title" className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!formOnly && (
          <h2 id="product-reviews-title" className="text-xl font-semibold text-ink">
            {text.title}
          </h2>
        )}
        {!open && !sent && (
          <button type="button" className={btnSecondary} onClick={() => setOpen(true)}>
            {text.write}
          </button>
        )}
      </div>

      {formOnly ? null : rating.count > 0 && rating.average !== null ? (
        <div className={`${card} mt-4 grid gap-5 p-5 sm:grid-cols-[12rem_1fr] sm:items-center`}>
          <div className="text-center">
            <p className="text-4xl font-bold text-ink" dir="ltr">
              {rating.average.toFixed(1)}
            </p>
            <Stars rating={rating.average} label={text.stars(rating.average)} size="text-xl" />
            <p className="mt-1 text-sm text-ink-soft">{text.basedOn(rating.count)}</p>
          </div>
          <ul className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((n) => {
              const count = rating.distribution[String(n)] ?? 0;
              const pct = rating.count ? Math.round((count / rating.count) * 100) : 0;
              return (
                <li key={n} className="flex items-center gap-3 text-sm text-ink-soft">
                  <span className="w-8 shrink-0 tabular-nums" dir="ltr">
                    {n} ★
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-8 shrink-0 text-end tabular-nums">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-soft">{text.none}</p>
      )}

      <p role="status" className="mt-4 rounded-xl bg-primary-soft px-4 py-3 text-sm font-medium text-primary empty:hidden">
        {sent ? text.thanks : ""}
      </p>

      {open && (
        <form onSubmit={submit} noValidate className={`${card} mt-4 space-y-4 p-5`}>
          <div>
            <h3 className="text-base font-semibold text-ink">{text.formTitle}</h3>
            <p className="mt-1 text-sm text-ink-soft">{text.formHint}</p>
          </div>
          <fieldset>
            <legend className={labelClass}>{text.rating}</legend>
            <div className="flex gap-1" dir="ltr">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={text.stars(n)}
                  aria-pressed={stars === n}
                  onClick={() => setStars(n)}
                  className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    n <= stars ? "text-primary" : "text-line"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="review-order" className={labelClass}>
              {text.orderNumber}
            </label>
            <input
              id="review-order"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              dir="ltr"
              maxLength={40}
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="review-phone" className={labelClass}>
              {text.phone}
            </label>
            <input
              id="review-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="review-comment" className={labelClass}>
              {text.comment}
            </label>
            <textarea
              id="review-comment"
              rows={4}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className={input}
            />
          </div>
          <ReviewPhotoPicker state={photos} text={text} />
          <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger empty:hidden">
            {error}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? text.sending : text.submit}
            </button>
            <button type="button" disabled={busy} className={btnSecondary} onClick={() => setOpen(false)}>
              {text.cancel}
            </button>
          </div>
        </form>
      )}

      {!formOnly && reviews.length > 0 && (
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id} className={`${card} space-y-3 p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{review.authorName || text.anonymous}</span>
                  {review.verified && (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                      ✓ {text.verified}
                    </span>
                  )}
                </div>
                <span className="text-xs text-ink-soft">{date(review.createdAt)}</span>
              </div>
              <Stars rating={review.rating} label={text.stars(review.rating)} />
              {review.comment && (
                <p dir="auto" className="whitespace-pre-line text-sm leading-relaxed text-ink">
                  {review.comment}
                </p>
              )}
              {review.photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {review.photos.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={text.photoAlt}
                        loading="lazy"
                        className="h-20 w-20 rounded-xl border border-line object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

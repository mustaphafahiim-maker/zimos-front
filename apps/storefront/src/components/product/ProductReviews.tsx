"use client";

import {
  type StorefrontRatingSummary,
  type StorefrontReview,
} from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { card } from "../ui";
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
  /** The builder's review_form element: the form only, which is not offered (public reviews are closed). */
  formOnly?: boolean;
}) {
  const { locale, intlLocale } = useStore();
  const text = pickText(TEXT, locale);
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

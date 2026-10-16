"use client";

import { useState } from "react";
import { orderTrackingExtras, type OrderTrackingStepKey, type TrackResult } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { CheckIcon } from "./Icons";
import { StatusTimeline } from "./StatusTimeline";

/**
 * Where the order is (SPEC §14.7): the five steps with their times, a clear
 * message when the order stopped (cancelled, returned, delivery failed), the
 * courier with its waybill number, and a tracking link to copy. Falls back to
 * the four-stage timeline when the API is an older one without these fields.
 */

const STRINGS = {
  en: {
    placed: "Order placed",
    confirmed: "Confirmed",
    shipped: "Shipped",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    current: "Current step",
    done: "Completed",
    cancelled: "This order was cancelled.",
    returned: "This order was returned to the store.",
    delivery_failed: "The courier could not deliver this order. The store will contact you to arrange another attempt.",
    courier: "Courier",
    waybill: "Waybill number",
    courierTrack: "Track with the courier",
    copy: "Copy tracking link",
    copied: "Link copied",
    copyHint: "Anyone with this link can see this order's status.",
  },
  ar: {
    placed: "تم استلام الطلب",
    confirmed: "تم التأكيد",
    shipped: "تم الشحن",
    out_for_delivery: "في الطريق إليك",
    delivered: "تم التسليم",
    current: "الخطوة الحالية",
    done: "تمت",
    cancelled: "تم إلغاء هذا الطلب.",
    returned: "تم إرجاع هذا الطلب إلى المتجر.",
    delivery_failed: "لم يتمكن المندوب من تسليم الطلب. سيتواصل معك المتجر لترتيب محاولة أخرى.",
    courier: "شركة الشحن",
    waybill: "رقم البوليصة",
    courierTrack: "التتبع عند شركة الشحن",
    copy: "نسخ رابط التتبع",
    copied: "تم نسخ الرابط",
    copyHint: "أي شخص معه هذا الرابط يمكنه رؤية حالة هذا الطلب.",
  },
};

export function TrackOrderProgress({ result }: { result: TrackResult }) {
  const { intlLocale } = useStore();
  const t = intlLocale.startsWith("ar") ? STRINGS.ar : STRINGS.en;
  const { steps, state, shipment, trackingToken } = orderTrackingExtras(result);
  const [copied, setCopied] = useState(false);

  if (!steps || steps.length === 0) return <StatusTimeline stage={result.stage} />;

  const stopped = state && state !== "active";
  const when = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" });
  // The first step not reached yet is the one in progress — unless the order stopped.
  const currentIndex = stopped ? -1 : steps.findIndex((s) => !s.reached);

  async function copyLink() {
    if (!trackingToken) return;
    const url = `${window.location.origin}${window.location.pathname}?t=${encodeURIComponent(trackingToken)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // No clipboard permission: show the link so it can be copied by hand.
      window.prompt(t.copy, url);
    }
  }

  return (
    <div>
      {stopped && (
        <p role="status" className="mb-5 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {t[state as "cancelled" | "returned" | "delivery_failed"]}
        </p>
      )}

      <ol className="relative">
        {steps.map((step, i) => {
          const done = step.reached;
          const current = i === currentIndex;
          const last = i === steps.length - 1;
          return (
            <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0" aria-current={current ? "step" : undefined}>
              {!last && (
                <span
                  aria-hidden
                  className={`absolute start-[1.1875rem] top-10 h-[calc(100%-2.5rem)] w-0.5 ${done && steps[i + 1].reached ? "bg-primary" : "bg-line"}`}
                />
              )}
              <span
                className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                  done
                    ? "border-primary bg-primary text-on-primary"
                    : current
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-line bg-paper-raised text-ink-soft"
                }`}
              >
                {done ? <CheckIcon size={18} /> : i + 1}
              </span>
              <div className="pt-1.5">
                <p className={`text-sm font-semibold ${done || current ? "text-ink" : "text-ink-soft"}`}>
                  {t[step.key as OrderTrackingStepKey] ?? step.key}
                  {current && <span className="ms-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">{t.current}</span>}
                  {done && <span className="sr-only"> — {t.done}</span>}
                </p>
                {done && step.at && <p className="mt-0.5 text-xs text-ink-soft">{when.format(new Date(step.at))}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {shipment && (shipment.carrier || shipment.waybillNumber) && (
        <dl className="mt-6 space-y-2 rounded-2xl border border-line bg-paper px-4 py-3 text-sm">
          {shipment.carrier && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">{t.courier}</dt>
              <dd className="font-medium text-ink">{shipment.carrier}</dd>
            </div>
          )}
          {shipment.waybillNumber && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">{t.waybill}</dt>
              <dd dir="ltr" className="select-all font-medium text-ink">
                {shipment.waybillNumber}
              </dd>
            </div>
          )}
          {shipment.trackingUrl && /^https?:\/\//.test(shipment.trackingUrl) && (
            <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
              {t.courierTrack}
            </a>
          )}
        </dl>
      )}

      {trackingToken && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex min-h-11 items-center rounded-xl border border-line bg-paper-raised px-4 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary"
          >
            {copied ? t.copied : t.copy}
          </button>
          <p className="mt-1 text-xs text-ink-soft">{t.copyHint}</p>
        </div>
      )}
    </div>
  );
}

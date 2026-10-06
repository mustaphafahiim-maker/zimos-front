"use client";

import { deliveryEstimateOf, orderTrackingExtras, type TrackResult } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { deliveryRangeText } from "@/lib/buyInfo";
import { TruckIcon } from "./Icons";

/**
 * Order tracking: the delivery window promised at checkout (handoff 199,
 * `deliveryEstimate`), while the order is still on its way — not once it was
 * delivered, cancelled or returned.
 */
export function TrackDeliveryEstimate({ result }: { result: TrackResult }) {
  const { t, intlLocale } = useStore();
  const estimate = deliveryEstimateOf(result);
  const { state } = orderTrackingExtras(result);
  if (!estimate || result.stage >= 3 || (state && state !== "active")) return null;
  const text = deliveryRangeText(estimate, t.buyInfo, intlLocale);
  if (!text) return null;
  return (
    <p className="mt-4 flex items-start gap-2 rounded-xl bg-primary-soft px-3.5 py-2.5 text-sm">
      <TruckIcon size={18} className="mt-0.5 shrink-0 text-primary" />
      <span className="min-w-0">
        <span className="block text-ink-soft">{t.buyInfo.deliveryExpected}</span>
        <span className="font-semibold text-ink">{text}</span>
      </span>
    </p>
  );
}

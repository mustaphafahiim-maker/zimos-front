import { deliveryEstimateOf, type Order } from "@store-builder/api-client";
import { formatDay } from "@/lib/wholeNumber";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { range: "Expected delivery: {from} – {to}", day: "Expected delivery: {date}" },
  ar: { range: "التوصيل المتوقع: من {from} لـ {to}", day: "التوصيل المتوقع: {date}" },
} satisfies Messages;

const DAY: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };

/**
 * The delivery window the customer was shown at checkout (handoff 199,
 * `shippingSnapshot.deliveryEstimate`), under the shipping line — what the
 * confirmation call can promise. Nothing when the store showed none.
 */
export function DeliveryEstimateNote({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const estimate = deliveryEstimateOf(order);
  if (!estimate) return null;
  const from = formatDay(estimate.from, DAY);
  const to = formatDay(estimate.to, DAY);
  if (!from || !to) return null;
  return <p className="text-end text-xs text-ink-soft">{from === to ? fmt(t.day, { date: from }) : fmt(t.range, { from, to })}</p>;
}

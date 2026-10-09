import { HOLIDAY_ORDER_TAG, PICKUP_ORDER_TAG, ordersMeta, type Order } from "@store-builder/api-client";
import { StatusBadge } from "@/components/StatusBadge";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useFulfilmentTag } from "./fulfilmentTags";

// Handoff 375: an order sent as several parcels whose next one is not on the road yet.
const STRINGS = {
  en: { partlyShipped: "Partly shipped" },
  ar: { partlyShipped: "اتشحن جزء" },
} satisfies Messages;

/**
 * Orders list → among a row's status chips: «إجازة» for an order taken during
 * a "take orders, ship later" holiday (handoff 216) and «استلام من الفرع» for
 * a click-and-collect order (handoff 225). Said whether or not the optional
 * tags column is shown — the table hides it by default — like «اتغلّف»
 * (packing/PackingEntryPoints OrderPackedBadge); the tags column says it too
 * when shown.
 */
export function OrderFulfilmentBadges({ order }: { order: Order }) {
  const holiday = useFulfilmentTag(HOLIDAY_ORDER_TAG);
  const pickup = useFulfilmentTag(PICKUP_ORDER_TAG);
  const tags = new Set(ordersMeta(order).tags.map((tag) => tag.trim().toLowerCase()));
  const t = useT(STRINGS);
  const partlyShipped = order.fulfillmentState === "partially_fulfilled" && (order.stage === "delivered" || order.stage === "ready_to_ship");
  return (
    <>
      {partlyShipped && <StatusBadge value="partially_fulfilled" tone="info" text={t.partlyShipped} />}
      {holiday && tags.has(HOLIDAY_ORDER_TAG) && <StatusBadge value={HOLIDAY_ORDER_TAG} tone={holiday.tone} text={holiday.text} />}
      {pickup && tags.has(PICKUP_ORDER_TAG) && <StatusBadge value={PICKUP_ORDER_TAG} tone={pickup.tone} text={pickup.text} />}
    </>
  );
}

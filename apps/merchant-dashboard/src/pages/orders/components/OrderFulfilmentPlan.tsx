import { IconHoliday } from "@/components/icons";
import { orderHolidayOf, type Order } from "@store-builder/api-client";
import { formatDate } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { OrderDeliveryTime } from "@/pages/deliverySlots/OrderDeliveryTime";
import { OrderPickupBlock } from "@/pages/pickup/OrderPickupBlock";

const STRINGS = {
  en: {
    holidayOrder: "Placed during the holiday.",
    holidayShips: "Placed during the holiday. The customer was told it ships from {date}.",
  },
  ar: {
    holidayOrder: "الطلب اتعمل في الإجازة.",
    holidayShips: "الطلب اتعمل في الإجازة. العميل اتقال له إنه هيتشحن من {date}.",
  },
} satisfies Messages;

/** An order taken during a "ship later" holiday: when the customer was told it ships. */
function OrderHolidayNote({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const holiday = orderHolidayOf(order);
  if (!holiday) return null;
  return (
    <p className="flex items-start gap-2 rounded-[var(--radius-card)] bg-accent-soft px-4 py-3 text-sm font-medium text-accent-dark">
      <IconHoliday className="mt-0.5 size-4 shrink-0" aria-hidden />
      {holiday.shipsFrom ? fmt(t.holidayShips, { date: formatDate(holiday.shipsFrom) }) : t.holidayOrder}
    </p>
  );
}

/**
 * What an order page says about how the order reaches the customer, beyond
 * the address in its header — each part only when the order has it:
 *   - the note of an order taken during a holiday (handoff 216);
 *   - the pickup place with «جاهز» / «تسليم», in the place of the address a
 *     click-and-collect order does not have (handoff 225);
 *   - «ميعاد التوصيل» with «تغيير» (handoff 221).
 * Mounted once on the order page, right under the header.
 */
export function OrderFulfilmentPlan({ order, onChanged }: { order: Order; onChanged: () => void }) {
  return (
    <>
      <OrderHolidayNote order={order} />
      <OrderPickupBlock order={order} onChanged={onChanged} />
      <OrderDeliveryTime order={order} onChanged={onChanged} />
    </>
  );
}

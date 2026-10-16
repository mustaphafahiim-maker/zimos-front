import { IconHoliday } from "@/components/icons";
import { orderHolidayOf, type Order } from "@store-builder/api-client";
import { formatDate } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    holidayOrder: "Placed during the holiday.",
    holidayShips: "Placed during the holiday. The customer was told it ships from {date}.",
  },
  ar: {
    holidayOrder: "تم الطلب أثناء الإجازة.",
    holidayShips: "تم الطلب أثناء الإجازة. أُبلغ العميل بأنه سيُشحن ابتداءً من {date}.",
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
 * the address in its header: the note of an order taken during a holiday.
 * Mounted once on the order page, right under the header.
 */
export function OrderFulfilmentPlan({ order }: { order: Order }) {
  return <OrderHolidayNote order={order} />;
}

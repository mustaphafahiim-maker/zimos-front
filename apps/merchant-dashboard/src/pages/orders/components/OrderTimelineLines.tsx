import type { Order } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { fmt, getIntlLocale, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDateTime } from "@/lib/format";
import { confirmationTiming, formatDuration, formatRelative } from "@/lib/orderTimeline";

const STRINGS = {
  en: {
    placed: "Placed {time}",
    confirmed: "Confirmed {time}",
    after: "after {duration}",
  },
  ar: {
    placed: "طُلب {time}",
    confirmed: "أُكّد {time}",
    after: "بعد {duration} من الطلب",
  },
} satisfies Messages;

/**
 * Two small lines for an order row: when it was placed and, once confirmed,
 * when and how long after placing. Relative times ("3 hours ago"), the exact
 * date and time in the tooltip. `now` comes from the caller's clock so every
 * row of a list moves together.
 */
export function OrderTimelineLines({
  order,
  now,
  className,
}: {
  order: Pick<Order, "createdAt" | "confirmationState" | "confirmedAt">;
  now: number;
  className?: string;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const intl = getIntlLocale();
  const timing = confirmationTiming(order);

  return (
    <div className={cn("space-y-0.5 text-xs leading-snug text-ink-soft", className)}>
      <p>
        <time dateTime={timing.placedAt} title={formatDateTime(timing.placedAt)}>
          {fmt(t.placed, { time: formatRelative(timing.placedAt, now, intl) })}
        </time>
      </p>
      {timing.confirmedAt && (
        <p className="text-success">
          <time dateTime={timing.confirmedAt} title={formatDateTime(timing.confirmedAt)}>
            {fmt(t.confirmed, { time: formatRelative(timing.confirmedAt, now, intl) })}
          </time>
          {timing.minutesToConfirm !== null && (
            <span className="text-ink-soft">
              {" · "}
              {fmt(t.after, { duration: formatDuration(timing.minutesToConfirm, intl, locale === "ar") })}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

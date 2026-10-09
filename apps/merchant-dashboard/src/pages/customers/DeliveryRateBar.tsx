import { cn } from "@store-builder/ui";
import type { Contact } from "@store-builder/api-client";
import { useT, fmt } from "@/i18n/LocaleContext";
import { CONTACT_STRINGS, deliveryRateTone } from "./contactStrings";

type RateTone = ReturnType<typeof deliveryRateTone>;

// On their own (glass off): the token fills. glass/customers.css gives the track its pane, the fill its light
// and the chip its tinted pane — through `data-tone`, never through these classes.
const FILL: Record<RateTone, string> = { success: "bg-success", warning: "bg-accent", danger: "bg-danger" };
const CHIP: Record<RateTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-accent-soft text-accent-dark",
  danger: "bg-danger-soft text-danger",
};

interface DeliveryRateBarProps {
  contact: Pick<Contact, "deliveryRate" | "deliveredCount" | "closedCount">;
  /**
   * `bar` (the default): a small bar and «٨ من ١٠ استلموا» beside it — a table cell, a fact on a page.
   * `chip`: the same in one tinted pill, «٨ من ١٠», for the second line of a phone card.
   */
  variant?: "bar" | "chip";
  className?: string;
}

/**
 * How many of the contact's parcels were actually received — the number a
 * cash-on-delivery store reads before it ships again. Said in parcels, not in
 * per cent: «٨ من ١٠ استلموا», with a small bar for the eye (green from 80%,
 * amber from 50%, red below: `deliveryRateTone`).
 *
 * Shown only once a parcel has reached an end (delivered, returned or
 * failed): a new buyer has no rate, not a rate of zero, so until then this is
 * a dash that says why to a screen reader and on hover.
 */
export function DeliveryRateBar({ contact, variant = "bar", className }: DeliveryRateBarProps) {
  const t = useT(CONTACT_STRINGS);
  if (contact.deliveryRate === null) {
    return (
      <span className={cn("text-ink-soft", className)} title={t.deliveryRateNone}>
        <span aria-hidden>{t.deliveryRateUnknown}</span>
        <span className="sr-only">{t.deliveryRateNone}</span>
      </span>
    );
  }

  const rate = Math.min(100, Math.max(0, contact.deliveryRate));
  const tone = deliveryRateTone(rate);
  const counts = { delivered: contact.deliveredCount, closed: contact.closedCount };
  const title = fmt(t.deliveryRateOf, counts);

  const meter = (
    <span
      role="meter"
      aria-label={t.deliveryRate}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={rate}
      aria-valuetext={title}
      data-tone={tone}
      className={cn(
        "zimos-rate-track block h-1.5 shrink-0 overflow-hidden rounded-full",
        variant === "chip" ? "w-6 bg-current/20" : "w-12 bg-line"
      )}
    >
      {/* The fill starts at the reading edge by itself: it is a block in the track's own direction. */}
      <span
        data-tone={tone}
        className={cn("zimos-rate-fill block h-full rounded-full", variant === "chip" ? "bg-current" : FILL[tone])}
        style={{ width: `${rate}%` }}
      />
    </span>
  );

  if (variant === "chip") {
    return (
      <span
        data-slot="delivery-rate"
        data-tone={tone}
        title={title}
        className={cn(
          "zimos-rate-chip inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs leading-none font-semibold whitespace-nowrap tabular-nums",
          CHIP[tone],
          className
        )}
      >
        {meter}
        {/* The meter already says it in words to a screen reader. */}
        <span aria-hidden>{fmt(t.deliveryRateCount, counts)}</span>
      </span>
    );
  }

  return (
    <div data-slot="delivery-rate" data-tone={tone} title={title} className={cn("zimos-rate flex min-w-0 items-center gap-2", className)}>
      {meter}
      <span aria-hidden className="text-xs leading-5 whitespace-nowrap text-ink tabular-nums">
        {fmt(t.deliveryRateShort, counts)}
      </span>
    </div>
  );
}

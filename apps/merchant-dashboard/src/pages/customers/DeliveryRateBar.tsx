import { cn } from "@store-builder/ui";
import type { Contact } from "@store-builder/api-client";
import { useT, fmt } from "@/i18n/LocaleContext";
import { CONTACT_STRINGS, deliveryRateTone } from "./contactStrings";

const FILL = { success: "bg-success", warning: "bg-accent", danger: "bg-danger" } as const;

/**
 * How many of the contact's parcels were actually received. Shown only once a
 * parcel has reached an end (delivered, returned or failed) — a new buyer has
 * no rate, not a rate of zero.
 */
export function DeliveryRateBar({ contact, className }: { contact: Pick<Contact, "deliveryRate" | "deliveredCount" | "closedCount">; className?: string }) {
  const t = useT(CONTACT_STRINGS);
  if (contact.deliveryRate === null) {
    return <span className={cn("text-xs text-ink-soft", className)}>{t.deliveryRateNone}</span>;
  }
  const rate = contact.deliveryRate;
  const title = fmt(t.deliveryRateOf, { delivered: contact.deliveredCount, closed: contact.closedCount });
  return (
    <div className={cn("flex min-w-24 items-center gap-2", className)} title={title}>
      <div
        role="meter"
        aria-label={t.deliveryRate}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rate}
        aria-valuetext={title}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
      >
        <div className={cn("h-full rounded-full", FILL[deliveryRateTone(rate)])} style={{ width: `${rate}%` }} />
      </div>
      <span className="tabular-nums text-xs font-medium text-ink">{rate}%</span>
    </div>
  );
}

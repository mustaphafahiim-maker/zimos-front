import type { StockLot } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { countOf } from "@/lib/plural";
import { formatDay } from "@/lib/wholeNumber";
import { fmt, useT } from "@/i18n/LocaleContext";
import { StatusBadge } from "@/components/StatusBadge";
import { LOT_STRINGS } from "./lotStrings";
import { daysUntil } from "./lotText";

/**
 * A lot's expiry: its date — red once it has passed, with «منتهية» beside the
 * colour — and, while it still holds units and the date is within the store's
 * warning days, how long is left.
 */
export function LotExpiry({ lot, alertDays, className }: { lot: StockLot; alertDays: number; className?: string }) {
  const t = useT(LOT_STRINGS);
  if (!lot.expiresOn) return <span className={cn("text-ink-soft", className)}>{t.noExpiry}</span>;
  const left = daysUntil(lot.expiresOn);
  const soon = !lot.expired && lot.quantityRemaining > 0 && left <= alertDays;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <span className={cn("whitespace-nowrap", lot.expired ? "font-medium text-danger" : "text-ink")}>{formatDay(lot.expiresOn)}</span>
      {lot.expired ? (
        <StatusBadge value="expired" tone="danger" text={t.expiredBadge} />
      ) : (
        soon && <StatusBadge value="expiring" tone="warning" text={left <= 0 ? t.expiresToday : fmt(t.expiresIn, { days: countOf("day", left) })} />
      )}
    </span>
  );
}

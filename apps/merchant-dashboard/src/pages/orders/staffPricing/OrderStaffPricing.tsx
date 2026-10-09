import { orderStaffDiscount, orderStaffPriceOverride, type Order, type OrderItem } from "@store-builder/api-client";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatMoney } from "@/lib/format";
import { STAFF_PRICING_STRINGS } from "./staffPricing";

/**
 * Under an order line's name on the order page (handoff 382): «مخصص» for a
 * line that is not in the catalogue; «سعر معدّل» with the store's price struck
 * through for a line staff priced themselves — who did it on hover, and read
 * out for a screen reader. Nothing for any other line.
 */
export function OrderLinePriceNote({ item, currency }: { item: OrderItem; currency: string }) {
  const t = useT(STAFF_PRICING_STRINGS);
  const override = orderStaffPriceOverride(item);
  if (!override) return null;
  const by = override.actorName ? fmt(t.by, { actorName: override.actorName }) : undefined;
  if (override.kind === "custom") {
    return (
      <span data-slot="line-custom" title={by} className="mt-1 inline-flex">
        <StatusBadge value="custom" tone="info" text={t.custom} />
        {by && <span className="sr-only">{by}</span>}
      </span>
    );
  }
  return (
    <span data-slot="line-price-changed" title={by} className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
      <StatusBadge value="price_changed" tone="warning" text={t.priceChanged} />
      <s className="text-xs text-ink-soft">
        <bdi>{fmt(t.storePrice, { catalogue: formatMoney(override.catalogUnitPriceAmount, currency) })}</bdi>
      </s>
      {by && <span className="sr-only">{by}</span>}
    </span>
  );
}

/**
 * The discount of the order's totals: the one row the page always showed, or —
 * with a staff discount — the code's part and «خصم يدوي (السبب)» as two rows.
 * `discountAmount` is the two together, so the code's is what is left.
 */
export function OrderDiscountRows({ order, currency, label }: { order: Order; currency: string; label: string }) {
  const t = useT(STAFF_PRICING_STRINGS);
  const total = Number(order.discountAmount) || 0;
  const manual = orderStaffDiscount(order);
  const row = (text: string, minor: number, slot: string) => (
    <div data-slot={slot} className="flex justify-between gap-4 text-ink-soft">
      <span className="min-w-0" dir="auto">
        {text}
      </span>
      <span className="shrink-0">− {formatMoney(minor, currency)}</span>
    </div>
  );
  if (!manual) return total > 0 ? row(label, total, "discount-row") : null;
  const staff = Number(manual.amount) || 0;
  const coupon = Math.max(0, total - staff);
  return (
    <>
      {coupon > 0 && row(t.discountCode, coupon, "discount-code-row")}
      {row(fmt(t.staffDiscountRow, { reason: manual.reason }), staff, "staff-discount-row")}
    </>
  );
}

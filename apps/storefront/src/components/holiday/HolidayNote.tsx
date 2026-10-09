"use client";

import { useHoliday, type HolidayView } from "@/lib/storeHoliday";
import { TruckIcon } from "../Icons";
import { HolidayIcon } from "./HolidayIcon";

/**
 * What a holiday means where the shopper is about to buy (handoff 216) — the
 * product page, the cart, the checkout:
 *   delay — one line, «الطلبات هتتشحن من 11 أكتوبر»;
 *   pause — a notice, «الطلبات موقوفة مؤقتًا», with when ordering opens again.
 * Nothing while the store is open as usual.
 *
 * `view` is the page's own reading of the holiday when it has one
 * (useHolidayCheckout, read fresh); without it the note reads what the page
 * was rendered with.
 */
export function HolidayNote({ view, className = "" }: { view?: HolidayView; className?: string }) {
  const rendered = useHoliday();
  const holiday = view ?? rendered;
  if (!holiday.holiday) return null;

  if (holiday.delayed) {
    return (
      <p className={`flex items-center gap-1.5 text-sm font-medium text-ink ${className}`} role="status">
        <TruckIcon size={16} className="shrink-0 text-accent-dark" />
        {holiday.line}
      </p>
    );
  }

  return (
    <div className={`rounded-xl border border-accent/40 bg-accent-soft px-3.5 py-2.5 text-sm ${className}`} role="status">
      <p className="flex items-center gap-1.5 font-semibold text-ink">
        <HolidayIcon size={16} className="shrink-0 text-accent-dark" />
        {holiday.line}
      </p>
      {holiday.detail && <p className="mt-0.5 text-ink-soft">{holiday.detail}</p>}
    </div>
  );
}

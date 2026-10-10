"use client";

import { useHoliday } from "@/lib/storeHoliday";
import { container } from "../ui";
import { HolidayIcon } from "./HolidayIcon";

/**
 * The band across the top of every page while the store is on holiday
 *: «المتجر في إجازة لحد 11 أكتوبر», the store's own message,
 * and what it means for an order — paused, or when it ships. Nothing while
 * the store is open as usual. It stays on funnel pages too: an order placed
 * there is refused, or ships late, like any other.
 */
export function HolidayBanner() {
  const view = useHoliday();
  if (!view.holiday) return null;
  return (
    <div role="status" className="border-b border-accent/40 bg-accent-soft text-ink">
      <div className={`${container} flex items-start justify-center gap-2.5 py-2.5 text-sm`}>
        <HolidayIcon size={18} className="mt-0.5 shrink-0 text-accent-dark" />
        <p className="min-w-0 text-center leading-relaxed">
          <span className="font-semibold">{view.title}</span>
          {view.line && (
            <>
              <span aria-hidden className="mx-1.5 text-ink-soft">
                ·
              </span>
              <span className="font-medium">{view.line}</span>
            </>
          )}
          {view.message && <span className="block text-ink-soft">{view.message}</span>}
        </p>
      </div>
    </div>
  );
}

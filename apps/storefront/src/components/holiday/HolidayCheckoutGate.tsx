"use client";

import type { ReactNode } from "react";
import { useHoliday } from "@/lib/storeHoliday";
import { HolidayNote } from "./HolidayNote";

/**
 * The way from the cart to the checkout while the store is on holiday
 * — the cart page and the cart drawer wrap their checkout link
 * in it:
 *
 *   open   the link, as it always was;
 *   delay  the same link, under «الطلبات هتتشحن من 11 أكتوبر»;
 *   pause  the notice «الطلبات موقوفة مؤقتًا» and, in the link's place, a
 *          button that is off and says the same. The cart itself keeps
 *          working: lines can still be changed and are kept.
 *
 *   <HolidayCheckoutGate buttonClassName={btnPrimaryLg}>
 *     <StoreLink href="/checkout" className={btnPrimaryLg}>…</StoreLink>
 *   </HolidayCheckoutGate>
 */
export function HolidayCheckoutGate({
  children,
  buttonClassName,
  noteClassName = "",
}: {
  /** The checkout link. */
  children: ReactNode;
  /** The link's own classes, for the button that stands in for it while paused. */
  buttonClassName: string;
  noteClassName?: string;
}) {
  const holiday = useHoliday();
  if (!holiday.holiday) return <>{children}</>;
  return (
    <>
      <HolidayNote view={holiday} className={noteClassName} />
      {holiday.paused ? (
        <button type="button" disabled className={buttonClassName}>
          {holiday.pausedLabel}
        </button>
      ) : (
        children
      )}
    </>
  );
}

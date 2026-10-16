/**
 * Dates as the shopper reads them. A store's instants are said in the
 * store's time zone, so a shopper abroad reads the same day the store means.
 */

export const STORE_TIME_ZONE = "Africa/Cairo";

/** «11 أكتوبر» for an instant, in the store's zone; "" when there is none. */
export function storeDayText(iso: string | null | undefined, intlLocale: string, timeZone: string = STORE_TIME_ZONE): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "long", timeZone }).format(date);
  } catch {
    // A zone name this runtime does not know.
    return new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "long", timeZone: STORE_TIME_ZONE }).format(date);
  }
}

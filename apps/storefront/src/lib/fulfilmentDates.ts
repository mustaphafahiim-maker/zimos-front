import { formatShopDay } from "@/lib/buyInfo";

/**
 * Days as the holiday notice, the delivery slots and the pickup card say
 * them (handoff 216, 221, 225).
 */

/**
 * The zone a store's moments are read in when the API does not name one —
 * the API's own default (workspace.timezone || "Africa/Cairo"). A fixed zone,
 * not the device's, so the server and the browser print the same day.
 */
export const STORE_TIME_ZONE = "Africa/Cairo";

/**
 * A moment (ISO) as a day in the store's time: "11 October" / «١١ أكتوبر».
 * "" when it is not a date.
 */
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

/** A delivery day ("YYYY-MM-DD") with its weekday: "Thursday 9 October" / «الخميس، ٩ أكتوبر». */
export function slotDayText(ymd: string | null | undefined, intlLocale: string): string {
  return formatShopDay(ymd, intlLocale, { weekday: "long", day: "numeric", month: "long" });
}

/**
 * A slot's "HH:MM" (24 hours, as the store set it) in the page's digits:
 * "10:00" / «١٠:٠٠», like the dates beside it. Anything else is shown as it is.
 */
export function slotTimeText(hhmm: string, intlLocale: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)) return hhmm;
  const two = new Intl.NumberFormat(intlLocale, { minimumIntegerDigits: 2, useGrouping: false });
  return `${two.format(Number(hhmm.slice(0, 2)))}:${two.format(Number(hhmm.slice(3, 5)))}`;
}

/** The two lines of a day chip: the weekday, and the day of the month. */
export function slotDayParts(ymd: string, intlLocale: string): { weekday: string; day: string } {
  return {
    weekday: formatShopDay(ymd, intlLocale, { weekday: "long" }),
    day: formatShopDay(ymd, intlLocale, { day: "numeric", month: "long" }),
  };
}

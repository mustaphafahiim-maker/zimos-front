import { holidayRefusalOf, type StorefrontHoliday } from "@store-builder/api-client";
import { fulfilmentCopy, type FulfilmentCopy } from "@/lib/fulfilmentCopy";
import { storeDayText } from "@/lib/fulfilmentDates";
import { arOrEn, intlLocaleFor, type Locale } from "@/lib/i18n";

/**
 * A store on holiday, as the shopper is told. The API decides:
 * `store.holiday` is null while the store is open as usual, else
 *   pause — the store, the cart and every page keep working, but checkout
 *           answers 423 STORE_ON_HOLIDAY: the order buttons are off and say
 *           «الطلبات موقوفة مؤقتًا»;
 *   delay — orders go through and ship later: the product page, the cart and
 *           the checkout say «الطلبات هتتشحن من 11 أكتوبر».
 */
export interface HolidayView {
  holiday: StorefrontHoliday | null;
  /** The checkout takes no orders right now. */
  paused: boolean;
  /** Orders are taken and ship later. */
  delayed: boolean;
  /** «المتجر في إجازة لحد 11 أكتوبر»; "" while the store is open. */
  title: string;
  /** The store's own message, in the page's language; "" when it wrote none. */
  message: string;
  /** What it means for an order: paused, or when it ships; "" while the store is open. */
  line: string;
  /** More about a pause (the cart stays, when ordering opens again); "" otherwise. */
  detail: string;
  /** What an order button says while paused; null otherwise. */
  pausedLabel: string | null;
}

const OPEN: HolidayView = { holiday: null, paused: false, delayed: false, title: "", message: "", line: "", detail: "", pausedLabel: null };

export function holidayView(holiday: StorefrontHoliday | null | undefined, copy: FulfilmentCopy, locale: Locale): HolidayView {
  if (!holiday) return OPEN;
  const intlLocale = intlLocaleFor(locale);
  const until = storeDayText(holiday.until, intlLocale);
  const ships = storeDayText(holiday.shipsFrom, intlLocale);
  const lang = arOrEn(locale);
  const message = (holiday.message?.[lang] || holiday.message?.[lang === "ar" ? "en" : "ar"] || "").trim();
  const paused = holiday.mode === "pause";
  return {
    holiday,
    paused,
    delayed: !paused,
    title: until ? copy.holidayUntil(until) : copy.holidayOn,
    message,
    line: paused ? copy.ordersPaused : ships ? copy.shipsFrom(ships) : copy.shipsLater,
    detail: paused ? (until ? copy.pausedBodyUntil(until) : copy.pausedBody) : "",
    pausedLabel: paused ? copy.ordersPaused : null,
  };
}

/** The shopper's sentence for a holiday: «المتجر في إجازة لحد 11 أكتوبر — الطلبات موقوفة مؤقتًا». */
export function holidaySentence(view: HolidayView): string {
  return [view.title, view.line].filter(Boolean).join(" — ");
}

/**
 * A checkout refused because the store is on holiday (423 STORE_ON_HOLIDAY),
 * in the shopper's words. null for any other error.
 */
export function holidayRefusalText(err: unknown, locale: Locale): string | null {
  const named = holidayRefusalOf(err);
  return named ? holidaySentence(holidayView(named, fulfilmentCopy(locale), locale)) : null;
}

import type { Dictionary, Locale } from "./i18n";
import type { StoreNextOpening } from "./StoreContext";

/** The weekday's name in the shopper's language (0 = Sunday). */
export function weekdayName(weekday: number, locale: Locale): string {
  // 4 January 2026 was a Sunday; UTC so the browser's own zone never shifts the day.
  return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + weekday)));
}

/** "Opens today at 18:00" / tomorrow / on Friday — the store's next opening, Cairo time as the server gave it. */
export function nextOpeningText(next: StoreNextOpening, t: Dictionary, locale: Locale): string {
  return t.checkout.opensAt({ inDays: next.inDays, day: weekdayName(next.weekday, locale), time: next.time });
}

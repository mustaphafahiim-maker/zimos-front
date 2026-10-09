import type { DeliverySlotWeekday } from "@store-builder/api-client";
import { getIntlLocale } from "@/i18n/LocaleContext";
import { formatDay } from "@/lib/wholeNumber";

/**
 * Days and times as the delivery slot screens say them (handoff 221). A
 * delivery day is a calendar day of the store ("YYYY-MM-DD"), never a moment:
 * it is read as that day itself, whatever the device's time zone.
 */

/** The week as Egypt reads it, Saturday first (0 = Sunday … 6 = Saturday, as the API counts). */
export const WEEK_ORDER: readonly DeliverySlotWeekday[] = ["6", "0", "1", "2", "3", "4", "5"];

/** "Saturday" / «السبت». */
export function weekdayName(day: number | string, width: "long" | "short" = "long"): string {
  // 2026-01-04 was a Sunday.
  return new Intl.DateTimeFormat(getIntlLocale(), { weekday: width, timeZone: "UTC" }).format(Date.UTC(2026, 0, 4 + Number(day), 12));
}

/** 0 = Sunday … 6 = Saturday for a "YYYY-MM-DD" day. */
export function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today in the store's calendar (its time zone when known, else the device's). */
export function storeToday(timeZone?: string | null): string {
  const read = (zone: string | undefined) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  };
  try {
    return read(timeZone || undefined);
  } catch {
    // A zone name this browser does not know.
    return read(undefined);
  }
}

/** "Thursday 9 October" / «الخميس، ٩ أكتوبر». */
export function slotDayName(ymd: string | null | undefined): string {
  return formatDay(ymd, { weekday: "long", day: "numeric", month: "long" });
}

export function isSlotTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** A slot's "HH:MM" (24 hours, as the store typed it) in the screen's digits: "10:00" / «١٠:٠٠». */
export function slotTime(hhmm: string): string {
  if (!isSlotTime(hhmm)) return hhmm;
  const two = new Intl.NumberFormat(getIntlLocale(), { minimumIntegerDigits: 2, useGrouping: false });
  return `${two.format(Number(hhmm.slice(0, 2)))}:${two.format(Number(hhmm.slice(3, 5)))}`;
}

/**
 * "10:00 – 14:00" / «١٠:٠٠ – ١٤:٠٠». Left in the text's own direction: in
 * Arabic the start sits on the right, where the reading begins.
 */
export function slotRange(from: string, to: string): string {
  return `${slotTime(from)} – ${slotTime(to)}`;
}

export function slotMinutes(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

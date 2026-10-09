import { getIntlLocale } from "@/i18n/LocaleContext";

/**
 * A sale starts and ends on the store's clock (handoff 227: "start / end
 * date-time (store time)"), wherever the person setting it up happens to be.
 * These helpers move between an ISO instant and the `datetime-local` text
 * "YYYY-MM-DDTHH:mm" as read in a time zone; without a zone (a store that has
 * none saved) they fall back to the device's own clock.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** The wall-clock parts of an instant in a zone; null when the zone is unknown to the browser. */
function partsIn(date: Date, timeZone: string): { y: number; mo: number; d: number; h: number; mi: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const out = { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
    return Object.values(out).some((n) => Number.isNaN(n)) ? null : out;
  } catch {
    return null;
  }
}

/** An ISO time as the `datetime-local` text of the store's clock. */
export function storeInputOf(iso: string | null | undefined, timeZone: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const p = timeZone ? partsIn(date, timeZone) : null;
  if (p) return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A `datetime-local` text read on the store's clock, as an ISO time; null when it is not a time. */
export function isoOfStoreInput(value: string, timeZone: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(wall)) return null;
  if (!timeZone || !partsIn(new Date(wall), timeZone)) {
    const local = new Date(y, mo - 1, d, h, mi);
    return Number.isNaN(local.getTime()) ? null : local.toISOString();
  }
  // The zone's offset at that moment: found from a first guess, then once more across a clock change.
  const offsetAt = (instant: number) => {
    const p = partsIn(new Date(instant), timeZone)!;
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - Math.floor(instant / 60000) * 60000;
  };
  let instant = wall - offsetAt(wall);
  instant = wall - offsetAt(instant);
  return new Date(instant).toISOString();
}

/** "9 Oct 2026, 10:00 AM" on the store's clock, in the dashboard's language. */
export function formatStoreDateTime(iso: string | null | undefined, timeZone: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
  try {
    return new Intl.DateTimeFormat(getIntlLocale(), { ...options, ...(timeZone ? { timeZone } : {}) }).format(date);
  } catch {
    return new Intl.DateTimeFormat(getIntlLocale(), options).format(date);
  }
}

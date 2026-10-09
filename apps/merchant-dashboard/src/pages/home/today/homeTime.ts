import { useEffect, useState } from "react";
import { countOf } from "@/lib/plural";
import { getLocale } from "@/i18n/LocaleContext";

/** The three ranges of «اليوم». The page opens on today. */
export type HomeRange = "today" | "7d" | "30d";
export const HOME_RANGES: readonly HomeRange[] = ["today", "7d", "30d"];

/** What every section of the home receives. */
export interface HomeSectionProps {
  workspaceId: string;
  range: HomeRange;
  /** The member's role key; a section also treats a 403 as "not for this role". */
  role: string | null | undefined;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Local midnight of the day `ms` falls on. */
export function startOfDay(ms: number = Date.now()): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * `from` / `to` (ISO, `to` exclusive) of a home range: calendar days in the
 * merchant's own time, ending now. "7 days" is today and the six days before
 * it, as on the reports pages (lib/reportRange.ts).
 */
export function homeWindow(range: HomeRange, now: number = Date.now()): { from: string; to: string } {
  const today = startOfDay(now);
  const days = range === "today" ? 0 : range === "7d" ? 6 : 29;
  return { from: new Date(today - days * DAY_MS).toISOString(), to: new Date(now).toISOString() };
}

/**
 * The whole of today, midnight to midnight, for the hourly series: asked with
 * `unit: "hour"` and `compare: "previous"`, the answer's `series` is today's 24
 * hours (the ones to come are zero) and `previousSeries` is yesterday's 24, so
 * "yesterday at the same hour" is the sum of yesterday's buckets up to
 * `hoursSoFar` — the comparison the API's own "previous" does not give
 * (docs/ux/needs-backend.md H2).
 */
export function todayHours(now: number = Date.now()): { from: string; to: string; hoursSoFar: number } {
  const from = startOfDay(now);
  return {
    from: new Date(from).toISOString(),
    to: new Date(from + DAY_MS).toISOString(),
    // The hour in progress counts: at 15:20 the first sixteen buckets (00–15) have happened.
    hoursSoFar: Math.min(24, Math.floor((now - from) / HOUR_MS) + 1),
  };
}

/** Whole hours since `iso`; null when it is missing or in the future. */
export function hoursSince(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t) || t > now) return null;
  return (now - t) / HOUR_MS;
}

/**
 * How long something has waited, as words that fit after «من»: "40 minutes",
 * "3 hours", "2 days" — «٤٠ دقيقة», «٣ ساعات», «يومين». Null when unknown.
 */
export function waitedFor(iso: string | null | undefined, now: number = Date.now()): string | null {
  const hours = hoursSince(iso, now);
  if (hours === null) return null;
  if (hours < 1) return countOf("minute", Math.max(1, Math.round(hours * 60)));
  if (hours < 48) return countOf("hour", Math.round(hours));
  return countOf("day", Math.round(hours / 24));
}

/**
 * How urgent a wait is, for ranking and tinting the work queue:
 * 0 fresh (under an hour) · 1 waiting · 2 late (4 hours and more — a COD order
 * not called within hours is usually lost) · 3 very late (a day and more).
 */
export function waitLevel(iso: string | null | undefined, now: number = Date.now()): 0 | 1 | 2 | 3 {
  const hours = hoursSince(iso, now);
  if (hours === null || hours < 1) return 0;
  if (hours < 4) return 1;
  if (hours < 24) return 2;
  return 3;
}

/** "N of every 10" for a percentage: 62.4 → 6. Clamped to 0–10. */
export function outOfTen(percent: number): number {
  return Math.min(10, Math.max(0, Math.round(percent / 10)));
}

/** Monday-first week start is not Egypt's: the week starts on Saturday in Arabic, Sunday in English. */
export function startOfWeek(now: number = Date.now()): number {
  const today = new Date(startOfDay(now));
  const first = getLocale() === "ar" ? 6 : 0;
  const back = (today.getDay() - first + 7) % 7;
  return today.getTime() - back * DAY_MS;
}

/** A clock that ticks once a minute, so "waiting for 3 hours" stays true while the page is open. */
export function useNow(intervalMs: number = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setNow(Date.now());
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

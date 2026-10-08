import type { StoreHoursPeriod, StoreHoursSettings } from "@store-builder/api-client";

/**
 * Opening hours with several periods a day (the backend's
 * shipping/storeHours.js): at most 3, none overlapping, a period whose close
 * is at or before its open runs past midnight.
 */
export const MAX_PERIODS = 3;

type Day = StoreHoursSettings["days"][number];

/** A day's periods: its `periods`, or its own open/close (one period, as saved before periods existed). */
export function periodsOf(day: Day): StoreHoursPeriod[] {
  return day.periods && day.periods.length > 0 ? day.periods : [{ open: day.open, close: day.close }];
}

const minutes = (hhmm: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Whether a day's periods overlap (or one has no valid time). */
export function periodsOverlap(periods: StoreHoursPeriod[]): boolean {
  const spans: Array<{ open: number; end: number }> = [];
  for (const p of periods) {
    const open = minutes(p.open);
    const close = minutes(p.close);
    if (open === null || close === null) return true;
    spans.push({ open, end: close > open ? close : close + 24 * 60 });
  }
  spans.sort((a, b) => a.open - b.open);
  return spans.some((s, i) => i > 0 && s.open < spans[i - 1].end);
}

/** The first open day (0 = Sunday) whose periods overlap, or null. */
export function hoursProblem(days: Day[]): number | null {
  const index = days.findIndex((d) => !d.closed && periodsOverlap(periodsOf(d)));
  return index === -1 ? null : index;
}

/**
 * What is sent for a day: one period stays the shape every store has today
 * ({ closed, open, close }); several go as `periods`, the first mirrored in open/close.
 */
export function toSavedDay(day: Day): Day {
  const periods = periodsOf(day);
  if (periods.length === 1) return { closed: day.closed, open: periods[0].open, close: periods[0].close };
  return { closed: day.closed, open: periods[0].open, close: periods[0].close, periods };
}

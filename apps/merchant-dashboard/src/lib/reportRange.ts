import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ReportsCompare } from "@store-builder/api-client";
import { getIntlLocale } from "@/i18n/LocaleContext";

/**
 * The date range of the analytics reports: a preset or two picked dates, and
 * what to compare with. It lives in the URL (`?range=30d&compare=year`,
 * `?from=2026-09-01&to=2026-09-30`) so a report can be bookmarked and shared.
 */

export type ReportPreset = "today" | "yesterday" | "7d" | "30d" | "90d" | "month" | "lastMonth" | "12m" | "custom";

export const REPORT_PRESETS: ReportPreset[] = ["today", "yesterday", "7d", "30d", "90d", "month", "lastMonth", "12m", "custom"];
export const REPORT_COMPARES: ReportsCompare[] = ["previous", "year", "none"];

const DAY_MS = 86_400_000;
const DEFAULT_PRESET: ReportPreset = "30d";

export interface ReportRange {
  preset: ReportPreset;
  compare: ReportsCompare;
  /** ISO instants sent to the API; `to` is exclusive. */
  from: string;
  to: string;
  /** The picked days as "YYYY-MM-DD" (local), for the date inputs. */
  fromDay: string;
  toDay: string;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const pad = (n: number) => String(n).padStart(2, "0");
const dayString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseDay(text: string | null): Date | null {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [y, m, d] = text.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** First and last day (both inclusive, local) of a preset. */
function presetDays(preset: ReportPreset, now: Date): [Date, Date] {
  const today = startOfDay(now);
  const back = (days: number) => new Date(today.getTime() - days * DAY_MS);
  switch (preset) {
    case "today":
      return [today, today];
    case "yesterday":
      return [back(1), back(1)];
    case "7d":
      return [back(6), today];
    case "90d":
      return [back(89), today];
    case "month":
      return [new Date(today.getFullYear(), today.getMonth(), 1), today];
    case "lastMonth":
      return [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0)];
    case "12m":
      return [back(364), today];
    default:
      return [back(29), today];
  }
}

export function resolveReportRange(params: URLSearchParams, now = new Date()): ReportRange {
  const compareParam = params.get("compare") as ReportsCompare | null;
  const compare = compareParam && REPORT_COMPARES.includes(compareParam) ? compareParam : "previous";
  const customFrom = parseDay(params.get("from"));
  const customTo = parseDay(params.get("to"));
  let preset = (params.get("range") as ReportPreset | null) ?? DEFAULT_PRESET;
  if (!REPORT_PRESETS.includes(preset)) preset = DEFAULT_PRESET;

  let first: Date;
  let last: Date;
  if (customFrom && customTo && customFrom <= customTo) {
    preset = "custom";
    [first, last] = [customFrom, customTo];
  } else {
    if (preset === "custom") preset = DEFAULT_PRESET;
    [first, last] = presetDays(preset, now);
  }
  // The API's `to` is exclusive: the day after the last picked day, never past now.
  const end = new Date(Math.min(startOfDay(last).getTime() + DAY_MS, now.getTime()));
  return {
    preset,
    compare,
    from: first.toISOString(),
    to: end.toISOString(),
    fromDay: dayString(first),
    toDay: dayString(last),
  };
}

export function useReportRange() {
  const [params, setParams] = useSearchParams();
  // One `now` per mount: the range must not shift (and refetch) on every render.
  const now = useRef(new Date());
  const key = params.toString();
  const range = useMemo(() => resolveReportRange(new URLSearchParams(key), now.current), [key]);

  const update = useCallback(
    (change: (next: URLSearchParams) => void) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          change(next);
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  const setPreset = useCallback(
    (preset: ReportPreset) =>
      update((next) => {
        next.delete("from");
        next.delete("to");
        if (preset === "custom") {
          // Start the picker from what is on screen.
          next.delete("range");
          next.set("from", range.fromDay);
          next.set("to", range.toDay);
        } else if (preset === DEFAULT_PRESET) next.delete("range");
        else next.set("range", preset);
      }),
    [update, range.fromDay, range.toDay]
  );

  const setDays = useCallback(
    (fromDay: string, toDay: string) =>
      update((next) => {
        next.delete("range");
        next.set("from", fromDay);
        next.set("to", toDay);
      }),
    [update]
  );

  const setCompare = useCallback(
    (compare: ReportsCompare) =>
      update((next) => {
        if (compare === "previous") next.delete("compare");
        else next.set("compare", compare);
      }),
    [update]
  );

  return { range, setPreset, setDays, setCompare };
}

/** Loads one report and reloads it when its inputs change. */
export function useReport<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: unknown }>({
    data: null,
    loading: true,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    // Keep the numbers on screen while the next range loads.
    setState((prev) => ({ ...prev, loading: true, error: null }));
    load()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}

/** "14 Sep", "14 Sep 09:00", "Sep 2026" — a bucket label for the unit on the axis. */
export function formatBucket(bucket: string, unit: "hour" | "day" | "week" | "month"): string {
  const date = new Date(`${bucket}:00Z`);
  if (Number.isNaN(date.getTime())) return bucket;
  const options: Intl.DateTimeFormatOptions =
    unit === "hour"
      ? { hour: "numeric", day: "numeric", month: "short" }
      : unit === "month"
        ? { month: "short", year: "numeric" }
        : { day: "numeric", month: "short" };
  return new Intl.DateTimeFormat(getIntlLocale(), { ...options, timeZone: "UTC" }).format(date);
}

/** Money on a chart axis: "12K", "1.2M" — whole major units, no currency. */
export function formatCompactMoney(minor: number): string {
  return new Intl.NumberFormat(getIntlLocale(), { notation: "compact", maximumFractionDigits: 1 }).format(minor / 100);
}

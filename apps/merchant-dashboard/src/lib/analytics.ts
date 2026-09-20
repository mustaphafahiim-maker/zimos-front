import type { AnalyticsSummary } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { getIntlLocale } from "@/i18n/LocaleContext";

/** The ranges the analytics and profit screens offer. */
export type AnalyticsRange = "7d" | "30d" | "90d";

export const ANALYTICS_RANGES: AnalyticsRange[] = ["7d", "30d", "90d"];

const DAYS: Record<AnalyticsRange, number> = { "7d": 7, "30d": 30, "90d": 90 };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `from`/`to` for a range, and the same-length window immediately before it.
 * `to` is exclusive server-side, so "now" is a valid end.
 */
export function rangeWindows(range: AnalyticsRange, now = Date.now()) {
  const days = DAYS[range];
  const span = days * DAY_MS;
  return {
    current: { from: new Date(now - span).toISOString(), to: new Date(now).toISOString() },
    previous: {
      from: new Date(now - span * 2).toISOString(),
      to: new Date(now - span).toISOString(),
    },
  };
}

export interface AnalyticsPair {
  current: AnalyticsSummary;
  /**
   * The window before it, for the "vs previous period" deltas. Null when that
   * request failed — a missing comparison hides the deltas rather than
   * failing the whole screen.
   */
  previous: AnalyticsSummary | null;
}

/**
 * Both windows in one hook. They are fetched together so a KPI and its delta
 * always describe the same range, and the previous window is allowed to fail
 * on its own.
 */
export function useAnalyticsSummary(workspaceId: string, range: AnalyticsRange) {
  return useAsync<AnalyticsPair>(async () => {
    const { current, previous } = rangeWindows(range);
    const [now, before] = await Promise.all([
      apiClient.getAnalyticsSummary(workspaceId, current),
      apiClient.getAnalyticsSummary(workspaceId, previous).catch(() => null),
    ]);
    return { current: now, previous: before };
  }, [workspaceId, range]);
}

/**
 * Change from `previous` to `current`, in basis points, for `<KpiCard>`.
 * Returns null when there is no usable baseline — a jump from zero is not a
 * percentage, and showing one would be an invented number.
 */
export function deltaBasisPoints(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  if (current === null || current === undefined) return null;
  if (previous === null || previous === undefined || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10000);
}

/**
 * The API reports rates as percentages (12.5 = 12.5%); `formatPercentValue`
 * takes a ratio. Null stays null so "—" is rendered instead of "0.0%".
 */
export function percentToRatio(percent: number | null | undefined): number | null {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return null;
  return percent / 100;
}

/** Thousands separators in the active dashboard language. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(getIntlLocale()).format(value);
}

/** "2026-09-14" -> "14 Sep". Day and month only: the axis is already dated. */
export function formatAxisDate(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat(getIntlLocale(), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

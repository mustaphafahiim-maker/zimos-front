import type { AnalyticsSummary } from "@store-builder/api-client";
import { useAsync } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import type { AnalyticsRange } from "@/components/RangeSwitch";

const DAY_MS = 864e5;

export function rangeDays(range: AnalyticsRange): number {
  return range === "7d" ? 7 : range === "90d" ? 90 : 30;
}

export interface SummaryWithPrevious {
  current: AnalyticsSummary;
  /** Same-length window just before the current one; null when it could not be loaded. */
  previous: AnalyticsSummary | null;
}

/** Loads the real analytics summary for the range plus the previous window (for deltas). */
export function useAnalyticsSummary(workspaceId: string, range: AnalyticsRange) {
  return useAsync<SummaryWithPrevious>(() => {
    const days = rangeDays(range);
    const now = Date.now();
    const from = new Date(now - days * DAY_MS).toISOString();
    const prevFrom = new Date(now - 2 * days * DAY_MS).toISOString();
    return Promise.all([
      apiClient.getAnalyticsSummary(workspaceId, { from }),
      apiClient.getAnalyticsSummary(workspaceId, { from: prevFrom, to: from }).catch(() => null),
    ]).then(([current, previous]) => ({ current, previous }));
  }, [workspaceId, range]);
}

/** Change in basis points; null when there is no meaningful previous value. */
export function deltaBp(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 10000);
}

/** Summary rates are percentages (e.g. 62.5) — convert to a ratio for formatPercentValue. */
export function pctRatio(percent: number | null | undefined): number | null {
  return percent == null ? null : percent / 100;
}

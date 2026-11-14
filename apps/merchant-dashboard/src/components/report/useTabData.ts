import { useCallback, useEffect, useState } from "react";
import type { ReportRange } from "@/lib/reportRange";
import { useCachedAsync } from "@/lib/useCachedAsync";

/**
 * One request of a report tab, remembered for the session (`useCachedAsync`):
 * coming back to a tab, or to a range already looked at, shows the last answer
 * at once and refreshes it behind (`stale` is true meanwhile).
 *
 *   const sales = useTabData("sales", workspaceId, range, () =>
 *     reportsGetSales(apiClient, workspaceId, { from: range.from, to: range.to, compare: range.compare })
 *   );
 *   <ReportTabState loading={sales.loading} error={sales.error} onRetry={sales.retry}>…</ReportTabState>
 *
 * The answer is remembered per tab + store + range + comparison. The range is
 * named by its picked DAYS (`fromDay` / `toDay`), not by the instants: `to` is
 * capped at "now" each time the hub is opened, so the instants never repeat and
 * nothing would ever be found again. The request itself is sent again whenever
 * the instants, the comparison or `extra` change.
 *
 * `tab` names the request, so a tab with several uses one name each
 * (`"journey"`, `"journey:reasons"`). `extra` is for a choice inside the tab
 * that changes the request (a group-by, a filter).
 *
 * `data` is null while `loading`, and the moment the range changes the hook
 * reads as loading: the previous range's numbers are never shown under the new
 * one. `retry()` asks again.
 */
export function useTabData<T>(
  tab: string,
  workspaceId: string,
  range: Pick<ReportRange, "from" | "to" | "compare" | "fromDay" | "toDay">,
  loader: () => Promise<T>,
  extra = ""
) {
  const cacheKey = workspaceId
    ? `report:${tab}:${workspaceId}:${range.fromDay}:${range.toDay}:${range.compare}:${extra}`
    : null;
  const state = useCachedAsync<T>(cacheKey, loader, [tab, workspaceId, range.from, range.to, range.compare, extra]);

  // `useCachedAsync` turns to the new key in an effect, one render after the key changed.
  // Until it has, what it holds belongs to the key before: read that render as loading.
  const [settledKey, setSettledKey] = useState(cacheKey);
  useEffect(() => {
    setSettledKey(cacheKey);
  }, [cacheKey]);
  const loading = state.loading || settledKey !== cacheKey;

  const { refresh } = state;
  const retry = useCallback(() => {
    void refresh();
  }, [refresh]);

  return {
    ...state,
    loading,
    data: loading ? null : state.data,
    error: settledKey !== cacheKey ? null : state.error,
    retry,
  };
}

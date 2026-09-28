import { apiClient } from "@/lib/apiClient";
import { rangeWindows, type AnalyticsPair, type AnalyticsRange } from "@/lib/analytics";

/**
 * How long a prefetch stays claimable. Long enough to cover hover-then-click,
 * short enough that a hover with no click never serves stale analytics later.
 */
const PREFETCH_TTL_MS = 10_000;

const cache = new Map<string, { promise: Promise<AnalyticsPair>; expiresAt: number }>();

function cacheKey(workspaceId: string, range: AnalyticsRange): string {
  return `${workspaceId}:${range}`;
}

export function fetchAnalyticsPair(workspaceId: string, range: AnalyticsRange): Promise<AnalyticsPair> {
  const { current, previous } = rangeWindows(range);
  return Promise.all([
    apiClient.getAnalyticsSummary(workspaceId, current),
    apiClient.getAnalyticsSummary(workspaceId, previous).catch(() => null),
  ]).then(([now, before]) => ({ current: now, previous: before }));
}

/**
 * Starts the analytics fetch ahead of navigation — e.g. on sidebar-link
 * hover — so it runs in parallel with the lazy-loaded page chunk instead of
 * after the page mounts. A no-op if one is already in flight for this key.
 */
export function prefetchAnalyticsSummary(workspaceId: string, range: AnalyticsRange): void {
  const key = cacheKey(workspaceId, range);
  if (cache.has(key)) return;
  const promise = fetchAnalyticsPair(workspaceId, range);
  cache.set(key, { promise, expiresAt: Date.now() + PREFETCH_TTL_MS });
  promise.catch(() => cache.delete(key));
  setTimeout(() => {
    if ((cache.get(key)?.expiresAt ?? 0) <= Date.now()) cache.delete(key);
  }, PREFETCH_TTL_MS);
}

/** Claims a still-fresh prefetch at most once, or null to fetch normally. */
export function takePrefetchedAnalyticsSummary(
  workspaceId: string,
  range: AnalyticsRange
): Promise<AnalyticsPair> | null {
  const key = cacheKey(workspaceId, range);
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  cache.delete(key);
  return entry.promise;
}

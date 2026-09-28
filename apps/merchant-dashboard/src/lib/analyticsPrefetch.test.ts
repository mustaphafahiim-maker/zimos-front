import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyticsSummary } from "@store-builder/api-client";
import { api, fake, resetMocks } from "@/test/mocks";
import { prefetchAnalyticsSummary, takePrefetchedAnalyticsSummary } from "./analyticsPrefetch";

// The logic project has no setup file, so wire the typed API double here.
vi.mock("@/lib/apiClient", async () => {
  const { api } = await import("@/test/mocks");
  return { apiClient: api, apiBaseUrl: "http://api.test/api/v1" };
});

const summary = fake<AnalyticsSummary>({});

describe("analyticsPrefetch", () => {
  beforeEach(() => {
    resetMocks();
    vi.useFakeTimers();
    api.getAnalyticsSummary.mockResolvedValue(summary);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // Each test uses its own workspace: the cache is module-level state.
  it("fires both windows once on prefetch and hands the same promise to the page", async () => {
    prefetchAnalyticsSummary("ws_once", "30d");
    prefetchAnalyticsSummary("ws_once", "30d");
    // Two calls per pair: the current window and the one before it — not four.
    expect(api.getAnalyticsSummary).toHaveBeenCalledTimes(2);

    const taken = takePrefetchedAnalyticsSummary("ws_once", "30d");
    expect(taken).not.toBeNull();
    await expect(taken).resolves.toEqual({ current: summary, previous: summary });

    // Claimed once: the page's next mount goes back to a normal fetch.
    expect(takePrefetchedAnalyticsSummary("ws_once", "30d")).toBeNull();
  });

  it("is keyed by workspace and range, so another store never gets these numbers", () => {
    prefetchAnalyticsSummary("ws_keyed", "30d");
    expect(takePrefetchedAnalyticsSummary("ws_other", "30d")).toBeNull();
    expect(takePrefetchedAnalyticsSummary("ws_keyed", "7d")).toBeNull();
    expect(takePrefetchedAnalyticsSummary("ws_keyed", "30d")).not.toBeNull();
  });

  it("expires a hover that never became a click, instead of serving it stale later", () => {
    prefetchAnalyticsSummary("ws_expiry", "30d");
    vi.advanceTimersByTime(10_001);
    expect(takePrefetchedAnalyticsSummary("ws_expiry", "30d")).toBeNull();
  });

  it("drops a failed prefetch so the page can retry instead of inheriting the error", async () => {
    api.getAnalyticsSummary.mockRejectedValueOnce(new Error("offline"));
    prefetchAnalyticsSummary("ws_failed", "30d");
    await vi.runAllTimersAsync();
    expect(takePrefetchedAnalyticsSummary("ws_failed", "30d")).toBeNull();
  });
});

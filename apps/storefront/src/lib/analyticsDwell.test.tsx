import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The visible-time reports of lib/analyticsEvents.ts (DWELL_TRACKING_ENABLED):
 * what goes out in the batches, read off the fetch the tracker falls back to
 * (jsdom has no sendBeacon).
 */

type Sent = { name: string; pageViewId?: string; dwellMs?: number; productId?: string; path?: string; url?: string };
let fetchMock: ReturnType<typeof vi.fn>;

async function load(flag: string | undefined) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_DWELL_TRACKING_ENABLED", flag);
  return import("./analyticsEvents");
}

function setVisibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value, configurable: true });
}

const batches = () => fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
const events = (): Sent[] => batches().flatMap((b) => b.events);

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
  vi.stubGlobal("fetch", fetchMock);
  window.sessionStorage.clear();
  window.localStorage.clear();
  setVisibility("visible");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  Reflect.deleteProperty(navigator, "webdriver");
});

describe("visible time per page", () => {
  it("off: the tracker sends what it always has", async () => {
    const a = await load(undefined);
    a.setTrackingContext({ workspaceId: "ws-1" });
    a.sendPageView("ws-1");
    vi.advanceTimersByTime(2_000);
    setVisibility("hidden");
    a.trackVisibility("ws-1");
    a.reportLeave("ws-1");
    a.flush(true);
    expect(events().map((e) => e.name)).toEqual(["page_view"]);
    expect(events()[0].pageViewId).toBeUndefined();
    expect(batches()[0].automation).toBeUndefined();
  });

  it("on: a page view has an id; hiding the tab sends its visible time with the product, the next page view the rest", async () => {
    const a = await load("true");
    a.setTrackingContext({ workspaceId: "ws-1" });
    a.sendPageView("ws-1");
    vi.advanceTimersByTime(1_300);
    const first = events().find((e) => e.name === "page_view");
    expect(first?.pageViewId).toMatch(/^[0-9a-f]{24}$/);

    a.sendEvent("ws-1", { name: "view_content", metadata: { contentIds: ["prod-9"] } });
    vi.advanceTimersByTime(3_000);
    setVisibility("hidden");
    a.trackVisibility("ws-1");
    const hidden = events().filter((e) => e.name === "page_dwell");
    expect(hidden).toEqual([{ name: "page_dwell", pageViewId: first?.pageViewId, dwellMs: 4_300, productId: "prod-9", occurredAt: expect.any(String) }]);

    // Hidden for a minute: not counted. Back for one second, then the next page.
    vi.advanceTimersByTime(60_000);
    setVisibility("visible");
    a.trackVisibility("ws-1");
    vi.advanceTimersByTime(1_000);
    a.sendPageView("ws-1");
    vi.advanceTimersByTime(1_300);
    const reports = events().filter((e) => e.name === "page_dwell");
    expect(reports.map((r) => [r.pageViewId, r.dwellMs])).toEqual([
      [first?.pageViewId, 4_300],
      [first?.pageViewId, 5_300],
    ]);
    const second = events().filter((e) => e.name === "page_view")[1];
    expect(second.pageViewId).not.toBe(first?.pageViewId);
  });

  it("on: leaving the page sends its reading, and a browser driven by automation says so", async () => {
    Object.defineProperty(navigator, "webdriver", { value: true, configurable: true });
    const a = await load("true");
    a.setTrackingContext({ workspaceId: "ws-1" });
    a.sendPageView("ws-1");
    vi.advanceTimersByTime(2_500);
    a.reportLeave("ws-1");
    a.flush(true);
    expect(events().filter((e) => e.name === "page_dwell").map((e) => e.dwellMs)).toEqual([2_500]);
    expect(batches().every((b) => b.automation === true)).toBe(true);
  });
});

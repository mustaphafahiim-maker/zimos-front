import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, type CatalogImport } from "@store-builder/api-client";
import { FOLLOW, nextDelay, readFailure, RequestTimeout, stalled, withTimeout } from "./importFollow";

const job = (status: CatalogImport["status"]) => ({ status, createdCount: 0, failedCount: 0 }) as CatalogImport;

afterEach(() => {
  vi.useRealTimers();
});

describe("readFailure", () => {
  it("ends on a 401 that survived the refresh, stops on no access or no import, retries the rest", () => {
    expect(readFailure(new ApiError("expired", 401))).toBe("session");
    expect(readFailure(new ApiError("no", 403, "FORBIDDEN"))).toBe("stop");
    expect(readFailure(new ApiError("gone", 404, "NOT_FOUND"))).toBe("stop");
    expect(readFailure(new ApiError("slow down", 429, "RATE_LIMITED"))).toBe("retry");
    expect(readFailure(new ApiError("boom", 500))).toBe("retry");
    expect(readFailure(new TypeError("Failed to fetch"))).toBe("retry");
    expect(readFailure(new RequestTimeout())).toBe("retry");
  });
});

describe("nextDelay", () => {
  it("reads quickly at first, then slower, and backs off after failures up to a ceiling", () => {
    expect(nextDelay(0, 0)).toBe(FOLLOW.pollMs);
    expect(nextDelay(FOLLOW.slowAfterMs, 0)).toBe(FOLLOW.slowPollMs);
    expect(nextDelay(0, 1)).toBe(FOLLOW.slowPollMs);
    expect(nextDelay(0, 2)).toBe(FOLLOW.slowPollMs * 2);
    expect(nextDelay(0, 10)).toBe(FOLLOW.maxBackoffMs);
  });
});

describe("stalled", () => {
  it("gives up on an import still waiting after a minute, or running with nothing done for 3 minutes", () => {
    expect(stalled(job("queued"), FOLLOW.queuedLimitMs - 1)).toBeNull();
    expect(stalled(job("queued"), FOLLOW.queuedLimitMs)).toBe("notStarted");
    expect(stalled(job("running"), FOLLOW.queuedLimitMs)).toBeNull();
    expect(stalled(job("running"), FOLLOW.stalledLimitMs)).toBe("stalled");
    expect(stalled(job("done"), FOLLOW.stalledLimitMs * 10)).toBeNull();
  });
});

describe("withTimeout", () => {
  it("settles with the request", async () => {
    await expect(withTimeout(1000, null, async () => "ok")).resolves.toBe("ok");
    await expect(withTimeout(1000, null, async () => Promise.reject(new Error("no")))).rejects.toThrow("no");
  });

  it("rejects with RequestTimeout and aborts the signal, even if the request never looks at it", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null = null;
    const pending = withTimeout(5000, null, (s) => {
      signal = s;
      return new Promise<never>(() => undefined);
    });
    const assertion = expect(pending).rejects.toBeInstanceOf(RequestTimeout);
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(signal!.aborted).toBe(true);
  });

  it("gives up at once when the outer signal aborts (the dialog closed)", async () => {
    const outer = new AbortController();
    const pending = withTimeout(60_000, outer.signal, () => new Promise<never>(() => undefined));
    outer.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

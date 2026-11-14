import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ApiClient, ApiError, createMemoryTokenStorage, type TokenStorage } from "@store-builder/api-client";

/**
 * The shared client's silent refresh: an access token refused with 401 is
 * swapped through /auth/refresh. Only /auth/refresh answering 401 ends the
 * session; a 429, a 5xx or no network keeps the tokens and fails the request
 * with that error, so the screen can offer to try again.
 */

const BASE = "http://api.test/api/v1";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const refused = () => json(401, { error: { code: "INVALID_TOKEN", message: "Invalid or expired access token" } });

let storage: TokenStorage;
let expired: Mock<() => void>;
let client: ApiClient;
let fetchMock: Mock<(url: string, init?: RequestInit) => Promise<Response>>;

/** /auth/me is refused once (an expired access token); /auth/refresh answers `refresh`. */
function serve(refresh: () => Response | Promise<Response>) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/auth/refresh")) return refresh();
    const auth = new Headers(init?.headers).get("Authorization");
    if (auth === "Bearer new-access") return json(200, { user: { id: "user_1" } });
    return refused();
  });
}

beforeEach(() => {
  storage = createMemoryTokenStorage();
  storage.set({ accessToken: "old-access", refreshToken: "refresh-1" });
  expired = vi.fn<() => void>();
  client = new ApiClient({ baseUrl: BASE, tokenStorage: storage, onSessionExpired: expired });
  fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a refresh the server refuses (401)", () => {
  it("ends the session", async () => {
    serve(() => json(401, { error: { code: "INVALID_REFRESH_TOKEN", message: "Invalid refresh token" } }));

    await expect(client.me()).rejects.toMatchObject({ status: 401 });
    expect(storage.get()).toEqual({ accessToken: null, refreshToken: null });
    expect(expired).toHaveBeenCalled();
  });
});

describe("a refresh that fails any other way keeps the session", () => {
  it.each([
    ["rate limited (429)", () => json(429, { error: { code: "RATE_LIMITED", message: "Too many requests" } }), 429],
    ["a server error (500)", () => json(500, { error: { code: "INTERNAL_SERVER_ERROR", message: "Boom" } }), 500],
    ["unavailable (503)", () => new Response("Service Unavailable", { status: 503 }), 503],
  ])("%s: the tokens stay and the request fails with that status", async (_label, answer, status) => {
    serve(answer);

    const err = await client.me().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(status);
    expect(storage.get()).toEqual({ accessToken: "old-access", refreshToken: "refresh-1" });
    expect(expired).not.toHaveBeenCalled();
  });

  it("no network: the tokens stay and the request fails with the network error", async () => {
    serve(() => Promise.reject(new TypeError("Failed to fetch")));

    await expect(client.me()).rejects.toBeInstanceOf(TypeError);
    expect(storage.get()).toEqual({ accessToken: "old-access", refreshToken: "refresh-1" });
    expect(expired).not.toHaveBeenCalled();
  });

  it("the next attempt refreshes and goes through", async () => {
    let calls = 0;
    serve(() => {
      calls += 1;
      return calls === 1
        ? json(429, { error: { code: "RATE_LIMITED", message: "Too many requests" } })
        : json(200, { accessToken: "new-access", refreshToken: "refresh-2" });
    });

    await expect(client.me()).rejects.toMatchObject({ status: 429 });
    await expect(client.me()).resolves.toEqual({ id: "user_1" });
    expect(storage.get()).toEqual({ accessToken: "new-access", refreshToken: "refresh-2" });
    expect(expired).not.toHaveBeenCalled();
  });
});

it("a refresh that works retries the request with the new token", async () => {
  serve(() => json(200, { accessToken: "new-access", refreshToken: "refresh-2" }));

  await expect(client.me()).resolves.toEqual({ id: "user_1" });
  expect(storage.get()).toEqual({ accessToken: "new-access", refreshToken: "refresh-2" });
});

/**
 * Two tabs of one site share the stored tokens, and a refresh token works
 * once: the server answers a second use of it by ending every session of the
 * account. So the tabs take turns to refresh (navigator.locks), and the one
 * that waited uses the pair the other stored.
 */
describe("two tabs sharing the stored tokens", () => {
  /** navigator.locks as the tabs of one site share it: one holder at a time, the rest wait their turn. */
  function fakeLocks() {
    let tail: Promise<unknown> = Promise.resolve();
    return {
      request<T>(_name: string, options: { signal?: AbortSignal }, run: () => Promise<T>): Promise<T> {
        const turn = tail;
        const mine = new Promise<T>((resolve, reject) => {
          let given = false;
          options.signal?.addEventListener("abort", () => {
            if (!given) reject(new DOMException("The request was aborted.", "AbortError"));
          });
          void turn.then(() => {
            if (options.signal?.aborted) return;
            given = true;
            run().then(resolve, reject);
          });
        });
        tail = turn.then(() => mine.then(() => undefined, () => undefined));
        return mine;
      },
    };
  }

  /** The server: a refresh token works once, and its second use is refused. */
  function serveOnce() {
    const used = new Set<string>();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        const { refreshToken } = JSON.parse(String(init?.body)) as { refreshToken: string };
        // Answered a moment later, as over a network: both tabs have read the old token by then.
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (used.has(refreshToken)) return json(401, { error: { code: "REFRESH_TOKEN_REUSE_DETECTED", message: "All sessions revoked" } });
        used.add(refreshToken);
        return json(200, { accessToken: "new-access", refreshToken: "refresh-2" });
      }
      const auth = new Headers(init?.headers).get("Authorization");
      if (auth === "Bearer new-access") return json(200, { user: { id: "user_1" } });
      return refused();
    });
  }

  const refreshCalls = () => fetchMock.mock.calls.filter(([url]) => url.endsWith("/auth/refresh")).length;
  let otherTab: ApiClient;

  beforeEach(() => {
    otherTab = new ApiClient({ baseUrl: BASE, tokenStorage: storage, onSessionExpired: expired });
  });

  it("refused at the same moment: one of them refreshes, both go on signed in", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { locks: fakeLocks() });
    serveOnce();

    await expect(Promise.all([client.me(), otherTab.me()])).resolves.toEqual([{ id: "user_1" }, { id: "user_1" }]);
    expect(refreshCalls()).toBe(1);
    expect(storage.get()).toEqual({ accessToken: "new-access", refreshToken: "refresh-2" });
    expect(expired).not.toHaveBeenCalled();
  });

  it("without the lock (an old browser) both refresh, as before, and the second is refused", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {});
    serveOnce();

    const results = await Promise.allSettled([client.me(), otherTab.me()]);
    expect(refreshCalls()).toBe(2);
    expect(results.some((r) => r.status === "rejected")).toBe(true);
    expect(expired).toHaveBeenCalled();
  });

  it("signed out in the other tab while waiting: no refresh is sent and this tab signs out", async () => {
    const locks = fakeLocks();
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { locks });
    serveOnce();
    // The other tab holds the turn, and signs out before giving it up.
    let release: () => void = () => undefined;
    void locks.request("sb.auth.refresh", {}, () => new Promise<void>((resolve) => (release = resolve)));

    const pending = client.me().catch((e: unknown) => e);
    await new Promise((resolve) => setTimeout(resolve, 20));
    storage.clear();
    release();

    const err = await pending;
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect(refreshCalls()).toBe(0);
    expect(expired).toHaveBeenCalled();
  });

  it("a tab that keeps the turn too long does not hold this one up", async () => {
    vi.useFakeTimers();
    try {
      const locks = fakeLocks();
      vi.stubGlobal("window", {});
      vi.stubGlobal("navigator", { locks });
      serveOnce();
      // Never gives the turn up.
      void locks.request("sb.auth.refresh", {}, () => new Promise<void>(() => undefined));

      const pending = client.me();
      await vi.advanceTimersByTimeAsync(9_000);
      expect(refreshCalls()).toBe(0);
      await vi.advanceTimersByTimeAsync(2_000);

      await expect(pending).resolves.toEqual({ id: "user_1" });
      expect(refreshCalls()).toBe(1);
      expect(storage.get()).toEqual({ accessToken: "new-access", refreshToken: "refresh-2" });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("signing out of all devices", () => {
  it("asks the server with this session's token, then forgets the tokens here", async () => {
    fetchMock.mockResolvedValue(json(200, { success: true }));

    await client.signOutEverywhere();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/auth/sessions/revoke-all`);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer old-access");
    expect(storage.get()).toEqual({ accessToken: null, refreshToken: null });
    expect(expired).not.toHaveBeenCalled();
  });

  it("keeps the session when the server could not be told", async () => {
    fetchMock.mockResolvedValue(json(500, { error: { code: "INTERNAL_SERVER_ERROR", message: "Boom" } }));

    await expect(client.signOutEverywhere()).rejects.toMatchObject({ status: 500 });
    expect(storage.get()).toEqual({ accessToken: "old-access", refreshToken: "refresh-1" });
  });

  it("no network: the session stays too", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(client.signOutEverywhere()).rejects.toBeInstanceOf(TypeError);
    expect(storage.get()).toEqual({ accessToken: "old-access", refreshToken: "refresh-1" });
  });
});

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

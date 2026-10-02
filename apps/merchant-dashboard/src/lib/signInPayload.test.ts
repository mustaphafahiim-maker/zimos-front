import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, createMemoryTokenStorage } from "@store-builder/api-client";

// What the shared API client sends to POST /auth/login. An API from before
// identifier sign-in reads only `email` (and drops unknown fields), so the
// dashboard must work against it until the API is deployed.

function signInWith(payload: Parameters<ApiClient["login"]>[0]) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ user: { id: "u1", status: "active" }, accessToken: "a", refreshToken: "r" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
  );
  vi.stubGlobal("fetch", fetchMock);
  const client = new ApiClient({ baseUrl: "http://api.test/api/v1", tokenStorage: createMemoryTokenStorage() });
  return client.login(payload).then(() => {
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    return JSON.parse(String(init.body));
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("signing in through the API client", () => {
  it("sends an email as both identifier and email, so the old API signs it in too", async () => {
    expect(await signInWith({ identifier: " amr@example.com ", password: "pw", locale: "ar" })).toEqual({
      identifier: " amr@example.com ",
      email: "amr@example.com",
      password: "pw",
      locale: "ar",
    });
  });

  it("sends a username as the identifier only", async () => {
    expect(await signInWith({ identifier: "shop.owner", password: "pw" })).toEqual({ identifier: "shop.owner", password: "pw" });
  });

  it("leaves a caller's own email alone (the console sends email only)", async () => {
    expect(await signInWith({ email: "admin@zimos.test", password: "pw" })).toEqual({ email: "admin@zimos.test", password: "pw" });
  });
});

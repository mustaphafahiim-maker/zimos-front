import { describe, expect, it } from "vitest";
import { googleCallbackChallenge } from "./googleCallbackChallenge";

const read = (query: string) => googleCallbackChallenge(new URLSearchParams(query));

describe("googleCallbackChallenge", () => {
  it("reads the challenge the API sends back for an account with two-step sign-in", () => {
    expect(read("twoFactorRequired=true&challengeToken=c1&channel=email&sentTo=o***%40zimos.test")).toEqual({
      twoFactorRequired: true,
      challengeToken: "c1",
      channel: "email",
      sentTo: "o***@zimos.test",
    });
  });

  it("carries the flags that change the code screen", () => {
    expect(read("twoFactorRequired=true&challengeToken=c1&channel=whatsapp&codeNotSent=true&newDevice=true")).toMatchObject({
      channel: "whatsapp",
      codeNotSent: true,
      newDevice: true,
    });
  });

  it("falls back to the authenticator app for a channel it does not know", () => {
    expect(read("twoFactorRequired=true&challengeToken=c1&channel=pigeon")?.channel).toBe("totp");
  });

  it("is null for a normal sign-in, an error, or a challenge without its token", () => {
    expect(read("accessToken=a&refreshToken=r")).toBeNull();
    expect(read("error=GOOGLE_LOGIN_FAILED")).toBeNull();
    expect(read("twoFactorRequired=true")).toBeNull();
    expect(read("twoFactorRequired=false&challengeToken=c1")).toBeNull();
  });
});

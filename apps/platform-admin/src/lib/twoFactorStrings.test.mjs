import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TWO_FACTOR_STRINGS, challengeBody, cleanCode, codeReady, modeLabel } from "./twoFactorStrings.ts";

const en = TWO_FACTOR_STRINGS.en;
const ar = TWO_FACTOR_STRINGS.ar;
const base = { twoFactorRequired: true, challengeToken: "c1" };

describe("the line over the console's code field", () => {
  it("says where the code went, by channel", () => {
    assert.equal(challengeBody(en, { ...base, channel: "email", sentTo: "o***@zimos.co" }), "We sent a 6-digit code to o***@zimos.co.");
    assert.equal(challengeBody(en, { ...base, channel: "whatsapp", sentTo: "+20•••00" }), "We sent a 6-digit code to +20•••00 on WhatsApp.");
    assert.equal(challengeBody(en, { ...base, channel: "sms", sentTo: "+20•••00" }), "We sent a 6-digit code to +20•••00 by SMS.");
    assert.equal(challengeBody(en, { ...base, channel: "totp" }), "Enter the 6-digit code from your authenticator app.");
    assert.equal(challengeBody(en, { ...base, channel: "email" }), "We sent a 6-digit code to you.");
  });

  it("says why no code was sent, and only offers a backup code to an account that has them", () => {
    assert.match(challengeBody(en, { ...base, channel: "email", codeNotSent: true }), /Use a backup code/);
    assert.doesNotMatch(challengeBody(en, { ...base, channel: "email", codeNotSent: true, newDevice: true }), /backup code/);
  });

  it("has every string in Arabic too", () => {
    assert.deepEqual(Object.keys(ar).sort(), Object.keys(en).sort());
    assert.equal(challengeBody(ar, { ...base, channel: "totp" }), "أدخل الرمز المكوّن من ٦ أرقام من تطبيق المصادقة.");
  });
});

describe("what may be typed as a code", () => {
  it("keeps six digits for a sign-in code", () => {
    assert.equal(cleanCode("12a 34-56", false), "123456");
    assert.equal(codeReady("12345", false), false);
    assert.equal(codeReady("123456", false), true);
  });

  it("keeps capitals, digits and the dash for a backup code", () => {
    assert.equal(cleanCode("abcd-efgh!", true), "ABCD-EFGH");
    assert.equal(codeReady("ABCD-EFG", true), false);
    assert.equal(codeReady("ABCD-EFGH", true), true);
    assert.equal(codeReady("ABCDEFGH", true), true);
  });
});

describe("a person's second step on their page", () => {
  it("names each mode, and says so when the API does not report it", () => {
    assert.equal(modeLabel(en, "off"), "Off");
    assert.equal(modeLabel(en, "totp"), "Authenticator app");
    assert.equal(modeLabel(en, "whatsapp"), "WhatsApp code");
    assert.equal(modeLabel(en, null), "Not reported");
    assert.equal(modeLabel(ar, "email"), "رمز بالبريد الإلكتروني");
  });
});

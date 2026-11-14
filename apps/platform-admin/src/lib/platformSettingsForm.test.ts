import { describe, expect, it } from "vitest";
import { changedFields, linkError, socialRows, validateGroup, type FormRules } from "./platformSettingsForm";

/** The form's own checks (lib/platformSettingsForm.ts), the API's rules run in the browser. */

const RULES: FormRules = {
  socialDomains: { instagram: ["instagram.com"], youtube: ["youtube.com", "youtu.be"], x: ["x.com", "twitter.com"], whatsapp: ["wa.me"] },
  limits: { tagline: 160, rights: 120 },
};

describe("a social link", () => {
  it("takes https on the platform's own domain or a subdomain", () => {
    expect(linkError("instagram", "https://instagram.com/zimos.co", RULES)).toBeNull();
    expect(linkError("instagram", "https://www.instagram.com/zimos.co", RULES)).toBeNull();
    expect(linkError("youtube", "https://youtu.be/abc", RULES)).toBeNull();
  });

  it("refuses javascript:, data:, http: and links with no scheme", () => {
    for (const url of ["javascript:alert(1)", " JAVASCRIPT:alert(1)", "data:text/html,x", "http://instagram.com/a", "//instagram.com/a", "instagram.com/a"]) {
      expect(linkError("instagram", url, RULES)?.key).toBe("err_scheme");
    }
  });

  it("refuses a lookalike domain, a user or a port, and spaces", () => {
    expect(linkError("instagram", "https://instagram.com.evil.example", RULES)).toEqual({ key: "err_domain", params: { domains: "instagram.com" } });
    expect(linkError("instagram", "https://evilinstagram.com", RULES)?.key).toBe("err_domain");
    expect(linkError("x", "https://a:b@x.com/z", RULES)?.key).toBe("err_credentials");
    expect(linkError("x", "https://x.com:444/z", RULES)?.key).toBe("err_credentials");
    expect(linkError("x", "https://x.com/a b", RULES)?.key).toBe("err_spaces");
  });

  it("takes WhatsApp as wa.me and a number only", () => {
    expect(linkError("whatsapp", "https://wa.me/201501921444?text=hi", RULES)).toBeNull();
    expect(linkError("whatsapp", "https://wa.me/+201501921444", RULES)?.key).toBe("err_waNumber");
    expect(linkError("whatsapp", "https://wa.me/0101", RULES)?.key).toBe("err_waNumber");
    expect(linkError("whatsapp", "https://wa.me/201501921444?phone=2", RULES)?.key).toBe("err_waQuery");
  });

  it("takes mailto: with one address for email, nothing else", () => {
    expect(linkError("email", "mailto:support@zimos.co", RULES)).toBeNull();
    expect(linkError("email", "mailto:a@b.co?bcc=c@d.co", RULES)?.key).toBe("err_mailto");
    expect(linkError("email", "https://zimos.co", RULES)?.key).toBe("err_mailto");
  });
});

describe("a group", () => {
  it("holds texts to their limit and refuses HTML", () => {
    const errors = validateGroup("footer", { tagline: { ar: "أ".repeat(161), en: "<i>x</i>" }, rights: { ar: "", en: "ok" } }, RULES);
    expect(errors).toEqual({
      "tagline.ar": { key: "err_tooLong", params: { max: 160 } },
      "tagline.en": { key: "err_html" },
      "rights.ar": { key: "err_required" },
    });
  });

  it("lists every platform for the social form, the ones not saved last and off", () => {
    const rows = socialRows([{ platform: "x", url: "https://x.com/a", enabled: true }], ["instagram", "x", "email"]);
    expect(rows).toEqual([
      { platform: "x", url: "https://x.com/a", enabled: true },
      { platform: "instagram", url: null, enabled: false },
      { platform: "email", url: null, enabled: false },
    ]);
  });

  it("names the fields that changed", () => {
    expect(changedFields({ a: { ar: "1" }, b: 2 }, { a: { ar: "2" }, b: 2 })).toEqual(["a"]);
  });
});

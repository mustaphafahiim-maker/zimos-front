/**
 * The shared reading of the API's public platform settings
 * (packages/ui/src/platform-info), tested here because the dashboard is the
 * workspace that has vitest. The marketing site uses the same functions.
 */
import { describe, expect, it } from "vitest";
import { parsePublicPlatformSettings, socialLinksOf, textIn } from "@store-builder/ui/platform-info";
import { SOCIAL_LINKS } from "@store-builder/ui/social-links";

const GOOD = {
  contact: { supportEmail: "help@zimos.co", phone: "+201001234567", address: { ar: "القاهرة", en: "Cairo" }, hours: { ar: "كل يوم", en: "Every day" } },
  social: { links: [{ platform: "x", url: "https://x.com/zimos", enabled: true, order: 1 }] },
  company: { platformName: "ZIMOS", legalName: { ar: "زيموس", en: "Zimos" }, registration: { ar: "١", en: "1" }, taxRegistration: "1-2-3" },
  footer: { tagline: { ar: "أ", en: "a" }, rights: { ar: "ب", en: "b" } },
};

describe("reading the answer", () => {
  it("keeps a well-formed answer as it is", () => {
    expect(parsePublicPlatformSettings({ settings: GOOD })).toEqual(GOOD);
  });

  it("gives null for anything that isn't an answer", () => {
    for (const body of [null, "x", [], {}, { settings: null }, { settings: [] }]) {
      expect(parsePublicPlatformSettings(body)).toBeNull();
    }
  });

  it("drops a malformed group alone, so the site uses its own values for it", () => {
    const parsed = parsePublicPlatformSettings({
      settings: {
        ...GOOD,
        contact: { ...GOOD.contact, address: { ar: "", en: "Cairo" } },
        company: { ...GOOD.company, platformName: 42 },
        footer: { tagline: { ar: "x".repeat(1001), en: "a" }, rights: GOOD.footer.rights },
      },
    });
    expect(parsed).toMatchObject({ contact: null, company: null, footer: null, social: GOOD.social });
  });

  it("skips a link of an unknown platform or without a flag, and keeps the rest in order", () => {
    const parsed = parsePublicPlatformSettings({
      settings: { ...GOOD, social: { links: [{ platform: "myspace", url: "https://myspace.com", enabled: true }, { platform: "x", url: "https://x.com/a" }, { platform: "email", url: "mailto:a@b.co", enabled: true }] } },
    });
    expect(parsed?.social?.links).toEqual([{ platform: "email", url: "mailto:a@b.co", enabled: true, order: 3 }]);
  });
});

describe("falling back", () => {
  it("uses the code's links and words when a group is missing", () => {
    expect(socialLinksOf(null)).toBe(SOCIAL_LINKS);
    expect(socialLinksOf({ contact: null, social: null, company: null, footer: null })).toBe(SOCIAL_LINKS);
    expect(textIn(undefined, "ar", "fallback")).toBe("fallback");
    expect(textIn({ ar: "عربي", en: "English" }, "en", "fallback")).toBe("English");
  });
});

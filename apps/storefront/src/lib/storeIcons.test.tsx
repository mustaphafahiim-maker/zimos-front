// @vitest-environment node
import { describe, expect, it } from "vitest";
import { httpUrlOrNull, storeIcons } from "./storeIcons";

const LOGO = "https://media.example.com/stores/abc/logo.png";

describe("storeIcons", () => {
  it("uses the store's logo for the tab, shortcut and apple icons", () => {
    expect(storeIcons({ logoUrl: LOGO })).toEqual({ icon: LOGO, shortcut: LOGO, apple: LOGO });
    expect(storeIcons({ faviconUrl: null, logoUrl: "http://localhost:4000/uploads/logo.png" })).toEqual({
      icon: "http://localhost:4000/uploads/logo.png",
      shortcut: "http://localhost:4000/uploads/logo.png",
      apple: "http://localhost:4000/uploads/logo.png",
    });
  });

  it("leaves the default icons when there is no logo", () => {
    expect(storeIcons({})).toBeUndefined();
    expect(storeIcons({ logoUrl: null })).toBeUndefined();
    expect(storeIcons({ logoUrl: "   " })).toBeUndefined();
  });

  it("leaves the default icons for a logo that is not an http(s) URL", () => {
    for (const logoUrl of ["/uploads/logo.png", "logo.png", "data:image/png;base64,AAAA", "javascript:alert(1)", "ftp://x.example.com/logo.png"]) {
      expect(storeIcons({ logoUrl })).toBeUndefined();
    }
  });

  it("keeps the favicon the merchant set over the logo; an .ico leaves the home-screen icon to the logo", () => {
    expect(storeIcons({ faviconUrl: "https://cdn.example.com/fav.ico", logoUrl: LOGO })).toEqual({
      icon: "https://cdn.example.com/fav.ico",
      shortcut: "https://cdn.example.com/fav.ico",
      apple: LOGO,
    });
    expect(storeIcons({ faviconUrl: "https://cdn.example.com/fav.ico" })).toEqual({
      icon: "https://cdn.example.com/fav.ico",
      shortcut: "https://cdn.example.com/fav.ico",
    });
  });

  it("uses an uploaded PNG favicon for the tab and the home screen", () => {
    const FAV = "https://media.example.com/ws_1/3f2a.png";
    expect(storeIcons({ faviconUrl: FAV, logoUrl: LOGO })).toEqual({ icon: FAV, shortcut: FAV, apple: FAV });
  });

  it("ignores a favicon that is not an http(s) URL and falls back to the logo, then the defaults", () => {
    for (const faviconUrl of ["", "   ", "/uploads/fav.png", "fav.png", "javascript:alert(1)"]) {
      expect(storeIcons({ faviconUrl, logoUrl: LOGO })).toEqual({ icon: LOGO, shortcut: LOGO, apple: LOGO });
      expect(storeIcons({ faviconUrl })).toBeUndefined();
    }
  });
});

describe("httpUrlOrNull", () => {
  it("accepts only absolute http(s) URLs", () => {
    expect(httpUrlOrNull(LOGO)).toBe(LOGO);
    expect(httpUrlOrNull("mailto:a@b.co")).toBeNull();
    expect(httpUrlOrNull(42)).toBeNull();
  });
});

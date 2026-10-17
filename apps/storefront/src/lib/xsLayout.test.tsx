// @vitest-environment node
import { describe, expect, it } from "vitest";
import { defaultHeaderZones, headerZonesByDevice, isLanguageWord, readFooterBottom, readFooterColumns, readHeaderZones, withColorModeSwitch, withLanguageSwitch, zoneGroups } from "./xsLayout";

const SHOW = { cart: true, track: false, language: true };

describe("xsLayout: a template header's zones", () => {
  it("keeps the phone menu's button whatever was saved", () => {
    const zones = readHeaderZones({ brand: [{ id: "logo", type: "logo" }], icons: [{ id: "cart", type: "cart" }] });
    expect(zones?.icons.map((p) => p.type)).toEqual(["cart", "phone"]);
  });

  it("drops what it cannot trust: unknown types, repeated ids or single parts, unsafe addresses, empty words", () => {
    const zones = readHeaderZones({
      links: [
        { id: "a", type: "link", label: "Track", href: "/track" },
        { id: "a", type: "text", label: "again" },
        { id: "b", type: "link", label: "Bad", href: "javascript:alert(1)" },
        { id: "c", type: "text", label: "   " },
        { id: "d", type: "widget" },
        { id: "<x>", type: "text", label: "x" },
      ],
      icons: [
        { id: "cart", type: "cart" },
        { id: "cart-2", type: "cart" },
      ],
    });
    expect(zones?.links).toEqual([{ id: "a", type: "link", label: "Track", href: "/track" }]);
    expect(zones?.icons.map((p) => p.id)).toEqual(["cart", "phone"]);
  });

  it("is null when nothing was arranged", () => {
    expect(readHeaderZones(undefined)).toBeNull();
    expect(readHeaderZones({})).toBeNull();
  });

  it("starts from the template: its strip links, the switches the store has on", () => {
    const zones = defaultHeaderZones("05", SHOW);
    expect(zones.brand).toEqual([{ id: "logo", type: "logo" }]);
    expect(zones.links.at(-1)).toEqual({ id: "language", type: "language" });
    expect(zones.icons.map((p) => p.type)).toEqual(["search", "account", "wishlist", "cart", "phone"]);
    expect(defaultHeaderZones("05", { ...SHOW, cart: false }).icons.map((p) => p.type)).not.toContain("cart");
  });

  it("takes a smaller screen's arrangement from the next larger one", () => {
    const fallback = defaultHeaderZones("05", SHOW);
    const phone = { ...fallback, icons: [{ id: "cart", type: "cart" }, { id: "phone", type: "phone" }] };
    const byDevice = headerZonesByDevice({ base: fallback, mobile: phone }, fallback);
    expect(byDevice.tablet).toEqual(fallback);
    expect(byDevice.mobile.icons.map((p) => p.id)).toEqual(["cart", "phone"]);
    // One list where the screens agree, a group per screen where they do not.
    expect(zoneGroups(byDevice, "brand")).toEqual([{ devices: null, parts: fallback.brand }]);
    expect(zoneGroups(byDevice, "icons").map((g) => g.devices)).toEqual([["base", "tablet"], ["mobile"]]);
  });
});

describe("xsLayout: the store's language button", () => {
  // XS 01 as the console has it: a word "EN" where a language switch would stand.
  const xs01 = headerZonesByDevice(undefined, defaultHeaderZones("01", { cart: true, track: false, language: false }));
  const strip = (byDevice: ReturnType<typeof withLanguageSwitch>, device: "base" | "tablet" | "mobile" = "base") =>
    byDevice[device].links.map((p) => `${p.type}:${p.label ?? p.id}`);

  it("knows the templates' words for it, in both languages, and nothing else", () => {
    expect(isLanguageWord({ id: "a", type: "text", label: " EN " })).toBe(true);
    expect(isLanguageWord({ id: "a", type: "text", label: "العربية" })).toBe(true);
    expect(isLanguageWord({ id: "a", type: "text", label: "EGP" })).toBe(false);
    expect(isLanguageWord({ id: "a", type: "link", label: "EN", href: "/en" })).toBe(false);
  });

  it("off: leaves the word out on every screen, and nothing else changes", () => {
    const off = withLanguageSwitch(xs01, false);
    expect(strip(off)).toEqual(["link:Help & FAQs", "link:My Account", "text:USD"]);
    expect(strip(off, "mobile")).toEqual(strip(off));
    expect(off.base.icons).toEqual(xs01.base.icons);
  });

  it("on: the switch stands in the word's place", () => {
    const on = withLanguageSwitch(xs01, true);
    expect(strip(on)).toEqual(["link:Help & FAQs", "link:My Account", "language:strip-2", "text:USD"]);
    expect(strip(on, "mobile")).toEqual(strip(on));
  });

  it("on: a template without the word gets the switch at the end of the strip's links", () => {
    const xs05 = headerZonesByDevice(undefined, defaultHeaderZones("05", { cart: true, track: false, language: false }));
    expect(strip(withLanguageSwitch(xs05, true)).at(-1)).toBe("language:language");
    expect(withLanguageSwitch(xs05, false)).toEqual(xs05);
  });

  it("keeps a switch the merchant added, on or off, and never shows two", () => {
    const own = headerZonesByDevice({ ...xs01.base, icons: [...xs01.base.icons, { id: "lang", type: "language" }] }, xs01.base);
    for (const on of [true, false]) {
      const zones = withLanguageSwitch(own, on);
      const switches = Object.values(zones.base).flat().filter((p) => p.type === "language");
      expect(switches.map((p) => p.id)).toEqual(["lang"]);
      expect(strip(zones)).toEqual(["link:Help & FAQs", "link:My Account", "text:USD"]);
    }
  });
});

describe("xsLayout: the store's light/dark button", () => {
  const xs01 = headerZonesByDevice(undefined, defaultHeaderZones("01", { cart: true, track: false, language: false }));
  const strip = (byDevice: ReturnType<typeof withColorModeSwitch>, device: "base" | "tablet" | "mobile" = "base") =>
    byDevice[device].links.map((p) => `${p.type}:${p.id}`);

  it("off: the zones are as they were", () => {
    expect(withColorModeSwitch(xs01, false)).toBe(xs01);
  });

  it("on: right after the language switch, on every screen", () => {
    const zones = withColorModeSwitch(withLanguageSwitch(xs01, true), true);
    expect(strip(zones)).toEqual(["link:strip-0", "link:strip-1", "language:strip-2", "mode:color-mode", "text:strip-3"]);
    expect(strip(zones, "mobile")).toEqual(strip(zones));
  });

  it("on, with no language switch: at the end of the strip's links", () => {
    const zones = withColorModeSwitch(withLanguageSwitch(xs01, false), true);
    expect(strip(zones).at(-1)).toBe("mode:color-mode");
    expect(Object.values(zones.base).flat().filter((p) => p.type === "mode")).toHaveLength(1);
  });

  it("is never read from a saved arrangement: only the store's settings place it", () => {
    const zones = readHeaderZones({ links: [{ id: "m", type: "mode" }], icons: [{ id: "cart", type: "cart" }] });
    expect(zones?.links).toEqual([]);
  });
});

describe("xsLayout: a template footer", () => {
  it("reads its columns and bottom line, nothing else", () => {
    expect(readFooterColumns([{ id: "c", type: "contact", title: "Call us" }, { id: "x", type: "map" }])?.map((c) => c.type)).toEqual(["contact"]);
    expect(readFooterBottom([{ id: "r", type: "rights" }, { id: "credit", type: "credit" }])?.map((p) => p.type)).toEqual(["rights"]);
    expect(readFooterColumns("nope")).toBeNull();
    // Left off some screens: only the screens there are.
    expect(readFooterColumns([{ id: "c", type: "contact", hide: ["mobile", "watch"] }])?.[0].hide).toEqual(["mobile"]);
    expect(readFooterColumns([{ id: "c", type: "contact", hide: [] }])?.[0].hide).toBeUndefined();
  });
});

// @vitest-environment node
import { describe, expect, it } from "vitest";
import { defaultHeaderZones, headerZonesByDevice, readFooterBottom, readFooterColumns, readHeaderZones, zoneGroups } from "./xsLayout";

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

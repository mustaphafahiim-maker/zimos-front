// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readShopperDisplay } from "./shopperDisplay";
import { resolveColorMode, storeColorModeOptions } from "./storeColorMode";

/** A store wearing look `look` (null: the store's own header) with these shoppers' settings. */
const store = (look: string | null, shopperDisplay?: Record<string, unknown>) => ({
  ...(look ? { xsLook: look } : {}),
  ...(shopperDisplay ? { shopperDisplay } : {}),
});

describe("a store's light and dark", () => {
  it("is light, with no button and no dark file, for a store that never chose — whatever the shopper's cookie says", () => {
    expect(storeColorModeOptions(store("05"))).toEqual({ capable: false, button: false, fallback: "light" });
    expect(resolveColorMode(store("05"), "dark")).toBe("light");
    expect(readShopperDisplay(store("05"))).toMatchObject({ colorMode: "light", colorModeSwitch: false });
  });

  it("opens in the merchant's default, which a shopper can't change without the button", () => {
    const dark = store("05", { colorMode: "dark" });
    expect(storeColorModeOptions(dark)).toEqual({ capable: true, button: false, fallback: "dark" });
    expect(resolveColorMode(dark, undefined)).toBe("dark");
    expect(resolveColorMode(dark, "light")).toBe("dark");
  });

  it("follows the shopper's pick while the button shows, and the default before they pick", () => {
    const both = store("05", { colorMode: "light", colorModeSwitch: true });
    expect(storeColorModeOptions(both)).toEqual({ capable: true, button: true, fallback: "light" });
    expect(resolveColorMode(both, undefined)).toBe("light");
    expect(resolveColorMode(both, "dark")).toBe("dark");
    expect(resolveColorMode(store("05", { colorMode: "dark", colorModeSwitch: true }), "light")).toBe("light");
    // Anything else in the cookie is no pick.
    expect(resolveColorMode(both, "purple")).toBe("light");
  });

  it("leaves a store on its own header, and a template that is dark already, as they are", () => {
    const settings = { colorMode: "dark", colorModeSwitch: true };
    for (const themeSettings of [store(null, settings), store("19", settings), store("22", settings), store("99", settings)]) {
      expect(storeColorModeOptions(themeSettings)).toEqual({ capable: false, button: false, fallback: "light" });
      expect(resolveColorMode(themeSettings, "dark")).toBe("light");
    }
  });

  it("reads nothing it doesn't know", () => {
    expect(readShopperDisplay({ shopperDisplay: { colorMode: "DARK", colorModeSwitch: "yes" } })).toMatchObject({ colorMode: "light", colorModeSwitch: false });
  });
});

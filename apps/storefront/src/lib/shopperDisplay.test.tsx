// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { StorefrontMeta } from "@store-builder/api-client";
import { readShopperDisplay } from "./shopperDisplay";
import { storeDefaultLocale } from "./storeLocale";

/** The look a store reads as when it never chose one: light, no button. */
const LIGHT = { colorMode: "light", colorModeSwitch: false } as const;

/** A store as GET /store/:ws answers it: its own language (always Arabic today) and its themeSettings. */
const store = (themeSettings: Record<string, unknown>) => ({ defaultLocale: "ar-EG", themeSettings }) as unknown as StorefrontMeta;

describe("the store's language for shoppers", () => {
  it("reads as no language of its own and no button for a store that never saved it", () => {
    expect(readShopperDisplay({})).toEqual({ locale: null, localeSwitch: false, ...LIGHT });
    expect(readShopperDisplay(undefined)).toEqual({ locale: null, localeSwitch: false, ...LIGHT });
    expect(readShopperDisplay({ shopperDisplay: "en" })).toEqual({ locale: null, localeSwitch: false, ...LIGHT });
  });

  it("reads Arabic or English and a button switched on, nothing else", () => {
    expect(readShopperDisplay({ shopperDisplay: { locale: "en", localeSwitch: true } })).toEqual({ locale: "en", localeSwitch: true, ...LIGHT });
    expect(readShopperDisplay({ shopperDisplay: { locale: "ar" } })).toEqual({ locale: "ar", localeSwitch: false, ...LIGHT });
    expect(readShopperDisplay({ shopperDisplay: { locale: "fr", localeSwitch: "yes" } })).toEqual({ locale: null, localeSwitch: false, ...LIGHT });
  });

  it("opens the store in the language the merchant picked, over the API's", () => {
    expect(storeDefaultLocale(store({ shopperDisplay: { locale: "en" } }))).toBe("en");
    expect(storeDefaultLocale(store({ shopperDisplay: { locale: "ar" } }))).toBe("ar");
  });

  it("opens a store that never picked one exactly as before", () => {
    expect(storeDefaultLocale(store({}))).toBe("ar");
    expect(storeDefaultLocale(store({ shopperDisplay: { localeSwitch: true } }))).toBe("ar");
    // themeSettings' older keys still come after the API's language, as they did.
    expect(storeDefaultLocale(store({ defaultLocale: "en" }))).toBe("ar");
    expect(storeDefaultLocale({ themeSettings: { locale: "en" } } as unknown as StorefrontMeta)).toBe("en");
    expect(storeDefaultLocale(null)).toBe("ar");
  });
});

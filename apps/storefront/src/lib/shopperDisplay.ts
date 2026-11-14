/**
 * What a shopper sees first and what they may switch, as the merchant sets it
 * (dashboard → store settings → Languages), saved in the store's
 * themeSettings as `shopperDisplay`:
 *
 *   locale            the store's language for a shopper who hasn't picked one: "ar" | "en"
 *                     (lib/storeLocale; the API answers in it too, where the store
 *                     has its content translated)
 *   localeSwitch      a language button in the header and the phone menu of an
 *                     imported template's header (components/xs/XsHeader)
 *   colorMode         the light or dark look of an imported template for a shopper
 *                     who hasn't picked one: "light" | "dark" (lib/storeColorMode)
 *   colorModeSwitch   a light/dark button beside the language one
 *
 * The shopper's own pick (the language cookie, the colour-mode cookie) wins
 * over `locale` and `colorMode` — the colour mode's only while the store shows
 * its button.
 *
 * Room for more of the same kind later without a migration: themeSettings is
 * an open blob the API keeps as sent.
 *
 * A store that never saved it — every store before this — reads as no
 * language of its own, light, and no buttons, which is exactly how it worked
 * before.
 */
export interface ShopperDisplay {
  /** The merchant's default language, or null for the API's (the store's own, Arabic). */
  locale: "ar" | "en" | null;
  localeSwitch: boolean;
  colorMode: "light" | "dark";
  colorModeSwitch: boolean;
}

type Blob = Record<string, unknown>;

export function readShopperDisplay(themeSettings: unknown): ShopperDisplay {
  const settings = themeSettings && typeof themeSettings === "object" && !Array.isArray(themeSettings) ? (themeSettings as Blob) : {};
  const raw = settings.shopperDisplay;
  const display = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Blob) : {};
  return {
    locale: display.locale === "ar" || display.locale === "en" ? display.locale : null,
    localeSwitch: display.localeSwitch === true,
    colorMode: display.colorMode === "dark" ? "dark" : "light",
    colorModeSwitch: display.colorModeSwitch === true,
  };
}

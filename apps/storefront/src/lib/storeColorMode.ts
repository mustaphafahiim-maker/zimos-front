import { cookies } from "next/headers";
import type { StorefrontMeta } from "@store-builder/api-client";
import { NATIVE_DARK_LOOKS } from "./xsDarkPalette.mjs";
import { COLOR_MODE_COOKIE } from "./colorModeCookie";
import { readShopperDisplay } from "./shopperDisplay";
import { xsShellOf } from "./xsShell";

export { COLOR_MODE_COOKIE };

export type ColorMode = "light" | "dark";

/**
 * What a store that wears an imported template can do with light and dark
 * (Languages → shoppers' look, lib/shopperDisplay):
 *
 *   capable   it may be drawn dark — dark by default, or the button shown —
 *             so its pages link the dark stylesheet (scripts/xs-dark.mjs)
 *   button    the light/dark button is in its header and phone menu
 *
 * A template that is dark already (XS 19, XS 22) has nothing to switch: it is
 * neither. So is a store without a template's header, whose own header has
 * its own switch (components/ThemeToggle).
 */
export function storeColorModeOptions(themeSettings: unknown): { capable: boolean; button: boolean; fallback: ColorMode } {
  const look = xsShellOf(themeSettings as Record<string, unknown> | null);
  const display = readShopperDisplay(themeSettings);
  if (!look || NATIVE_DARK_LOOKS.includes(look)) return { capable: false, button: false, fallback: "light" };
  return {
    capable: display.colorMode === "dark" || display.colorModeSwitch,
    button: display.colorModeSwitch,
    fallback: display.colorMode,
  };
}

/**
 * The store's colour mode for this shopper: their own pick (the cookie) while
 * the store shows the button, else the merchant's default; always light for a
 * store that can't be dark — exactly as every store was drawn before.
 */
export function resolveColorMode(themeSettings: unknown, cookie: string | undefined): ColorMode {
  const { capable, button, fallback } = storeColorModeOptions(themeSettings);
  if (!capable) return "light";
  if (button && (cookie === "light" || cookie === "dark")) return cookie;
  return fallback;
}

/** Server-only: the colour mode the store layout draws in (`data-color-mode` on the store wrapper). */
export async function getStoreColorMode(store: Pick<StorefrontMeta, "themeSettings">): Promise<ColorMode> {
  const jar = await cookies();
  return resolveColorMode(store.themeSettings, jar.get(COLOR_MODE_COOKIE)?.value);
}

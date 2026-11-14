import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StorefrontMeta } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { StoreShellProvider } from "@/lib/StoreShellContext";
import type { ColorMode } from "@/lib/storeColorMode";

/*
 * The light/dark button of an imported template's header (Languages →
 * shoppers' look, themeSettings.shopperDisplay.colorModeSwitch). The store
 * layout works out the mode and whether the button shows (lib/storeColorMode);
 * the header draws what it is given.
 */

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: router.refresh }),
  usePathname: () => "/",
  useParams: () => ({ workspaceId: "shop" }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/CartProvider", () => ({ useCart: () => ({ itemCount: 0, openDrawer: vi.fn() }) }));

import { XsHeader } from "./XsHeader";

const INFO = { workspaceId: "shop", id: "shop", slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo;

function shellOf(key: string): Record<string, unknown> {
  const file = resolve(__dirname, `../../../../merchant-dashboard/src/pages/website/templates/generated/console/${key}.json`);
  return JSON.parse(readFileSync(file, "utf8")).globalStyles.themeSettings;
}

function show(shopperDisplay: Record<string, unknown>, mode: ColorMode, button: boolean) {
  const store = {
    id: "shop",
    name: "Shop",
    slug: "shop",
    logoUrl: null,
    tagline: null,
    currency: "EGP",
    themeSettings: { ...shellOf("xs-01"), shopperDisplay },
    navPages: [],
    headerCollections: [],
  } as unknown as StorefrontMeta;
  render(
    <StoreContextProvider locale="en" store={INFO}>
      <StoreShellProvider>
        <div className="brand-theme" data-color-mode={mode === "dark" ? "dark" : undefined}>
          <XsHeader store={store} locale="en" look="01" colorMode={mode} colorModeButton={button} />
        </div>
      </StoreShellProvider>
    </StoreContextProvider>
  );
  return { strip: document.querySelector<HTMLElement>('[data-xs-zone="links"]')!, wrapper: document.querySelector<HTMLElement>(".brand-theme")! };
}

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  router.refresh.mockClear();
  document.cookie = "zimos_store_color_mode=; path=/; max-age=0";
});

describe("an imported template's light/dark button", () => {
  it("is not there unless the store shows it", () => {
    show({}, "light", false);
    expect(screen.queryByRole("button", { name: "Switch to dark mode" })).toBeNull();
    expect(document.querySelector("[data-color-mode-switch]")).toBeNull();
  });

  it("stands right after the language switch and turns the store dark, keeping the pick in a cookie", () => {
    const { strip, wrapper } = show({ localeSwitch: true, colorModeSwitch: true }, "light", true);
    expect(Array.from(strip.children).map((el) => el.getAttribute("data-xs-part"))).toEqual(["strip-0", "strip-1", "strip-2", "color-mode", "strip-3"]);

    fireEvent.click(within(strip).getByRole("button", { name: "Switch to dark mode" }));
    expect(wrapper.getAttribute("data-color-mode")).toBe("dark");
    expect(document.cookie).toContain("zimos_store_color_mode=dark");
    expect(router.refresh).toHaveBeenCalled();
    // The button now offers the way back.
    expect(within(strip).getByRole("button", { name: "Switch to light mode" })).toBeTruthy();
  });

  it("offers light on a store drawn dark, and takes the wrapper back to light", () => {
    const { strip, wrapper } = show({ colorMode: "dark", colorModeSwitch: true }, "dark", true);
    fireEvent.click(within(strip).getByRole("button", { name: "Switch to light mode" }));
    expect(wrapper.hasAttribute("data-color-mode")).toBe(false);
    expect(document.cookie).toContain("zimos_store_color_mode=light");
  });

  it("is in the phone menu too", () => {
    show({ colorModeSwitch: true }, "light", true);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Switch to dark mode" })).toBeTruthy();
  });
});

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StorefrontMeta } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { StoreShellProvider } from "@/lib/StoreShellContext";
import type { Locale } from "@/lib/i18n";

/*
 * The language button of an imported template's header (Languages →
 * "language button", themeSettings.shopperDisplay.localeSwitch). The
 * templates are the console's own files, so XS 01's "EN" — and its Arabic
 * copy's "العربية" — are the words the stores that took them have saved.
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

/** A template's header and footer, as the console file the store took it from has them. */
function shellOf(key: string): Record<string, unknown> {
  const file = resolve(__dirname, `../../../../merchant-dashboard/src/pages/website/templates/generated/console/${key}.json`);
  return JSON.parse(readFileSync(file, "utf8")).globalStyles.themeSettings;
}

function aStore(key: string, shopperDisplay?: Record<string, unknown>): StorefrontMeta {
  return {
    id: "shop",
    name: "Shop",
    slug: "shop",
    logoUrl: null,
    tagline: null,
    currency: "EGP",
    themeSettings: { ...shellOf(key), ...(shopperDisplay ? { shopperDisplay } : {}) },
    navPages: [],
    headerCollections: [],
  } as unknown as StorefrontMeta;
}

function show(store: StorefrontMeta, locale: Locale = "en") {
  const look = (store.themeSettings as { xsLook: string }).xsLook;
  render(
    <StoreContextProvider locale={locale} store={INFO}>
      <StoreShellProvider>
        <div className="brand-theme">
          <XsHeader store={store} locale={locale} look={look} />
        </div>
      </StoreShellProvider>
    </StoreContextProvider>
  );
  return { strip: document.querySelector<HTMLElement>('[data-xs-zone="links"]')! };
}

/** The phone menu, opened; it is drawn into the store wrapper. */
function openPhoneMenu(locale: Locale = "en") {
  fireEvent.click(screen.getByRole("button", { name: locale === "ar" ? "افتح القائمة" : "Open menu" }));
  return screen.getByRole("dialog");
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
  document.cookie = "zimos_store_locale=; path=/; max-age=0";
});

describe("an imported template's language button", () => {
  it("is not there by default, and XS 01's word for it is left out", () => {
    const { strip } = show(aStore("xs-01"));
    expect(within(strip).queryByText("EN")).toBeNull();
    expect(screen.queryByRole("button", { name: "Switch to Arabic" })).toBeNull();
    // The template's other words stay as they were.
    expect(within(strip).getByText("EGP")).toBeTruthy();
    expect(within(strip).getByText("My Account")).toBeTruthy();
    expect(within(openPhoneMenu()).queryByRole("button", { name: "Switch to Arabic" })).toBeNull();
  });

  it("leaves the Arabic copy's word out too", () => {
    const { strip } = show(aStore("xs-01-ar"), "ar");
    expect(within(strip).queryByText("العربية")).toBeNull();
    expect(screen.queryByRole("button", { name: "التبديل للإنجليزية" })).toBeNull();
  });

  it("stands where XS 01 wrote EN, switches the shopper's language and keeps their pick", () => {
    const { strip } = show(aStore("xs-01", { localeSwitch: true }));
    expect(within(strip).queryByText("EN")).toBeNull();
    const button = within(strip).getByRole("button", { name: "Switch to Arabic" });
    // In the word's own place: after the template's account link, before its currency.
    expect(button.getAttribute("data-xs-part")).toBe("strip-2");
    expect(Array.from(strip.children).map((el) => el.textContent)).toEqual(["Help & FAQs", "My Account", "ع", "EGP"]);

    fireEvent.click(button);
    expect(document.cookie).toContain("zimos_store_locale=ar");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("is in the phone menu when it is on", () => {
    show(aStore("xs-01-ar", { localeSwitch: true }), "ar");
    expect(within(openPhoneMenu("ar")).getByRole("button", { name: "التبديل للإنجليزية" })).toBeTruthy();
  });

  it("goes at the end of the strip's links on a template that wrote no word for it", () => {
    const { strip } = show(aStore("xs-05", { localeSwitch: true }));
    const parts = Array.from(strip.children);
    expect(parts.at(-1)?.getAttribute("data-xs-part")).toBe("language");
    expect(screen.getAllByRole("button", { name: "Switch to Arabic" })).toHaveLength(1);
  });

  it("is one button even when the merchant added one of their own", () => {
    const store = aStore("xs-01", { localeSwitch: true });
    const header = (store.themeSettings as { header: { zones: Record<string, unknown[]> } }).header;
    header.zones = { ...header.zones, icons: [...header.zones.icons, { id: "lang", type: "language" }] };
    show(store);
    expect(screen.getAllByRole("button", { name: "Switch to Arabic" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Switch to Arabic" }).getAttribute("data-xs-part")).toBe("lang");
  });
});

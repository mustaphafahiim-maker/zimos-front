import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { SiteFooter } from "./site-footer";

/**
 * The footer with the console's settings (PLATFORM_SETTINGS_ENABLED): the
 * saved words and links when the API answers, and exactly today's footer
 * when it doesn't.
 */

// The language switch needs Next's router and the light/dark switch the i18n
// provider; neither plays a part here.
vi.mock("./locale-switcher", () => ({ LocaleSwitcher: () => null }));
vi.mock("./theme-toggle", () => ({ ThemeToggle: () => null }));

const dict = getDictionary("en");
const renderFooter = async () => render(await SiteFooter({ copy: dict.footer, brand: dict.brand, locale: "en" }));
const year = new Date().getFullYear();

beforeEach(() => {
  vi.stubEnv("PLATFORM_SETTINGS_ENABLED", "true");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("the footer", () => {
  it("is today's footer when the API can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await renderFooter();
    expect(screen.getByText("Commerce for a brighter tomorrow.")).toBeTruthy();
    expect(screen.getByText(`© ${year} ZIMOS · All rights reserved.`)).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "ZIMOS accounts" })).getAllByRole("link")).toHaveLength(6);
    expect(screen.getByText(/783-889-615/)).toBeTruthy();
  });

  it("shows the saved words, name and links", async () => {
    const body = {
      settings: {
        contact: null,
        social: { links: [{ platform: "linkedin", url: "https://www.linkedin.com/company/zimos", enabled: true, order: 1 }] },
        company: { platformName: "ZIMOS Co", legalName: { ar: "زيموس", en: "Zimos LLC" }, registration: { ar: "١٢٣", en: "123" }, taxRegistration: "111-222-333" },
        footer: { tagline: { ar: "سطر", en: "Sell more, worry less." }, rights: { ar: "محفوظة", en: "Some rights reserved." } },
      },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));
    await renderFooter();
    expect(screen.getByText("Sell more, worry less.")).toBeTruthy();
    expect(screen.getByText(`© ${year} ZIMOS Co · Some rights reserved.`)).toBeTruthy();
    const links = within(screen.getByRole("list", { name: "ZIMOS accounts" })).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["https://www.linkedin.com/company/zimos"]);
    expect(screen.getByText(/Zimos LLC/)).toBeTruthy();
    expect(screen.getByText(/111-222-333/)).toBeTruthy();
  });

  it("never asks the API while the flag is off", async () => {
    vi.stubEnv("PLATFORM_SETTINGS_ENABLED", "false");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await renderFooter();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Commerce for a brighter tomorrow.")).toBeTruthy();
  });
});

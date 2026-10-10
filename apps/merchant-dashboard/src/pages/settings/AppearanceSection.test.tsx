import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { GlassToggle } from "@/components/GlassToggle";
import { AppearanceSection } from "./AppearanceSection";

const html = document.documentElement;

/** A device that asks for solid surfaces (or not), for every media query the page reads. */
function deviceWantsSolid(solid: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: solid && query.includes("prefers-reduced-transparency"),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
  html.removeAttribute("data-glass");
  html.classList.remove("dark");
});

describe("Language and look", () => {
  it("starts with glass on: nothing stored, no attribute on the page", () => {
    renderWithProviders(<AppearanceSection />);
    expect(screen.getByRole("switch", { name: "Glass surfaces" })).toHaveAttribute("aria-checked", "true");
    expect(html).not.toHaveAttribute("data-glass");
    expect(localStorage.getItem("zimos.glass")).toBeNull();
  });

  it("turns glass off on this device, and on again", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    const glass = screen.getByRole("switch", { name: "Glass surfaces" });

    await user.click(glass);
    expect(glass).toHaveAttribute("aria-checked", "false");
    expect(html).toHaveAttribute("data-glass", "off");
    expect(localStorage.getItem("zimos.glass")).toBe("off");

    await user.click(glass);
    expect(glass).toHaveAttribute("aria-checked", "true");
    expect(html).not.toHaveAttribute("data-glass");
    expect(localStorage.getItem("zimos.glass")).toBeNull();
  });

  it("opens with glass off when it was turned off before", () => {
    localStorage.setItem("zimos.glass", "off");
    renderWithProviders(<AppearanceSection />);
    expect(screen.getByRole("switch", { name: "Glass surfaces" })).toHaveAttribute("aria-checked", "false");
    expect(html).toHaveAttribute("data-glass", "off");
  });

  it("keeps glass off, and says why, when the device asks for solid surfaces", () => {
    deviceWantsSolid(true);
    renderWithProviders(<AppearanceSection />);
    const glass = screen.getByRole("switch", { name: "Glass surfaces" });
    expect(glass).toBeDisabled();
    expect(glass).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Your device asks for solid surfaces, so glass stays off here.")).toBeInTheDocument();
    expect(html).toHaveAttribute("data-glass", "off");
  });

  it("switches between light and dark, and remembers it", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(html).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(html).not.toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("switches the whole dashboard to Arabic, in formal Arabic", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    await user.click(screen.getByRole("radio", { name: "عربي" }));
    expect(localStorage.getItem("zimos.locale")).toBe("ar");
    expect(screen.getByRole("switch", { name: "الأسطح الزجاجية" })).toBeInTheDocument();
    expect(screen.getByText("هذه الخيارات الثلاثة محفوظة على هذا الجهاز.")).toBeInTheDocument();
  });
});

describe("the glass switch on its own", () => {
  it("follows the same choice as the settings row", async () => {
    const { user } = renderWithProviders(
      <>
        <GlassToggle />
        <AppearanceSection />
      </>
    );
    const [toggle, row] = screen.getAllByRole("switch", { name: "Glass surfaces" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(row).toHaveAttribute("aria-checked", "false");
    expect(html).toHaveAttribute("data-glass", "off");

    await user.click(row);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(html).not.toHaveAttribute("data-glass");
  });
});

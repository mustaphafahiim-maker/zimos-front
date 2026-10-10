import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { HolidayBanner } from "./HolidayBanner";
import { HolidayCheckoutGate } from "./HolidayCheckoutGate";

// The switch is a build constant; the tests turn it on and off.
const flags = vi.hoisted(() => ({ holiday: false }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  get HOLIDAY_MODE_ENABLED() {
    return flags.holiday;
  },
}));

const BASE = {
  workspaceId: "ws1",
  id: "ws1",
  slug: "shop",
  name: "Shop",
  currency: "EGP",
  logoUrl: null,
  phone: null,
  checkout: { email: "optional", postal_code: "hidden", notes: "optional" },
  orderBump: null,
};

function storeWith(holiday: unknown): StoreInfo {
  return { ...BASE, holiday } as unknown as StoreInfo;
}

const paused = { mode: "pause", until: null, shipsFrom: null, message: { en: "Back soon." } };
const delayed = { mode: "delay", until: null, shipsFrom: null, message: null };

function show(store: StoreInfo, ui: React.ReactNode) {
  return render(
    <StoreContextProvider locale="en" store={store}>
      {ui}
    </StoreContextProvider>
  );
}

const gate = (
  <HolidayCheckoutGate buttonClassName="btn">
    <a href="/checkout">Checkout</a>
  </HolidayCheckoutGate>
);

afterEach(cleanup);

describe("the holiday banner and the way to checkout", () => {
  it("shows nothing of a holiday while the feature is off, even when the API names one", () => {
    flags.holiday = false;
    show(storeWith(paused), <><HolidayBanner />{gate}</>);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("link", { name: "Checkout" })).toBeTruthy();
  });

  it("shows nothing while the store is open as usual", () => {
    flags.holiday = true;
    show(storeWith(null), <><HolidayBanner />{gate}</>);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("link", { name: "Checkout" })).toBeTruthy();
  });

  it("says the store is on holiday with its message, and turns the checkout link into a button that is off", () => {
    flags.holiday = true;
    show(storeWith(paused), <><HolidayBanner />{gate}</>);
    expect(screen.getAllByText("We're on holiday").length).toBeGreaterThan(0);
    expect(screen.getByText("Back soon.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Checkout" })).toBeNull();
    const button = screen.getByRole("button", { name: "Orders are paused for now" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("keeps the checkout link when orders are taken and ship later", () => {
    flags.holiday = true;
    show(storeWith(delayed), gate);
    expect(screen.getByRole("link", { name: "Checkout" })).toBeTruthy();
    expect(screen.getByText("Orders ship once the holiday is over")).toBeTruthy();
  });
});

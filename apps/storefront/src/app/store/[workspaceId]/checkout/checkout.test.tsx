import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { getDictionary, type Locale } from "@/lib/i18n";

// --- the page's surroundings, stubbed --------------------------------------
const placeCodOrder = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceId: "ws1" }),
  useRouter: () => ({ push }),
  usePathname: () => "/store/ws1/checkout",
}));

vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useStoreBasePath: () => "/store/ws1",
}));

vi.mock("@/lib/CartProvider", () => ({
  useCart: () => ({
    cart: {
      currency: "EGP",
      subtotal: 64900,
      guestToken: "cart-token",
      items: [
        {
          id: "line1",
          variantId: "v1",
          quantity: 1,
          lineTotal: 64900,
          variant: { optionValues: {} },
          customizations: [],
        },
      ],
    },
    clearCart: vi.fn(),
  }),
}));

// Every API call the hooks make fails quietly (they all fall back to defaults:
// cash on delivery, the store's own settings, no catalogue, no quote).
vi.mock("@/lib/apiClient", () => ({
  createStorefrontApiClient: () =>
    new Proxy({}, { get: () => () => Promise.reject(new Error("offline in tests")) }),
}));

vi.mock("@/lib/track", () => ({ track: vi.fn() }));

vi.mock("@/lib/placeOrder", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/placeOrder")>()),
  placeCodOrder: (...args: unknown[]) => placeCodOrder(...args),
}));

const { default: CheckoutPage } = await import("./page");

const STORE: StoreInfo = {
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

function renderPage(locale: Locale = "ar") {
  return render(
    <StoreContextProvider locale={locale} store={STORE}>
      <CheckoutPage />
    </StoreContextProvider>
  );
}

function fillValid(phone = "01012345678") {
  fireEvent.change(document.getElementById("checkout-fullName")!, { target: { value: "سلمى نبيل" } });
  fireEvent.change(document.getElementById("checkout-phone")!, { target: { value: phone } });
  fireEvent.change(document.getElementById("checkout-governorate")!, { target: { value: "cairo" } });
  fireEvent.change(document.getElementById("checkout-city")!, { target: { value: "مدينة نصر" } });
  fireEvent.change(document.getElementById("checkout-address")!, { target: { value: "١٢ شارع عباس العقاد" } });
}

const confirmButtons = () => screen.getAllByRole("button", { hidden: true }).filter((b) => b.getAttribute("type") === "submit");

beforeEach(() => {
  placeCodOrder.mockReset();
  push.mockReset();
  localStorage.clear();
});
afterEach(cleanup);

describe("checkout on a phone", () => {
  it("shows each error under its own field, in a live region, and focuses the first", async () => {
    renderPage("ar");
    const t = getDictionary("ar");

    fireEvent.click(confirmButtons()[0]);

    const name = document.getElementById("checkout-fullName")!;
    expect(name.getAttribute("aria-invalid")).toBe("true");
    const error = document.getElementById("checkout-fullName-error")!;
    expect(error.textContent).toBe(t.form.errors.fullName);
    expect(name.getAttribute("aria-describedby")).toBe("checkout-fullName-error");
    // The message sits in a polite live region that was there before it appeared.
    expect(error.parentElement?.getAttribute("aria-live")).toBe("polite");
    expect(document.getElementById("checkout-phone-error")?.textContent).toBe(t.form.errors.phone);
    expect(document.activeElement).toBe(name);
    expect(placeCodOrder).not.toHaveBeenCalled();
    // The summary for screen readers is announced at once.
    expect(screen.getByRole("alert").textContent).toContain(t.form.errors.summary(5));
  });

  it("keeps the phone field Latin and left-to-right in an Arabic store, with the right keyboard and autofill", () => {
    renderPage("ar");
    const phone = document.getElementById("checkout-phone") as HTMLInputElement;
    expect(phone.type).toBe("tel");
    expect(phone.getAttribute("inputmode")).toBe("tel");
    expect(phone.getAttribute("autocomplete")).toBe("tel");
    expect(phone.getAttribute("dir")).toBe("ltr");
    expect(phone.maxLength).toBe(20);
    expect(screen.getByLabelText(/رقم الموبايل/)).toBe(phone);
    expect(document.getElementById("checkout-fullName")?.getAttribute("autocomplete")).toBe("name");
    expect(document.getElementById("checkout-address")?.getAttribute("autocomplete")).toBe("address-line1");
    expect(document.getElementById("checkout-governorate")?.getAttribute("autocomplete")).toBe("address-level1");
  });

  it.each([
    ["01012345678", "01012345678"],
    ["+201012345678", "01012345678"],
    ["+20 101 234 5678", "01012345678"],
    ["٠١٠١٢٣٤٥٦٧٨", "01012345678"],
  ])("takes the phone typed as %s and sends it as %s", async (typed, sent) => {
    placeCodOrder.mockReturnValue(new Promise(() => {}));
    renderPage("ar");
    fillValid(typed);
    fireEvent.click(confirmButtons()[0]);
    await waitFor(() => expect(placeCodOrder).toHaveBeenCalledTimes(1));
    expect(document.getElementById("checkout-phone-error")).toBeNull();
    const [{ payload }] = placeCodOrder.mock.calls[0] as [{ payload: { contact: { phone: string } } }];
    expect(payload.contact.phone).toBe(sent);
  });

  it("refuses a phone that isn't an Egyptian mobile", () => {
    renderPage("en");
    fillValid("0101234567");
    fireEvent.click(confirmButtons()[0]);
    expect(document.getElementById("checkout-phone-error")?.textContent).toBe(getDictionary("en").form.errors.phone);
    expect(placeCodOrder).not.toHaveBeenCalled();
  });

  it("disables both confirm buttons while the order is placed, so a second tap places nothing", async () => {
    placeCodOrder.mockReturnValue(new Promise(() => {}));
    renderPage("en");
    const t = getDictionary("en");
    fillValid();
    const [main, sticky] = confirmButtons();
    expect(sticky).toBeDefined();

    fireEvent.click(main);
    await waitFor(() => expect(main).toHaveProperty("disabled", true));
    expect(sticky).toHaveProperty("disabled", true);
    expect(main.textContent).toBe(t.checkout.placing);
    expect(sticky.textContent).toBe(t.checkout.placing);
    expect(document.querySelector("form")?.getAttribute("aria-busy")).toBe("true");

    fireEvent.click(main);
    fireEvent.click(sticky);
    fireEvent.submit(document.querySelector("form")!);
    expect(placeCodOrder).toHaveBeenCalledTimes(1);
  });

  it("applies a discount code on Enter instead of placing the order", () => {
    renderPage("en");
    fillValid();
    const code = document.getElementById("discount-code")!;
    fireEvent.change(code, { target: { value: "save10" } });
    fireEvent.keyDown(code, { key: "Enter" });
    expect(placeCodOrder).not.toHaveBeenCalled();
    expect(screen.getByText(getDictionary("en").checkout.discountPending("SAVE10"))).toBeTruthy();
  });

  it("repeats the total and the confirm button in a bar for phones, out of reach while hidden", () => {
    renderPage("ar");
    const t = getDictionary("ar");
    const sticky = confirmButtons()[1];
    const bar = sticky.closest("[aria-hidden]") as HTMLElement;
    // jsdom has no IntersectionObserver: the real button counts as still ahead.
    expect(bar.getAttribute("aria-hidden")).toBe("false");
    expect(bar.className).toContain("lg:hidden");
    expect(bar.className).toContain("env(safe-area-inset-bottom)");
    expect(within(bar).getByText(t.checkout.totalEstimate)).toBeTruthy();
    expect(sticky.textContent).toBe(t.checkout.place);
  });
});

import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ShopperAddress, ShopperAddressInput } from "@store-builder/api-client";
import { getDictionary } from "@/lib/i18n";
import { EMPTY_ORDER_FORM, type OrderFormField, type OrderFormValues } from "@/lib/orderForm";
import { addressInput, addressSummary, governorateCodeOf } from "@/lib/shopperAddress";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";

vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  SHOPPER_ACCOUNTS_ENABLED: true,
}));
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ createStorefrontApiClient: () => ({ request }) }));

import { AddressForm } from "./AddressForm";
import { CheckoutSavedAddresses } from "./CheckoutSavedAddresses";

const t = getDictionary("en");
const a = t.account;
const TOKEN = "ws.c1.1.1999999999.c2lnbmF0dXJl";

let n = 0;
function aStore() {
  n += 1;
  const id = `addr${n}`;
  const store = {
    workspaceId: id,
    id,
    slug: "shop",
    name: "Shop",
    currency: "EGP",
    logoUrl: null,
    phone: null,
    country: "EG",
    checkout: { email: "optional", postal_code: "hidden", notes: "optional" },
    orderBump: null,
  } as unknown as StoreInfo;
  return { id, store };
}

const HOME: ShopperAddress = {
  id: "a1",
  label: "Home",
  fullName: "Mona Ali",
  phone: "01012345003",
  country: "EG",
  province: "الجيزة (Giza)",
  city: "Dokki",
  area: null,
  addressLine: "12 Tahrir St",
  postalCode: null,
  isDefault: true,
};
const WORK: ShopperAddress = { ...HOME, id: "a2", label: "Work", province: "القاهرة (Cairo)", city: "Maadi", addressLine: "9 Road 9", isDefault: false };

beforeEach(() => {
  request.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(cleanup);

describe("a saved address", () => {
  it("carries the governorate the way an order does, and reads back to the form's code", () => {
    const input = addressInput({ country: "eg", governorate: "giza", city: " Dokki ", addressLine: " 12 Tahrir St ", label: "", phone: "" });
    expect(input).toMatchObject({ country: "EG", province: "الجيزة (Giza)", city: "Dokki", addressLine: "12 Tahrir St", label: null, phone: null });
    expect(input).not.toHaveProperty("deliveryZoneId");
    expect(governorateCodeOf("الجيزة (Giza)", "EG")).toBe("giza");
    expect(governorateCodeOf("Giza", "EG")).toBe("giza");
    expect(governorateCodeOf("Nowhere", "EG")).toBe("");
    // Outside Egypt the region is what the shopper typed.
    expect(governorateCodeOf("Riyadh", "SA")).toBe("Riyadh");
    expect(addressInput({ country: "SA", governorate: "Riyadh", city: "Riyadh", addressLine: "King Fahd Rd" }).province).toBe("Riyadh");
  });

  it("reads as one line in the shopper's language", () => {
    expect(addressSummary(HOME, "en")).toBe("12 Tahrir St, Dokki, Giza");
    expect(addressSummary(HOME, "ar")).toBe("12 Tahrir St، Dokki، الجيزة");
  });
});

describe("the address form", () => {
  function show(onSave: (input: ShopperAddressInput) => Promise<string | null>, address?: ShopperAddress) {
    const { store } = aStore();
    render(
      <StoreContextProvider locale="en" store={store}>
        <AddressForm address={address} canBeDefault onSave={onSave} onCancel={() => {}} />
      </StoreContextProvider>
    );
  }

  it("asks for a governorate, a city and a street before it saves", async () => {
    const onSave = vi.fn(async () => null);
    show(onSave);
    fireEvent.click(screen.getByRole("button", { name: a.saveAddress }));
    expect(await screen.findByText(t.form.errors.governorate)).toBeTruthy();
    expect(screen.getByText(t.form.errors.city)).toBeTruthy();
    expect(screen.getByText(t.form.errors.address)).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves what was filled, the governorate by its name", async () => {
    const onSave = vi.fn(async () => null);
    show(onSave);
    fireEvent.change(screen.getByLabelText(new RegExp(`^${a.label}`)), { target: { value: "Home" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "giza" } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${t.form.city}`)), { target: { value: "Dokki" } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${t.form.address}`)), { target: { value: "12 Tahrir St" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: a.saveAddress }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      country: "EG",
      province: "الجيزة (Giza)",
      city: "Dokki",
      area: null,
      addressLine: "12 Tahrir St",
      postalCode: null,
      label: "Home",
      fullName: null,
      phone: null,
      isDefault: true,
    });
  });

  it("opens an address being edited on its own governorate, and shows the API's refusal", async () => {
    show(async () => "You can keep up to 10 addresses.", HOME);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("giza");
    fireEvent.click(screen.getByRole("button", { name: a.saveAddress }));
    expect(await screen.findByText("You can keep up to 10 addresses.")).toBeTruthy();
  });
});

describe("the checkout of a store with shopper accounts", () => {
  function Checkout({ start }: { start?: Partial<OrderFormValues> }) {
    const [values, setValues] = useState<OrderFormValues>({ ...EMPTY_ORDER_FORM, country: "EG", ...start });
    const onChange = (field: OrderFormField, value: string) => setValues((prev) => ({ ...prev, [field]: value }));
    return (
      <>
        <CheckoutSavedAddresses values={values} onChange={onChange} />
        <output data-testid="form">{JSON.stringify(values)}</output>
      </>
    );
  }
  const form = () => JSON.parse(screen.getByTestId("form").textContent ?? "{}") as OrderFormValues;
  function show(store: StoreInfo, start?: Partial<OrderFormValues>) {
    render(
      <StoreContextProvider locale="en" store={store}>
        <Checkout start={start} />
      </StoreContextProvider>
    );
  }
  const answers = (enabled: boolean, addresses: ShopperAddress[] = [HOME, WORK]) =>
    request.mockImplementation(async (path: string, options: { method?: string } = {}) => {
      if (path.endsWith("/account/config")) return { enabled, channels: ["sms"] };
      if (path.endsWith("/account/addresses") && options.method === "POST") return { addresses: [...addresses, { ...WORK, id: "a3", label: null }] };
      return { customer: { id: "c1", fullName: "Mona Ali", phone: "+201012345003", email: "mona@mail.com", emailVerified: true, marketingConsent: false, ordersCount: 3 }, addresses };
    });

  it("shows nothing on a store without accounts", async () => {
    const { store, id } = aStore();
    answers(false);
    show(store);
    await waitFor(() => expect(request).toHaveBeenCalledWith(`/store/${id}/account/config`, { auth: false }));
    expect(screen.queryByText(a.haveAccount)).toBeNull();
    expect(screen.queryByText(a.savedAddresses)).toBeNull();
  });

  it("offers a signed-out shopper the sign-in, which comes back to the checkout", async () => {
    const { store } = aStore();
    answers(true);
    show(store);
    expect(await screen.findByText(a.haveAccount)).toBeTruthy();
    expect(screen.getByRole("link", { name: a.signInToFill }).getAttribute("href")).toBe("/account?next=/checkout");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("fills a signed-in shopper's contact and default address, and another address when picked", async () => {
    const { store, id } = aStore();
    window.localStorage.setItem(`zimos:shopper:${id}`, JSON.stringify({ token: TOKEN, expiresAt: Date.now() + 60_000 }));
    answers(true);
    show(store);

    expect(await screen.findByText(a.savedAddresses)).toBeTruthy();
    expect(request).toHaveBeenCalledWith(`/store/${id}/account/me`, { auth: false, headers: { "X-Shopper-Token": TOKEN } });
    expect(form()).toMatchObject({ fullName: "Mona Ali", phone: "01012345003", email: "mona@mail.com", governorate: "giza", city: "Dokki", address: "12 Tahrir St" });
    // The store's delivery area is still the shopper's to pick.
    expect(form().deliveryZoneId).toBe("");

    fireEvent.click(screen.getByRole("radio", { name: /Work/ }));
    expect(form()).toMatchObject({ governorate: "cairo", city: "Maadi", address: "9 Road 9" });

    fireEvent.click(screen.getByRole("radio", { name: a.otherAddress }));
    expect(form()).toMatchObject({ governorate: "", city: "", address: "" });
  });

  it("leaves a form that already holds an address as it is", async () => {
    const { store, id } = aStore();
    window.localStorage.setItem(`zimos:shopper:${id}`, JSON.stringify({ token: TOKEN, expiresAt: Date.now() + 60_000 }));
    answers(true);
    show(store, { fullName: "Someone Else", governorate: "alexandria", city: "Smouha", address: "3 Victor Emmanuel" });
    expect(await screen.findByText(a.savedAddresses)).toBeTruthy();
    expect(form()).toMatchObject({ fullName: "Someone Else", governorate: "alexandria", city: "Smouha", address: "3 Victor Emmanuel" });
  });

  it("keeps a typed address in the account when asked", async () => {
    const { store, id } = aStore();
    window.localStorage.setItem(`zimos:shopper:${id}`, JSON.stringify({ token: TOKEN, expiresAt: Date.now() + 60_000 }));
    answers(true);
    show(store, { governorate: "alexandria", city: "Smouha", address: "3 Victor Emmanuel", fullName: "Mona Ali", phone: "01012345003" });
    fireEvent.click(await screen.findByRole("button", { name: a.saveThisAddress }));
    expect(await screen.findByText(a.addressSaved)).toBeTruthy();
    expect(request).toHaveBeenCalledWith(`/store/${id}/account/addresses`, {
      auth: false,
      headers: { "X-Shopper-Token": TOKEN },
      method: "POST",
      body: {
        country: "EG",
        province: "الإسكندرية (Alexandria)",
        city: "Smouha",
        area: null,
        addressLine: "3 Victor Emmanuel",
        postalCode: null,
        label: null,
        fullName: "Mona Ali",
        phone: "01012345003",
      },
    });
  });
});

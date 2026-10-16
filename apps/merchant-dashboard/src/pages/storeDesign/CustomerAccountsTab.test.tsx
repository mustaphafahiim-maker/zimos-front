import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ApiError, type MostWishedProduct, type ShopperAccountsSettings } from "@store-builder/api-client";
import { invalidateCached } from "@/lib/useCachedAsync";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MostWishedCard } from "../catalog/components/MostWishedCard";
import { CustomerAccountsTab } from "./CustomerAccountsTab";

const off: ShopperAccountsSettings = { enabled: false, channels: ["sms"] };

describe("CustomerAccountsTab", () => {
  it("shows accounts off, signing in by phone, as the store has them", async () => {
    const calls = fakeBackend({ "GET /shopper-accounts": off });
    renderWithProviders(<CustomerAccountsTab />);
    expect(await screen.findByRole("switch", { name: /Let customers sign in to see their orders/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: /Phone \(SMS code\)/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /Email code/ })).toHaveAttribute("aria-checked", "false");
    expect(callsTo(calls, "GET", "/workspaces/ws_1/shopper-accounts")).toHaveLength(1);
    expect(callsTo(calls, "PUT", "/shopper-accounts")).toHaveLength(0);
  });

  it("turns accounts on with the email code as well, and saves both", async () => {
    const calls = fakeBackend({ "GET /shopper-accounts": off, "PUT /shopper-accounts": { enabled: true, channels: ["sms", "email"] } });
    const { user } = renderWithProviders(<CustomerAccountsTab />);
    await user.click(await screen.findByRole("switch", { name: /Let customers sign in to see their orders/ }));
    await user.click(screen.getByRole("switch", { name: /Email code/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo(calls, "PUT", "/workspaces/ws_1/shopper-accounts")).toHaveLength(1));
    expect(callsTo(calls, "PUT", "/shopper-accounts")[0].body).toEqual({ enabled: true, channels: ["sms", "email"] });
    expect(await screen.findByText("Customer accounts saved.")).toBeInTheDocument();
  });

  it("keeps the last way to sign in switched on", async () => {
    fakeBackend({ "GET /shopper-accounts": off });
    const { user } = renderWithProviders(<CustomerAccountsTab />);
    const phone = await screen.findByRole("switch", { name: /Phone \(SMS code\)/ });
    await user.click(phone);
    expect(phone).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Keep at least one way to sign in.")).toBeInTheDocument();
  });

  it("shows the API's refusal and keeps the change on screen", async () => {
    fakeBackend({ "GET /shopper-accounts": off, "PUT /shopper-accounts": new ApiError("Forbidden", 403, "FORBIDDEN", {}) });
    const { user } = renderWithProviders(<CustomerAccountsTab />);
    const enabled = await screen.findByRole("switch", { name: /Let customers sign in to see their orders/ });
    await user.click(enabled);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(enabled).toHaveAttribute("aria-checked", "true");
  });

  it("reads in formal Arabic, and offers no other way to sign in", async () => {
    fakeBackend({ "GET /shopper-accounts": off });
    renderWithProviders(<CustomerAccountsTab />, { locale: "ar" });
    expect(await screen.findByRole("switch", { name: /السماح للعملاء بتسجيل الدخول لرؤية طلباتهم/ })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /رمز على البريد الإلكتروني/ })).toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(3);
  });
});

describe("MostWishedCard", () => {
  const mug: MostWishedProduct = { productId: "prod_1", name: "Blue mug", slug: "blue-mug", status: "active", shoppers: 3, lastAddedAt: "2026-10-01T10:00:00.000Z" };
  const lamp: MostWishedProduct = { ...mug, productId: "prod_2", name: "Desk lamp", slug: "desk-lamp", status: "archived", shoppers: 1 };

  // The answer is kept for the session: each test starts without one.
  beforeEach(() => invalidateCached("catalog:wished:"));

  it("is one chip that opens the products shoppers saved most", async () => {
    const calls = fakeBackend({ "GET /wishlists/top": { products: [mug, lamp] } });
    const { user } = renderWithProviders(<MostWishedCard />);
    await user.click(await screen.findByRole("button", { name: /Most wished/ }));

    expect(await screen.findByText("“Blue mug” is on the wishlist of 3 shoppers")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Blue mug" })).toHaveAttribute("href", "/catalog/prod_1");
    expect(screen.getByText("Desk lamp")).toBeInTheDocument();
    expect(screen.getByText("1 shopper")).toBeInTheDocument();
    expect(callsTo(calls, "GET", "/workspaces/ws_1/wishlists/top")).toHaveLength(1);
  });

  it("shows nothing while no shopper has saved a product", async () => {
    const calls = fakeBackend({ "GET /wishlists/top": { products: [] } });
    const { container } = renderWithProviders(<MostWishedCard />);
    await waitFor(() => expect(callsTo(calls, "GET", "/wishlists/top")).toHaveLength(1));
    await waitFor(() => expect(container.querySelector("button")).toBeNull());
  });

  it("shows nothing to a role that may not read it", async () => {
    const calls = fakeBackend({ "GET /wishlists/top": new ApiError("Forbidden", 403, "FORBIDDEN", {}) });
    const { container } = renderWithProviders(<MostWishedCard />);
    await waitFor(() => expect(callsTo(calls, "GET", "/wishlists/top")).toHaveLength(1));
    expect(container.querySelector("button")).toBeNull();
  });

  it("names the chip in formal Arabic", async () => {
    fakeBackend({ "GET /wishlists/top": { products: [mug] } });
    renderWithProviders(<MostWishedCard />, { locale: "ar" });
    expect(await screen.findByRole("button", { name: /الأكثر في المفضلة/ })).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Order, ReturnRequest, TrackingProviderSettings } from "@store-builder/api-client";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ManualTrackingCard } from "../shipping/ManualTrackingCard";
import { ReturnsPage } from "./ReturnsPage";

// The page reads its switches as it loads: this file runs with shopper returns and tracking on.
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  SHOPPER_RETURNS_ENABLED: true,
  TRACKING_PROVIDERS_ENABLED: true,
}));

const order = fake<Order>({
  id: "ord_1",
  orderNumber: "#1024",
  currency: "EGP",
  contactSnapshot: { fullName: "Mona Ali" },
  items: [{ id: "item_1", productId: "prod_1", productNameSnapshot: "Linen shirt", variantOptionsSnapshot: { Size: "M" }, quantity: 1 }],
});
const fromShopper = fake<ReturnRequest>({
  id: "ret_1",
  orderId: "ord_1",
  status: "requested",
  reason: "damaged: The sleeve is torn",
  items: [{ orderItemId: "item_1", quantity: 1 }],
  restockedAt: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  source: "shopper",
  photos: [{ uploadId: "up_1", url: "https://files.example/p1.jpg", expiresAt: "2026-10-01T10:05:00.000Z" }],
});
const exchange = fake<ReturnRequest>({
  ...fromShopper,
  id: "ret_2",
  reason: "not_as_described",
  photos: [],
  resolution: "exchange",
  items: [{ orderItemId: "item_1", quantity: 1, exchangeVariantId: "var_L" }],
});
const settingsOff = { enabled: false, windowDays: 14, photoRequiredFor: [], exchanges: false };

function page(returns: ReturnRequest[], routes: Parameters<typeof fakeBackend>[0] = {}) {
  api.listReturns.mockResolvedValue(returns);
  api.getOrder.mockResolvedValue(order);
  api.getProduct.mockResolvedValue({ id: "prod_1", variants: [{ id: "var_L", optionValues: { Size: "L" } }] });
  const calls = fakeBackend({ "GET /shopper-returns": settingsOff, ...routes });
  return { calls, ...renderWithProviders(<ReturnsPage />) };
}

beforeEach(() => {
  api.moderateReturn.mockReset();
});

describe("Returns with shopper returns switched on", () => {
  it("lets customers ask for a return, from the header's setting", async () => {
    const { calls, user } = page([], { "PUT /shopper-returns": { ...settingsOff, enabled: true } });
    await user.click(await screen.findByRole("button", { name: "Returns from customers: off" }));
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("switch", { name: /Let customers ask for a return/ }));
    await user.click(within(sheet).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo(calls, "PUT", "/workspaces/ws_1/shopper-returns")).toHaveLength(1));
    expect(callsTo(calls, "PUT", "/shopper-returns")[0].body).toMatchObject({ enabled: true, windowDays: 14, photoRequiredFor: [] });
    expect(await screen.findByRole("button", { name: "Returns from customers: on" })).toBeInTheDocument();
  });

  it("marks a return the customer asked for, with the photos they attached", async () => {
    page([fromShopper]);
    expect(await screen.findByText("From customer")).toBeInTheDocument();
    expect(screen.getByText("The sleeve is torn")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Open photo 1 of 1" })).toBeInTheDocument();
  });

  it("approves through a sheet, with a message the customer reads", async () => {
    const { calls, user } = page([fromShopper], { "PATCH /returns/ret_1": { return: { ...fromShopper, status: "approved" } } });
    await user.click(await screen.findByRole("button", { name: "Approve" }));
    const sheet = await screen.findByRole("dialog", { name: "Approve this return?" });
    await user.type(within(sheet).getByLabelText("Message to the customer (optional)"), "Send it back with the courier");
    await user.click(within(sheet).getByRole("button", { name: "Approve the return" }));

    await waitFor(() => expect(callsTo(calls, "PATCH", "/workspaces/ws_1/returns/ret_1")).toHaveLength(1));
    expect(callsTo(calls, "PATCH", "/returns/ret_1")[0].body).toMatchObject({ action: "approve", note: "Send it back with the courier" });
    expect(await screen.findByText(/^Return approved\./)).toBeInTheDocument();
    // The plain approve of the page is not used beside the sheet.
    expect(api.moderateReturn).not.toHaveBeenCalled();
  });

  it("names an exchange, the size asked for, and charges the replacement's shipping in minor units", async () => {
    const { calls, user } = page([exchange], { "PATCH /returns/ret_2": { return: { ...exchange, status: "approved", exchangeOrderId: "ord_9" } } });
    expect(await screen.findByText("Exchange")).toBeInTheDocument();
    // «M → L»: what the customer has, and what they asked for instead.
    expect(await screen.findByText("L")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    const sheet = await screen.findByRole("dialog", { name: "Approve this exchange?" });
    await user.type(within(sheet).getByLabelText(/Shipping for the replacement/), "35");
    await user.click(within(sheet).getByRole("button", { name: "Approve the exchange" }));
    await waitFor(() => expect(callsTo(calls, "PATCH", "/returns/ret_2")).toHaveLength(1));
    expect(callsTo(calls, "PATCH", "/returns/ret_2")[0].body).toMatchObject({ action: "approve", exchangeShippingAmount: 3500 });
  });

  it("reads in formal Arabic", async () => {
    api.listReturns.mockResolvedValue([fromShopper]);
    api.getOrder.mockResolvedValue(order);
    fakeBackend({ "GET /shopper-returns": settingsOff });
    renderWithProviders(<ReturnsPage />, { locale: "ar" });
    expect(await screen.findByRole("button", { name: "المرتجعات من العملاء: متوقفة" })).toBeInTheDocument();
    expect(await screen.findByText("من العميل")).toBeInTheDocument();
  });
});

describe("ManualTrackingCard", () => {
  const settings: TrackingProviderSettings = {
    trackingProvider: { enabled: false, provider: null },
    providers: [
      { code: "trackingmore", name: "TrackingMore", sandbox: false, available: true },
      { code: "mock", name: "Mock (test)", sandbox: true, available: false },
    ],
    polling: { intervalMinutes: 60, maxAgeDays: 30 },
  };

  it("asks for a provider before it switches tracking on", async () => {
    const calls = fakeBackend({ "GET /shipping/tracking-provider": settings });
    const { user } = renderWithProviders(<ManualTrackingCard />);
    await user.click(await screen.findByRole("switch", { name: /Update manual shipments automatically/ }));
    expect(await screen.findByText("Choose a tracking provider first.")).toBeInTheDocument();
    expect(callsTo(calls, "PUT", "/tracking-provider")).toHaveLength(0);
  });

  it("switches tracking on with the provider chosen", async () => {
    const calls = fakeBackend({
      "GET /shipping/tracking-provider": settings,
      "PUT /shipping/tracking-provider": { ...settings, trackingProvider: { enabled: true, provider: "trackingmore" } },
    });
    const { user } = renderWithProviders(<ManualTrackingCard />);
    await user.selectOptions(await screen.findByRole("combobox"), "trackingmore");
    await user.click(screen.getByRole("switch", { name: /Update manual shipments automatically/ }));
    await waitFor(() => expect(callsTo(calls, "PUT", "/workspaces/ws_1/shipping/tracking-provider")).toHaveLength(1));
    expect(callsTo(calls, "PUT", "/tracking-provider")[0].body).toEqual({ enabled: true, provider: "trackingmore" });
    // A provider the server cannot use is offered greyed out, never chosen.
    expect(screen.getByRole("option", { name: /Mock \(Test\)/ })).toBeDisabled();
  });

  it("reads in formal Arabic", async () => {
    fakeBackend({ "GET /shipping/tracking-provider": settings });
    renderWithProviders(<ManualTrackingCard />, { locale: "ar" });
    expect(await screen.findByRole("switch", { name: /تحديث حالة الشحنات اليدوية تلقائيًا/ })).toBeInTheDocument();
  });
});

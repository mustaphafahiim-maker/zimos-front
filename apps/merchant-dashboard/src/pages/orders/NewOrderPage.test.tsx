import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import type { Order, Product } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { NewOrderPage } from "./NewOrderPage";

const tee = fake<Product>({
  id: "prod_1",
  name: "Classic Tee",
  status: "active",
  variants: [
    {
      id: "var_1",
      status: "active",
      sku: "TEE-M",
      optionValues: { Size: "M" },
      priceAmount: "25000",
      currency: "EGP",
      stockOnHand: 10,
      reservedStock: 0,
      allowOverselling: false,
    },
  ],
  offers: [],
});

function renderPage() {
  api.listProducts.mockResolvedValue({ products: [tee], nextCursor: null } as Awaited<ReturnType<typeof api.listProducts>>);
  api.listShippingZones.mockResolvedValue([]);
  api.listCustomers.mockResolvedValue({ customers: [], nextCursor: null } as Awaited<ReturnType<typeof api.listCustomers>>);
  return renderWithProviders(
    <Routes>
      <Route path="/orders/new" element={<NewOrderPage />} />
      <Route path="/orders/:orderId" element={<p>Order detail</p>} />
    </Routes>,
    { route: "/orders/new" }
  );
}

const summaryTotal = () => screen.getByText("Estimated total").parentElement as HTMLElement;

describe("NewOrderPage", () => {
  it("rejects an invalid Egyptian phone without calling the API", async () => {
    const { user } = renderPage();
    await user.type(screen.getByLabelText(/^Phone/), "12345");
    await user.click(screen.getByRole("button", { name: "Create order" }));

    expect(await screen.findByText("Enter a valid Egyptian mobile (010, 011, 012 or 015 + 8 digits).")).toBeInTheDocument();
    expect(screen.getByText("Please fix the highlighted fields.")).toBeInTheDocument();
    expect(api.request).not.toHaveBeenCalled();
  });

  it("updates the total as a product line is added and its quantity changes", async () => {
    const { user } = renderPage();
    const addItem = screen.getByRole("button", { name: "Add item" });
    await waitFor(() => expect(addItem).toBeEnabled());
    expect(summaryTotal()).toHaveTextContent(/EGP\s?0\.00/);

    await user.click(addItem);
    await user.selectOptions(screen.getByLabelText("Product"), "prod_1");
    await user.selectOptions(screen.getByLabelText("Variant or offer"), "variant:var_1");
    expect(summaryTotal()).toHaveTextContent(/EGP\s?250\.00/);

    const qty = screen.getByLabelText("Qty");
    await user.clear(qty);
    await user.type(qty, "2");
    expect(summaryTotal()).toHaveTextContent(/EGP\s?500\.00/);
    expect(screen.getByText("10 available")).toBeInTheDocument();
  });

  it("submits the order with an Idempotency-Key and opens the created order", async () => {
    const { user } = renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add item" })).toBeEnabled());

    await user.type(screen.getByLabelText(/^Phone/), "010 1234 5678");
    await user.type(screen.getByLabelText(/^Full name/), "Sara Ali");
    await user.selectOptions(screen.getByLabelText(/^Governorate/), "cairo");
    await user.type(screen.getByLabelText(/^City \/ area/), "Nasr City");
    await user.type(screen.getByLabelText(/^Street, building/), "12 Makram Ebeid");
    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.selectOptions(screen.getByLabelText("Product"), "prod_1");
    await user.selectOptions(screen.getByLabelText("Variant or offer"), "variant:var_1");
    const qty = screen.getByLabelText("Qty");
    await user.clear(qty);
    await user.type(qty, "2");

    api.request.mockResolvedValueOnce({ order: fake<Order>({ id: "ord_99", orderNumber: "#1099" }) });
    await user.click(screen.getByRole("button", { name: "Create order" }));

    await waitFor(() => expect(currentPath()).toBe("/orders/ord_99"));
    expect(api.request).toHaveBeenCalledTimes(1);
    const [url, init] = api.request.mock.calls[0];
    expect(url).toBe("/workspaces/ws_1/orders");
    expect(init).toEqual({
      method: "POST",
      headers: { "Idempotency-Key": expect.stringMatching(/\S{8,}/) },
      body: {
        items: [{ variantId: "var_1", quantity: 2 }],
        contact: { fullName: "Sara Ali", phone: "01012345678" },
        shippingAddress: { country: "EG", province: "القاهرة (Cairo)", city: "Nasr City", addressLine: "12 Makram Ebeid" },
        paymentMethod: "cod",
      },
    });
    expect(await screen.findByText("Order detail")).toBeInTheDocument();
  });
});

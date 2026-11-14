import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { Order } from "@store-builder/api-client";
import { fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { OrderFulfilmentPlan } from "./OrderFulfilmentPlan";
import page from "../OrderDetailPage.tsx?raw";

const order = (holiday?: unknown) => fake<Order>({ id: "ord_1", orderNumber: "A-1", shippingSnapshot: holiday === undefined ? {} : { holiday } });

describe("the order's holiday note", () => {
  it("says when the customer was told the order ships", () => {
    renderWithProviders(<OrderFulfilmentPlan order={order({ shipsFrom: "2026-10-20T00:00:00.000Z", message: null })} />);
    expect(screen.getByText(/^Placed during the holiday\. The customer was told it ships from /)).toBeInTheDocument();
  });

  it("says only that it was placed during the holiday when no date was given", () => {
    renderWithProviders(<OrderFulfilmentPlan order={order({ shipsFrom: null, message: null })} />);
    expect(screen.getByText("Placed during the holiday.")).toBeInTheDocument();
  });

  it("shows nothing for an order placed on an ordinary day", () => {
    const { container } = renderWithProviders(<OrderFulfilmentPlan order={order()} />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("is in formal Arabic", () => {
    renderWithProviders(<OrderFulfilmentPlan order={order({ shipsFrom: null, message: null })} />, { locale: "ar" });
    expect(screen.getByText("تم الطلب أثناء الإجازة.")).toBeInTheDocument();
  });

  it("is on the order page only while holiday mode is switched on", () => {
    expect(page).toContain("{HOLIDAY_MODE_ENABLED && data && <OrderFulfilmentPlan order={data} />}");
    expect(page.match(/<OrderFulfilmentPlan/g)).toHaveLength(1);
  });
});

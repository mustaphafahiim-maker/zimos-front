import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { SizeChart } from "@store-builder/api-client";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SizeChartsPage } from "./SizeChartsPage";
import { SizeChartEditorPage } from "./SizeChartEditorPage";
import { ProductSizeChartNote } from "./ProductSizeChartNote";

const tees: SizeChart = {
  id: "chart_1",
  name: "T-shirts",
  unit: "cm",
  columns: [{ ar: "المقاس", en: "Size" }, { ar: "الصدر", en: "Chest" }],
  rows: [
    ["S", "48"],
    ["M", "52"],
  ],
  note: null,
  imageUrl: null,
  productIds: ["prod_1"],
  collectionIds: [],
  updatedAt: "2026-10-01T10:00:00.000Z",
};

describe("SizeChartsPage", () => {
  it("lists the store's size charts", async () => {
    const calls = fakeBackend({ "GET /size-charts": { sizeCharts: [tees] } });
    renderWithProviders(<SizeChartsPage />);
    expect(await screen.findByRole("heading", { name: "Size charts" })).toBeInTheDocument();
    expect((await screen.findAllByText("T-shirts")).length).toBeGreaterThan(0);
    expect(callsTo(calls, "GET", "/workspaces/ws_1/size-charts")).toHaveLength(1);
  });

  it("says what a size chart is for when there are none", async () => {
    fakeBackend({ "GET /size-charts": { sizeCharts: [] } });
    renderWithProviders(<SizeChartsPage />);
    expect(await screen.findByText("No size charts yet")).toBeInTheDocument();
    expect(screen.getAllByText("New size chart")[0].closest("a")).toHaveAttribute("href", "/size-charts/new");
  });

  it("reads in formal Arabic", async () => {
    fakeBackend({ "GET /size-charts": { sizeCharts: [] } });
    renderWithProviders(<SizeChartsPage />, { locale: "ar" });
    expect(await screen.findByRole("heading", { name: "جداول المقاسات" })).toBeInTheDocument();
    expect(await screen.findByText("لا توجد جداول مقاسات بعد")).toBeInTheDocument();
  });
});

describe("SizeChartEditorPage", () => {
  it("asks for a name before it creates a chart", async () => {
    const calls = fakeBackend({});
    const { user } = renderWithProviders(<SizeChartEditorPage />, { route: "/size-charts/new", path: "/size-charts/new" });
    await user.click(await screen.findByRole("button", { name: "Create chart" }));
    expect(await screen.findByText("Give the chart a name.")).toBeInTheDocument();
    expect(callsTo(calls, "POST", "/size-charts")).toHaveLength(0);
  });

  it("creates a chart from the starter table", async () => {
    const calls = fakeBackend({ "POST /size-charts": { ...tees, id: "chart_new", name: "Trousers" } });
    const { user } = renderWithProviders(<SizeChartEditorPage />, { route: "/size-charts/new", path: "/size-charts/new" });
    await user.type(await screen.findByLabelText(/Chart name/), "Trousers");
    await user.click(screen.getByRole("button", { name: "Create chart" }));

    await waitFor(() => expect(callsTo(calls, "POST", "/workspaces/ws_1/size-charts")).toHaveLength(1));
    const body = callsTo(calls, "POST", "/size-charts")[0].body as { name: string; unit: string; columns: unknown[]; rows: string[][] };
    expect(body.name).toBe("Trousers");
    expect(body.unit).toBe("cm");
    expect(body.columns[0]).toEqual({ ar: "المقاس", en: "Size" });
    expect(body.rows[0][0]).toBe("S");
    expect(await screen.findByText("Size chart created.")).toBeInTheDocument();
  });
});

describe("ProductSizeChartNote", () => {
  it("says which chart the product gets, and through what", async () => {
    fakeBackend({ "GET /size-charts": { sizeCharts: [tees] } });
    renderWithProviders(<ProductSizeChartNote productId="prod_1" collections={[]} />);
    expect(await screen.findByText("T-shirts")).toBeInTheDocument();
    expect(screen.getByText(/Attached to this product/)).toBeInTheDocument();
  });

  it("says when no chart reaches the product", async () => {
    fakeBackend({ "GET /size-charts": { sizeCharts: [tees] } });
    renderWithProviders(<ProductSizeChartNote productId="prod_9" collections={[]} />);
    expect(await screen.findByText("No size chart reaches this product. Attach one to it or to its collection.")).toBeInTheDocument();
  });
});

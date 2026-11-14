import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type { CatalogProductFilters, Product } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ProductBulkBar, SelectAllCheckbox, SelectRowCheckbox, useProductSelection } from "./ProductListBulk";

// The list's selection: the header ticks the page; with more products beyond
// it, "Select all N products in the store" takes every product the tab and
// filters match, which the bulk delete then works through.

const products = [1, 2, 3].map((n) => fake<Product>({ id: `p${n}`, name: `Product ${n}`, status: "active" }));
const filters: CatalogProductFilters = { status: ["draft", "active"] };

function List({ hasMore = true, onDone = vi.fn() }: { hasMore?: boolean; onDone?: () => void }) {
  // The list's tab and filters, as the page names them.
  const [scope, setScope] = useState("all|{}");
  const selection = useProductSelection(scope);
  return (
    <div>
      <button type="button" onClick={() => setScope("active|{}")}>
        Active tab
      </button>
      <SelectAllCheckbox selection={selection} products={products} />
      {products.map((product) => (
        <SelectRowCheckbox key={product.id} selection={selection} product={product} />
      ))}
      <ProductBulkBar
        selection={selection}
        onDone={onDone}
        products={products}
        hasMore={hasMore}
        filters={filters}
        filtersKey={scope}
        narrowed={false}
        archivedTab={false}
      />
    </div>
  );
}

function answerCount(count: number) {
  api.request.mockImplementation((async (path: string) =>
    String(path).includes("/products/count") ? { count, asOf: "2026-10-22T10:00:00.000Z" } : new Promise(() => undefined)) as never);
}

describe("ProductBulkBar — select all", () => {
  it("offers every product in the store once the whole page is ticked, and deletes them by the filter", async () => {
    answerCount(120);
    renderWithProviders(<List />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all products on this page" }));
    expect(screen.getByText("3 selected")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Select all 120 products in the store" }));
    expect(screen.getByText("All 120 selected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bulk edit" })).not.toBeInTheDocument();
    expect(api.request.mock.calls[0][0]).toContain("/products/count?status=draft%2Cactive");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete 120 products?")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Archive 120 products" }));
    const bulk = api.request.mock.calls.find(([path]) => String(path).endsWith("/products/bulk-delete"));
    expect(bulk?.[1]).toMatchObject({
      method: "POST",
      body: { mode: "archive", filter: { status: ["draft", "active"], createdBefore: "2026-10-22T10:00:00.000Z" } },
    });
  });

  it("offers nothing more when the page holds every product", () => {
    answerCount(3);
    renderWithProviders(<List hasMore={false} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all products on this page" }));
    expect(screen.queryByRole("button", { name: /Select all \d+ products/ })).not.toBeInTheDocument();
    expect(api.request).not.toHaveBeenCalled();
  });

  it("goes back to ticked rows when a row is unticked or the tab or filters change", async () => {
    answerCount(120);
    renderWithProviders(<List />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all products on this page" }));
    fireEvent.click(await screen.findByRole("button", { name: "Select all 120 products in the store" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Product 2" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Product 2" }));
    fireEvent.click(await screen.findByRole("button", { name: "Select all 120 products in the store" }));
    expect(screen.getByText("All 120 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Active tab" }));
    expect(screen.queryByText("All 120 selected")).not.toBeInTheDocument();
    expect(screen.getByText("3 selected")).toBeInTheDocument();
  });
});

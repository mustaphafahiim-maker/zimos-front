import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { api } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ProductBulkEditDialog } from "./ProductBulkEditDialog";

describe("ProductBulkEditDialog", () => {
  it("shows the progress bar while the edit is applied, for any number of products", async () => {
    api.listCollections.mockResolvedValue([]);
    let finish: (value: unknown) => void = () => undefined;
    api.request.mockReturnValue(new Promise((resolve) => (finish = resolve)) as never);
    const onDone = vi.fn();
    renderWithProviders(<ProductBulkEditDialog productIds={["p1", "p2"]} onClose={vi.fn()} onDone={onDone} />);

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply to 2 products" }));
    expect(await screen.findByText("Updating 2 products…")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(api.request).toHaveBeenCalledWith(
      "/workspaces/ws_1/catalog/products/bulk",
      expect.objectContaining({ body: { productIds: ["p1", "p2"], changes: { status: "draft" } } })
    );

    await act(async () => finish({ updated: 2, variantsRepriced: 0 }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

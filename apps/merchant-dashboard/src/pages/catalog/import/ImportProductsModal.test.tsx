import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { ApiError, type Product, type Variant } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ImportProductsModal } from "./ImportProductsModal";
import { FIELD_KEYS, type FieldKey } from "./productImport";

const CSV = [
  "handle,name,price,stock",
  "classic-tee,Classic Tee,299.00,10",
  "mystery,,120.00,5",
  "cap,Cap,80,3",
  "mug,Mug,150,7",
].join("\n");

/** The mapping <select> for a field (rendered in FIELD_KEYS order). */
const mappingSelect = (key: FieldKey) => screen.getAllByRole("combobox")[FIELD_KEYS.indexOf(key)];
const countOf = (label: string) => screen.getByText(label, { selector: "dt" }).nextElementSibling;

describe("ImportProductsModal", () => {
  it("maps columns, flags invalid rows and imports the valid products", async () => {
    api.listProducts.mockResolvedValue({ products: [], nextCursor: null } as Awaited<ReturnType<typeof api.listProducts>>);
    api.createProduct.mockImplementation(async (_ws, payload) => {
      if (payload.name === "Mug") throw new ApiError("A product with this handle already exists", 409);
      return fake<Product>({ id: `prod_${payload.name}`, name: payload.name });
    });
    api.createVariant.mockResolvedValue(fake<Variant>({ id: "var_x" }));
    const onImported = vi.fn();

    const { user } = renderWithProviders(<ImportProductsModal open onClose={vi.fn()} onImported={onImported} />);

    await user.upload(screen.getByLabelText("choose a file"), new File([CSV], "products.csv", { type: "text/csv" }));

    // Step 2: columns are auto-mapped.
    expect(await screen.findByText("products.csv — 4 data rows")).toBeInTheDocument();
    expect(mappingSelect("handle")).toHaveDisplayValue("handle");
    expect(mappingSelect("name")).toHaveDisplayValue("name");
    expect(mappingSelect("price")).toHaveDisplayValue("price");
    expect(mappingSelect("stock")).toHaveDisplayValue("stock");
    expect(mappingSelect("sku")).toHaveDisplayValue("— Not imported —");

    // Step 3: validation.
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("3 products ready to import")).toBeInTheDocument();
    expect(screen.getByText("1 products have errors and will be skipped")).toBeInTheDocument();
    expect(screen.getByText("Name is required.")).toBeInTheDocument();

    // Step 4: import.
    await user.click(screen.getByRole("button", { name: "Import 3 products" }));
    expect(await screen.findByText("Import finished.")).toBeInTheDocument();

    expect(countOf("Created")).toHaveTextContent("2");
    expect(countOf("Updated")).toHaveTextContent("0");
    expect(countOf("Skipped")).toHaveTextContent("0");
    expect(countOf("Failed")).toHaveTextContent("1");
    expect(screen.getByText("A product with this handle already exists")).toBeInTheDocument();

    expect(api.createProduct).toHaveBeenCalledTimes(3);
    const names = api.createProduct.mock.calls.map(([, payload]) => payload.name);
    expect(names).toEqual(["Classic Tee", "Cap", "Mug"]);
    expect(onImported).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { SpecKey } from "@store-builder/api-client";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SpecKeysPage } from "./SpecKeysPage";
import { ProductSpecsSection } from "./ProductSpecsSection";

const material: SpecKey = { id: "key_1", name: { ar: "الخامة", en: "Material" }, unit: null, filterable: true, position: 1 };
const screenSize: SpecKey = { id: "key_2", name: { en: "Screen size" }, unit: "inch", filterable: false, position: 2 };

describe("SpecKeysPage", () => {
  it("lists the store's specifications", async () => {
    const calls = fakeBackend({ "GET /product-specs/keys": { keys: [material, screenSize] } });
    renderWithProviders(<SpecKeysPage />);
    expect(await screen.findByRole("heading", { name: "Specifications" })).toBeInTheDocument();
    expect((await screen.findAllByText("Material")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Screen size").length).toBeGreaterThan(0);
    expect(callsTo(calls, "GET", "/workspaces/ws_1/product-specs/keys")).toHaveLength(1);
  });

  it("adds a specification with its name, unit and filter choice", async () => {
    const calls = fakeBackend({
      "GET /product-specs/keys": { keys: [] },
      "POST /product-specs/keys": { key: { id: "key_9", name: { en: "Weight" }, unit: "kg", filterable: false, position: 1 } },
    });
    const { user } = renderWithProviders(<SpecKeysPage />);
    expect(await screen.findByText("No specifications yet")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Add specification" })[0]);
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Name in English/), "Weight");
    await user.type(within(dialog).getByLabelText(/Unit/), "kg");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo(calls, "POST", "/product-specs/keys")).toHaveLength(1));
    expect(callsTo(calls, "POST", "/product-specs/keys")[0].body).toMatchObject({ name: { en: "Weight" }, unit: "kg" });
    expect(await screen.findByText("Specification added.")).toBeInTheDocument();
  });

  it("asks for a name in at least one language", async () => {
    const calls = fakeBackend({ "GET /product-specs/keys": { keys: [] } });
    const { user } = renderWithProviders(<SpecKeysPage />);
    await screen.findByText("No specifications yet");
    await user.click(screen.getAllByRole("button", { name: "Add specification" })[0]);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("Write the name in at least one language.")).toBeInTheDocument();
    expect(callsTo(calls, "POST", "/product-specs/keys")).toHaveLength(0);
  });

  it("reads in formal Arabic", async () => {
    fakeBackend({ "GET /product-specs/keys": { keys: [] } });
    renderWithProviders(<SpecKeysPage />, { locale: "ar" });
    expect(await screen.findByText("لا توجد مواصفات بعد")).toBeInTheDocument();
  });
});

describe("ProductSpecsSection", () => {
  it("shows a field per specification with the product's value, and saves them", async () => {
    const calls = fakeBackend({
      "GET /product-specs/keys": { keys: [material, screenSize] },
      "GET /product-specs/products/prod_1": { values: { key_1: "Cotton" } },
      "PUT /product-specs/products/prod_1": { values: { key_1: "Linen" } },
    });
    const { user } = renderWithProviders(<ProductSpecsSection productId="prod_1" />);
    const field = await screen.findByDisplayValue("Cotton");
    await user.clear(field);
    await user.type(field, "Linen");
    await user.click(await screen.findByRole("button", { name: "Save specifications" }));

    await waitFor(() => expect(callsTo(calls, "PUT", "/product-specs/products/prod_1")).toHaveLength(1));
    expect(callsTo(calls, "PUT", "/product-specs/products/prod_1")[0].body).toMatchObject({ values: { key_1: "Linen" } });
    expect(await screen.findByText("Specifications saved.")).toBeInTheDocument();
  });
});

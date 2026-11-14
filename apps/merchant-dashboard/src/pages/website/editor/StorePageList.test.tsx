import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { StorePageList, storePageName } from "./StorePageList";
import { renderWithProviders } from "@/test/renderWithProviders";

describe("the store's own pages in the editor", () => {
  it("lists the catalogue, a product, the cart and checkout, and opens one", async () => {
    const onSelect = vi.fn();
    const { user } = renderWithProviders(<StorePageList current="/cart" onSelect={onSelect} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
    expect(screen.getByRole("button", { current: "page" }).textContent).toMatch(/Cart|السلة/);
    await user.click(buttons[1]);
    expect(onSelect).toHaveBeenCalledWith("/product");
  });

  it("names each page in the editor's language", () => {
    expect(storePageName("/checkout", "ar")).toBe("الدفع");
    expect(storePageName("/products", "en")).toBe("All products");
  });
});

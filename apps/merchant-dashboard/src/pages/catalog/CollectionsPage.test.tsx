import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { CollectionSummary, Workspace } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { CollectionsPage } from "./CollectionsPage";

const collection = (id: string, name: string, parentId: string | null, position: number, productCount = 0) =>
  fake<CollectionSummary>({ id, name, slug: id, parentId, position, imageUrl: null, productCount, description: null });

const tree = [
  collection("men", "Men", null, 0, 3),
  collection("shirts", "Shirts", "men", 0, 2),
  collection("women", "Women", null, 1),
];

describe("CollectionsPage", () => {
  it("shows the tree, nested and in order, with product counts", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", role: "owner" });
    api.listCollections.mockResolvedValue(tree);
    renderWithProviders(<CollectionsPage />);

    const rows = await screen.findAllByRole("listitem");
    expect(rows.map((row) => within(row).getAllByText(/^(Men|Shirts|Women)$/)[0].textContent)).toEqual([
      "Men",
      "Shirts",
      "Women",
    ]);
    expect(screen.getByText("3 products", { exact: false })).toBeInTheDocument();
  });

  it("moves, indents and outdents with buttons, saving only what changed", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", role: "owner" });
    api.listCollections.mockResolvedValue(tree);
    api.reorderCollections.mockResolvedValue({ changed: 1 });
    const { user } = renderWithProviders(<CollectionsPage />);

    await screen.findByText("Women");
    expect(screen.getByRole("button", { name: "Move Men up" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Put Women inside the collection above" }));
    await waitFor(() =>
      expect(api.reorderCollections).toHaveBeenCalledWith("ws_1", [{ id: "women", parentId: "men", position: 1 }])
    );

    await user.click(screen.getByRole("button", { name: "Move Shirts out one level" }));
    await waitFor(() => expect(api.reorderCollections).toHaveBeenCalledTimes(2));
    expect(api.reorderCollections.mock.calls[1][1]).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "shirts", parentId: null })])
    );
  });

  it("puts the tree back when the server refuses a move", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", role: "owner" });
    api.listCollections.mockResolvedValue(tree);
    api.reorderCollections.mockRejectedValue(new Error("Collections can be nested at most 3 levels deep"));
    const { user } = renderWithProviders(<CollectionsPage />);

    await screen.findByText("Women");
    await user.click(screen.getByRole("button", { name: "Move Women up" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    const names = screen.getAllByRole("listitem").map((row) => row.textContent);
    expect(names[0]).toContain("Men");
  });

  it("orders the products inside a collection", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", role: "owner" });
    api.listCollections.mockResolvedValue(tree);
    api.getCollection.mockResolvedValue(
      fake({
        ...tree[0],
        products: [
          { id: "p1", name: "Linen shirt", slug: "linen", status: "active" },
          { id: "p2", name: "Oxford shirt", slug: "oxford", status: "active" },
        ],
      })
    );
    api.reorderCollectionProducts.mockResolvedValue({ productIds: ["p2", "p1"] });
    const { user } = renderWithProviders(<CollectionsPage />);

    await user.click(await screen.findByRole("button", { name: "Order the products in Men" }));
    await user.click(await screen.findByRole("button", { name: "Move Oxford shirt up" }));
    await user.click(screen.getByRole("button", { name: "Save order" }));
    await waitFor(() => expect(api.reorderCollectionProducts).toHaveBeenCalledWith("ws_1", "men", ["p2", "p1"]));
  });
});

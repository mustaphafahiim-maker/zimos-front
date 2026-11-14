import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { ApiError, type CatalogBulkDeleteRequest, type CatalogBulkDeleteResult } from "@store-builder/api-client";
import { api } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ProductBulkDeleteDialog } from "./ProductBulkDeleteDialog";
import { IDS_PER_REQUEST, type BulkDeleteTarget } from "./bulkDelete";

// Bulk delete by the single delete's rules: archive or delete for good, the
// count in the confirmation, the word to type for many, a progress bar for
// any number, and what was skipped with the reason.

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const sent = () =>
  api.request.mock.calls
    .filter(([path]) => String(path).endsWith("/products/bulk-delete"))
    .map(([, opts]) => (opts as { body: CatalogBulkDeleteRequest }).body);

/** Answers each chunk: everything done, except that the permanent delete skips the ids `skip` names. */
function answer(skip: Record<string, CatalogBulkDeleteResult["skipped"][number]["reason"]> = {}) {
  api.request.mockImplementation((async (_path: string, opts: { body: CatalogBulkDeleteRequest }) => {
    const body = opts.body;
    const list = "productIds" in body ? body.productIds : [];
    const refused = body.mode === "permanent" ? list.filter((id) => skip[id]) : [];
    const skipped = refused.map((id) => ({ id, name: `Product ${id}`, reason: skip[id] }));
    return { mode: body.mode, deleted: list.length - skipped.length, skipped, nextCursor: null };
  }) as never);
}

function open(target: BulkDeleteTarget, archivedOnly = false) {
  const onClose = vi.fn();
  const onDone = vi.fn();
  renderWithProviders(<ProductBulkDeleteDialog target={target} archivedOnly={archivedOnly} onClose={onClose} onDone={onDone} />);
  return { onClose, onDone };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ProductBulkDeleteDialog — confirming", () => {
  it("names the count, offers archive or delete for good, and asks for the word from 20 products", async () => {
    answer();
    open({ kind: "ids", ids: ids(30) });
    expect(screen.getByText("Delete 30 products?")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Archive/ })).toBeChecked();

    const confirm = screen.getByRole("button", { name: "Archive 30 products" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "delete" } });
    expect(confirm).toBeEnabled();

    fireEvent.click(screen.getByRole("radio", { name: /Delete permanently/ }));
    expect(screen.getByRole("button", { name: "Delete 30 products permanently" })).toBeEnabled();
  });

  it("asks for no word under 20, and offers only the permanent delete on the Archived tab", () => {
    open({ kind: "ids", ids: ids(3) }, true);
    expect(screen.queryByLabelText(/to confirm/)).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Archive/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete 3 products permanently" })).toBeEnabled();
  });

  it("Cancel before anything ran only closes", () => {
    const { onClose, onDone } = open({ kind: "ids", ids: ids(2) });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("ProductBulkDeleteDialog — running", () => {
  it("sends the ticked products in chunks and lists what was skipped, with the reason", async () => {
    answer({ p2: "has_orders", p7: "in_funnel" });
    const { onDone } = open({ kind: "ids", ids: ids(IDS_PER_REQUEST + 5) });
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("radio", { name: /Delete permanently/ }));
    fireEvent.click(screen.getByRole("button", { name: `Delete ${IDS_PER_REQUEST + 5} products permanently` }));

    expect(await screen.findByText(`${IDS_PER_REQUEST + 3} deleted permanently.`)).toBeInTheDocument();
    expect(sent().map((body) => ("productIds" in body ? body.productIds.length : 0))).toEqual([IDS_PER_REQUEST, 5]);
    expect(sent().every((body) => body.mode === "permanent")).toBe(true);
    expect(screen.getByText("2 skipped:")).toBeInTheDocument();
    expect(screen.getByText("Has orders, so it can only be archived")).toBeInTheDocument();
    expect(screen.getByText("Sold in a funnel: remove it from the funnel first")).toBeInTheDocument();

    // Like one product with orders: it can still be archived.
    fireEvent.click(screen.getByRole("button", { name: "Archive the 1 with orders instead" }));
    expect(await screen.findByText("1 archived.")).toBeInTheDocument();
    expect(sent().at(-1)).toEqual({ mode: "archive", productIds: ["p2"] });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("shows the progress bar for a handful of products too", async () => {
    let finish: (value: CatalogBulkDeleteResult) => void = () => undefined;
    api.request.mockReturnValue(new Promise((resolve) => (finish = resolve)) as never);
    open({ kind: "ids", ids: ids(2) });
    fireEvent.click(screen.getByRole("button", { name: "Archive 2 products" }));

    expect(await screen.findByText("Archiving… 0 of 2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("max", "2");
    await act(async () => finish({ mode: "archive", deleted: 2, skipped: [], nextCursor: null }));
    expect(await screen.findByText("2 archived.")).toBeInTheDocument();
  });

  it("follows the filter's cursor with the count's cut-off until the last chunk", async () => {
    api.request
      .mockResolvedValueOnce({ mode: "archive", deleted: 100, skipped: [], nextCursor: "c1" })
      .mockResolvedValueOnce({ mode: "archive", deleted: 20, skipped: [], nextCursor: null });
    open({ kind: "filter", filter: { status: ["draft", "active"] }, count: 120, asOf: "2026-10-22T10:00:00.000Z" });
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Archive 120 products" }));

    expect(await screen.findByText("120 archived.")).toBeInTheDocument();
    expect(sent()).toEqual([
      { mode: "archive", filter: { status: ["draft", "active"], createdBefore: "2026-10-22T10:00:00.000Z" } },
      { mode: "archive", filter: { status: ["draft", "active"], createdBefore: "2026-10-22T10:00:00.000Z" }, cursor: "c1" },
    ]);
  });

  it("waits out a 429 and goes on by itself", async () => {
    vi.useFakeTimers();
    api.request
      .mockRejectedValueOnce(new ApiError("Too many requests", 429, "RATE_LIMITED", null, 3))
      .mockResolvedValueOnce({ mode: "archive", deleted: 2, skipped: [], nextCursor: null });
    open({ kind: "ids", ids: ids(2) });
    fireEvent.click(screen.getByRole("button", { name: "Archive 2 products" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/going on in 3 seconds/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByText("2 archived.")).toBeInTheDocument();
    expect(sent()).toHaveLength(2);
  });

  it("stops on an error with what was done so far, and Try again goes on from there", async () => {
    api.request
      .mockResolvedValueOnce({ mode: "archive", deleted: IDS_PER_REQUEST, skipped: [], nextCursor: null })
      .mockRejectedValueOnce(new ApiError("Internal error", 500))
      .mockResolvedValueOnce({ mode: "archive", deleted: 5, skipped: [], nextCursor: null });
    open({ kind: "ids", ids: ids(IDS_PER_REQUEST + 5) });
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: `Archive ${IDS_PER_REQUEST + 5} products` }));

    expect(await screen.findByText(/The delete stopped/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`So far: ${IDS_PER_REQUEST} done, 0 skipped`))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(`${IDS_PER_REQUEST + 5} archived.`)).toBeInTheDocument();
    const chunks = sent();
    expect(chunks).toHaveLength(3);
    expect(chunks[2]).toEqual(chunks[1]);
  });

  it("Stop ends the run after the chunk in flight and the list is refreshed on close", async () => {
    api.request.mockReturnValue(new Promise(() => undefined) as never);
    const { onDone } = open({ kind: "ids", ids: ids(IDS_PER_REQUEST * 2) });
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: `Archive ${IDS_PER_REQUEST * 2} products` }));
    fireEvent.click(await screen.findByRole("button", { name: "Stop" }));

    expect(await screen.findByText(/Stopped\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(sent()).toHaveLength(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { ApiError, type CatalogImport } from "@store-builder/api-client";
import { api } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ProductTransferDialog } from "./ProductTransferDialog";
import { FOLLOW } from "./importFollow";

// The import dialog never waits for good: it follows the import until it ends,
// and stops with the reason on errors, a lost session, or an import that
// does not move. Closing stops the following and refreshes the list.

const job = (over: Partial<CatalogImport> = {}): CatalogImport => ({
  id: "imp_1",
  kind: "sheet",
  status: "queued",
  sourceName: "products.csv",
  total: 24,
  createdCount: 0,
  failedCount: 0,
  errors: [],
  createdAt: "2026-10-22T10:00:00.000Z",
  finishedAt: null,
  ...over,
});

// The multipart upload goes through ApiClient's private rawFetch.
const rawFetch = () => (api as unknown as { rawFetch: Mock }).rawFetch;
const reads = () => api.request.mock.calls.filter(([path]) => String(path).includes("/imports/"));

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function upload(answer: CatalogImport | Promise<never> = job()) {
  if (answer instanceof Promise) rawFetch().mockReturnValue(answer);
  else rawFetch().mockResolvedValue({ json: async () => ({ import: answer }) });
  const onClose = vi.fn();
  const onImported = vi.fn();
  renderWithProviders(<ProductTransferDialog onClose={onClose} onImported={onImported} />);
  fireEvent.change(screen.getByTestId("import-file"), {
    target: { files: [new File(["name,price"], "products.csv", { type: "text/csv" })] },
  });
  await tick(0);
  return { onClose, onImported };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ProductTransferDialog — following an import", () => {
  it("shows the progress, then how it ended with each row that failed", async () => {
    api.request
      .mockResolvedValueOnce({ import: job({ status: "running", createdCount: 10, failedCount: 2 }) })
      .mockResolvedValueOnce({
        import: job({
          status: "done",
          createdCount: 21,
          failedCount: 3,
          errors: [
            { row: 4, name: "Broken mug", message: "Variant 1: the price is missing or not a number" },
            { row: 9, name: "Cup", message: 'SKU "C-1" is already used by another product' },
            { row: 12, name: "Plate", message: "The product has no variant with a price" },
          ],
        }),
      });
    const { onImported } = await upload();
    expect(screen.getByText("Waiting for the import to start…")).toBeInTheDocument();

    await tick(FOLLOW.pollMs);
    expect(screen.getByText("Importing 24 products…")).toBeInTheDocument();
    expect(screen.getByText("12 of 24 done")).toBeInTheDocument();

    await tick(FOLLOW.pollMs);
    expect(screen.getByText("21 of 24 products imported. 3 could not be imported.")).toBeInTheDocument();
    expect(screen.getByText("3 could not be imported:")).toBeInTheDocument();
    expect(screen.getByText("Variant 1: the price is missing or not a number")).toBeInTheDocument();
    expect(screen.getByText(/Row 9/)).toBeInTheDocument();
    expect(onImported).toHaveBeenCalledTimes(1);

    await tick(FOLLOW.slowPollMs * 3);
    expect(reads()).toHaveLength(2);
  });

  it("says when every product came in, and when the import stopped midway", async () => {
    api.request.mockResolvedValueOnce({ import: job({ status: "done", createdCount: 24 }) });
    await upload();
    await tick(FOLLOW.pollMs);
    expect(screen.getByText("All 24 products were imported.")).toBeInTheDocument();
  });

  it("stops after failed reads in a row, says why, and can check again", async () => {
    api.request.mockRejectedValue(new ApiError("Internal error", 500));
    await upload();
    await tick(FOLLOW.pollMs + FOLLOW.slowPollMs + FOLLOW.slowPollMs * 2 + FOLLOW.slowPollMs * 4 + FOLLOW.maxBackoffMs);
    expect(reads()).toHaveLength(FOLLOW.maxFailures);
    expect(screen.getByText(/This window stopped following the import/)).toBeInTheDocument();

    await tick(60_000);
    expect(reads()).toHaveLength(FOLLOW.maxFailures);

    api.request.mockReset();
    api.request.mockResolvedValue({ import: job({ status: "done", createdCount: 24 }) });
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await tick(FOLLOW.pollMs);
    expect(screen.getByText("All 24 products were imported.")).toBeInTheDocument();
  });

  it("stops at once on a session that ended, with no retry", async () => {
    api.request.mockRejectedValue(new ApiError("Session expired", 401));
    await upload();
    await tick(FOLLOW.pollMs);
    expect(screen.getByText(/Your session ended/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check again" })).not.toBeInTheDocument();
    await tick(30_000);
    expect(reads()).toHaveLength(1);
  });

  it("stops waiting for an import that has not started after a minute", async () => {
    api.request.mockResolvedValue({ import: job() });
    await upload();
    await tick(FOLLOW.queuedLimitMs + FOLLOW.slowPollMs);
    expect(screen.getByText(/hasn't started after a minute/)).toBeInTheDocument();
  });

  it("stops waiting for a running import that has not moved for 3 minutes", async () => {
    api.request.mockResolvedValue({ import: job({ status: "running", createdCount: 5 }) });
    await upload();
    await tick(FOLLOW.stalledLimitMs + FOLLOW.slowPollMs * 2);
    expect(screen.getByText(/hasn't moved for 3 minutes/)).toBeInTheDocument();
  });

  it("Close stops the following and refreshes the list", async () => {
    api.request.mockResolvedValue({ import: job({ status: "running", createdCount: 3 }) });
    const { onClose, onImported } = await upload();
    await tick(FOLLOW.pollMs);
    expect(reads()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onImported).toHaveBeenCalledTimes(1);
  });
});

describe("ProductTransferDialog — the upload", () => {
  it("gives up on an upload that takes too long, and Close works meanwhile", async () => {
    const { onClose } = await upload(new Promise<never>(() => undefined));
    expect(screen.getByRole("button", { name: /Uploading/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();

    await tick(FOLLOW.uploadTimeoutMs);
    expect(screen.getByText(/The upload took too long/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows why the server refused the file", async () => {
    rawFetch().mockRejectedValue(
      new ApiError("The sheet has no product rows", 422, "VALIDATION_ERROR", { error: { message: "The sheet has no product rows" } })
    );
    renderWithProviders(<ProductTransferDialog onClose={vi.fn()} onImported={vi.fn()} />);
    fireEvent.change(screen.getByTestId("import-file"), { target: { files: [new File(["x"], "empty.csv")] } });
    await tick(0);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

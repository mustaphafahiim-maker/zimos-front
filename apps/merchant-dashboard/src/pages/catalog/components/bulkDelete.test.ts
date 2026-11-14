import { describe, expect, it } from "vitest";
import { ApiError, type CatalogBulkDeleteResult } from "@store-builder/api-client";
import {
  addResult,
  advance,
  confirmWordMatches,
  firstPosition,
  IDS_PER_REQUEST,
  nextRequest,
  RATE_LIMIT_WAIT_MS,
  rateLimitWait,
  type BulkDeleteTarget,
} from "./bulkDelete";

const result = (over: Partial<CatalogBulkDeleteResult> = {}): CatalogBulkDeleteResult => ({
  mode: "permanent",
  deleted: 0,
  skipped: [],
  nextCursor: null,
  ...over,
});

describe("ticked products", () => {
  it("sends them a few at a time until none is left", () => {
    const ids = Array.from({ length: IDS_PER_REQUEST + 5 }, (_, i) => `p${i}`);
    const target: BulkDeleteTarget = { kind: "ids", ids };
    let position = firstPosition(target);

    const first = nextRequest("archive", target, position)!;
    expect(first).toEqual({ mode: "archive", productIds: ids.slice(0, IDS_PER_REQUEST) });
    position = advance(position, first, result({ deleted: IDS_PER_REQUEST }));

    const second = nextRequest("archive", target, position)!;
    expect(second).toEqual({ mode: "archive", productIds: ids.slice(IDS_PER_REQUEST) });
    position = advance(position, second, result({ deleted: 5 }));

    expect(nextRequest("archive", target, position)).toBeNull();
  });
});

describe("every product the filters match", () => {
  it("sends the filter with the count's cut-off and follows the cursor to the end", () => {
    const target: BulkDeleteTarget = {
      kind: "filter",
      filter: { status: ["draft", "active"], q: "shirt" },
      count: 250,
      asOf: "2026-10-22T10:00:00.000Z",
    };
    let position = firstPosition(target);

    const first = nextRequest("permanent", target, position)!;
    expect(first).toEqual({
      mode: "permanent",
      filter: { status: ["draft", "active"], q: "shirt", createdBefore: "2026-10-22T10:00:00.000Z" },
    });
    position = advance(position, first, result({ deleted: 100, nextCursor: "c1" }));

    const second = nextRequest("permanent", target, position)!;
    expect(second).toMatchObject({ cursor: "c1" });
    position = advance(position, second, result({ deleted: 50 }));

    expect(nextRequest("permanent", target, position)).toBeNull();
  });
});

describe("totals, waits and the confirmation word", () => {
  it("adds up what was done and skipped", () => {
    const skip = { id: "p1", name: "Mug", reason: "has_orders" as const };
    const totals = addResult(addResult({ deleted: 0, skipped: [], processed: 0 }, result({ deleted: 3 })), result({ deleted: 1, skipped: [skip] }));
    expect(totals).toEqual({ deleted: 4, skipped: [skip], processed: 5 });
  });

  it("waits out a 429 for as long as it says, or a default", () => {
    expect(rateLimitWait(new ApiError("slow", 429, "RATE_LIMITED", null, 7))).toBe(7000);
    expect(rateLimitWait(new ApiError("slow", 429, "RATE_LIMITED"))).toBe(RATE_LIMIT_WAIT_MS);
    expect(rateLimitWait(new ApiError("boom", 500))).toBeNull();
    expect(rateLimitWait(new Error("x"))).toBeNull();
  });

  it("takes the word shown, in any case, or the English one", () => {
    expect(confirmWordMatches(" حذف ", "حذف")).toBe(true);
    expect(confirmWordMatches("delete", "حذف")).toBe(true);
    expect(confirmWordMatches("DELETE", "DELETE")).toBe(true);
    expect(confirmWordMatches("del", "DELETE")).toBe(false);
  });
});

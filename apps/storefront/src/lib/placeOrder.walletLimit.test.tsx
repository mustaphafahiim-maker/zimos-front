import { describe, expect, it } from "vitest";
import { ApiError } from "@store-builder/api-client";
import { getDictionary } from "./i18n";
import { cartErrorMessage, orderErrorMessage } from "./placeOrder";

// A store whose Zimos balance reached its plan's limit stays open, but new
// orders are refused (422 WALLET_LIMIT_REACHED): the shopper reads why in
// their language, never the server's English.
describe("an order refused for the store's balance limit", () => {
  const err = new ApiError("This store cannot take new orders right now.", 422, "WALLET_LIMIT_REACHED");

  it("reads in Arabic and in English", () => {
    const ar = getDictionary("ar").form.errors;
    const en = getDictionary("en").form.errors;
    expect(orderErrorMessage(err, ar)).toBe(ar.ordersPaused);
    expect(orderErrorMessage(err, en)).toBe(en.ordersPaused);
    expect(ar.ordersPaused).not.toBe(en.ordersPaused);
    expect(cartErrorMessage(err, ar, "fallback")).toBe(ar.ordersPaused);
  });
});

import { describe, expect, it } from "vitest";
import { ApiError } from "@store-builder/api-client";
import { getDictionary } from "./i18n";
import { orderErrorMessage, serverFieldErrors } from "./placeOrder";

// Self delivery's checkout refusals reach the shopper in their language.
describe("self delivery checkout errors", () => {
  const ar = getDictionary("ar").form.errors;
  const en = getDictionary("en").form.errors;

  it("explains a minimum order that is not met", () => {
    const err = new ApiError("below minimum", 422, "MIN_ORDER_NOT_MET", [{ field: "items", minimumAmount: 25000, subtotal: 10000 }]);
    expect(orderErrorMessage(err, en)).toBe(en.minOrder);
    expect(orderErrorMessage(err, ar)).toBe(ar.minOrder);
  });

  it("puts an unserved governorate on the governorate field, not as 'required'", () => {
    const err = new ApiError("not served", 422, "AREA_NOT_SERVED", [
      { field: "shippingAddress.province", message: "x", governorate: "aswan", servedGovernorates: ["cairo"] },
    ]);
    expect(orderErrorMessage(err, ar)).toBe(ar.areaNotServed);
    expect(serverFieldErrors(err, ar)).toEqual({ governorate: ar.areaNotServed });
  });

  it("shows the store's own closed message, else a generic one", () => {
    // ApiError.details is the response body, as the client builds it.
    const body = (message: string, reason: string) => ({ error: { code: "STORE_CLOSED", details: [{ field: "store", message, reason }] } });
    const own = new ApiError("closed", 422, "STORE_CLOSED", body("مقفولين النهارده", "hours"));
    expect(orderErrorMessage(own, ar)).toBe("مقفولين النهارده");
    const plain = new ApiError("closed", 422, "STORE_CLOSED", body("The store is closed", "manual"));
    expect(orderErrorMessage(plain, ar)).toBe(ar.storeClosed);
  });
});

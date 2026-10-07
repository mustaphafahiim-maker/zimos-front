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
});

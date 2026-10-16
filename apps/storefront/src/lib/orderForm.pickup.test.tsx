import { describe, expect, it } from "vitest";
import { getDictionary } from "./i18n";
import { EMPTY_ORDER_FORM, toCheckoutPayload, validateOrderForm } from "./orderForm";
import { resolveCheckoutSettings } from "@store-builder/api-client";

// Pickup from the store: the form stops asking for an address and the payload carries none.
describe("pickup order form", () => {
  const t = getDictionary("ar");
  const fields = resolveCheckoutSettings(undefined);
  const base = { ...EMPTY_ORDER_FORM, fullName: "زياد عباس", phone: "01012345678", notes: "هعدّي الساعة 8" };

  it("asks for an address on delivery, not on pickup", () => {
    const delivery = validateOrderForm(base, t, fields);
    expect(delivery.address).toBeTruthy();
    const pickup = validateOrderForm({ ...base, deliveryMethod: "pickup" }, t, fields);
    expect(pickup).toEqual({});
  });

  it("sends deliveryMethod pickup with no address, the shopper's note in notes", () => {
    const payload = toCheckoutPayload({ ...base, deliveryMethod: "pickup", city: "ignored" }, fields);
    expect(payload.deliveryMethod).toBe("pickup");
    expect(payload.shippingAddress).toBeUndefined();
    expect(payload.notes).toContain("هعدّي الساعة 8");
  });

  it("leaves a delivery payload as before", () => {
    const payload = toCheckoutPayload({ ...base, city: "الدقي", address: "12 شارع التحرير" }, fields);
    expect(payload.deliveryMethod).toBeUndefined();
    expect(payload.shippingAddress).toMatchObject({ country: "EG", city: "الدقي", addressLine: "12 شارع التحرير" });
  });
});

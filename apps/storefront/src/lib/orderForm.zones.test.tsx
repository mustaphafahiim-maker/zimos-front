import { describe, expect, it } from "vitest";
import { resolveCheckoutSettings } from "@store-builder/api-client";
import { getDictionary } from "./i18n";
import { EMPTY_ORDER_FORM, toCheckoutPayload, validateOrderForm } from "./orderForm";

// Delivery zones: the shopper must pick an area for delivery (not for pickup); only its id is sent.
describe("delivery zone in the order form", () => {
  const t = getDictionary("ar");
  const fields = resolveCheckoutSettings(undefined);
  const base = { ...EMPTY_ORDER_FORM, fullName: "زياد عباس", phone: "01012345678", city: "الدقي", address: "12 شارع التحرير" };

  it("asks for an area when the store prices by zones, but not for pickup", () => {
    expect(validateOrderForm(base, t, fields, { requireZone: true }).deliveryZoneId).toBe(t.form.errors.zone);
    expect(validateOrderForm({ ...base, deliveryZoneId: "z1" }, t, fields, { requireZone: true }).deliveryZoneId).toBeUndefined();
    expect(validateOrderForm({ ...base, deliveryMethod: "pickup" }, t, fields, { requireZone: true }).deliveryZoneId).toBeUndefined();
    expect(validateOrderForm(base, t, fields).deliveryZoneId).toBeUndefined();
  });

  it("sends the area's id only, never a price", () => {
    const payload = toCheckoutPayload({ ...base, deliveryZoneId: "z1" }, fields) as unknown as Record<string, unknown>;
    expect(payload.deliveryZoneId).toBe("z1");
    expect(payload).not.toHaveProperty("shippingAmount");
  });
});

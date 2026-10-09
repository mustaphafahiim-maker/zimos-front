import { resolveCheckoutForm, type CheckoutFormFieldKey } from "@store-builder/api-client";
import type { OrderFormFieldModes } from "@/lib/orderForm";

/**
 * The purchase form of an order the shopper picks up in store (handoff 225):
 * a pickup has no delivery address, so the address fields are neither shown
 * nor required. The same keys the API leaves out for a pickup
 * (backend checkout/checkoutForm.js ADDRESS_KEYS) — the shopper's note among
 * them, since it travels inside the address the API drops.
 *
 * Give the result to OrderFormFields, validateOrderForm and toCheckoutPayload
 * in place of the store's own fields: all three then skip the address.
 */
const PICKUP_HIDDEN: ReadonlySet<CheckoutFormFieldKey> = new Set(["country", "government", "city", "address", "postal_code", "note"]);

export function pickupFormFields(fields: OrderFormFieldModes): OrderFormFieldModes {
  const form = fields.form ?? resolveCheckoutForm(fields);
  return {
    ...fields,
    postal_code: "hidden",
    notes: "hidden",
    form: {
      ...form,
      fields: form.fields.map((f) => (PICKUP_HIDDEN.has(f.key) ? { ...f, enabled: false, required: false } : f)),
    },
  };
}

import type { LostOrderRecovery } from "@store-builder/api-client";
import { placesFor } from "./places";
import type { OrderFormValues } from "./orderForm";

/**
 * What a recovery link (/r/:token) hands to the checkout form: the fields the
 * shopper had already typed. Kept in sessionStorage for the one hop from the
 * link to the checkout page, and taken (removed) when the form reads it.
 */

/**
 * The form's governorate value is a code; an order stores the name ("الجيزة (Giza)"),
 * and a recovered checkout may carry either that, a bare name or the code itself.
 */
function governorateCode(province: string): string | null {
  const text = province.trim().toLowerCase();
  const match = [...placesFor("EG"), ...placesFor("SA")].find(
    (gov) => gov.code.toLowerCase() === text || text.includes(gov.en.toLowerCase()) || province.includes(gov.ar)
  );
  return match ? match.code : null;
}

const key = (workspaceId: string) => `zimos.recovery.${workspaceId}`;

export function saveRecoveryPrefill(workspaceId: string, recovery: LostOrderRecovery) {
  const address = recovery.shippingAddress;
  const governorate = address?.province ? governorateCode(address.province) : null;
  const values: Partial<OrderFormValues> = {
    ...(recovery.contact.fullName ? { fullName: recovery.contact.fullName } : {}),
    ...(recovery.contact.phone ? { phone: recovery.contact.phone } : {}),
    ...(recovery.contact.email ? { email: recovery.contact.email } : {}),
    ...(governorate ? { governorate } : {}),
    ...(address?.city ? { city: address.city } : {}),
    ...(address?.addressLine ? { address: address.addressLine } : {}),
    ...(address?.postalCode ? { postalCode: address.postalCode } : {}),
  };
  try {
    window.sessionStorage.setItem(key(workspaceId), JSON.stringify(values));
  } catch {
    // Private mode or a full store: the shopper types the form again.
  }
}

/** The saved fields, once. Null when there are none. */
export function takeRecoveryPrefill(workspaceId: string): Partial<OrderFormValues> | null {
  try {
    const raw = window.sessionStorage.getItem(key(workspaceId));
    if (!raw) return null;
    window.sessionStorage.removeItem(key(workspaceId));
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [field, value] of Object.entries(parsed)) if (typeof value === "string") out[field] = value;
    return out as Partial<OrderFormValues>;
  } catch {
    return null;
  }
}

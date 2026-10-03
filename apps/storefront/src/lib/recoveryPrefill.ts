import type { LostOrderRecovery } from "@store-builder/api-client";
import type { OrderFormValues } from "./orderForm";

/**
 * What a recovery link (/r/:token) hands to the checkout form: the fields the
 * shopper had already typed. Kept in sessionStorage for the one hop from the
 * link to the checkout page, and taken (removed) when the form reads it.
 */

const key = (workspaceId: string) => `zimos.recovery.${workspaceId}`;

export function saveRecoveryPrefill(workspaceId: string, recovery: LostOrderRecovery) {
  const address = recovery.shippingAddress;
  const values: Partial<OrderFormValues> = {
    ...(recovery.contact.fullName ? { fullName: recovery.contact.fullName } : {}),
    ...(recovery.contact.phone ? { phone: recovery.contact.phone } : {}),
    ...(recovery.contact.email ? { email: recovery.contact.email } : {}),
    ...(address?.province ? { governorate: address.province } : {}),
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

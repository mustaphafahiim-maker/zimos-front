/**
 * Checkout photo field and optional billing address (backend handoff item 165:
 * src/modules/checkout — checkoutForm.js, checkoutValidation.js).
 *
 * Settings live in `settings.checkout_settings` (PATCH /workspaces/:ws,
 * website.edit) and come back publicly as GET /store/:ws `checkout`:
 *   - a custom field (`custom_1` … `custom_5`) may have `type: "file"` — the
 *     shopper attaches a photo (JPEG, PNG, WebP; up to 15 MB raw);
 *   - `billing_address`: "off" (default) | "on" — the checkout asks for a
 *     billing address when it differs from the shipping one.
 *
 * Shopper side: the photo goes to POST /store/:ws/uploads with the visitor's
 * `X-Visitor-Id` (the same upload the product custom fields use); its
 * `uploadId` is the field's answer in `formFields`, and the checkout request
 * carries the same `X-Visitor-Id`. A photo from another visitor, unknown, or
 * past its 48 hours fails with 422 on `formFields.custom_N`.
 *
 * Staff side: `order.checkoutFields[]` entries of type "file" carry a signed,
 * short-lived `url`; `order.billingAddressSnapshot` is null when the billing
 * address is the shipping one.
 *
 * The shared purchase-form reader (storeDesign.ts → resolveCheckoutForm) only
 * knows text and list answers, so this file wraps it rather than changing it.
 */
import type { ApiClient } from "../client";
import type { CheckoutPayload, CustomerUpload, LocalizedText, Order, Workspace } from "../types";
import {
  CHECKOUT_FORM_CUSTOM_KEYS,
  resolveCheckoutForm,
  storeDesignSaveCheckoutForm,
  type CheckoutForm,
  type CheckoutFormField,
  type OrderCheckoutFieldAnswer,
} from "./storeDesign";

// ------------------------------------------------------------ settings ----

/** What a merchant's own checkout field asks for. */
export type CheckoutCustomFieldType = "text" | "choice" | "file";

export type CheckoutFormFieldWithFile = Omit<CheckoutFormField, "type"> & { type?: CheckoutCustomFieldType };

export type CheckoutBillingAddressMode = "off" | "on";

/** The purchase form with photo fields kept and the billing-address switch. */
export type CheckoutFormWithBilling = Omit<CheckoutForm, "fields"> & {
  fields: CheckoutFormFieldWithFile[];
  billing_address: CheckoutBillingAddressMode;
};

const record = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** `billing_address` of a stored `checkout_settings` blob, the public `checkout` object, or a resolved form. */
export function checkoutBillingAddressModeOf(stored: unknown): CheckoutBillingAddressMode {
  return record(stored).billing_address === "on" ? "on" : "off";
}

/** True for a custom checkout field that asks for a photo. */
export function isCheckoutPhotoField(field: { custom?: boolean; type?: string } | null | undefined): boolean {
  return Boolean(field && field.custom !== false && field.type === "file");
}

/**
 * resolveCheckoutForm, plus what it drops: the photo type of a custom field
 * and `billing_address`. Takes the stored blob or GET /store/:ws `checkout`.
 */
export function resolveCheckoutFormWithBilling(stored: unknown): CheckoutFormWithBilling {
  const form = resolveCheckoutForm(stored);
  const list = Array.isArray(record(stored).fields) ? (record(stored).fields as unknown[]) : [];
  const photoKeys = new Set(
    list
      .map(record)
      .filter((f) => f.type === "file" && (CHECKOUT_FORM_CUSTOM_KEYS as string[]).includes(String(f.key)))
      .map((f) => f.key as string)
  );
  return {
    ...form,
    fields: form.fields.map((f) => (f.custom && photoKeys.has(f.key) ? { ...f, type: "file" as const, options: [] } : f)),
    billing_address: checkoutBillingAddressModeOf(stored),
  };
}

/**
 * Saves the purchase form (storeDesignSaveCheckoutForm, which sends each
 * custom field's type as it is) and then the billing switch when the saved
 * settings do not have it yet. The backend merges `checkout_settings` keys,
 * so the second write leaves the form untouched.
 */
export async function storeDesignSaveCheckoutFormWithBilling(
  client: ApiClient,
  workspaceId: string,
  form: CheckoutFormWithBilling
): Promise<Workspace> {
  const workspace = await storeDesignSaveCheckoutForm(client, workspaceId, form as unknown as CheckoutForm);
  if (checkoutBillingAddressModeOf(workspace.settings?.checkout_settings) === form.billing_address) return workspace;
  const { workspace: next } = await client.request<{ workspace: Workspace }>(`/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: { settings: { checkout_settings: { billing_address: form.billing_address } } },
  });
  return next;
}

// ------------------------------------------------------------ shopper ----

/**
 * A shopper's photo for a checkout photo field (POST /store/:ws/uploads).
 * 413 over 15 MB, 415 UNSUPPORTED_MEDIA_TYPE, 422 unreadable, 429
 * TOO_MANY_PENDING_UPLOADS. Send the same `visitorId` with the checkout.
 */
export function checkoutUploadPhoto(
  client: ApiClient,
  workspaceId: string,
  file: File | Blob,
  visitorId: string
): Promise<CustomerUpload> {
  return client.uploadCustomerPhoto(workspaceId, file, { visitorId });
}

/** A billing address that differs from the shipping one. country, city and addressLine are required. */
export interface CheckoutBillingAddressInput {
  fullName?: string;
  /** ISO 3166 alpha-2. */
  country: string;
  province?: string;
  city: string;
  area?: string;
  addressLine: string;
  postalCode?: string;
}

/** The checkout body with the purchase form's own answers and the billing address. */
export type CheckoutPayloadWithBilling = CheckoutPayload & {
  /** custom_N / sa_national_address → text, a list choice, or a photo's uploadId. */
  formFields?: Record<string, string>;
  /** Omitted or true: billed to the shipping address. */
  billingSameAsShipping?: boolean;
  billingAddress?: CheckoutBillingAddressInput;
};

// --------------------------------------------------------------- staff ----

/** One answer of `order.checkoutFields`; a photo carries a signed link that works for a few minutes. */
export type OrderCheckoutFieldEntry = OrderCheckoutFieldAnswer & {
  type?: CheckoutCustomFieldType;
  uploadId?: string;
  url?: string | null;
  urlExpiresAt?: string | null;
};

export interface OrderBillingAddressSnapshot {
  fullName?: string | null;
  country?: string | null;
  province?: string | null;
  city?: string | null;
  area?: string | null;
  addressLine?: string | null;
  postalCode?: string | null;
}

/** The order's purchase-form answers (none on older orders). */
export function orderCheckoutFieldsOf(order: Order): OrderCheckoutFieldEntry[] {
  const list = (order as Order & { checkoutFields?: unknown }).checkoutFields;
  return Array.isArray(list) ? (list.filter((f) => f && typeof f === "object") as OrderCheckoutFieldEntry[]) : [];
}

/** The billing address the shopper gave; null when it is the shipping address. */
export function orderBillingAddressOf(order: Order): OrderBillingAddressSnapshot | null {
  const snapshot = (order as Order & { billingAddressSnapshot?: unknown }).billingAddressSnapshot;
  return snapshot && typeof snapshot === "object" ? (snapshot as OrderBillingAddressSnapshot) : null;
}

/** A label in the reader's language, falling back to the other one. */
export function checkoutFieldLabel(label: LocalizedText | null | undefined, locale: "ar" | "en"): string {
  if (!label) return "";
  return locale === "ar" ? label.ar || label.en : label.en || label.ar;
}

/**
 * Store design and settings (lane 5): the purchase form builder and the
 * thank-you page. Backend: src/modules/checkout/checkoutForm.js and
 * src/modules/storefront/thankYouPage.js.
 *
 * Both live in the workspace settings blob and are written through
 * PATCH /workspaces/:workspaceId (website.edit) and read back publicly from
 * GET /store/:workspaceId as `checkout` and `thankYou`.
 */
import type { ApiClient } from "../client";
import type { LocalizedText, Workspace } from "../types";

// ------------------------------------------------------- purchase form ----

export const CHECKOUT_FORM_FIXED_KEYS = [
  "full_name",
  "phone",
  "phone_alt",
  "email",
  "country",
  "government",
  "city",
  "address",
  "postal_code",
  "sa_national_address",
  "note",
] as const;

export type CheckoutFormFixedKey = (typeof CHECKOUT_FORM_FIXED_KEYS)[number];
export type CheckoutFormCustomKey = "custom_1" | "custom_2" | "custom_3" | "custom_4" | "custom_5";
export type CheckoutFormFieldKey = CheckoutFormFixedKey | CheckoutFormCustomKey;
export const CHECKOUT_FORM_CUSTOM_KEYS: CheckoutFormCustomKey[] = [
  "custom_1",
  "custom_2",
  "custom_3",
  "custom_4",
  "custom_5",
];
/** Always shown and required; the server ignores any attempt to change that. */
export const CHECKOUT_FORM_LOCKED_KEYS: CheckoutFormFieldKey[] = ["full_name", "phone"];

export interface CheckoutFormField {
  key: CheckoutFormFieldKey;
  /** Empty strings mean "use the storefront's built-in label". */
  label: LocalizedText;
  helpText: LocalizedText;
  position: number;
  enabled: boolean;
  required: boolean;
  custom: boolean;
  /** Custom fields only. */
  type?: "text" | "choice";
  options?: string[];
}

export type CheckoutFormLayout = "one_step" | "inline_on_product";

export interface CheckoutForm {
  fields: CheckoutFormField[];
  layout: CheckoutFormLayout;
  show_trust_badges: boolean;
  allow_discount_codes: boolean;
  thank_you_message: string | null;
  auto_select_region: boolean;
  auto_select_variant: boolean;
}

const DEFAULT_FIELD_STATE: Record<CheckoutFormFixedKey, [enabled: boolean, required: boolean]> = {
  full_name: [true, true],
  phone: [true, true],
  phone_alt: [true, false],
  email: [true, false],
  country: [false, false],
  government: [true, true],
  city: [true, true],
  address: [true, true],
  postal_code: [true, false],
  sa_national_address: [false, false],
  note: [true, false],
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const localized = (v: unknown): LocalizedText => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { ar: text(o.ar), en: text(o.en) };
};

/**
 * The effective purchase form for a stored `checkout_settings` blob or for
 * the public `checkout` object — mirrors resolveCheckoutForm in the backend,
 * including the three switches that predate the builder.
 */
export function resolveCheckoutForm(stored: unknown): CheckoutForm {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  const list = Array.isArray(s.fields)
    ? (s.fields as Array<Record<string, unknown>>).filter((f) => f && typeof f.key === "string")
    : null;
  const byKey = new Map((list ?? []).map((f) => [f.key as string, f]));
  const legacy = (key: CheckoutFormFixedKey): [boolean, boolean] => {
    const mode = key === "email" ? s.email : key === "postal_code" ? s.postal_code : key === "note" ? s.notes : null;
    if (list || typeof mode !== "string") return DEFAULT_FIELD_STATE[key];
    if (mode === "hidden") return [false, false];
    if (mode === "required" && key !== "note") return [true, true];
    return [true, false];
  };

  const fields: CheckoutFormField[] = CHECKOUT_FORM_FIXED_KEYS.map((key, index) => {
    const f = byKey.get(key) ?? {};
    const [defEnabled, defRequired] = legacy(key);
    const locked = CHECKOUT_FORM_LOCKED_KEYS.includes(key);
    const enabled = locked ? true : typeof f.enabled === "boolean" ? f.enabled : defEnabled;
    const required = locked
      ? true
      : key === "note"
        ? false
        : enabled && (typeof f.required === "boolean" ? f.required : defRequired);
    return {
      key,
      label: localized(f.label),
      helpText: localized(f.helpText),
      position: Number.isInteger(f.position) ? (f.position as number) : index + 1,
      enabled,
      required,
      custom: false,
    };
  });

  for (const f of list ?? []) {
    const key = f.key as CheckoutFormCustomKey;
    if (!CHECKOUT_FORM_CUSTOM_KEYS.includes(key)) continue;
    const type = f.type === "choice" ? "choice" : "text";
    const options = type === "choice" && Array.isArray(f.options) ? (f.options as unknown[]).map(text).filter(Boolean) : [];
    if (!text((f.label as Record<string, unknown> | undefined)?.ar) && !text((f.label as Record<string, unknown> | undefined)?.en)) continue;
    fields.push({
      key,
      label: localized(f.label),
      helpText: localized(f.helpText),
      position: Number.isInteger(f.position) ? (f.position as number) : 50,
      enabled: f.enabled === true,
      required: f.enabled === true && f.required === true,
      custom: true,
      type,
      options,
    });
  }

  const sorted = fields
    .map((f, i) => ({ f, i }))
    .sort((a, b) => a.f.position - b.f.position || a.i - b.i)
    .map(({ f }) => f);
  const bool = (key: string, fallback: boolean) => (typeof s[key] === "boolean" ? (s[key] as boolean) : fallback);

  return {
    fields: sorted,
    layout: s.layout === "one_step" ? "one_step" : "inline_on_product",
    show_trust_badges: bool("show_trust_badges", true),
    allow_discount_codes: bool("allow_discount_codes", true),
    thank_you_message: text(s.thank_you_message) || null,
    auto_select_region: bool("auto_select_region", true),
    auto_select_variant: bool("auto_select_variant", true),
  };
}

const modeOf = (f: CheckoutFormField | undefined) => (!f || !f.enabled ? "hidden" : f.required ? "required" : "optional");

/** Saves the whole form. Positions are rewritten from the list order. */
export async function storeDesignSaveCheckoutForm(
  client: ApiClient,
  workspaceId: string,
  form: CheckoutForm
): Promise<Workspace> {
  const fields = form.fields.map((f, index) => ({
    key: f.key,
    label: f.label,
    helpText: f.helpText,
    position: index + 1,
    enabled: f.enabled,
    required: f.enabled && f.required,
    ...(f.custom ? { type: f.type ?? "text", options: f.type === "choice" ? (f.options ?? []).map((o) => o.trim()).filter(Boolean) : [] } : {}),
  }));
  const find = (key: CheckoutFormFieldKey) => form.fields.find((f) => f.key === key);
  const { workspace } = await client.request<{ workspace: Workspace }>(`/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: {
      settings: {
        checkout_settings: {
          fields,
          // The switches older readers know, kept in step with the list.
          email: modeOf(find("email")),
          postal_code: modeOf(find("postal_code")),
          notes: find("note")?.enabled ? "optional" : "hidden",
          layout: form.layout,
          show_trust_badges: form.show_trust_badges,
          allow_discount_codes: form.allow_discount_codes,
          thank_you_message: form.thank_you_message?.trim() || null,
          auto_select_region: form.auto_select_region,
          auto_select_variant: form.auto_select_variant,
        },
      },
    },
  });
  return workspace;
}

/** One answer to a purchase-form field with no column of its own (Order.checkoutFields). */
export interface OrderCheckoutFieldAnswer {
  key: string;
  label: LocalizedText;
  value: string;
}

// ------------------------------------------------------ thank-you page ----

export interface ThankYouPageSettings {
  enabled: boolean;
  /** Plain text; {{order_number}} and {{customer_name}} are filled in. */
  content: string;
  show_back_home_button: boolean;
  show_products_from_collection_id: string | null;
}

export const THANK_YOU_PAGE_DEFAULTS: ThankYouPageSettings = {
  enabled: false,
  content: "",
  show_back_home_button: true,
  show_products_from_collection_id: null,
};

export function resolveThankYouPage(stored: unknown): ThankYouPageSettings {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  return {
    enabled: s.enabled === true,
    content: typeof s.content === "string" ? s.content : "",
    show_back_home_button: typeof s.show_back_home_button === "boolean" ? s.show_back_home_button : true,
    show_products_from_collection_id:
      typeof s.show_products_from_collection_id === "string" ? s.show_products_from_collection_id : null,
  };
}

export async function storeDesignSaveThankYouPage(
  client: ApiClient,
  workspaceId: string,
  page: ThankYouPageSettings
): Promise<Workspace> {
  const { workspace } = await client.request<{ workspace: Workspace }>(`/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: { settings: { thank_you_page: page } },
  });
  return workspace;
}

/** Replaces {{order_number}} and {{customer_name}} in thank-you content. */
export function fillThankYouContent(content: string, vars: { orderNumber?: string | null; customerName?: string | null }) {
  return content
    .replace(/\{\{\s*order_number\s*\}\}/g, vars.orderNumber ?? "")
    .replace(/\{\{\s*customer_name\s*\}\}/g, vars.customerName ?? "");
}

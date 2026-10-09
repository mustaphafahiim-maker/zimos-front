/**
 * The checkout's later additions, shopper side and their dashboard settings
 * (frontend-handoff 302/322, 348, 353, 355, 362, 363, 374, 388).
 *
 *   374  GET /store/:ws → store.checkout.consent; POST /checkout takes `acceptsMarketing`, `acceptsTerms`;
 *        PATCH /workspaces/:ws { settings: { checkout_settings: { marketing_checkbox, terms_checkbox, …_label } } };
 *        GET /workspaces/:ws/orders/:id → order.consents.
 *   302  POST /store/:ws/checkout-sessions takes `funnelId` / `websiteId`, on every save (322).
 *   353  POST /store/:ws/coupon-preview answers `freeShipping` and, for DISCOUNT_QUANTITY_NOT_MET, `details`.
 *   355  a checkout naming a funnel: 422 FUNNEL_NOT_AVAILABLE, 410 FUNNEL_PAUSED, 422 FUNNEL_ITEM_NOT_OFFERED.
 *   362  POST /store/:ws/deposit-quote takes `otpToken`; `decidedAtCheckout` when the phone is not verified.
 *   363  the newsletter and the spin carry `botToken` (endpoints/engagement, endpoints/spinWheel keep their calls).
 *   388  /store/:ws/orders/:orderId/self-service: `confirmState`, POST /confirm; the setting's `confirm`.
 *
 * All exported names are prefixed `checkoutHardening` / `CheckoutHardening`.
 */
import { ApiError, type ApiClient } from "../client";
import { apiErrorDetails } from "../errors";
import type { ManualTransferDepositQuote } from "./manualTransfers";
import { orderSelfServiceOrderId, type OrderSelfServiceSettings, type OrderSelfServiceState } from "./orderSelfService";
import type { StorefrontCouponPreview } from "./coupons";

/** The error's code as plain text: these codes are newer than the client's own list. */
export function checkoutHardeningCode(err: unknown): string {
  return err instanceof ApiError ? String(err.code ?? "") : "";
}

// ------------------------------------------------------------- 374 consent --

export interface CheckoutHardeningLabel {
  ar: string;
  en: string;
}

/** `store.checkout.consent` of GET /store/:ws. */
export interface CheckoutHardeningConsent {
  marketing: { enabled: boolean; label: CheckoutHardeningLabel };
  terms: { enabled: boolean; required: boolean; label: CheckoutHardeningLabel; policies: string[] };
}

function labelOf(raw: unknown): CheckoutHardeningLabel {
  const l = (raw && typeof raw === "object" ? raw : {}) as Partial<CheckoutHardeningLabel>;
  return { ar: typeof l.ar === "string" ? l.ar : "", en: typeof l.en === "string" ? l.en : "" };
}

/** Reads the two boxes off the store's checkout settings; both off for an older answer. */
export function checkoutHardeningConsentOf(checkout: unknown): CheckoutHardeningConsent {
  const raw = ((checkout && typeof checkout === "object" ? checkout : {}) as { consent?: unknown }).consent;
  const c = (raw && typeof raw === "object" ? raw : {}) as { marketing?: Record<string, unknown>; terms?: Record<string, unknown> };
  return {
    marketing: { enabled: c.marketing?.enabled === true, label: labelOf(c.marketing?.label) },
    terms: {
      enabled: c.terms?.enabled === true,
      required: c.terms?.required === true,
      label: labelOf(c.terms?.label),
      policies: Array.isArray(c.terms?.policies) ? (c.terms.policies as unknown[]).filter((p): p is string => typeof p === "string") : [],
    },
  };
}

/** The dashboard's side: `settings.checkout_settings` of the workspace. */
export interface CheckoutHardeningConsentSettings {
  marketing_checkbox: "off" | "on";
  marketing_checkbox_label: CheckoutHardeningLabel;
  terms_checkbox: "off" | "required";
  terms_checkbox_label: CheckoutHardeningLabel;
}

export const CHECKOUT_HARDENING_LABEL_MAX = 300;

export function checkoutHardeningConsentSettingsOf(checkoutSettings: unknown): CheckoutHardeningConsentSettings {
  const s = (checkoutSettings && typeof checkoutSettings === "object" ? checkoutSettings : {}) as Record<string, unknown>;
  return {
    marketing_checkbox: s.marketing_checkbox === "on" ? "on" : "off",
    marketing_checkbox_label: labelOf(s.marketing_checkbox_label),
    terms_checkbox: s.terms_checkbox === "required" ? "required" : "off",
    terms_checkbox_label: labelOf(s.terms_checkbox_label),
  };
}

/** Saves the two boxes; the other checkout settings are untouched (sub-keys merge). Returns what the store now holds. */
export async function checkoutHardeningSaveConsentSettings(
  client: ApiClient,
  workspaceId: string,
  settings: CheckoutHardeningConsentSettings
): Promise<CheckoutHardeningConsentSettings> {
  const body = await client.request<{ workspace?: { settings?: { checkout_settings?: unknown } } }>(`/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: { settings: { checkout_settings: settings } },
  });
  const saved = body.workspace?.settings?.checkout_settings;
  return saved ? checkoutHardeningConsentSettingsOf(saved) : settings;
}

/** The policies the terms box would link (the store's public answer): empty when no terms are written. */
export async function checkoutHardeningTermsPolicies(client: ApiClient, workspaceId: string): Promise<string[]> {
  const body = await client.request<{ store?: { checkout?: unknown } }>(`/store/${workspaceId}`, { auth: false });
  return checkoutHardeningConsentOf(body.store?.checkout).terms.policies;
}

/** `order.consents` on the dashboard's order (null when the store showed neither box). */
export interface CheckoutHardeningOrderConsents {
  marketing?: { accepted: boolean; applied?: boolean; reason?: string | null; at?: string | null; label?: CheckoutHardeningLabel } | null;
  terms?: { accepted: boolean; at?: string | null; label?: CheckoutHardeningLabel; policies?: string[]; version?: string | null } | null;
}

export function checkoutHardeningOrderConsents(order: unknown): CheckoutHardeningOrderConsents | null {
  const consents = (order && typeof order === "object" ? (order as { consents?: unknown }).consents : null) ?? null;
  return consents && typeof consents === "object" ? (consents as CheckoutHardeningOrderConsents) : null;
}

/** Whether a checkout 422 names the terms box. */
export function checkoutHardeningTermsRefused(err: unknown): boolean {
  if (checkoutHardeningCode(err) !== "VALIDATION_ERROR") return false;
  const details = apiErrorDetails<unknown>(err);
  return Array.isArray(details) && details.some((d) => (d as { field?: unknown } | null)?.field === "acceptsTerms");
}

// ------------------------------------------------------ 353 coupon preview --

export interface CheckoutHardeningQuantityNotMet {
  buyQuantity: number | null;
  getQuantity: number | null;
  units: number | null;
  remainingUnits: number;
}

/** A coupon preview as the API now answers it. */
export type CheckoutHardeningCouponPreview = StorefrontCouponPreview & {
  freeShipping?: boolean;
  details?: Array<Partial<CheckoutHardeningQuantityNotMet> & { field?: string }>;
};

function quantityOf(details: unknown): CheckoutHardeningQuantityNotMet | null {
  const first = Array.isArray(details) ? (details[0] as Partial<CheckoutHardeningQuantityNotMet> | undefined) : undefined;
  if (!first || typeof first.remainingUnits !== "number") return null;
  const n = (v: unknown) => (typeof v === "number" ? v : null);
  return { buyQuantity: n(first.buyQuantity), getQuantity: n(first.getQuantity), units: n(first.units), remainingUnits: first.remainingUnits };
}

/** How many more units a buy-X-get-Y code needs, from a preview that says DISCOUNT_QUANTITY_NOT_MET; null otherwise. */
export function checkoutHardeningCouponQuantity(preview: StorefrontCouponPreview | null | undefined): CheckoutHardeningQuantityNotMet | null {
  if (!preview || preview.valid || preview.reason !== "DISCOUNT_QUANTITY_NOT_MET") return null;
  return quantityOf((preview as CheckoutHardeningCouponPreview).details);
}

/** The same, from the checkout's own 422 DISCOUNT_QUANTITY_NOT_MET. */
export function checkoutHardeningRefusedQuantity(err: unknown): CheckoutHardeningQuantityNotMet | null {
  if (checkoutHardeningCode(err) !== "DISCOUNT_QUANTITY_NOT_MET") return null;
  return quantityOf(apiErrorDetails<unknown>(err)) ?? { buyQuantity: null, getQuantity: null, units: null, remainingUnits: 0 };
}

export function checkoutHardeningFreeShipping(preview: StorefrontCouponPreview | null | undefined): boolean {
  return Boolean(preview?.valid && (preview as CheckoutHardeningCouponPreview).freeShipping === true);
}

// ----------------------------------------------------------- 355 funnels --

/** `gone`: the funnel is not published here or is paused. `item`: it does not sell one of the lines. */
export function checkoutHardeningFunnelRefusal(err: unknown): "gone" | "item" | null {
  const code = checkoutHardeningCode(err);
  if (code === "FUNNEL_NOT_AVAILABLE" || code === "FUNNEL_PAUSED") return "gone";
  if (code === "FUNNEL_ITEM_NOT_OFFERED") return "item";
  return null;
}

// ----------------------------------------------------------- 362 deposit --

export type CheckoutHardeningDepositQuote = ManualTransferDepositQuote & {
  /** A "risky shoppers only" rule and no verified phone: the checkout itself decides. */
  decidedAtCheckout?: boolean;
};

/** Whether a cash-on-delivery order needs a deposit first. `otpToken`: the checkout code's proof for this same phone. */
export async function checkoutHardeningDepositQuote(
  client: ApiClient,
  workspaceId: string,
  body: { phone?: string; otpToken?: string | null }
): Promise<CheckoutHardeningDepositQuote> {
  const { deposit } = await client.request<{ deposit: CheckoutHardeningDepositQuote }>(`/store/${workspaceId}/deposit-quote`, {
    method: "POST",
    body: { phone: body.phone ?? "", ...(body.otpToken ? { otpToken: body.otpToken } : {}) },
    auth: false,
  });
  return deposit;
}

/** The checkout's 422 DEPOSIT_REQUIRED: what the deposit is. Null for any other error. */
export function checkoutHardeningDepositRequired(err: unknown): { amountType: "shipping" | "fixed"; fixedAmount: number | null } | null {
  if (checkoutHardeningCode(err) !== "DEPOSIT_REQUIRED") return null;
  const d = (apiErrorDetails<{ amountType?: unknown; fixedAmount?: unknown }>(err) ?? {}) as { amountType?: unknown; fixedAmount?: unknown };
  return { amountType: d.amountType === "fixed" ? "fixed" : "shipping", fixedAmount: typeof d.fixedAmount === "number" ? d.fixedAmount : null };
}

// ------------------------------------------- 388 confirm from the link --

export type CheckoutHardeningConfirmState = "available" | "confirmed" | "review" | "cancelled" | "shipped" | "closed";

export type CheckoutHardeningSelfServiceState = OrderSelfServiceState & {
  canConfirm?: boolean;
  confirmState?: CheckoutHardeningConfirmState;
  confirmedAt?: string | null;
  /** Set while a funnel's offer window is still open: confirming works after it. */
  confirmAvailableAt?: string | null;
};

function selfServicePath(workspaceRef: string, token: string): string | null {
  const orderId = orderSelfServiceOrderId(token);
  return orderId ? `/store/${workspaceRef}/orders/${encodeURIComponent(orderId)}/self-service` : null;
}

/** What the shopper may do on the order of this tracking token, with the confirmation's state. Null when the token names no order. */
export async function checkoutHardeningConfirmState(client: ApiClient, workspaceRef: string, token: string): Promise<CheckoutHardeningSelfServiceState | null> {
  const path = selfServicePath(workspaceRef, token);
  if (!path) return null;
  return client.request<CheckoutHardeningSelfServiceState>(`${path}?token=${encodeURIComponent(token)}`, { auth: false });
}

export interface CheckoutHardeningConfirmResult {
  confirmed: boolean;
  orderNumber: string;
  confirmedAt: string | null;
}

/** The shopper confirms the cash-on-delivery order. 409 CONFIRM_NOT_OFFERED / CONFIRM_NEEDS_REVIEW / ORDER_CANCELLED / CONFIRM_NOT_ALLOWED / CONFIRM_NOT_YET; 429. */
export function checkoutHardeningConfirm(client: ApiClient, workspaceRef: string, token: string): Promise<CheckoutHardeningConfirmResult> {
  const path = selfServicePath(workspaceRef, token);
  if (!path) return Promise.reject(new Error("Not a tracking token"));
  return client.request<CheckoutHardeningConfirmResult>(`${path}/confirm`, { method: "POST", auth: false, body: { token } });
}

/** The self-service setting with its newer `confirm` rule. */
export type CheckoutHardeningSelfServiceSettings = OrderSelfServiceSettings & { confirm?: { enabled: boolean } };

export function checkoutHardeningSelfServiceSettingsGet(client: ApiClient, workspaceId: string): Promise<CheckoutHardeningSelfServiceSettings> {
  return client.request<CheckoutHardeningSelfServiceSettings>(`/workspaces/${workspaceId}/order-self-service`);
}

/** Switches the link confirmation on or off; the cancel and address rules are sent back as they are. */
export function checkoutHardeningSelfServiceConfirmSave(
  client: ApiClient,
  workspaceId: string,
  current: OrderSelfServiceSettings,
  enabled: boolean
): Promise<CheckoutHardeningSelfServiceSettings> {
  return client.request<CheckoutHardeningSelfServiceSettings>(`/workspaces/${workspaceId}/order-self-service`, {
    method: "PUT",
    body: { cancel: current.cancel, address: current.address, confirm: { enabled } },
  });
}

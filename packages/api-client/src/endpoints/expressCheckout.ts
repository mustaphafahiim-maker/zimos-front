/**
 * Express checkout buttons, Stripe and PayPal (handoff item 183; backend
 * payments/gateways/stripe.js, paypal.js, paymentMethodsService.js). No new
 * endpoint: the existing calls carry a little more.
 *
 *   GET /store/:workspaceId/payment-methods?currency=USD
 *     a method may carry `express: { wallets: ["apple_pay", "google_pay"] }`
 *     (Stripe's card) or `{ wallets: ["paypal"] }` (PayPal) — shown as wallet
 *     buttons at the top of checkout. The sandbox gateway offers both too.
 *   GET /workspaces/:workspaceId/payments/methods
 *     the dashboard's list carries the same `express`.
 *   GET /workspaces/:workspaceId/payments/gateways
 *     Stripe's `expressWallets` setting field has `type: "boolean"`.
 *   PUT /workspaces/:workspaceId/payments/gateways/stripe  { credentials: { secretKey, webhookSecret? }, settings: { expressWallets } }
 *   PUT /workspaces/:workspaceId/payments/gateways/paypal  { credentials: { clientId, clientSecret } }
 *
 * orders.payment_method gains `paypal` (approved on PayPal, captured when the
 * shopper comes back).
 */
import type { GatewayFieldDescriptor, PaymentMethod, PaymentMethodEntry, StorefrontPaymentMethod } from "../types";

/** Every way an order can be paid, PayPal included. */
export type PaymentMethodWithPaypal = PaymentMethod | "paypal";

export type ExpressWallet = "apple_pay" | "google_pay" | "paypal";

export interface ExpressInfo {
  wallets: ExpressWallet[];
}

/** A shopper's method as the store lists it since item 183. */
export type StorefrontExpressMethod = StorefrontPaymentMethod & { express?: ExpressInfo };

/** A method on the dashboard's Payments list since item 183. */
export type PaymentMethodEntryWithExpress = PaymentMethodEntry & { express?: ExpressInfo };

/** A gateway setting field: an integration ID (Paymob) or an on/off switch (Stripe's express wallets). */
export type GatewaySettingField = Omit<GatewayFieldDescriptor, "type"> & { type?: "integer" | "boolean" };

const WALLETS: readonly ExpressWallet[] = ["apple_pay", "google_pay", "paypal"];

/** The wallet buttons a method offers, in the server's order; unknown wallets are left out. */
export function expressWalletsOf(method: { id: string }): ExpressWallet[] {
  const wallets = (method as { express?: Partial<ExpressInfo> | null }).express?.wallets;
  return Array.isArray(wallets) ? wallets.filter((w): w is ExpressWallet => WALLETS.includes(w)) : [];
}

/** Whether a gateway setting is an on/off switch rather than a typed-in ID. */
export function isSwitchSetting(field: GatewayFieldDescriptor): boolean {
  return (field as GatewaySettingField).type === "boolean";
}

/**
 * Store credit (backend: frontend-handoff item 204, src/modules/storeCredit).
 *
 * Money a customer holds at the store, in the store currency. Staff give or
 * take it, or refund an order to store credit instead of money; a signed-in
 * shopper spends it at checkout.
 *
 * Dashboard, /workspaces/:ws/store-credit:
 *   GET  /                              (customers.view)   → StoreCreditOverview (holders, biggest first, 500 at most)
 *   PUT  /settings { enabled }          (discounts.manage) → { spendingEnabled }
 *   GET  /customers/:customerId         (customers.view)   → StoreCreditAccount (last 200 changes)
 *   POST /customers/:customerId/adjust  (refunds.manage) { amount: ±int minor units, note } → { balance, applied }
 *        422 STORE_CREDIT_NOT_ENOUGH when more is taken than the balance holds.
 *   POST /orders/:orderId/refund        (refunds.manage) { amount, reason } → 201 { refund, balance }
 *        A normal refund of the order, paid onto the customer's credit. 422
 *        REFUND_EXCEEDS_ELIGIBLE_AMOUNT, ORDER_HAS_NO_CUSTOMER, STORE_CREDIT_CURRENCY.
 *
 * Storefront:
 *   GET /store/:ws/account/store-credit → ShopperStoreCredit (X-Shopper-Token; 401 SHOPPER_NOT_SIGNED_IN)
 *   Checkout: `useStoreCredit: true` with X-Shopper-Token, with cash on delivery or an online
 *   payment (not bank transfer). On field `useStoreCredit`: 401 SHOPPER_NOT_SIGNED_IN,
 *   422 STORE_CREDIT_EMPTY, STORE_CREDIT_OFF. The 201 adds `storeCredit` (StoreCreditRedemption).
 *
 * Every amount is integer minor units, sent as a string.
 */
import { ApiError, type ApiClient } from "../client";
import { apiErrorDetails } from "../errors";

export interface StoreCreditHolder {
  customerId: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  balance: string;
}

export interface StoreCreditOverview {
  /** Whether shoppers may spend their credit at checkout (on unless switched off). */
  spendingEnabled: boolean;
  customers: StoreCreditHolder[];
  /** Every customer's credit together. */
  outstanding: string;
  currency: string;
}

/**
 * Why a balance moved: given by staff, taken off by staff, an order refunded
 * as credit, spent on an order, held for an unpaid online order, given back,
 * a refund of a credit payment, or the reward for an invited friend's
 * delivered order (handoff 222).
 */
export type StoreCreditTransactionKind = "grant" | "adjust" | "refund_credit" | "redeem" | "hold" | "release" | "refund" | "referral";

/** One change of a balance; `amount` is signed ("-15000" for a spend). */
export interface StoreCreditTransaction {
  id: string;
  kind: StoreCreditTransactionKind;
  amount: string;
  balanceAfter: string;
  currency: string;
  orderId: string | null;
  /** Staff's reason on `grant`, `adjust` and `refund_credit`; the system's own remark otherwise (not for display). */
  note: string | null;
  createdAt: string;
}

export interface StoreCreditAccount {
  balance: string;
  currency: string;
  /** Newest first. */
  history: StoreCreditTransaction[];
}

/** The longest note the API takes with a change of balance. */
export const STORE_CREDIT_NOTE_MAX = 200;
/** The most one change may add or take, minor units. */
export const STORE_CREDIT_ADJUST_MAX = 100_000_000;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/store-credit`;

export function storeCreditList(client: ApiClient, workspaceId: string): Promise<StoreCreditOverview> {
  return client.request<StoreCreditOverview>(base(workspaceId));
}

export function storeCreditSettingsSave(client: ApiClient, workspaceId: string, enabled: boolean): Promise<{ spendingEnabled: boolean }> {
  return client.request<{ spendingEnabled: boolean }>(`${base(workspaceId)}/settings`, { method: "PUT", body: { enabled } });
}

export function storeCreditCustomerGet(client: ApiClient, workspaceId: string, customerId: string): Promise<StoreCreditAccount> {
  return client.request<StoreCreditAccount>(`${base(workspaceId)}/customers/${customerId}`);
}

/** Adds (positive) or takes (negative) credit; `note` is required. */
export function storeCreditCustomerAdjust(
  client: ApiClient,
  workspaceId: string,
  customerId: string,
  body: { amount: number; note: string }
): Promise<{ balance: string; applied: string }> {
  return client.request<{ balance: string; applied: string }>(`${base(workspaceId)}/customers/${customerId}/adjust`, {
    method: "POST",
    body,
  });
}

export interface StoreCreditRefund {
  refund: { id: string; amount: string; status: "processed"; reason: string };
  /** The customer's credit after it. */
  balance: string;
}

/** Refunds part of an order onto its customer's store credit instead of as money. */
export function storeCreditRefundOrder(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  body: { amount: number; reason: string }
): Promise<StoreCreditRefund> {
  return client.request<StoreCreditRefund>(`${base(workspaceId)}/orders/${orderId}/refund`, {
    method: "POST",
    body,
  });
}

// ----------------------------------------------------------- storefront --

export interface ShopperStoreCredit extends StoreCreditAccount {
  spendingEnabled: boolean;
}

/** The signed-in shopper's credit (last 50 changes). */
export function shopperStoreCredit(client: ApiClient, workspaceRef: string, token: string): Promise<ShopperStoreCredit> {
  return client.request<ShopperStoreCredit>(`/store/${workspaceRef}/account/store-credit`, {
    auth: false,
    headers: { "X-Shopper-Token": token },
  });
}

/** What the checkout's 201 adds when the shopper asked to use their credit. */
export interface StoreCreditRedemption {
  applied: boolean;
  /** True with an online payment: held until the gateway is paid, given back if it never is. */
  held?: boolean;
  /** What the credit paid, minor units. */
  amount?: string;
  /** Credit left. */
  balance?: string;
  currency?: string;
  /** When not applied: "currency", "nothing_due", "error" or "covers_order_cod_unavailable". */
  reason?: string;
}

/** The checkout body's store-credit field (with the X-Shopper-Token header). */
export interface StoreCreditCheckoutFields {
  useStoreCredit?: boolean;
}

/**
 * Why a checkout refused the credit, when it was the reason: "signed_out",
 * "empty" (nothing left), "off" (the store stopped taking it), "bank_transfer", or null.
 */
export type StoreCreditRefusal = "signed_out" | "empty" | "off" | "bank_transfer";

export function storeCreditRefusalOf(err: unknown): StoreCreditRefusal | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === "STORE_CREDIT_EMPTY") return "empty";
  if (err.code === "STORE_CREDIT_OFF") return "off";
  // The other refusals carry their own code and name the field in `details`.
  const details = apiErrorDetails<unknown>(err);
  const named = Array.isArray(details) && details.some((d) => !!d && (d as { field?: unknown }).field === "useStoreCredit");
  if (!named) return null;
  if (err.code === "SHOPPER_NOT_SIGNED_IN") return "signed_out";
  return "bank_transfer";
}

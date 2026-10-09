/**
 * Pay later on account — net terms (backend: frontend-handoff item 229, src/modules/accountCredit).
 *
 * The store approves a customer to order now and pay later: a credit limit
 * (the most they may owe at once; null = no limit) and payment terms in days.
 * Such a customer, signed in, may check out with `paymentMethod: "on_account"`;
 * the team may also enter such an order for them. The order ships like cash on
 * delivery but nothing is collected at the door, and is due `paymentTermsDays`
 * after it is placed (`order.paymentDueAt`). The team records the payments as
 * they arrive.
 *
 * Dashboard, /workspaces/:ws/account-credit:
 *   GET  /customers/:customerId        (customers.view)   → OnAccountStatement (last 200 on-account orders)
 *   PUT  /customers/:customerId        (customers.manage) { enabled, creditLimit: minor units | null, paymentTermsDays: 0–365 (30) }
 *                                                         → OnAccountStatement
 *   GET  /?overdue=true                (customers.view)   → { customers: OnAccountCustomerRow[] } — approved customers, or
 *                                                           anyone with on-account orders; most overdue first, 500 at most
 *   POST /orders/:orderId/payments     (orders.manage)    { amount, reference?, paidAt? } → 201 OnAccountPaymentResult
 *        422 VALIDATION_ERROR on `amount` when more than is due; 409 NOT_ON_ACCOUNT; 409 ORDER_CANCELLED.
 *        The order turns `partially_paid` / `paid`.
 *
 * Storefront:
 *   GET /store/:ws/account/on-account (X-Shopper-Token; 401 SHOPPER_NOT_SIGNED_IN) → { enabled: false } or OnAccountStatement
 *   Checkout with `paymentMethod: "on_account"` and X-Shopper-Token, under the shopper's own phone:
 *        401 SHOPPER_NOT_SIGNED_IN, 422 VALIDATION_ERROR on `paymentMethod` (not approved, or another
 *        phone), 422 CREDIT_LIMIT_EXCEEDED { creditLimit, owed, available }. See onAccountRefusalOf.
 *
 * Every amount is integer minor units, sent as a string.
 */
import { ApiError, type ApiClient } from "../client";
import { apiErrorDetails, apiFieldProblems } from "../errors";
import type { FinancialState } from "../types";

/** `orders.payment_method` of an order paid later on account (`PaymentMethod` in types.ts predates it). */
export const ON_ACCOUNT_METHOD = "on_account";

/** One on-account order of a statement. */
export interface OnAccountOrder {
  id: string;
  orderNumber: string;
  totalAmount: string;
  amountPaid: string;
  /** Total − paid, never below zero. */
  due: string;
  currency: string;
  financialState: FinancialState;
  paymentDueAt: string | null;
  /** Past its due date with something left to pay. */
  overdue: boolean;
  createdAt: string;
}

export interface OnAccountStatement {
  /** Whether the store lets this customer pay later. Off does not erase what they still owe. */
  enabled: boolean;
  /** The most they may owe at once; null = no limit. */
  creditLimit: string | null;
  /** null until the store sets terms for this customer. */
  paymentTermsDays: number | null;
  owed: string;
  overdue: string;
  /** Limit − owed, never below zero; null when there is no limit. */
  available: string | null;
  /** Newest first; cancelled and test orders are left out. */
  orders: OnAccountOrder[];
}

/** One line of the «حسابات الآجل» list. */
export interface OnAccountCustomerRow {
  id: string;
  fullName: string | null;
  companyName: string | null;
  creditLimit: string | null;
  paymentTermsDays: number | null;
  owed: string;
  overdue: string;
  /** The earliest due date among their unpaid orders. */
  nextDueAt: string | null;
}

/** What the API accepts (accountCredit/index.js). */
export const ON_ACCOUNT_LIMITS = {
  termsDaysMax: 365,
  termsDaysDefault: 30,
  /** Minor units. */
  creditLimitMax: 1e13,
  referenceMax: 120,
  /** The list answers this many customers at most. */
  listCap: 500,
} as const;

export interface OnAccountSettingsInput {
  enabled: boolean;
  /** Minor units; null = no limit. */
  creditLimit: number | null;
  paymentTermsDays: number;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/account-credit`;

export function onAccountStatementGet(client: ApiClient, workspaceId: string, customerId: string): Promise<OnAccountStatement> {
  return client.request<OnAccountStatement>(`${base(workspaceId)}/customers/${customerId}`);
}

export function onAccountSettingsSave(
  client: ApiClient,
  workspaceId: string,
  customerId: string,
  body: OnAccountSettingsInput
): Promise<OnAccountStatement> {
  return client.request<OnAccountStatement>(`${base(workspaceId)}/customers/${customerId}`, { method: "PUT", body });
}

/** Every approved customer (and anyone with on-account orders) with what they owe; `overdue` keeps only those who are late. */
export async function onAccountCustomersList(
  client: ApiClient,
  workspaceId: string,
  opts: { overdue?: boolean } = {}
): Promise<OnAccountCustomerRow[]> {
  const { customers } = await client.request<{ customers: OnAccountCustomerRow[] }>(`${base(workspaceId)}${opts.overdue ? "?overdue=true" : ""}`);
  return customers;
}

export interface OnAccountPaymentInput {
  /** Minor units, at most what is still due. */
  amount: number;
  /** The transfer or cheque number, ≤ 120 characters. */
  reference?: string;
  /** ISO date-time, not in the future; now when left out. */
  paidAt?: string;
}

export interface OnAccountPaymentResult {
  paymentId: string;
  /** The order's paid amount and what is left after this payment. */
  amountPaid: string;
  due: string;
}

/** A payment arrived for an on-account order (bank transfer, cheque…). */
export function onAccountPaymentRecord(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  body: OnAccountPaymentInput
): Promise<OnAccountPaymentResult> {
  return client.request<OnAccountPaymentResult>(`${base(workspaceId)}/orders/${orderId}/payments`, { method: "POST", body });
}

// --------------------------------------------------------------- orders --

/** The field item 229 adds to an order (GET one and the list). */
export interface OrderOnAccountFields {
  /** When an on-account order is due; null for every other order. */
  paymentDueAt?: string | null;
}

export function isOnAccountOrder(order: { paymentMethod?: string | null } | null | undefined): boolean {
  return order?.paymentMethod === ON_ACCOUNT_METHOD;
}

/** An on-account order's due date, or null. */
export function orderPaymentDueAt(order: object | null | undefined): string | null {
  const value = (order as OrderOnAccountFields | null | undefined)?.paymentDueAt;
  return typeof value === "string" && value ? value : null;
}

// ----------------------------------------------------------- storefront --

/** `{ enabled: false }` for a shopper the store never approved and who has no on-account orders. */
export type ShopperOnAccount = OnAccountStatement | { enabled: false; orders?: undefined };

export function shopperOnAccount(client: ApiClient, workspaceRef: string, token: string): Promise<ShopperOnAccount> {
  return client.request<ShopperOnAccount>(`/store/${workspaceRef}/account/on-account`, {
    auth: false,
    headers: { "X-Shopper-Token": token },
  });
}

/** The statement of an answer, or null when the shopper has no account balance to show. */
export function shopperOnAccountStatement(answer: ShopperOnAccount | null | undefined): OnAccountStatement | null {
  return answer && Array.isArray(answer.orders) ? (answer as OnAccountStatement) : null;
}

/**
 * Why a checkout sent with `paymentMethod: "on_account"` was refused, when that was the reason:
 *   "signed_out"  401 SHOPPER_NOT_SIGNED_IN — no (or an expired) shopper token;
 *   "not_open"    422 on `paymentMethod` — the store has not approved this account, or the order
 *                 is under another phone than the account's;
 *   "limit"       422 CREDIT_LIMIT_EXCEEDED, with the limit, what is owed and what is left.
 * null for anything else. Ask it only about an order that was sent as on_account.
 */
export type OnAccountRefusal =
  | { kind: "signed_out" }
  | { kind: "not_open" }
  | { kind: "limit"; creditLimit: string | null; owed: string | null; available: string | null };

export function onAccountRefusalOf(err: unknown): OnAccountRefusal | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === "CREDIT_LIMIT_EXCEEDED") {
    const details = apiErrorDetails<{ creditLimit?: unknown; owed?: unknown; available?: unknown }>(err);
    const text = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : null);
    return { kind: "limit", creditLimit: text(details?.creditLimit), owed: text(details?.owed), available: text(details?.available) };
  }
  if (err.code === "SHOPPER_NOT_SIGNED_IN") {
    // Points and store credit name their own field when they are what the sign-in was needed for.
    const details = apiErrorDetails<unknown>(err);
    const named = Array.isArray(details) && details.some((d) => !!d && typeof (d as { field?: unknown }).field === "string");
    return named ? null : { kind: "signed_out" };
  }
  if (apiFieldProblems(err).some((p) => p.field === "paymentMethod")) return { kind: "not_open" };
  return null;
}

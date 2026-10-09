/**
 * The store's own ZIMOS subscription (backend handoff items 333–336, 397):
 * the plans on offer and changing plan, trying a referral code, charges,
 * paying by a transfer proof, and the prepaid balance of the pay-per-order
 * plan. Everything is Bearer + `billing.manage`; amounts are integer minor
 * units and the dashboard never sends a price.
 *
 *   GET  /workspaces/:ws/billing/plans
 *   POST /workspaces/:ws/billing/code-preview            { code }
 *   GET  /workspaces/:ws/billing/invoices?page&pageSize
 *   POST /workspaces/:ws/billing/plan                    { planId, billingCycle? }
 *   POST /workspaces/:ws/start-trial                     { planId? }
 *   GET  /workspaces/:ws/billing/payment-methods
 *   POST /workspaces/:ws/billing/invoices/open
 *   POST /workspaces/:ws/billing/invoices/:id/payment-proofs   multipart
 *   GET  /workspaces/:ws/billing/payment-proofs
 *   POST /workspaces/:ws/billing/payments                { lang, method? }
 *   POST /workspaces/:ws/billing/pay-per-order
 *   GET  /workspaces/:ws/billing/wallet
 *   GET  /workspaces/:ws/billing/wallet/ledger?page&pageSize
 *   POST /workspaces/:ws/billing/wallet/topups           multipart
 */
import type { ApiClient } from "../client";
import type { BillingCycle, OnlinePayment, PlanFeatureKey, ReferralDiscountType, SubscriptionStatus } from "../types";

export interface BillingPrice {
  gross: number;
  /** What the referral code takes off. */
  discount: number;
  net: number;
}
export type BillingPlanPrices = Record<BillingCycle, BillingPrice>;

export interface BillingPlanOffer {
  id: string;
  name: string;
  currency: string;
  monthlyPrice: number;
  yearlyPrice: number;
  trialDays: number;
  maxStores: number | null;
  maxFunnelsPerMonth: number | null;
  softOrderQuota: number | null;
  features: PlanFeatureKey[];
  isCurrent: boolean;
  /** False: the store's own private plan — shown, never chosen. */
  isPublic: boolean;
  prices: BillingPlanPrices;
}

export interface BillingCodeView {
  code: string;
  discountType: ReferralDiscountType;
  discountValue: number | null;
  discountCurrency: string | null;
  active: boolean;
}

export interface BillingPayPerOrder {
  /** The card can be chosen now. */
  available: boolean;
  /** The store is on it. */
  current: boolean;
  plan: { id: string; name: string; fee: number; currency: string } | null;
}

export interface BillingPlans {
  subscription: {
    status: SubscriptionStatus;
    billingCycle: BillingCycle;
    planId: string | null;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    draft: boolean;
  };
  trial: { available: boolean; used: boolean };
  /** `immediate`: POST /billing/plan works. `support`: a paid subscription changes through support. */
  planChange: "immediate" | "support";
  referralCode: BillingCodeView | null;
  plans: BillingPlanOffer[];
  payPerOrder?: BillingPayPerOrder;
}

export interface BillingCodePreview {
  code: BillingCodeView;
  plans: Array<{ planId: string; prices: BillingPlanPrices }>;
}

export interface BillingInvoice {
  /** `next` while the charge is not written yet. */
  id: string;
  status: "pending" | "paid" | "failed";
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  discountAmount: number;
  amountDue: number;
  amountPaid: number | null;
  currency: string;
  paidAt: string | null;
  paymentSource: string | null;
  createdAt: string | null;
}

export interface BillingInvoicePage {
  invoices: BillingInvoice[];
  page: number;
  pageSize: number;
  total: number;
}

export interface BillingText {
  ar: string | null;
  en: string | null;
}

export interface BillingPaymentMethod {
  code: string;
  kind: "manual" | "gateway";
  label: { ar: string; en: string };
  /** Manual methods only. */
  accountNumber?: string | null;
  paymentLink?: string | null;
  note?: BillingText | null;
}

export interface BillingPaymentMethods {
  methods: BillingPaymentMethod[];
  currency: string;
  /** No way to pay: send the merchant to support. */
  contactSupport: boolean;
}

export interface BillingOpenInvoice {
  invoice: BillingInvoice;
  created: boolean;
  written: boolean;
  methods: BillingPaymentMethod[];
}

export interface BillingPaymentProof {
  id: string;
  purpose: "invoice" | "topup";
  invoiceId: string | null;
  method: { code: string; label: { ar: string; en: string } };
  senderPhone: string;
  amount: number;
  currency: string;
  status: "pending" | "approved" | "rejected";
  /** The console's note, set only on a rejected one. */
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export type BillingWalletPhase = "ok" | "low" | "overdraft" | "exhausted";

/** The balance as GET /workspaces/:ws/access carries it. */
export interface BillingWalletState {
  phase: BillingWalletPhase;
  /** May be negative, down to `-overdraft`. */
  balance: number;
  fee: number | null;
  ordersLeft: number | null;
  ordersBeforeOverdraft: number | null;
  overdraft: number;
  currency: string;
}

export interface BillingWallet extends BillingWalletState {
  /** WALLET_ENABLED on the server. */
  enabled: boolean;
  /** The store is on the pay-per-order plan. */
  onFeePlan: boolean;
  totalToppedUp: number;
  month: { fees: number; orders: number; timeZone: string };
  limits: { minTopup: number; maxTopup: number; maxOpenTopups: number; lowOrders: number };
}

export type BillingLedgerType = "topup" | "order_fee" | "order_fee_reversal" | "order_fee_recharge";

export interface BillingLedgerEntry {
  id: string;
  type: BillingLedgerType | (string & {});
  /** Signed: a top-up or a returned fee is positive. */
  amount: number;
  balanceAfter: number;
  currency: string;
  orderId: string | null;
  orderNumber: string | null;
  paymentProofId: string | null;
  note: string | null;
  createdAt: string;
}

export interface BillingLedgerPage {
  entries: BillingLedgerEntry[];
  page: number;
  pageSize: number;
  total: number;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/billing`;

/** ApiClient.rawFetch is private to the class (multipart needs it); reached through one typed cast, like storeFonts.ts. */
function rawFetch(client: ApiClient, path: string, init: RequestInit): Promise<Response> {
  return (client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> }).rawFetch(path, init);
}

export function billingPlansGet(client: ApiClient, workspaceId: string): Promise<BillingPlans> {
  return client.request<BillingPlans>(`${base(workspaceId)}/plans`);
}

/** Prices with a code taken off. Attaches nothing. 422 REFERRAL_CODE_INVALID, 409 SELF_REFERRAL, 429 RATE_LIMITED. */
export function billingCodePreview(client: ApiClient, workspaceId: string, code: string): Promise<BillingCodePreview> {
  return client.request<BillingCodePreview>(`${base(workspaceId)}/code-preview`, { method: "POST", body: { code } });
}

export function billingInvoicesList(client: ApiClient, workspaceId: string, page = 1, pageSize = 20): Promise<BillingInvoicePage> {
  return client.request<BillingInvoicePage>(`${base(workspaceId)}/invoices?page=${page}&pageSize=${pageSize}`);
}

/** A draft or a trial moves plan at once. 409 PLAN_CHANGE_NEEDS_SUPPORT, OPEN_CHARGE_EXISTS; 422 PLAN_NOT_AVAILABLE. */
export function billingPlanChange(
  client: ApiClient,
  workspaceId: string,
  planId: string,
  billingCycle?: BillingCycle
): Promise<{ changed: boolean; plans: BillingPlans }> {
  return client.request<{ changed: boolean; plans: BillingPlans }>(`${base(workspaceId)}/plan`, {
    method: "POST",
    body: billingCycle ? { planId, billingCycle } : { planId },
  });
}

/** A draft starts the free trial of the plan it picks. 409 TRIAL_NOT_AVAILABLE { reason: used | no_trial }. */
export async function billingStartTrialOnPlan(client: ApiClient, workspaceId: string, planId: string): Promise<void> {
  await client.request<unknown>(`/workspaces/${workspaceId}/start-trial`, { method: "POST", body: { planId } });
}

export function billingPaymentMethodsGet(client: ApiClient, workspaceId: string): Promise<BillingPaymentMethods> {
  return client.request<BillingPaymentMethods>(`${base(workspaceId)}/payment-methods`);
}

/** What is due and how to pay it. Writes nothing. 409 NO_PAYMENT_METHOD, NO_PLAN, PLAN_IS_FREE, MANUAL_PRICING. */
export function billingInvoiceOpen(client: ApiClient, workspaceId: string): Promise<BillingOpenInvoice> {
  return client.request<BillingOpenInvoice>(`${base(workspaceId)}/invoices/open`, { method: "POST" });
}

export interface BillingProofInput {
  methodCode: string;
  senderPhone: string;
  file: File;
}

/** The transfer's screenshot for a charge (`invoiceId` = `next` or a charge id). `expectedAmount` is only compared. */
export async function billingInvoiceProofSend(
  client: ApiClient,
  workspaceId: string,
  invoiceId: string,
  input: BillingProofInput & { expectedAmount: number }
): Promise<BillingPaymentProof> {
  const form = new FormData();
  form.append("methodCode", input.methodCode);
  form.append("senderPhone", input.senderPhone);
  form.append("expectedAmount", String(input.expectedAmount));
  form.append("file", input.file, input.file.name);
  const res = await rawFetch(client, `${base(workspaceId)}/invoices/${encodeURIComponent(invoiceId)}/payment-proofs`, {
    method: "POST",
    body: form,
  });
  const body = (await res.json()) as { proof: BillingPaymentProof };
  return body.proof;
}

/** The latest 20 proofs, newest first. */
export async function billingProofsList(client: ApiClient, workspaceId: string): Promise<BillingPaymentProof[]> {
  const { proofs } = await client.request<{ proofs: BillingPaymentProof[] }>(`${base(workspaceId)}/payment-proofs`);
  return proofs ?? [];
}

/** Pay online through one of the listed gateways. 404 PAYMENT_METHOD_NOT_AVAILABLE. */
export function billingPayOnline(
  client: ApiClient,
  workspaceId: string,
  lang: "ar" | "en",
  method: string
): Promise<{ payment: OnlinePayment; reused: boolean }> {
  return client.request<{ payment: OnlinePayment; reused: boolean }>(`${base(workspaceId)}/payments`, {
    method: "POST",
    body: { lang, method },
  });
}

/** A draft or a trial moves to pay per order. 409 PLAN_CHANGE_NEEDS_SUPPORT, OPEN_CHARGE_EXISTS; 404 WALLET_DISABLED. */
export function billingPayPerOrderChoose(client: ApiClient, workspaceId: string): Promise<{ changed: boolean }> {
  return client.request<{ changed: boolean }>(`${base(workspaceId)}/pay-per-order`, { method: "POST" });
}

export async function billingWalletGet(client: ApiClient, workspaceId: string): Promise<BillingWallet> {
  const { wallet } = await client.request<{ wallet: BillingWallet }>(`${base(workspaceId)}/wallet`);
  return wallet;
}

export function billingWalletLedger(client: ApiClient, workspaceId: string, page = 1, pageSize = 20): Promise<BillingLedgerPage> {
  return client.request<BillingLedgerPage>(`${base(workspaceId)}/wallet/ledger?page=${page}&pageSize=${pageSize}`);
}

/** A top-up's screenshot. 422 TOPUP_AMOUNT_OUT_OF_RANGE { min, max, currency }; 409 TOO_MANY_OPEN_TOPUPS. */
export async function billingWalletTopup(
  client: ApiClient,
  workspaceId: string,
  input: BillingProofInput & { requestedAmount: number }
): Promise<BillingPaymentProof> {
  const form = new FormData();
  form.append("requestedAmount", String(input.requestedAmount));
  form.append("methodCode", input.methodCode);
  form.append("senderPhone", input.senderPhone);
  form.append("file", input.file, input.file.name);
  const res = await rawFetch(client, `${base(workspaceId)}/wallet/topups`, { method: "POST", body: form });
  const body = (await res.json()) as { proof: BillingPaymentProof };
  return body.proof;
}

/** `access.wallet` of GET /workspaces/:ws/access: null when the store pays no fee per order. */
export function accessWalletOf(access: object | null | undefined): BillingWalletState | null {
  const wallet = (access as { wallet?: BillingWalletState | null } | null | undefined)?.wallet;
  return wallet && typeof wallet === "object" ? wallet : null;
}

/** Whether the store stopped taking orders because its balance ran out (`reasons` holds `balance`). */
export function accessStoppedByBalance(access: object | null | undefined): boolean {
  const reasons = (access as { reasons?: unknown } | null | undefined)?.reasons;
  return Array.isArray(reasons) && reasons.includes("balance");
}

/** `zimosPerOrderFee` of GET /profit/pnl (item 397): set while the store pays per order. */
export function profitPerOrderFeeOf(pnl: object | null | undefined): { amount: number; currency: string } | null {
  const fee = (pnl as { zimosPerOrderFee?: { amount: number; currency: string } | null } | null | undefined)?.zimosPerOrderFee;
  return fee && typeof fee.amount === "number" ? fee : null;
}

/** `details` of a 403 PLAN_FEATURE_REQUIRED. */
export interface PlanFeatureRequiredDetails {
  feature: string;
  label: { en: string; ar: string };
}

/**
 * A held renewal of a customer's subscription (item 394): it failed for the
 * store's reason, the customer is not told, it is retried and lapses on `lapsesAt`.
 */
export type RenewalHoldCause =
  | "gateway_connection"
  | "gateway_unavailable"
  | "out_of_stock"
  | "product_unavailable"
  | "store_unavailable"
  | "plan_limit"
  | "wallet"
  | "platform_error";

export interface RenewalHold {
  cause: RenewalHoldCause | (string & {});
  reason: string | null;
  since: string;
  tries: number;
  lapsesAt: string;
  orderId: string | null;
  outcomeUnknown: boolean;
}

/** `renewalHold` of a customer subscription row; null when its renewal is not held. */
export function renewalHoldOf(subscription: object): RenewalHold | null {
  const hold = (subscription as { renewalHold?: RenewalHold | null }).renewalHold;
  return hold && typeof hold === "object" ? hold : null;
}

/** `cancelReason` of a customer subscription row (`renewal_on_hold`: it lapsed while held). */
export function subscriptionCancelReasonOf(subscription: object): string | null {
  return (subscription as { cancelReason?: string | null }).cancelReason ?? null;
}

/** `onHold` of the subscriptions overview: how many renewals are held. */
export function subscriptionsOnHoldOf(overview: object | null | undefined): number {
  const n = (overview as { onHold?: number } | null | undefined)?.onHold;
  return typeof n === "number" ? n : 0;
}

/**
 * Platform console: the feature catalogue, the platform's own payment methods,
 * merchants' transfer proofs, a store's prepaid balance and manual pricing
 * (backend handoff items 333–336).
 *
 *   GET   /admin/plans                              plans.view     → { plans, featureCatalog }
 *   GET   /admin/subscriptions                      subscriptions.view → rows + mrr + paidOnly
 *   GET   /admin/payment-methods                    payments.record
 *   PATCH /admin/payment-methods/:code              payment_methods.manage
 *   PUT   /admin/payment-methods/order              payment_methods.manage
 *   PATCH /admin/payment-methods/:code/account      payment_methods.edit_numbers
 *   GET   /admin/payment-proofs?status&page&pageSize   payments.record
 *   GET   /admin/payment-proofs/:id                 payments.record
 *   POST  /admin/payment-proofs/:id/approve         { receivedAmount }
 *   POST  /admin/payment-proofs/:id/reject          { note }
 *   GET   /admin/workspaces/:ws/wallet?page&pageSize   subscriptions.view
 */
import type { ApiClient } from "../client";
import type { AdminPlan, AdminSubscription } from "../types";
import type { BillingLedgerPage, BillingWallet } from "./merchantBilling";

export interface AdminFeatureCatalogEntry {
  key: string;
  type: "boolean";
  /** False: not built yet, so it can't be added to a plan. */
  available: boolean;
  label: { en: string; ar: string };
}

/** A plan with its fee per order (minor units; 0 = none). */
export type AdminPlanWithFee = AdminPlan & { perOrderFee?: number };

export interface AdminPlansCatalog {
  plans: AdminPlanWithFee[];
  featureCatalog: AdminFeatureCatalogEntry[];
}

/** Plans in the pricing page's order, with the feature catalogue to tick from. */
export async function adminPlansCatalog(client: ApiClient): Promise<AdminPlansCatalog> {
  const body = await client.request<Partial<AdminPlansCatalog>>("/admin/plans");
  return { plans: body.plans ?? [], featureCatalog: body.featureCatalog ?? [] };
}

/** Sets a plan's fee per order. 422 PER_ORDER_FEE_NOT_ALLOWED (field `perOrderFee`). */
export async function adminPlanSetPerOrderFee(client: ApiClient, planId: string, perOrderFee: number): Promise<AdminPlanWithFee> {
  const { plan } = await client.request<{ plan: AdminPlanWithFee }>(`/admin/plans/${planId}`, { method: "PATCH", body: { perOrderFee } });
  return plan;
}

export type AdminPricingKind = "paid" | "free" | "discounted";

/** What a manually priced subscription adds to a subscription row or summary. */
export interface AdminManualPricing {
  pricingKind: AdminPricingKind;
  /** 1–99, only on a discounted one. */
  discountPercent: number | null;
  /** A fixed price per billing period, only on a discounted one. */
  priceOverrideAmount: number | null;
  /** One billing period as the merchant pays it (0 when free). */
  effectivePrice: number;
  currency?: string;
  /** When a free or discounted period ran out. */
  pricingExpiredAt: string | null;
}

/** The manual pricing fields of a subscription row or summary; `paid` when the server sent none. */
export function adminPricingOf(subscription: object): AdminManualPricing {
  const s = subscription as Partial<AdminManualPricing>;
  return {
    pricingKind: s.pricingKind ?? "paid",
    discountPercent: s.discountPercent ?? null,
    priceOverrideAmount: s.priceOverrideAmount ?? null,
    effectivePrice: s.effectivePrice ?? 0,
    currency: s.currency,
    pricingExpiredAt: s.pricingExpiredAt ?? null,
  };
}

export interface AdminMrrTotals {
  mrr: number;
  mrrCurrency: string | null;
  mrrByCurrency: Record<string, number>;
}

export interface AdminSubscriptionsWithTotals extends AdminMrrTotals {
  subscriptions: Array<AdminSubscription & Partial<AdminManualPricing> & { mrrCurrency?: string | null }>;
  /** The same total over paid rows only. */
  paidOnly: AdminMrrTotals;
}

export async function adminSubscriptionsWithTotals(client: ApiClient): Promise<AdminSubscriptionsWithTotals> {
  const body = await client.request<Partial<AdminSubscriptionsWithTotals>>("/admin/subscriptions");
  const totals: AdminMrrTotals = { mrr: body.mrr ?? 0, mrrCurrency: body.mrrCurrency ?? null, mrrByCurrency: body.mrrByCurrency ?? {} };
  return { subscriptions: body.subscriptions ?? [], ...totals, paidOnly: body.paidOnly ?? totals };
}

export interface AdminPaymentMethod {
  id: string;
  code: string;
  kind: "manual" | "gateway";
  labelAr: string;
  labelEn: string;
  sortOrder: number;
  enabled: boolean;
  /** Manual methods. */
  accountNumber?: string | null;
  paymentLink?: string | null;
  noteAr?: string | null;
  noteEn?: string | null;
  /** Gateways: `missing` holds environment variable names only. */
  gateway?: { name: string; adapterInstalled: boolean; configured: boolean; missing: string[]; currencies: string[] };
  /** Whether merchants are shown it now. */
  offered: boolean;
  updatedAt: string;
}

export interface AdminGatewayNotAdded {
  code: string;
  name: string;
  configured: boolean;
  missing: string[];
  currencies: string[];
}

export interface AdminPaymentMethods {
  methods: AdminPaymentMethod[];
  gatewaysNotAdded: AdminGatewayNotAdded[];
}

export function adminPaymentMethodsList(client: ApiClient): Promise<AdminPaymentMethods> {
  return client.request<AdminPaymentMethods>("/admin/payment-methods");
}

/** Turns a method on or off, or renames it. 409 PAYMENT_METHOD_NEEDS_NUMBER. Turning on a gateway not added yet adds it. */
export async function adminPaymentMethodUpdate(
  client: ApiClient,
  code: string,
  body: { enabled?: boolean; labelAr?: string; labelEn?: string }
): Promise<AdminPaymentMethod> {
  const { method } = await client.request<{ method: AdminPaymentMethod }>(`/admin/payment-methods/${encodeURIComponent(code)}`, {
    method: "PATCH",
    body,
  });
  return method;
}

export function adminPaymentMethodsReorder(client: ApiClient, codes: string[]): Promise<AdminPaymentMethods> {
  return client.request<AdminPaymentMethods>("/admin/payment-methods/order", { method: "PUT", body: { codes } });
}

/** The number merchants send money to. `""` clears a field. 422 VALIDATION_ERROR (paymentLink not https), 409 PAYMENT_METHOD_NEEDS_NUMBER. */
export async function adminPaymentMethodAccount(
  client: ApiClient,
  code: string,
  body: { accountNumber?: string; paymentLink?: string | null; noteAr?: string; noteEn?: string }
): Promise<AdminPaymentMethod> {
  const { method } = await client.request<{ method: AdminPaymentMethod }>(
    `/admin/payment-methods/${encodeURIComponent(code)}/account`,
    { method: "PATCH", body }
  );
  return method;
}

export type AdminProofStatus = "pending" | "approved" | "rejected";

export interface AdminPaymentProof {
  id: string;
  purpose: "invoice" | "topup";
  workspace: { id: string; name: string; slug: string };
  invoiceId: string | null;
  method: { code: string; labelAr: string; labelEn: string };
  /** The platform number the merchant was told to send to. */
  receivingNumber: string | null;
  senderPhone: string;
  requestedAmount: number;
  receivedAmount: number | null;
  currency: string;
  status: AdminProofStatus;
  reviewNote: string | null;
  reviewedBy: { id: string; fullName: string } | null;
  reviewedAt: string | null;
  submittedBy: { id: string; fullName: string; email: string } | null;
  createdAt: string;
}

export interface AdminPaymentProofPage {
  proofs: AdminPaymentProof[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminPaymentProofDetail {
  proof: AdminPaymentProof;
  /** Null for a top-up. */
  invoice: { id: string; status: string; amountDue: number; currency: string; periodStart: string; periodEnd: string; paidAt: string | null } | null;
  /** A top-up: the store's balance now. */
  wallet?: { balance: number; currency: string } | null;
  /** CHARGE_ALREADY_PAID, CHARGE_REPRICED. */
  approvalBlockers: string[];
  /** Works in an <img> without the token for 5 minutes. */
  image: { url: string; expiresAt: string; mime: string } | null;
  alreadyApproved?: boolean;
  alreadyRejected?: boolean;
}

export function adminPaymentProofsList(
  client: ApiClient,
  params: { status: AdminProofStatus | "all"; page?: number; pageSize?: number }
): Promise<AdminPaymentProofPage> {
  return client.request<AdminPaymentProofPage>(
    `/admin/payment-proofs?status=${params.status}&page=${params.page ?? 1}&pageSize=${params.pageSize ?? 20}`
  );
}

export function adminPaymentProofGet(client: ApiClient, proofId: string): Promise<AdminPaymentProofDetail> {
  return client.request<AdminPaymentProofDetail>(`/admin/payment-proofs/${proofId}`);
}

/** 422 RECEIVED_AMOUNT_MISMATCH (a charge), RECEIVED_AMOUNT_REQUIRED (a top-up); 409 CHARGE_ALREADY_PAID, CHARGE_REPRICED, PROOF_ALREADY_REVIEWED. */
export function adminPaymentProofApprove(client: ApiClient, proofId: string, receivedAmount: number): Promise<AdminPaymentProofDetail> {
  return client.request<AdminPaymentProofDetail>(`/admin/payment-proofs/${proofId}/approve`, { method: "POST", body: { receivedAmount } });
}

/** `note` (3–1000 characters) is read by the merchant. */
export function adminPaymentProofReject(client: ApiClient, proofId: string, note: string): Promise<AdminPaymentProofDetail> {
  return client.request<AdminPaymentProofDetail>(`/admin/payment-proofs/${proofId}/reject`, { method: "POST", body: { note } });
}

export interface AdminWorkspaceWallet {
  wallet: BillingWallet;
  ledger: BillingLedgerPage;
}

export function adminWorkspaceWallet(client: ApiClient, workspaceId: string, page = 1, pageSize = 20): Promise<AdminWorkspaceWallet> {
  return client.request<AdminWorkspaceWallet>(`/admin/workspaces/${workspaceId}/wallet?page=${page}&pageSize=${pageSize}`);
}

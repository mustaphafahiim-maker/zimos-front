/**
 * Manual transfers with a receipt image, and deposits on cash-on-delivery
 * orders (backend: src/modules/payments/manualTransferService.js).
 *
 * Staff side, mounted at /workspaces/:workspaceId/manual-transfers: settings
 * need workspace.manage; reading transfers needs orders.view; confirming or
 * rejecting needs orders.manage. Shopper side, under /store/:workspaceId:
 * the transfer methods arrive with the other payment methods
 * (getStorefrontPaymentMethods, `provider: "manual"`), and the functions below
 * ask for a deposit quote and place the order. All exported names in this file
 * are prefixed with `manualTransfer` / `ManualTransfer`.
 *
 * Notable codes: DEPOSIT_REQUIRED (422 — a COD checkout without `transfer` in
 * a store that asks for a deposit; details { amountType, fixedAmount }),
 * PAYMENT_METHOD_UNAVAILABLE (422), TRANSFER_ALREADY_REVIEWED (409),
 * VALIDATION_ERROR with fields `transfer.receiptUploadId` /
 * `transfer.senderReference`.
 */
import type { ApiClient } from "../client";

export interface ManualTransferMethod {
  id: string;
  /** "InstaPay", "Vodafone Cash", a bank's name. */
  name: string;
  /** What the shopper needs to pay: the wallet number, IPA or account. */
  instructions: string;
  requireReceipt: boolean;
  requireSender: boolean;
  enabled: boolean;
}

export interface ManualTransferDepositRule {
  enabled: boolean;
  /** The order's shipping fee, or a fixed amount. */
  amountType: "shipping" | "fixed";
  fixedAmount: number;
  /** Every shopper, or only known customers with a poor delivery record. */
  appliesTo: "all" | "risky";
  /** "Risky" = reliability score below this (1–100), or any rejected order. */
  maxReliabilityScore: number;
}

export interface ManualTransferSettings {
  methods: ManualTransferMethod[];
  depositRule: ManualTransferDepositRule;
  limits: { maxMethods: number };
}

export interface ManualTransferSettingsPayload {
  /** Replaces the whole list; omit `id` for a new method. */
  methods?: (Omit<ManualTransferMethod, "id"> & { id?: string })[];
  depositRule?: Partial<ManualTransferDepositRule>;
}

export interface ManualTransferPayment {
  id: string;
  orderId: string;
  /** initialized = waiting for the merchant; captured = confirmed; failed = rejected. */
  status: "initialized" | "captured" | "failed" | "refunded" | "partially_refunded" | "cancelled" | "expired" | "authorized";
  purpose: "full" | "deposit";
  amount: number;
  currency: string;
  methodName: string | null;
  senderReference: string | null;
  /** A short-lived signed link to the receipt image. */
  receipt: { url: string; expiresAt: string } | null;
  failureReason: string | null;
  paidAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ManualTransferPending extends ManualTransferPayment {
  orderNumber: string;
  customerName: string | null;
  orderTotal: number;
}

/** A transfer method as the storefront receives it among the payment methods. */
export interface ManualTransferStoreMethod {
  /** `manual:<method id>` */
  id: string;
  provider: "manual";
  method: "bank_transfer";
  mode: "live";
  name: string;
  instructions: string;
  requireReceipt: boolean;
  requireSender: boolean;
}

export interface ManualTransferDepositQuote {
  required: boolean;
  amountType: "shipping" | "fixed" | null;
  fixedAmount: number | null;
  methods: ManualTransferStoreMethod[];
}

/** What a checkout sends for a transfer (whole order, or a COD deposit). */
export interface ManualTransferCheckoutDetails {
  methodId: string;
  receiptUploadId?: string | null;
  senderReference?: string | null;
}

/** Added to the checkout answer when a transfer was recorded. */
export interface ManualTransferCheckoutResult {
  id: string;
  status: "awaiting_review";
  purpose: "full" | "deposit";
  amount: number;
  currency: string;
  methodName: string;
}

// ------------------------------------------------------------------ staff --

const base = (workspaceId: string) => `/workspaces/${workspaceId}/manual-transfers`;

export async function manualTransferGetSettings(client: ApiClient, workspaceId: string): Promise<ManualTransferSettings> {
  const { settings } = await client.request<{ settings: ManualTransferSettings }>(`${base(workspaceId)}/settings`);
  return settings;
}

export async function manualTransferSaveSettings(
  client: ApiClient,
  workspaceId: string,
  payload: ManualTransferSettingsPayload
): Promise<ManualTransferSettings> {
  const { settings } = await client.request<{ settings: ManualTransferSettings }>(`${base(workspaceId)}/settings`, {
    method: "PUT",
    body: payload,
  });
  return settings;
}

export async function manualTransferListPending(client: ApiClient, workspaceId: string): Promise<ManualTransferPending[]> {
  const { transfers } = await client.request<{ transfers: ManualTransferPending[] }>(`${base(workspaceId)}/pending`);
  return transfers;
}

export async function manualTransferListForOrder(
  client: ApiClient,
  workspaceId: string,
  orderId: string
): Promise<ManualTransferPayment[]> {
  const { transfers } = await client.request<{ transfers: ManualTransferPayment[] }>(`${base(workspaceId)}/orders/${orderId}`);
  return transfers;
}

export async function manualTransferConfirm(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  paymentId: string
): Promise<ManualTransferPayment> {
  const { transfer } = await client.request<{ transfer: ManualTransferPayment }>(
    `${base(workspaceId)}/orders/${orderId}/payments/${paymentId}/confirm`,
    { method: "POST" }
  );
  return transfer;
}

export async function manualTransferReject(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  paymentId: string,
  reason?: string
): Promise<ManualTransferPayment> {
  const { transfer } = await client.request<{ transfer: ManualTransferPayment }>(
    `${base(workspaceId)}/orders/${orderId}/payments/${paymentId}/reject`,
    { method: "POST", body: { reason: reason || null } }
  );
  return transfer;
}

// ---------------------------------------------------------------- shopper --

/** Whether a cash-on-delivery order by this phone needs a deposit first. */
export async function manualTransferDepositQuote(
  client: ApiClient,
  workspaceId: string,
  phone: string
): Promise<ManualTransferDepositQuote> {
  const { deposit } = await client.request<{ deposit: ManualTransferDepositQuote }>(`/store/${workspaceId}/deposit-quote`, {
    method: "POST",
    body: { phone },
    auth: false,
  });
  return deposit;
}

import type { ApiClient } from "../client";
import type { ManualMethodKind, OrderManualPayment, StoreManualPaymentMethod } from "../types";

/**
 * A store's manual payment methods (InstaPay, a mobile wallet) and the review
 * of the proof a shopper sends for an order paid by one (backend
 * modules/manualPayments). The shopper's screenshot upload is
 * ApiClient.submitManualPaymentProof (multipart).
 */

export interface StoreManualPaymentMethodInput {
  kind?: ManualMethodKind;
  label?: string;
  /** InstaPay account / handle, or the wallet's phone number. Required on create. */
  accountNumber?: string;
  /** Optional; https only. Empty or null = no link. */
  paymentLink?: string | null;
  instructions?: string | null;
  active?: boolean;
  sortOrder?: number;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/manual-payments`;

export async function listManualPaymentMethods(client: ApiClient, workspaceId: string) {
  const res = await client.request<{ methods: StoreManualPaymentMethod[] }>(`${base(workspaceId)}/methods`);
  return res.methods;
}

export async function createManualPaymentMethod(client: ApiClient, workspaceId: string, body: StoreManualPaymentMethodInput) {
  const res = await client.request<{ method: StoreManualPaymentMethod }>(`${base(workspaceId)}/methods`, { method: "POST", body });
  return res.method;
}

export async function updateManualPaymentMethod(
  client: ApiClient,
  workspaceId: string,
  methodId: string,
  body: StoreManualPaymentMethodInput
) {
  const res = await client.request<{ method: StoreManualPaymentMethod }>(`${base(workspaceId)}/methods/${methodId}`, {
    method: "PATCH",
    body,
  });
  return res.method;
}

export async function deleteManualPaymentMethod(client: ApiClient, workspaceId: string, methodId: string) {
  await client.request<void>(`${base(workspaceId)}/methods/${methodId}`, { method: "DELETE" });
}

/** Saves the order of the list (every id of this store, in the new order). */
export async function reorderManualPaymentMethods(client: ApiClient, workspaceId: string, ids: string[]) {
  const res = await client.request<{ methods: StoreManualPaymentMethod[] }>(`${base(workspaceId)}/methods/order`, {
    method: "PUT",
    body: { ids },
  });
  return res.methods;
}

/** Marks the order paid (its own total). 409 unless a proof waits for review. */
export async function approveManualPayment(client: ApiClient, workspaceId: string, orderId: string) {
  const res = await client.request<{ manualPayment: OrderManualPayment }>(`${base(workspaceId)}/orders/${orderId}/approve`, {
    method: "POST",
    body: {},
  });
  return res.manualPayment;
}

/** The shopper sees the reason and may send a new proof. */
export async function rejectManualPayment(client: ApiClient, workspaceId: string, orderId: string, reason: string) {
  const res = await client.request<{ manualPayment: OrderManualPayment }>(`${base(workspaceId)}/orders/${orderId}/reject`, {
    method: "POST",
    body: { reason },
  });
  return res.manualPayment;
}

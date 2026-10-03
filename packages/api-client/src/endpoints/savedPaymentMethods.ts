/**
 * Saved payment methods (backend: src/modules/payments/savedMethods — the
 * tokenization contract is in its README.md).
 *
 * Mounted at /workspaces/:workspaceId/saved-payment-methods. Reading needs
 * orders.view; saving, charging and deleting need orders.manage. All exported
 * names in this file are prefixed with `savedMethods` / `SavedMethod`.
 *
 * Only a gateway that supports tokenization (today: the sandbox) has saved
 * methods. The gateway's token never leaves the server.
 *
 * Codes: TOKENIZATION_NOT_SUPPORTED (422), PAYMENT_NOT_PAID (409),
 * SAVED_METHOD_EXPIRED (409), SAVED_METHOD_MISMATCH (422),
 * SAVED_METHOD_DECLINED (422), ORDER_ALREADY_PAID (409).
 */
import type { ApiClient } from "../client";

export interface SavedMethod {
  id: string;
  customerId: string;
  provider: string;
  brand: string | null;
  last4: string | null;
  expiresAt: string | null;
  expired: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface SavedMethodsForOrder {
  customerId: string;
  /** The order's customer's saved cards. */
  saved: SavedMethod[];
  /** Paid payments of this order whose card can still be saved. */
  saveable: { paymentId: string; provider: string; maskedDisplay: string | null }[];
  /** What the order still owes (minor units); 0 when paid or cancelled. */
  outstandingAmount: number;
}

export interface SavedMethodCharge {
  paymentId: string;
  amount: number;
  currency: string;
  status: "captured";
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/saved-payment-methods`;

export async function savedMethodsForCustomer(client: ApiClient, workspaceId: string, customerId: string): Promise<SavedMethod[]> {
  const { methods } = await client.request<{ methods: SavedMethod[] }>(`${base(workspaceId)}/customers/${customerId}`);
  return methods;
}

export async function savedMethodsForOrder(client: ApiClient, workspaceId: string, orderId: string): Promise<SavedMethodsForOrder> {
  return client.request<SavedMethodsForOrder>(`${base(workspaceId)}/orders/${orderId}`);
}

/** Saves the card behind a paid payment for the order's customer. */
export async function savedMethodsSave(client: ApiClient, workspaceId: string, paymentId: string): Promise<SavedMethod> {
  const { method } = await client.request<{ method: SavedMethod }>(base(workspaceId), { method: "POST", body: { paymentId } });
  return method;
}

/** Charges what the order still owes to a saved card of its customer. */
export async function savedMethodsCharge(
  client: ApiClient,
  workspaceId: string,
  savedId: string,
  orderId: string
): Promise<SavedMethodCharge> {
  const { charge } = await client.request<{ charge: SavedMethodCharge }>(`${base(workspaceId)}/${savedId}/charge`, {
    method: "POST",
    body: { orderId },
  });
  return charge;
}

export async function savedMethodsDelete(client: ApiClient, workspaceId: string, savedId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/${savedId}`, { method: "DELETE" });
}

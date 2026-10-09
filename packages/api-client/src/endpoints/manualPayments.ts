/**
 * Store manual payments by InstaPay or wallet with a screenshot proof
 * (backend: frontend-handoff item 340, src/modules/manualPayments).
 *
 * A second kind of manual payment beside the receipt transfer
 * (endpoints/manualTransfers.ts): the merchant lists InstaPay accounts and
 * wallet numbers, the shopper picks one at checkout, the order is placed
 * unpaid, and they send the number they paid from and a screenshot afterwards.
 * Staff approve or reject it; until then the order can't be confirmed.
 *
 * Dashboard, /workspaces/:ws/manual-payments:
 *   GET    /methods                      (workspace.manage) → { methods }
 *   POST   /methods                      → 201 { method }   422 on accountNumber / paymentLink / label / kind;
 *                                          409 TOO_MANY_PAYMENT_METHODS (50 per store)
 *   PATCH  /methods/:id                  → { method }
 *   DELETE /methods/:id                  → 204
 *   PUT    /methods/order { ids }        → { methods }
 *   GET    /orders/:orderId              (orders.view)   → { manualPayment | null }
 *   POST   /orders/:orderId/approve      (orders.manage) → { manualPayment }
 *   POST   /orders/:orderId/reject { reason }            → { manualPayment }
 *          409 MANUAL_PAYMENT_NOT_SUBMITTED | NO_MANUAL_PAYMENT | ORDER_CANCELLED
 *   Confirming such an order before approval: 409 MANUAL_PAYMENT_NOT_APPROVED.
 *
 * Storefront (no login), /store/:ws:
 *   GET  /payment-methods                → one entry per active method (`provider: "store_method"`)
 *   POST /checkout { paymentMethod: "bank_transfer", manualPaymentMethodId } → the order, `manualPayment`, `paymentToken`
 *   GET  /orders/:orderId/manual-payment           (X-Payment-Token) → { manualPayment }
 *   POST /orders/:orderId/manual-payment/proof     (X-Payment-Token, multipart: payerNumber, file) → 201 { manualPayment }
 *
 * Amounts are integer minor units. All exported names are prefixed `manualPayment` / `ManualPayment`.
 */
import type { ApiClient } from "../client";
import type { StorefrontPaymentMethod } from "../types";

export type ManualPaymentKind = "instapay" | "wallet";

export interface ManualPaymentMethod {
  id: string;
  kind: ManualPaymentKind;
  label: string;
  accountNumber: string;
  paymentLink: string | null;
  instructions: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManualPaymentMethodPayload {
  kind: ManualPaymentKind;
  label: string;
  accountNumber: string;
  /** https only; "" or null = none. */
  paymentLink?: string | null;
  instructions?: string | null;
  active?: boolean;
  sortOrder?: number;
}

/** awaiting_proof → submitted → approved | rejected (the shopper may send again after a rejection). */
export type ManualPaymentStatus = "awaiting_proof" | "submitted" | "approved" | "rejected";

/** An order's manual payment as staff see it. */
export interface ManualPaymentReview {
  id: string;
  status: ManualPaymentStatus;
  awaitingReview: boolean;
  kind: ManualPaymentKind;
  label: string;
  accountNumber: string;
  paymentLink: string | null;
  /** A phone as digits with the country code, or an InstaPay handle. */
  payerNumber: string | null;
  /** Opens in an <img> without a token until `proofUrlExpiresAt`. */
  proofUrl: string | null;
  proofUrlExpiresAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  rejectionReason: string | null;
}

/** A store method among the storefront's payment methods. */
export interface ManualPaymentStoreMethod {
  /** `store_method:<method id>` */
  id: string;
  provider: "store_method";
  method: "bank_transfer";
  mode: "live";
  name: string;
  manualPaymentMethodId: string;
  kind: ManualPaymentKind;
  accountNumber: string;
  paymentLink: string | null;
  instructions: string | null;
  proofAfterCheckout: boolean;
}

/** An order's manual payment as the shopper sees it. */
export interface ManualPaymentShopperStatus {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  currency: string;
  status: ManualPaymentStatus;
  rejectionReason: string | null;
  submittedAt: string | null;
  /** False once a proof waits for review or is approved, and on a cancelled order. */
  canSubmit: boolean;
  method: { kind: ManualPaymentKind; label: string; accountNumber: string; paymentLink: string | null; instructions: string | null };
}

/** The storefront's method type does not name store methods; this narrows one. */
export function manualPaymentStoreMethod(method: StorefrontPaymentMethod | null | undefined): ManualPaymentStoreMethod | null {
  const m = method as unknown as ManualPaymentStoreMethod | null | undefined;
  return m && m.provider === "store_method" && typeof m.manualPaymentMethodId === "string" ? m : null;
}

/** The manual payment an order (or a confirmation task's order) carries, when the server sends it. */
export function manualPaymentOfOrder(order: unknown): ManualPaymentReview | null {
  const value = (order as { manualPayment?: ManualPaymentReview | null } | null | undefined)?.manualPayment;
  return value && typeof value === "object" && typeof value.status === "string" ? value : null;
}

// ------------------------------------------------------------------ staff --

const base = (workspaceId: string) => `/workspaces/${workspaceId}/manual-payments`;

export async function manualPaymentMethodsList(client: ApiClient, workspaceId: string): Promise<ManualPaymentMethod[]> {
  const { methods } = await client.request<{ methods: ManualPaymentMethod[] }>(`${base(workspaceId)}/methods`);
  return methods;
}

export async function manualPaymentMethodCreate(client: ApiClient, workspaceId: string, payload: ManualPaymentMethodPayload): Promise<ManualPaymentMethod> {
  const { method } = await client.request<{ method: ManualPaymentMethod }>(`${base(workspaceId)}/methods`, { method: "POST", body: payload });
  return method;
}

export async function manualPaymentMethodUpdate(
  client: ApiClient,
  workspaceId: string,
  methodId: string,
  payload: Partial<ManualPaymentMethodPayload>
): Promise<ManualPaymentMethod> {
  const { method } = await client.request<{ method: ManualPaymentMethod }>(`${base(workspaceId)}/methods/${methodId}`, { method: "PATCH", body: payload });
  return method;
}

export async function manualPaymentMethodDelete(client: ApiClient, workspaceId: string, methodId: string): Promise<void> {
  await client.request<void>(`${base(workspaceId)}/methods/${methodId}`, { method: "DELETE" });
}

export async function manualPaymentMethodsReorder(client: ApiClient, workspaceId: string, ids: string[]): Promise<ManualPaymentMethod[]> {
  const { methods } = await client.request<{ methods: ManualPaymentMethod[] }>(`${base(workspaceId)}/methods/order`, { method: "PUT", body: { ids } });
  return methods;
}

export async function manualPaymentForOrder(client: ApiClient, workspaceId: string, orderId: string): Promise<ManualPaymentReview | null> {
  const { manualPayment } = await client.request<{ manualPayment: ManualPaymentReview | null }>(`${base(workspaceId)}/orders/${orderId}`);
  return manualPayment;
}

export async function manualPaymentApprove(client: ApiClient, workspaceId: string, orderId: string): Promise<ManualPaymentReview> {
  const { manualPayment } = await client.request<{ manualPayment: ManualPaymentReview }>(`${base(workspaceId)}/orders/${orderId}/approve`, { method: "POST" });
  return manualPayment;
}

export async function manualPaymentReject(client: ApiClient, workspaceId: string, orderId: string, reason: string): Promise<ManualPaymentReview> {
  const { manualPayment } = await client.request<{ manualPayment: ManualPaymentReview }>(`${base(workspaceId)}/orders/${orderId}/reject`, {
    method: "POST",
    body: { reason },
  });
  return manualPayment;
}

// ---------------------------------------------------------------- shopper --

// The class's own fetch (the standard error envelope turned into ApiError), for the multipart upload.
function rawFetch(client: ApiClient, path: string, init: RequestInit): Promise<Response> {
  return (client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> }).rawFetch(path, init);
}

/** The order's manual payment, by the checkout's payment token (or a payment link's `pl_…` token). 404 for an order not paid this way. */
export async function manualPaymentShopperGet(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  paymentToken: string
): Promise<ManualPaymentShopperStatus> {
  const { manualPayment } = await client.request<{ manualPayment: ManualPaymentShopperStatus }>(
    `/store/${workspaceId}/orders/${orderId}/manual-payment`,
    { auth: false, headers: { "X-Payment-Token": paymentToken } }
  );
  return manualPayment;
}

/**
 * Sends the proof: the number or InstaPay handle paid from, and the screenshot (JPEG, PNG or WebP).
 * 422 VALIDATION_ERROR (payerNumber) | NO_FILE | IMAGE_UNREADABLE; 415 UNSUPPORTED_MEDIA_TYPE;
 * 413 FILE_TOO_LARGE | IMAGE_TOO_LARGE; 409 PROOF_ALREADY_SUBMITTED | ORDER_CANCELLED; 404; 429 RATE_LIMITED.
 */
export async function manualPaymentShopperSubmit(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  paymentToken: string,
  proof: { payerNumber: string; file: File | Blob }
): Promise<ManualPaymentShopperStatus> {
  const form = new FormData();
  form.append("payerNumber", proof.payerNumber);
  form.append("file", proof.file, proof.file instanceof File ? proof.file.name : "proof");
  // Multipart: no Content-Type here — the browser adds the boundary.
  const res = await rawFetch(client, `/store/${workspaceId}/orders/${orderId}/manual-payment/proof`, {
    method: "POST",
    body: form,
    headers: { "X-Payment-Token": paymentToken },
  });
  const { manualPayment } = (await res.json()) as { manualPayment: ManualPaymentShopperStatus };
  return manualPayment;
}

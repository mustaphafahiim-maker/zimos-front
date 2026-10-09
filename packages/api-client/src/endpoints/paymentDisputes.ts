/**
 * Card disputes and chargebacks (backend: frontend-handoff item 377,
 * src/modules/payments/disputeService.js).
 *
 * A shopper who paid by card (Stripe, PayPal) opened a dispute with their bank:
 * it is recorded on the order, the order is flagged so it isn't shipped by
 * mistake, and a dispute lost writes the money back as a refund with
 * `source: "chargeback"`. The merchant answers it in the gateway's dashboard.
 *
 *   GET /workspaces/:ws/payment-disputes?status=&orderId=&limit=&cursor=   (orders.view)
 *       status: "open" (inquiry + needs_response + under_review) or one status; newest first.
 *       → { disputes, openCount, nextCursor }; 422 VALIDATION_ERROR on a bad status / orderId.
 *   GET /orders/:orderId/payment-timeline also carries `disputes` (oldest first), and its
 *       `alerts` may hold `payment_disputed` / `chargeback_lost`.
 *   Booking a courier on a flagged order: 409 ORDER_PAYMENT_DISPUTED.
 *
 * Amounts are integer minor units. All exported names are prefixed `paymentDispute` / `PaymentDispute`.
 */
import type { ApiClient } from "../client";
import type { PaymentTimeline } from "../types";

export type PaymentDisputeStatus = "inquiry" | "needs_response" | "under_review" | "won" | "lost" | "closed";

export interface PaymentDispute {
  id: string;
  orderId: string;
  orderNumber: string | null;
  paymentId: string | null;
  providerCode: string;
  providerDisputeId: string | null;
  status: PaymentDisputeStatus;
  providerStatus: string | null;
  amount: number;
  currency: string;
  /** The gateway's own code: fraudulent, product_not_received, UNAUTHORISED… */
  reason: string | null;
  evidenceDueBy: string | null;
  openedAt: string | null;
  closedAt: string | null;
  /** The refund a lost dispute wrote. */
  refundId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDisputesPage {
  disputes: PaymentDispute[];
  openCount: number;
  nextCursor: string | null;
}

export const PAYMENT_DISPUTE_OPEN_STATUSES: readonly PaymentDisputeStatus[] = ["inquiry", "needs_response", "under_review"];

/** The order's disputes as its payment timeline carries them (an older server sends none). */
export function paymentDisputesOfTimeline(timeline: PaymentTimeline | null | undefined): PaymentDispute[] {
  const list = (timeline as { disputes?: PaymentDispute[] } | null | undefined)?.disputes;
  return Array.isArray(list) ? list : [];
}

export function paymentDisputesList(
  client: ApiClient,
  workspaceId: string,
  params: { status?: "open" | PaymentDisputeStatus; orderId?: string; limit?: number; cursor?: string } = {}
): Promise<PaymentDisputesPage> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.orderId) search.set("orderId", params.orderId);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);
  const text = search.toString();
  return client.request<PaymentDisputesPage>(`/workspaces/${workspaceId}/payment-disputes${text ? `?${text}` : ""}`);
}

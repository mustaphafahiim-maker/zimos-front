/**
 * A rejected transfer, from the shopper's side (backend
 * payments/transferResubmit.js). The tracking answer (orderTrack /
 * orderTrackingByToken) carries `transfer`: under review, or rejected with
 * the reason and how to pay again; a rejected one is sent again with the
 * order's signed tracking token (`trackingToken` in the same answer) and a
 * new receipt uploaded like the checkout's (uploadCustomerPhoto, this
 * visitor's).
 */
import type { ApiClient } from "../client";

export type TrackTransfer =
  | { status: "under_review"; amount: number; currency: string }
  | {
      status: "rejected";
      reason: string | null;
      amount: number;
      currency: string;
      purpose: "full" | "deposit";
      /** How to pay again; null when the store no longer offers the method. */
      method: { id: string; name: string; instructions: string; requireReceipt: boolean; requireSender: boolean } | null;
    };

/** The tracking answer's transfer, when it has one. */
export function trackTransferOf(result: unknown): TrackTransfer | null {
  const transfer = result && typeof result === "object" ? (result as { transfer?: TrackTransfer | null }).transfer : null;
  return transfer ?? null;
}

/** Sends a rejected transfer again. 409 TRANSFER_NOT_REJECTED when there is none to send. */
export async function transferResubmit(
  client: ApiClient,
  workspaceId: string,
  body: { token: string; receiptUploadId?: string | null; senderReference?: string | null },
  visitorId: string
): Promise<{ status: "under_review"; paymentId: string }> {
  const { transfer } = await client.request<{ transfer: { status: "under_review"; paymentId: string } }>(
    `/store/${workspaceId}/orders/track-link/transfer`,
    { method: "POST", body, auth: false, headers: { "X-Visitor-Id": visitorId } }
  );
  return transfer;
}

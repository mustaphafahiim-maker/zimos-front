import type { WalletRefundStatus } from "@store-builder/api-client";

/** What the console may do with a refund request in each status (the API refuses the rest). */
export function refundActions(status: WalletRefundStatus): { approve: boolean; reject: boolean; markPaid: boolean } {
  return {
    approve: status === "requested",
    reject: status === "requested" || status === "approved",
    markPaid: status === "approved",
  };
}

/** How a status reads, and the badge it borrows (StatusBadge values, no new colours). */
export const REFUND_STATUS: Record<WalletRefundStatus, { label: string; badge: string }> = {
  requested: { label: "Waiting for review", badge: "pending" },
  approved: { label: "Approved: send it, then mark paid", badge: "trialing" },
  rejected: { label: "Rejected", badge: "rejected" },
  cancelled: { label: "Cancelled by the store", badge: "canceled" },
  paid: { label: "Paid out", badge: "active" },
};

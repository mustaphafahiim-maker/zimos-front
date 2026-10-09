/**
 * Merge duplicate customers (backend: frontend-handoff item 248, src/modules/customers/customerMerge.js).
 *
 * Dashboard, /workspaces/:ws/customer-merge (customers.manage):
 *   GET  /candidates/:customerId   → { candidates } — the same email, the same last 9 phone digits,
 *        or the same name (up to 20, most orders first)
 *   POST /  { keepId, duplicateId } → CustomerMergeResult
 *        Everything of the duplicate moves to the kept customer (orders, addresses, notes,
 *        follow-ups, reviews, wishlist, referrals, quotes, ledgers…); points and store credit are
 *        added with a `merge` ledger line; gaps on the kept customer are filled; the duplicate's
 *        phone becomes the alternate phone when there is none. The duplicate is deleted — it
 *        can't be undone — and the kept customer's sign-ins restart.
 *        422 the same customer twice; 404; 409 CUSTOMER_PAYMENT_IN_PROGRESS while either has an
 *        online payment in progress.
 */
import type { ApiClient } from "../client";

/** Why two customers look like the same person. */
export type CustomerMergeReason = "email" | "phone" | "name";

export interface CustomerMergeCandidate {
  id: string;
  fullName: string | null;
  /** Normalized digits, with the country code. */
  phone: string | null;
  email: string | null;
  totalOrders: number;
  createdAt: string;
  reasons: CustomerMergeReason[];
}

export interface CustomerMergeResult {
  /** The kept customer after the merge. */
  customer: { id: string; fullName: string | null; phone: string | null; alternatePhone: string | null; email: string | null };
  /** Rows moved, keyed "<table>.<column>": { "orders.customer_id": 2, … }. Tables with nothing to move are left out. */
  moved: Record<string, number>;
  pointsAdded: number;
  /** Store credit added, minor units. */
  creditAdded: string | number;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/customer-merge`;

export async function customerMergeCandidates(client: ApiClient, workspaceId: string, customerId: string): Promise<CustomerMergeCandidate[]> {
  const { candidates } = await client.request<{ candidates: CustomerMergeCandidate[] }>(`${base(workspaceId)}/candidates/${customerId}`);
  return candidates;
}

export function customerMergeRun(
  client: ApiClient,
  workspaceId: string,
  body: { keepId: string; duplicateId: string }
): Promise<CustomerMergeResult> {
  return client.request<CustomerMergeResult>(base(workspaceId), { method: "POST", body });
}

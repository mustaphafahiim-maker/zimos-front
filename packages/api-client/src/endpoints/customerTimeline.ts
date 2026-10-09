/**
 * Customer timeline (backend: frontend-handoff item 250, src/modules/customerTimeline).
 *
 * GET /workspaces/:ws/customers/:customerId/timeline?limit=30&cursor=&kinds=   (customers.view)
 *   → { events: CustomerTimelineEvent[], next } — newest first. `next` goes back as `cursor`;
 *   null is the end. A cursor stays valid when new events arrive. `kinds` is a comma list;
 *   an unknown kind or a bad cursor answers 422, an unknown customer 404.
 *
 * Amounts inside `data` are integer minor units, sent as strings.
 */
import type { ApiClient } from "../client";

export const CUSTOMER_TIMELINE_KINDS = [
  "order_placed",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
  "return_requested",
  "refund",
  "note",
  "followup",
  "review",
  "question",
  "loyalty",
  "store_credit",
  "quote",
  "privacy_request",
  "referral",
  "form",
  // A customer email or SMS the provider reported as not arrived (handoff 386): data = channel, status, reason, subject, template.
  "message_undelivered",
] as const;

export type CustomerTimelineKind = (typeof CUSTOMER_TIMELINE_KINDS)[number];

/**
 * One thing that happened with the customer. `data` by kind:
 *   order_placed      total, currency, paymentMethod, source, isTest
 *   order_shipped     carrier, waybill, trackingUrl
 *   order_delivered   carrier, waybill
 *   order_cancelled   reason
 *   return_requested  reason, status, items
 *   refund            amount, currency, status, reason
 *   note              body, pinned, author
 *   followup          title, dueAt, doneAt, assignee
 *   review            rating, comment, status, productId, product
 *   question          question, answer, status, productId, product
 *   loyalty           kind, points, balanceAfter, note
 *   store_credit      kind, amount, balanceAfter, currency, note
 *   quote             number, status, currency, validUntil
 *   privacy_request   kind, status, completedAt
 *   referral          status, friend, rewardedAt
 *   form              form, page, message
 */
export interface CustomerTimelineEvent {
  /** One of CustomerTimelineKind; typed loosely so a newer backend kind still renders. */
  kind: CustomerTimelineKind | (string & {});
  at: string;
  /** The row behind the event. Two kinds may share it (a shipment is both shipped and delivered). */
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  data: Record<string, unknown>;
}

export interface CustomerTimelinePage {
  events: CustomerTimelineEvent[];
  next: string | null;
}

export interface CustomerTimelineQuery {
  /** 1–100, default 30. */
  limit?: number;
  cursor?: string;
  kinds?: readonly CustomerTimelineKind[];
}

export function customerTimelineGet(
  client: ApiClient,
  workspaceId: string,
  customerId: string,
  query: CustomerTimelineQuery = {}
): Promise<CustomerTimelinePage> {
  const qs = new URLSearchParams();
  if (query.limit) qs.set("limit", String(query.limit));
  if (query.cursor) qs.set("cursor", query.cursor);
  if (query.kinds && query.kinds.length > 0) qs.set("kinds", query.kinds.join(","));
  const s = qs.toString();
  return client.request<CustomerTimelinePage>(`/workspaces/${workspaceId}/customers/${customerId}/timeline${s ? `?${s}` : ""}`);
}

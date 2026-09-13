/**
 * Maps the real confirmation queue (ConfirmationTask + Order + Customer) onto the
 * call-center workstation's view model, and maps the workstation's 7 UI outcomes
 * onto the backend's 4-value enum.
 *
 * Backend (src/modules/cod): outcome ∈ confirmed | rejected | unreachable | postponed.
 *   confirmed   -> task done,   order.confirmationState = confirmed
 *   rejected    -> task done,   order.confirmationState = rejected, stock released,
 *                  customer.totalRejectedOrders += 1, `rejectionReason` REQUIRED
 *   unreachable -> task queued, nextRetryAt = now + 4h, confirmationState = unreachable
 *   postponed   -> task queued, nextRetryAt = now + 24h (fixed, no reschedule field),
 *                  confirmationState = postponed
 *
 * UI outcome mapping (the UI label always goes into `notes` so nothing is lost):
 *   confirmed    -> confirmed
 *   no_answer    -> unreachable
 *   busy         -> unreachable   (note "busy")
 *   postponed    -> postponed     (requested call-back time kept in the note; the server still retries in 24h)
 *   cancelled    -> rejected      (rejectionReason = cancel reason; downsell offer only as a note)
 *   wrong_number -> rejected      (rejectionReason = "wrong_number": the order cannot be confirmed)
 *   duplicate    -> HIDDEN. Rejecting would count against the customer's reliability
 *                  (totalRejectedOrders++) for what is a system/duplicate issue, so the
 *                  button is not offered; handle duplicates from the order page instead.
 */
import type { ConfirmationOutcome, Customer, Order, RecordConfirmationOutcomePayload } from "@store-builder/api-client";
import type { ConfirmationTaskRow } from "@store-builder/api-client";
import type { CallOutcome } from "@/mock/types2";

/** Orders at or above this total (minor units, 1,500 EGP) are shown as high priority. */
export const HIGH_PRIORITY_TOTAL_MINOR = 150_000;

export type UiOutcome = Exclude<CallOutcome, "duplicate">;

export interface QueueItemLine {
  productName: string;
  variant: string | null;
  quantity: number;
  unitPriceAmount: string;
}

export interface QueueItem {
  id: string;
  orderId: string;
  customerId: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  alternatePhone: string | null;
  governorate: string;
  city: string;
  country: string;
  addressLine: string;
  address: string;
  /** null until the order detail (with items) has loaded. */
  items: QueueItemLine[] | null;
  totalAmount: string;
  shippingAmount: string;
  currency: string;
  source: string;
  status: ConfirmationTaskRow["status"];
  attempts: number;
  lastOutcome: ConfirmationOutcome | null;
  nextAttemptAt: string | null;
  priority: "normal" | "high" | "flagged";
  lockedByUserId: string | null;
  confirmationState: Order["confirmationState"];
  createdAt: string;
  updatedAt: string | null;
  /** null until the customer record has loaded (or if it failed). */
  customerHistory: { totalOrders: number; rejected: number; reliabilityScore: number } | null;
  riskFlags: string[];
  detailsLoaded: boolean;
}

export interface TaskDetails {
  order: Order | null;
  customer: Customer | null;
}

function orderSource(order: Order): string {
  if (order.funnelId) return "funnel";
  if (order.websiteId) return "store";
  return "manual";
}

function variantLabel(opts: Record<string, string> | null): string | null {
  if (!opts) return null;
  const parts = Object.values(opts).filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : null;
}

export function toQueueItem(task: ConfirmationTaskRow, details?: TaskDetails): QueueItem {
  const order = details?.order ?? task.order;
  const customer = details?.customer ?? null;
  const contact = order?.contactSnapshot ?? {};
  const ship = order?.shippingAddressSnapshot ?? null;
  const riskFlags = order?.riskFlags ?? [];
  const total = Number(order?.totalAmount ?? 0);
  return {
    id: task.id,
    orderId: task.orderId,
    customerId: order?.customerId ?? "",
    orderNumber: order?.orderNumber ?? task.orderId.slice(0, 8),
    customerName: contact.fullName || customer?.fullName || "—",
    phone: contact.phone || customer?.phoneRaw || customer?.phoneNormalized || "",
    alternatePhone: contact.alternatePhone || customer?.alternatePhone || null,
    governorate: ship?.province || ship?.city || "—",
    city: ship?.city ?? "",
    country: ship?.country || "EG",
    addressLine: ship?.addressLine ?? "",
    address: [ship?.addressLine, ship?.city, ship?.notes].filter(Boolean).join("، "),
    items: details?.order?.items
      ? details.order.items.map((i) => ({
          productName: i.productNameSnapshot,
          variant: variantLabel(i.variantOptionsSnapshot),
          quantity: i.quantity,
          unitPriceAmount: i.unitPriceAmount,
        }))
      : null,
    totalAmount: order?.totalAmount ?? "0",
    shippingAmount: order?.shippingAmount ?? "0",
    currency: order?.currency ?? "EGP",
    source: order ? orderSource(order) : "—",
    status: task.status,
    attempts: task.attemptCount,
    lastOutcome: task.outcome,
    nextAttemptAt: task.nextRetryAt,
    priority: riskFlags.length > 0 ? "flagged" : total >= HIGH_PRIORITY_TOTAL_MINOR ? "high" : "normal",
    lockedByUserId: task.lockedByUserId,
    confirmationState: order?.confirmationState ?? "pending",
    createdAt: task.createdAt ?? order?.createdAt ?? new Date().toISOString(),
    updatedAt: task.updatedAt ?? null,
    customerHistory: customer
      ? { totalOrders: customer.totalOrders, rejected: customer.totalRejectedOrders, reliabilityScore: customer.reliabilityScore }
      : null,
    riskFlags,
    detailsLoaded: details !== undefined,
  };
}

/** Maps a UI outcome (+ extras) to the exact backend payload. */
export function toOutcomePayload(
  outcome: UiOutcome,
  input: { note: string | null; cancelReason?: string | null }
): RecordConfirmationOutcomePayload {
  const parts: string[] = [];
  let backend: ConfirmationOutcome;
  let rejectionReason: string | undefined;
  switch (outcome) {
    case "confirmed":
      backend = "confirmed";
      break;
    case "no_answer":
      backend = "unreachable";
      parts.push("no answer");
      break;
    case "busy":
      backend = "unreachable";
      parts.push("busy");
      break;
    case "postponed":
      backend = "postponed";
      parts.push("postponed");
      break;
    case "cancelled":
      backend = "rejected";
      rejectionReason = (input.cancelReason || "cancelled by customer").slice(0, 300);
      parts.push("cancelled");
      break;
    case "wrong_number":
      backend = "rejected";
      rejectionReason = "wrong_number";
      parts.push("wrong number");
      break;
  }
  if (input.note) parts.push(input.note);
  const notes = parts.join(" · ").slice(0, 1000);
  return { outcome: backend, ...(notes ? { notes } : {}), ...(rejectionReason ? { rejectionReason } : {}) };
}

/** Digits for wa.me / tel: — Egyptian local numbers (01xxxxxxxxx) get the 20 country code. */
export function internationalDigits(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `2${d}`;
  return d;
}

/**
 * Lazily fetches order + customer per task with an in-memory cache and a
 * concurrency limit. `onLoaded` fires once per task when both requests settle
 * (failures resolve to null so the row falls back to the task's embedded order).
 */
export function createDetailsLoader(
  fetchOrder: (orderId: string) => Promise<Order>,
  fetchCustomer: (customerId: string) => Promise<Customer>,
  onLoaded: (taskId: string, details: TaskDetails) => void,
  concurrency = 4
) {
  const cache = new Map<string, TaskDetails>();
  const pending = new Set<string>();
  const queue: Array<{ taskId: string; orderId: string; customerId: string | null }> = [];
  let active = 0;

  function pump() {
    while (active < concurrency && queue.length > 0) {
      const job = queue.shift()!;
      active += 1;
      void (async () => {
        const [order, customer] = await Promise.all([
          fetchOrder(job.orderId).catch(() => null),
          job.customerId ? fetchCustomer(job.customerId).catch(() => null) : Promise.resolve(null),
        ]);
        const details = { order, customer };
        cache.set(job.taskId, details);
        pending.delete(job.taskId);
        active -= 1;
        onLoaded(job.taskId, details);
        pump();
      })();
    }
  }

  return {
    get: (taskId: string) => cache.get(taskId),
    request(taskId: string, orderId: string, customerId: string | null) {
      if (cache.has(taskId) || pending.has(taskId)) return;
      pending.add(taskId);
      queue.push({ taskId, orderId, customerId });
      pump();
    },
    /** Drop a task so the next request refetches (e.g. after an outcome changed the order). */
    invalidate(taskId: string) {
      cache.delete(taskId);
    },
  };
}

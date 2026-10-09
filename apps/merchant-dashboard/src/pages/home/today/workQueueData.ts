import {
  lostOrdersList,
  manualTransferListPending,
  stockForecastGet,
  type LostOrderReason,
  type OrderPipeline,
  type OrderStage,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import type { WorkCounts } from "@/lib/workCounts";
import { waitLevel } from "@/pages/home/today/homeTime";

/*
 * «مستنيك دلوقتي» — what the work queue asks the API, and how it ranks the
 * answers. The counts of calls due, confirmed orders with no courier and
 * unread conversations are NOT asked here: they come from lib/workCounts.ts,
 * so the card, the side menu and the dock always say the same number. This
 * file brings the rest — how long the oldest has waited, and the kinds that
 * have no count of their own (failed deliveries, returns, transfers, stock,
 * checkouts nobody followed up).
 *
 * Every call stands alone (Promise.allSettled): a 403 hides that one row for
 * this role, any other failure marks the list as incomplete so an error is
 * never read as "nothing to do".
 */

/** One answer: there, not for this role (403), failed, or not asked this time. */
export type Part<T> = { state: "ok"; value: T } | { state: "denied" } | { state: "failed" } | { state: "skipped" };

interface Waiting {
  count: number;
  /** ISO time the oldest one started waiting; null when there is none. */
  oldest: string | null;
}

interface Valued {
  /** The API answers one page: the real count may be higher. */
  capped: boolean;
  /** Minor units, summed over the rows in `currency`. */
  amount: number;
  currency: string | null;
  /** False when `amount` is a floor: a capped page, or rows in another currency left out. */
  exact: boolean;
}

export interface WorkQueueData {
  pipeline: Part<OrderPipeline>;
  /** The oldest call that is due now; `since` is null when no call is due. Doubles as "can this role read the queue". */
  call: Part<{ since: string | null }>;
  /** When the oldest order of each stage started waiting (ready to ship: confirmed, else placed). */
  shipSince: string | null;
  failedSince: string | null;
  followSince: string | null;
  returnsReview: Part<Waiting>;
  returnsReceive: Part<Waiting>;
  transfers: Part<Waiting & Valued & { orderId: string | null }>;
  stock: Part<{ count: number; names: string[]; more: boolean }>;
  abandoned: Part<{ count: number } & Valued>;
  /** Asked only while a conversation is unread: is WhatsApp connected? */
  whatsapp: Part<boolean>;
  /** A call failed for a reason other than "not for this role": the list may be missing work. */
  incomplete: boolean;
}

/** Checkouts older than this are cold: the row is about the ones still worth a call. */
export const ABANDONED_WINDOW_DAYS = 7;
/** `GET /manual-transfers/pending` answers at most this many. */
const TRANSFERS_CAP = 50;
const CHECKOUTS_PAGE = 100;
/** Checkouts the shopper left or stumbled on. Ones a rule refused (bot, blocklist, country) are not customers to win back. */
const WINNABLE: ReadonlySet<LostOrderReason> = new Set<LostOrderReason>(["incomplete", "invalid_data", "otp_unverified", "payment_failed"]);

/* A 403 does not change while the member keeps their role, so a kind this role
   may not read is asked once per session, not every two minutes. */
const DENIED_BEFORE = Symbol("denied before");
const denied = new Map<string, Set<string>>();

function unlessDenied<T>(scope: string, key: string, call: () => Promise<T>): Promise<T> {
  return denied.get(scope)?.has(key) ? Promise.reject(DENIED_BEFORE) : call();
}

function partOf<T>(scope: string, key: string, result: PromiseSettledResult<T>): Part<T> {
  if (result.status === "fulfilled") return { state: "ok", value: result.value };
  if (result.reason === DENIED_BEFORE) return { state: "denied" };
  if (isPermissionError(result.reason)) {
    const keys = denied.get(scope) ?? new Set<string>();
    keys.add(key);
    denied.set(scope, keys);
    return { state: "denied" };
  }
  return { state: "failed" };
}

function mapPart<T, U>(part: Part<T>, map: (value: T) => U): Part<U> {
  return part.state === "ok" ? { state: "ok", value: map(part.value) } : part;
}

function earliest(times: readonly string[]): string | null {
  let min: string | null = null;
  for (const time of times) if (min === null || new Date(time).getTime() < new Date(min).getTime()) min = time;
  return min;
}

/** The sum of the rows in the first row's currency, and whether that is the whole truth. */
function valueOf(rows: readonly { amount: number; currency: string }[], capped: boolean): Valued {
  const currency = rows[0]?.currency ?? null;
  let amount = 0;
  let same = true;
  for (const row of rows) {
    if (row.currency === currency) amount += row.amount;
    else same = false;
  }
  return { capped, amount, currency, exact: same && !capped };
}

export async function loadWorkQueue(
  workspaceId: string,
  opts: { role: string | null | undefined; askWhatsapp: boolean }
): Promise<WorkQueueData> {
  const scope = `${workspaceId}:${opts.role ?? ""}`;
  const windowStart = new Date(Date.now() - ABANDONED_WINDOW_DAYS * 86_400_000).toISOString();

  const [pipelineR, callR, requestedR, approvedR, transfersR, stockR, lostR, whatsappR] = await Promise.allSettled([
    unlessDenied(scope, "pipeline", () => apiClient.getOrderPipeline(workspaceId)),
    unlessDenied(scope, "queue", () => apiClient.listConfirmationQueue(workspaceId, { status: "pending", limit: 1 })),
    unlessDenied(scope, "returns", () => apiClient.listReturns(workspaceId, { status: "requested" })),
    unlessDenied(scope, "returns", () => apiClient.listReturns(workspaceId, { status: "approved" })),
    unlessDenied(scope, "transfers", () => manualTransferListPending(apiClient, workspaceId)),
    unlessDenied(scope, "stock", () => stockForecastGet(apiClient, workspaceId, { limit: 3 })),
    unlessDenied(scope, "checkouts", () =>
      lostOrdersList(apiClient, workspaceId, { recoveryStatus: "not_contacted", from: windowStart, limit: CHECKOUTS_PAGE })
    ),
    opts.askWhatsapp ? unlessDenied(scope, "whatsapp", () => apiClient.getWhatsappIntegration(workspaceId)) : Promise.resolve(null),
  ]);

  const pipeline = partOf(scope, "pipeline", pipelineR);
  const queue = partOf(scope, "queue", callR);
  const requested = partOf(scope, "returns", requestedR);
  const approved = partOf(scope, "returns", approvedR);
  const transfers = partOf(scope, "transfers", transfersR);
  const stock = partOf(scope, "stock", stockR);
  const lost = partOf(scope, "checkouts", lostR);
  const whatsapp = partOf(scope, "whatsapp", whatsappR);

  // The age of the oldest order is asked only for a stage that holds one. A follow-up is a call
  // already in the queue, so its stage gets a row of its own only for a role that cannot read the queue.
  const stages = pipeline.state === "ok" ? pipeline.value.stages : null;
  const oldestOf = (stage: OrderStage) =>
    apiClient.listOrders(workspaceId, { stage, sort: "oldest", limit: 1 }).then((page) => page.orders[0] ?? null);
  const [shipR, failedR, followR] = await Promise.allSettled([
    stages?.ready_to_ship ? oldestOf("ready_to_ship") : Promise.resolve(null),
    stages?.delivery_failed ? oldestOf("delivery_failed") : Promise.resolve(null),
    stages?.needs_follow_up && queue.state !== "ok" ? oldestOf("needs_follow_up") : Promise.resolve(null),
  ]);
  const ship = shipR.status === "fulfilled" ? shipR.value : null;
  const failed = failedR.status === "fulfilled" ? failedR.value : null;
  const follow = followR.status === "fulfilled" ? followR.value : null;

  return {
    pipeline,
    call: mapPart(queue, (page) => {
      // The pending tab lists the call that is due first: COALESCE(next_retry_at, available_at, created_at).
      const first = page.tasks[0];
      const since = first ? (first.nextRetryAt ?? first.availableAt ?? first.createdAt) : null;
      const due = Boolean(first && since && !first.waitingForOffers && new Date(since).getTime() <= Date.now());
      return { since: due ? since : null };
    }),
    shipSince: ship ? (ship.confirmedAt ?? ship.createdAt) : null,
    // The oldest order PLACED in the stage, not the delivery that failed longest ago (needs-backend H4).
    failedSince: failed ? failed.createdAt : null,
    followSince: follow ? follow.createdAt : null,
    returnsReview: mapPart(requested, (rows) => ({ count: rows.length, oldest: earliest(rows.map((r) => r.createdAt)) })),
    // Approved and not back on the shelf yet: the parcel is still to be received.
    returnsReceive: mapPart(approved, (all) => {
      const rows = all.filter((r) => !r.restockedAt);
      return { count: rows.length, oldest: earliest(rows.map((r) => r.createdAt)) };
    }),
    transfers: mapPart(transfers, (rows) => {
      const oldest = earliest(rows.map((r) => r.createdAt));
      return {
        count: rows.length,
        oldest,
        orderId: rows.find((r) => r.createdAt === oldest)?.orderId ?? null,
        ...valueOf(rows, rows.length >= TRANSFERS_CAP),
      };
    }),
    stock: mapPart(stock, (forecast) => {
      const urgent = forecast.variants.filter((v) => v.status === "out" || v.status === "reorder_now");
      const names = [...new Set(urgent.map((v) => v.productName))].slice(0, 2);
      const count = (forecast.counts.out ?? 0) + (forecast.counts.reorder_now ?? 0);
      return { count, names, more: count > urgent.filter((v) => names.includes(v.productName)).length };
    }),
    abandoned: mapPart(lost, (page) => {
      const rows = page.sessions.filter(
        (s) => (s.status === "abandoned" || s.status === "lost") && WINNABLE.has(s.lostReason ?? "incomplete")
      );
      return {
        count: rows.length,
        ...valueOf(
          rows.map((s) => ({ amount: s.subtotalAmount, currency: s.currency })),
          page.nextCursor !== null
        ),
      };
    }),
    whatsapp: opts.askWhatsapp ? mapPart(whatsapp, (integration) => Boolean(integration?.connected)) : { state: "skipped" },
    incomplete: [pipeline, queue, requested, approved, transfers, stock, lost].some((part) => part.state === "failed"),
  };
}

/* ------------------------------------------------------------------ */

export type QueueKind =
  | "calls"
  | "follow"
  | "transfers"
  | "failed"
  | "ship"
  | "messages"
  | "returnsReview"
  | "returnsReceive"
  | "abandoned"
  | "stock";

/** Two kinds as late as each other: calls first, stock last. A follow-up is a call, so it sits with them. */
const TIE_ORDER: readonly QueueKind[] = [
  "calls",
  "follow",
  "transfers",
  "failed",
  "ship",
  "messages",
  "returnsReview",
  "returnsReceive",
  "abandoned",
  "stock",
];

export interface QueueItem {
  kind: QueueKind;
  /** null: something is waiting, but its number has not arrived yet (calls only). */
  count: number | null;
  /** The count is a floor: the API answered one full page. */
  capped: boolean;
  /** When the oldest started waiting; null when the API does not say. */
  since: string | null;
  /** `waitLevel(since)`: 2 and above is late. Kinds with no age are 0. */
  level: 0 | 1 | 2 | 3;
  /** Minor units; null when the API gives no money for this kind. */
  amount: number | null;
  currency: string | null;
  /** False when `amount` is a floor ("at least"). */
  exact: boolean;
  /** Product names, for stock. */
  names: string[];
  moreNames: boolean;
  to: string;
}

/** What is waiting, the latest first. A kind with nothing waiting is not in the list. */
export function rankQueue(data: WorkQueueData, counts: WorkCounts, now: number): QueueItem[] {
  const items: QueueItem[] = [];
  const add = (kind: QueueKind, count: number | null, to: string, more: Partial<QueueItem> = {}) => {
    const since = more.since ?? null;
    items.push({
      kind,
      count,
      to,
      capped: false,
      amount: null,
      currency: null,
      exact: true,
      names: [],
      moreNames: false,
      ...more,
      since,
      level: waitLevel(since, now),
    });
  };
  const stages = data.pipeline.state === "ok" ? data.pipeline.value.stages : null;
  const queueReadable = data.call.state === "ok";
  const callSince = data.call.state === "ok" ? data.call.value.since : null;

  // Calls due now. Until the shared count arrives, a due call the loader saw is still a row, without a number.
  if (counts.toConfirm !== null ? counts.toConfirm > 0 : callSince !== null) {
    add("calls", counts.toConfirm, "/confirmation-queue", { since: callSince });
  }
  if (counts.toConfirm === null && !queueReadable && stages?.needs_follow_up) {
    add("follow", stages.needs_follow_up, "/orders?stage=needs_follow_up", { since: data.followSince });
  }
  const toShip = counts.toShip ?? stages?.ready_to_ship ?? 0;
  if (toShip > 0) add("ship", toShip, "/orders?stage=ready_to_ship", { since: data.shipSince });
  if (stages?.delivery_failed) add("failed", stages.delivery_failed, "/orders?stage=delivery_failed", { since: data.failedSince });

  if (data.returnsReview.state === "ok" && data.returnsReview.value.count > 0) {
    add("returnsReview", data.returnsReview.value.count, "/returns", { since: data.returnsReview.value.oldest });
  }
  if (data.returnsReceive.state === "ok" && data.returnsReceive.value.count > 0) {
    add("returnsReceive", data.returnsReceive.value.count, "/returns", { since: data.returnsReceive.value.oldest });
  }
  if (data.transfers.state === "ok" && data.transfers.value.count > 0 && data.transfers.value.orderId) {
    // There is no list of pending transfers to open: each is approved on its order's page, the oldest first.
    const v = data.transfers.value;
    add("transfers", v.count, `/orders/${v.orderId}`, { since: v.oldest, capped: v.capped, amount: v.amount, currency: v.currency, exact: v.exact });
  }
  if (data.stock.state === "ok" && data.stock.value.count > 0) {
    const v = data.stock.value;
    add("stock", v.count, "/inventory/forecast", { names: v.names, moreNames: v.more });
  }
  // Zero unread can mean "WhatsApp is not connected": the row shows only when a conversation is unread and
  // the connection is there (or could not be checked — the unread conversation is the evidence).
  const connected = data.whatsapp.state === "ok" ? data.whatsapp.value : data.whatsapp.state === "failed";
  if ((counts.unread ?? 0) > 0 && connected) add("messages", counts.unread, "/inbox");
  if (data.abandoned.state === "ok" && data.abandoned.value.count > 0) {
    const v = data.abandoned.value;
    add("abandoned", v.count, "/abandoned-carts", { capped: v.capped, amount: v.amount, currency: v.currency, exact: v.exact });
  }

  return items.sort((a, b) => b.level - a.level || TIE_ORDER.indexOf(a.kind) - TIE_ORDER.indexOf(b.kind));
}

/** What the card may truthfully say when no row is drawn, and the quiet note under the rows. */
export function queueFacts(data: WorkQueueData, counts: WorkCounts) {
  const pipeline = data.pipeline.state === "ok" ? data.pipeline.value : null;
  const unconfirmed = pipeline ? pipeline.stages.pending_confirmation + pipeline.stages.needs_follow_up : 0;
  return {
    /** This role reads orders. */
    ordersReadable: pipeline !== null,
    /** This role reads the confirmation queue. */
    queueReadable: counts.toConfirm !== null || data.call.state === "ok",
    /** The store has not had its first order. */
    noOrdersYet: pipeline !== null && pipeline.total === 0,
    /** Nothing is waiting on a call or a payment: "every order is confirmed" is true. */
    allConfirmed: pipeline !== null && unconfirmed === 0 && pipeline.stages.awaiting_payment === 0,
    /** Orders not confirmed yet whose call is not due now: booked for later, in an offer window, or being worked. */
    notDue: pipeline !== null && counts.toConfirm !== null ? Math.max(0, unconfirmed - counts.toConfirm) : 0,
  };
}

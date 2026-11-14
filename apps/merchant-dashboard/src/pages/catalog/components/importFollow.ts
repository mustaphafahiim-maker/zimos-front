import { ApiError, type CatalogImport } from "@store-builder/api-client";

/**
 * How the import dialog (ProductTransferDialog) follows an import the server
 * runs in the background: how often it reads it, how long one request may
 * take, and when it stops waiting and says why instead of spinning for good.
 */
export const FOLLOW = {
  /** Between two reads: quick at first, slower once the import takes a while. */
  pollMs: 1500,
  slowPollMs: 3000,
  slowAfterMs: 30_000,
  /** The longest wait after failed reads in a row. */
  maxBackoffMs: 15_000,
  /** One read of the import, and the upload that starts it. */
  requestTimeoutMs: 15_000,
  uploadTimeoutMs: 120_000,
  /** Failed reads in a row before the dialog stops and shows the error. */
  maxFailures: 5,
  /** Still waiting to start after this long. */
  queuedLimitMs: 60_000,
  /** Running with no product done or failed for this long. */
  stalledLimitMs: 180_000,
} as const;

/** Why the dialog stopped following an import that has not finished. */
export type FollowStop =
  | { kind: "session" }
  | { kind: "error"; error: unknown }
  | { kind: "notStarted" }
  | { kind: "stalled" };

export class RequestTimeout extends Error {
  constructor() {
    super("The server took too long to answer");
    this.name = "RequestTimeout";
  }
}

export const isFinished = (job: CatalogImport) => job.status === "done" || job.status === "failed";

/** Products the import has dealt with so far, imported or not. */
export const processed = (job: CatalogImport) => job.createdCount + job.failedCount;

/** Changes whenever the import moves: its status or a product done. */
export const progressKey = (job: CatalogImport) => `${job.status}:${job.createdCount}:${job.failedCount}`;

/**
 * A failed read: `session` — still 401 after the client's own refresh, so the
 * session is over; `stop` — no access or no such import, asking again cannot
 * help; `retry` — the network, a timeout, a 429 or a server error.
 */
export function readFailure(err: unknown): "session" | "stop" | "retry" {
  if (err instanceof ApiError) {
    if (err.status === 401) return "session";
    if (err.status === 403 || err.status === 404) return "stop";
  }
  return "retry";
}

/** The wait before the next read, longer after each failed one. */
export function nextDelay(elapsedMs: number, failures: number): number {
  if (failures > 0) return Math.min(FOLLOW.maxBackoffMs, FOLLOW.slowPollMs * 2 ** (failures - 1));
  return elapsedMs < FOLLOW.slowAfterMs ? FOLLOW.pollMs : FOLLOW.slowPollMs;
}

/** Whether an import that has not changed for `unchangedMs` should no longer be waited for. */
export function stalled(job: CatalogImport, unchangedMs: number): "notStarted" | "stalled" | null {
  if (job.status === "queued" && unchangedMs >= FOLLOW.queuedLimitMs) return "notStarted";
  if (job.status === "running" && unchangedMs >= FOLLOW.stalledLimitMs) return "stalled";
  return null;
}

/**
 * Runs `request` and settles with it, or rejects with RequestTimeout after
 * `ms`, or with an AbortError as soon as `outer` aborts (the dialog closed) —
 * whichever comes first, even for a request that ignores its signal. The
 * signal it gets aborts in both of the last two cases.
 */
export function withTimeout<T>(
  ms: number,
  outer: AbortSignal | null,
  request: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const end = () => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onAbort);
    };
    const giveUp = (reason: unknown) => {
      end();
      reject(reason);
      controller.abort();
    };
    const onAbort = () => giveUp(new DOMException("The request was given up", "AbortError"));
    const timer = setTimeout(() => giveUp(new RequestTimeout()), ms);
    if (outer?.aborted) {
      onAbort();
      return;
    }
    outer?.addEventListener("abort", onAbort);
    request(controller.signal).then(
      (value) => {
        end();
        resolve(value);
      },
      (err) => {
        end();
        reject(err);
      }
    );
  });
}

import {
  ApiError,
  type CatalogBulkDeleteMode,
  type CatalogBulkDeleteRequest,
  type CatalogBulkDeleteResult,
  type CatalogBulkDeleteSkip,
  type CatalogProductFilters,
} from "@store-builder/api-client";

/**
 * The bulk delete's moving parts (ProductBulkDeleteDialog): what is being
 * deleted, where a run has got to, and the next request to send. The server
 * takes one chunk per request, so a run is a loop of these.
 */

/** The ticked products, or every product the list's filters matched when they were counted. */
export type BulkDeleteTarget =
  | { kind: "ids"; ids: string[] }
  | { kind: "filter"; filter: CatalogProductFilters; count: number; asOf: string };

/** What a run still has to send: ids left, or the filter's next cursor. Kept on an error, so "Try again" goes on from there. */
export type BulkDeletePosition =
  | { kind: "ids"; left: string[] }
  | { kind: "filter"; cursor: string | null; finished: boolean };

export interface BulkDeleteTotals {
  deleted: number;
  skipped: CatalogBulkDeleteSkip[];
  /** Products dealt with so far, deleted or skipped. */
  processed: number;
}

/**
 * Ticked products sent per request: fewer than the server takes
 * (CATALOG_BULK_DELETE_CHUNK), so the progress bar moves for a few dozen too.
 */
export const IDS_PER_REQUEST = 25;
/** From this many products the merchant types the confirmation word. */
export const CONFIRM_WORD_FROM = 20;
/** One chunk may take this long (100 products deleted for good, one by one). */
export const CHUNK_TIMEOUT_MS = 60_000;
/** The wait after a 429 that names none. */
export const RATE_LIMIT_WAIT_MS = 10_000;

export const targetCount = (target: BulkDeleteTarget) => (target.kind === "ids" ? target.ids.length : target.count);

export function firstPosition(target: BulkDeleteTarget): BulkDeletePosition {
  return target.kind === "ids" ? { kind: "ids", left: target.ids } : { kind: "filter", cursor: null, finished: false };
}

/** The request for the next chunk, or null when the run is over. */
export function nextRequest(
  mode: CatalogBulkDeleteMode,
  target: BulkDeleteTarget,
  position: BulkDeletePosition
): CatalogBulkDeleteRequest | null {
  if (position.kind === "ids") {
    return position.left.length > 0 ? { mode, productIds: position.left.slice(0, IDS_PER_REQUEST) } : null;
  }
  if (position.finished || target.kind !== "filter") return null;
  return {
    mode,
    filter: { ...target.filter, createdBefore: target.asOf },
    ...(position.cursor ? { cursor: position.cursor } : {}),
  };
}

/** Where the run is after the server answered `request`. */
export function advance(
  position: BulkDeletePosition,
  request: CatalogBulkDeleteRequest,
  result: CatalogBulkDeleteResult
): BulkDeletePosition {
  if (position.kind === "ids") {
    const sent = "productIds" in request ? request.productIds.length : 0;
    return { kind: "ids", left: position.left.slice(sent) };
  }
  return { kind: "filter", cursor: result.nextCursor, finished: result.nextCursor === null };
}

export function addResult(totals: BulkDeleteTotals, result: CatalogBulkDeleteResult): BulkDeleteTotals {
  return {
    deleted: totals.deleted + result.deleted,
    skipped: [...totals.skipped, ...result.skipped],
    processed: totals.processed + result.deleted + result.skipped.length,
  };
}

/** How long to wait before sending again after `err`, or null when it is not a 429. */
export function rateLimitWait(err: unknown): number | null {
  if (!(err instanceof ApiError) || err.status !== 429) return null;
  return err.retryAfter ? err.retryAfter * 1000 : RATE_LIMIT_WAIT_MS;
}

/** Waits `ms`, or rejects as soon as `signal` aborts. */
export function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Stopped", "AbortError"));
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve();
    }, ms);
    const stop = () => {
      clearTimeout(timer);
      reject(new DOMException("Stopped", "AbortError"));
    };
    signal.addEventListener("abort", stop, { once: true });
  });
}

/** Whether the typed text is the confirmation word: the one shown, or the English one on any keyboard. */
export function confirmWordMatches(typed: string, word: string): boolean {
  const text = typed.trim().toLowerCase();
  return text === word.toLowerCase() || text === "delete";
}

/**
 * The batching core of lib/analyticsEvents.ts, kept free of imports and of
 * browser globals so it runs under Node's test runner
 * (`node --test src/lib/eventQueue.test.mjs`). It collects events for a short
 * while and hands them over in batches of at most MAX_BATCH; how a batch is
 * delivered (fetch, sendBeacon) is the caller's business.
 */

/** The API accepts 1..20 events per request. */
export const MAX_BATCH = 20;
/** Events queued within this window go out as one request. */
export const BATCH_DELAY_MS = 1000;

export interface EventQueueOptions<T> {
  /** Deliver one batch. `urgent` is set when the page is going away. */
  send: (events: T[], urgent: boolean) => void;
  delayMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface EventQueue<T> {
  push: (event: T) => void;
  /** Send everything queued now. */
  flush: (urgent?: boolean) => void;
  size: () => number;
}

export function createEventQueue<T>(options: EventQueueOptions<T>): EventQueue<T> {
  const delay = options.delayMs ?? BATCH_DELAY_MS;
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let pending: T[] = [];
  let timer: unknown = null;

  function flush(urgent = false) {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    while (pending.length > 0) {
      const batch = pending.slice(0, MAX_BATCH);
      pending = pending.slice(MAX_BATCH);
      try {
        options.send(batch, urgent);
      } catch {
        /* delivery is best effort */
      }
    }
  }

  function push(event: T) {
    pending.push(event);
    if (pending.length >= MAX_BATCH) {
      flush();
      return;
    }
    if (timer === null) timer = setTimer(() => flush(), delay);
  }

  return { push, flush, size: () => pending.length };
}

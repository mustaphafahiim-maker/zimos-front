import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_BATCH, createEventQueue } from "./eventQueue.ts";

/**
 * Pins the batching promise of lib/analyticsEvents.ts: events queued close
 * together leave as one request, never more than the API's 20 per request,
 * and a flush (pagehide) sends what is left at once. Timers are injected so
 * nothing here waits. `node --test src/lib/eventQueue.test.mjs`.
 */

function harness() {
  const sent = [];
  const timers = [];
  const queue = createEventQueue({
    send: (events, urgent) => sent.push({ events, urgent }),
    delayMs: 1000,
    setTimer: (fn, ms) => {
      const handle = { fn, ms, cleared: false };
      timers.push(handle);
      return handle;
    },
    clearTimer: (h) => {
      h.cleared = true;
    },
  });
  const fire = () => {
    for (const t of timers.splice(0)) if (!t.cleared) t.fn();
  };
  return { queue, sent, timers, fire };
}

describe("createEventQueue", () => {
  it("batches events queued within the delay into one send", () => {
    const { queue, sent, timers, fire } = harness();
    queue.push({ name: "page_view" });
    queue.push({ name: "view_content" });
    assert.equal(sent.length, 0);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].ms, 1000);
    fire();
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].events.map((e) => e.name), ["page_view", "view_content"]);
    assert.equal(sent[0].urgent, false);
    assert.equal(queue.size(), 0);
  });

  it("sends at most MAX_BATCH per request", () => {
    const { queue, sent, fire } = harness();
    for (let i = 0; i < MAX_BATCH + 3; i++) queue.push({ i });
    // The 20th push flushes on its own; the rest wait for the timer.
    assert.equal(sent.length, 1);
    assert.equal(sent[0].events.length, MAX_BATCH);
    fire();
    assert.equal(sent.length, 2);
    assert.equal(sent[1].events.length, 3);
  });

  it("flush sends what is pending right away and cancels the timer", () => {
    const { queue, sent, timers, fire } = harness();
    queue.push({ name: "purchase" });
    queue.flush(true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].urgent, true);
    assert.equal(timers[0].cleared, true);
    fire();
    assert.equal(sent.length, 1);
  });

  it("a failing send never throws out of push or flush", () => {
    const queue = createEventQueue({
      send: () => {
        throw new Error("network");
      },
      setTimer: (fn) => fn(),
      clearTimer: () => {},
    });
    assert.doesNotThrow(() => queue.push({ name: "page_view" }));
    assert.doesNotThrow(() => queue.flush());
  });
});

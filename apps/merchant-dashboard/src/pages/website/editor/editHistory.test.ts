import { describe, expect, it } from "vitest";
import { COALESCE_MS, HISTORY_LIMIT, commit, createHistory, redo, undo } from "./editHistory";

describe("edit history", () => {
  it("undoes and redoes in order", () => {
    let h = createHistory("a");
    h = commit(h, "b", { now: 0 });
    h = commit(h, "c", { now: 10_000 });
    h = undo(h);
    expect(h.present).toBe("b");
    h = undo(h);
    expect(h.present).toBe("a");
    expect(undo(h)).toBe(h);
    h = redo(h);
    h = redo(h);
    expect(h.present).toBe("c");
    expect(redo(h)).toBe(h);
  });

  it("drops the redo branch on a new change", () => {
    let h = commit(commit(createHistory(1), 2, { now: 0 }), 3, { now: 5_000 });
    h = commit(undo(h), 9, { now: 10_000 });
    expect(h.present).toBe(9);
    expect(h.future).toEqual([]);
    expect(undo(h).present).toBe(2);
  });

  it("folds a burst of same-key changes into one step", () => {
    let h = createHistory("");
    h = commit(h, "h", { key: "title", now: 1_000 });
    h = commit(h, "he", { key: "title", now: 1_200 });
    h = commit(h, "hey", { key: "title", now: 1_400 });
    expect(undo(h).present).toBe("");
    // A pause, or a different field, starts a new step.
    h = commit(h, "hey!", { key: "title", now: 1_400 + COALESCE_MS + 1 });
    h = commit(h, "hey!", { key: "other", now: 5_000 });
    expect(undo(h).present).toBe("hey");
  });

  it("ignores a change to the same value", () => {
    const h = createHistory({ a: 1 });
    expect(commit(h, h.present)).toBe(h);
  });

  it("keeps at most HISTORY_LIMIT undo steps", () => {
    let h = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = commit(h, i, { now: i * 10_000 });
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});

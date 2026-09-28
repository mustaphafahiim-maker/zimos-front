import { useCallback, useState } from "react";

/**
 * Undo / redo for one editing session. Plain snapshots: the editor's state is
 * a small immutable tree, so keeping whole copies is simpler and safer than
 * recording inverse operations.
 *
 * Typing produces a change per keystroke, so consecutive changes that carry
 * the same `key` within COALESCE_MS fold into one step — undo takes back a
 * word or a field, not a letter. Any other change starts a new step.
 */

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 800;

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** The key and time of the last change, for coalescing. */
  lastKey: string | null;
  lastAt: number;
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 };
}

export function commit<T>(
  history: History<T>,
  next: T,
  { key = null, now = Date.now() }: { key?: string | null; now?: number } = {}
): History<T> {
  if (Object.is(next, history.present)) return history;
  const coalesce =
    key !== null && key === history.lastKey && now - history.lastAt < COALESCE_MS && history.past.length > 0;
  return {
    past: coalesce ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastKey: key,
    lastAt: now,
  };
}

export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastKey: null,
    lastAt: 0,
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  const [next, ...rest] = history.future;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
    lastKey: null,
    lastAt: 0,
  };
}

export function useEditHistory<T>(initial: T) {
  const [history, setHistory] = useState(() => createHistory(initial));

  /** Records a change. Pass a `key` to fold a burst of similar changes into one step. */
  const set = useCallback((update: T | ((current: T) => T), key?: string) => {
    setHistory((h) => {
      const next = typeof update === "function" ? (update as (current: T) => T)(h.present) : update;
      return commit(h, next, { key });
    });
  }, []);

  /** Starts over from `value` with nothing to undo — a freshly loaded page. */
  const reset = useCallback((value: T) => setHistory(createHistory(value)), []);

  return {
    value: history.present,
    set,
    reset,
    undo: useCallback(() => setHistory(undo), []),
    redo: useCallback(() => setHistory(redo), []),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

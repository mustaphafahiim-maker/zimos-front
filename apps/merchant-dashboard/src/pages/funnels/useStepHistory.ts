import { useCallback, useEffect, useState } from "react";
import type { PageTree } from "@store-builder/api-client";
import { COALESCE_MS, HISTORY_LIMIT } from "../website/editor/editHistory";

/**
 * Undo / redo for the funnel step page editor (SPEC §9.3, item 94), as the
 * website editor has it (website/editor/editHistory.ts): whole-tree
 * snapshots, a burst of typing in one section folded into one step, and
 * Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y outside text fields. The tree itself lives
 * in the funnel draft (saved by the funnel editor's Save button); this only
 * remembers the steps back and forward, per step — opening another step
 * starts a fresh history.
 */

interface Stacks {
  stepKey: string;
  past: PageTree[];
  future: PageTree[];
  lastKey: string | null;
  lastAt: number;
}

const fresh = (stepKey: string): Stacks => ({ stepKey, past: [], future: [], lastKey: null, lastAt: 0 });

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches("input, textarea, select");
}

export function useStepHistory(stepKey: string, tree: PageTree, onTreeChange: (tree: PageTree) => void) {
  const [stacks, setStacks] = useState<Stacks>(() => fresh(stepKey));
  // Another step is another page: its own history (adjusted during render, as React advises).
  if (stacks.stepKey !== stepKey) setStacks(fresh(stepKey));

  /** Records an edit. Pass a `key` to fold a burst of similar edits into one undo step. */
  const change = useCallback(
    (next: PageTree, key?: string) => {
      const now = Date.now();
      const coalesce = key !== undefined && key === stacks.lastKey && now - stacks.lastAt < COALESCE_MS && stacks.past.length > 0;
      setStacks({
        stepKey: stacks.stepKey,
        past: coalesce ? stacks.past : [...stacks.past, tree].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: key ?? null,
        lastAt: now,
      });
      onTreeChange(next);
    },
    [stacks, tree, onTreeChange]
  );

  const undo = useCallback(() => {
    const previous = stacks.past[stacks.past.length - 1];
    if (!previous) return;
    setStacks({ stepKey: stacks.stepKey, past: stacks.past.slice(0, -1), future: [tree, ...stacks.future], lastKey: null, lastAt: 0 });
    onTreeChange(previous);
  }, [stacks, tree, onTreeChange]);

  const redo = useCallback(() => {
    const [next, ...rest] = stacks.future;
    if (!next) return;
    setStacks({ stepKey: stacks.stepKey, past: [...stacks.past, tree], future: rest, lastKey: null, lastAt: 0 });
    onTreeChange(next);
  }, [stacks, tree, onTreeChange]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || isTextEntry(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  return { change, undo, redo, canUndo: stacks.past.length > 0, canRedo: stacks.future.length > 0 };
}

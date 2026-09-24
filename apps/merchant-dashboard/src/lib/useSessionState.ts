import { useState } from "react";

/**
 * A boolean that survives a refresh but not a new tab — `sessionStorage`
 * rather than `localStorage`, so a panel a merchant collapsed stays collapsed
 * while they work but a fresh visit (new tab, new day) starts from the
 * default again. Used for the editors' collapsible side panes: per-session is
 * enough to make the collapse "stick" without it becoming a permanent,
 * easy-to-forget setting.
 *
 * Reads happen once, at mount, from `useState`'s lazy initializer — never on
 * every render — and both the read and the write are wrapped in `try/catch`:
 * a private tab or blocked storage should degrade to the given default, not
 * throw.
 */
export function useSessionBool(key: string, initial: boolean): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? initial : raw === "1";
    } catch {
      return initial;
    }
  });

  function update(next: boolean | ((prev: boolean) => boolean)) {
    setValue((prev) => {
      const resolved = typeof next === "function" ? (next as (p: boolean) => boolean)(prev) : next;
      try {
        sessionStorage.setItem(key, resolved ? "1" : "0");
      } catch {
        // Private tab or blocked storage — the toggle still works for this render.
      }
      return resolved;
    });
  }

  return [value, update];
}

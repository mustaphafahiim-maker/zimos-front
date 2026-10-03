import { useSearchParams } from "react-router-dom";

/**
 * A list's sort choice: in the URL (?sort=), so a view can be shared and
 * survives a refresh; the last choice in localStorage as the fallback when
 * the URL names none; else the list's default (the order it has always had).
 * Only whitelisted keys are ever used — the server sorts, so a hand-edited
 * URL can't send anything else.
 */

export function resolveSort<T extends string>(
  fromUrl: string | null,
  fromStorage: string | null,
  allowed: readonly T[],
  fallback: T
): T {
  const isAllowed = (value: string | null): value is T => value !== null && (allowed as readonly string[]).includes(value);
  if (isAllowed(fromUrl)) return fromUrl;
  if (isAllowed(fromStorage)) return fromStorage;
  return fallback;
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private tab or blocked storage: the URL still carries the choice.
  }
}

/** [sort, setSort] for one list. `storageKey` names the list, e.g. "zimos.orders.sort". */
export function useListSort<T extends string>(
  storageKey: string,
  allowed: readonly T[],
  fallback: T
): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();
  const sort = resolveSort(params.get("sort"), readStored(storageKey), allowed, fallback);

  function setSort(next: T) {
    writeStored(storageKey, next);
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        out.set("sort", next);
        return out;
      },
      { replace: true }
    );
  }

  return [sort, setSort];
}

import { useCallback, useEffect, useRef, useState } from "react";

interface CachedAsyncState<T> {
  data: T | null;
  error: unknown;
  /** True only while there is nothing to show — a cached answer shows at once with `loading` false. */
  loading: boolean;
  /** True while a cached answer is on screen and a fresh one is on its way. */
  stale: boolean;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  setData: (updater: T | ((prev: T | null) => T)) => void;
}

interface Entry {
  data: unknown;
  at: number;
}

const cache = new Map<string, Entry>();
const MAX_ENTRIES = 80;

/** Forget cached answers whose key starts with `prefix` — after a save that changes a list. */
export function invalidateCached(prefix: string): void {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}

function remember(key: string, data: unknown) {
  cache.delete(key);
  cache.set(key, { data, at: Date.now() });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
}

/**
 * `useAsync` with a memory: the answer to
 * `cacheKey` is kept for the session, so a list the merchant comes back to
 * appears at once from cache and refreshes behind, instead of showing a
 * skeleton again. The first visit still loads normally.
 *
 * `cacheKey` must name everything the loader depends on (store, filters,
 * page): `orders:${workspaceId}:${stage}:${q}`. Pass `null` to skip caching.
 * `deps` work as in `useAsync`.
 */
export function useCachedAsync<T>(cacheKey: string | null, loader: () => Promise<T>, deps: unknown[]): CachedAsyncState<T> {
  const cached = cacheKey ? (cache.get(cacheKey) as Entry | undefined) : undefined;
  const [data, setDataState] = useState<T | null>(cached ? (cached.data as T) : null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(!cached);
  const [stale, setStale] = useState(Boolean(cached));
  const callId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const keyRef = useRef(cacheKey);
  keyRef.current = cacheKey;

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    const id = ++callId.current;
    const key = keyRef.current;
    const hit = key ? cache.get(key) : undefined;
    if (hit) {
      setDataState(hit.data as T);
      setLoading(false);
      setStale(true);
    } else if (!opts?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await loaderRef.current();
      if (id !== callId.current) return;
      if (key) remember(key, result);
      setDataState(result);
      setStale(false);
    } catch (err) {
      if (id === callId.current) {
        setError(err);
        setStale(false);
      }
    } finally {
      if (id === callId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater: T | ((prev: T | null) => T)) => {
    setDataState((prev) => {
      const next = typeof updater === "function" ? (updater as (p: T | null) => T)(prev) : updater;
      if (keyRef.current) remember(keyRef.current, next);
      return next;
    });
  }, []);

  return { data, error, loading, stale, refresh, setData };
}

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ContactFilter, ContactType } from "@store-builder/api-client";

export interface ContactsQuery {
  /** What is in the search field right now (never waits). */
  search: string;
  setSearch: (value: string) => void;
  /** The search as it is asked of the server: trimmed, 300ms behind the typing. */
  q: string;
  type: ContactType | null;
  setType: (type: ContactType | null) => void;
  tag: string;
  setTag: (tag: string) => void;
  segmentId: string;
  setSegment: (segmentId: string) => void;
  /** The filter as the API takes it — the list and the export read the same one. */
  filter: ContactFilter;
  /** Names the filter: the cache key of the list, and what a fresh selection starts on. */
  key: string;
  /** Filters in effect, the search not counted (it has its own field). */
  activeCount: number;
  /** Anything narrowing the list, the search included. */
  narrowed: boolean;
  clearFilters: () => void;
  clearAll: () => void;
}

function parseType(value: string | null): ContactType | null {
  return value === "customer" || value === "lead" ? value : null;
}

/**
 * What the contacts list is narrowed by, kept in the URL so a filtered list
 * can be linked to and is still there after Back: `?q=` (the search),
 * `?type=customer|lead`, `?tag=` and `?segment=` (a saved segment — the
 * parameter the page always had). Every change replaces the entry in history;
 * the other parameters of the page (`tab`, `group`) are left as they are.
 *
 * The search field is its own state, so typing never stutters: the URL — and
 * with it the request — follows 300ms after the last key.
 */
export function useContactsQuery(): ContactsQuery {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim();
  const type = parseType(searchParams.get("type"));
  const tag = searchParams.get("tag") ?? "";
  const segmentId = searchParams.get("segment") ?? "";

  const patch = (changes: Record<string, string | null>) =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        for (const [name, value] of Object.entries(changes)) {
          if (value) params.set(name, value);
          else params.delete(name);
        }
        return params;
      },
      { replace: true }
    );

  const [search, setSearch] = useState(q);
  // The field leads; the URL follows a moment after the last key.
  useEffect(() => {
    const next = search.trim();
    if (next === q) return;
    const id = window.setTimeout(() => patch({ q: next || null }), 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  // The URL changed from outside the field (Back, «امسح الكل», a link): the field shows it.
  useEffect(() => {
    setSearch((current) => (current.trim() === q ? current : q));
  }, [q]);

  const filter = useMemo<ContactFilter>(
    () => ({ q: q || undefined, type: type ?? undefined, tag: tag || undefined, segmentId: segmentId || undefined }),
    [q, type, tag, segmentId]
  );
  const key = `${q}|${type ?? ""}|${tag}|${segmentId}`;
  const activeCount = (type ? 1 : 0) + (tag ? 1 : 0) + (segmentId ? 1 : 0);

  return {
    search,
    setSearch,
    q,
    type,
    setType: (next) => patch({ type: next }),
    tag,
    setTag: (next) => patch({ tag: next || null }),
    segmentId,
    setSegment: (next) => patch({ segment: next || null }),
    filter,
    key,
    activeCount,
    narrowed: activeCount > 0 || q !== "",
    clearFilters: () => patch({ type: null, tag: null, segment: null }),
    clearAll: () => {
      setSearch("");
      patch({ q: null, type: null, tag: null, segment: null });
    },
  };
}

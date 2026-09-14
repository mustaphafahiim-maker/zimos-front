"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "@/components/Icons";
import { input } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";

export const SEARCH_INPUT_ID = "store-search";
export const FOCUS_SEARCH_FLAG = "zimos_focus_search";

/**
 * Debounced product search bound to `?q=`. The server page reads `q` and passes
 * it to the public products endpoint's `search` param (name ILIKE on the API).
 */
export function CatalogSearch() {
  const { t } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const [value, setValue] = useState(urlQ);
  const ref = useRef<HTMLInputElement>(null);
  const lastPushed = useRef(urlQ);

  // Back/forward navigation changes the URL under us.
  useEffect(() => {
    if (urlQ !== lastPushed.current) {
      lastPushed.current = urlQ;
      setValue(urlQ);
    }
  }, [urlQ]);

  // Opened from the header search button on another page.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(FOCUS_SEARCH_FLAG)) {
        window.sessionStorage.removeItem(FOCUS_SEARCH_FLAG);
        ref.current?.focus();
      }
    } catch {
      /* ignore */
    }
  }, []);

  function commit(next: string) {
    const q = next.trim();
    if (q === lastPushed.current.trim()) return;
    lastPushed.current = q;
    const sp = new URLSearchParams(params.toString());
    if (q) sp.set("q", q.slice(0, 200));
    else sp.delete("q");
    sp.delete("search");
    const qs = sp.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    const id = window.setTimeout(() => commit(value), 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        commit(value);
      }}
      className="relative w-full sm:max-w-xs"
    >
      <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
        {t.browse.search}
      </label>
      <SearchIcon size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input
        ref={ref}
        id={SEARCH_INPUT_ID}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        maxLength={200}
        value={value}
        placeholder={t.browse.searchPlaceholder}
        onChange={(e) => setValue(e.target.value)}
        className={`${input} ps-10`}
      />
    </form>
  );
}

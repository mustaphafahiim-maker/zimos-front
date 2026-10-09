import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import {
  cachedProductsPage,
  catalogCacheKey,
  forgetProductsOf,
  patchCachedProducts,
  rememberProductsPage,
} from "./catalogListCache";
import { TAB_STATUS, type CatalogQuery, type CatalogTab } from "./useCatalogQuery";

/** One page of the list, as before (GET /catalog/products?limit=50). */
const PAGE_SIZE = 50;
/** A kept page of another tab younger than this is not read again for the chips' counts. */
const FRESH_MS = 60_000;
/** The tabs read behind the list for the chips: "all" also answers شغّال and مسودة when it is the whole list. */
const COUNT_TABS: readonly CatalogTab[] = ["all", "archived"];

/** One empty list for every render that has nothing to show, so what depends on the rows does not start over. */
const NO_PRODUCTS: Product[] = [];

interface Answer {
  key: string;
  items: Product[];
  nextCursor: string | null;
}

function inTab(product: Product, tab: CatalogTab): boolean {
  return tab === "all" ? product.status !== "archived" : product.status === tab;
}

/**
 * The products of the list, for one query, and how many each status holds.
 *
 * Loaded as before — `GET /catalog/products` a page of 50 at a time — with a
 * memory in front (catalogListCache.ts): a list seen before in this session is
 * on screen at once, from its last first page, while the fresh one is fetched
 * behind it. Only a list never seen shows the skeleton.
 *
 * An edit made in place is written into the rows on screen and into the kept
 * pages (`patchProduct`), so nothing has to be read again for the new value to
 * show — and so Undo is just the same write with the old value.
 *
 * The API has no count of products per status. A status chip gets its figure
 * when the list it stands for is known whole — one page that had no next page.
 * «الكل» known whole also answers «شغّال» and «مسودة» (and stands in as their
 * first page while theirs is read). The lists not on screen («الكل», «المؤرشف»)
 * are read once, quietly, after the one on screen; a chip whose list is longer
 * than a page simply shows no figure.
 */
export function useCatalogData(query: CatalogQuery) {
  const { workspaceId, tab, listKey, filterKey } = query;
  // The loader reads the filters of the render it runs after; `listKey` names them.
  const filters = useRef(query.apiFilters);
  filters.current = query.apiFilters;

  const [answer, setAnswer] = useState<Answer | null>(null);
  const [failure, setFailure] = useState<{ key: string; error: unknown } | null>(null);
  /** The list whose first page is on its way. */
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [more, setMore] = useState<{ loading: boolean; error: unknown }>({ loading: false, error: null });
  // A kept page changed (another tab was read, an edit was written through): the counts are worked out again.
  const [cacheTick, setCacheTick] = useState(0);
  // Only the latest first-page request may say what is on screen.
  const run = useRef(0);

  const loadFirst = useCallback((key: string, store: string, forTab: CatalogTab) => {
    const mine = ++run.current;
    setBusyKey(key);
    setMore({ loading: false, error: null });
    apiClient.listProducts(store, { status: TAB_STATUS[forTab], limit: PAGE_SIZE, ...filters.current }).then(
      (r) => {
        rememberProductsPage(key, { items: r.products, nextCursor: r.nextCursor });
        if (mine !== run.current) return;
        setAnswer({ key, items: r.products, nextCursor: r.nextCursor });
        setFailure(null);
        setBusyKey(null);
      },
      (error: unknown) => {
        if (mine !== run.current) return;
        setFailure({ key, error });
        setBusyKey(null);
      }
    );
  }, []);

  useEffect(() => {
    loadFirst(listKey, workspaceId, tab);
    // `listKey` names the store, the tab and the filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  // ---- the rows ----------------------------------------------------------
  /** The first page is in, and it is this list's. */
  const loaded = answer !== null && answer.key === listKey;
  const failed = failure !== null && failure.key === listKey;
  /** A first page is on its way (also in the render before the request starts). */
  const busy = busyKey === listKey || (!loaded && !failed);

  /** What memory has for this list: its own last first page, or — for شغّال / مسودة — their share of a whole «الكل». */
  const kept = useMemo(() => {
    const own = cachedProductsPage(listKey);
    if (own) return own.items;
    if (tab === "active" || tab === "draft") {
      const all = cachedProductsPage(catalogCacheKey(workspaceId, "all", filterKey));
      if (all && all.nextCursor === null) return all.items.filter((product) => product.status === tab);
    }
    return null;
    // `cacheTick` and `answer`: the kept pages are written when either changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey, cacheTick, answer]);

  const rows: Product[] = loaded && answer ? answer.items : (kept ?? NO_PRODUCTS);
  const settled = loaded && !busy;
  const nextCursor = loaded && answer ? answer.nextCursor : null;

  // ---- the other tabs, read quietly for the counts ------------------------
  useEffect(() => {
    if (!settled) return;
    let cancelled = false;
    void (async () => {
      for (const other of COUNT_TABS) {
        if (other === tab) continue;
        const key = catalogCacheKey(workspaceId, other, filterKey);
        const had = cachedProductsPage(key);
        if (had && Date.now() - had.at < FRESH_MS) continue;
        try {
          const r = await apiClient.listProducts(workspaceId, { status: TAB_STATUS[other], limit: PAGE_SIZE, ...filters.current });
          if (cancelled) return;
          rememberProductsPage(key, { items: r.products, nextCursor: r.nextCursor });
          setCacheTick((n) => n + 1);
        } catch {
          // A count is a nicety: its chip stays without a figure.
        }
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey, settled]);

  // ---- how many each status holds ----------------------------------------
  const counts = useMemo(() => {
    /** A tab's list when all of it is known. */
    const whole = (forTab: CatalogTab): Product[] | null => {
      if (forTab === tab && loaded && answer) return answer.nextCursor === null ? answer.items : null;
      const page = cachedProductsPage(catalogCacheKey(workspaceId, forTab, filterKey));
      return page && page.nextCursor === null ? page.items : null;
    };
    const count = (forTab: CatalogTab): number | null => {
      // The list on screen first, then «الكل» (which holds both live statuses), then the tab's own kept page.
      const source =
        (forTab === tab ? whole(forTab) : null) ?? (forTab !== "archived" ? whole("all") : null) ?? whole(forTab);
      return source ? source.filter((product) => inTab(product, forTab)).length : null;
    };
    return { all: count("all"), active: count("active"), draft: count("draft"), archived: count("archived") };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey, loaded, answer, cacheTick]);

  function loadMore() {
    if (!settled || !answer || answer.nextCursor === null || more.loading) return;
    const key = listKey;
    const mine = run.current;
    setMore({ loading: true, error: null });
    apiClient
      .listProducts(workspaceId, { status: TAB_STATUS[tab], cursor: answer.nextCursor, limit: PAGE_SIZE, ...filters.current })
      .then(
        (r) => {
          // A newer first page replaced the list meanwhile: this page belongs to the old one.
          if (mine !== run.current) return;
          setAnswer((prev) => (prev && prev.key === key ? { key, items: [...prev.items, ...r.products], nextCursor: r.nextCursor } : prev));
          setMore({ loading: false, error: null });
        },
        (error: unknown) => {
          if (mine !== run.current) return;
          setMore({ loading: false, error });
        }
      );
  }

  function reload() {
    loadFirst(listKey, workspaceId, tab);
  }

  /** Writes a change into the rows on screen and into every kept page that holds the product. */
  const patchProduct = useCallback(
    (productId: string, change: (product: Product) => Product) => {
      setAnswer((prev) => (prev ? { ...prev, items: prev.items.map((product) => (product.id === productId ? change(product) : product)) } : prev));
      patchCachedProducts(workspaceId, productId, change);
      setCacheTick((n) => n + 1);
    },
    [workspaceId]
  );

  return {
    rows,
    /** Nothing to show yet: the skeleton. */
    showSkeleton: busy && !loaded && kept === null,
    /** Rows are on screen and a fresh first page is on its way. */
    refreshing: busy && (loaded || kept !== null),
    /** The first page is in, and it is this list's: an empty `rows` now means "no products". */
    settled,
    /** The first page could not be read. `rows` then holds what was kept from before, if anything. */
    error: failed && !busy && failure ? failure.error : null,
    /** A later page could not be read; the rows stay. */
    loadMoreError: more.error,
    hasMore: settled && nextCursor !== null,
    loadingMore: more.loading,
    loadMore,
    /** How many products each status holds under the filters in effect; null while not known. */
    counts,
    /** No count can be shown yet: the first answer is still on its way. */
    countsLoading: busy && !loaded && kept === null,
    reload,
    patchProduct,
    /**
     * After something moved products between lists (an archive, a restore, a
     * bulk edit, an import, a copy): every other list kept for this store is
     * out of date, and this one is read again.
     */
    afterChange: () => {
      forgetProductsOf(workspaceId, [listKey]);
      reload();
    },
  };
}

export type CatalogData = ReturnType<typeof useCatalogData>;

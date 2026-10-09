import { useSearchParams } from "react-router-dom";
import type { ProductListParams, ProductStatus, ProductType } from "@store-builder/api-client";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { catalogCacheKey } from "./catalogListCache";

/** "all" is every product that can still sell or be finished: archived ones have their own tab. */
export type CatalogTab = "all" | "active" | "draft" | "archived";
export const CATALOG_TABS: readonly CatalogTab[] = ["all", "active", "draft", "archived"];

/** What each tab asks the API for (GET /catalog/products?status=). */
export const TAB_STATUS: Record<CatalogTab, ProductStatus | ProductStatus[]> = {
  all: ["draft", "active"],
  active: "active",
  draft: "draft",
  archived: "archived",
};

export type StockFilter = "in" | "out";
export const STOCK_FILTERS: readonly StockFilter[] = ["in", "out"];
export const PRODUCT_TYPES: readonly ProductType[] = ["physical", "digital", "service"];

/**
 * The order of the rows. The API returns products in one fixed order and takes
 * no sort, so this is applied in the browser to the rows that are loaded;
 * "default" leaves them as they came.
 */
export type CatalogSort = "default" | "newest" | "name" | "price_asc" | "price_desc" | "stock_asc";
export const CATALOG_SORTS: readonly CatalogSort[] = ["default", "newest", "name", "price_asc", "price_desc", "stock_asc"];

/** The longest search the API reads (catalog validation: q, sku ≤ 100). */
export const SEARCH_MAX = 100;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTab(value: string | null): value is Exclude<CatalogTab, "all"> {
  return value === "active" || value === "draft" || value === "archived";
}

function isType(value: string | null): value is ProductType {
  return value !== null && (PRODUCT_TYPES as readonly string[]).includes(value);
}

function isSort(value: string | null): value is CatalogSort {
  return value !== null && (CATALOG_SORTS as readonly string[]).includes(value);
}

/**
 * Everything that decides which products the list shows, read from the URL —
 * `status` (the tab), `q` (name), `sku`, `type`, `stock`, `collection` and
 * `sort` — so a filtered list can be linked, and is still there after Back
 * from a product. Anything malformed in a hand-edited URL is ignored rather
 * than sent.
 *
 * Every change goes through `patch`: ONE write to the URL (with `replace`),
 * whatever number of parameters it touches.
 *
 * What goes to the API is exactly what went before the filters lived in the
 * URL: `q`, `sku`, `collectionId`, `productType`, `stock`, each only when set
 * (the last four are read by the server but not named by `ProductListParams`,
 * hence the cast).
 */
export function useCatalogQuery() {
  const workspaceId = useWorkspaceId();
  const [params, setParams] = useSearchParams();

  const rawStatus = params.get("status");
  const tab: CatalogTab = isTab(rawStatus) ? rawStatus : "all";
  const q = (params.get("q") ?? "").trim().slice(0, SEARCH_MAX);
  const sku = (params.get("sku") ?? "").trim().slice(0, SEARCH_MAX);
  const rawType = params.get("type");
  const type: ProductType | null = isType(rawType) ? rawType : null;
  const rawStock = params.get("stock");
  const stock: StockFilter | null = rawStock === "in" || rawStock === "out" ? rawStock : null;
  const rawCollection = (params.get("collection") ?? "").trim();
  const collectionId = UUID_RE.test(rawCollection) ? rawCollection : "";
  const rawSort = params.get("sort");
  const sort: CatalogSort = isSort(rawSort) ? rawSort : "default";

  // The same keys, in the same order, as the filter bar sent them.
  const sent: Record<string, string> = {};
  if (q) sent.q = q;
  if (sku) sent.sku = sku;
  if (collectionId) sent.collectionId = collectionId;
  if (type) sent.productType = type;
  if (stock) sent.stock = stock;
  const filterKey = JSON.stringify(sent);

  function patch(changes: Record<string, string | null | undefined>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true }
    );
  }

  /** Everything the Filters sheet holds, back to nothing. The tab and the search stay. */
  const sheetCleared: Record<string, null> = { sku: null, type: null, stock: null, collection: null, sort: null };

  // What the Filters button counts: each filter of the sheet in effect, and an order other than the usual one.
  const activeCount = (sku ? 1 : 0) + (type ? 1 : 0) + (stock ? 1 : 0) + (collectionId ? 1 : 0) + (sort !== "default" ? 1 : 0);

  return {
    workspaceId,
    tab,
    q,
    sku,
    type,
    stock,
    collectionId,
    sort,
    /** The filters as they go to the API. */
    apiFilters: sent as Partial<ProductListParams>,
    /** Names the filters: changes when the list must be read again. */
    filterKey,
    /** Names this list for the cache and the loader: the store, the tab, the filters. */
    listKey: catalogCacheKey(workspaceId, tab, filterKey),
    activeCount,
    /** The list is narrowed by something other than its tab: a search or a filter that the server applies. */
    searched: Boolean(q || sku || type || stock || collectionId),
    patch,
    setTab: (next: CatalogTab) => patch({ status: next === "all" ? null : next }),
    setSort: (next: CatalogSort) => patch({ sort: next === "default" ? null : next }),
    /** «امسح الكل» of the Filters sheet and of the chips under the toolbar. */
    clearFilters: () => patch(sheetCleared),
    /** The same and the search with it: the way out of "nothing matches". */
    clearSearchAndFilters: () => patch({ ...sheetCleared, q: null }),
  };
}

export type CatalogQuery = ReturnType<typeof useCatalogQuery>;

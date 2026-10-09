import { useEffect, useState } from "react";
import { Input } from "@store-builder/ui";
import type { ProductType } from "@store-builder/api-client";
import { FilterChoice, FilterGroup, FilterSheet } from "@/components/list";
import { Select } from "@/components/Select";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { pluralOf } from "@/lib/plural";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import type { ActiveFilterChip } from "@/pages/orders/list/ActiveFilters";
import {
  CATALOG_SORTS,
  CATALOG_TABS,
  PRODUCT_TYPES,
  SEARCH_MAX,
  STOCK_FILTERS,
  type CatalogQuery,
  type CatalogSort,
  type CatalogTab,
  type StockFilter,
} from "../list/useCatalogQuery";

const STRINGS = {
  en: {
    status: "Status",
    tabAll: "All",
    tabActive: "Active",
    tabDraft: "Draft",
    tabArchived: "Archived",
    sku: "SKU",
    skuHint: "The code you gave a variant. Finds the product that holds it.",
    skuPlaceholder: "e.g. TS-RED-M",
    collection: "Collection",
    allCollections: "All collections",
    type: "Type",
    allTypes: "All types",
    physical: "Physical",
    digital: "Digital",
    service: "Service",
    stock: "Stock",
    anyStock: "Any stock",
    inStock: "Can be sold",
    outOfStock: "Out of stock",
    sort: "Order",
    sortHint: "Arranges the products loaded so far. Load more to arrange the rest too.",
    sort_default: "As usual",
    sort_newest: "Newest first",
    sort_name: "By name",
    sort_price_asc: "Cheapest first",
    sort_price_desc: "Dearest first",
    sort_stock_asc: "Lowest stock first",
    chip: "{name}: {value}",
    show_one: "Show 1 product",
    show_other: "Show {n} products",
    showAny: "Show the products",
  },
  ar: {
    status: "الحالة",
    tabAll: "الكل",
    tabActive: "شغّال",
    tabDraft: "مسودة",
    tabArchived: "المؤرشف",
    sku: "SKU",
    skuHint: "الكود اللي كتبته للنوع. بيجيب المنتج اللي فيه.",
    skuPlaceholder: "مثلًا TS-RED-M",
    collection: "المجموعة",
    allCollections: "كل المجموعات",
    type: "النوع",
    allTypes: "كل الأنواع",
    physical: "منتج ملموس",
    digital: "منتج رقمي",
    service: "خدمة",
    stock: "المخزون",
    anyStock: "أي مخزون",
    inStock: "متاح للبيع",
    outOfStock: "نفد من المخزون",
    sort: "الترتيب",
    sortHint: "بيرتّب المنتجات اللي اتحمّلت لحد دلوقتي. اعرض كمان عشان الباقي يترتّب معاها.",
    sort_default: "زي ما هي",
    sort_newest: "الأحدث الأول",
    sort_name: "بالاسم",
    sort_price_asc: "الأرخص الأول",
    sort_price_desc: "الأغلى الأول",
    sort_stock_asc: "الأقل مخزون الأول",
    chip: "{name}: {value}",
    show_one: "اعرض منتج واحد",
    show_two: "اعرض منتجين",
    show_few: "اعرض {n} منتجات",
    show_other: "اعرض {n} منتج",
    showAny: "اعرض المنتجات",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

/** Typing a SKU settles for this long before the server is asked again: the request waits, never the field. */
const DEBOUNCE_MS = 350;

const TAB_LABEL: Record<CatalogTab, keyof Strings> = { all: "tabAll", active: "tabActive", draft: "tabDraft", archived: "tabArchived" };
const STOCK_LABEL: Record<StockFilter, keyof Strings> = { in: "inStock", out: "outOfStock" };

const NO_COLLECTIONS: readonly CollectionOption[] = [];

export interface CollectionOption {
  id: string;
  name: string;
}

/**
 * The store's collections, for the Filters sheet and for the name on a chip.
 * Kept for the session, so the sheet opens with them in place. A role that
 * cannot read them simply gets no collection filter.
 */
export function useCollectionOptions(): readonly CollectionOption[] {
  const workspaceId = useWorkspaceId();
  const collections = useCachedAsync(
    `catalog:collections:${workspaceId}`,
    (): Promise<CollectionOption[]> =>
      apiClient
        .listCollections(workspaceId)
        .then((list) => list.map((collection) => ({ id: collection.id, name: collection.name })))
        .catch(() => []),
    [workspaceId]
  );
  return collections.data ?? NO_COLLECTIONS;
}

/**
 * The filters of the sheet that are in effect, as the removable chips under
 * the toolbar: the SKU, the type, the stock, the collection, and an order
 * other than the usual one. (The status is the row of chips; the search is
 * the field.)
 */
export function useProductFilterChips(query: CatalogQuery, collections: readonly CollectionOption[]): ActiveFilterChip[] {
  const t = useT(STRINGS);
  const chips: ActiveFilterChip[] = [];
  const chip = (id: string, name: string, value: string, key: string) =>
    chips.push({ id, label: fmt(t.chip, { name, value }), onRemove: () => query.patch({ [key]: null }) });

  if (query.sku) chip("sku", t.sku, query.sku, "sku");
  if (query.type) chip("type", t.type, t[query.type], "type");
  if (query.stock) chip("stock", t.stock, t[STOCK_LABEL[query.stock]], "stock");
  if (query.collectionId) {
    const name = collections.find((collection) => collection.id === query.collectionId)?.name;
    // The name arrives with the collections; until then the chip says what kind of filter it is.
    if (name) chip("collection", t.collection, name, "collection");
    else chips.push({ id: "collection", label: t.collection, onRemove: () => query.patch({ collection: null }) });
  }
  if (query.sort !== "default") chip("sort", t.sort, t[`sort_${query.sort}`], "sort");
  return chips;
}

/**
 * The one place the products list is filtered (the kit's FilterSheet): the
 * status (the same choice as the chips over the list), the stock, the type,
 * the collection, the SKU and the order. Everything writes straight to the
 * URL (list/useCatalogQuery.ts), so the list behind is already the answer and
 * the main button only closes the sheet. What goes to the server is what the
 * old filter bar sent: `sku`, `collectionId`, `productType`, `stock`.
 */
export function ProductFilterSheet({
  open,
  onOpenChange,
  query,
  collections,
  shownCount,
  hasMore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: CatalogQuery;
  collections: readonly CollectionOption[];
  /** Products on screen for the filters in effect; null while that is not known. */
  shownCount: number | null;
  /** More pages wait on the server: the count on screen is not the whole answer. */
  hasMore: boolean;
}) {
  const t = useT(STRINGS);

  // The SKU as typed, ahead of the wait.
  const [sku, setSku] = useState(query.sku);
  // Back, a shared link or «امسح الكل» changed it under us: adopt it, unless it is just what the field already says.
  const [syncedSku, setSyncedSku] = useState(query.sku);
  if (query.sku !== syncedSku) {
    setSyncedSku(query.sku);
    if (sku.trim() !== query.sku) setSku(query.sku);
  }
  useEffect(() => {
    const next = sku.trim();
    if (next === query.sku) return;
    const timer = window.setTimeout(() => query.patch({ sku: next || null }), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // Only what was typed starts the wait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sku]);

  const applyLabel = shownCount !== null && !hasMore ? pluralOf(t, "show", shownCount) : t.showAny;

  return (
    <FilterSheet open={open} onOpenChange={onOpenChange} activeCount={query.activeCount} onReset={query.clearFilters} applyLabel={applyLabel}>
      <FilterGroup label={t.status}>
        <FilterChoice<CatalogTab>
          label={t.status}
          options={CATALOG_TABS.map((tab) => ({ value: tab, label: t[TAB_LABEL[tab]] }))}
          value={query.tab}
          onChange={(next) => query.setTab(next ?? "all")}
        />
      </FilterGroup>

      <FilterGroup label={t.stock}>
        <FilterChoice<StockFilter | "any">
          label={t.stock}
          options={[{ value: "any", label: t.anyStock }, ...STOCK_FILTERS.map((value) => ({ value, label: t[STOCK_LABEL[value]] }))]}
          value={query.stock ?? "any"}
          onChange={(next) => query.patch({ stock: next === null || next === "any" ? null : next })}
        />
      </FilterGroup>

      <FilterGroup label={t.type}>
        <FilterChoice<ProductType | "any">
          label={t.type}
          options={[{ value: "any", label: t.allTypes }, ...PRODUCT_TYPES.map((value) => ({ value, label: t[value] }))]}
          value={query.type ?? "any"}
          onChange={(next) => query.patch({ type: next === null || next === "any" ? null : next })}
        />
      </FilterGroup>

      {collections.length > 0 && (
        <FilterGroup label={t.collection}>
          <Select
            aria-label={t.collection}
            value={query.collectionId}
            onChange={(event) => query.patch({ collection: event.target.value || null })}
            className="min-h-11 w-full"
          >
            <option value="">{t.allCollections}</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </Select>
        </FilterGroup>
      )}

      <FilterGroup label={t.sku} hint={t.skuHint}>
        <Input
          aria-label={t.sku}
          placeholder={t.skuPlaceholder}
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          value={sku}
          onChange={(event) => setSku(event.target.value.slice(0, SEARCH_MAX))}
          className="min-h-11 w-full rounded-[0.875rem]"
        />
      </FilterGroup>

      <FilterGroup label={t.sort} hint={hasMore && query.sort !== "default" ? t.sortHint : undefined}>
        <FilterChoice<CatalogSort>
          label={t.sort}
          options={CATALOG_SORTS.map((value) => ({ value, label: t[`sort_${value}`] }))}
          value={query.sort}
          onChange={(next) => query.setSort(next ?? "default")}
        />
      </FilterGroup>
    </FilterSheet>
  );
}

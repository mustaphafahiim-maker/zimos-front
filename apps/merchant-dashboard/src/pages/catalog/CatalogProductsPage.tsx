import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconArchive, IconPlus, IconProductAdd, IconProducts, IconSearch } from "@/components/icons";
import { ChipRow, ListSkeleton, type ChipItem } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { PageHeader } from "@/components/PageHeader";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { markViewSource, useViewNavigate } from "@/lib/viewTransition";
import { ActiveFilters } from "@/pages/orders/list/ActiveFilters";
import { useIsDesktop } from "@/pages/orders/list/useIsDesktop";
import { MostWishedCard } from "./components/MostWishedCard";
import { ProductFilterSheet, useCollectionOptions, useProductFilterChips } from "./components/ProductFilterBar";
import { ProductBulkBar, useProductSelection } from "./components/ProductListBulk";
import { WaitingRestockCard } from "./components/WaitingRestockCard";
import { CatalogHeaderTools } from "./list/CatalogHeaderTools";
import { CatalogToolbar } from "./list/CatalogToolbar";
import { ProductCards } from "./list/ProductCards";
import { ProductGrid, ProductGridSkeleton } from "./list/ProductGrid";
import { ProductQuickLook } from "./list/ProductQuickLook";
import { productRowElement, sortRows, useProductRows, type ProductRowView } from "./list/productRow";
import { ProductsTable } from "./list/ProductsTable";
import { useCatalogData } from "./list/useCatalogData";
import { useCatalogQuery, type CatalogTab } from "./list/useCatalogQuery";
import { useCatalogView } from "./list/useCatalogView";
import { useProductActions } from "./list/useProductActions";
import { useProductEdits } from "./list/useProductEdits";
import { useProductMenu } from "./list/useProductMenu";

const STRINGS = {
  en: {
    title: "Products",
    newProduct: "Add product",
    filterLabel: "Filter products by status",
    tabAll: "All",
    tabActive: "Active",
    tabDraft: "Draft",
    tabArchived: "Archived",
    insights: "What your shoppers are telling you",
    emptyTitle: "Add your first product",
    emptyBody: "A name, a price, a quantity and one photo are enough to start selling. Variants and offers can come later.",
    addFirst: "Add your first product",
    emptyLiveTitle: "No active or draft products",
    emptyLiveBody: "Everything you have is archived. Restore a product from the archive, or add a new one.",
    showArchived: "See the archived",
    emptyActive: "No active products",
    emptyActiveBody: "A product shows up here once you set it to Active — that is when shoppers can see it.",
    emptyDraft: "No draft products",
    emptyDraftBody: "A product you are still preparing waits here, hidden from the store.",
    emptyArchived: "No archived products",
    emptyArchivedBody: "Products you archive show up here, and can be restored.",
    showAll: "See all products",
    emptyFilterTitle: "No products match this search and these filters",
    emptyFilterBody: "Try another word, or take off one of the filters in effect.",
    clearFilters: "Clear search and filters",
    refreshFailed: "Couldn't refresh the list, so this is what was loaded last.",
    loadMoreFailed: "Couldn't load more products.",
    retry: "Try again",
  },
  ar: {
    title: "المنتجات",
    newProduct: "ضيف منتج",
    filterLabel: "فلترة المنتجات حسب الحالة",
    tabAll: "الكل",
    tabActive: "شغّال",
    tabDraft: "مسودة",
    tabArchived: "المؤرشف",
    insights: "اللي عملاءك بيقولوه",
    emptyTitle: "ضيف أول منتج",
    emptyBody: "اسم وسعر وكمية وصورة واحدة كفاية عشان تبدأ تبيع. الأنواع والعروض ممكن بعدين.",
    addFirst: "ضيف أول منتج",
    emptyLiveTitle: "مفيش منتجات شغّالة أو مسودة",
    emptyLiveBody: "كل اللي عندك مؤرشف. رجّع منتج من الأرشيف، أو ضيف واحد جديد.",
    showArchived: "شوف المؤرشف",
    emptyActive: "مفيش منتجات شغّالة",
    emptyActiveBody: "المنتج بيظهر هنا أول ما تخليه شغّال — ساعتها العملاء يشوفوه.",
    emptyDraft: "مفيش منتجات مسودة",
    emptyDraftBody: "المنتج اللي لسه بتجهّزه بيستنى هنا، ومش ظاهر في المتجر.",
    emptyArchived: "مفيش منتجات مؤرشفة",
    emptyArchivedBody: "اللي هتأرشفه هيظهر هنا، وتقدر ترجّعه.",
    showAll: "شوف كل المنتجات",
    emptyFilterTitle: "مفيش منتجات بالبحث والفلاتر دي",
    emptyFilterBody: "جرّب كلمة تانية، أو شيل فلتر من اللي شغّالين.",
    clearFilters: "امسح البحث والفلاتر",
    refreshFailed: "معرفناش نحدّث القائمة، فدي آخر حاجة اتحمّلت.",
    loadMoreFailed: "معرفناش نجيب منتجات أكتر.",
    retry: "جرّب تاني",
  },
} satisfies Messages;

/**
 * The products list — «المنتجات».
 *
 * Top to bottom: the header (title, the «أدوات» menu, «ضيف منتج»), ONE
 * toolbar (search, the Filters button, the grid ↔ list switch), the status
 * chips with their counts, the chips of the filters in effect (only while any
 * is), a slim row of what shoppers are waiting for and wishing for (only when
 * there is something), then the products: a table on a sheet of glass from md
 * up and cards on a phone — or, in the grid, tiles of photos at every width.
 *
 * A row opens Quick Look; Enter on it opens the product. The price and the
 * stock are changed where they are shown, with Undo. Ticking rows raises the
 * bulk bar. The list is all in the URL (list/useCatalogQuery.ts), is kept
 * between visits and refreshes behind (list/useCatalogData.ts).
 */
export function CatalogProductsPage() {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const navigate = useViewNavigate();
  const desktop = useIsDesktop();
  const [view, setView] = useCatalogView();

  const query = useCatalogQuery();
  const data = useCatalogData(query);
  const { tab } = query;

  const built = useProductRows(data.rows);
  const rows = useMemo(() => sortRows(built, query.sort), [built, query.sort]);
  const shownIds = useMemo(() => rows.map((row) => row.product.id), [rows]);

  // The price and the stock, saved from where they are shown.
  const edits = useProductEdits(data.patchProduct);

  // ---- selection: products ticked for the bulk edit; a different list starts a fresh one ----
  const selection = useProductSelection();
  const clearSelected = selection.clear;
  // «حدّد»: brings the tick boxes out where a row has none of its own (a phone, the grid).
  const [selectMode, setSelectMode] = useState(false);
  useEffect(() => {
    clearSelected();
  }, [query.listKey, clearSelected]);
  // The table has a tick box on every row, always.
  const tableView = desktop && view === "list";
  const selecting = selectMode || selection.ids.size > 0;
  const allSelected = shownIds.length > 0 && shownIds.every((id) => selection.ids.has(id));
  const clearSelection = () => {
    selection.clear();
    setSelectMode(false);
  };

  // ---- the Filters sheet ----
  const [filtersOpen, setFiltersOpen] = useState(false);
  const collections = useCollectionOptions();
  const chips = useProductFilterChips(query, collections);

  // ---- Quick Look: the product being looked at stays here while the panel closes ----
  const [peek, setPeek] = useState<{ row: ProductRowView; open: boolean } | null>(null);
  // The preview follows the list: a price changed in place shows in the open panel too.
  const peeked = peek ? (rows.find((row) => row.product.id === peek.row.product.id) ?? peek.row) : null;

  // The row is marked as the source before leaving (and when it is peeked at, for «افتح المنتج»):
  // its name, price and status then travel into the product page's header.
  const peekProduct = (row: ProductRowView) => {
    markViewSource(productRowElement(row.product.id));
    setPeek({ row, open: true });
  };
  const openProduct = (row: ProductRowView) => {
    markViewSource(productRowElement(row.product.id));
    navigate(row.to);
  };
  const setPeekOpen = (open: boolean) => {
    setPeek((current) => (current ? { ...current, open } : current));
    if (open) return;
    // Closed without going to the product: the row is no longer the source of anything. («افتح المنتج» closes
    // the panel and navigates in the same breath — <html data-vt> is then already set, and the mark stays
    // until that transition ends and clears it itself.)
    window.setTimeout(() => {
      if (!("vt" in document.documentElement.dataset)) markViewSource(null);
    }, 0);
  };

  // ---- what can be done to one product: its row's menu and its Quick Look ----
  const actions = useProductActions({
    patchProduct: data.patchProduct,
    afterChange: data.afterChange,
    onGone: () => setPeekOpen(false),
  });
  const menuFor = useProductMenu({ actions, onOpen: openProduct, onPeek: peekProduct });

  // ---- the status chips ----
  const tabs: ChipItem<CatalogTab>[] = [
    { value: "all", label: t.tabAll, count: data.counts.all },
    { value: "active", label: t.tabActive, count: data.counts.active },
    { value: "draft", label: t.tabDraft, count: data.counts.draft },
    { value: "archived", label: t.tabArchived, count: data.counts.archived },
  ];

  // ---- what to say when there is nothing to list ----
  // Nothing to list, and not because it is still on its way. A list that was empty last time says so at
  // once, from memory, while it is read again.
  const empty = rows.length === 0 && !data.showSkeleton;

  const pill = "min-h-11 rounded-full px-5";
  const newProduct = (
    <Button asChild className={pill}>
      <Link to="/catalog/new">
        <IconPlus className="size-4" weight="bold" aria-hidden />
        {t.newProduct}
      </Link>
    </Button>
  );

  let body: ReactNode;
  if (data.showSkeleton) {
    // The shape of what is coming: tiles of photos in the grid; cards on a phone and the table's sheet from md up in the list.
    body = view === "grid" ? <ProductGridSkeleton tiles={desktop ? 10 : 6} /> : <ListSkeleton rows={8} />;
  } else if (data.error != null && (rows.length === 0 || isPermissionError(data.error))) {
    body = (
      <DataState loading={false} error={data.error} onRetry={data.reload}>
        {null}
      </DataState>
    );
  } else if (empty && query.searched) {
    body = (
      <EmptyState
        icon={<IconSearch aria-hidden />}
        title={t.emptyFilterTitle}
        description={t.emptyFilterBody}
        action={
          <Button variant="outline" className={pill} onClick={query.clearSearchAndFilters}>
            {t.clearFilters}
          </Button>
        }
      />
    );
  } else if (empty && tab === "all" && (data.counts.archived ?? 0) > 0) {
    // Nothing live, but the archive holds products: the store is not new.
    body = (
      <EmptyState
        icon={<IconArchive aria-hidden />}
        title={t.emptyLiveTitle}
        description={t.emptyLiveBody}
        action={
          <Button variant="outline" className={pill} onClick={() => query.setTab("archived")}>
            {t.showArchived}
          </Button>
        }
      />
    );
  } else if (empty && tab === "all") {
    // No product at all yet (not a tab or a filter that matched none): guide to the first one.
    body = (
      <EmptyState
        icon={<IconProductAdd aria-hidden />}
        title={t.emptyTitle}
        description={t.emptyBody}
        action={
          <Button asChild className={pill}>
            <Link to="/catalog/new">
              <IconPlus className="size-4" weight="bold" aria-hidden />
              {t.addFirst}
            </Link>
          </Button>
        }
      />
    );
  } else if (empty) {
    const words: Record<Exclude<CatalogTab, "all">, [string, string]> = {
      active: [t.emptyActive, t.emptyActiveBody],
      draft: [t.emptyDraft, t.emptyDraftBody],
      archived: [t.emptyArchived, t.emptyArchivedBody],
    };
    // "all" has its own two answers above; it never reaches here.
    const [title, description] = words[tab === "all" ? "active" : tab];
    body = (
      <EmptyState
        icon={<IconProducts aria-hidden />}
        title={title}
        description={description}
        action={
          <Button variant="outline" className={pill} onClick={() => query.setTab("all")}>
            {t.showAll}
          </Button>
        }
      />
    );
  } else {
    const shared = {
      rows,
      edits,
      selected: selection.ids,
      onToggle: selection.toggle,
      menuFor,
      onPeek: peekProduct,
      onOpen: openProduct,
    };
    body = (
      <>
        {data.error != null && (
          <Alert variant="danger" className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span>{t.refreshFailed}</span>
            <Button size="sm" variant="outline" className="min-h-11 rounded-full px-4" onClick={data.reload}>
              {t.retry}
            </Button>
          </Alert>
        )}
        {/* ONE shape is drawn, never two with one hidden by CSS: fifty products are fifty rows in the page. */}
        {view === "grid" ? (
          <ProductGrid {...shared} desktop={desktop} selecting={selecting} />
        ) : desktop ? (
          <ProductsTable {...shared} allSelected={allSelected} onToggleAll={() => selection.setAll(shownIds, !allSelected)} />
        ) : (
          <ProductCards {...shared} selecting={selecting} />
        )}
        {data.loadMoreError != null && (
          <Alert variant="danger" className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span>
              {t.loadMoreFailed} {errorMessage(data.loadMoreError)}
            </span>
            <Button size="sm" variant="outline" className="min-h-11 rounded-full px-4" onClick={data.loadMore}>
              {t.retry}
            </Button>
          </Alert>
        )}
        <LoadMore hasMore={data.hasMore} loading={data.loadingMore} onClick={data.loadMore} />
      </>
    );
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        tutorial="products"
        title={t.title}
        actions={<CatalogHeaderTools onRefresh={data.reload} refreshing={data.refreshing} onImported={data.afterChange} />}
        // The page's one creation action: in the header from md up, in the bar above the dock on a phone.
        primaryAction={newProduct}
      />

      <div className="flex flex-col gap-3">
        <CatalogToolbar
          q={query.q}
          onSearch={(next) => query.patch({ q: next })}
          filterCount={query.activeCount}
          onOpenFilters={() => setFiltersOpen(true)}
          view={view}
          onView={setView}
          selecting={tableView ? undefined : selecting}
          onSelecting={tableView ? undefined : (next) => (next ? setSelectMode(true) : clearSelection())}
        />

        {/* The status: what a merchant switches most. Four chips, so none folds away. */}
        <ChipRow
          items={tabs}
          value={tab}
          onChange={query.setTab}
          label={t.filterLabel}
          collapseEmpty={false}
          countsLoading={data.countsLoading}
        />

        <ActiveFilters chips={chips} onClearAll={query.clearFilters} />

        {/* What shoppers are waiting for and wishing for: one slim row, gone when neither has anything to say. */}
        <div
          role="group"
          aria-label={t.insights}
          data-slot="catalog-insights"
          className="-my-1 flex items-center gap-2 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] empty:hidden max-sm:-mx-4 max-sm:px-4 sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          <WaitingRestockCard />
          <MostWishedCard />
        </div>

        {/* Fixed to the foot of the page; written here so Tab reaches it before the rows. */}
        <ProductBulkBar selection={selection} shownIds={shownIds} onDone={data.afterChange} onClear={clearSelection} />

        <div aria-busy={data.refreshing || undefined} className="min-w-0">
          {body}
        </div>
      </div>

      <ProductFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        query={query}
        collections={collections}
        shownCount={data.settled ? rows.length : null}
        hasMore={data.hasMore}
      />

      <ProductQuickLook row={peeked} open={Boolean(peek?.open)} onOpenChange={setPeekOpen} edits={edits} actions={actions} />

      {/* Outside the list's own states: the dialog must survive the list reloading. */}
      {actions.dialogs}
    </div>
  );
}

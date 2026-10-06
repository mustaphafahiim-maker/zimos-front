import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, List, PackagePlus, Plus } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import type { Product, ProductStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoneyRange, formatProductCode, parseMoney } from "@/lib/format";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useProductFilters } from "./components/ProductFilterBar";
import { primaryImage } from "@/lib/media";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { DataState } from "@/components/DataState";
import { FilterTabs } from "@/components/FilterTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { ProductImage } from "@/components/ProductImage";
import { LoadMore } from "@/components/LoadMore";
import { useToast } from "@/components/Toast";
import { useCatalogLabels } from "./catalogLabels";
import { ProductRemoveDialog } from "./components/ProductRemoveDialog";
import {
  DuplicateProductButton,
  ProductTransferButton,
  ProductBulkBar,
  SelectAllCheckbox,
  SelectRowCheckbox,
  useProductSelection,
  type ProductSelection,
} from "./components/ProductListBulk";

const STRINGS = {
  en: {
    title: "Products",
    description: "Everything you sell — with variants, offers, and stock.",
    newProduct: "Add product",
    filterLabel: "Filter products by status",
    tabAll: "All",
    tabActive: "Active",
    tabDraft: "Draft",
    tabArchived: "Archived",
    listView: "List view",
    gridView: "Grid view",
    manageCollections: "Collections",
    emptyAll: "No products yet. Create your first one.",
    emptyActive: "No active products.",
    emptyDraft: "No draft products.",
    emptyArchived: "No archived products. Products you archive show up here.",
    emptyFilter: "No products match your filter.",
    colProduct: "Product",
    colStatus: "Status",
    colPrice: "Price range",
    colStock: "Stock",
    colCreated: "Created",
    notTracked: "Not tracked",
    preview: "Preview",
    previewHint: "Open it in your store",
    colActions: "Actions",
    noVariants: "No variants",
    stock: "{total} in stock · {count} variants",
    stockOne: "{total} in stock · 1 variant",
    noWeight: "No weight",
    noWeightHint: "A variant has no weight. Shipping uses your default item weight for it.",
    edit: "Edit",
    delete: "Delete",
    restore: "Restore",
    restoring: "Restoring…",
    restoreHint: "Restores the product as a draft",
    deletePermanently: "Delete permanently",
    restoredToast: "“{name}” restored as a draft. Set it to Active when it's ready to sell.",
    emptyTitle: "Add your first product",
    emptyBody: "A name, a price and one photo are enough to start selling. Variants, offers and stock can come later.",
  },
  ar: {
    title: "المنتجات",
    description: "كل حاجة بتبيعها — بأنواعها وعروضها ومخزونها.",
    newProduct: "ضيف منتج",
    filterLabel: "فلترة المنتجات حسب الحالة",
    tabAll: "الكل",
    tabActive: "شغّال",
    tabDraft: "مسودة",
    tabArchived: "المؤرشف",
    listView: "عرض القائمة",
    gridView: "عرض الشبكة",
    manageCollections: "المجموعات",
    emptyAll: "لسه مفيش منتجات. ضيف أول منتج.",
    emptyActive: "مفيش منتجات شغّالة.",
    emptyDraft: "مفيش منتجات مسودة.",
    emptyArchived: "مفيش منتجات مؤرشفة. اللي هتأرشفه هيظهر هنا.",
    emptyFilter: "مفيش منتجات بالبحث ده.",
    colProduct: "المنتج",
    colStatus: "الحالة",
    colPrice: "السعر",
    colStock: "المخزون",
    colCreated: "تاريخ الإنشاء",
    notTracked: "مش متتبّع",
    preview: "معاينة",
    previewHint: "افتحه في متجرك",
    colActions: "إجراءات",
    noVariants: "من غير أنواع",
    stock: "المخزون: {total} · {count} أنواع",
    stockOne: "المخزون: {total} · نوع واحد",
    noWeight: "من غير وزن",
    noWeightHint: "فيه نوع من غير وزن. الشحن هيستخدم الوزن الافتراضي بداله.",
    edit: "تعديل",
    delete: "حذف",
    restore: "رجّعه",
    restoring: "بنرجّعه…",
    restoreHint: "بيرجّع المنتج كمسودة",
    deletePermanently: "حذف نهائي",
    restoredToast: "«{name}» رجع كمسودة. خليه شغّال لما يبقى جاهز للبيع.",
    emptyTitle: "ضيف أول منتج",
    emptyBody: "اسم وسعر وصورة واحدة كفاية عشان تبدأ تبيع. الأنواع والعروض والمخزون ممكن بعدين.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

/** "all" is every product that can still sell or be finished: archived ones have their own tab. */
type Tab = "all" | "active" | "draft" | "archived";

const TAB_STATUS: Record<Tab, ProductStatus | ProductStatus[]> = {
  all: ["draft", "active"],
  active: "active",
  draft: "draft",
  archived: "archived",
};

type CatalogView = "list" | "grid";
const VIEW_KEY = "sb.catalogView";

function readView(): CatalogView {
  try {
    return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

function priceRange(product: Product): string {
  const variants = product.variants ?? [];
  if (variants.length === 0) return "—";
  const prices = variants.map((v) => parseMoney(v.priceAmount));
  return formatMoneyRange(Math.min(...prices), Math.max(...prices), variants[0].currency);
}

/** A live physical product with an active variant that has no weight set. */
function missingWeight(product: Product): boolean {
  if (product.productType !== "physical" || product.status === "archived") return false;
  return (product.variants ?? []).some((v) => v.status === "active" && v.weightGrams === null);
}

function NoWeightBadge({ product, t }: { product: Product; t: Strings }) {
  if (!missingWeight(product)) return null;
  return <StatusBadge value="no_weight" tone="warning" text={t.noWeight} className="ms-1.5" />;
}

function stockSummary(product: Product, t: Strings): string {
  // Digital products and services have no stock to count.
  if (product.productType === "digital" || product.productType === "service") return t.notTracked;
  // A physical product with "Track quantity" off (backend catalog/stockTracking.js).
  if ((product as Product & { trackInventory?: boolean }).trackInventory === false) return t.notTracked;
  const variants = product.variants ?? [];
  if (variants.length === 0) return t.noVariants;
  const total = variants.reduce((sum, v) => sum + v.stockOnHand, 0);
  return fmt(variants.length === 1 ? t.stockOne : t.stock, { total, count: variants.length });
}

export function CatalogProductsPage() {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [tab, setTab] = useState<Tab>("all");
  // Server-side search and filters (components/ProductFilterBar.tsx).
  const filters = useProductFilters();
  const [view, setView] = useState<CatalogView>(readView);
  const [toRemove, setToRemove] = useState<Product | null>(null);
  // Rows ticked for bulk edit (list view).
  const selection = useProductSelection();
  // Rows with a restore in flight, so a second click can't send it twice.
  const [restoring, setRestoring] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* private mode — non-fatal */
    }
  }, [view]);

  const list = useCursorList<Product>(
    (cursor) =>
      apiClient
        .listProducts(workspaceId, { status: TAB_STATUS[tab], cursor, limit: 50, ...filters.params })
        .then((r) => ({ items: r.products, nextCursor: r.nextCursor })),
    [workspaceId, tab, filters.key]
  );

  const filtered = list.items;

  async function restore(product: Product) {
    if (restoring.has(product.id)) return;
    setRestoring((prev) => new Set(prev).add(product.id));
    try {
      await apiClient.restoreProduct(workspaceId, product.id);
      toast.success(fmt(t.restoredToast, { name: product.name }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRestoring((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
      // Either way the row's real state is worth re-reading: a
      // PRODUCT_NOT_ARCHIVED means someone else already moved it.
      list.reload();
    }
  }

  const tabs = [
    { value: "all" as const, label: t.tabAll },
    { value: "active" as const, label: t.tabActive },
    { value: "draft" as const, label: t.tabDraft },
    { value: "archived" as const, label: t.tabArchived },
  ];

  const emptyByTab: Record<Tab, string> = {
    all: t.emptyAll,
    active: t.emptyActive,
    draft: t.emptyDraft,
    archived: t.emptyArchived,
  };

  function renderActions(product: Product) {
    const busy = restoring.has(product.id);
    return (
      <>
        <Button asChild size="sm" variant="ghost">
          <Link to={`/catalog/${product.id}`}>{t.edit}</Link>
        </Button>
        {product.status !== "archived" && (
          <Button asChild size="sm" variant="ghost" title={t.previewHint}>
            <a href={`${STOREFRONT_URL}/store/${workspaceId}/products/${product.slug}`} target="_blank" rel="noreferrer">
              {t.preview}
            </a>
          </Button>
        )}
        <DuplicateProductButton product={product} />
        {product.status === "archived" ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              title={t.restoreHint}
              disabled={busy}
              onClick={() => restore(product)}
            >
              {busy ? t.restoring : t.restore}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:bg-danger-soft"
              disabled={busy}
              onClick={() => setToRemove(product)}
            >
              {t.deletePermanently}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="text-danger hover:bg-danger-soft"
            onClick={() => setToRemove(product)}
          >
            {t.delete}
          </Button>
        )}
      </>
    );
  }

  const rowProps = { products: filtered, t, statusLabel: labels.status, renderActions, selection };
  // No product at all yet (not a tab or filter that matched none): guide to the first one.
  const noProductsAtAll = !list.loading && !list.error && list.items.length === 0 && tab === "all" && filtered.length === 0 && !list.hasMore;

  return (
    <div className="max-w-6xl">
      <PageHeader
        tutorial="products"
        title={t.title}
        description={t.description}
        actions={
          <>
            <ProductTransferButton onImported={list.reload} />
            <Button asChild className="min-h-11">
              <Link to="/catalog/new">
                <Plus aria-hidden />
                {t.newProduct}
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs tabs={tabs} value={tab} onChange={setTab} label={t.filterLabel} />
        {filters.bar}

        <div className="ms-auto flex items-center gap-3">
          <div className="hidden gap-1 rounded-[var(--radius)] bg-paper-sunken p-1 md:flex">
            <button
              onClick={() => setView("list")}
              aria-label={t.listView}
              aria-pressed={view === "list"}
              className={cn(
                "cursor-pointer rounded-[0.375rem] p-1.5 transition-colors",
                view === "list" ? "bg-primary-soft text-primary-dark dark:text-primary" : "text-ink-soft hover:text-ink"
              )}
            >
              <List className="size-4" aria-hidden />
            </button>
            <button
              onClick={() => setView("grid")}
              aria-label={t.gridView}
              aria-pressed={view === "grid"}
              className={cn(
                "cursor-pointer rounded-[0.375rem] p-1.5 transition-colors",
                view === "grid" ? "bg-primary-soft text-primary-dark dark:text-primary" : "text-ink-soft hover:text-ink"
              )}
            >
              <LayoutGrid className="size-4" aria-hidden />
            </button>
          </div>
          <Link to="/catalog/collections" className="inline-flex min-h-11 items-center text-sm font-medium text-primary-dark hover:underline">
            {t.manageCollections}
          </Link>
        </div>
      </div>

      <ProductBulkBar selection={selection} onDone={list.reload} />

      {noProductsAtAll ? (
        <EmptyState
          icon={<PackagePlus aria-hidden />}
          title={t.emptyTitle}
          description={t.emptyBody}
          action={
            <Button asChild className="min-h-11">
              <Link to="/catalog/new">
                <Plus aria-hidden />
                {t.newProduct}
              </Link>
            </Button>
          }
        />
      ) : (
      <DataState
        loading={list.loading}
        error={list.items.length ? null : list.error}
        empty={filtered.length === 0}
        emptyMessage={list.items.length === 0 ? emptyByTab[tab] : t.emptyFilter}
        onRetry={list.reload}
      >
        {/* A phone always gets compact cards; the table and grid start at md. */}
        <ProductCards {...rowProps} />
        <div className="hidden md:block">
          {view === "list" ? <ProductTable {...rowProps} /> : <ProductGrid {...rowProps} />}
        </div>
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>
      )}

      {toRemove && (
        <ProductRemoveDialog
          key={toRemove.id}
          product={toRemove}
          onClose={() => setToRemove(null)}
          onDone={() => {
            setToRemove(null);
            list.reload();
          }}
        />
      )}

      {Boolean(list.error) && list.items.length > 0 && (
        <p className="mt-2 text-xs text-danger">{errorMessage(list.error)}</p>
      )}
    </div>
  );
}

interface RowsProps {
  products: Product[];
  t: Strings;
  statusLabel: (status: ProductStatus) => string;
  renderActions: (product: Product) => ReactNode;
  selection: ProductSelection;
}

/** Phones: one compact card per product — photo, name, price, stock, status, and its actions. */
function ProductCards({ products, t, statusLabel, renderActions, selection }: RowsProps) {
  return (
    <>
      <div className="mb-2 flex min-h-11 items-center gap-2 text-sm text-ink-soft md:hidden">
        <SelectAllCheckbox selection={selection} products={products} withLabel />
      </div>
      <ul className="space-y-[var(--bento-gap)] md:hidden">
        {products.map((product) => (
          <li
            key={product.id}
            className="relative flex gap-3 rounded-[var(--radius-card)] bg-paper-raised p-3 shadow-[var(--shadow-card)] ring-1 ring-line"
          >
            <div className="relative z-10 flex items-start pt-1">
              <SelectRowCheckbox selection={selection} product={product} />
            </div>
            <ProductImage media={primaryImage(product)} alt="" className="size-16 shrink-0" />
            <div className="min-w-0 flex-1">
              <Link
                to={`/catalog/${product.id}`}
                className="block truncate text-[15px] font-medium text-ink after:absolute after:inset-0 after:rounded-[var(--radius-card)]"
              >
                {product.name}
              </Link>
              <p className="mt-0.5 text-sm font-semibold text-ink tabular-nums">{priceRange(product)}</p>
              <p className="text-xs text-ink-soft">{stockSummary(product, t)}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge value={product.status} text={statusLabel(product.status)} />
                <NoWeightBadge product={product} t={t} />
              </div>
              <div className="relative z-10 mt-1 flex flex-wrap justify-end gap-1">{renderActions(product)}</div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function ProductTable({ products, t, statusLabel, renderActions, selection }: RowsProps) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-line bg-paper-sunken/60 text-start text-xs text-ink-soft">
            <th className="w-10 py-3 ps-4">
              <SelectAllCheckbox selection={selection} products={products} />
            </th>
            <th className="w-14 px-4 py-3 font-medium" />
            <th className="px-4 py-3 text-start font-medium">{t.colProduct}</th>
            <th className="px-4 py-3 text-start font-medium">{t.colStatus}</th>
            <th className="px-4 py-3 text-start font-medium">{t.colPrice}</th>
            <th className="px-4 py-3 text-start font-medium">{t.colStock}</th>
            <th className="px-4 py-3 text-start font-medium">{t.colCreated}</th>
            <th className="px-4 py-3 font-medium">
              <span className="sr-only">{t.colActions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b border-line last:border-0 hover:bg-paper-raised">
              <td className="py-2 ps-4">
                <SelectRowCheckbox selection={selection} product={product} />
              </td>
              <td className="py-2 ps-4">
                <ProductImage
                  media={primaryImage(product)}
                  alt={product.name}
                  className="size-10"
                />
              </td>
              <td className="px-4 py-3">
                <Link
                  to={`/catalog/${product.id}`}
                  className="font-medium text-ink hover:text-primary"
                >
                  {product.name}
                </Link>
                {formatProductCode(product.productCode) && (
                  <span className="ms-1.5 text-xs text-ink-soft">
                    · {formatProductCode(product.productCode)}
                  </span>
                )}
                <div className="text-xs text-ink-soft">{product.slug}</div>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex flex-wrap items-center gap-y-1" title={missingWeight(product) ? t.noWeightHint : undefined}>
                  <StatusBadge value={product.status} text={statusLabel(product.status)} />
                  <NoWeightBadge product={product} t={t} />
                </span>
              </td>
              <td className="px-4 py-3 text-ink-soft">{priceRange(product)}</td>
              <td className="px-4 py-3 text-ink-soft">{stockSummary(product, t)}</td>
              <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatDate(product.createdAt)}</td>
              <td className="px-4 py-3 text-end whitespace-nowrap">{renderActions(product)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductGrid({ products, t, statusLabel, renderActions }: RowsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <div
          key={product.id}
          className="flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line transition-shadow hover:shadow-[var(--shadow-raised)]"
        >
          <Link to={`/catalog/${product.id}`} className="block">
            <ProductImage
              media={primaryImage(product)}
              alt={product.name}
              className="aspect-[4/3] w-full rounded-none border-0"
              iconClassName="size-8"
            />
          </Link>
          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to={`/catalog/${product.id}`}
                  className="font-medium text-ink hover:text-primary"
                >
                  {product.name}
                </Link>
                {formatProductCode(product.productCode) && (
                  <span className="ms-1.5 text-xs text-ink-soft">
                    · {formatProductCode(product.productCode)}
                  </span>
                )}
              </div>
              <span className="flex shrink-0 flex-col items-end gap-1" title={missingWeight(product) ? t.noWeightHint : undefined}>
                <StatusBadge value={product.status} text={statusLabel(product.status)} />
                <NoWeightBadge product={product} t={t} />
              </span>
            </div>
            <div className="mt-auto space-y-0.5 text-sm text-ink-soft">
              <div>{priceRange(product)}</div>
              <div className="text-xs">{stockSummary(product, t)}</div>
            </div>
            <div className="flex flex-wrap justify-end gap-1">{renderActions(product)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

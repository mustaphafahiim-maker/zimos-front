import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, LayoutGrid, List, Package } from "lucide-react";
import { Button, Input, cn } from "@store-builder/ui";
import type { Product, ProductStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { getErrorMessage } from "@/lib/errors";
import { formatMoneyRange, formatProductCode, parseMoney } from "@/lib/format";
import { primaryImage } from "@/lib/media";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { ProductImage } from "@/components/ProductImage";
import { LoadMore } from "@/components/LoadMore";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Products",
    description: "Everything you sell — with variants, offers, and stock.",
    newProduct: "New product",
    searchPlaceholder: "Filter loaded products by name or SKU",
    listView: "List view",
    gridView: "Grid view",
    statusFilter: "Filter by status",
    viewToggle: "Choose view",
    manageCollections: "Manage collections",
    emptyTitle: "No products yet",
    emptyDescription: "Create your first product to start selling.",
    noMatchTitle: "No products match your filter",
    noMatchDescription: "Try a different name or SKU, or switch the status tab.",
    archivedToast: "\"{name}\" archived. It's hidden from the storefront; existing orders keep their history.",
    confirmTitle: "Delete \"{name}\"?",
    confirmDescription:
      "Products are soft-deleted (archived), not removed — so past orders and inventory history stay intact. It disappears from the storefront and can't take new orders.",
    confirmLabel: "Archive product",
    colProduct: "Product",
    colPriceRange: "Price range",
    colStock: "Stock",
    noVariants: "No variants",
    stockOne: "{total} in stock · 1 variant",
    stockMany: "{total} in stock · {count} variants",
  },
  ar: {
    title: "المنتجات",
    description: "كل ما تبيعه — بمتغيّراته وعروضه ومخزونه.",
    newProduct: "منتج جديد",
    searchPlaceholder: "ابحث في المنتجات المحمّلة بالاسم أو SKU",
    listView: "عرض القائمة",
    gridView: "عرض الشبكة",
    statusFilter: "تصفية حسب الحالة",
    viewToggle: "اختر طريقة العرض",
    manageCollections: "إدارة المجموعات",
    emptyTitle: "لا توجد منتجات بعد",
    emptyDescription: "أنشئ أول منتج لتبدأ البيع.",
    noMatchTitle: "لا توجد منتجات مطابقة",
    noMatchDescription: "جرّب اسمًا أو SKU مختلفًا، أو غيّر تبويب الحالة.",
    archivedToast: "تمت أرشفة \"{name}\". أصبح مخفيًا من المتجر، وتحتفظ الطلبات السابقة بسجلها.",
    confirmTitle: "حذف \"{name}\"؟",
    confirmDescription:
      "لا تُحذف المنتجات نهائيًا بل تُؤرشف، لذلك يبقى سجل الطلبات السابقة والمخزون كما هو. سيختفي المنتج من المتجر ولن يستقبل طلبات جديدة.",
    confirmLabel: "أرشفة المنتج",
    colProduct: "المنتج",
    colPriceRange: "نطاق السعر",
    colStock: "المخزون",
    noVariants: "لا توجد متغيّرات",
    stockOne: "{total} في المخزون · متغيّر واحد",
    stockMany: "{total} في المخزون · {count} متغيّرات",
  },
} satisfies Messages;

type CatalogStrings = (typeof STRINGS)["en"];

const STATUS_LABELS: Record<Locale, Record<"" | ProductStatus, string>> = {
  en: { "": "All", active: "Active", draft: "Draft", archived: "Archived" },
  ar: { "": "الكل", active: "نشط", draft: "مسودة", archived: "مؤرشف" },
};

const STATUS_TABS: Array<"" | ProductStatus> = ["", "active", "draft", "archived"];

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

function stockSummary(product: Product, t: CatalogStrings): string {
  const variants = product.variants ?? [];
  if (variants.length === 0) return t.noVariants;
  const total = variants.reduce((sum, v) => sum + v.stockOnHand, 0);
  return variants.length === 1
    ? fmt(t.stockOne, { total })
    : fmt(t.stockMany, { total, count: variants.length });
}

export function CatalogProductsPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [status, setStatus] = useState<"" | ProductStatus>("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<CatalogView>(readView);
  const [toDelete, setToDelete] = useState<Product | null>(null);

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
        .listProducts(workspaceId, { status: status || undefined, cursor, limit: 50 })
        .then((r) => ({ items: r.products, nextCursor: r.nextCursor })),
    [workspaceId, status]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list.items;
    return list.items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.variants ?? []).some((v) => v.sku?.toLowerCase().includes(q))
    );
  }, [list.items, search]);

  async function confirmDelete() {
    if (!toDelete) return;
    const name = toDelete.name;
    await apiClient.deleteProduct(workspaceId, toDelete.id);
    toast.success(fmt(t.archivedToast, { name }));
    setToDelete(null);
    list.reload();
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button asChild>
            <Link to="/catalog/new">{t.newProduct}</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label={t.statusFilter}
          className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-paper-raised p-1"
        >
          {STATUS_TABS.map((value) => (
            <button
              key={value || "all"}
              onClick={() => setStatus(value)}
              aria-pressed={status === value}
              className={cn(
                "cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                status === value ? "bg-primary-soft text-primary-dark" : "text-ink-soft hover:text-ink"
              )}
            >
              {STATUS_LABELS[locale][value]}
            </button>
          ))}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          className="w-full sm:max-w-xs"
        />

        <div className="ms-auto flex items-center gap-3">
          <div
            role="group"
            aria-label={t.viewToggle}
            className="flex gap-1 rounded-xl border border-line bg-paper-raised p-1"
          >
            <button
              onClick={() => setView("list")}
              aria-label={t.listView}
              title={t.listView}
              aria-pressed={view === "list"}
              className={cn(
                "cursor-pointer rounded-lg p-1.5 transition-colors",
                view === "list" ? "bg-primary-soft text-primary-dark" : "text-ink-soft hover:text-ink"
              )}
            >
              <List className="size-4" aria-hidden />
            </button>
            <button
              onClick={() => setView("grid")}
              aria-label={t.gridView}
              title={t.gridView}
              aria-pressed={view === "grid"}
              className={cn(
                "cursor-pointer rounded-lg p-1.5 transition-colors",
                view === "grid" ? "bg-primary-soft text-primary-dark" : "text-ink-soft hover:text-ink"
              )}
            >
              <LayoutGrid className="size-4" aria-hidden />
            </button>
          </div>
          <Link
            to="/catalog/collections"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {t.manageCollections}
            <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
          </Link>
        </div>
      </div>

      <DataState
        loading={list.loading}
        error={list.items.length ? null : list.error}
        onRetry={list.reload}
      >
        {filtered.length === 0 ? (
          list.items.length === 0 ? (
            <EmptyState
              icon={<Package aria-hidden />}
              title={t.emptyTitle}
              description={t.emptyDescription}
              action={
                <Button asChild>
                  <Link to="/catalog/new">{t.newProduct}</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState title={t.noMatchTitle} description={t.noMatchDescription} />
          )
        ) : view === "list" ? (
          <ProductTable products={filtered} onDelete={setToDelete} />
        ) : (
          <ProductGrid products={filtered} onDelete={setToDelete} />
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>

      <ConfirmDialog
        open={toDelete !== null}
        title={fmt(t.confirmTitle, { name: toDelete?.name ?? "" })}
        description={t.confirmDescription}
        confirmLabel={t.confirmLabel}
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />

      {Boolean(list.error) && list.items.length > 0 && (
        <p className="mt-2 text-xs text-danger">{getErrorMessage(list.error)}</p>
      )}
    </div>
  );
}

function ProductTable({
  products,
  onDelete,
}: {
  products: Product[];
  onDelete: (p: Product) => void;
}) {
  const t = useT(STRINGS);
  const c = useCommon();
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line bg-paper text-start text-xs uppercase tracking-wide text-ink-soft">
            <th className="w-14 px-4 py-3 font-medium" />
            <th className="px-4 py-3 text-start font-medium">{t.colProduct}</th>
            <th className="px-4 py-3 text-start font-medium">{c.status}</th>
            <th className="px-4 py-3 text-start font-medium">{t.colPriceRange}</th>
            <th className="px-4 py-3 text-start font-medium">{t.colStock}</th>
            <th className="px-4 py-3 font-medium">
              <span className="sr-only">{c.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b border-line last:border-0 hover:bg-paper">
              <td className="py-2 ps-4">
                <ProductImage media={primaryImage(product)} alt={product.name} className="size-10" />
              </td>
              <td className="px-4 py-3">
                <Link to={`/catalog/${product.id}`} className="font-medium text-ink hover:text-primary">
                  {product.name}
                </Link>
                {formatProductCode(product.productCode) && (
                  <span className="ms-1.5 text-xs text-ink-soft">
                    · <bdi dir="ltr">{formatProductCode(product.productCode)}</bdi>
                  </span>
                )}
                <div className="text-xs text-ink-soft">
                  <bdi dir="ltr">{product.slug}</bdi>
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge value={product.status} />
              </td>
              <td className="px-4 py-3 text-ink-soft">
                <bdi dir="ltr">{priceRange(product)}</bdi>
              </td>
              <td className="px-4 py-3 text-ink-soft">{stockSummary(product, t)}</td>
              <td className="px-4 py-3 text-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:bg-danger-soft"
                  onClick={() => onDelete(product)}
                >
                  {c.delete}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductGrid({
  products,
  onDelete,
}: {
  products: Product[];
  onDelete: (p: Product) => void;
}) {
  const t = useT(STRINGS);
  const c = useCommon();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <div
          key={product.id}
          className="flex flex-col overflow-hidden rounded-2xl border border-line bg-paper-raised transition-colors hover:border-primary"
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
                <Link to={`/catalog/${product.id}`} className="font-medium text-ink hover:text-primary">
                  {product.name}
                </Link>
                {formatProductCode(product.productCode) && (
                  <span className="ms-1.5 text-xs text-ink-soft">
                    · <bdi dir="ltr">{formatProductCode(product.productCode)}</bdi>
                  </span>
                )}
              </div>
              <StatusBadge value={product.status} />
            </div>
            <div className="mt-auto space-y-0.5 text-sm text-ink-soft">
              <div>
                <bdi dir="ltr">{priceRange(product)}</bdi>
              </div>
              <div className="text-xs">{stockSummary(product, t)}</div>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="text-danger hover:bg-danger-soft"
                onClick={() => onDelete(product)}
              >
                {c.delete}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

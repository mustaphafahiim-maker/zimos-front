import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, List } from "lucide-react";
import { Button, Card, Input, cn } from "@store-builder/ui";
import type { Product, ProductStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { getErrorMessage } from "@/lib/errors";
import { formatMoneyRange, formatProductCode, parseMoney } from "@/lib/format";
import { primaryImage } from "@/lib/media";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type Column } from "@/components/DataTable";
import { FilterTabs, type FilterTab } from "@/components/FilterTabs";
import { ProductImage } from "@/components/ProductImage";
import { LoadMore } from "@/components/LoadMore";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const STATUS_TABS: ReadonlyArray<FilterTab<"" | ProductStatus>> = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

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

function stockSummary(product: Product): string {
  const variants = product.variants ?? [];
  if (variants.length === 0) return "No variants";
  const total = variants.reduce((sum, v) => sum + v.stockOnHand, 0);
  return `${total} in stock · ${variants.length} variant${variants.length === 1 ? "" : "s"}`;
}

export function CatalogProductsPage() {
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
    toast.success(
      `"${name}" archived. It's hidden from the storefront; existing orders keep their history.`
    );
    setToDelete(null);
    list.reload();
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Products"
        description="Everything you sell — with variants, offers, and stock."
        actions={
          <Button asChild>
            <Link to="/catalog/new">New product</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs
          tabs={STATUS_TABS}
          value={status}
          onChange={setStatus}
          label="Filter products by status"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter loaded products by name or SKU"
          className="max-w-xs"
        />

        <div className="ms-auto flex items-center gap-3">
          <div className="inline-flex gap-1 rounded-lg bg-paper-raised p-1 shadow-xs ring-1 ring-foreground/10">
            <button
              onClick={() => setView("list")}
              aria-label="List view"
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
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              className={cn(
                "cursor-pointer rounded-[0.375rem] p-1.5 transition-colors",
                view === "grid" ? "bg-primary-soft text-primary-dark dark:text-primary" : "text-ink-soft hover:text-ink"
              )}
            >
              <LayoutGrid className="size-4" aria-hidden />
            </button>
          </div>
          <Link to="/catalog/collections" className="text-sm text-primary hover:underline">
            Manage collections →
          </Link>
        </div>
      </div>

      <DataState
        loading={list.loading}
        error={list.items.length ? null : list.error}
        empty={filtered.length === 0}
        emptyMessage={
          list.items.length === 0
            ? "No products yet. Create your first one."
            : "No products match your filter."
        }
        onRetry={list.reload}
      >
        {view === "list" ? (
          <ProductTable products={filtered} onDelete={setToDelete} />
        ) : (
          <ProductGrid products={filtered} onDelete={setToDelete} />
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.name ?? ""}"?`}
        description="Products are soft-deleted (archived), not removed — so past orders and inventory history stay intact. It disappears from the storefront and can't take new orders."
        confirmLabel="Archive product"
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
  const columns: ReadonlyArray<Column<Product>> = [
    {
      key: "image",
      header: "",
      headerClassName: "w-14",
      cell: (product) => (
        <ProductImage media={primaryImage(product)} alt={product.name} className="size-10" />
      ),
    },
    {
      key: "product",
      header: "Product",
      cell: (product) => (
        <>
          <Link to={`/catalog/${product.id}`} className="font-medium text-ink hover:text-primary">
            {product.name}
          </Link>
          {formatProductCode(product.productCode) && (
            <span className="ms-1.5 text-xs text-ink-soft">
              · {formatProductCode(product.productCode)}
            </span>
          )}
          <div className="text-xs text-ink-soft">{product.slug}</div>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (product) => <StatusBadge value={product.status} />,
    },
    {
      key: "price",
      header: "Price range",
      className: "text-ink-soft",
      cell: (product) => priceRange(product),
    },
    {
      key: "stock",
      header: "Stock",
      className: "text-ink-soft",
      cell: (product) => stockSummary(product),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (product) => (
        <Button
          size="sm"
          variant="ghost"
          className="text-danger hover:bg-danger-soft"
          onClick={() => onDelete(product)}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <Card className="gap-0 p-0">
      <DataTable columns={columns} rows={products} rowKey={(product) => product.id} minWidth="45rem" />
    </Card>
  );
}

function ProductGrid({
  products,
  onDelete,
}: {
  products: Product[];
  onDelete: (p: Product) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <div
          key={product.id}
          className="flex flex-col overflow-hidden rounded-xl bg-paper-raised shadow-xs ring-1 ring-foreground/10 transition-shadow hover:shadow-md"
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
              <StatusBadge value={product.status} />
            </div>
            <div className="mt-auto space-y-0.5 text-sm text-ink-soft">
              <div>{priceRange(product)}</div>
              <div className="text-xs">{stockSummary(product)}</div>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="text-danger hover:bg-danger-soft"
                onClick={() => onDelete(product)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

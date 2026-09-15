import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Layers, Package, Search } from "lucide-react";
import type { Offer, Product, Variant } from "@store-builder/api-client";
import { Button, Input, cn, useAsync } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { OffersSection } from "@/pages/catalog/components/OffersSection";

const STRINGS = {
  en: {
    title: "Offers & bundles",
    description: "Quantity offers and bundles for your products. They show on the product page and are priced by the backend at checkout.",
    kpiProducts: "Products with offers",
    kpiOffers: "Active offers",
    kpiDefault: "Products with a default offer",
    search: "Search products",
    colProduct: "Product",
    colOffers: "Offers",
    colDefault: "Default offer",
    manage: "Manage offers",
    none: "No offers yet",
    noProducts: "Add products first, then create offers for them.",
    addProduct: "Add a product",
    back: "All products",
    editProduct: "Open product",
    offersCount: "{n} offers",
    tip: "Tip: create two or more offers on a product (for example 1 piece, 2 pieces, 3 pieces) and the product page shows them as choices.",
  },
  ar: {
    title: "العروض والباقات",
    description: "عروض الكميات والباقات لمنتجاتك. بتظهر في صفحة المنتج، والسيرفر هو اللي بيحسب سعرها وقت الطلب.",
    kpiProducts: "منتجات عليها عروض",
    kpiOffers: "عروض شغالة",
    kpiDefault: "منتجات ليها عرض افتراضي",
    search: "دوّر على منتج",
    colProduct: "المنتج",
    colOffers: "العروض",
    colDefault: "العرض الافتراضي",
    manage: "إدارة العروض",
    none: "مفيش عروض لسه",
    noProducts: "ضيف منتجات الأول، وبعدين اعمل عليها عروض.",
    addProduct: "ضيف منتج",
    back: "كل المنتجات",
    editProduct: "افتح المنتج",
    offersCount: "{n} عروض",
    tip: "نصيحة: اعمل عرضين أو أكتر على المنتج (مثلًا قطعة، قطعتين، 3 قطع) وصفحة المنتج هتعرضهم كاختيارات.",
  },
} satisfies Messages;

interface Row {
  product: Product;
  offers: Offer[];
}

/** Loads the catalogue (active + draft) and each product's real offers. */
async function loadRows(workspaceId: string): Promise<Row[]> {
  const products: Product[] = [];
  for (const status of ["active", "draft"] as const) {
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const res = await apiClient.listProducts(workspaceId, { status, limit: 100, cursor });
      products.push(...res.products);
      if (!res.nextCursor || res.nextCursor === cursor) break;
      cursor = res.nextCursor;
    }
  }
  const offers = await Promise.all(products.map((p) => apiClient.listOffers(workspaceId, p.id).catch((): Offer[] => [])));
  return products.map((product, i) => ({ product, offers: offers[i].filter((o) => o.status !== "archived") }));
}

export function OffersPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useAsync(() => loadRows(workspaceId), [workspaceId]);
  const detail = useAsync(
    () => (selected ? Promise.all([apiClient.getProduct(workspaceId, selected), apiClient.listOffers(workspaceId, selected)]) : Promise.resolve(null)),
    [workspaceId, selected]
  );

  const list = rows.data ?? [];
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? list.filter((r) => r.product.name.toLowerCase().includes(q)) : list;
  }, [list, search]);

  const kpis = useMemo(
    () => ({
      products: list.filter((r) => r.offers.length > 0).length,
      offers: list.reduce((n, r) => n + r.offers.filter((o) => o.status === "active").length, 0),
      withDefault: list.filter((r) => r.offers.some((o) => o.isDefault)).length,
    }),
    [list]
  );

  if (selected) {
    const product = detail.data?.[0];
    const offers = detail.data?.[1] ?? [];
    return (
      <div className="max-w-4xl space-y-4">
        <button type="button" onClick={() => setSelected(null)} className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t.back}
        </button>
        <DataState loading={detail.loading} error={detail.error} onRetry={() => detail.refresh()}>
          {product && (
            <>
              <PageHeader
                title={product.name}
                description={t.tip}
                actions={
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/catalog/${product.id}`}>{t.editProduct}</Link>
                  </Button>
                }
              />
              <OffersSection
                productId={product.id}
                offers={offers.filter((o) => o.status !== "archived")}
                variants={(product.variants ?? []) as Variant[]}
                onChanged={() => {
                  void detail.refresh({ silent: true });
                  void rows.refresh({ silent: true });
                }}
              />
            </>
          )}
        </DataState>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={t.title} description={t.description} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label={t.kpiProducts} value={kpis.products} />
        <KpiCard label={t.kpiOffers} value={kpis.offers} />
        <KpiCard label={t.kpiDefault} value={kpis.withDefault} />
      </div>

      <p className="rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary">{t.tip}</p>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} aria-label={t.search} className="ps-9" dir="auto" />
      </div>

      <DataState
        loading={rows.loading}
        error={rows.error}
        empty={list.length === 0}
        emptyMessage={t.noProducts}
        onRetry={() => rows.refresh()}
      >
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 text-start font-medium">{t.colProduct}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colOffers}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colDefault}</th>
                <th className="px-4 py-3 text-end font-medium" />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ product, offers }) => {
                const def = offers.find((o) => o.isDefault);
                return (
                  <tr key={product.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-4 py-3 text-start">
                      <span className="flex items-center gap-2 font-medium text-ink">
                        <Package className="size-4 text-ink-muted" aria-hidden />
                        <span dir="auto">{product.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-start">
                      <span className={cn("inline-flex items-center gap-1.5", offers.length ? "text-ink" : "text-ink-muted")}>
                        <Layers className="size-4" aria-hidden />
                        {offers.length ? fmt(t.offersCount, { n: offers.length }) : t.none}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-start text-ink-soft" dir="auto">
                      {def ? def.name : "—"}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button size="sm" variant="outline" onClick={() => setSelected(product.id)}>
                        {t.manage}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.length === 0 && (
          <Button asChild size="sm" className="mt-4">
            <Link to="/catalog/new">{t.addProduct}</Link>
          </Button>
        )}
      </DataState>
    </div>
  );
}

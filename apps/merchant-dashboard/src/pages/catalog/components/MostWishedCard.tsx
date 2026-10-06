import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Button } from "@store-builder/ui";
import { wishlistTopProducts, type MostWishedProduct } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Section } from "@/components/Section";
import { Modal } from "@/components/Modal";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { useCatalogLabels } from "../catalogLabels";

const STRINGS = {
  en: {
    title: "Most wished",
    answer: "“{name}” is on the wishlist of {shoppers}",
    shoppers_one: "1 shopper",
    shoppers_other: "{n} shoppers",
    seeAll: "See all",
    listTitle: "Most wished products",
    listHint: "Shoppers signed in to your store save products with the heart. A product you archive stays on their lists.",
    colProduct: "Product",
    colShoppers: "Shoppers",
    colLast: "Last added",
    loadFailed: "We couldn't load the most wished products.",
    retry: "Try again",
  },
  ar: {
    title: "الأكتر في المفضلة",
    answer: "«{name}» في مفضلة {shoppers}",
    shoppers_one: "عميل واحد",
    shoppers_two: "عميلين",
    shoppers_few: "{n} عملاء",
    shoppers_other: "{n} عميل",
    seeAll: "اعرض الكل",
    listTitle: "المنتجات الأكتر في المفضلة",
    listHint: "العملاء اللي عاملين حساب في متجرك بيحفظوا المنتجات بالقلب. المنتج اللي تأرشفه بيفضل في مفضلتهم.",
    colProduct: "المنتج",
    colShoppers: "العملاء",
    colLast: "آخر إضافة",
    loadFailed: "معرفناش نجيب المنتجات الأكتر في المفضلة.",
    retry: "جرّب تاني",
  },
} satisfies Messages;

const SHOWN = 3;

/**
 * Products → «الأكتر في المفضلة» (frontend-handoff 188): the products most
 * often on shoppers' wishlists, with how many shoppers saved each. Nothing
 * shows while no shopper has saved anything (most stores have accounts off),
 * so the product list stays first; an error says so with a retry.
 */
export function MostWishedCard() {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const workspaceId = useWorkspaceId();
  const [open, setOpen] = useState(false);
  const top = useAsync(() => wishlistTopProducts(apiClient, workspaceId, 20), [workspaceId]);

  const shoppers = (n: number) => pluralOf(t, "shoppers", n);
  const products = top.data?.products ?? [];

  if (top.loading || isPermissionError(top.error)) return null;
  if (top.error) {
    return (
      <Section title={t.title}>
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-danger">
          <span>{t.loadFailed}</span>
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => void top.refresh()}>
            {t.retry}
          </Button>
        </div>
      </Section>
    );
  }
  if (products.length === 0) return null;

  const first = products[0];
  const columns: Column<MostWishedProduct>[] = [
    {
      key: "product",
      header: t.colProduct,
      cell: (p) => (
        <span className="flex flex-wrap items-center gap-2">
          <Link to={`/catalog/${p.productId}`} className="font-medium text-ink hover:text-primary-dark hover:underline">
            {p.name}
          </Link>
          {p.status !== "active" && <StatusBadge value={p.status} text={labels.status(p.status)} />}
        </span>
      ),
    },
    { key: "shoppers", header: t.colShoppers, align: "end", cell: (p) => <span className="tabular-nums">{shoppers(p.shoppers)}</span> },
    { key: "last", header: t.colLast, cell: (p) => formatDate(p.lastAddedAt) },
  ];

  return (
    <Section
      title={t.title}
      description={fmt(t.answer, { name: first.name, shoppers: shoppers(first.shoppers) })}
      actions={
        products.length > SHOWN ? (
          <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setOpen(true)}>
            {t.seeAll}
          </Button>
        ) : undefined
      }
    >
      <ul className="divide-y divide-line">
        {products.slice(0, SHOWN).map((p) => (
          <li key={p.productId} className="flex min-h-11 items-center gap-3 py-1.5">
            <Heart className="size-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
            <Link to={`/catalog/${p.productId}`} className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-primary-dark hover:underline">
              {p.name}
            </Link>
            {p.status !== "active" && <StatusBadge value={p.status} text={labels.status(p.status)} />}
            <span className="shrink-0 text-sm text-ink-soft tabular-nums">{shoppers(p.shoppers)}</span>
          </li>
        ))}
      </ul>

      <Modal open={open} onClose={() => setOpen(false)} title={t.listTitle} description={t.listHint}>
        <DataTable columns={columns} rows={products} rowKey={(p) => p.productId} />
      </Modal>
    </Section>
  );
}

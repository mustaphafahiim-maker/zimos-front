import { useState } from "react";
import { wishlistTopProducts, type MostWishedProduct } from "@store-builder/api-client";
import { DataTable, type Column } from "@/components/DataTable";
import { IconHeart, IconRefresh } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCatalogLabels } from "../catalogLabels";
import { InsightChip } from "../list/InsightChip";

const STRINGS = {
  en: {
    title: "Most wished",
    answer: "“{name}” is on the wishlist of {shoppers}",
    shoppers_one: "1 shopper",
    shoppers_other: "{n} shoppers",
    listTitle: "Most wished products",
    listHint: "Shoppers signed in to your store save products with the heart. A product you archive stays on their lists.",
    colProduct: "Product",
    colShoppers: "Shoppers",
    colLast: "Last added",
    loadFailed: "Couldn't load the most wished. Try again",
  },
  ar: {
    title: "الأكثر في المفضلة",
    answer: "«{name}» في مفضلة {shoppers}",
    shoppers_one: "عميل واحد",
    shoppers_two: "عميلان",
    shoppers_few: "{n} عملاء",
    shoppers_other: "{n} عميل",
    listTitle: "المنتجات الأكثر في المفضلة",
    listHint: "العملاء الذين لديهم حساب في متجرك يحفظون المنتجات بعلامة القلب. المنتج الذي تؤرشفه يبقى في مفضلتهم.",
    colProduct: "المنتج",
    colShoppers: "العملاء",
    colLast: "آخر إضافة",
    loadFailed: "تعذّر تحميل الأكثر في المفضلة. حاول مرة أخرى",
  },
} satisfies Messages;

/**
 * Products → «الأكتر في المفضلة»: the products most
 * often on shoppers' wishlists, with how many shoppers saved each.
 *
 * On the list it is one chip of the slim row over the products
 * (list/InsightChip.tsx); pressing it opens the whole answer in a sheet — the
 * headline sentence and the table Product / Shoppers / Last added. Nothing
 * shows while no shopper has saved anything (most stores have accounts off)
 * or for a role that cannot read it; an error is a chip that tries again.
 * The answer is kept for the session, so the chip is there at once on return
 * and the list under it does not move.
 */
export function MostWishedCard() {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const workspaceId = useWorkspaceId();
  const [open, setOpen] = useState(false);
  const top = useCachedAsync(`catalog:wished:${workspaceId}`, () => wishlistTopProducts(apiClient, workspaceId, 20), [workspaceId]);

  const shoppers = (n: number) => pluralOf(t, "shoppers", n);
  const products = top.data?.products ?? [];

  if (top.loading || isPermissionError(top.error)) return null;
  if (top.error && products.length === 0) {
    return (
      <InsightChip icon={IconRefresh} tone="danger" opens={false} onClick={() => void top.refresh()}>
        {t.loadFailed}
      </InsightChip>
    );
  }
  const first = products[0];
  if (!first) return null;

  const columns: Column<MostWishedProduct>[] = [
    {
      key: "product",
      header: t.colProduct,
      cell: (p) => (
        <span className="flex flex-wrap items-center gap-2">
          <ViewLink to={`/catalog/${p.productId}`} className="font-medium text-ink hover:text-primary-dark hover:underline">
            {p.name}
          </ViewLink>
          {p.status !== "active" && <StatusBadge value={p.status} text={labels.status(p.status)} />}
        </span>
      ),
    },
    { key: "shoppers", header: t.colShoppers, align: "end", cell: (p) => <span className="tabular-nums">{shoppers(p.shoppers)}</span> },
    { key: "last", header: t.colLast, cell: (p) => formatDate(p.lastAddedAt) },
  ];

  return (
    <>
      <InsightChip icon={IconHeart} tone="brand" onClick={() => setOpen(true)}>
        {t.title}
      </InsightChip>
      <Sheet open={open} onOpenChange={setOpen} title={t.listTitle} description={t.listHint} size="lg">
        <p className="mb-4 text-sm leading-6 font-medium text-ink">{fmt(t.answer, { name: first.name, shoppers: shoppers(first.shoppers) })}</p>
        <DataTable columns={columns} rows={products} rowKey={(p) => p.productId} />
      </Sheet>
    </>
  );
}

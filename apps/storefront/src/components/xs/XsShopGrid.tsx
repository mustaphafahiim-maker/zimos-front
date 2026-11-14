import type { StorefrontProduct } from "@store-builder/api-client";
import { XsProductGrid } from "@/components/page-renderer/lazy";
import { xsGridCopy } from "@/components/page-renderer/xs/copy";
import type { Locale } from "@/lib/i18n";

/**
 * Products on the store's own pages — the catalogue's results, a product's
 * similar products — drawn as the template's product grid (`xs_products`):
 * its cards, badges and quick view, without its tabs, search or "load more"
 * (the catalogue pages its results itself).
 */
export function XsShopGrid({
  look,
  workspaceId,
  products,
  heading = "",
  currency,
  locale,
}: {
  look: string;
  workspaceId: string;
  products: StorefrontProduct[];
  heading?: string;
  currency: string;
  locale: Locale;
}) {
  return (
    <XsProductGrid
      look={look}
      workspaceId={workspaceId}
      currency={currency}
      locale={locale}
      heading={heading}
      linkLabel=""
      linkHref={null}
      tabs={[{ key: "all", label: "", collection: "" }]}
      showSearch={false}
      showDiscount
      layout="grid"
      quickView
      pageSize={products.length}
      initial={products}
      initialHasMore={false}
      copy={xsGridCopy(locale)}
    />
  );
}

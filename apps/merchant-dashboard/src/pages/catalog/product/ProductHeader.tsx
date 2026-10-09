import { useLayoutEffect, useRef } from "react";
import { Button } from "@store-builder/ui";
import type { Product, ProductStatus } from "@store-builder/api-client";
import { IconExternal } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { formatProductCode } from "@/lib/format";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useCatalogLabels } from "../catalogLabels";
import { productPriceLabel } from "./productSummary";

const STRINGS = {
  en: {
    products: "Products",
    viewInStore: "View in store",
    price: "Price",
  },
  ar: {
    products: "المنتجات",
    viewInStore: "شوفه في المتجر",
    price: "السعر",
  },
} satisfies Messages;

/**
 * The product page's header: the way back, the name with its code, the status
 * chip, the price (one price, or the range of its variants) and — only for a
 * product on sale — «شوفه في المتجر».
 *
 * It is also where a row of the catalog lands: the wrapper is the
 * view-transition target, and the name, the price and the status chip are the
 * three parts that travel from the row (lib/viewTransition.ts).
 */
export function ProductHeader({ product, status }: { product: Product; status: ProductStatus }) {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const workspaceId = useWorkspaceId();
  const price = productPriceLabel(product.variants ?? []);
  const target = useRef<HTMLDivElement>(null);

  // PageHeader draws the title itself and has no hook for a part: its heading is tagged here,
  // after every render, so the row's name has somewhere to land.
  useLayoutEffect(() => {
    target.current?.querySelector("h1")?.setAttribute("data-vt-part", "title");
  });

  return (
    <div ref={target} data-vt-target className="zimos-product-header">
      <PageHeader
        title={product.name}
        titleMeta={formatProductCode(product.productCode) ?? undefined}
        back={{ to: "/catalog", label: t.products }}
        titleBadge={
          <span data-vt-part="status" className="inline-flex align-middle">
            <StatusBadge value={status} text={labels.status(status)} />
          </span>
        }
        actions={
          <>
            {price && (
              <span data-vt-part="amount" aria-label={`${t.price}: ${price}`} className="inline-block text-[15px] leading-6 font-semibold whitespace-nowrap text-ink tabular-nums">
                {price}
              </span>
            )}
            {/* Only for a product on sale: nobody sees a draft in the store, so there is no page to open yet. */}
            {status === "active" && (
              <Button asChild size="sm" variant="outline" className="min-h-11 md:min-h-8">
                <a href={`${STOREFRONT_URL}/store/${workspaceId}/products/${product.slug}`} target="_blank" rel="noreferrer">
                  <IconExternal aria-hidden />
                  {t.viewInStore}
                </a>
              </Button>
            )}
          </>
        }
      />
    </div>
  );
}

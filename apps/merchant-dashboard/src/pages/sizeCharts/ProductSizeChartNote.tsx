import { Link } from "react-router-dom";
import { IconRuler } from "@/components/icons";
import { Card, CardContent } from "@store-builder/ui";
import { sizeChartForProduct, sizeChartsList, type CollectionSummary } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { pluralOf } from "@/lib/plural";
import { fmt, useT } from "@/i18n/LocaleContext";
import { ProductPageCard, useProductCardFrame } from "@/pages/catalog/components/ProductPageCard";
import { SIZE_CHART_STRINGS } from "./sizeChartStrings";

/**
 * The product page's "Size chart" card (handoff 210): which chart the shopper
 * gets as "Size guide" on this product and why — attached to the product
 * itself, or «من مجموعة Tops» through one of its collections. Worked out from
 * the store's charts the way the storefront endpoint does it. A store with no
 * size charts sees nothing here.
 */
export function ProductSizeChartNote({ productId, collections }: { productId: string; collections: CollectionSummary[] }) {
  const t = useT(SIZE_CHART_STRINGS);
  const workspaceId = useWorkspaceId();
  const charts = useAsync(() => sizeChartsList(apiClient, workspaceId), [workspaceId]);
  // Where the product page put the note: its own card (the default), or a part of a group.
  const frame = useProductCardFrame();
  // An extra on a page that works without it: while it loads, or if it can't, the page stays as it was.
  if (!charts.data || charts.data.length === 0) return null;

  const match = sizeChartForProduct(
    charts.data,
    productId,
    collections.map((c) => c.id)
  );
  const through = match?.via === "collection" ? collections.find((c) => c.id === match.collectionId) : undefined;

  const body = (
    <>
        {match ? (
          <div className={frame === "card" ? "mt-3 flex flex-wrap items-center gap-x-3 gap-y-2" : "flex flex-wrap items-center gap-x-3 gap-y-2"}>
            <Link
              to={`/size-charts/${match.chart.id}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] bg-paper-sunken px-3 text-sm font-semibold text-ink hover:text-primary"
            >
              <IconRuler className="size-4 shrink-0 text-ink-soft" aria-hidden />
              <bdi>{match.chart.name}</bdi>
            </Link>
            <span className="text-sm text-ink-soft">
              {match.via === "product" ? t.productOwn : fmt(t.productFromCollection, { name: through?.name ?? "" })}
              {" · "}
              {pluralOf(t, "rows", match.chart.rows.length)}
            </span>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">
            {t.productNone}{" "}
            <Link to="/size-charts" className="font-medium text-primary hover:underline">
              {t.openCharts}
            </Link>
          </p>
        )}
    </>
  );

  if (frame !== "card") {
    return (
      <ProductPageCard title={t.productTitle} icon={IconRuler}>
        {body}
      </ProductPageCard>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="font-display text-lg font-medium text-ink">{t.productTitle}</h2>
        {body}
      </CardContent>
    </Card>
  );
}

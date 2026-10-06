import { Link } from "react-router-dom";
import { Check, PackageOpen, Star } from "lucide-react";
import { Alert, buttonVariants, cn, Spinner } from "@store-builder/ui";
import {
  importedPagePrice,
  PRODUCT_IMPORT_SOURCES,
  type CatalogReviewExtras,
  type Product,
  type ProductImportSource,
  type ProductLinkImport,
  type Review,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { pluralOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

/**
 * The product link import's pieces (frontend-handoff 180): the sources it
 * reads, with the one the pasted link belongs to marked, and what a finished
 * link import left to check — the draft's price and stock, and the reviews
 * from the page that wait for approval in Reviews.
 */

const STRINGS = {
  en: {
    sourcesLabel: "Sources we can read",
    sourceDetected: "Source: {name}",
    source_shopify: "Shopify",
    source_aliexpress: "AliExpress",
    source_etsy: "Etsy",
    source_cj: "CJ",
    source_youcan: "YouCan",
    done: "Imported as a draft — check the price and stock",
    pagePrice: "Price on the page:",
    priceAsIs: "it was copied as a number, without converting the currency — set your own selling price before you publish.",
    noPrice: "The page had no price, so the product was added at 0 — set your selling price before you publish.",
    looking: "Looking for the new product…",
    openProduct: "Review the product",
    reviewsWaiting_one: "1 review waiting for your approval",
    reviewsWaiting_other: "{n} reviews waiting for your approval",
  },
  ar: {
    sourcesLabel: "المصادر اللي بنقرا منها",
    sourceDetected: "المصدر: {name}",
    source_shopify: "شوبيفاي",
    source_aliexpress: "علي إكسبريس",
    source_etsy: "إتسي",
    source_cj: "CJ",
    source_youcan: "يوكان",
    done: "اتضاف كمسودة — راجع السعر والمخزون",
    pagePrice: "السعر على الصفحة:",
    priceAsIs: "اتنقل كرقم زي ما هو من غير تحويل عملة — حط سعر بيعك قبل ما تنشر.",
    noPrice: "الصفحة مكانش فيها سعر، فالمنتج اتضاف بصفر — حط سعر بيعك قبل ما تنشر.",
    looking: "بندوّر على المنتج الجديد…",
    openProduct: "راجع المنتج",
    reviewsWaiting_one: "تقييم واحد مستني موافقتك",
    reviewsWaiting_two: "تقييمين مستنيين موافقتك",
    reviewsWaiting_few: "{n} تقييمات مستنية موافقتك",
    reviewsWaiting_other: "{n} تقييم مستني موافقتك",
  },
} satisfies Messages;

/** Reviews filtered to the imported ones waiting for approval (ReviewsPage reads both params). */
export const IMPORTED_REVIEWS_PATH = "/reviews?status=pending&source=import";

/** The sources as small badges; the one the pasted link belongs to is filled and ticked. */
export function ImportSourceBadges({ detected, id }: { detected: ProductImportSource | null; id?: string }) {
  const t = useT(STRINGS);
  return (
    <div id={id}>
      <ul aria-label={t.sourcesLabel} className="flex flex-wrap gap-1.5">
        {PRODUCT_IMPORT_SOURCES.map((source) => {
          const on = source === detected;
          return (
            <li
              key={source}
              className={cn(
                "inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-medium",
                on ? "bg-primary-soft text-primary-dark ring-1 ring-primary/40" : "bg-paper-sunken text-ink-soft"
              )}
            >
              {on && <Check className="size-3.5" aria-hidden />}
              {t[`source_${source}`]}
            </li>
          );
        })}
      </ul>
      <p className="sr-only" aria-live="polite">
        {detected ? fmt(t.sourceDetected, { name: t[`source_${detected}`] }) : ""}
      </p>
    </div>
  );
}

type ListedProduct = Product & { variants?: Array<{ priceAmount: string | number }> };
type ReviewRow = Review & CatalogReviewExtras;

/**
 * A finished link import that created its product. The import's report names
 * neither the product nor the page's currency, so the new draft is found
 * among the drafts by its `import:<source>` tag and creation time, and the
 * page's price is read from the line the import added to its description.
 */
export function LinkImportResult({
  job,
  source,
  onLeave,
}: {
  job: ProductLinkImport;
  source: ProductImportSource;
  /** Called before following a link out of the dialog. */
  onLeave: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  // Shopify links bring no reviews and no tag: the sentence alone is the answer.
  const tagged = source !== "shopify";

  const found = useAsync(async () => {
    if (!tagged) return { product: null, waiting: 0 };
    const since = Date.parse(job.createdAt) - 1000;
    const [drafts, pending] = await Promise.all([
      apiClient.listProducts(workspaceId, { status: "draft", limit: 200 }).catch(() => null),
      apiClient.listReviews(workspaceId, { status: "pending" }).catch(() => null),
    ]);
    const product =
      ((drafts?.products ?? []) as ListedProduct[])
        .filter((p) => (p.tags ?? []).includes(`import:${source}`) && Date.parse(p.createdAt) >= since)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
    const imported = ((pending ?? []) as ReviewRow[]).filter((r) => r.source === "import");
    // This product's reviews when it was found; otherwise every imported one still waiting.
    const waiting = product ? imported.filter((r) => r.productId === product.id).length : imported.length;
    return { product, waiting };
  }, [workspaceId, job.id, source]);

  const product = found.data?.product ?? null;
  const price = importedPagePrice(product?.description);
  const firstPrice = Number(product?.variants?.[0]?.priceAmount ?? NaN);
  const waiting = found.data?.waiting ?? 0;

  return (
    <div className="space-y-3">
      <Alert variant="success">
        <p className="font-medium">{t.done}</p>
        {price ? (
          <p className="text-ink">
            {t.pagePrice}{" "}
            <bdi dir="ltr" className="font-medium tabular-nums">
              {price.amount} {price.currency}
            </bdi>{" "}
            — {t.priceAsIs}
          </p>
        ) : product && firstPrice === 0 ? (
          <p className="text-ink">{t.noPrice}</p>
        ) : null}
      </Alert>

      {found.loading ? (
        <p role="status" className="flex items-center gap-2 text-sm text-ink-soft">
          <Spinner className="size-4" />
          {t.looking}
        </p>
      ) : (
        (product || waiting > 0) && (
          <div className="flex flex-wrap gap-2">
            {product && (
              <Link to={`/catalog/${product.id}`} onClick={onLeave} className={cn(buttonVariants(), "min-h-11")}>
                <PackageOpen className="size-4" aria-hidden />
                {t.openProduct}
              </Link>
            )}
            {waiting > 0 && (
              <Link
                to={IMPORTED_REVIEWS_PATH}
                onClick={onLeave}
                className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
              >
                <Star className="size-4" aria-hidden />
                {pluralOf(t, "reviewsWaiting", waiting)}
              </Link>
            )}
          </div>
        )
      )}
    </div>
  );
}

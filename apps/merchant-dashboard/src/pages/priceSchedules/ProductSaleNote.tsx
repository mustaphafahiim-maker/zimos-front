import { Link } from "react-router-dom";
import { IconSchedule } from "@/components/icons";
import { Card, CardContent } from "@store-builder/ui";
import { priceScheduleGet, priceSchedulesList, type PriceSchedule, type Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { canViewProducts } from "@/lib/productAccess";
import { formatMoney, formatOptions } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { ProductPageCard, useProductCardFrame } from "@/pages/catalog/components/ProductPageCard";
import { PRICE_SCHEDULE_STRINGS } from "./priceScheduleStrings";
import { formatStoreDateTime } from "./storeTime";

/** Running sales read for the note; a store rarely has more at once. */
const MAX_SALES = 6;

/**
 * The product page's note for a variant that is in a running sale (handoff
 * 227): «في تخفيض لحد …», the sale it belongs to, and each such variant's
 * price before and during it. It also says what the sale does with a price
 * changed meanwhile — it stays as set once the sale ends.
 *
 * Nothing is drawn when no variant of the product is on sale, while the sales
 * load, or when they can't be read: the page works without it.
 */
export function ProductSaleNote({ variants }: { variants: Variant[] }) {
  const t = useT(PRICE_SCHEDULE_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const zone = currentWorkspace?.timezone ?? null;
  const canView = canViewProducts(currentWorkspace?.role);
  // Where the product page put the note: its own card (the default), or a row / a part of a group.
  const frame = useProductCardFrame();
  // Read again when a price changes on this page (an edit, a sale that just started).
  const stamp = variants.map((v) => `${v.id}:${v.priceAmount}:${v.compareAtAmount ?? ""}`).join(",");

  const running = useAsync<PriceSchedule[]>(async () => {
    if (!canView || variants.length === 0) return [];
    try {
      const active = await priceSchedulesList(apiClient, workspaceId, "active");
      // The list has no per-variant result: each running sale is read for its items.
      return await Promise.all(active.slice(0, MAX_SALES).map((s) => priceScheduleGet(apiClient, workspaceId, s.id)));
    } catch {
      return [];
    }
  }, [workspaceId, stamp, canView]);

  const byId = new Map(variants.map((v) => [v.id, v]));
  const sales = (running.data ?? [])
    .map((sale) => ({ sale, items: (sale.items ?? []).filter((item) => item.state === "applied" && byId.has(item.variantId)) }))
    .filter((entry) => entry.items.length > 0);
  if (sales.length === 0) return null;

  const body = (
    <>
        <ul className={frame === "card" ? "mt-3 space-y-4" : "space-y-4"}>
          {sales.map(({ sale, items }) => (
            <li key={sale.id}>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-ink">
                  {sale.endsAt ? fmt(t.onSaleUntil, { date: formatStoreDateTime(sale.endsAt, zone) }) : t.onSaleNoEnd}
                  <span className="font-normal text-ink-soft">
                    {" · "}
                    <bdi>{sale.name}</bdi>
                  </span>
                </p>
                <Link to={`/offers/scheduled-sales/${sale.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline md:min-h-0">
                  {t.openSale}
                </Link>
              </div>
              <ul className="mt-2 divide-y divide-line rounded-[var(--radius)] ring-1 ring-line">
                {items.map((item) => {
                  const variant = byId.get(item.variantId);
                  const currency = variant?.currency ?? currentWorkspace?.defaultCurrency ?? "EGP";
                  return (
                    <li key={item.variantId} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
                      <span className="min-w-0 text-ink">
                        <bdi>{formatOptions(variant?.optionValues) || variant?.sku || t.singleVariant}</bdi>
                      </span>
                      <span className="whitespace-nowrap tabular-nums">
                        <span className="text-ink-soft line-through">{formatMoney(item.oldPrice, currency)}</span>{" "}
                        <span className="font-semibold text-ink">{formatMoney(item.newPrice, currency)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-soft">{t.noteWarning}</p>
    </>
  );

  if (frame !== "card") {
    return (
      <ProductPageCard title={t.noteTitle} icon={IconSchedule}>
        {body}
      </ProductPageCard>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-medium text-ink">
          <IconSchedule className="size-5 shrink-0 text-ink-soft" aria-hidden />
          {t.noteTitle}
        </h2>
        {body}
      </CardContent>
    </Card>
  );
}

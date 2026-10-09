import { Link } from "react-router-dom";
import { STOCK_LOTS_MAX_ROWS, stockLotsList, type StockLot, type StockLotList, type Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { NO_INVENTORY_ROLES } from "@/lib/inventoryAccess";
import { countOf } from "@/lib/plural";
import { fmt, useT } from "@/i18n/LocaleContext";
import { IconCalendar } from "@/components/icons";
import { ProductPageCard } from "@/pages/catalog/components/ProductPageCard";
import { variantDetail } from "../inventoryText";
import { LotExpiry } from "./LotParts";
import { LOT_STRINGS } from "./lotStrings";

/** Variants asked one by one when the store has more lots than a single read holds. */
const PER_VARIANT_MAX = 20;

/**
 * The lots that still hold units for these variants, first expiring first.
 * One read of the store's lots covers nearly every store; only past the read's
 * cap is each variant asked for its own.
 */
async function lotsOfVariants(workspaceId: string, variantIds: string[]): Promise<StockLotList> {
  const all = await stockLotsList(apiClient, workspaceId, { status: "active", limit: STOCK_LOTS_MAX_ROWS });
  if (all.lots.length < STOCK_LOTS_MAX_ROWS) {
    const wanted = new Set(variantIds);
    return { alertDays: all.alertDays, lots: all.lots.filter((lot) => wanted.has(lot.variantId)) };
  }
  const each = await Promise.all(
    variantIds.slice(0, PER_VARIANT_MAX).map((variantId) => stockLotsList(apiClient, workspaceId, { variantId, status: "active", limit: 100 }))
  );
  return { alertDays: all.alertDays, lots: each.flatMap((answer) => answer.lots) };
}

/**
 * The product page's «الدفعات والصلاحية» / "Lots & expiry" card (handoff 230):
 * under each variant, its lots that still hold units — the first to go on top,
 * as orders take from the lot that expires first.
 *
 * Nothing is drawn for a product without lots, without `inventory.view`, or
 * when the lots can't be read.
 */
export function ProductLotsCard({ variants }: { variants: Variant[] }) {
  const t = useT(LOT_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const ids = variants.map((v) => v.id);
  // Read again when a variant's stock changes on this page (a lot received elsewhere, a write-off).
  const stamp = variants.map((v) => `${v.id}:${v.stockOnHand}`).join(",");
  // A role known to lack `inventory.view` is not sent to a read that would refuse it.
  const canView = !NO_INVENTORY_ROLES.has(currentWorkspace?.role ?? "");
  const read = useAsync(
    () => (canView && ids.length > 0 ? lotsOfVariants(workspaceId, ids).catch(() => null) : Promise.resolve(null)),
    [workspaceId, stamp, canView]
  );

  const data = read.data;
  if (!data || data.lots.length === 0) return null;

  const byVariant = new Map<string, StockLot[]>();
  for (const lot of data.lots) byVariant.set(lot.variantId, [...(byVariant.get(lot.variantId) ?? []), lot]);
  const groups = variants.filter((v) => byVariant.has(v.id));

  return (
    <ProductPageCard title={t.cardTitle} description={t.cardDescription} icon={IconCalendar}>
      <ul className="divide-y divide-line rounded-[var(--radius)] ring-1 ring-line">
        {groups.map((variant) => (
          <li key={variant.id} className="px-3 py-3">
            {variants.length > 1 && (
              <p className="mb-2 text-sm font-medium text-ink">
                <bdi>{variantDetail(variant.optionValues, variant.sku) || t.singleVariant}</bdi>
              </p>
            )}
            <ul className="space-y-2">
              {(byVariant.get(variant.id) ?? []).map((lot) => (
                <li key={lot.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[var(--radius)] bg-paper-sunken px-3 py-2 text-sm">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <bdi className="font-medium text-ink">{lot.lotCode}</bdi>
                    <LotExpiry lot={lot} alertDays={data.alertDays} />
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-ink">
                    {fmt(t.cardRemaining, { pieces: countOf("piece", lot.quantityRemaining) })}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-end">
        <Link to="/inventory/lots" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline md:min-h-0">
          {t.manageLots}
        </Link>
      </div>
    </ProductPageCard>
  );
}

import { Link } from "react-router-dom";
import { stockForecastGet, type StockForecastSettings, type StockForecastVariant, type Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { NO_INVENTORY_ROLES } from "@/lib/inventoryAccess";
import { countOf } from "@/lib/plural";
import { formatDay } from "@/lib/wholeNumber";
import { fmt, useT } from "@/i18n/LocaleContext";
import { StatusBadge } from "@/components/StatusBadge";
import { IconTrendUp } from "@/components/icons";
import { ProductPageCard } from "@/pages/catalog/components/ProductPageCard";
import { variantDetail } from "../inventoryText";
import { FORECAST_STATUS_KEY, FORECAST_STATUS_TONE, FORECAST_STRINGS, type ForecastStrings } from "./forecastStrings";

/** "22 Oct", with the year only when it is not this one. */
function shortDay(ymd: string | null): string {
  if (!ymd) return "";
  const sameYear = ymd.slice(0, 4) === String(new Date().getFullYear());
  return formatDay(ymd, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

/** One variant's forecast as a sentence: «يكفي ٣٠ يوم — اطلب قبل ٢٢ أكتوبر». */
function sentence(t: ForecastStrings, row: StockForecastVariant, settings: StockForecastSettings): string {
  if (row.daysLeft === null) {
    return row.status === "out" ? t.lineOutIdle : fmt(t.lineNoSales, { days: countOf("day", settings.windowDays) });
  }
  if (row.status === "out") return t.lineOut;
  const days = countOf("day", row.daysLeft);
  // Past the last day to order in time, the date is today: say "now".
  if (row.status === "reorder_now" || !row.reorderBy) return fmt(t.lineLeftNow, { days });
  return fmt(t.lineLeft, { days, date: shortDay(row.reorderBy) });
}

/**
 * The product page's «توقّع المخزون» / "Stock forecast" card (handoff 224,
 * GET /stock-forecast?productId=): for each variant, how many days its stock
 * lasts and by when to reorder, with what is on its way and what to order.
 *
 * Nothing is drawn for a product whose quantity is not tracked (the forecast
 * has no rows for it), without `inventory.view`, or when the read fails — the
 * variants table above already shows the stock itself.
 */
export function ProductForecastCard({ productId, variants }: { productId: string; variants: Variant[] }) {
  const t = useT(FORECAST_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  // A role known to lack `inventory.view` is not sent to a read that would refuse it.
  const canView = !NO_INVENTORY_ROLES.has(currentWorkspace?.role ?? "");
  // Read again when a variant's stock changes on this page (an edit, a restock).
  const stamp = variants.map((v) => `${v.id}:${v.status}:${v.stockOnHand}:${v.reservedStock}`).join(",");
  const forecast = useAsync(
    () => (canView ? stockForecastGet(apiClient, workspaceId, { productId }).catch(() => null) : Promise.resolve(null)),
    [workspaceId, productId, stamp, canView]
  );

  const data = forecast.data;
  if (!data || data.variants.length === 0) return null;
  const many = data.variants.length > 1;

  return (
    <ProductPageCard title={t.cardTitle} description={t.cardDescription} icon={IconTrendUp}>
      <ul className="divide-y divide-line rounded-[var(--radius)] ring-1 ring-line">
        {data.variants.map((row) => (
          <li key={row.variantId} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-3 py-3">
            <div className="min-w-0 flex-1 basis-56">
              {many && (
                <p className="text-xs text-ink-soft">
                  <bdi>{variantDetail(row.optionValues, row.sku) || t.singleVariant}</bdi>
                </p>
              )}
              <p className="text-sm font-medium text-ink">{sentence(t, row, data.settings)}</p>
              {(row.incoming > 0 || row.suggested > 0) && (
                <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-soft">
                  {row.incoming > 0 && <span>{fmt(t.incomingNote, { n: row.incoming })}</span>}
                  {row.suggested > 0 && <span>{fmt(t.suggestedNote, { n: row.suggested })}</span>}
                </p>
              )}
            </div>
            <StatusBadge value={row.status} tone={FORECAST_STATUS_TONE[row.status]} text={t[FORECAST_STATUS_KEY[row.status]]} />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-end">
        <Link to="/inventory/forecast" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline md:min-h-0">
          {t.openForecast}
        </Link>
      </div>
    </ProductPageCard>
  );
}

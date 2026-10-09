import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  STOCK_MOVEMENT_TYPES,
  stockMovementsExport,
  stockMovementsList,
  type StockMovement,
  type StockMovementQuery,
  type StockMovementType,
} from "@store-builder/api-client";
import { DataState } from "@/components/DataState";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { IconClock, IconDownload } from "@/components/icons";
import { LoadMore } from "@/components/LoadMore";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { useLocale, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useAsync } from "@/lib/useAsync";
import { useCursorList } from "@/lib/useCursorList";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useStockLocations } from "../kit";
import { movementColumns } from "./MovementParts";
import { MOVEMENT_STRINGS } from "./movementStrings";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isType = (value: string | null): value is StockMovementType => STOCK_MOVEMENT_TYPES.includes(value as StockMovementType);
const FIELD = "h-11 w-full text-base md:h-9 md:text-sm";

/** Saves a blob under a name, the way a download link would. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Inventory → «حركة المخزون» / Stock movements (handoff 389, GET
 * /inventory/movements, inventory.view): every change to the store's stock,
 * newest first — restocks, adjustments, order reservations and releases,
 * returns, purchase orders received, stock counts, lots, sheet updates — with
 * where it came from and who did it. Read-only.
 *
 * The filters (product, type, location, a date range) live in the URL, so a
 * filtered view can be linked to: the product page's history drawer opens this
 * tab with `?productId=`. The two export buttons download the same filters as
 * a file, in the dashboard's language.
 */
export function StockMovementsTab() {
  const t = useT(MOVEMENT_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [params, setParams] = useSearchParams();

  const productId = params.get("productId") ?? "";
  const variantId = params.get("variantId") ?? "";
  const type = isType(params.get("type")) ? (params.get("type") as StockMovementType) : "";
  const locationId = params.get("locationId") ?? "";
  const from = DAY.test(params.get("from") ?? "") ? (params.get("from") as string) : "";
  const to = DAY.test(params.get("to") ?? "") ? (params.get("to") as string) : "";
  const rangeWrong = from !== "" && to !== "" && from > to;

  const query: StockMovementQuery = useMemo(
    () => ({
      productId: productId || undefined,
      variantId: variantId || undefined,
      type: type || undefined,
      locationId: locationId || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [productId, variantId, type, locationId, from, to]
  );

  const list = useCursorList<StockMovement>(
    async (cursor) => {
      // A range the server would refuse (422) is said in words under the dates instead.
      if (rangeWrong) return { items: [], nextCursor: null };
      const page = await stockMovementsList(apiClient, workspaceId, { ...query, cursor, limit: 50 });
      return { items: page.movements, nextCursor: page.nextCursor };
    },
    [workspaceId, query, rangeWrong]
  );

  // Names for the two pickers; without them the movements still list.
  const products = useAsync(() => apiClient.listProducts(workspaceId, { limit: 200 }).catch(() => null), [workspaceId]);
  const locations = useStockLocations(workspaceId);
  const allLocations = locations.data?.locations ?? [];
  const productOptions = products.data?.products ?? [];

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // One variant's history is a narrower view of its product: picking another product leaves it.
    if (key === "productId") next.delete("variantId");
    setParams(next, { replace: true });
  }
  const filtered = Boolean(productId || variantId || type || locationId || from || to);

  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  async function download(format: "csv" | "xlsx") {
    if (exporting || rangeWrong) return;
    setExporting(format);
    try {
      const file = await stockMovementsExport(apiClient, workspaceId, query, format, locale === "ar" ? "ar" : "en");
      saveBlob(file.blob, file.filename);
    } catch (err) {
      toast.error(errorMessage(err) || t.exportFailed);
    } finally {
      setExporting(null);
    }
  }

  const columns = useMemo(() => movementColumns(t, { product: true, location: true }), [t]);
  const typeLabel = (value: StockMovementType) => (t as unknown as Record<string, string>)[`type_${value}`];

  return (
    <DataState loading={false} error={list.error && list.items.length === 0 ? list.error : null} onRetry={list.reload}>
      <div className="flex min-w-0 flex-col gap-3">
        <div role="group" aria-label={t.filters} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label={t.product}>
            {(field) => (
              <Select {...field} className={FIELD} value={productId} onChange={(e) => setFilter("productId", e.target.value)}>
                <option value="">{t.allProducts}</option>
                {/* A product outside the first 200 (a link from its page): still named as chosen. */}
                {productId && !productOptions.some((p) => p.id === productId) && <option value={productId}>{list.items[0]?.variant.productName ?? "…"}</option>}
                {productOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.type}>
            {(field) => (
              <Select {...field} className={FIELD} value={type} onChange={(e) => setFilter("type", e.target.value)}>
                <option value="">{t.allTypes}</option>
                {STOCK_MOVEMENT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {typeLabel(value)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.location}>
            {(field) => (
              <Select {...field} className={FIELD} value={locationId} onChange={(e) => setFilter("locationId", e.target.value)} disabled={allLocations.length === 0}>
                <option value="">{t.allLocations}</option>
                {allLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.from}>
            {(field) => <Input {...field} type="date" dir="ltr" className={FIELD} value={from} max={to || undefined} onChange={(e) => setFilter("from", e.target.value)} />}
          </Field>
          <Field label={t.to} error={rangeWrong ? t.rangeWrong : undefined}>
            {(field) => <Input {...field} type="date" dir="ltr" className={FIELD} value={to} min={from || undefined} onChange={(e) => setFilter("to", e.target.value)} />}
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {filtered && (
              <Button type="button" variant="ghost" className="min-h-11 rounded-full px-4 md:min-h-9" onClick={() => setParams({}, { replace: true })}>
                {t.clear}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="min-h-11 rounded-full px-4 md:min-h-9" disabled={exporting !== null || rangeWrong} onClick={() => void download("csv")}>
              <IconDownload className="size-4" aria-hidden />
              {exporting === "csv" ? t.exporting : t.exportCsv}
            </Button>
            <Button type="button" variant="outline" className="min-h-11 rounded-full px-4 md:min-h-9" disabled={exporting !== null || rangeWrong} onClick={() => void download("xlsx")}>
              <IconDownload className="size-4" aria-hidden />
              {exporting === "xlsx" ? t.exporting : t.exportExcel}
            </Button>
          </div>
        </div>

        {/* A later page that failed: what is on screen stays, with the reason. */}
        {list.error != null && list.items.length > 0 && <Alert variant="danger">{errorMessage(list.error)}</Alert>}

        <DataTable
          columns={columns}
          rows={list.items}
          rowKey={(m) => m.id}
          loading={list.loading}
          minWidth="64rem"
          empty={<EmptyState icon={<IconClock aria-hidden />} title={t.empty} description={filtered ? undefined : t.emptyHint} />}
        />
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </div>
    </DataState>
  );
}

import { useEffect, useState } from "react";
import { priceSchedulePreview, type PriceScheduleInput, type PriceSchedulePreview, type PriceSchedulePreviewVariant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { variantDetail } from "@/pages/inventory/inventoryText";
import { VariantCell } from "@/pages/inventory/InventoryParts";
import { PRICE_SCHEDULE_STRINGS } from "./priceScheduleStrings";

/** How many variants the preview lists before "…and N more". */
const SHOWN = 30;

/**
 * What a sale would do to today's prices (POST /price-schedules/preview): each
 * variant's price now and its sale price, both worked out by the server. It
 * reads again a moment after the sale's target or discount changes; `body` is
 * null while those are not complete enough to ask.
 */
export function SalePreview({ body, currency }: { body: PriceScheduleInput | null; currency: string }) {
  const t = useT(PRICE_SCHEDULE_STRINGS);
  const workspaceId = useWorkspaceId();
  // Only what changes the answer: the target and the discount.
  const key = body ? JSON.stringify([body.target, body.change]) : "";
  const [state, setState] = useState<{ key: string; preview: PriceSchedulePreview | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (!body) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      priceSchedulePreview(apiClient, workspaceId, body)
        .then((preview) => {
          if (alive) setState({ key, preview, failed: false });
        })
        .catch(() => {
          if (alive) setState({ key, preview: null, failed: true });
        });
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // `key` stands for `body`: a new object with the same target and discount is not a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, key]);

  if (!body) return <p className="rounded-[var(--radius)] border border-dashed border-line px-4 py-5 text-center text-sm text-ink-soft">{t.previewEmpty}</p>;

  const current = state?.key === key ? state : null;
  if (!current) {
    return (
      <DataState loading error={null} skeleton="table">
        {null}
      </DataState>
    );
  }
  if (current.failed || !current.preview) {
    return (
      <p role="alert" className="text-sm text-danger">
        {t.previewFailed}
      </p>
    );
  }
  const { total, variants } = current.preview;
  if (total === 0) return <p className="rounded-[var(--radius)] border border-dashed border-line px-4 py-5 text-center text-sm text-ink-soft">{t.previewNone}</p>;

  const columns: Column<PriceSchedulePreviewVariant>[] = [
    {
      key: "product",
      header: t.colProduct,
      cell: (v) => <VariantCell name={v.productName ?? t.unknownProduct} detail={variantDetail(v.options, v.sku) || undefined} />,
    },
    {
      key: "price",
      header: t.colPriceNow,
      align: "end",
      cell: (v) => <span className="whitespace-nowrap tabular-nums text-ink-soft">{formatMoney(v.price, currency)}</span>,
    },
    {
      key: "sale",
      header: t.colSalePrice,
      align: "end",
      cell: (v) =>
        v.salePrice === v.price ? (
          <span className="text-xs text-ink-soft">{t.unchanged}</span>
        ) : (
          <span className="font-semibold whitespace-nowrap tabular-nums text-ink">{formatMoney(v.salePrice, currency)}</span>
        ),
    },
  ];
  const shown = variants.slice(0, SHOWN);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">{pluralOf(t, "onSale", total)}</p>
      <div className="overflow-hidden rounded-[var(--radius)] ring-1 ring-line max-md:ring-0">
        <DataTable columns={columns} rows={shown} rowKey={(v) => v.variantId} minWidth="26rem" />
      </div>
      {total > shown.length && <p className="text-xs text-ink-soft">{pluralOf(t, "more", total - shown.length)}</p>}
    </div>
  );
}

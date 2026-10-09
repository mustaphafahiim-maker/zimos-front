import { useId, useMemo, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { stockMovementsOfVariant, type StockMovement, type StockMovementPage, type Variant } from "@store-builder/api-client";
import { DataState, SkeletonBar } from "@/components/DataState";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { IconClock } from "@/components/icons";
import { LoadMore } from "@/components/LoadMore";
import { Select } from "@/components/Select";
import { Sheet } from "@/components/Sheet";
import { ViewLink } from "@/components/ViewLink";
import { fmt, getIntlLocale, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatOptions } from "@/lib/format";
import { useCursorList } from "@/lib/useCursorList";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { movementColumns } from "./MovementParts";
import { MOVEMENT_STRINGS } from "./movementStrings";

type Stock = NonNullable<StockMovementPage["stock"]>;

/**
 * «سجل حركة المخزون» on the product page (handoff 389): a quiet link under the
 * stock of the variants that opens a drawer with one variant's movements
 * (GET /inventory/:variantId/movements) under its three figures — on hand,
 * reserved, available. A product with several variants picks which one at the
 * top. Nothing is read until the drawer opens.
 */
export function ProductStockHistoryLink({ productId, productName, variants }: { productId: string; productName: string; variants: Variant[] }) {
  const t = useT(MOVEMENT_STRINGS);
  const [open, setOpen] = useState(false);
  // Archived variants keep their history, but the page is about what is on sale.
  const listed = variants.filter((v) => v.status !== "archived");
  if (listed.length === 0) return null;
  return (
    <div data-slot="stock-history-link">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary md:min-h-9"
      >
        <IconClock className="size-4" aria-hidden />
        {t.historyLink}
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={fmt(t.historyOf, { name: productName })}
        description={t.historyHint}
        size="lg"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.close}
            </Button>
            <Button type="button" variant="outline" asChild>
              <ViewLink to={`/inventory/movements?productId=${productId}`}>{t.openInInventory}</ViewLink>
            </Button>
          </>
        }
      >
        {open && <HistoryBody variants={listed} />}
      </Sheet>
    </div>
  );
}

function HistoryBody({ variants }: { variants: Variant[] }) {
  const t = useT(MOVEMENT_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const selectId = useId();
  const [variantId, setVariantId] = useState(variants[0].id);
  const [stock, setStock] = useState<Stock | null>(null);

  const list = useCursorList<StockMovement>(
    async (cursor) => {
      const page = await stockMovementsOfVariant(apiClient, workspaceId, variantId, { cursor, limit: 50 });
      if (page.stock) setStock(page.stock);
      return { items: page.movements, nextCursor: page.nextCursor };
    },
    [workspaceId, variantId]
  );

  const label = (v: Variant) => formatOptions(v.optionValues) || v.sku || t.singleVariant;
  const columns = useMemo(() => movementColumns(t, { product: false, location: list.items.some((m) => m.location !== null) }), [t, list.items]);
  const number = (n: number) => new Intl.NumberFormat(getIntlLocale()).format(n);
  const figures: Array<[string, number | undefined]> = [
    [t.onHand, stock?.stockOnHand],
    [t.reserved, stock?.reservedStock],
    [t.available, stock?.availableStock],
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {variants.length > 1 && (
        <div>
          <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-ink">
            {t.variant}
          </label>
          <Select
            id={selectId}
            className="h-11 w-full text-base md:h-9 md:text-sm"
            value={variantId}
            onChange={(e) => {
              setStock(null);
              setVariantId(e.target.value);
            }}
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {label(v)}
              </option>
            ))}
          </Select>
        </div>
      )}

      <dl className="grid grid-cols-3 gap-2">
        {figures.map(([name, value]) => (
          <div key={name} className="rounded-[1rem] bg-paper-sunken px-3 py-2.5">
            <dt className="text-xs text-ink-soft">{name}</dt>
            <dd className="mt-0.5 text-lg font-semibold text-ink tabular-nums">{value === undefined ? <SkeletonBar className="h-5 w-10" /> : <bdi dir="ltr">{number(value)}</bdi>}</dd>
          </div>
        ))}
      </dl>

      <DataState loading={false} error={list.error && list.items.length === 0 ? list.error : null} onRetry={list.reload}>
        {list.error != null && list.items.length > 0 && (
          <Alert variant="danger" className="mb-3">
            {errorMessage(list.error)}
          </Alert>
        )}
        <DataTable
          columns={columns}
          rows={list.items}
          rowKey={(m) => m.id}
          loading={list.loading}
          minWidth="40rem"
          empty={<EmptyState icon={<IconClock aria-hidden />} title={t.empty} />}
        />
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>
    </div>
  );
}

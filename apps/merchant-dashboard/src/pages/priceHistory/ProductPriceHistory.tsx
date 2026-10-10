import { useId, useState } from "react";
import { IconActivity, IconCaretDown } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { PRICE_HISTORY_DAYS, parseMoney, variantPriceHistory, type PriceHistoryChange, type Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatDateTime, formatMoney, formatOptions } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { Select } from "@/components/Select";
import { ProductPageCard, useProductCardFrame } from "@/pages/catalog/components/ProductPageCard";
import { PRICE_HISTORY_STRINGS } from "./priceHistoryStrings";
import { PriceStepChart } from "./PriceStepChart";

/** How many changes the list shows before "show all". */
const SHOWN = 8;

/**
 * The product page's «تاريخ السعر» (handoff 234): a variant's price over the
 * last six months as a step line with its compare-at price, the lowest price
 * of the last 30 days — the figure shoppers are shown beside a sale price —
 * and the list of changes.
 *
 * It stays folded until asked for: the history is read when the card opens,
 * so a product page that never opens it costs nothing.
 */
export function ProductPriceHistory({ productName, variants }: { productName: string; variants: Variant[] }) {
  const t = useT(PRICE_HISTORY_STRINGS);
  const [opened, setOpened] = useState(false);
  // Where the product page put it: its own folding card (the default), or a slim row under the variants.
  const frame = useProductCardFrame();
  // Archived variants keep their history, but the page is about what is on sale.
  const listed = variants.filter((v) => v.status !== "archived");
  if (listed.length === 0) return null;

  if (frame === "fold") {
    // The row mounts its body the first time it is opened: the history is still read only when asked for.
    return (
      <ProductPageCard title={t.title} description={t.hint} icon={IconActivity}>
        <HistoryBody productName={productName} variants={listed} />
      </ProductPageCard>
    );
  }

  return (
    <details
      className="group rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line"
      onToggle={(e) => {
        if (e.currentTarget.open) setOpened(true);
      }}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">{t.title}</span>
          <span className="block text-xs text-ink-soft">{t.hint}</span>
        </span>
        <IconCaretDown className="size-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-line p-4 sm:p-5">{opened && <HistoryBody productName={productName} variants={listed} />}</div>
    </details>
  );
}

function HistoryBody({ productName, variants }: { productName: string; variants: Variant[] }) {
  const t = useT(PRICE_HISTORY_STRINGS);
  const workspaceId = useWorkspaceId();
  const selectId = useId();
  const [variantId, setVariantId] = useState(variants[0].id);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const [showAll, setShowAll] = useState(false);
  const days = PRICE_HISTORY_DAYS.default;
  // Read again when the variant's price changes on this page (an edit above).
  const history = useAsync(
    () => variantPriceHistory(apiClient, workspaceId, variant.id, days),
    [workspaceId, variant.id, variant.priceAmount, variant.compareAtAmount, days]
  );

  const label = (v: Variant) => formatOptions(v.optionValues) || v.sku || t.singleVariant;
  const data = history.data;
  const currency = data?.current.currency ?? variant.currency;
  const money = (minor: number | string | null) => formatMoney(minor, currency);
  const onSale = data ? data.current.compareAtAmount !== null && parseMoney(data.current.compareAtAmount) > parseMoney(data.current.priceAmount) : false;
  const newestFirst = data ? [...data.changes].reverse() : [];
  const rows = showAll ? newestFirst : newestFirst.slice(0, SHOWN);

  const columns: Column<PriceHistoryChange>[] = [
    { key: "when", header: t.colDate, cell: (c) => <span className="whitespace-nowrap text-ink">{formatDateTime(c.changedAt)}</span> },
    { key: "price", header: t.colPrice, align: "end", cell: (c) => <span className="font-medium whitespace-nowrap tabular-nums text-ink">{money(c.priceAmount)}</span> },
    {
      key: "compareAt",
      header: t.colCompareAt,
      align: "end",
      cell: (c) => (c.compareAtAmount === null ? "—" : <span className="whitespace-nowrap tabular-nums text-ink-soft">{money(c.compareAtAmount)}</span>),
    },
  ];

  return (
    <div className="space-y-4">
      {variants.length > 1 && (
        <div className="max-w-sm space-y-1.5">
          <label htmlFor={selectId} className="text-sm font-medium text-ink">
            {t.variantLabel}
          </label>
          <Select
            id={selectId}
            className="h-11"
            value={variant.id}
            onChange={(e) => {
              setVariantId(e.target.value);
              setShowAll(false);
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

      <DataState loading={history.loading} error={history.error} onRetry={() => void history.refresh()}>
        {data && (
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--radius)] bg-paper-sunken px-3 py-2.5">
                <dt className="text-xs text-ink-soft">{t.current}</dt>
                <dd className="mt-0.5 text-lg font-semibold text-ink">{money(data.current.priceAmount)}</dd>
              </div>
              <div className="rounded-[var(--radius)] bg-paper-sunken px-3 py-2.5">
                <dt className="text-xs text-ink-soft">{t.compareAt}</dt>
                <dd className="mt-0.5 text-lg font-semibold text-ink">{data.current.compareAtAmount === null ? t.none : money(data.current.compareAtAmount)}</dd>
              </div>
              <div className="rounded-[var(--radius)] bg-paper-sunken px-3 py-2.5">
                <dt className="text-xs text-ink-soft">{t.lowest30}</dt>
                <dd className="mt-0.5 text-lg font-semibold text-ink">{data.lowest30Days === null ? t.none : money(data.lowest30Days)}</dd>
                <dd className="mt-0.5 text-xs text-ink-soft">{onSale ? t.lowest30Shown : t.lowest30Idle}</dd>
              </div>
            </dl>

            {data.changes.length === 0 ? (
              <p className="rounded-[var(--radius)] border border-dashed border-line px-4 py-5 text-center text-sm text-ink-soft">{fmt(t.emptyChanges, { days })}</p>
            ) : (
              <>
                <figure className="space-y-2">
                  {/* Two series, so a key: each line by its own stroke, the text in ink. */}
                  <ul aria-label={t.legendLabel} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                    <li className="flex items-center gap-1.5">
                      <span aria-hidden className="inline-block h-0.5 w-4 rounded bg-primary" />
                      {t.legendPrice}
                    </li>
                    {data.changes.some((c) => c.compareAtAmount !== null) && (
                      <li className="flex items-center gap-1.5">
                        <span aria-hidden className="inline-block h-0 w-4 border-t-2 border-dashed border-line-strong" />
                        {t.legendCompareAt}
                      </li>
                    )}
                  </ul>
                  <PriceStepChart
                    changes={data.changes}
                    formatMoney={(minor) => money(minor)}
                    formatDate={formatDate}
                    formatDateTime={formatDateTime}
                    priceLabel={t.legendPrice}
                    compareAtLabel={t.legendCompareAt}
                    summary={fmt(t.chartSummary, { name: variants.length > 1 ? `${productName} — ${label(variant)}` : productName, days })}
                  />
                </figure>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-ink">{t.changesTitle}</h3>
                  <div className="overflow-hidden rounded-[var(--radius)] ring-1 ring-line max-md:ring-0">
                    <DataTable columns={columns} rows={rows} rowKey={(c, i) => `${c.changedAt}:${i}`} minWidth="24rem" />
                  </div>
                  {newestFirst.length > SHOWN && (
                    <Button type="button" variant="ghost" className="min-h-11" onClick={() => setShowAll((v) => !v)}>
                      {showAll ? t.showFewer : fmt(t.showAll, { count: newestFirst.length })}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}

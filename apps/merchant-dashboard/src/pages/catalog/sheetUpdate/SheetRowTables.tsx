import { useState, type ReactNode } from "react";
import { IconWarning } from "@/components/icons";
import type { CatalogSheetAmountField, CatalogSheetChange, CatalogSheetUnknownRow } from "@store-builder/api-client";
import { formatMoney, formatOptions } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DataTable, type Column } from "@/components/DataTable";
import { LoadMore } from "@/components/LoadMore";
import { num, signed } from "@/pages/inventory/inventoryText";
import { TableCard, VariantCell } from "@/pages/inventory/InventoryParts";
import { sheetRowProblemIsVerbatim, sheetRowProblemText } from "./sheetProblemText";
import { SHEET_UPDATE_STRINGS } from "./sheetUpdateStrings";

/** Rows drawn at first, and added by each "Load more": a sheet can hold 5000. */
const PAGE = 50;

function usePaged<T>(rows: readonly T[]) {
  const [shown, setShown] = useState(PAGE);
  return { visible: rows.slice(0, shown), hasMore: rows.length > shown, more: () => setShown((n) => n + PAGE) };
}

/** The line of the file a row came from (the header is line 1). */
function RowNumber({ row }: { row: number }) {
  return <span className="tabular-nums text-ink-soft">{num(row)}</span>;
}

function Sku({ sku }: { sku: string | undefined }) {
  if (!sku) return <>—</>;
  return (
    <bdi dir="ltr" className="font-mono text-[13px] text-ink">
      {sku}
    </bdi>
  );
}

/** "old → new", the new value the one that stands out. The arrow comes with the language's own direction. */
function Change({ from, to, note }: { from: ReactNode; to: ReactNode; note?: string }) {
  const t = useT(SHEET_UPDATE_STRINGS);
  const arrow = t.change.replace("{from}", "").replace("{to}", "");
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="text-ink-soft">{from}</span>
      {arrow}
      <span className="font-semibold text-ink">{to}</span>
      {note && (
        <>
          {" "}
          {/* Left to right, so a sign stays in front of its number in Arabic too. */}
          <bdi dir="ltr" className="text-xs text-ink-soft">
            {note}
          </bdi>
        </>
      )}
    </span>
  );
}

/** The rows that change something: each changed field as old → new, and a note when the new count is under what open orders hold. */
export function SheetChangesTable({ changes, currency }: { changes: readonly CatalogSheetChange[]; currency: string }) {
  const t = useT(SHEET_UPDATE_STRINGS);
  const page = usePaged(changes);
  const money = (value: string | null) => (value === null ? t.none : formatMoney(value, currency));

  const amount = (key: CatalogSheetAmountField, header: string): Column<CatalogSheetChange> => ({
    key,
    header,
    align: "end",
    cell: (change) => {
      const field = change.fields[key];
      return field ? <Change from={money(field.from)} to={money(field.to)} /> : "—";
    },
  });

  const columns: Column<CatalogSheetChange>[] = [
    {
      key: "product",
      header: t.colProduct,
      cell: (change) => {
        const reserved = change.warnings?.find((warning) => warning.code === "BELOW_RESERVED")?.reserved;
        return (
          <VariantCell name={change.productName ?? t.unknownProduct} detail={formatOptions(change.options) || undefined}>
            <span className="text-xs font-normal">
              <Sku sku={change.sku} />
            </span>
            {reserved !== undefined && (
              <span className="mt-1 inline-flex items-start gap-1.5 self-start rounded-[0.375rem] bg-accent-soft px-2 py-1 text-xs font-medium text-accent-dark">
                <IconWarning className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {fmt(t.belowReserved, { reserved })}
              </span>
            )}
          </VariantCell>
        );
      },
    },
    { key: "row", header: t.colRow, align: "end", cell: (change) => <RowNumber row={change.row} /> },
    {
      key: "stock",
      header: t.colStock,
      align: "end",
      cell: (change) => {
        const stock = change.fields.stock;
        if (!stock) return "—";
        const note = change.stockChange ? fmt(t.stockChangeNote, { delta: signed(change.stockChange) }) : undefined;
        return <Change from={num(stock.from)} to={num(stock.to)} note={note} />;
      },
    },
    amount("priceAmount", t.colPrice),
    amount("compareAtAmount", t.colCompareAt),
    amount("costAmount", t.colCost),
  ];

  return (
    <>
      <TableCard>
        <DataTable columns={columns} rows={page.visible} rowKey={(change) => `${change.row}-${change.variantId}`} minWidth="56rem" />
      </TableCard>
      <LoadMore hasMore={page.hasMore} loading={false} onClick={page.more} />
    </>
  );
}

/** Rows whose SKU is no variant of the store. */
export function SheetUnknownTable({ rows }: { rows: readonly CatalogSheetUnknownRow[] }) {
  const t = useT(SHEET_UPDATE_STRINGS);
  const page = usePaged(rows);
  const columns: Column<CatalogSheetUnknownRow>[] = [
    { key: "sku", header: t.colSku, cell: (row) => <Sku sku={row.sku} /> },
    { key: "row", header: t.colRow, align: "end", cell: (row) => <RowNumber row={row.row} /> },
  ];
  return (
    <>
      <TableCard>
        <DataTable columns={columns} rows={page.visible} rowKey={(row) => `${row.row}-${row.sku}`} minWidth="24rem" />
      </TableCard>
      <LoadMore hasMore={page.hasMore} loading={false} onClick={page.more} />
    </>
  );
}

export interface SheetProblemRow {
  row: number;
  sku?: string;
  message: string;
}

/** Rows that were skipped (or could not be saved), with what is wrong in the merchant's language. */
export function SheetProblemsTable({ rows }: { rows: readonly SheetProblemRow[] }) {
  const t = useT(SHEET_UPDATE_STRINGS);
  const page = usePaged(rows);
  const columns: Column<SheetProblemRow>[] = [
    {
      key: "problem",
      header: t.colProblem,
      cell: (row) => (
        <span className="font-medium text-ink" dir={sheetRowProblemIsVerbatim(row.message) ? "auto" : undefined}>
          {sheetRowProblemText(t, row.message)}
        </span>
      ),
    },
    { key: "sku", header: t.colSku, phoneSkip: (row) => !row.sku, cell: (row) => <Sku sku={row.sku} /> },
    { key: "row", header: t.colRow, align: "end", cell: (row) => <RowNumber row={row.row} /> },
  ];
  return (
    <>
      <TableCard>
        <DataTable columns={columns} rows={page.visible} rowKey={(row, index) => `${row.row}-${index}`} minWidth="32rem" />
      </TableCard>
      <LoadMore hasMore={page.hasMore} loading={false} onClick={page.more} />
    </>
  );
}

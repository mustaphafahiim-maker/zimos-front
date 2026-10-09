import { useMemo } from "react";
import type { ProfitGroupBy, ProfitPnl, ProfitRow, ProfitStatement } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { ReportTable, type ReportColumn } from "@/components/report";
import { Segmented } from "@/components/Segmented";
import { useT } from "@/i18n/LocaleContext";
import { formatAxisDate, formatCount, percentToRatio } from "@/lib/analytics";
import { formatPercentValue } from "@/lib/format";
import { useSalesMoney } from "@/pages/reports/tabs/sales/SalesParts";
import { statementCosts } from "@/pages/reports/tabs/sales/salesData";
import { PROFIT_STRINGS, type ProfitVersion } from "./profitStrings";

export const PROFIT_GROUPS: readonly ProfitGroupBy[] = ["day", "product", "campaign"];

/** A row with no order and no spend says nothing: it is left out of the product and campaign views. */
function hasSomething(row: ProfitRow): boolean {
  return row.orders.delivered + row.orders.returned + row.orders.open > 0 || row.actual.adSpend > 0;
}

/**
 * The rows of a statement in the order the page opens them in: days from the
 * newest, products and campaigns from the one that kept the most.
 */
export function orderedProfitRows(pnl: ProfitPnl, version: ProfitVersion): ProfitRow[] {
  if (pnl.groupBy === "day") return [...pnl.rows].reverse();
  return pnl.rows.filter(hasSomething).sort((a, b) => b[version].netProfit - a[version].netProfit);
}

/** What a row is called: its day, or the name of its product or campaign. */
export function profitRowLabel(row: ProfitRow, groupBy: ProfitGroupBy, noCampaign: string): string {
  return groupBy === "day" ? formatAxisDate(row.key) : row.label || row.key || noCampaign;
}

/**
 * The page's ONE table: the statement per day, and — through the switch on its
 * title line — per product or per campaign (which add the most an ad may cost
 * per order). Every column sorts; the export is the table as shown, built in
 * the browser.
 *
 * `pnl` may still be the answer to the view before while the next one loads:
 * the columns follow what the answer itself says it is grouped by, never the
 * switch, so a day is not read as a product for a moment.
 */
export function ProfitTable({
  pnl,
  version,
  group,
  onGroup,
  rangeName,
}: {
  pnl: ProfitPnl;
  version: ProfitVersion;
  /** What the switch shows (the view asked for). */
  group: ProfitGroupBy;
  onGroup: (group: ProfitGroupBy) => void;
  /** Goes into the file name: "30d". */
  rangeName: string;
}) {
  const t = useT(PROFIT_STRINGS);
  const { money, signed, major } = useSalesMoney(pnl.currency);
  const shown = pnl.groupBy;
  const rows = useMemo(() => orderedProfitRows(pnl, version), [pnl, version]);

  const columns = useMemo<ReportColumn<ProfitRow>[]>(() => {
    const of = (row: ProfitRow): ProfitStatement => row[version];
    const percent = (value: number | null) => formatPercentValue(percentToRatio(value));
    const list: ReportColumn<ProfitRow>[] = [
      {
        key: "label",
        header: shown === "day" ? t.colDay : shown === "product" ? t.colProduct : t.colCampaign,
        cell: (row) => profitRowLabel(row, shown, t.noCampaign),
        sortValue: (row) => (shown === "day" ? Date.parse(row.key) : profitRowLabel(row, shown, t.noCampaign)),
        csv: (row) => (shown === "day" ? row.key : profitRowLabel(row, shown, t.noCampaign)),
      },
      {
        key: "net",
        header: t.colNet,
        align: "end",
        cell: (row) => (
          <bdi dir="ltr" className={cn("font-medium", of(row).netProfit < 0 && "text-danger")}>
            {signed(of(row).netProfit)}
          </bdi>
        ),
        sortValue: (row) => of(row).netProfit,
        csv: (row) => major(of(row).netProfit),
      },
      {
        key: "margin",
        header: t.colMargin,
        hint: t.marginHint,
        align: "end",
        cell: (row) => percent(of(row).margin),
        sortValue: (row) => of(row).margin,
        csv: (row) => of(row).margin,
      },
      {
        key: "revenue",
        header: t.colRevenue,
        align: "end",
        cell: (row) => money(of(row).revenue),
        sortValue: (row) => of(row).revenue,
        csv: (row) => major(of(row).revenue),
      },
      {
        key: "costs",
        header: t.colCosts,
        hint: t.colCostsHint,
        align: "end",
        cell: (row) => money(statementCosts(of(row))),
        sortValue: (row) => statementCosts(of(row)),
        csv: (row) => major(statementCosts(of(row))),
      },
    ];
    // Ad spend cannot be split per product: there it is in the totals only.
    if (shown !== "product") {
      list.push({
        key: "ads",
        header: t.colAds,
        align: "end",
        cell: (row) => money(of(row).adSpend),
        sortValue: (row) => of(row).adSpend,
        csv: (row) => major(of(row).adSpend),
      });
    }
    list.push(
      {
        key: "delivered",
        header: t.colDelivered,
        align: "end",
        cell: (row) => formatCount(Math.round(row.orders.delivered)),
        sortValue: (row) => row.orders.delivered,
        csv: (row) => Math.round(row.orders.delivered),
      },
      {
        key: "returned",
        header: t.colReturned,
        align: "end",
        cell: (row) => formatCount(Math.round(row.orders.returned)),
        sortValue: (row) => row.orders.returned,
        csv: (row) => Math.round(row.orders.returned),
      }
    );
    if (shown !== "day") {
      list.push({
        key: "maxCpa",
        header: t.colMaxCpa,
        hint: t.maxCpaHint,
        align: "end",
        cell: (row) => (row.maxCpa === null ? "—" : money(row.maxCpa)),
        sortValue: (row) => row.maxCpa,
        csv: (row) => (row.maxCpa === null ? null : major(row.maxCpa)),
      });
    }
    return list;
    // `money`, `signed` and `major` change together, with the report currency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, shown, version, money]);

  // No `key`: the three views are ONE table to React, so the switch on its title line stays mounted (its thumb
  // slides, the keyboard keeps its place) and a column the merchant sorted by stays sorted from view to view.
  return (
    <ReportTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.key || "none"}
      exportName={`zimos-profit-by-${shown}-${rangeName}`}
      caption={shown === "day" ? t.dayCaption : shown === "product" ? t.productCaption : t.campaignCaption}
      note={shown === "product" ? t.productAdsNote : undefined}
      empty={t.noRows}
      toolbar={
        <Segmented
          size="sm"
          value={group}
          onChange={onGroup}
          label={t.groupLabel}
          options={[
            { value: "day", label: t.byDay },
            { value: "product", label: t.byProduct },
            { value: "campaign", label: t.byCampaign },
          ]}
        />
      }
    />
  );
}

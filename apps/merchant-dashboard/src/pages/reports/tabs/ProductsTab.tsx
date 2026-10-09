import { Fragment, useMemo, type ReactNode } from "react";
import {
  STOCK_FORECAST_MAX_ROWS,
  profitGetPnl,
  reportsGetProducts,
  reportsGetSales,
  stockForecastGet,
  type ProfitPnl,
  type ReportsCompare,
  type ReportsProducts,
  type ReportsSales,
  type StockForecast,
} from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { SkeletonBar } from "@/components/DataState";
import { IconCoins, IconHourglass, IconInventory, IconLayers, IconReturns, IconRuler, IconSliders, IconWarning } from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import {
  ReportChartCard,
  ReportKpiStrip,
  ReportLinks,
  ReportMore,
  ReportTab,
  ReportTabState,
  ReportTable,
  ReportTakeaway,
  useTabData,
  type ReportColumn,
  type ReportLinkItem,
  type ReportTabProps,
  type ReportTakeawayAction,
  type ReportTone,
} from "@/components/report";
import { fmt, useT } from "@/i18n/LocaleContext";
import { deltaBasisPoints, formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { formatPercentValue } from "@/lib/format";
import { NO_INVENTORY_ROLES } from "@/lib/inventoryAccess";
import { countOf, pluralOf } from "@/lib/plural";
import { canViewProducts } from "@/lib/productAccess";
import type { ReportPreset, ReportRange } from "@/lib/reportRange";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { formatRate, RateBar } from "@/pages/analytics/reports/parts";
import { storeReportPath } from "@/pages/analytics/storeReports/storeReportStrings";
import { REPORT_TAB_QUESTIONS } from "../reportTabs";
import { FlaggedSection, LandingSection, ProfitSection, ReturnsSection, StockSection } from "./products/MoreSections";
import {
  GOOD_RETURN_RATE,
  HIGH_RETURN_RATE,
  PRODUCTS_LIMIT,
  canRankByProfit,
  highReturners,
  joinProducts,
  listedTotals,
  profitBars,
  salesBars,
  sideOf,
  stockByProduct,
  summarizeStock,
  takeawayFacts,
  weakSellers,
  type ProductLine,
  type Side,
} from "./products/model";
import { Figure, NameInText, PartError, StockDaysCell, rateInWords, rich, useMoney } from "./products/parts";
import { PRODUCTS_TAB_STRINGS } from "./products/strings";
import { TopProductsChart } from "./products/TopProductsChart";

/** The picked days and instants of the hub's range, without the comparison (see `period` below). */
type Period = Pick<ReportRange, "from" | "to" | "compare" | "fromDay" | "toDay">;

/**
 * Reports → «المنتجات»: إيه اللي بيتباع وإيه اللي بيرجع؟
 *
 * KPI strip · the top products by delivered profit · the table product by
 * product · one sentence · «تفاصيل أكتر» · the links out.
 *
 * Four reads, all started at once:
 * - MAIN `reportsGetProducts` (analytics.view): views, add to carts, orders,
 *   pieces, sales, conversion, delivery and return rates, and the landing
 *   pages. Refused → the tab's no-permission state.
 * - `profitGetPnl groupBy product` (financial_reports.view): the delivered
 *   profit of each product, joined on by product id. Refused → no profit
 *   column, the chart ranks by sales, no «ربح كل منتج».
 * - `stockForecastGet` (inventory.view): how long each product's stock lasts.
 *   It is a snapshot of now, so it is not asked again when the range changes.
 *   Refused → no stock card, no stock column.
 * - `reportsGetSales` (analytics.view): pieces sold and product sales of the
 *   whole store WITH the period before — the only two figures of this tab the
 *   API can compare. Missing → the two cards add up the table, with no chip.
 *
 * The range: the hub's instants go to the reports and the P&L as they are;
 * the returns store report (opened inside «تفاصيل أكتر») takes the picked DAYS.
 *
 * Rates: «اتسلّم» and «المرتجع» are ONE source on this tab — the products
 * report, out of the pieces that shipped. The returns report counts something
 * else (return requests after delivery) and is labelled so where it appears.
 *
 * The rule of the sentence is written out above `takeawayFacts` (products/model.ts).
 */
export default function ProductsTab(props: ReportTabProps) {
  // One instance per store: the stock forecast is remembered apart from the range, and nothing
  // a hook still holds may outlive the store it was read for.
  return <ProductsTabFor key={props.workspaceId} {...props} />;
}

function ProductsTabFor({ workspaceId, range, role }: ReportTabProps) {
  const questions = useT(REPORT_TAB_QUESTIONS);
  const t = useT(PRODUCTS_TAB_STRINGS);

  // Only the two compared cards depend on what the hub compares with: every other read is named
  // without it, so changing the comparison does not send the whole tab back to its skeleton.
  const period = useMemo<Period>(
    () => ({ from: range.from, to: range.to, fromDay: range.fromDay, toDay: range.toDay, compare: "none" }),
    [range.from, range.to, range.fromDay, range.toDay]
  );

  const main = useTabData("products", workspaceId, period, () =>
    reportsGetProducts(apiClient, workspaceId, { from: range.from, to: range.to, limit: PRODUCTS_LIMIT })
  );
  const pnlQuery = useTabData("products:pnl", workspaceId, period, () =>
    profitGetPnl(apiClient, workspaceId, { from: range.from, to: range.to, groupBy: "product" })
  );
  const salesQuery = useTabData("products:sales", workspaceId, range, () =>
    reportsGetSales(apiClient, workspaceId, { from: range.from, to: range.to, compare: range.compare })
  );
  // A system role known not to hold inventory.view is not asked at all (null reads as "not for this role").
  const stockAllowed = !NO_INVENTORY_ROLES.has(role ?? "");
  const stockQuery = useCachedAsync<StockForecast | null>(
    workspaceId ? `report:products:stock:${workspaceId}:${stockAllowed ? "read" : "skip"}` : null,
    () => (stockAllowed ? stockForecastGet(apiClient, workspaceId, { limit: STOCK_FORECAST_MAX_ROWS }) : Promise.resolve(null)),
    [workspaceId, stockAllowed]
  );
  // The forecast is one answer per store: the last one stays on screen while it is read again, and
  // when that second read fails. Only a first read that fails leaves the stock parts out.
  const stock: Side<StockForecast> = !stockAllowed
    ? { state: "denied" }
    : !stockQuery.loading && stockQuery.data
      ? { state: "ok", data: stockQuery.data }
      : sideOf<StockForecast>(stockQuery);

  return (
    <ReportTab question={questions.products} note={t.note}>
      <ReportTabState loading={main.loading} error={main.error} onRetry={main.retry}>
        {main.data && (
          <ProductsBody
            workspaceId={workspaceId}
            period={period}
            preset={range.preset}
            compare={range.compare}
            report={main.data}
            pnl={sideOf<ProfitPnl>(pnlQuery)}
            stock={stock}
            sales={sideOf<ReportsSales>(salesQuery)}
            canOpenProducts={canViewProducts(role)}
            retryPnl={pnlQuery.retry}
            retryStock={() => void stockQuery.refresh()}
            retrySales={salesQuery.retry}
          />
        )}
      </ReportTabState>
    </ReportTab>
  );
}

interface ProductsBodyProps {
  workspaceId: string;
  period: Period;
  preset: ReportPreset;
  compare: ReportsCompare;
  report: ReportsProducts;
  pnl: Side<ProfitPnl>;
  stock: Side<StockForecast>;
  sales: Side<ReportsSales>;
  /** Whether a product's name opens its page (products.view). */
  canOpenProducts: boolean;
  retryPnl: () => void;
  retryStock: () => void;
  retrySales: () => void;
}

/** The tab's parts, once the products report is here. The side reads fill in their own parts as they arrive. */
function ProductsBody({
  workspaceId,
  period,
  preset,
  compare,
  report,
  pnl,
  stock,
  sales,
  canOpenProducts,
  retryPnl,
  retryStock,
  retrySales,
}: ProductsBodyProps) {
  const t = useT(PRODUCTS_TAB_STRINGS);
  const money = useMoney(report.currency);

  const pnlData = pnl.state === "ok" ? pnl.data : null;
  const stockData = stock.state === "ok" ? stock.data : null;
  const salesData = sales.state === "ok" ? sales.data : null;

  const stockMap = useMemo(() => (stockData ? stockByProduct(stockData) : null), [stockData]);
  const stockSummary = useMemo(() => (stockData ? summarizeStock(stockData) : null), [stockData]);
  const lines = useMemo(() => joinProducts(report.products, pnlData, stockMap), [report.products, pnlData, stockMap]);
  const listed = useMemo(() => listedTotals(report.products), [report.products]);
  const returners = useMemo(() => highReturners(report.products), [report.products]);
  const weak = useMemo(() => weakSellers(report.products), [report.products]);
  const facts = useMemo(() => takeawayFacts(lines, pnlData), [lines, pnlData]);

  // ------------------------------------------------------------- KPI strip --

  const compared = compare !== "none";
  const deltaLabel = compare === "year" ? t.vsYear : undefined;
  const unitsKpi = salesData?.kpis.unitsSold ?? null;
  const grossKpi = salesData?.kpis.grossSales ?? null;
  const unitsFromStore = unitsKpi !== null && unitsKpi.value !== null;
  const grossFromStore = grossKpi !== null && grossKpi.value !== null;
  const stockTracked = stockData !== null && stockData.total > 0;
  const stockWindow = stockData ? countOf("day", stockData.settings.windowDays) : "";

  // A side read that failed (not one that was refused): its part is left out, and one line says so.
  const failedParts = [
    pnl.state === "failed" ? t.sideProfit : null,
    stock.state === "failed" ? t.sideStock : null,
    sales.state === "failed" ? t.sideCompare : null,
  ].filter((part): part is string => part !== null);
  function retryFailed() {
    if (pnl.state === "failed") retryPnl();
    if (stock.state === "failed") retryStock();
    if (sales.state === "failed") retrySales();
  }

  // ------------------------------------------------------------- the chart --

  // By delivered profit when the P&L can be read and something has finished; by sales otherwise.
  const byProfit = pnlData !== null && canRankByProfit(pnlData);
  const bars = useMemo(
    () => (pnlData !== null && canRankByProfit(pnlData) ? profitBars(pnlData) : salesBars(report.products)),
    [pnlData, report.products]
  );
  const coverage = byProfit && pnlData ? pnlData.costCoverage : null;
  const coverageWarning =
    coverage === null || coverage >= 100
      ? null
      : coverage === 0
        ? t.coverageNone
        : fmt(t.coveragePartial, { pct: formatPercentValue(coverage / 100, 0) });
  const chartNote: ReactNode = byProfit ? (
    <>
      {t.chartProfitNote}
      {coverageWarning && (
        <span className="mt-1 flex items-start gap-1.5 text-ink">
          <IconWarning aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0 text-accent-dark" />
          <span className="min-w-0">{coverageWarning}</span>
        </span>
      )}
    </>
  ) : pnlData !== null ? (
    t.chartNoFinished
  ) : (
    t.chartSalesNote
  );

  // ------------------------------------------------------------- the table --

  const columns: ReportColumn<ProductLine>[] = [
    { key: "name", header: t.colProduct, cell: (row) => row.name, sortValue: (row) => row.name },
    { key: "units", header: t.colUnits, align: "end", cell: (row) => formatCount(row.units), sortValue: (row) => row.units },
    {
      key: "sales",
      header: t.colSales,
      align: "end",
      cell: (row) => <Figure className="font-medium text-ink">{money.format(row.sales)}</Figure>,
      sortValue: (row) => row.sales,
      csv: (row) => money.major(row.sales),
    },
    { key: "orders", header: t.colOrders, align: "end", cell: (row) => formatCount(row.orders), sortValue: (row) => row.orders },
    {
      key: "returns",
      header: t.colReturn,
      hint: t.colReturnHint,
      cell: (row) => <RateBar percent={row.returnRate} good={GOOD_RETURN_RATE} bad={HIGH_RETURN_RATE} inverted />,
      sortValue: (row) => row.returnRate,
    },
    {
      key: "delivery",
      header: t.colDelivery,
      hint: t.colDeliveryHint,
      cell: (row) => <RateBar percent={row.deliveryRate} />,
      sortValue: (row) => row.deliveryRate,
    },
  ];
  // The profit column holds its place while the P&L is on its way, and is simply not there for a
  // role that may not read it (or when the read failed: the line under the cards says so).
  if (pnl.state === "loading" || pnl.state === "ok") {
    columns.push({
      key: "profit",
      header: t.colProfit,
      hint: t.colProfitHint,
      align: "end",
      cell: (row) =>
        pnl.state === "loading" ? (
          <SkeletonBar className="my-1 ms-auto w-14" />
        ) : row.profit === null ? (
          "—"
        ) : (
          <Figure className={cn("font-medium", row.profit < 0 ? "text-danger" : "text-ink")}>{money.format(row.profit)}</Figure>
        ),
      sortValue: (row) => row.profit,
      csv: (row) => money.major(row.profit),
    });
  }
  // The same for the stock column; a store that tracks no quantities has nothing to put in it.
  if (stock.state === "loading" || stockTracked) {
    columns.push({
      key: "stock",
      header: t.colStock,
      hint: stockTracked ? fmt(t.colStockHint, { days: stockWindow }) : undefined,
      align: "end",
      cell: (row) => (stock.state === "loading" ? <SkeletonBar className="my-1 ms-auto w-12" /> : <StockDaysCell stock={row.stock} />),
      sortValue: (row) => row.stock?.days ?? null,
      csv: (row) => row.stock?.days ?? null,
    });
  }
  columns.push(
    {
      key: "views",
      header: t.colViews,
      hint: t.colViewsHint,
      align: "end",
      cell: (row) => formatCount(row.views),
      sortValue: (row) => row.views,
    },
    {
      key: "carts",
      header: t.colCarts,
      hint: t.colCartsHint,
      align: "end",
      // The count, then its share of the views in quieter ink: the old table's «الإضافة للسلة» rate is kept beside the count.
      cell: (row) => (
        <span className="inline-flex items-baseline justify-end gap-1.5">
          <bdi>{formatCount(row.addToCarts)}</bdi>
          {row.addToCartRate !== null && <bdi className="text-xs text-ink-soft">{formatRate(row.addToCartRate)}</bdi>}
        </span>
      ),
      sortValue: (row) => row.addToCarts,
    },
    {
      key: "conversion",
      header: t.colConversion,
      hint: t.colConversionHint,
      align: "end",
      cell: (row) => formatRate(row.conversionRate),
      sortValue: (row) => row.conversionRate,
    }
  );

  // ---------------------------------------------------------- the sentence --

  // The sentence waits for the profit and the stock: it must not say one thing and then another.
  const sentencePending = pnl.state === "loading" || stock.state === "loading";
  const clauses: ReactNode[] = [];
  let tone: ReportTone = "good";
  let action: ReportTakeawayAction | undefined;
  const openProduct = (productId: string | null): ReportTakeawayAction | undefined =>
    canOpenProducts && productId ? { label: t.openProduct, to: `/catalog/${productId}` } : undefined;

  if (!facts.thin) {
    // 1. The one that earns.
    if (facts.earner) {
      clauses.push(
        rich(facts.earner.by === "profit" ? t.sayEarnProfit : t.sayEarnSales, {
          name: <NameInText name={facts.earner.name ?? t.deletedProduct} />,
          amount: <Figure>{money.format(facts.earner.amount)}</Figure>,
        })
      );
    }
    // 2. The one that keeps coming back — or, with none, the one that is looked at and not bought.
    if (facts.returner) {
      clauses.push(
        rich(t.sayReturns, {
          name: <NameInText name={facts.returner.name} />,
          rate: rateInWords(facts.returner.returnRate ?? 0, t),
        })
      );
    } else if (facts.weak) {
      clauses.push(
        rich(t.sayWeak, {
          name: <NameInText name={facts.weak.name} />,
          views: pluralOf(t, "times", facts.weak.views),
          rate: rateInWords(facts.weak.conversionRate ?? 0, t),
        })
      );
    }
    // 3. The one about to run out.
    if (facts.runningOut) {
      const { product, stock: productStock } = facts.runningOut;
      const subject = rich(productStock.variants > 1 ? t.sayVariant : t.sayWhole, { name: <NameInText name={product.name} /> });
      const days = productStock.days ?? 0;
      const template = productStock.status === "out" ? t.sayStockOut : days <= 0 ? t.sayStockLastDay : t.sayStockDays;
      clauses.push(rich(template, { product: <>{subject}</>, days: countOf("day", days) }));
    }
    // Good news alone still says what was checked.
    if (clauses.length > 0 && !facts.returner && !facts.weak && !facts.runningOut) clauses.push(t.sayCalm);

    // The tone is the worst news in the sentence; the one action is the most urgent thing to do about it.
    tone = facts.returner ? "bad" : facts.runningOut || facts.weak ? "warn" : "good";
    action =
      (facts.returner ? openProduct(facts.returner.productId) : undefined) ??
      (facts.runningOut ? { label: t.actStock, to: "/inventory/forecast" } : undefined) ??
      (facts.weak ? openProduct(facts.weak.productId) : undefined) ??
      (facts.earner ? openProduct(facts.earner.productId) : undefined);
  }

  // ------------------------------------------------------------ links out --

  // The store reports read the same presets and the same picked days from their address.
  const dated = preset === "custom" ? `?from=${period.fromDay}&to=${period.toDay}` : `?range=${preset}`;
  const links: ReportLinkItem[] = [
    { to: `${storeReportPath("sales-by-collection")}${dated}`, title: t.linkCollections, description: t.linkCollectionsHint, icon: IconLayers },
    { to: `${storeReportPath("sales-by-option")}${dated}`, title: t.linkOptions, description: t.linkOptionsHint, icon: IconRuler },
    { to: `${storeReportPath("returns")}${dated}`, title: t.linkReturns, description: t.linkReturnsHint, icon: IconReturns },
    { to: storeReportPath("slow-stock"), title: t.linkSlow, description: t.linkSlowHint, icon: IconHourglass },
  ];
  // Inventory value and the costs page need financial_reports.view, as the P&L does; the inventory page inventory.view, as the forecast does.
  if (pnl.state !== "denied") {
    links.push({ to: storeReportPath("inventory-value"), title: t.linkValue, description: t.linkValueHint, icon: IconCoins });
  }
  if (stock.state !== "denied") {
    links.push({ to: "/inventory", title: t.linkInventory, description: t.linkInventoryHint, icon: IconInventory });
  }
  if (pnl.state !== "denied") {
    links.push({ to: "/profit/costs", title: t.linkCosts, description: t.linkCostsHint, icon: IconSliders });
  }

  return (
    <>
      <ReportKpiStrip sparkline={false}>
        {sales.state === "loading" ? (
          <KpiCard label={t.kpiUnits} value={null} loading />
        ) : unitsFromStore && unitsKpi ? (
          <KpiCard
            label={t.kpiUnits}
            value={formatCount(unitsKpi.value)}
            deltaBasisPoints={compared ? deltaBasisPoints(unitsKpi.value, unitsKpi.previous) : null}
            deltaLabel={deltaLabel}
            hint={compared ? undefined : t.kpiUnitsHint}
          />
        ) : (
          <KpiCard label={t.kpiUnits} value={formatCount(listed.units)} hint={t.kpiListedHint} />
        )}

        {sales.state === "loading" ? (
          <KpiCard label={t.kpiSales} value={null} loading />
        ) : grossFromStore && grossKpi ? (
          <KpiCard
            label={t.kpiSales}
            value={money.format(grossKpi.value)}
            deltaBasisPoints={compared ? deltaBasisPoints(grossKpi.value, grossKpi.previous) : null}
            deltaLabel={deltaLabel}
            hint={compared ? undefined : t.kpiSalesHint}
          />
        ) : (
          <KpiCard label={t.kpiSales} value={money.format(listed.sales)} hint={t.kpiListedHint} />
        )}

        <KpiCard
          label={t.kpiDelivery}
          value={formatRate(listed.deliveryRate)}
          hint={
            listed.ratedProducts > 0
              ? fmt(t.kpiDeliveryHint, { products: pluralOf(t, "products", listed.ratedProducts) })
              : t.kpiDeliveryNone
          }
        />

        {stock.state === "loading" && <KpiCard label={t.kpiStock} value={null} loading />}
        {stockData && stockSummary && (
          <KpiCard
            label={t.kpiStock}
            to="/inventory/forecast"
            // Past the 1000 rows one read brings, the count is a floor: it is said as "at least".
            value={stockTracked ? `${formatCount(stockSummary.products)}${stockSummary.complete ? "" : "+"}` : "—"}
            hint={stockTracked ? fmt(t.kpiStockHint, { days: stockWindow }) : t.kpiStockNone}
          />
        )}
      </ReportKpiStrip>

      {failedParts.length > 0 && (
        <PartError message={fmt(t.sideFailed, { parts: failedParts.join(t.listJoin) })} onRetry={retryFailed} className="px-1" />
      )}

      <ReportChartCard
        // While the P&L is on its way the card is named for what it will most likely show.
        title={byProfit || pnl.state === "loading" ? t.chartProfit : t.chartSales}
        note={pnl.state === "loading" ? undefined : chartNote}
        loading={pnl.state === "loading"}
        empty={bars.length === 0 ? t.chartEmpty : null}
      >
        {(height) => (
          <TopProductsChart
            bars={bars}
            height={height}
            format={money.format}
            summary={byProfit ? t.chartSummaryProfit : t.chartSummarySales}
            linked={canOpenProducts}
          />
        )}
      </ReportChartCard>

      <ReportTable
        columns={columns}
        rows={lines}
        rowKey={(row) => row.productId}
        rowTo={(row) => (canOpenProducts ? `/catalog/${row.productId}` : null)}
        defaultSort={{ key: "sales", dir: "desc" }}
        caption={t.table}
        note={
          report.products.length >= PRODUCTS_LIMIT ? (
            <>
              {t.tableNote} {fmt(t.tableCapped, { n: PRODUCTS_LIMIT })}
            </>
          ) : (
            t.tableNote
          )
        }
        empty={t.tableEmpty}
        exportName="zimos-products"
        range={period}
      />

      {sentencePending ? (
        <div
          aria-hidden
          className="zimos-skeleton relative h-14 animate-pulse overflow-hidden rounded-(--radius-card) bg-paper-sunken motion-reduce:animate-none"
        />
      ) : facts.thin || clauses.length === 0 ? (
        <ReportTakeaway tone="info">{t.sayThin}</ReportTakeaway>
      ) : (
        <ReportTakeaway tone={tone} action={action}>
          {clauses.map((clause, index) => (
            <Fragment key={index}>
              {index > 0 && t.sayJoin}
              {clause}
            </Fragment>
          ))}
          {t.sayEnd}
        </ReportTakeaway>
      )}

      <ReportMore>
        {(returners.length > 0 || weak.products.length > 0) && (
          <FlaggedSection returners={returners} weak={weak.products} average={weak.average} linked={canOpenProducts} />
        )}
        {(pnl.state === "ok" || pnl.state === "failed") && (
          <ProfitSection pnl={pnl} period={period} linked={canOpenProducts} onRetry={retryPnl} />
        )}
        {(stock.state === "failed" || (stockSummary !== null && stockSummary.urgent.length > 0)) && (
          <StockSection stock={stock} linked={canOpenProducts} onRetry={retryStock} />
        )}
        <ReturnsSection workspaceId={workspaceId} period={period} linked={canOpenProducts} />
        <LandingSection pages={report.landingPages} currency={report.currency} period={period} />
      </ReportMore>

      <ReportLinks items={links} />
    </>
  );
}

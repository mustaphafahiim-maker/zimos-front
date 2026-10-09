import { useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  reportsGetInsights,
  reportsGetSales,
  type ReportsInsights,
  type ReportsSales,
  type ReportsSeriesPoint,
  type ReportsUnit,
} from "@store-builder/api-client";
import { Card } from "@store-builder/ui";
import { AccordionSection } from "@/components/Accordion";
import { ComparisonLineChart } from "@/components/charts";
import {
  IconAds,
  IconAttribution,
  IconCard,
  IconCash,
  IconChartPie,
  IconClock,
  IconDevices,
  IconGift,
  IconOrders,
  IconProfit,
  IconReceipt,
  IconSettlements,
  IconSliders,
} from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import {
  ReportChartCard,
  ReportKpiStrip,
  ReportLegend,
  ReportLinks,
  ReportMore,
  ReportTab,
  ReportTable,
  ReportTabState,
  ReportTakeaway,
  useTabData,
  type ReportColumn,
  type ReportLegendItem,
  type ReportLinkItem,
  type ReportTabProps,
  type ReportTakeawayAction,
  type ReportTone,
} from "@/components/report";
import { Select } from "@/components/Select";
import { fmt, useT } from "@/i18n/LocaleContext";
import { deltaBasisPoints, formatCount, formatWindow } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { formatPercentValue } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { formatBucket, type ReportRange } from "@/lib/reportRange";
import { formatConversion } from "@/components/report/rates";
import { storeReportPath } from "@/pages/analytics/storeReports/storeReportStrings";
import { REPORT_TAB_PATHS, REPORT_TAB_QUESTIONS } from "../reportTabs";
import { ProfitDetails } from "./sales/ProfitDetails";
import {
  CashSection,
  ChannelsTable,
  DevicesTable,
  OrderTimes,
  PaymentMethods,
  SalesBreakdown,
  StatusSection,
  busiestLine,
} from "./sales/SalesMore";
import { CostsNote, Num, PartState, fill, hourName, useSalesMoney, weekdayName, type SalesMoney } from "./sales/SalesParts";
import {
  MIN_ORDERS,
  loadProfit,
  outOf,
  peakTime,
  readProfit,
  readSales,
  type ProfitAnswer,
  type ProfitReading,
} from "./sales/salesData";
import { SALES_STRINGS, type SalesKey, type SalesStrings } from "./sales/salesStrings";

/* ------------------------------------------------------------------ *
 * What the chart and the table can show
 * ------------------------------------------------------------------ */

/** The series the ONE chart can plot — the money and order series of the sales report. */
type ChartMetric = "sales" | "orders" | "averageOrderValue" | "deliveredSales";

const CHART_METRICS: readonly ChartMetric[] = ["sales", "orders", "averageOrderValue", "deliveredSales"];

const METRIC_LABEL: Record<ChartMetric, SalesKey> = {
  sales: "metricSales",
  orders: "metricOrders",
  averageOrderValue: "metricAov",
  deliveredSales: "metricDelivered",
};

/** The server picks the bucket of the series from the length of the range; the titles follow it. */
const UNIT_BY: Record<ReportsUnit, SalesKey> = { hour: "byHour", day: "byDay", week: "byWeek", month: "byMonth" };
const UNIT_COLUMN: Record<ReportsUnit, SalesKey> = { hour: "colHour", day: "colDay", week: "colWeek", month: "colMonth" };

/** Room under the chart, inside the card's fixed body, for the line that names the two series. */
const LEGEND_ROOM = 28;

/** One bucket of the series — an hour, a day, a week or a month — as a row of the table. */
interface BucketRow {
  bucket: string;
  /** The bucket as a time, to sort by. */
  at: number;
  orders: number;
  sales: number;
  deliveredSales: number;
  averageOrderValue: number;
  sessions: number;
  conversionRate: number | null;
  /** Net profit of the same day from the P&L; null when there is none to join. */
  profit: number | null;
}

/** The P&L request as the tab's parts see it. */
interface ProfitPart {
  loading: boolean;
  error: unknown;
  answer: ProfitAnswer | null;
  retry: () => void;
}

/* ------------------------------------------------------------------ *
 * The tab
 * ------------------------------------------------------------------ */

/**
 * «المبيعات والربح» — "How much did I really make?"
 *
 * - KPI strip: total sales, orders, average order, delivered sales (the sales
 *   report: each with its change against the hub's comparison and a trend) and
 *   net profit (the P&L, by the home's rules: the projection with its «تقديري»
 *   note while orders are on the way, incomplete product costs called out, and
 *   nothing named profit under the cost-coverage floor). The P&L has no
 *   comparison: that card carries no chip and says what its figure rests on.
 * - The one chart: sales over time against the comparison period (a select
 *   swaps in orders, average order or delivered sales).
 * - The one table: the same series bucket by bucket, with the day's net profit
 *   beside it when the series is daily and the P&L may be read.
 * - The one sentence: sales up or down, by how much, and the main driver
 *   (the rule is in sales/salesData.ts).
 * - «تفاصيل أكتر»: the profit in detail, how the total adds up, payment methods,
 *   channels, devices, when orders come in, and the two things only the old
 *   summary page showed — cash collected (with gross profit) and orders by status.
 *
 * Requests: the sales report is the tab's main one (refused → the tab's
 * no-permission state). The P&L and the insights are side requests: a 403 on
 * the P&L leaves every money-report part out; any other failure costs only its
 * own part, which says so and offers a retry.
 */
export default function SalesTab({ workspaceId, range }: ReportTabProps) {
  const questions = useT(REPORT_TAB_QUESTIONS);
  const t = useT(SALES_STRINGS);

  const salesQ = useTabData("sales", workspaceId, range, () =>
    reportsGetSales(apiClient, workspaceId, { from: range.from, to: range.to, compare: range.compare })
  );
  // The P&L and the insights take no comparison: their answers are remembered whatever the hub compares with.
  const plain = { from: range.from, to: range.to, fromDay: range.fromDay, toDay: range.toDay, compare: "none" as const };
  const profitQ = useTabData("sales:profit", workspaceId, plain, () => loadProfit(workspaceId, range.from, range.to));
  const insightsQ = useTabData("sales:insights", workspaceId, plain, () =>
    reportsGetInsights(apiClient, workspaceId, { from: range.from, to: range.to })
  );

  // After a failed request the hook may still hold the answer of the range before: an error means no data.
  const sales = salesQ.error ? null : salesQ.data;
  const profit: ProfitPart = {
    loading: profitQ.loading,
    error: profitQ.error,
    answer: profitQ.error ? null : profitQ.data,
    retry: profitQ.retry,
  };

  return (
    <ReportTab question={questions.sales} note={t.note}>
      <ReportTabState loading={salesQ.loading} error={salesQ.error} onRetry={salesQ.retry}>
        {sales && (
          <SalesBody
            workspaceId={workspaceId}
            range={range}
            sales={sales}
            profit={profit}
            // The sentence does not wait for the insights and does not fail with them.
            insights={insightsQ.error ? null : insightsQ.data}
          />
        )}
      </ReportTabState>
    </ReportTab>
  );
}

function SalesBody({
  workspaceId,
  range,
  sales,
  profit,
  insights,
}: {
  workspaceId: string;
  range: ReportRange;
  sales: ReportsSales;
  profit: ProfitPart;
  insights: ReportsInsights | null;
}) {
  const t = useT(SALES_STRINGS);
  const location = useLocation();
  const money = useSalesMoney(sales.currency);
  const [metric, setMetric] = useState<ChartMetric>("sales");

  // Refused: every part that reads a money report is left out. Any other failure: the part says so.
  const financeDenied = isPermissionError(profit.error);
  const reading = useMemo(() => (profit.answer ? readProfit(profit.answer) : null), [profit.answer]);

  /* ---- KPI strip ---- */
  const { kpis } = sales;
  const compared = sales.compare !== "none";
  const basis = sales.compare === "year" ? t.basisYear : t.basisPrevious;
  const deltaLabel = sales.compare === "year" ? t.vsYear : undefined;
  const delta = (key: "totalSales" | "orders" | "averageOrderValue" | "deliveredSales") =>
    compared ? deltaBasisPoints(kpis[key].value, kpis[key].previous) : null;
  const trend = (pick: (row: ReportsSeriesPoint) => number) => sales.series.map(pick);
  const trendBefore = (pick: (row: ReportsSeriesPoint) => number) => sales.previousSeries?.map(pick);
  // With no comparison picked, each card says what its figure is instead of «مفيش فترة قبلها».
  const plainHint = (text: string) => (compared ? undefined : text);
  const costsText = reading ? costsWarning(t, reading) : null;
  // The fifth card: left out for a role that may not read the P&L, and when the P&L failed (its line below has the retry).
  const profitCard = !financeDenied && !profit.error;

  /* ---- The chart ---- */
  const points = sales.series.map((row, index) => {
    const before = sales.previousSeries?.[index];
    return {
      label: formatBucket(row.bucket, sales.unit),
      value: row[metric],
      previous: before ? before[metric] : null,
      previousLabel: before ? formatBucket(before.bucket, sales.unit) : undefined,
    };
  });
  const chartFlat = points.every((point) => point.value === 0 && (point.previous ?? 0) === 0);
  const countMetric = metric === "orders";
  const metricName = t[METRIC_LABEL[metric]];
  const by = t[UNIT_BY[sales.unit]];
  const legend: ReportLegendItem[] = [{ label: t.thisPeriod }];
  if (sales.previousSeries) legend.push({ label: basis, swatch: "neutral", dashed: true });
  // Which two windows the lines are: said under the title only when there IS a second line.
  const chartNote =
    sales.previousSeries && sales.previousRange
      ? fmt(t.chartWindows, {
          current: formatWindow(range.from, range.to),
          previous: formatWindow(sales.previousRange.from, sales.previousRange.to),
        })
      : compared
        ? undefined
        : t.chartNoCompare;

  /* ---- The table ---- */
  // The P&L is per day: its net profit joins the series only when the series is daily too, and
  // only when it may be called profit (above the cost-coverage floor).
  const profitByDay = useMemo(() => {
    if (!profit.answer || !reading || reading.state !== "ok" || sales.unit !== "day") return null;
    const { version } = reading;
    const map = new Map<string, number>();
    for (const row of profit.answer.pnl.rows) map.set(row.key, row[version].netProfit);
    return map;
  }, [profit.answer, reading, sales.unit]);

  const rows = useMemo<BucketRow[]>(
    () =>
      sales.series.map((row) => ({
        bucket: row.bucket,
        at: Date.parse(`${row.bucket}:00Z`),
        orders: row.orders,
        sales: row.sales,
        deliveredSales: row.deliveredSales,
        averageOrderValue: row.averageOrderValue,
        sessions: row.sessions,
        conversionRate: row.conversionRate,
        profit: profitByDay?.get(row.bucket.slice(0, 10)) ?? null,
      })),
    [sales.series, profitByDay]
  );
  const showProfit = rows.some((row) => row.profit !== null);
  const unit = sales.unit;

  const columns = useMemo<ReportColumn<BucketRow>[]>(() => {
    const list: ReportColumn<BucketRow>[] = [
      {
        key: "bucket",
        header: t[UNIT_COLUMN[unit]],
        cell: (row) => formatBucket(row.bucket, unit),
        sortValue: (row) => row.at,
        csv: (row) => (unit === "hour" ? row.bucket.replace("T", " ") : row.bucket.slice(0, 10)),
      },
      {
        key: "orders",
        header: t.colOrders,
        align: "end",
        cell: (row) => formatCount(row.orders),
        sortValue: (row) => row.orders,
      },
      {
        key: "sales",
        header: t.colSales,
        hint: t.colSalesHint,
        align: "end",
        cell: (row) => money.money(row.sales),
        sortValue: (row) => row.sales,
        csv: (row) => money.major(row.sales),
      },
    ];
    if (showProfit) {
      list.push({
        key: "profit",
        header: t.colProfit,
        hint: t.colProfitHint,
        align: "end",
        cell: (row) =>
          row.profit === null ? (
            "—"
          ) : (
            <bdi dir="ltr" className={row.profit < 0 ? "font-medium text-danger" : "font-medium"}>
              {money.signed(row.profit)}
            </bdi>
          ),
        sortValue: (row) => row.profit,
        csv: (row) => (row.profit === null ? null : money.major(row.profit)),
      });
    }
    list.push(
      {
        key: "delivered",
        header: t.colDelivered,
        hint: t.colDeliveredHint,
        align: "end",
        cell: (row) => money.money(row.deliveredSales),
        sortValue: (row) => row.deliveredSales,
        csv: (row) => money.major(row.deliveredSales),
      },
      {
        key: "aov",
        header: t.colAov,
        align: "end",
        cell: (row) => money.money(row.averageOrderValue),
        sortValue: (row) => row.averageOrderValue,
        csv: (row) => money.major(row.averageOrderValue),
      },
      {
        key: "conversion",
        header: t.colConversion,
        hint: t.colConversionHint,
        align: "end",
        cell: (row) => formatConversion(row.conversionRate),
        sortValue: (row) => row.conversionRate,
      },
      {
        key: "visits",
        header: t.colVisits,
        align: "end",
        hideBelow: "md",
        cell: (row) => formatCount(row.sessions),
        sortValue: (row) => row.sessions,
      }
    );
    return list;
  }, [t, unit, money, showProfit]);

  const tableNote = showProfit
    ? `${t.tableNote} ${reading?.estimated ? t.tableNoteEstimate : t.tableNoteProfit}`
    : t.tableNote;

  /* ---- «تفاصيل أكتر» and the links ---- */
  const finance = !financeDenied;
  let profitSummary: ReactNode;
  if (reading) {
    const amount = <Num className="font-medium">{money.money(Math.abs(reading.statement.netProfit))}</Num>;
    profitSummary =
      reading.state === "none"
        ? t.sumProfitNone
        : reading.state === "floor"
          ? t.sumProfitFloor
          : fill(
              reading.loss
                ? reading.estimated
                  ? t.sumProfitLostEstimate
                  : t.sumProfitLost
                : reading.estimated
                  ? t.sumProfitKeptEstimate
                  : t.sumProfitKept,
              { amount }
            );
  }

  const links: ReportLinkItem[] = [];
  if (finance) {
    links.push(
      { to: "/profit", title: t.linkProfit, description: t.linkProfitDesc, icon: IconProfit },
      { to: "/profit/costs", title: t.linkCosts, description: t.linkCostsDesc, icon: IconSliders },
      { to: "/settlements", title: t.linkSettlements, description: t.linkSettlementsDesc, icon: IconSettlements },
      { to: "/ads", title: t.linkAds, description: t.linkAdsDesc, icon: IconAds },
      { to: storeReportPath("tax"), title: t.linkTax, description: t.linkTaxDesc, icon: IconReceipt }
    );
  }
  links.push({ to: storeReportPath("cart-offers"), title: t.linkCartOffers, description: t.linkCartOffersDesc, icon: IconGift });

  return (
    <>
      <ReportKpiStrip count={profitCard ? 5 : 4}>
        <KpiCard
          label={t.kpiSales}
          value={money.money(kpis.totalSales.value)}
          deltaBasisPoints={delta("totalSales")}
          deltaLabel={deltaLabel}
          hint={plainHint(t.kpiSalesHint)}
          trend={trend((row) => row.sales)}
          previousTrend={trendBefore((row) => row.sales)}
        />
        <KpiCard
          label={t.kpiOrders}
          value={formatCount(kpis.orders.value)}
          deltaBasisPoints={delta("orders")}
          deltaLabel={deltaLabel}
          hint={plainHint(t.kpiOrdersHint)}
          trend={trend((row) => row.orders)}
          previousTrend={trendBefore((row) => row.orders)}
          to="/orders"
        />
        <KpiCard
          label={t.kpiAov}
          value={money.money(kpis.averageOrderValue.value)}
          deltaBasisPoints={delta("averageOrderValue")}
          deltaLabel={deltaLabel}
          hint={plainHint(t.kpiAovHint)}
          trend={trend((row) => row.averageOrderValue)}
          previousTrend={trendBefore((row) => row.averageOrderValue)}
        />
        <KpiCard
          label={t.kpiDelivered}
          value={money.money(kpis.deliveredSales.value)}
          deltaBasisPoints={delta("deliveredSales")}
          deltaLabel={deltaLabel}
          hint={plainHint(t.kpiDeliveredHint)}
          trend={trend((row) => row.deliveredSales)}
          previousTrend={trendBefore((row) => row.deliveredSales)}
        />
        {profitCard && <ProfitKpi profit={profit} reading={reading} money={money} />}
      </ReportKpiStrip>

      {/* Product costs are incomplete: said under the figures, in the home's words, with the way to fix it. */}
      {costsText && <CostsNote text={costsText} />}
      {/* The P&L failed for a reason other than "not for this role": its own line, with a retry. */}
      {finance && Boolean(profit.error) && (
        <Card className="min-w-0 gap-0 p-4">
          <PartState loading={false} error={profit.error} onRetry={profit.retry} failed={t.profitFailed}>
            {null}
          </PartState>
        </Card>
      )}

      <ReportChartCard
        title={fmt(t.chartTitle, { metric: metricName, by })}
        note={chartNote}
        legend={
          <Select
            aria-label={t.metricLabel}
            value={metric}
            onChange={(event) => setMetric(event.target.value as ChartMetric)}
            className="h-11 w-auto min-w-36 font-medium"
          >
            {CHART_METRICS.map((key) => (
              <option key={key} value={key}>
                {t[METRIC_LABEL[key]]}
              </option>
            ))}
          </Select>
        }
        empty={chartFlat ? t.chartEmpty : null}
      >
        {(height) => (
          <div className="flex h-full flex-col">
            <ComparisonLineChart
              points={points}
              format={(value) => (countMetric ? countOf("order", Math.round(value)) : money.money(value))}
              formatAxis={(value) => (countMetric ? formatCount(Math.round(value)) : money.compact(value))}
              height={height - LEGEND_ROOM}
              summary={fmt(t.chartSummary, { metric: metricName })}
              currentLabel={t.thisPeriod}
              previousLabel={basis}
            />
            <div className="flex shrink-0 items-end overflow-hidden" style={{ height: LEGEND_ROOM }}>
              <ReportLegend items={legend} />
            </div>
          </div>
        )}
      </ReportChartCard>

      <ReportTable
        // A new series (another bucket) starts again from the newest row.
        key={unit}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.bucket}
        defaultSort={{ key: "bucket", dir: "desc" }}
        exportName="zimos-sales"
        range={range}
        caption={fmt(t.chartTitle, { metric: t.metricSales, by })}
        note={tableNote}
        empty={t.tableEmpty}
      />

      <SalesTakeaway sales={sales} insights={insights} money={money} search={location.search} />

      <ReportMore>
        {finance && (
          <AccordionSection title={t.secProfit} summary={profitSummary} icon={IconProfit} persistKey="reports:sales:profit" flush>
            <ProfitSection profit={profit} reading={reading} range={range} />
          </AccordionSection>
        )}
        <AccordionSection title={t.secBreakdown} summary={t.sumBreakdown} icon={IconChartPie} persistKey="reports:sales:breakdown">
          <SalesBreakdown sales={sales} />
        </AccordionSection>
        <AccordionSection title={t.secPayments} summary={t.sumPayments} icon={IconCard} persistKey="reports:sales:payments">
          <PaymentMethods sales={sales} />
        </AccordionSection>
        <AccordionSection title={t.secChannels} summary={t.sumChannels} icon={IconAttribution} persistKey="reports:sales:channels" flush>
          <ChannelsTable sales={sales} range={range} />
        </AccordionSection>
        <AccordionSection title={t.secDevices} summary={t.sumDevices} icon={IconDevices} persistKey="reports:sales:devices" flush>
          <DevicesTable sales={sales} range={range} />
        </AccordionSection>
        <AccordionSection
          title={t.secTimes}
          summary={busiestLine(t, sales) ?? t.sumTimes}
          icon={IconClock}
          persistKey="reports:sales:times"
        >
          <OrderTimes sales={sales} />
        </AccordionSection>
        <AccordionSection title={t.secCash} summary={t.sumCash} icon={IconCash} persistKey="reports:sales:cash">
          <CashSection workspaceId={workspaceId} range={range} sales={sales} finance={finance} />
        </AccordionSection>
        <AccordionSection title={t.secStatus} summary={t.sumStatus} icon={IconOrders} persistKey="reports:sales:status">
          <StatusSection workspaceId={workspaceId} range={range} sales={sales} />
        </AccordionSection>
      </ReportMore>

      <ReportLinks items={links} />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Net profit
 * ------------------------------------------------------------------ */

/**
 * The home's warning when product costs are incomplete, as one line. Under the
 * floor it opens with "we can't tell you your real profit"; above it, it says
 * the profit is incomplete and by how much. Null when costs are complete.
 */
function costsWarning(t: SalesStrings, reading: ProfitReading): string | null {
  if (reading.state === "none") return null;
  const items = countOf("item", reading.missing);
  const pct = reading.coverage === null ? "" : formatPercentValue(reading.coverage / 100, 0);
  if (reading.state === "floor") {
    const detail = reading.missing > 0 ? fmt(t.costsMissingShort, { items }) : fmt(t.costsCoverageShort, { pct });
    return `${t.noRealProfit} ${detail}`;
  }
  if (!reading.incomplete) return null;
  if (reading.coverage === null) return fmt(t.costsMaybe, { items });
  if (reading.missing > 0) return fmt(t.costsMissing, { items });
  return fmt(t.costsCoverage, { pct });
}

/**
 * The net-profit card, by the rules of the home's profit card: the projection
 * (named «تقديري») while orders are still on the way, the actual statement
 * otherwise; "left before product cost" — never "profit" — under the
 * cost-coverage floor. The P&L has no comparison window, so there is no change
 * chip: the line under the figure says what it rests on. The card opens the
 * profit report (or the costs page, when costs are what is missing).
 */
function ProfitKpi({ profit, reading, money }: { profit: ProfitPart; reading: ProfitReading | null; money: SalesMoney }) {
  const t = useT(SALES_STRINGS);
  if (profit.loading) return <KpiCard label={t.kpiProfit} value={null} loading trend={[]} />;
  if (!profit.answer || !reading) return <KpiCard label={t.kpiProfit} value="—" hint={t.profitFailed} />;

  const { pnl } = profit.answer;
  const { statement, estimated, version } = reading;
  if (reading.state === "none") return <KpiCard label={t.kpiProfit} value="—" hint={t.profitNone} to="/profit" />;
  if (reading.state === "floor") {
    return (
      <KpiCard
        label={t.kpiBeforeCost}
        value={money.signed(statement.netProfit + statement.costOfGoods)}
        hint={estimated ? t.beforeCostOpenHint : t.beforeCostHint}
        to="/profit/costs"
      />
    );
  }

  let hint: string;
  if (estimated) {
    // No delivery history: the API projects as if every open order arrives. Say that, not "your rate".
    hint =
      pnl.projectionDeliveryRate === null
        ? t.profitOpenNoRate
        : fmt(t.profitOpenRate, { rate: formatPercentValue(pnl.projectionDeliveryRate / 100, 0) });
  } else if (reading.loss) {
    hint = t.profitLossWhy;
  } else if (statement.margin !== null) {
    const share = outOf(statement.margin);
    hint = fmt(t.profitMargin, { n: share.n, of: share.of });
  } else {
    hint = t.profitPlain;
  }

  const figure = money.signed(statement.netProfit);
  return (
    <KpiCard
      label={estimated ? t.kpiProfitEstimate : t.kpiProfit}
      value={reading.loss ? <span className="text-danger">{figure}</span> : figure}
      hint={hint}
      // The same days as the trends beside it, from the P&L's own rows.
      trend={pnl.rows.map((row) => row[version].netProfit)}
      to="/profit"
    />
  );
}

/** The body of «الربح بالتفصيل»: its own loading and failure, then the old profit page's parts. */
function ProfitSection({
  profit,
  reading,
  range,
}: {
  profit: ProfitPart;
  reading: ProfitReading | null;
  range: { fromDay: string; toDay: string };
}) {
  const t = useT(SALES_STRINGS);
  if (!profit.answer || !reading) {
    return (
      <PartState
        loading={profit.loading}
        error={profit.error}
        onRetry={profit.retry}
        failed={t.profitFailed}
        className="px-4 pt-3 pb-4"
      >
        {null}
      </PartState>
    );
  }
  if (reading.state === "none") return <p className="px-4 pt-3 pb-4 text-sm leading-6 text-ink-soft">{t.answerNone}</p>;
  return <ProfitDetails answer={profit.answer} reading={reading} range={range} />;
}

/* ------------------------------------------------------------------ *
 * The one sentence
 * ------------------------------------------------------------------ */

/**
 * What the numbers mean and what to do — the verdict of `readSales`
 * (sales/salesData.ts holds the rule and its thresholds) put into words, with
 * the amounts of the period in their own direction. A fall names where to look.
 */
function SalesTakeaway({
  sales,
  insights,
  money,
  search,
}: {
  sales: ReportsSales;
  insights: ReportsInsights | null;
  money: SalesMoney;
  /** The hub's query string, so a link to another tab keeps the range. */
  search: string;
}) {
  const t = useT(SALES_STRINGS);
  const verdict = readSales(sales, insights);
  const { kpis } = sales;
  const basis = sales.compare === "year" ? t.basisYear : t.basisPrevious;
  const total = <Num>{money.money(kpis.totalSales.value)}</Num>;
  const previous = <Num>{money.money(kpis.totalSales.previous)}</Num>;
  const peak = peakTime(insights);
  const peakLine = peak ? <> {fmt(t.peak, { day: weekdayName(peak.dow), hour: hourName(peak.hour) })}</> : null;

  let tone: ReportTone = "info";
  let sentence: ReactNode;
  let action: ReportTakeawayAction | undefined;

  switch (verdict.kind) {
    case "empty":
      sentence = t.sayEmpty;
      break;
    case "thin":
      sentence = fmt(t.sayThin, { orders: countOf("order", verdict.orders), min: countOf("order", MIN_ORDERS) });
      break;
    case "alone":
      sentence = (
        <>
          {fill(verdict.reason === "off" ? t.sayAloneOff : t.sayAloneNoBase, {
            sales: total,
            orders: countOf("order", kpis.orders.value ?? 0),
            basis,
          })}
          {peakLine}
        </>
      );
      break;
    case "flat":
      sentence = (
        <>
          {fill(t.sayFlat, { sales: total, previous, basis })}
          {peakLine}
        </>
      );
      break;
    case "moved": {
      const up = verdict.direction === "up";
      tone = up ? "good" : "bad";
      const pct = <Num>{formatPercentValue(Math.abs(verdict.change) / 100, 0)}</Num>;
      const driverPct =
        verdict.driverChange === null ? null : <Num>{formatPercentValue(verdict.driverChange / 100, 0)}</Num>;
      let why: ReactNode = null;
      if (verdict.driver === "orders") {
        why = fill(up ? t.upOrders : t.downOrders, { pct: driverPct });
      } else if (verdict.driver === "visits") {
        why = fill(up ? t.upVisits : t.downVisits, { pct: driverPct });
        if (!up) action = { label: t.openAds, to: `${REPORT_TAB_PATHS.ads}${search}` };
      } else if (verdict.driver === "conversion") {
        const share = outOf(kpis.conversionRate.value ?? 0);
        why = fill(up ? t.upConversion : t.downConversion, {
          n: fmt("{n}", { n: share.n }),
          of: fmt("{n}", { n: share.of }),
        });
        if (!up) action = { label: t.openStore, to: `${REPORT_TAB_PATHS.store}${search}` };
      } else if (verdict.driver === "basket") {
        why = fill(up ? t.upBasket : t.downBasket, {
          aov: <Num>{money.money(kpis.averageOrderValue.value)}</Num>,
          before: <Num>{money.money(kpis.averageOrderValue.previous)}</Num>,
        });
        if (!up) action = { label: t.openOffers, to: "/offers" };
      }
      sentence = (
        <>
          {fill(up ? t.sayUp : t.sayDown, { pct, basis, sales: total, previous })}
          {why && <> {why}</>}
        </>
      );
      break;
    }
  }

  return (
    <ReportTakeaway tone={tone} action={action}>
      {sentence}
    </ReportTakeaway>
  );
}

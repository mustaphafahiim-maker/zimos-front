import { useMemo, useState } from "react";
import {
  reportsExportCsv,
  reportsGetProducts,
  type ReportsChannelRow,
  type ReportsDeviceRow,
  type ReportsFunnelStep,
  type ReportsFunnelStepKey,
  type ReportsLandingRow,
  type ReportsSales,
  type StoreReportHeatmapCell,
  type WebAnalyticsFilters,
  type WebAnalyticsMetricRow,
  type WebAnalyticsStats,
  type WebAnalyticsUnit,
} from "@store-builder/api-client";
import { ComparisonLineChart, StackedBarsChart } from "@/components/charts";
import { IconClock } from "@/components/icons";
import { ReportLegend, ReportTable, useTabData, type ReportColumn } from "@/components/report";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { fmt, getIntlLocale, useLocale, useT } from "@/i18n/LocaleContext";
import { deltaBasisPoints, formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { formatMinorMoney } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { useReportMoney } from "@/lib/reportCurrency";
import { formatBucket } from "@/lib/reportRange";
import { OrderHeatmap } from "@/pages/analytics/storeReports/OrderHeatmap";
import { formatConversion } from "@/components/report/rates";
import { useStoreLabels, ValueText } from "./labels";
import {
  changePercent,
  csvRate,
  filtersKey,
  formatChange,
  formatRate,
  isWebUnit,
  majorAmount,
  ROW_LIMIT,
  safeDecode,
  saveBlob,
  unitsFor,
  webCompare,
  webParams,
  type StoreRange,
} from "./model";
import { DeltaText, MiniStat, Num, SectionState } from "./parts";
import { STORE_STRINGS } from "./strings";

/**
 * The bodies of the tab's «تفاصيل أكتر» sections: everything else the old
 * screens showed about the store's visitors. Each is rendered inside an
 * `AccordionSection`, which mounts its body only once opened — so a body that
 * asks for data of its own (`useTabData`) asks when the merchant opens it.
 * The sections are `flush`: tables run edge to edge and the rest pads itself.
 */

/** Under a web-analytics filter, says which numbers of the section it narrows. */
function FilterNote({ text }: { text: string | null }) {
  const t = useT(STORE_STRINGS);
  if (!text) return null;
  return <p className="text-[13px] leading-5 text-pretty text-ink-soft">{fmt(t.filtersApply, { filters: text })}</p>;
}

/** Amounts in the currency picked in the hub's header: as words for the screen, as a plain number for a CSV. */
function useMoney(currency: string) {
  const inReport = useReportMoney();
  return useMemo(
    () => ({
      text: (minor: number) => formatMinorMoney(...inReport(minor, currency)),
      amount: (minor: number) => {
        const [value, code] = inReport(minor, currency);
        return majorAmount(value, code);
      },
    }),
    [inReport, currency]
  );
}

// ------------------------------------------------- the funnel, in numbers --

const STEP_ORDER: readonly ReportsFunnelStepKey[] = ["sessions", "product", "cart", "checkout", "purchase"];

/**
 * The purchase path as a table: every step with how many reached it, its share
 * of everyone who entered and of the step before, and — when a comparison was
 * asked for — the same step in the period before with the change. From the
 * tab's own request; nothing more is asked for.
 */
export function FunnelNumbers({
  sales,
  range,
  stepLabels,
}: {
  sales: ReportsSales;
  range: StoreRange;
  stepLabels: Record<ReportsFunnelStepKey, string>;
}) {
  const t = useT(STORE_STRINGS);
  // A column for the period before only when the API answered with one.
  const compared = range.compare !== "none" && sales.funnel.some((step) => step.previous !== null);

  const columns: ReportColumn<ReportsFunnelStep>[] = [
    {
      key: "step",
      header: t.colStep,
      cell: (row) => stepLabels[row.step],
      // In the order of the path, not of the alphabet.
      sortValue: (row) => STEP_ORDER.indexOf(row.step),
      csv: (row) => stepLabels[row.step],
    },
    {
      key: "reached",
      header: t.colReached,
      align: "end",
      cell: (row) => formatCount(row.sessions),
      sortValue: (row) => row.sessions,
      csv: (row) => row.sessions,
    },
    {
      key: "ofAll",
      header: t.colOfAll,
      align: "end",
      cell: (row) => formatRate(row.rateOfSessions),
      sortValue: (row) => row.rateOfSessions,
      csv: (row) => csvRate(row.rateOfSessions),
    },
    {
      key: "ofPrevious",
      header: t.colOfPrevious,
      align: "end",
      cell: (row) => formatRate(row.rateOfPrevious),
      sortValue: (row) => row.rateOfPrevious,
      csv: (row) => csvRate(row.rateOfPrevious),
    },
  ];
  if (compared) {
    columns.push(
      {
        key: "before",
        header: range.compare === "year" ? t.colBeforeYear : t.colBeforePrevious,
        align: "end",
        cell: (row) => formatCount(row.previous),
        sortValue: (row) => row.previous,
        csv: (row) => row.previous,
      },
      {
        key: "change",
        header: t.colChange,
        align: "end",
        cell: (row) => formatChange(changePercent(row.sessions, row.previous)),
        sortValue: (row) => changePercent(row.sessions, row.previous),
        csv: (row) => csvRate(changePercent(row.sessions, row.previous)),
      }
    );
  }

  return (
    <ReportTable<ReportsFunnelStep>
      embedded
      columns={columns}
      rows={sales.funnel}
      rowKey={(row) => row.step}
      exportName="zimos-store-funnel"
      range={range}
      caption={t.moreFunnel}
      note={t.funnelTableNote}
      empty={t.noRows}
    />
  );
}

// ------------------------------------------------------------ over time --

type TimeMetric = "traffic" | "entered" | "conversion";

/** A bucket's start on the axis: the hour inside a day, the day (with its hour when hours run over several days), the month. */
function bucketLabel(iso: string, unit: WebAnalyticsUnit, spanMs: number, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = 86_400_000;
  let options: Intl.DateTimeFormatOptions;
  if (unit === "minute") options = { hour: "numeric", minute: "2-digit" };
  else if (unit === "hour") options = spanMs > day * 1.5 ? { day: "numeric", month: "short", hour: "numeric" } : { hour: "numeric" };
  else if (unit === "month") options = { month: "short", year: "2-digit" };
  // Past eleven months a day and its month come round again: the year tells them apart.
  else options = spanMs > day * 330 ? { day: "numeric", month: "short", year: "2-digit" } : { day: "numeric", month: "short" };
  return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * Page views and visitors through the period (the old web-analytics chart),
 * with the comparison period dashed when one was asked for, the unit of time
 * as a choice, and the totals the bars add up to. It follows the table's
 * filters.
 */
function TrafficOverTime({
  workspaceId,
  range,
  filters,
  filterText,
  stats,
}: {
  workspaceId: string;
  range: StoreRange;
  filters: WebAnalyticsFilters;
  filterText: string | null;
  stats: WebAnalyticsStats | null;
}) {
  const t = useT(STORE_STRINGS);
  const { intlLocale } = useLocale();
  const allowed = unitsFor(range);
  const [picked, setPicked] = useState<WebAnalyticsUnit | null>(() => {
    // The old web-analytics screen kept its unit in the address (`?unit=hour`): a link made there still opens on it.
    const fromAddress = new URLSearchParams(window.location.search).get("unit");
    return isWebUnit(fromAddress) ? fromAddress : null;
  });
  // Left to the server unless picked — and a unit that would draw thousands of bars for this range is not sent.
  const unit = picked && allowed.includes(picked) ? picked : undefined;
  const compare = webCompare(range.compare);

  const series = useTabData(
    "store:series",
    workspaceId,
    range,
    () => apiClient.getWebAnalyticsSeries(workspaceId, { ...webParams(range, filters), compare, unit }),
    `${unit ?? "auto"}|${filtersKey(filters)}`
  );

  const unitLabel: Record<WebAnalyticsUnit, string> = {
    minute: t.unit_minute,
    hour: t.unit_hour,
    day: t.unit_day,
    month: t.unit_month,
  };
  const data = series.data;
  const shownUnit = data?.unit ?? unit ?? "day";
  const spanMs = Date.parse(range.to) - Date.parse(range.from);
  const points = (data?.series ?? []).map((point, index) => ({
    label: bucketLabel(point.t, shownUnit, spanMs, intlLocale),
    primary: point.pageviews,
    secondary: point.visitors,
    comparisonPrimary: data?.comparison?.[index]?.pageviews ?? null,
    comparisonSecondary: data?.comparison?.[index]?.visitors ?? null,
  }));
  const compared = Boolean(data?.comparison);
  const before = stats?.comparison;
  // Nothing to draw: the chart keeps its room and says so, in place of describing bars that are not there.
  const flat = points.every((point) => point.primary === 0 && (point.comparisonPrimary ?? 0) === 0);
  const summary = flat ? t.timeEmpty : compared ? t.trafficSummaryCompared : t.trafficSummary;

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {stats ? (
          <dl className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px] leading-5">
            <MiniStat label={t.visitors}>
              <Num>{formatCount(stats.visitors)}</Num>
              <DeltaText basisPoints={deltaBasisPoints(stats.visitors, before?.visitors)} />
            </MiniStat>
            <MiniStat label={t.visits}>
              <Num>{formatCount(stats.visits)}</Num>
              <DeltaText basisPoints={deltaBasisPoints(stats.visits, before?.visits)} />
            </MiniStat>
            <MiniStat label={t.views}>
              <Num>{formatCount(stats.pageviews)}</Num>
              <DeltaText basisPoints={deltaBasisPoints(stats.pageviews, before?.pageviews)} />
            </MiniStat>
          </dl>
        ) : (
          <span />
        )}
        <Select
          aria-label={t.unitLabel}
          value={unit ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            setPicked(isWebUnit(value) ? value : null);
          }}
          className="h-10 w-auto min-w-0 font-medium pointer-coarse:h-11"
        >
          <option value="">{data && !unit ? fmt(t.unitAutoIs, { unit: unitLabel[data.unit] }) : t.unitAuto}</option>
          {allowed.map((option) => (
            <option key={option} value={option}>
              {unitLabel[option]}
            </option>
          ))}
        </Select>
      </div>

      <FilterNote text={filterText} />

      <SectionState bare loading={series.loading} error={series.error} onRetry={series.retry} lines={6}>
        <StackedBarsChart
          points={points}
          height={240}
          summary={summary}
          primaryLabel={t.views}
          secondaryLabel={t.visitors}
          comparisonLabel={compared ? (range.compare === "year" ? t.cmpYear : t.cmpPrevious) : undefined}
          format={(value) => formatCount(value)}
        />
        {!flat && <p className="text-xs leading-5 text-pretty text-ink-soft">{summary}</p>}
      </SectionState>
    </>
  );
}

/**
 * Entries to the store, or the conversion rate, through the period against the
 * comparison period — the two lines the old reports screen drew, from the
 * tab's own request (the sales report's series).
 */
function SalesOverTime({
  sales,
  range,
  metric,
  filtered,
}: {
  sales: ReportsSales;
  range: StoreRange;
  metric: "entered" | "conversion";
  filtered: boolean;
}) {
  const t = useT(STORE_STRINGS);
  const compareLabel = range.compare === "year" ? t.cmpYear : t.cmpPrevious;
  const compared = Boolean(sales.previousSeries);
  const valueOf = (row: ReportsSales["series"][number]) => (metric === "entered" ? row.sessions : (row.conversionRate ?? 0));
  const points = sales.series.map((row, index) => {
    const before = sales.previousSeries?.[index];
    return {
      label: formatBucket(row.bucket, sales.unit),
      value: valueOf(row),
      previous: before ? valueOf(before) : null,
      previousLabel: before ? formatBucket(before.bucket, sales.unit) : undefined,
    };
  });
  return (
    <>
      <div className="flex min-h-10 items-center">
        <ReportLegend
          items={compared ? [{ label: t.thisPeriod }, { label: compareLabel, swatch: "neutral", dashed: true }] : [{ label: t.thisPeriod }]}
        />
      </div>
      <ComparisonLineChart
        points={points}
        format={(value) => (metric === "entered" ? formatCount(value) : formatRate(value))}
        formatAxis={(value) => (metric === "entered" ? formatCount(Math.round(value)) : formatRate(value))}
        height={240}
        summary={metric === "entered" ? t.enteredSummary : t.conversionSummary}
        currentLabel={t.thisPeriod}
        previousLabel={compareLabel}
      />
      {filtered && <p className="text-xs leading-5 text-pretty text-ink-soft">{t.salesUnfiltered}</p>}
    </>
  );
}

/**
 * «الزيارات على مدار الوقت»: the views-and-visitors chart of the old
 * web-analytics screen (its unit of time and its comparison with it), and the
 * entries to the store and the conversion rate over time that the old reports
 * screen drew.
 */
export function TimeBody({
  workspaceId,
  range,
  filters,
  filterText,
  sales,
  stats,
}: {
  workspaceId: string;
  range: StoreRange;
  filters: WebAnalyticsFilters;
  /** The active filters in words, or null when nothing is filtered. */
  filterText: string | null;
  sales: ReportsSales;
  /** The totals the chart adds up to: the filtered ones under a filter, the whole period's otherwise. */
  stats: WebAnalyticsStats | null;
}) {
  const t = useT(STORE_STRINGS);
  const [metric, setMetric] = useState<TimeMetric>("traffic");
  return (
    <div className="flex min-w-0 flex-col gap-3 px-4 py-4">
      <Segmented
        value={metric}
        onChange={setMetric}
        options={[
          { value: "traffic", label: t.metric_traffic },
          { value: "entered", label: t.metric_entered },
          { value: "conversion", label: t.metric_conversion },
        ]}
        label={t.metricLabel}
        size="sm"
        // On a phone the three segments take the whole row, with less padding so no name is cut.
        className="self-start max-sm:w-full max-sm:[&_[role=radio]]:px-2"
      />
      {metric === "traffic" ? (
        <TrafficOverTime workspaceId={workspaceId} range={range} filters={filters} filterText={filterText} stats={stats} />
      ) : (
        <SalesOverTime sales={sales} range={range} metric={metric} filtered={filterText !== null} />
      )}
    </div>
  );
}

// ------------------------------------------------------ the week's hours --

/**
 * Visitors by weekday and hour (the old screen's «الزيارات الأسبوعية»), on the
 * dashboard's own heatmap — Saturday first, reachable from the keyboard, each
 * square spelled out under the grid. It follows the table's filters.
 */
export function WeeklyBody({
  workspaceId,
  range,
  filters,
  filterText,
}: {
  workspaceId: string;
  range: StoreRange;
  filters: WebAnalyticsFilters;
  filterText: string | null;
}) {
  const t = useT(STORE_STRINGS);
  const weekly = useTabData(
    "store:weekly",
    workspaceId,
    range,
    () => apiClient.getWebAnalyticsWeekly(workspaceId, webParams(range, filters)),
    filtersKey(filters)
  );

  const dayNames = t.days.split(",");
  // «٩ م», "9 PM": the hour alone, in the dashboard's language.
  const hourFormat = new Intl.DateTimeFormat(getIntlLocale(), { hour: "numeric" });
  const hourLabel = (hour: number) => hourFormat.format(new Date(2000, 0, 1, hour));

  const rows = weekly.data?.rows ?? [];
  let busiest: { dow: number; hour: number; visitors: number } | null = null;
  for (const row of rows) {
    if (row.visitors > (busiest?.visitors ?? 0)) busiest = row;
  }
  // The heatmap is the order-times one: its "orders" field carries the visitors of the hour here.
  const cells: StoreReportHeatmapCell[] = rows.map((row) => ({
    weekday: row.dow,
    hour: row.hour,
    orders: row.visitors,
    revenue: "0",
    confirmationRate: null,
  }));
  const describe = (cell: StoreReportHeatmapCell) =>
    `${dayNames[cell.weekday] ?? ""} ${hourLabel(cell.hour)} · ${pluralOf(t, "visitorsCount", cell.orders)}`;

  return (
    <SectionState loading={weekly.loading} error={weekly.error} onRetry={weekly.retry} lines={6}>
      <div className="flex min-w-0 flex-col gap-3 px-4 py-4">
        <FilterNote text={filterText} />
        {busiest ? (
          <>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink">
              <IconClock className="size-4 shrink-0 text-ink-soft" aria-hidden />
              <span>{fmt(t.weeklyBusiest, { day: dayNames[busiest.dow] ?? "", hour: hourLabel(busiest.hour) })}</span>
              <span className="font-normal text-ink-soft">{pluralOf(t, "visitorsCount", busiest.visitors)}</span>
            </p>
            <OrderHeatmap
              // A new window (or filter) has a new busiest hour: the grid starts over from it.
              key={`${busiest.dow}:${busiest.hour}`}
              start={{ weekday: busiest.dow, hour: busiest.hour }}
              cells={cells}
              valueOf={(cell) => cell.orders}
              dayNames={dayNames}
              hourLabel={hourLabel}
              describe={describe}
              summary={t.weeklySummary}
              hint={t.weeklyHint}
              lessLabel={t.less}
              moreLabel={t.more}
            />
          </>
        ) : (
          <p className="text-sm leading-6 text-ink-soft">{t.weeklyEmpty}</p>
        )}
      </div>
    </SectionState>
  );
}

// ------------------------------------------------- who buys: by device --

/** Entries to the store by kind of device, with what they ordered — the sales report's device rows, whole. */
export function DevicesBody({ sales, range }: { sales: ReportsSales; range: StoreRange }) {
  const t = useT(STORE_STRINGS);
  const labels = useStoreLabels();
  const money = useMoney(sales.currency);

  const columns: ReportColumn<ReportsDeviceRow>[] = [
    {
      key: "device",
      header: t.colDevice,
      cell: (row) => labels.device(row.device),
      sortValue: (row) => labels.device(row.device),
      csv: (row) => labels.device(row.device),
    },
    {
      key: "entered",
      header: t.colEntered,
      align: "end",
      cell: (row) => formatCount(row.sessions),
      sortValue: (row) => row.sessions,
      csv: (row) => row.sessions,
    },
    {
      key: "orders",
      header: t.colOrders,
      align: "end",
      cell: (row) => formatCount(row.orders),
      sortValue: (row) => row.orders,
      csv: (row) => row.orders,
    },
    {
      key: "conversion",
      header: t.colConversion,
      align: "end",
      cell: (row) => formatConversion(row.conversionRate),
      sortValue: (row) => row.conversionRate,
      csv: (row) => csvRate(row.conversionRate),
    },
    {
      key: "sales",
      header: t.colSales,
      align: "end",
      cell: (row) => money.text(row.sales),
      sortValue: (row) => row.sales,
      csv: (row) => money.amount(row.sales),
    },
  ];

  return (
    <ReportTable<ReportsDeviceRow>
      embedded
      columns={columns}
      rows={sales.devices}
      rowKey={(row) => row.device}
      defaultSort={{ key: "entered", dir: "desc" }}
      exportName="zimos-store-devices"
      range={range}
      caption={t.moreDevices}
      note={t.devicesNote}
      empty={t.noRows}
    />
  );
}

// ------------------------------------------------- who buys: by source --

/** Entries to the store by where they came from (source and medium), with what they ordered. */
export function ChannelsBody({ sales, range }: { sales: ReportsSales; range: StoreRange }) {
  const t = useT(STORE_STRINGS);
  const money = useMoney(sales.currency);
  const sourceName = (row: ReportsChannelRow) => (row.source === "direct" || row.source === "" ? t.channel_direct : row.source);
  const sourceText = (row: ReportsChannelRow) => (row.medium ? `${sourceName(row)} / ${row.medium}` : sourceName(row));

  const columns: ReportColumn<ReportsChannelRow>[] = [
    {
      key: "source",
      header: t.colSource,
      cell: (row) => (
        <>
          <bdi dir="auto">{sourceName(row)}</bdi>
          {row.medium && (
            <bdi dir="ltr" className="ms-1.5 text-xs font-normal text-ink-soft">
              {row.medium}
            </bdi>
          )}
        </>
      ),
      sortValue: sourceText,
      csv: sourceText,
    },
    {
      key: "entered",
      header: t.colEntered,
      align: "end",
      cell: (row) => formatCount(row.sessions),
      sortValue: (row) => row.sessions,
      csv: (row) => row.sessions,
    },
    {
      key: "orders",
      header: t.colOrders,
      align: "end",
      cell: (row) => formatCount(row.orders),
      sortValue: (row) => row.orders,
      csv: (row) => row.orders,
    },
    {
      key: "conversion",
      header: t.colConversion,
      align: "end",
      cell: (row) => formatConversion(row.conversionRate),
      sortValue: (row) => row.conversionRate,
      csv: (row) => csvRate(row.conversionRate),
    },
    {
      key: "sales",
      header: t.colSales,
      align: "end",
      cell: (row) => money.text(row.sales),
      sortValue: (row) => row.sales,
      csv: (row) => money.amount(row.sales),
    },
  ];

  return (
    <ReportTable<ReportsChannelRow>
      embedded
      columns={columns}
      rows={sales.channels}
      rowKey={(row) => `${row.source}/${row.medium ?? ""}`}
      defaultSort={{ key: "entered", dir: "desc" }}
      exportName="zimos-store-sources"
      range={range}
      caption={t.moreChannels}
      note={t.channelsNote}
      empty={t.noRows}
    />
  );
}

// -------------------------------------------------------- landing pages --

/** How many landing pages are asked for: the API's ceiling, and what its own CSV export holds. */
const LANDING_LIMIT = 200;

/**
 * The first page of each visit and what those visits went on to buy (the old
 * reports screen's «صفحات الهبوط»). Asked for when the section is opened; the
 * CSV is the server's own `landing_pages` export, as before.
 */
export function LandingBody({ workspaceId, range }: { workspaceId: string; range: StoreRange }) {
  const t = useT(STORE_STRINGS);
  const report = useTabData("store:landing", workspaceId, range, () =>
    reportsGetProducts(apiClient, workspaceId, { from: range.from, to: range.to, limit: LANDING_LIMIT })
  );
  const money = useMoney(report.data?.currency ?? "EGP");

  const columns: ReportColumn<ReportsLandingRow>[] = [
    {
      key: "page",
      header: t.colPage,
      cell: (row) => <bdi dir="ltr">{safeDecode(row.path)}</bdi>,
      sortValue: (row) => safeDecode(row.path),
      csv: (row) => safeDecode(row.path),
    },
    {
      key: "entered",
      header: t.colEnteredHere,
      align: "end",
      cell: (row) => formatCount(row.sessions),
      sortValue: (row) => row.sessions,
      csv: (row) => row.sessions,
    },
    {
      key: "orders",
      header: t.colOrders,
      align: "end",
      cell: (row) => formatCount(row.orders),
      sortValue: (row) => row.orders,
      csv: (row) => row.orders,
    },
    {
      key: "conversion",
      header: t.colConversion,
      align: "end",
      cell: (row) => formatConversion(row.conversionRate),
      sortValue: (row) => row.conversionRate,
      csv: (row) => csvRate(row.conversionRate),
    },
    {
      key: "sales",
      header: t.colSales,
      align: "end",
      cell: (row) => money.text(row.sales),
      sortValue: (row) => row.sales,
      csv: (row) => money.amount(row.sales),
    },
  ];

  async function exportLanding() {
    const blob = await reportsExportCsv(apiClient, workspaceId, "landing_pages", { from: range.from, to: range.to });
    saveBlob(blob, `zimos-landing_pages-${range.fromDay}-${range.toDay}.csv`);
  }

  return (
    <SectionState loading={report.loading} error={report.error} onRetry={report.retry}>
      {report.data && (
        <ReportTable<ReportsLandingRow>
          embedded
          columns={columns}
          rows={report.data.landingPages}
          rowKey={(row) => row.path}
          defaultSort={{ key: "entered", dir: "desc" }}
          exportName="zimos-landing_pages"
          range={range}
          caption={t.moreLanding}
          note={fmt(t.landingNote, { n: LANDING_LIMIT })}
          empty={t.noRows}
          onExport={exportLanding}
        />
      )}
    </SectionState>
  );
}

// --------------------------------------------------------------- events --

/** The events the store recorded and how many times each happened (the old screen's «الأحداث» panel). It follows the table's filters. */
export function EventsBody({
  workspaceId,
  range,
  filters,
  filterText,
}: {
  workspaceId: string;
  range: StoreRange;
  filters: WebAnalyticsFilters;
  filterText: string | null;
}) {
  const t = useT(STORE_STRINGS);
  const events = useTabData(
    "store:events",
    workspaceId,
    range,
    () => apiClient.getWebAnalyticsMetrics(workspaceId, "event", { ...webParams(range, filters), limit: ROW_LIMIT }),
    filtersKey(filters)
  );

  const columns: ReportColumn<WebAnalyticsMetricRow>[] = [
    {
      key: "event",
      header: t.colEvent,
      cell: (row) => <ValueText value={{ text: row.x || t.unknownValue, dir: "auto" }} />,
      sortValue: (row) => row.x,
      csv: (row) => row.x,
    },
    {
      key: "times",
      header: t.colTimes,
      align: "end",
      cell: (row) => formatCount(row.y),
      sortValue: (row) => row.y,
      csv: (row) => row.y,
    },
  ];

  return (
    <SectionState loading={events.loading} error={events.error} onRetry={events.retry}>
      {filterText && (
        <div className="px-4 pt-3">
          <FilterNote text={filterText} />
        </div>
      )}
      <ReportTable<WebAnalyticsMetricRow>
        embedded
        columns={columns}
        rows={events.data?.rows ?? []}
        rowKey={(row) => row.x}
        defaultSort={{ key: "times", dir: "desc" }}
        exportName="zimos-store-events"
        range={range}
        caption={t.moreEvents}
        note={t.eventsNote}
        empty={t.noRows}
      />
    </SectionState>
  );
}

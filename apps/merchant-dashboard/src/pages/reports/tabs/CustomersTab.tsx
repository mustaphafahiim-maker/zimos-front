import { reportsGetCustomers, reportsGetSales, type ReportsCustomers, type ReportsKpi } from "@store-builder/api-client";
import { AccordionSection } from "@/components/Accordion";
import {
  IconCalendar,
  IconChartPie,
  IconClipboard,
  IconCrown,
  IconCustomers,
  IconLoyalty,
  IconRepeat,
} from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import {
  ReportChartCard,
  ReportKpiStrip,
  ReportLegend,
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
} from "@/components/report";
import { fmt, useT } from "@/i18n/LocaleContext";
import { deltaBasisPoints, formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { formatMinorMoney } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { useReportMoney } from "@/lib/reportCurrency";
import type { ReportRange } from "@/lib/reportRange";
import { SURVEY_RESULTS_PATH } from "@/pages/survey/surveyStrings";
import { REPORT_TAB_QUESTIONS } from "../reportTabs";
import { CohortTable } from "./customers/CohortTable";
import { formatRate, majorUnits } from "./customers/helpers";
import { LifetimeNumbers } from "./customers/LifetimeNumbers";
import { NewVsReturningChart, type SplitRow } from "./customers/NewVsReturningChart";
import { CUSTOMERS_TAB_STRINGS } from "./customers/strings";
import { customersTakeaway } from "./customers/takeaway";

type TopRow = ReportsCustomers["topCustomers"][number];

/**
 * The period before, for the change chips. The customers report has no comparison of its own;
 * the sales report counts the same three figures the same way (a customer is new when their
 * first order ever falls inside the window) and carries each one's `previous`.
 */
interface Comparison {
  newCustomers: ReportsKpi;
  returningCustomers: ReportsKpi;
  returningCustomerRate: ReportsKpi;
}

/**
 * «العملاء — مين بيشتري تاني؟»: the customers tab of the reports hub.
 *
 * - MAIN request: `reportsGetCustomers` (analytics.view) — new / returning customers, orders and
 *   sales of the hub's range, the lifetime numbers, the top customers, the monthly cohorts. A 403
 *   is the tab's no-permission state; any other failure its error with retry. A background refresh
 *   that fails leaves the numbers already on screen alone.
 * - SIDE request: `reportsGetSales` with the hub's `compare`, only for the `previous` of the three
 *   customer figures (see `Comparison`). Not asked for when the hub compares with nothing. A 403
 *   leaves the chips out; another failure says so under the cards, with retry — the tab stays.
 *
 * What is measured over what: the cards, the chart and the table are the hub's range. «متوسط
 * قيمة العميل», the lifetime list and the cohort grid are the store's whole life (the API does not
 * bound them by the range) and each says so in words. Nothing here has a trend line: the API has
 * no customers-per-day series (docs/ux/needs-backend.md).
 */
export default function CustomersTab({ workspaceId, range }: ReportTabProps) {
  const questions = useT(REPORT_TAB_QUESTIONS);

  const report = useTabData("customers", workspaceId, range, () =>
    reportsGetCustomers(apiClient, workspaceId, { from: range.from, to: range.to })
  );

  const compare = range.compare;
  const before = useTabData<Comparison | null>("customers:before", workspaceId, range, async () => {
    if (compare === "none") return null;
    const sales = await reportsGetSales(apiClient, workspaceId, { from: range.from, to: range.to, compare });
    // No window to compare with: no chips, rather than a change against nothing.
    if (!sales.previousRange) return null;
    const { newCustomers, returningCustomers, returningCustomerRate } = sales.kpis;
    return { newCustomers, returningCustomers, returningCustomerRate };
  });

  const data = report.data;
  return (
    <ReportTab question={questions.customers}>
      <ReportTabState loading={report.loading} error={data ? null : report.error} onRetry={report.retry}>
        {data && (
          <CustomersReport
            data={data}
            range={range}
            before={before.data}
            beforeFailed={Boolean(before.error) && !isPermissionError(before.error)}
            onRetryBefore={before.retry}
          />
        )}
      </ReportTabState>
    </ReportTab>
  );
}

/** The parts of the tab, once the report is here: direct children of the tab's column. */
function CustomersReport({
  data,
  range,
  before,
  beforeFailed,
  onRetryBefore,
}: {
  data: ReportsCustomers;
  range: ReportRange;
  before: Comparison | null;
  beforeFailed: boolean;
  onRetryBefore: () => void;
}) {
  const t = useT(CUSTOMERS_TAB_STRINGS);
  const inReport = useReportMoney();
  const money = (minor: number) => formatMinorMoney(...inReport(minor, data.currency));
  const { window: period, lifetime } = data;

  // ---- the KPI strip: a chip only where there is a real figure from the window before.
  const newDelta = before ? deltaBasisPoints(period.newCustomers, before.newCustomers.previous) : null;
  const returningDelta = before ? deltaBasisPoints(period.returningCustomers, before.returningCustomers.previous) : null;
  const deltaLabel = range.compare === "year" ? t.vsYear : undefined;
  // A change of a percentage, in percent, reads as points: the rate says what it was, in words.
  const rateBefore = before?.returningCustomerRate.previous ?? null;
  const rateHint =
    rateBefore === null
      ? t.returningRateHint
      : fmt(t.returningRateWas, {
          rate: formatRate(rateBefore),
          when: range.compare === "year" ? t.whenYear : t.whenPrevious,
        });

  // ---- the chart: who the period's customers, orders and sales came from.
  const split: SplitRow[] = [
    { key: "customers", label: t.rowCustomers, fresh: period.newCustomers, back: period.returningCustomers, format: formatCount },
    { key: "orders", label: t.rowOrders, fresh: period.newOrders, back: period.returningOrders, format: formatCount },
    { key: "sales", label: t.rowSales, fresh: period.newSales, back: period.returningSales, format: money },
  ];
  const nothingToPlot = split.every((row) => row.fresh + row.back <= 0);

  // ---- the table: the customers who bought the most in the range.
  const columns: ReportColumn<TopRow>[] = [
    {
      key: "name",
      header: t.customer,
      cell: (row) => row.name || t.unnamed,
      sortValue: (row) => row.name,
      csv: (row) => row.name || t.unnamed,
    },
    {
      key: "orders",
      header: t.orders,
      hint: t.ordersHint,
      align: "end",
      cell: (row) => formatCount(row.orders),
      sortValue: (row) => row.orders,
    },
    {
      key: "delivered",
      header: t.delivered,
      hint: t.deliveredHint,
      align: "end",
      cell: (row) => formatCount(row.delivered),
      sortValue: (row) => row.delivered,
    },
    {
      key: "sales",
      header: t.sales,
      hint: t.salesHint,
      align: "end",
      cell: (row) => money(row.sales),
      sortValue: (row) => row.sales,
      // The amount as shown (the report's currency), in whole units, so a spreadsheet can add the column up.
      csv: (row) => majorUnits(...inReport(row.sales, data.currency)),
    },
  ];

  // ---- the sentence (the rule is written out in customers/takeaway.tsx).
  const takeaway = customersTakeaway(data, t, money);

  // ---- the links. The survey opens on the hub's own period (its page reads the same range params).
  const rangeSearch = range.preset === "custom" ? `from=${range.fromDay}&to=${range.toDay}` : `range=${range.preset}`;
  const links: ReportLinkItem[] = [
    { to: "/customers", title: t.linkCustomers, description: t.linkCustomersHint, icon: IconCustomers },
    { to: "/customers?tab=groups", title: t.linkGroups, description: t.linkGroupsHint, icon: IconCrown },
    { to: "/customers?tab=segments", title: t.linkSegments, description: t.linkSegmentsHint, icon: IconChartPie },
    { to: `${SURVEY_RESULTS_PATH}?${rangeSearch}`, title: t.linkSurvey, description: t.linkSurveyHint, icon: IconClipboard },
    { to: "/loyalty", title: t.linkLoyalty, description: t.linkLoyaltyHint, icon: IconLoyalty },
  ];

  return (
    <>
      <div className="min-w-0">
        <ReportKpiStrip sparkline={false}>
          <KpiCard
            label={t.newCustomers}
            value={formatCount(period.newCustomers)}
            deltaBasisPoints={newDelta}
            deltaLabel={deltaLabel}
            hint={t.newHint}
            to="/customers"
          />
          <KpiCard
            label={t.returningCustomers}
            value={formatCount(period.returningCustomers)}
            deltaBasisPoints={returningDelta}
            deltaLabel={deltaLabel}
            hint={t.returningHint}
          />
          <KpiCard label={t.returningRate} value={formatRate(period.returningCustomerRate)} hint={rateHint} />
          <KpiCard
            label={t.lifetimeValue}
            value={lifetime.customers > 0 ? money(lifetime.averageLifetimeValue) : "—"}
            hint={lifetime.customers > 0 ? fmt(t.lifetimeHint, { n: lifetime.averageOrders }) : t.lifetimeNone}
          />
        </ReportKpiStrip>
        {beforeFailed && (
          <p className="mt-2 flex flex-wrap items-center gap-x-1 px-1 text-[13px] leading-5 text-ink-soft">
            <span>{t.compareFailed}</span>
            <button
              type="button"
              onClick={onRetryBefore}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-2 font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t.retry}
            </button>
          </p>
        )}
      </div>

      <ReportChartCard
        title={t.chartTitle}
        note={t.chartNote}
        legend={
          <ReportLegend
            items={[
              { label: t.legendNew, swatch: "primary" },
              { label: t.legendReturning, swatch: "accent" },
            ]}
          />
        }
        height={240}
        empty={nothingToPlot ? t.chartEmpty : null}
      >
        {(height) => (
          <NewVsReturningChart
            rows={split}
            height={height}
            newLabel={t.legendNew}
            returningLabel={t.legendReturning}
            summary={t.chartSummary}
            segmentTitle={t.segmentTitle}
          />
        )}
      </ReportChartCard>

      <ReportTable
        columns={columns}
        rows={data.topCustomers}
        rowKey={(row) => row.customerId}
        rowTo={(row) => `/customers/${row.customerId}`}
        defaultSort={{ key: "sales", dir: "desc" }}
        exportName="zimos-customers"
        range={range}
        caption={t.top}
        note={t.topNote}
        empty={t.topEmpty}
      />

      <ReportTakeaway tone={takeaway.tone} action={takeaway.action}>
        {takeaway.sentence}
      </ReportTakeaway>

      <ReportMore>
        <AccordionSection
          title={t.cohorts}
          summary={
            data.cohorts.length > 0 ? `${pluralOf(t, "cohortMonths", data.cohorts.length)} · ${t.cohortsBy}` : t.cohortsBy
          }
          icon={IconCalendar}
          persistKey="reports:customers:cohorts"
          flush
        >
          <CohortTable cohorts={data.cohorts} />
        </AccordionSection>
        <AccordionSection
          title={t.lifetime}
          summary={
            lifetime.customers > 0
              ? fmt(t.lifetimeSummary, { customers: pluralOf(t, "customersCount", lifetime.customers) })
              : t.lifetimeNone
          }
          icon={IconRepeat}
          persistKey="reports:customers:lifetime"
        >
          <LifetimeNumbers lifetime={lifetime} money={money} />
        </AccordionSection>
      </ReportMore>

      <ReportLinks items={links} />
    </>
  );
}

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, cn } from "@store-builder/ui";
import { profitGetPnl, profitPerOrderFeeOf, type ProfitGroupBy, type ProfitPnl, type ProfitStatement } from "@store-builder/api-client";
import { AccordionSection } from "@/components/Accordion";
import { EmptyState } from "@/components/EmptyState";
import {
  IconAnnounce,
  IconCalendar,
  IconDelivered,
  IconPercent,
  IconProfit,
  IconReceipt,
  IconReports,
  IconSettlements,
  IconSliders,
  IconTarget,
} from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import {
  ReportChartCard,
  ReportKpiStrip,
  ReportLinks,
  ReportMore,
  ReportTabState,
  ReportTakeaway,
  type ReportLinkItem,
} from "@/components/report";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { ANALYTICS_RANGES, formatAxisDate, formatCount, percentToRatio, rangeWindows, type AnalyticsRange } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { formatPercentValue } from "@/lib/format";
import { ReportCurrencySelect } from "@/lib/reportCurrency";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAddressValue } from "@/pages/analytics/storeReports/storeReportParts";
import { ProfitBarsChart } from "@/pages/reports/tabs/sales/ProfitBarsChart";
import { AmountList, useSalesMoney, type AmountRow } from "@/pages/reports/tabs/sales/SalesParts";
import { useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { HeaderMenu } from "./HeaderMenu";
import { ProfitRankBars } from "./ProfitRankBars";
import { PROFIT_STRINGS, type ProfitKey, type ProfitVersion } from "./profitStrings";
import { PROFIT_GROUPS, ProfitTable, orderedProfitRows, profitRowLabel } from "./ProfitTable";

const DEFAULT_RANGE: AnalyticsRange = "30d";
/** The period an empty page offers next. */
const LONGER: Partial<Record<AnalyticsRange, { range: AnalyticsRange; days: number }>> = {
  today: { range: "30d", days: 30 },
  yesterday: { range: "30d", days: 30 },
  "7d": { range: "30d", days: 30 },
  "30d": { range: "90d", days: 90 },
  "90d": { range: "365d", days: 365 },
};
/** Rows the chart of a product or campaign view names; the table under it has them all. */
const RANK_ROWS = 5;

type CostKey = "costOfGoods" | "shipping" | "fees" | "adSpend" | "zimosFees";
const COST_NAME: Record<CostKey, ProfitKey> = {
  costOfGoods: "cost_costOfGoods",
  shipping: "cost_shipping",
  fees: "cost_fees",
  adSpend: "cost_adSpend",
  zimosFees: "cost_zimosFees",
};

/** The parts of the page share one column and one gap, like a tab of the reports hub. */
const COLUMN = "flex min-w-0 flex-col gap-[var(--bento-gap)]";

/**
 * Real profit (/profit) — the detail behind the headline the reports hub shows
 * on its sales tab: what was kept after the product, both shipping legs, fees
 * and ads, per day, per product or per campaign, actual or projected.
 *
 * One request per view (`GET /profit/pnl`, grouped as the table's switch
 * says), remembered for the session: the totals, the chart and the table all
 * read it. The chart follows the view — bars per day (a losing day hangs
 * under the line), ranked rows for products and campaigns. The period, the
 * view and the version live in the address, so a view can be linked to.
 */
export function RealProfitPage() {
  const t = useT(PROFIT_STRINGS);
  const workspaceId = useWorkspaceId();
  const phone = useIsPhone();
  const [params, setParams] = useSearchParams();

  function write(key: string, value: string, fallback: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true }
    );
  }

  const rangeInAddress = ANALYTICS_RANGES.find((option) => option === params.get("range")) ?? DEFAULT_RANGE;
  const groupInAddress = PROFIT_GROUPS.find((option) => option === params.get("group")) ?? "day";
  const versionInAddress: ProfitVersion = params.get("version") === "projected" ? "projected" : "actual";
  // The controls answer at once; the address follows.
  const [range, setRange] = useAddressValue<AnalyticsRange>(rangeInAddress, (next) => write("range", next, DEFAULT_RANGE));
  const [group, setGroup] = useAddressValue<ProfitGroupBy>(groupInAddress, (next) => write("group", next, "day"));
  const [version, setVersion] = useAddressValue<ProfitVersion>(versionInAddress, (next) => write("version", next, "actual"));

  const report = useCachedAsync<ProfitPnl>(
    workspaceId ? `profit:${workspaceId}:${range}:${group}` : null,
    () => profitGetPnl(apiClient, workspaceId, { ...rangeWindows(range).current, groupBy: group }),
    [workspaceId, range, group]
  );
  const pnl = report.data;
  const percent = (value: number | null) => formatPercentValue(percentToRatio(value));

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader
        title={t.title}
        // A phone keeps the first screen for the numbers: the sentence is for wider screens.
        description={phone ? undefined : t.description}
        actions={
          <>
            <ReportCurrencySelect />
            <Button asChild variant="outline" className="h-10 gap-2 rounded-full px-4 max-md:hidden">
              <ViewLink to="/profit/costs">
                <IconSliders className="size-4" aria-hidden />
                {t.costs}
              </ViewLink>
            </Button>
            <HeaderMenu
              label={t.more}
              items={[
                { id: "costs", label: t.costs, hint: t.costsHint, icon: IconSliders, to: "/profit/costs" },
                { id: "ads", label: t.adSpend, hint: t.adSpendHint, icon: IconAnnounce, to: "/ads" },
                { id: "hub", label: t.hub, hint: t.hubHint, icon: IconReports, to: "/analytics", separatorBefore: true },
              ]}
            />
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <RangeSelect value={range} onChange={setRange} />
        <Segmented
          size="sm"
          value={version}
          onChange={setVersion}
          label={t.versionLabel}
          options={[
            { value: "actual", label: t.actual },
            { value: "projected", label: t.projected },
          ]}
        />
        {pnl && (
          <p className="min-w-0 flex-1 basis-56 text-[13px] leading-5 text-pretty text-ink-soft">
            {version === "actual"
              ? t.actualHint
              : pnl.projectionDeliveryRate === null
                ? t.projectedNoHistory
                : fmt(t.projectedHint, { rate: percent(pnl.projectionDeliveryRate) })}
          </p>
        )}
      </div>

      <ReportTabState loading={report.loading && !pnl} error={report.error} onRetry={() => void report.refresh()}>
        {pnl && (
          <ProfitBody
            pnl={pnl}
            version={version}
            range={range}
            group={group}
            onGroup={setGroup}
            onRange={setRange}
            busy={report.loading}
            phone={phone}
          />
        )}
      </ReportTabState>
    </div>
  );
}

/** The presets of the period, in the dashboard's own select: 44px under a thumb. */
function RangeSelect({ value, onChange }: { value: AnalyticsRange; onChange: (value: AnalyticsRange) => void }) {
  const t = useT(PROFIT_STRINGS);
  const common = useCommon();
  const labels: Record<AnalyticsRange, string> = {
    today: common.today,
    yesterday: t.yesterday,
    "7d": common.last7,
    "30d": common.last30,
    "90d": common.last90,
    "365d": fmt(t.lastDays, { n: 365 }),
  };
  return (
    <div className="relative">
      <IconCalendar className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
      <Select
        aria-label={t.rangeLabel}
        value={value}
        onChange={(event) => onChange(event.target.value as AnalyticsRange)}
        className="h-11 w-auto ps-9 font-medium pointer-fine:h-9"
      >
        {ANALYTICS_RANGES.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </Select>
    </div>
  );
}

function ProfitBody({
  pnl,
  version,
  range,
  group,
  onGroup,
  onRange,
  busy,
  phone,
}: {
  pnl: ProfitPnl;
  version: ProfitVersion;
  range: AnalyticsRange;
  group: ProfitGroupBy;
  onGroup: (group: ProfitGroupBy) => void;
  onRange: (range: AnalyticsRange) => void;
  /** The next view is on its way: what is on screen is dimmed, never swapped for a skeleton. */
  busy: boolean;
  phone: boolean;
}) {
  const t = useT(PROFIT_STRINGS);
  const { money, signed } = useSalesMoney(pnl.currency);
  const totals = pnl.totals;
  const statement = totals[version];
  const shown = pnl.groupBy;
  const percent = (value: number | null) => formatPercentValue(percentToRatio(value));

  const dayPoints = useMemo(
    () => (shown === "day" ? pnl.rows.map((row) => ({ label: formatAxisDate(row.key), value: row[version].netProfit })) : []),
    [pnl.rows, shown, version]
  );
  const ranked = useMemo(
    () =>
      shown === "day"
        ? []
        : orderedProfitRows(pnl, version)
            .slice(0, RANK_ROWS)
            .map((row, index) => ({
              key: row.key || `none-${index}`,
              label: profitRowLabel(row, shown, t.noCampaign),
              value: row[version].netProfit,
            })),
    [pnl, shown, version, t.noCampaign]
  );

  const counted = totals.orders.delivered + totals.orders.returned + totals.orders.open;
  if (counted === 0 && totals.actual.adSpend === 0 && totals.actual.revenue === 0) {
    const longer = LONGER[range];
    return (
      <EmptyState
        icon={<IconProfit aria-hidden />}
        title={t.emptyTitle}
        description={t.emptyHint}
        action={
          longer ? (
            <Button type="button" className="min-h-11 rounded-full px-5" onClick={() => onRange(longer.range)}>
              {fmt(t.emptyLonger, { n: longer.days })}
            </Button>
          ) : (
            <Button asChild className="min-h-11 rounded-full px-5">
              <ViewLink to="/orders">{t.emptyOrders}</ViewLink>
            </Button>
          )
        }
      />
    );
  }

  // Every cost the Costs page lets the merchant set is zero: the profit is flattered until they are entered.
  const noCosts = statement.revenue > 0 && statement.shipping === 0 && statement.fees === 0;
  const coverageShort = totals.orders.delivered > 0 && pnl.costCoverage !== null && pnl.costCoverage < 100;

  const statementRows: AmountRow[] = [
    { key: "revenue", label: t.revenue, value: money(statement.revenue) },
    { key: "goods", label: t.costOfGoods, value: signed(-statement.costOfGoods) },
    { key: "shipping", label: t.shipping, value: signed(-statement.shipping) },
    { key: "return", label: t.returnShipping, value: signed(-statement.returnShipping) },
    { key: "fees", label: t.fees, value: signed(-statement.fees) },
    { key: "ads", label: t.adSpendLine, value: signed(-statement.adSpend) },
    // handoff 397: a pay-per-order store pays ZIMOS from its prepaid balance, not by percentage.
    { key: "zimos", label: t.zimosFees, sub: profitPerOrderFeeOf(pnl) ? t.zimosPerOrderHint : undefined, value: signed(-statement.zimosFees) },
    { key: "net", label: t.netProfit, value: signed(statement.netProfit), strong: true, tone: statement.netProfit < 0 ? "bad" : "good" },
  ];

  const links: ReportLinkItem[] = [
    { to: "/profit/costs", title: t.costs, description: t.costsHint, icon: IconSliders },
    { to: "/ads", title: t.adSpend, description: t.adSpendHint, icon: IconAnnounce },
    { to: "/settlements", title: t.settlements, description: t.settlementsHint, icon: IconSettlements },
    { to: "/analytics", title: t.hub, description: t.hubHint, icon: IconReports },
  ];

  const chartFlat = shown === "day" ? dayPoints.every((point) => point.value === 0) : ranked.length === 0;

  return (
    <div
      aria-busy={busy || undefined}
      className={cn(COLUMN, "transition-opacity duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none", busy && "opacity-60")}
    >
      {noCosts && (
        <ReportTakeaway tone="warn" action={{ label: t.setCosts, to: "/profit/costs" }}>
          {t.noCostsSet}
        </ReportTakeaway>
      )}
      {coverageShort && (
        <ReportTakeaway tone="warn" action={{ label: t.openCosts, to: "/profit/costs" }}>
          {pnl.costCoverage === 0 ? t.coverageNone : fmt(t.coveragePartial, { rate: percent(pnl.costCoverage) })}
        </ReportTakeaway>
      )}

      {/* No sparkline and no change chip: the statement has no series of its own and no period before. */}
      <ReportKpiStrip sparkline={false}>
        <KpiCard
          label={t.netProfit}
          value={<span className={statement.netProfit < 0 ? "text-danger" : undefined}>{signed(statement.netProfit)}</span>}
          hint={t.netProfitHint}
          icon={<IconProfit />}
        />
        <KpiCard label={t.margin} value={percent(statement.margin)} hint={t.marginHint} icon={<IconPercent />} />
        <KpiCard
          label={t.maxCpa}
          value={totals.maxCpa === null ? "—" : money(totals.maxCpa)}
          hint={t.maxCpaHint}
          icon={<IconTarget />}
        />
        <KpiCard
          label={t.deliveryRate}
          value={percent(totals.deliveryRate)}
          hint={fmt(t.deliveryHint, {
            delivered: formatCount(Math.round(totals.orders.delivered)),
            returned: formatCount(Math.round(totals.orders.returned)),
            open: formatCount(Math.round(totals.orders.open)),
          })}
          icon={<IconDelivered />}
        />
      </ReportKpiStrip>

      {shown === "day" ? (
        <ReportChartCard title={t.perDay} note={chartFlat ? undefined : t.perDayNote} empty={chartFlat ? t.chartEmpty : null}>
          {(height) => <ProfitBarsChart points={dayPoints} format={signed} height={height} summary={t.perDay} />}
        </ReportChartCard>
      ) : (
        <ReportChartCard
          title={shown === "product" ? t.topProducts : t.topCampaigns}
          note={chartFlat ? undefined : fmt(t.topNote, { n: ranked.length })}
          empty={chartFlat ? t.chartEmpty : null}
        >
          <ProfitRankBars rows={ranked} format={signed} summary={t.chartSummary} />
        </ReportChartCard>
      )}

      <ProfitTable pnl={pnl} version={version} group={group} onGroup={onGroup} rangeName={range} />

      {/* The answer in words. With no unit cost at all it would call revenue profit, so it is left unsaid. */}
      {pnl.costCoverage !== 0 && <ProfitAnswer statement={statement} money={money} />}

      <ReportMore>
        <AccordionSection
          title={t.statement}
          summary={t.statementSummary}
          icon={IconReceipt}
          // Open where there is room for it; on a phone it waits one tap away, under the table.
          defaultOpen={!phone}
          persistKey="profit:statement"
        >
          <AmountList rows={statementRows} />
        </AccordionSection>
      </ReportMore>

      <ReportLinks items={links} />
    </div>
  );
}

/** One sentence on the period: kept or lost, and the biggest cost as a share of sales. */
function ProfitAnswer({ statement, money }: { statement: ProfitStatement; money: (minor: number) => string }) {
  const t = useT(PROFIT_STRINGS);
  if (statement.revenue <= 0) return <ReportTakeaway tone="info">{t.answerNone}</ReportTakeaway>;

  const costs: Record<CostKey, number> = {
    costOfGoods: statement.costOfGoods,
    shipping: statement.shipping + statement.returnShipping,
    fees: statement.fees,
    adSpend: statement.adSpend,
    zimosFees: statement.zimosFees,
  };
  const biggest = (Object.keys(costs) as CostKey[]).reduce((a, b) => (costs[b] > costs[a] ? b : a));
  const loss = statement.netProfit < 0;
  const share = (ratio: number) => formatPercentValue(ratio, 0);
  return (
    <ReportTakeaway tone={loss ? "bad" : "good"}>
      {fmt(loss ? t.answerDown : t.answerUp, {
        amount: money(Math.abs(statement.netProfit)),
        pct: share(Math.max(0, statement.netProfit) / statement.revenue),
      })}
      {costs[biggest] > 0 && <> {fmt(t.answerBiggest, { cost: t[COST_NAME[biggest]], pct: share(costs[biggest] / statement.revenue) })}</>}
    </ReportTakeaway>
  );
}

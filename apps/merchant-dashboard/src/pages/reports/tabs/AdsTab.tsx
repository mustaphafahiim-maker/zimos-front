import { useMemo } from "react";
import type { AdsConnection, InsightsAttribution, ProfitCampaigns, ProfitPnl } from "@store-builder/api-client";
import { Button } from "@store-builder/ui";
import { AccordionSection } from "@/components/Accordion";
import { LineAreaChart } from "@/components/charts";
import { EmptyState } from "@/components/EmptyState";
import {
  IconAds,
  IconAnnounce,
  IconCalendar,
  IconChartLine,
  IconCode,
  IconLink,
  IconPlug,
  IconProfit,
  IconReceipt,
  IconShare,
  IconSliders,
  IconTarget,
  IconWarning,
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
  useTabData,
  type ReportLinkItem,
  type ReportTabProps,
} from "@/components/report";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatAxisDate, formatCount, formatWindow } from "@/lib/analytics";
import { countOf, pluralOf } from "@/lib/plural";
import type { ReportRange } from "@/lib/reportRange";
import { REPORT_TAB_QUESTIONS } from "../reportTabs";
import { AdLinkParameters, ProfitByCampaign, SalesChannels, SpendByDay, SpendEntries, TrafficByDay, UnmatchedCampaigns } from "./ads/AdsMore";
import { AdsTable } from "./ads/AdsTable";
import { CampaignVerdict, SourcesTakeaway } from "./ads/AdsVerdict";
import { CampaignBars } from "./ads/CampaignBars";
import {
  DEFAULT_ATTRIBUTION,
  attributionKey,
  campaignRows,
  connectionState,
  judgeCampaigns,
  judgeSources,
  loadAdsMain,
  loadAttribution,
  loadCampaignPnl,
  profitByCampaign,
  type AdsConnectionState,
  type AdsMain,
} from "./ads/adsData";
import { formatRoas, useAdsMoney } from "./ads/adsFormat";
import { ADS_STRINGS, type AdsText } from "./ads/adsStrings";
import { CountBadge, PartError, SectionBones, TakeawayBones } from "./ads/parts";

/**
 * «الإعلانات» — "which campaign makes money?" — the ads tab of the reports hub.
 *
 * Built from the old ad-spend screen (campaigns report), the old sales-sources
 * screen (attribution), the P&L grouped by campaign (net profit per campaign)
 * and the ad-account connections. Recording and importing spend, the campaign
 * controls and the ad accounts stay on /ads and /ads/accounts: linked, not rebuilt.
 *
 * THE HUB'S RANGE → THE APIS. `range.from` / `range.to` (ISO instants, `to`
 * exclusive) go as they are to the campaigns report, the P&L and attribution;
 * the spend log takes days (`fromDay` / `toDay`). None of these has a
 * comparison, so no card carries a change chip — each says in words what it is
 * measured over, and the tab's note says there is no earlier period here.
 *
 * WHO SEES WHAT (a 403 is "not for this role", never an error):
 *  - campaigns report readable (financial_reports.view) → the whole tab; the
 *    net-profit column and «الربح حملة بحملة» only if the P&L answers too;
 *  - campaigns report refused → the order sources alone (attribution is
 *    analytics.view), as the old sales-sources screen showed them;
 *  - both refused → the kit's no-permission state.
 *
 * The anatomy, top to bottom: the stat cards · ONE chart (what each campaign
 * cost against what it brought back) · ONE table (by campaign, switchable to
 * source / medium / link campaign / ad) · ONE sentence (the rule is in
 * ads/adsData.ts) · «تفاصيل أكتر» · the links out.
 */
export default function AdsTab(props: ReportTabProps) {
  const { workspaceId, range } = props;
  const questions = useT(REPORT_TAB_QUESTIONS);
  const t = useT(ADS_STRINGS);
  const main = useTabData<AdsMain>("ads", workspaceId, range, () => loadAdsMain(workspaceId, range));
  const answer = main.data;
  const sourcesOnly = answer !== null && answer.report === null;

  return (
    <ReportTab question={questions.ads} note={sourcesOnly ? t.noteSourcesOnly : t.note}>
      <ReportTabState loading={main.loading} error={main.error} onRetry={main.retry}>
        {answer === null ? null : answer.report === null ? (
          <AdsSources workspaceId={workspaceId} range={range} />
        ) : answer.report.campaigns.length === 0 ? (
          <AdsNoSpend workspaceId={workspaceId} range={range} report={answer.report} connections={answer.connections} />
        ) : (
          <AdsWithSpend workspaceId={workspaceId} range={range} report={answer.report} connections={answer.connections} />
        )}
      </ReportTabState>
    </ReportTab>
  );
}

interface SectionProps {
  workspaceId: string;
  range: ReportRange;
}

interface BodyProps extends SectionProps {
  report: ProfitCampaigns;
  connections: AdsConnection[] | null;
}

// ------------------------------------------------------- the whole tab --

/** Spend is recorded in the range: the tab in full. */
function AdsWithSpend({ workspaceId, range, report, connections }: BodyProps) {
  const t = useT(ADS_STRINGS);
  const { money } = useAdsMoney(report.currency);
  // A side request: net profit per campaign. Refused (null) → no profit column; failed → its own error line.
  const pnl = useTabData<ProfitPnl | null>("ads:pnl", workspaceId, range, () => loadCampaignPnl(workspaceId, range));
  const profit = useMemo(() => profitByCampaign(report.campaigns, pnl.data), [report.campaigns, pnl.data]);
  const rows = useMemo(() => campaignRows(report, profit), [report, profit]);
  const verdict = useMemo(() => judgeCampaigns(rows, report.totals), [rows, report.totals]);

  const totals = report.totals;
  const pnlFailed = !pnl.loading && Boolean(pnl.error);
  const profitColumn = pnl.loading ? "loading" : pnl.data ? "ready" : "off";
  const showProfitSection = pnl.loading || pnl.data !== null || pnlFailed;

  return (
    <>
      {/* No change chips: the campaigns report has no earlier period. Each card says what it is measured over. */}
      <ReportKpiStrip sparkline={false}>
        <KpiCard
          label={t.kpiSpend}
          value={money(totals.spendAmount)}
          hint={fmt(t.kpiSpendHint, { campaigns: pluralOf(t, "campaigns", report.campaigns.length) })}
        />
        <KpiCard label={t.kpiOrders} value={formatCount(totals.orders)} hint={t.kpiOrdersHint} />
        <KpiCard
          label={t.kpiDelivered}
          value={formatCount(totals.delivered)}
          hint={fmt(t.kpiDeliveredHint, { orders: countOf("order", totals.orders) })}
        />
        <KpiCard label={t.kpiCpd} value={money(totals.realCpa)} hint={totals.realCpa === null ? t.kpiCpdNone : t.kpiCpdHint} />
        <KpiCard
          label={t.kpiRoas}
          value={formatRoas(totals.realRoas)}
          hint={totals.realRoas === null ? t.kpiRoasNone : fmt(t.kpiRoasHint, { amount: money(totals.deliveredSalesAmount) })}
        />
      </ReportKpiStrip>

      <ReportChartCard
        title={t.chartTitle}
        note={t.chartNote}
        legend={
          <ReportLegend
            items={[
              { label: t.legendSpend, swatch: "neutral" },
              { label: t.legendSales, swatch: "primary" },
            ]}
          />
        }
      >
        {(height) => <CampaignBars rows={rows} height={height} money={money} />}
      </ReportChartCard>

      <AdsTable
        workspaceId={workspaceId}
        range={range}
        campaigns={rows}
        currency={report.currency}
        profitColumn={profitColumn}
        costCoverage={pnl.data ? pnl.data.costCoverage : null}
        onRetryProfit={pnlFailed ? pnl.retry : undefined}
      />

      {/* The sentence waits for the profit: said once, on the best figures there are — never said, then changed. */}
      {pnl.loading ? <TakeawayBones /> : <CampaignVerdict verdict={verdict} money={money} />}

      <ReportMore>
        {report.withoutSpend.length > 0 && <UnmatchedSection report={report} range={range} />}
        {showProfitSection && (
          <AccordionSection title={t.moreProfitTitle} summary={t.moreProfitSummary} icon={IconProfit} persistKey="reports:ads:profit" flush>
            {pnl.data ? (
              <ProfitByCampaign pnl={pnl.data} range={range} />
            ) : pnlFailed ? (
              <div className="p-3">
                <PartError message={t.profitFailed} onRetry={pnl.retry} />
              </div>
            ) : (
              <SectionBones flush />
            )}
          </AccordionSection>
        )}
        <AccordionSection title={t.moreDailyTitle} summary={t.moreDailySummary} icon={IconCalendar} persistKey="reports:ads:daily">
          <SpendByDay workspaceId={workspaceId} range={range} />
        </AccordionSection>
        <AccordionSection title={t.moreEntriesTitle} summary={t.moreEntriesSummary} icon={IconReceipt} persistKey="reports:ads:entries" flush>
          <SpendEntries workspaceId={workspaceId} range={range} />
        </AccordionSection>
        <TrafficSection workspaceId={workspaceId} range={range} />
        <ChannelsSection workspaceId={workspaceId} range={range} />
        <LinkParametersSection report={report} />
      </ReportMore>

      <ReportLinks items={adsLinks(t, connectionState(connections), pnl.data !== null)} />
    </>
  );
}

// ------------------------------------------------------ no spend at all --

/**
 * No ad spend is recorded in the range: the tab's question cannot be answered,
 * so the tab says what to do instead — with ONE action. The order sources and
 * the rest of what can still be read wait in «تفاصيل أكتر».
 */
function AdsNoSpend({ workspaceId, range, report, connections }: BodyProps) {
  const t = useT(ADS_STRINGS);
  const state = connectionState(connections);
  // The ONE action: connect the ad account — or, when one is connected (or we could not tell), record the spend.
  const connectFirst = state.known && !state.connected;
  const unmatchedOrders = report.withoutSpend.reduce((sum, campaign) => sum + campaign.orders, 0);
  const description =
    report.withoutSpend.length > 0
      ? fmt(t.emptyDescUnmatched, {
          campaigns: pluralOf(t, "campaigns", report.withoutSpend.length),
          orders: countOf("order", unmatchedOrders),
        })
      : connectFirst
        ? t.emptyDescConnect
        : state.connected
          ? t.emptyDescConnected
          : t.emptyDescRecord;

  return (
    <>
      <EmptyState
        icon={<IconAnnounce />}
        title={t.emptyTitle}
        description={description}
        action={
          <Button asChild className="min-h-11 rounded-full px-5">
            <ViewLink to={connectFirst ? "/ads/accounts" : "/ads"}>{connectFirst ? t.actionConnect : t.actionRecord}</ViewLink>
          </Button>
        }
      />

      <ReportMore>
        <AccordionSection title={t.moreSourcesTitle} summary={t.moreSourcesSummary} icon={IconTarget} persistKey="reports:ads:sources" flush>
          <AdsTable workspaceId={workspaceId} range={range} campaigns={null} currency={report.currency} embedded />
        </AccordionSection>
        {report.withoutSpend.length > 0 && <UnmatchedSection report={report} range={range} />}
        <TrafficSection workspaceId={workspaceId} range={range} />
        <ChannelsSection workspaceId={workspaceId} range={range} />
        <LinkParametersSection report={report} />
      </ReportMore>

      <ReportLinks items={adsLinks(t, state, true)} />
    </>
  );
}

// --------------------------------------------------- order sources only --

/**
 * Campaign spend is not for this role, but the order sources may be (they need
 * analytics.view only): the tab becomes what the old sales-sources screen was.
 * Its main request is the attribution report — refused too, the tab shows the
 * kit's no-permission state.
 */
function AdsSources({ workspaceId, range }: SectionProps) {
  const sources = useTabData<InsightsAttribution>(
    "ads:attribution",
    workspaceId,
    range,
    () => loadAttribution(workspaceId, range, DEFAULT_ATTRIBUTION),
    attributionKey(DEFAULT_ATTRIBUTION)
  );
  return (
    <ReportTabState loading={sources.loading} error={sources.error} onRetry={sources.retry}>
      {sources.data && <AdsSourcesBody workspaceId={workspaceId} range={range} data={sources.data} />}
    </ReportTabState>
  );
}

function AdsSourcesBody({ workspaceId, range, data }: SectionProps & { data: InsightsAttribution }) {
  const t = useT(ADS_STRINGS);
  const { money } = useAdsMoney(data.currency);
  const verdict = useMemo(() => judgeSources(data), [data]);
  const totals = data.totals;
  const links: ReportLinkItem[] = [{ to: "/marketing", title: t.linkBuilder, description: t.linkBuilderDesc, icon: IconLink }];

  // Nothing at all in the range: what to do, and the one way there.
  if (totals.visitors === 0 && totals.orders === 0) {
    return (
      <EmptyState
        icon={<IconTarget />}
        title={t.sourcesEmptyTitle}
        description={t.sourcesEmptyDesc}
        action={
          <Button asChild className="min-h-11 rounded-full px-5">
            <ViewLink to="/marketing">{t.actionBuilder}</ViewLink>
          </Button>
        }
      />
    );
  }

  const period = formatWindow(data.range.from, data.range.to);
  const noSales = data.series.every((day) => day.sales === 0);

  return (
    <>
      <ReportKpiStrip sparkline={false}>
        <KpiCard label={t.kpiVisitors} value={formatCount(totals.visitors)} hint={t.kpiVisitorsHint} />
        <KpiCard label={t.kpiOrders} value={formatCount(totals.orders)} hint={t.kpiAllOrdersHint} />
        <KpiCard
          label={t.kpiDelivered}
          value={formatCount(totals.delivered)}
          hint={fmt(t.kpiDeliveredHint, { orders: countOf("order", totals.orders) })}
        />
        <KpiCard
          label={t.kpiDeliveredSales}
          value={money(totals.deliveredSales)}
          hint={fmt(t.kpiDeliveredSalesHint, { amount: money(totals.sales) })}
        />
      </ReportKpiStrip>

      <ReportChartCard title={t.salesChartTitle} note={t.salesChartNote} empty={noSales ? t.salesChartEmpty : null}>
        {(height) => (
          // The chart sets dir="ltr" on itself: a time axis runs left to right in Arabic too.
          <LineAreaChart
            points={data.series.map((day) => ({ label: formatAxisDate(day.date), value: day.sales }))}
            format={(value) => money(value)}
            height={height}
            summary={fmt(t.chartOf, { what: t.salesChartTitle, window: period })}
          />
        )}
      </ReportChartCard>

      <AdsTable workspaceId={workspaceId} range={range} campaigns={null} currency={data.currency} />

      <SourcesTakeaway verdict={verdict} money={money} />

      <ReportMore>
        <TrafficSection workspaceId={workspaceId} range={range} />
        <ChannelsSection workspaceId={workspaceId} range={range} />
      </ReportMore>

      <ReportLinks items={links} />
    </>
  );
}

// ----------------------------------------------- sections used twice --

function UnmatchedSection({ report, range }: { report: ProfitCampaigns; range: ReportRange }) {
  const t = useT(ADS_STRINGS);
  return (
    <AccordionSection
      title={t.moreUnmatchedTitle}
      summary={t.moreUnmatchedSummary}
      icon={IconWarning}
      badge={<CountBadge count={report.withoutSpend.length} />}
      persistKey="reports:ads:unmatched"
      flush
    >
      <UnmatchedCampaigns rows={report.withoutSpend} currency={report.currency} range={range} />
    </AccordionSection>
  );
}

function TrafficSection({ workspaceId, range }: SectionProps) {
  const t = useT(ADS_STRINGS);
  return (
    <AccordionSection title={t.moreTrafficTitle} summary={t.moreTrafficSummary} icon={IconChartLine} persistKey="reports:ads:traffic">
      <TrafficByDay workspaceId={workspaceId} range={range} />
    </AccordionSection>
  );
}

function ChannelsSection({ workspaceId, range }: SectionProps) {
  const t = useT(ADS_STRINGS);
  return (
    <AccordionSection title={t.moreChannelsTitle} summary={t.moreChannelsSummary} icon={IconShare} persistKey="reports:ads:channels" flush>
      <SalesChannels workspaceId={workspaceId} range={range} />
    </AccordionSection>
  );
}

function LinkParametersSection({ report }: { report: ProfitCampaigns }) {
  const t = useT(ADS_STRINGS);
  return (
    <AccordionSection title={t.moreUrlTitle} summary={t.moreUrlSummary} icon={IconCode} persistKey="reports:ads:url">
      <AdLinkParameters parameters={report.suggestedUrlParameters} />
    </AccordionSection>
  );
}

// ------------------------------------------------------------ links out --

/**
 * Where the subject is managed: recording spend and the campaign controls
 * (/ads), the ad accounts (/ads/accounts, with the connection state in words),
 * the profit statement and the product costs it rests on, the link builder.
 */
function adsLinks(t: AdsText, state: AdsConnectionState, profitReadable: boolean): ReportLinkItem[] {
  const accounts = state.problem
    ? t.linkAccountsProblem
    : state.followed > 0
      ? fmt(t.linkAccountsOn, { accounts: pluralOf(t, "accounts", state.followed) })
      : state.connected
        ? t.linkAccountsPick
        : t.linkAccountsOff;
  const links: ReportLinkItem[] = [
    { to: "/ads", title: t.linkSpend, description: t.linkSpendDesc, icon: IconAds },
    { to: "/ads/accounts", title: t.linkAccounts, description: accounts, icon: IconPlug },
  ];
  if (profitReadable) {
    links.push(
      { to: "/profit", title: t.linkProfit, description: t.linkProfitDesc, icon: IconProfit },
      { to: "/profit/costs", title: t.linkCosts, description: t.linkCostsDesc, icon: IconSliders }
    );
  }
  links.push({ to: "/marketing", title: t.linkBuilder, description: t.linkBuilderDesc, icon: IconLink });
  return links;
}

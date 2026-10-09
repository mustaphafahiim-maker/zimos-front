import { PlanFeatureNotice, planFeatureRequired } from "@/pages/settings/billing/PlanFeatureNotice";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  reportsGetSales,
  type ReportsFunnelStepKey,
  type ReportsSales,
  type WebAnalyticsFilterKey,
  type WebAnalyticsStats,
} from "@store-builder/api-client";
import { Card } from "@store-builder/ui";
import { AccordionSection } from "@/components/Accordion";
import { KpiCard } from "@/components/KpiCard";
import {
  IconAnnounce,
  IconAttribution,
  IconCalendar,
  IconChartLine,
  IconClick,
  IconDevices,
  IconFlow,
  IconFunnels,
  IconLostOrders,
  IconPage,
  IconRealtime,
  IconSearch,
  IconSynonyms,
  IconWebsite,
} from "@/components/icons";
import {
  ReportChartCard,
  ReportKpiStrip,
  ReportLinks,
  ReportMore,
  ReportTab,
  ReportTabState,
  ReportTakeaway,
  useTabData,
  type ReportLinkItem,
  type ReportTabProps,
  type ReportTakeawayAction,
  type ReportTone,
} from "@/components/report";
import { fmt, useT } from "@/i18n/LocaleContext";
import { deltaBasisPoints, formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import type { ReportRange } from "@/lib/reportRange";
import { FILTER_KEYS, filtersFromSearch } from "@/lib/webAnalytics";
import { SEARCH_STRINGS } from "@/pages/searchInsights/searchStrings";
import { REPORT_TAB_PATHS, REPORT_TAB_QUESTIONS } from "../reportTabs";
import { conversionKnown, formatConversion } from "@/components/report/rates";
import { useDurationText, useStoreLabels } from "./store/labels";
import {
  filterEntries,
  filtersKey,
  findLeak,
  formatRate,
  HEALTHY_RATE,
  MIN_SESSIONS,
  outOf,
  SEARCH_ANCHOR,
  TRAFFIC_ANCHOR,
  webCompare,
  webParams,
  WORSE_BY,
  type FunnelLeakStep,
} from "./store/model";
import { ChannelsBody, DevicesBody, EventsBody, FunnelNumbers, LandingBody, TimeBody, WeeklyBody } from "./store/MoreSections";
import { RetryLine } from "./store/parts";
import { SearchBody } from "./store/SearchSection";
import { StoreFunnel } from "./store/StoreFunnel";
import { STORE_STRINGS } from "./store/strings";
import { TrafficBlock, type ScopedStats } from "./store/TrafficTable";

/** The hub's own address params: what a link to another tab carries along (the web-analytics filters stay here). */
const RANGE_PARAMS = ["range", "from", "to", "compare"] as const;

/**
 * «المتجر» — who visits, and where do they leave?
 *
 * Built from three old screens: store traffic (`/analytics/web`), the store
 * funnel and the sessions / conversion figures of the reports overview, and
 * store search (`/analytics/search`).
 *
 * - KPI strip: visitors, visits, conversion rate, bounce rate, time per visit.
 * - The ONE chart: the purchase path (entered → viewed a product → added to
 *   cart → started the order → ordered) with what each step kept.
 * - The ONE table: the visitors by page / source / device / country.
 * - The ONE sentence: the step that loses the most visitors (store/model.ts
 *   holds the rule).
 * - «تفاصيل أكتر»: the path in numbers, visits over time, the week's busy
 *   hours, who buys by device and by source, landing pages, events, search.
 *
 * Requests. MAIN — the sales report (`reportsGetSales`), which holds the
 * funnel: refused, the tab shows the no-permission state. Beside it, the web
 * analytics (stats now; the table's lists; a section's data when opened): a
 * 403 there leaves the web parts out, any other failure shows on that part's
 * own line with a retry. The funnel and the conversion rate are counted for
 * the whole store; the web-analytics filters narrow the table and the
 * web-analytics sections only, and each of those says so.
 */
export default function StoreTab({ workspaceId, range }: ReportTabProps) {
  const questions = useT(REPORT_TAB_QUESTIONS);
  const sales = useTabData("store", workspaceId, range, () =>
    reportsGetSales(apiClient, workspaceId, { from: range.from, to: range.to, compare: range.compare })
  );
  return (
    <ReportTab question={questions.store}>
      <ReportTabState loading={sales.loading} error={sales.error} onRetry={sales.retry}>
        {sales.data && <StoreBody workspaceId={workspaceId} range={range} sales={sales.data} />}
      </ReportTabState>
    </ReportTab>
  );
}

function StoreBody({ workspaceId, range, sales }: { workspaceId: string; range: ReportRange; sales: ReportsSales }) {
  const t = useT(STORE_STRINGS);
  const searchWords = useT(SEARCH_STRINGS);
  const labels = useStoreLabels();
  const duration = useDurationText();
  const location = useLocation();
  const navigate = useNavigate();

  // ------------------------------------------------------------- filters --
  // The web-analytics filters stay where the old screen kept them, in the address (`?device=mobile`),
  // so a link made there — or sent to someone — still opens filtered.
  const filters = useMemo(() => filtersFromSearch(new URLSearchParams(location.search)), [location.search]);
  const entries = filterEntries(filters);
  const hasFilters = entries.length > 0;
  const filterText = hasFilters
    ? entries.map(([key, raw]) => `${labels.filterLabel[key]}: ${labels.shown(key, raw).text}`).join(" · ")
    : null;

  const changeFilters = useCallback(
    (change: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(location.search);
      change(next);
      const text = next.toString();
      // The address names the table: the page stays where the merchant is (a new address without
      // a place in it starts at the top), and the link lands on the filtered table.
      navigate({ pathname: location.pathname, search: text ? `?${text}` : "", hash: `#${TRAFFIC_ANCHOR}` }, { replace: true });
    },
    [location.pathname, location.search, navigate]
  );
  const addFilter = useCallback(
    (key: WebAnalyticsFilterKey, value: string) => changeFilters((next) => next.set(key, value)),
    [changeFilters]
  );
  const removeFilter = useCallback((key: WebAnalyticsFilterKey) => changeFilters((next) => next.delete(key)), [changeFilters]);
  const clearFilters = useCallback(
    () =>
      changeFilters((next) => {
        for (const key of FILTER_KEYS) next.delete(key);
      }),
    [changeFilters]
  );

  // ------------------------------------------------------- web analytics --
  // The whole period, no filter: the KPI strip, and what the table's shares are shares of.
  const stats = useTabData("store:web", workspaceId, range, () =>
    apiClient.getWebAnalyticsStats(workspaceId, { ...webParams(range), compare: webCompare(range.compare) })
  );
  // The same totals under the table's filters — asked for only while something is filtered.
  const scopedQuery = useTabData<WebAnalyticsStats | null>(
    "store:web-filtered",
    workspaceId,
    range,
    () => (hasFilters ? apiClient.getWebAnalyticsStats(workspaceId, webParams(range, filters)) : Promise.resolve(null)),
    filtersKey(filters)
  );
  const scoped: ScopedStats = {
    data: hasFilters ? scopedQuery.data : null,
    loading: hasFilters && scopedQuery.loading,
    error: hasFilters ? scopedQuery.error : null,
    retry: scopedQuery.retry,
  };
  // A 403 on the web analytics: its cards, its table and its sections are not for this role.
  const webDenied = isPermissionError(stats.error);
  const gatedFeature = planFeatureRequired(stats.error);
  const web = stats.data;

  // ---------------------------------------------- landing on a part of it --
  // `/analytics/search` lands on the search block (`#search`). The table above it is still loading
  // when the tab first draws, so the page is brought to the block once the table has stopped growing.
  const landed = useRef(false);
  const landOnSearch = useCallback(() => {
    if (landed.current) return;
    landed.current = true;
    if (window.location.hash !== `#${SEARCH_ANCHOR}`) return;
    document.getElementById(SEARCH_ANCHOR)?.scrollIntoView({ block: "start" });
  }, []);
  useEffect(() => {
    // Without the visitors' table nothing above the search block is left to load.
    if (webDenied) landOnSearch();
  }, [webDenied, landOnSearch]);
  useEffect(() => {
    // A filtered link (`…?device=mobile#traffic`) opens on the table it filters. Once, when the tab arrives.
    if (window.location.hash === `#${TRAFFIC_ANCHOR}`) document.getElementById(TRAFFIC_ANCHOR)?.scrollIntoView({ block: "start" });
  }, []);

  // ----------------------------------------------------------- KPI strip --
  const kpis = sales.kpis;
  // «عن الفترة اللي قبلها» is the card's own default; the other comparison is named.
  const deltaLabel = range.compare === "year" ? t.vsYear : undefined;
  const before = web?.comparison;

  // More orders than counted visits: the rate is not a rate (see `conversionKnown`), so no figure and no chip.
  const conversionOk = conversionKnown(kpis.conversionRate.value);
  const conversionCard = (
    <KpiCard
      key="conversion"
      label={t.conversion}
      value={formatConversion(kpis.conversionRate.value)}
      deltaBasisPoints={conversionOk ? deltaBasisPoints(kpis.conversionRate.value, kpis.conversionRate.previous) : undefined}
      deltaLabel={deltaLabel}
      hint={conversionOk || kpis.conversionRate.value === null ? t.conversionHint : t.conversionOver}
    />
  );

  let cards: ReactNode[];
  if (stats.loading) {
    cards = [
      <KpiCard key="visitors" label={t.visitors} value={null} loading />,
      <KpiCard key="visits" label={t.visits} value={null} loading />,
      conversionCard,
      <KpiCard key="bounce" label={t.bounce} value={null} loading />,
      <KpiCard key="duration" label={t.duration} value={null} loading />,
    ];
  } else if (web) {
    cards = [
      <KpiCard
        key="visitors"
        label={t.visitors}
        value={formatCount(web.visitors)}
        deltaBasisPoints={deltaBasisPoints(web.visitors, before?.visitors)}
        deltaLabel={deltaLabel}
        hint={t.visitorsHint}
      />,
      <KpiCard
        key="visits"
        label={t.visits}
        value={formatCount(web.visits)}
        deltaBasisPoints={deltaBasisPoints(web.visits, before?.visits)}
        deltaLabel={deltaLabel}
        hint={t.visitsHint}
      />,
      conversionCard,
      <KpiCard
        key="bounce"
        label={t.bounce}
        value={formatRate(web.bounceRate)}
        deltaBasisPoints={deltaBasisPoints(web.bounceRate, before?.bounceRate)}
        deltaLabel={deltaLabel}
        // Fewer visitors leaving at once is the good news.
        goodWhen="down"
        hint={t.bounceHint}
      />,
      <KpiCard
        key="duration"
        label={t.duration}
        value={duration(web.avgVisitTime)}
        deltaBasisPoints={deltaBasisPoints(web.avgVisitTime, before?.avgVisitTime)}
        deltaLabel={deltaLabel}
        hint={t.durationHint}
      />,
    ];
  } else {
    // The web analytics were refused or failed: the sales report's own count of who came in stands in.
    cards = [
      <KpiCard
        key="entered"
        label={t.entered}
        value={formatCount(kpis.sessions.value)}
        deltaBasisPoints={deltaBasisPoints(kpis.sessions.value, kpis.sessions.previous)}
        deltaLabel={deltaLabel}
        hint={t.enteredHint}
      />,
      conversionCard,
    ];
  }

  // ------------------------------------------- the funnel and its sentence --
  const stepLabels: Record<ReportsFunnelStepKey, string> = {
    sessions: t.step_sessions,
    product: t.step_product,
    cart: t.step_cart,
    checkout: t.step_checkout,
    purchase: t.step_purchase,
  };
  const entered = sales.funnel.find((step) => step.step === "sessions")?.sessions ?? kpis.sessions.value ?? 0;
  // The rule is written out in store/model.ts (MIN_SESSIONS, HEALTHY_RATE, WORSE_BY).
  const leak = entered >= MIN_SESSIONS ? findLeak(sales.funnel) : null;
  const leaking = leak !== null && leak.rate < HEALTHY_RATE;

  const leakText: Record<FunnelLeakStep, string> = {
    product: t.leak_product,
    cart: t.leak_cart,
    checkout: t.leak_checkout,
    purchase: t.leak_purchase,
  };
  // What to do about a leak, at the page where it is done.
  const leakAction: Record<FunnelLeakStep, ReportTakeawayAction> = {
    product: { label: t.act_product, to: "/website" },
    cart: { label: t.act_cart, to: "/catalog" },
    checkout: { label: t.act_checkout, to: "/shipping" },
    purchase: { label: t.act_purchase, to: "/abandoned-carts" },
  };

  let tone: ReportTone = "info";
  let sentence: string;
  let action: ReportTakeawayAction | undefined;
  if (entered < MIN_SESSIONS) {
    // Too thin to say anything: say that, with the number it rests on.
    sentence = entered <= 0 ? t.thinNone : fmt(t.thin, { n: entered, min: MIN_SESSIONS });
  } else if (!leak) {
    sentence = t.thinSteps;
  } else if (leak.rate >= HEALTHY_RATE) {
    const share = outOf(leak.rate);
    tone = "good";
    sentence = fmt(t.healthy, { step: stepLabels[leak.step], n: share.n, of: share.of });
  } else {
    const share = outOf(leak.rate);
    const kept = share.n === 0 ? t.keptNone : fmt(t.keptSome, { n: share.n });
    // The same step in the comparison period, when there is one and it reads differently.
    let was = "";
    if (leak.previousRate !== null) {
      const earlier = outOf(leak.previousRate);
      if (earlier.n !== share.n || earlier.of !== share.of) {
        was = ` ${fmt(range.compare === "year" ? t.wasYear : t.wasPrevious, { n: earlier.n, of: earlier.of })}`;
      }
    }
    sentence = fmt(leakText[leak.step], { of: share.of, kept, was });
    tone = leak.previousRate !== null && leak.rate <= leak.previousRate * (1 - WORSE_BY) ? "bad" : "warn";
    action = leakAction[leak.step];
  }

  // ------------------------------------------------------------- links --
  const here = new URLSearchParams(location.search);
  const carried = new URLSearchParams();
  for (const key of RANGE_PARAMS) {
    const value = here.get(key);
    if (value) carried.set(key, value);
  }
  const rangeSearch = carried.toString() ? `?${carried.toString()}` : "";
  const links: ReportLinkItem[] = [
    { to: REPORT_TAB_PATHS.now, title: t.linkNow, description: t.linkNowHint, icon: IconRealtime },
    { to: `${REPORT_TAB_PATHS.ads}${rangeSearch}`, title: t.linkAds, description: t.linkAdsHint, icon: IconAnnounce },
    { to: "/website", title: t.linkWebsite, description: t.linkWebsiteHint, icon: IconWebsite },
    { to: "/abandoned-carts", title: t.linkLost, description: t.linkLostHint, icon: IconLostOrders },
    { to: "/funnels", title: t.linkFunnels, description: t.linkFunnelsHint, icon: IconFunnels },
    { to: "/search-synonyms", title: t.linkSynonyms, description: t.linkSynonymsHint, icon: IconSynonyms },
  ];

  return (
    <>
      <ReportKpiStrip sparkline={false}>{cards}</ReportKpiStrip>

      {/* handoff 333: the plan gate on website traffic names the feature and leads to the plans. */}
      {gatedFeature && (
        <Card className="min-w-0 gap-0 px-4 py-3">
          <PlanFeatureNotice feature={gatedFeature} />
        </Card>
      )}

      {Boolean(stats.error) && !webDenied && (
        <Card className="min-w-0 gap-0 px-4 py-3">
          <RetryLine message={t.webFailed} onRetry={stats.retry} />
        </Card>
      )}

      <ReportChartCard title={t.funnelTitle} note={t.funnelNote} empty={entered <= 0 ? t.funnelEmpty : null}>
        {(height) => <StoreFunnel steps={sales.funnel} height={height} leak={leak && leaking ? leak.step : null} labels={stepLabels} />}
      </ReportChartCard>

      {!webDenied && (
        <TrafficBlock
          workspaceId={workspaceId}
          range={range}
          filters={filters}
          visitors={web ? web.visitors : null}
          scoped={scoped}
          onFilter={addFilter}
          onRemove={removeFilter}
          onClear={clearFilters}
          onSettled={landOnSearch}
        />
      )}

      <ReportTakeaway tone={tone} action={action}>
        {sentence}
      </ReportTakeaway>

      <ReportMore>
        <AccordionSection title={t.moreFunnel} summary={t.moreFunnelSummary} icon={IconFlow} flush>
          <FunnelNumbers sales={sales} range={range} stepLabels={stepLabels} />
        </AccordionSection>
        {!webDenied && (
          <AccordionSection title={t.moreTime} summary={t.moreTimeSummary} icon={IconChartLine} flush>
            <TimeBody
              workspaceId={workspaceId}
              range={range}
              filters={filters}
              filterText={filterText}
              sales={sales}
              stats={hasFilters ? scoped.data : web}
            />
          </AccordionSection>
        )}
        {!webDenied && (
          <AccordionSection title={t.moreWeekly} summary={t.moreWeeklySummary} icon={IconCalendar} flush>
            <WeeklyBody workspaceId={workspaceId} range={range} filters={filters} filterText={filterText} />
          </AccordionSection>
        )}
        <AccordionSection title={t.moreDevices} summary={t.moreDevicesSummary} icon={IconDevices} flush>
          <DevicesBody sales={sales} range={range} />
        </AccordionSection>
        <AccordionSection title={t.moreChannels} summary={t.moreChannelsSummary} icon={IconAttribution} flush>
          <ChannelsBody sales={sales} range={range} />
        </AccordionSection>
        <AccordionSection title={t.moreLanding} summary={t.moreLandingSummary} icon={IconPage} flush>
          <LandingBody workspaceId={workspaceId} range={range} />
        </AccordionSection>
        {!webDenied && (
          <AccordionSection title={t.moreEvents} summary={t.moreEventsSummary} icon={IconClick} flush>
            <EventsBody workspaceId={workspaceId} range={range} filters={filters} filterText={filterText} />
          </AccordionSection>
        )}
        {/* The old `/analytics/search` screen. Its id is what that address lands on. */}
        <AccordionSection id={SEARCH_ANCHOR} title={searchWords.title} summary={searchWords.description} icon={IconSearch} flush>
          <SearchBody workspaceId={workspaceId} range={range} />
        </AccordionSection>
      </ReportMore>

      <ReportLinks items={links} />
    </>
  );
}

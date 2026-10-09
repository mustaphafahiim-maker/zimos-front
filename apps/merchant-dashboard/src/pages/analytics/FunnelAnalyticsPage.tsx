import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { FunnelAnalyticsSource, FunnelAnalyticsStep } from "@store-builder/api-client";
import { Card } from "@store-builder/ui";
import { IconCash, IconFlow, IconOrders, IconPercent, IconTarget } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/KpiCard";
import { ComparisonLineChart } from "@/components/charts";
import { RangeSwitch } from "@/components/RangeSwitch";
import {
  ReportChartCard,
  ReportKpiStrip,
  ReportLegend,
  ReportTable,
  ReportTabState,
  ReportTakeaway,
  formatConversion,
  type ReportColumn,
} from "@/components/report";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, formatPercentValue } from "@/lib/format";
import { formatAxisDate, formatCount, formatWindow, percentToRatio, rangeWindows, type AnalyticsRange } from "@/lib/analytics";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { STEP_TYPE_LABELS } from "@/pages/funnels/FunnelEditorPage.strings";
import { ReportCurrencySelect, useReportMoney } from "@/lib/reportCurrency";

/**
 * A funnel's report (/analytics/funnels/:funnelId), on the report kit: the
 * figures that matter, one sentence that says where most people leave, the
 * funnel step by step as bars, one table per step with CSV, then the days and
 * the traffic sources. One request, as before: the funnel's analytics detail
 * for the chosen period.
 */

const STRINGS = {
  en: {
    back: "Edit funnel",
    titleFallback: "Funnel report",
    description: "How visitors move through this funnel, counted from its real sessions and orders.",
    visits: "Visits to the first step",
    visitsHint: "Sessions that started the funnel: {n}",
    orders: "Orders",
    ordersHint: "Of them, offers after the order: {n}",
    conversion: "Conversion",
    conversionHint: "Sessions that ordered: {done} of {all}",
    revenue: "Revenue",
    revenueHint: "Of it, offers after the order: {amount}",
    epc: "Earnings per visit",
    epcHint: "Revenue ÷ sessions",
    takeLeave: "Most people leave at «{step}»: {n} of the {reached} who reached it ({pct}). Start by improving that step.",
    takeNone: "Nobody is stuck in the middle of the funnel in this period.",
    openFunnel: "Open the funnel",
    stepsTitle: "Step by step",
    stepsDesc: "How many sessions reached each step, and how many stopped there. The numbers are for the published funnel: a step added since the last publish shows after you publish again.",
    stepLine: "{i}. {name}",
    ofSessions: "{pct} of sessions",
    leftHere: "Left here: {n} ({pct})",
    legendOn: "Moved on",
    legendLeft: "Left here",
    tableTitle: "Each step in numbers",
    tableNote: "Whether a shopper took an offer after the order is not counted per step yet; the total of offers taken above is right.",
    colStep: "Step",
    colType: "Type",
    colVisits: "Visits",
    colMovedOn: "Moved on",
    colMovedRate: "Moved on %",
    colConversions: "Conversions",
    colConversionsHint: "Orders on an order form or a sales page, sign-ups on an opt-in page.",
    colConversionRate: "Conversion %",
    colReach: "Reached",
    colReachHint: "Out of all the sessions that started the funnel.",
    colDropped: "Stopped here",
    colViews: "Page views",
    colOptIns: "Sign-ups",
    notYet: "Not available yet",
    sourcesTitle: "Traffic sources",
    sourcesDesc: "From the UTM tags on the link visitors arrived with.",
    colSource: "Source",
    colMedium: "Medium · campaign",
    colSessions: "Sessions",
    colOrders: "Orders",
    colRevenue: "Revenue",
    direct: "Direct / untagged",
    noSources: "No tagged visits in this period",
    overTime: "Sessions and orders over time",
    overTimeDesc: "Per day, across the period.",
    sessions: "Sessions",
    noSessions: "No sessions in this period",
    noSessionsDesc: "Share the funnel link — the numbers start with the first visitor.",
  },
  ar: {
    back: "ارجع للفانل",
    titleFallback: "تقرير الفانل",
    description: "الزوار بيمشوا إزاي جوّه الفانل ده، محسوبة من جلساته وأوردراته الحقيقية.",
    visits: "زيارات أول خطوة",
    visitsHint: "جلسات بدأت الفانل: {n}",
    orders: "الأوردرات",
    ordersHint: "منها عروض بعد الشراء: {n}",
    conversion: "نسبة التحويل",
    conversionHint: "جلسات طلبت: {done} من {all}",
    revenue: "الإيراد",
    revenueHint: "منه عروض بعد الشراء: {amount}",
    epc: "الإيراد لكل زيارة",
    epcHint: "الإيراد ÷ الجلسات",
    takeLeave: "أكتر ناس بتمشي عند «{step}»: {n} من {reached} وصلوها ({pct}). ابدأ بتحسين الخطوة دي.",
    takeNone: "مفيش حد واقف في نص الفانل في الفترة دي.",
    openFunnel: "افتح الفانل",
    stepsTitle: "خطوة بخطوة",
    stepsDesc: "كام جلسة وصلت كل خطوة، وكام وقفت عندها. الأرقام للفانل المنشور: الخطوة اللي اتضافت بعد آخر نشر هتظهر لما تنشر تاني.",
    stepLine: "{i}. {name}",
    ofSessions: "{pct} من الجلسات",
    leftHere: "مشيوا من هنا: {n} ({pct})",
    legendOn: "كمّلوا",
    legendLeft: "مشيوا من هنا",
    tableTitle: "كل خطوة بالأرقام",
    tableNote: "قبول العرض بعد الشراء لسه مش بيتحسب لكل خطوة؛ إجمالي العروض المقبولة فوق مظبوط.",
    colStep: "الخطوة",
    colType: "النوع",
    colVisits: "الزيارات",
    colMovedOn: "كمّلوا",
    colMovedRate: "نسبة اللي كمّلوا",
    colConversions: "التحويلات",
    colConversionsHint: "أوردرات في فورم الأوردر أو صفحة البيع، وتسجيلات في صفحة جمع البيانات.",
    colConversionRate: "نسبة التحويل",
    colReach: "وصلوا",
    colReachHint: "من كل الجلسات اللي بدأت الفانل.",
    colDropped: "وقفوا هنا",
    colViews: "مشاهدات الصفحة",
    colOptIns: "التسجيلات",
    notYet: "لسه مش متاح",
    sourcesTitle: "الزيارات جاية منين",
    sourcesDesc: "من وسوم UTM في الرابط اللي الزائر جه منه.",
    colSource: "المصدر",
    colMedium: "الوسيط · الحملة",
    colSessions: "الجلسات",
    colOrders: "الأوردرات",
    colRevenue: "الإيراد",
    direct: "مباشر / من غير وسم",
    noSources: "مفيش زيارات موسومة في الفترة دي",
    overTime: "الجلسات والأوردرات يوم بيوم",
    overTimeDesc: "كل يوم لوحده، على مدار الفترة.",
    sessions: "الجلسات",
    noSessions: "مفيش جلسات في الفترة دي",
    noSessionsDesc: "شارك رابط الفانل — الأرقام بتبدأ مع أول زائر.",
  },
} satisfies Messages;

/**
 * What the backend sends per step beyond the typed fields (analytics/funnelStepMetrics.js);
 * the api-client's `FunnelAnalyticsStep` does not list them yet.
 */
type StepMetrics = FunnelAnalyticsStep & {
  visits?: number;
  views?: number;
  movedOn?: number;
  ctr?: number | null;
  conversions?: number | null;
  cr?: number | null;
  optIns?: number | null;
};
type StepRow = StepMetrics & { index: number };
type SourceRow = FunnelAnalyticsSource & { index: number };

/** Revenue ÷ sessions, sent beside the typed totals (null with no sessions, absent on an older backend). */
const epcOf = (data: unknown): number | null => {
  const v = (data as { epc?: unknown } | null)?.epc;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/**
 * The offer steps. Their conversions come back as 0 whatever happened (the
 * backend counts a result it never writes), so they are not shown as numbers.
 */
const OFFER_STEPS: ReadonlySet<string> = new Set(["upsell", "downsell"]);

export function FunnelAnalyticsPage() {
  const t = useT(STRINGS);
  // The funnel editor's own names for step types, so both screens agree.
  const stepTypes: Record<string, string | undefined> = STEP_TYPE_LABELS[useLocale().locale];
  const workspaceId = useWorkspaceId();
  const { funnelId = "" } = useParams();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const detail = useAsync(
    () => apiClient.getFunnelAnalyticsDetail(workspaceId, funnelId, rangeWindows(range).current),
    [workspaceId, funnelId, range]
  );

  const data = detail.data;
  const currency = data?.currency ?? "EGP";
  // In the report currency the teammate picked (lib/reportCurrency.tsx).
  const inReport = useReportMoney();
  const moneyText = (value: number) => formatMoney(...inReport(value, currency));
  const money = (value: number) => <bdi dir="ltr">{moneyText(value)}</bdi>;
  const count = (value: number) => <bdi dir="ltr">{formatCount(value)}</bdi>;
  const rate = (percent: number | null) => formatPercentValue(percentToRatio(percent), 0);
  const typeLabel = (stepType: string) => stepTypes[stepType] ?? stepType;

  const steps = useMemo<StepRow[]>(() => ((data?.steps ?? []) as StepMetrics[]).map((step, index) => ({ ...step, index })), [data]);
  const sources = useMemo<SourceRow[]>(() => (data?.sources ?? []).map((source, index) => ({ ...source, index })), [data]);
  const sessions = data?.sessions ?? 0;
  const epc = epcOf(data);
  const firstVisits = steps[0] ? (num(steps[0].visits) ?? steps[0].reached) : sessions;
  // Where most people leave: the step the most sessions are sitting on without an order.
  const leak = steps.reduce<StepRow | null>((worst, step) => (step.dropped > (worst?.dropped ?? 0) ? step : worst), null);
  const exportRange = data ? { fromDay: data.range.from.slice(0, 10), toDay: data.range.to.slice(0, 10) } : undefined;

  const dash = <span className="text-ink-soft">—</span>;
  const notYet = <span className="text-xs font-normal text-ink-soft">{t.notYet}</span>;

  const stepColumns: ReadonlyArray<ReportColumn<StepRow>> = [
    {
      key: "step",
      header: t.colStep,
      cell: (row) => <span dir="auto">{row.name}</span>,
      sortValue: (row) => row.index,
      csv: (row) => row.name,
    },
    { key: "type", header: t.colType, cell: (row) => typeLabel(row.stepType), csv: (row) => typeLabel(row.stepType), hideBelow: "md" },
    {
      key: "visits",
      header: t.colVisits,
      align: "end",
      cell: (row) => count(num(row.visits) ?? row.reached),
      sortValue: (row) => num(row.visits) ?? row.reached,
    },
    {
      key: "movedOn",
      header: t.colMovedOn,
      align: "end",
      cell: (row) => (num(row.movedOn) === null ? dash : count(num(row.movedOn) ?? 0)),
      sortValue: (row) => num(row.movedOn),
    },
    {
      key: "movedRate",
      header: t.colMovedRate,
      align: "end",
      hideBelow: "md",
      cell: (row) => (num(row.ctr) === null ? dash : <bdi dir="ltr">{formatPercentValue(percentToRatio(num(row.ctr)))}</bdi>),
      sortValue: (row) => num(row.ctr),
    },
    {
      key: "conversions",
      header: t.colConversions,
      hint: t.colConversionsHint,
      align: "end",
      cell: (row) => (OFFER_STEPS.has(row.stepType) ? notYet : num(row.conversions) === null ? dash : count(num(row.conversions) ?? 0)),
      sortValue: (row) => (OFFER_STEPS.has(row.stepType) ? null : num(row.conversions)),
      csv: (row) => (OFFER_STEPS.has(row.stepType) ? null : num(row.conversions)),
    },
    {
      key: "conversionRate",
      header: t.colConversionRate,
      align: "end",
      hideBelow: "md",
      cell: (row) =>
        OFFER_STEPS.has(row.stepType) ? notYet : num(row.cr) === null ? dash : <bdi dir="ltr">{formatPercentValue(percentToRatio(num(row.cr)))}</bdi>,
      sortValue: (row) => (OFFER_STEPS.has(row.stepType) ? null : num(row.cr)),
      csv: (row) => (OFFER_STEPS.has(row.stepType) ? null : num(row.cr)),
    },
    {
      key: "reach",
      header: t.colReach,
      hint: t.colReachHint,
      align: "end",
      cell: (row) => (row.reachRate === null ? dash : <bdi dir="ltr">{rate(row.reachRate)}</bdi>),
      sortValue: (row) => row.reachRate,
    },
    { key: "dropped", header: t.colDropped, align: "end", cell: (row) => count(row.dropped), sortValue: (row) => row.dropped },
    {
      key: "views",
      header: t.colViews,
      align: "end",
      hideBelow: "lg",
      cell: (row) => (num(row.views) === null ? dash : count(num(row.views) ?? 0)),
      sortValue: (row) => num(row.views),
    },
    {
      key: "optIns",
      header: t.colOptIns,
      align: "end",
      hideBelow: "lg",
      cell: (row) => (num(row.optIns) === null ? dash : count(num(row.optIns) ?? 0)),
      sortValue: (row) => num(row.optIns),
    },
  ];

  const sourceColumns: ReadonlyArray<ReportColumn<SourceRow>> = [
    {
      key: "source",
      header: t.colSource,
      cell: (row) => <span dir="ltr">{row.source === "direct" ? t.direct : row.source}</span>,
      sortValue: (row) => row.source,
      csv: (row) => (row.source === "direct" ? t.direct : row.source),
    },
    {
      key: "medium",
      header: t.colMedium,
      cell: (row) => (row.medium || row.campaign ? <span dir="ltr">{[row.medium, row.campaign].filter(Boolean).join(" · ")}</span> : dash),
      csv: (row) => [row.medium, row.campaign].filter(Boolean).join(" · "),
    },
    { key: "sessions", header: t.colSessions, align: "end", cell: (row) => count(row.sessions), sortValue: (row) => row.sessions },
    { key: "orders", header: t.colOrders, align: "end", cell: (row) => count(row.orders), sortValue: (row) => row.orders },
    {
      key: "revenue",
      header: t.colRevenue,
      align: "end",
      cell: (row) => money(row.revenue),
      sortValue: (row) => row.revenue,
      csv: (row) => moneyText(row.revenue),
    },
  ];

  return (
    <div className="min-w-0 max-w-7xl">
      <PageHeader
        back={{ to: `/funnels/${funnelId}`, label: t.back }}
        title={data?.funnel.name ?? t.titleFallback}
        description={t.description}
        actions={
          <>
            <ReportCurrencySelect />
            <RangeSwitch value={range} onChange={setRange} compare={false} />
          </>
        }
      />

      <ReportTabState loading={detail.loading && !data} error={detail.error} onRetry={() => void detail.refresh()}>
        {data && (
          <div className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
            <p className="text-xs text-ink-soft">{formatWindow(data.range.from, data.range.to)}</p>

            <ReportKpiStrip sparkline={false}>
              <KpiCard label={t.visits} icon={<IconFlow />} value={count(firstVisits)} hint={fmt(t.visitsHint, { n: formatCount(data.sessions) })} />
              <KpiCard label={t.orders} icon={<IconOrders />} value={count(data.orders)} hint={fmt(t.ordersHint, { n: formatCount(data.upsellOrders) })} />
              <KpiCard
                label={t.conversion}
                icon={<IconPercent />}
                value={<bdi dir="ltr">{formatConversion(data.conversionRate)}</bdi>}
                hint={fmt(t.conversionHint, { done: formatCount(data.completed), all: formatCount(data.sessions) })}
              />
              <KpiCard label={t.revenue} icon={<IconCash />} value={money(data.revenue)} hint={fmt(t.revenueHint, { amount: moneyText(data.upsellRevenue) })} />
              {epc !== null && <KpiCard label={t.epc} icon={<IconTarget />} value={money(epc)} hint={t.epcHint} />}
            </ReportKpiStrip>

            {data.sessions === 0 ? (
              <EmptyState icon={<IconFlow />} title={t.noSessions} description={t.noSessionsDesc} />
            ) : (
              <>
                {leak ? (
                  <ReportTakeaway tone="warn" action={{ label: t.openFunnel, to: `/funnels/${funnelId}` }}>
                    {fmt(t.takeLeave, {
                      step: leak.name,
                      n: formatCount(leak.dropped),
                      reached: formatCount(leak.reached),
                      pct: formatPercentValue(leak.reached > 0 ? leak.dropped / leak.reached : null, 0),
                    })}
                  </ReportTakeaway>
                ) : (
                  <ReportTakeaway tone="info">{t.takeNone}</ReportTakeaway>
                )}

                <Card data-slot="funnel-report-steps" className="min-w-0 gap-0 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <h3 className="text-[15px] leading-6 font-semibold text-ink">{t.stepsTitle}</h3>
                      <p className="mt-0.5 text-[13px] leading-5 text-pretty text-ink-soft">{t.stepsDesc}</p>
                    </div>
                    <ReportLegend
                      items={[
                        { label: t.legendOn, swatch: "primary" },
                        { label: t.legendLeft, swatch: "danger" },
                      ]}
                    />
                  </div>
                  <ol className="mt-4 space-y-4">
                    {steps.map((step) => {
                      const share = sessions > 0 ? Math.min(1, step.reached / sessions) : 0;
                      const left = sessions > 0 ? Math.min(share, step.dropped / sessions) : 0;
                      return (
                        <li key={step.key} className="min-w-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0 truncate text-sm font-medium text-ink" dir="auto">
                              {fmt(t.stepLine, { i: step.index + 1, name: step.name })}
                            </span>
                            <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{count(step.reached)}</span>
                          </div>
                          {/* The bar: how far along the sessions this step got; its tail is the part that stopped here. */}
                          <div aria-hidden data-slot="funnel-report-bar" className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full bg-paper-sunken">
                            <span className="h-full bg-primary" style={{ width: `${((share - left) * 100).toFixed(2)}%` }} />
                            <span data-slot="funnel-report-left" className="h-full bg-danger/70" style={{ width: `${(left * 100).toFixed(2)}%` }} />
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs leading-5">
                            <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-ink-soft">
                              <span className="rounded-full bg-paper-sunken px-2 font-medium">{typeLabel(step.stepType)}</span>
                              <span>{fmt(t.ofSessions, { pct: formatPercentValue(share, 0) })}</span>
                            </span>
                            {step.dropped > 0 && (
                              <span className="font-medium text-danger">
                                {fmt(t.leftHere, {
                                  n: formatCount(step.dropped),
                                  pct: formatPercentValue(step.reached > 0 ? step.dropped / step.reached : null, 0),
                                })}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Card>

                <ReportTable<StepRow>
                  columns={stepColumns}
                  rows={steps}
                  rowKey={(row) => row.key}
                  exportName="zimos-funnel-steps"
                  range={exportRange}
                  caption={t.tableTitle}
                  note={t.tableNote}
                  pageSize={12}
                />

                <ReportChartCard
                  title={t.overTime}
                  note={t.overTimeDesc}
                  legend={
                    <ReportLegend
                      items={[
                        { label: t.sessions, swatch: "primary" },
                        { label: t.orders, swatch: "neutral", dashed: true },
                      ]}
                    />
                  }
                  empty={data.series.length === 0 ? t.noSessions : null}
                >
                  {(height) => (
                    <div dir="ltr">
                      <ComparisonLineChart
                        height={height}
                        summary={t.overTimeDesc}
                        points={data.series.map((d) => ({
                          label: formatAxisDate(d.date),
                          value: d.sessions,
                          previous: d.orders,
                          previousLabel: t.orders,
                        }))}
                        format={(v) => formatCount(v)}
                        formatAxis={(v) => formatCount(Math.round(v))}
                        currentLabel={t.sessions}
                        previousLabel={t.orders}
                      />
                    </div>
                  )}
                </ReportChartCard>

                <ReportTable<SourceRow>
                  columns={sourceColumns}
                  rows={sources}
                  rowKey={(row) => `${row.index}-${row.source}`}
                  exportName="zimos-funnel-sources"
                  range={exportRange}
                  caption={t.sourcesTitle}
                  note={t.sourcesDesc}
                  empty={t.noSources}
                />
              </>
            )}
          </div>
        )}
      </ReportTabState>
    </div>
  );
}

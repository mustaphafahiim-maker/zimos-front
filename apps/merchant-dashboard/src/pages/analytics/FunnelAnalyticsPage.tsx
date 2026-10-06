import { FunnelPagePerformance, type StepPerformance } from "./FunnelPagePerformance";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Workflow } from "lucide-react";
import {
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { ComparisonLineChart } from "@/components/charts";
import { RangeSwitch } from "@/components/RangeSwitch";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, formatPercentValue } from "@/lib/format";
import { formatAxisDate, formatCount, formatWindow, percentToRatio, rangeWindows, type AnalyticsRange } from "@/lib/analytics";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { STEP_TYPE_LABELS } from "@/pages/funnels/FunnelEditorPage.strings";
import { ReportCurrencySelect, useReportMoney } from "@/lib/reportCurrency";

const STRINGS = {
  en: {
    back: "Funnels",
    description: "How visitors move through this funnel, counted from its real sessions and orders.",
    editFunnel: "Edit funnel",
    sessions: "Sessions",
    sessionsHint: "Visitors who started the funnel",
    completed: "Checkouts",
    completedHint: "Sessions that completed a checkout",
    conversion: "Conversion",
    conversionHint: "Checkouts ÷ sessions",
    epc: "EPC",
    epcHint: "Earnings per visitor: revenue ÷ sessions",
    orders: "Orders",
    revenue: "Revenue",
    upsellOrders: "Upsells taken",
    upsellRevenue: "Upsell revenue",
    stepsTitle: "Step by step",
    stepsDesc: "How many sessions reached each step, and how many stopped there.",
    colStep: "Step",
    colReached: "Reached",
    colDropped: "Stopped here",
    ofSessions: "{pct} of sessions",
    sourcesTitle: "Traffic sources",
    sourcesDesc: "From the UTM tags on the link visitors arrived with.",
    colSource: "Source",
    colSessions: "Sessions",
    colOrders: "Orders",
    colRevenue: "Revenue",
    direct: "Direct / untagged",
    noSources: "No sessions in this period",
    overTime: "Sessions and orders over time",
    overTimeDesc: "Per day, across the period.",
    sessionsCount: "{n} sessions",
    ordersCount: "{n} orders",
    noSessions: "No sessions in this period",
    noSessionsDesc: "Share the funnel link — the numbers start with the first visitor.",
  },
  ar: {
    back: "مسارات البيع",
    description: "كيف يتنقّل الزوار داخل هذا المسار، محسوبًا من جلساته وطلباته الفعلية.",
    editFunnel: "تعديل المسار",
    sessions: "الجلسات",
    sessionsHint: "الزوار الذين بدأوا المسار",
    completed: "الطلبات المكتملة",
    completedHint: "الجلسات التي أتمّت الدفع",
    epc: "العائد لكل زائر",
    epcHint: "الإيرادات ÷ الجلسات",
    conversion: "معدل التحويل",
    conversionHint: "الطلبات ÷ الجلسات",
    orders: "الطلبات",
    revenue: "الإيراد",
    upsellOrders: "العروض الإضافية المقبولة",
    upsellRevenue: "إيراد العروض الإضافية",
    stepsTitle: "خطوة بخطوة",
    stepsDesc: "عدد الجلسات التي وصلت إلى كل خطوة، وعدد التي توقفت عندها.",
    colStep: "الخطوة",
    colReached: "وصلوا",
    colDropped: "توقفوا هنا",
    ofSessions: "{pct} من الجلسات",
    sourcesTitle: "مصادر الزيارات",
    sourcesDesc: "من وسوم UTM في الرابط الذي جاء منه الزائر.",
    colSource: "المصدر",
    colSessions: "الجلسات",
    colOrders: "الطلبات",
    colRevenue: "الإيراد",
    direct: "مباشر / بلا وسم",
    noSources: "مفيش جلسات في هذه الفترة",
    overTime: "الجلسات والطلبات عبر الزمن",
    overTimeDesc: "يومًا بيوم، على مدار الفترة.",
    sessionsCount: "{n} جلسة",
    ordersCount: "{n} طلب",
    noSessions: "مفيش جلسات في هذه الفترة",
    noSessionsDesc: "شارك رابط المسار — تبدأ الأرقام بالظهور مع أول زائر.",
  },
} satisfies Messages;


/** Revenue ÷ sessions, from funnel analytics (null with no sessions). */
const epcOf = (data: unknown): number | null => {
  const v = (data as { epc?: unknown }).epc;
  return typeof v === "number" ? v : null;
};

function Tile({ label, hint, value }: { label: string; hint?: string; value: ReactNode }) {
  return (
    <Card className="gap-0 p-4">
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <p className="tabular-nums mt-1 text-xl font-semibold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
    </Card>
  );
}

function Panel({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("min-w-0 gap-0 p-4", className)}>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {description && <p className="mb-3 text-xs text-ink-soft">{description}</p>}
      {children}
    </Card>
  );
}

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
  const money = (value: number) => <bdi dir="ltr">{formatMoney(...inReport(value, currency))}</bdi>;
  const count = (value: number) => <bdi dir="ltr">{formatCount(value)}</bdi>;
  const percent = (value: number | null) => <bdi dir="ltr">{formatPercentValue(percentToRatio(value))}</bdi>;

  return (
    <div className="min-w-0 max-w-7xl">
      <PageHeader
        back={{ to: "/funnels", label: t.back }}
        title={data?.funnel.name ?? "…"}
        description={t.description}
        actions={
          <>
            <ReportCurrencySelect />
            <RangeSwitch value={range} onChange={setRange} />
            {data && (
              <Link to={`/funnels/${data.funnel.id}`} className="text-sm font-medium text-primary hover:underline">
                {t.editFunnel}
              </Link>
            )}
          </>
        }
      />

      <DataState loading={detail.loading && !data} error={detail.error} onRetry={() => detail.refresh()}>
        {data && (
          <div className="space-y-4">
            <p className="text-xs text-ink-soft">{formatWindow(data.range.from, data.range.to)}</p>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
              <Tile label={t.sessions} hint={t.sessionsHint} value={count(data.sessions)} />
              <Tile label={t.completed} hint={t.completedHint} value={count(data.completed)} />
              <Tile label={t.conversion} hint={t.conversionHint} value={percent(data.conversionRate)} />
              <Tile label={t.orders} value={count(data.orders)} />
              <Tile label={t.revenue} value={money(data.revenue)} />
              <Tile label={t.epc} hint={t.epcHint} value={epcOf(data) == null ? "—" : money(epcOf(data) as number)} />
              <Tile label={t.upsellOrders} value={count(data.upsellOrders)} />
              <Tile label={t.upsellRevenue} value={money(data.upsellRevenue)} />
            </div>

            {data.sessions === 0 ? (
              <EmptyState icon={<Workflow />} title={t.noSessions} description={t.noSessionsDesc} />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title={t.stepsTitle} description={t.stepsDesc} className="lg:col-span-2">
                  <ol className="space-y-3">
                    {data.steps.map((step, i) => {
                      const share = data.sessions > 0 ? step.reached / data.sessions : 0;
                      return (
                        <li key={step.key}>
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                            <span className="flex items-center gap-2 text-ink">
                              <span className="tabular-nums text-xs text-ink-soft">{i + 1}.</span>
                              <span dir="auto">{step.name}</span>
                              <span className="rounded-md bg-paper px-1.5 py-0.5 text-[11px] font-medium text-ink-soft">
                                {stepTypes[step.stepType] ?? step.stepType}
                              </span>
                            </span>
                            <span className="tabular-nums text-ink">
                              {count(step.reached)}
                              <span className="ms-2 text-xs text-ink-soft">
                                {fmt(t.ofSessions, { pct: formatPercentValue(share, 0) })}
                              </span>
                              {step.dropped > 0 && (
                                <span className="ms-2 text-xs text-danger">
                                  {t.colDropped}: {count(step.dropped)}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-paper">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(share * 100)}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Panel>

                <FunnelPagePerformance steps={data.steps as StepPerformance[]} count={count} percent={percent} />

                <Panel title={t.overTime} description={t.overTimeDesc}>
                  <div dir="ltr">
                    <ComparisonLineChart
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
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-soft">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="inline-block h-0.5 w-4 rounded bg-primary" />
                      {t.sessions}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="inline-block h-0 w-4 border-t-2 border-dashed border-line-strong" />
                      {t.orders}
                    </span>
                  </div>
                </Panel>

                <Panel title={t.sourcesTitle} description={t.sourcesDesc}>
                  {data.sources.length === 0 ? (
                    <p className="text-sm text-ink-soft">{t.noSources}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.colSource}</TableHead>
                          <TableHead className="text-end">{t.colSessions}</TableHead>
                          <TableHead className="text-end">{t.colOrders}</TableHead>
                          <TableHead className="text-end">{t.colRevenue}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.sources.map((s, i) => (
                          <TableRow key={`${s.source}-${s.medium}-${s.campaign}-${i}`}>
                            <TableCell>
                              <span className="block text-ink" dir="ltr">
                                {s.source === "direct" ? t.direct : s.source}
                              </span>
                              {(s.medium || s.campaign) && (
                                <span className="block text-xs text-ink-soft" dir="ltr">
                                  {[s.medium, s.campaign].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums text-end">{count(s.sessions)}</TableCell>
                            <TableCell className="tabular-nums text-end">{count(s.orders)}</TableCell>
                            <TableCell className="tabular-nums text-end">{money(s.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Panel>
              </div>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}

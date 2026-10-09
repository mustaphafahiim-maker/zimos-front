import { useSearchParams } from "react-router-dom";
import { Alert } from "@store-builder/ui";
import { ApiError, adminSiteTrafficSummary, type SiteTrafficRange, type SiteTrafficSummary } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { ChartAxis, HBarList } from "@/components/charts";
import { FilterChips } from "@/components/forms";
import { KpiCard } from "@/components/KpiCard";
import { Panel } from "@/components/Panel";
import { apiClient } from "@/lib/apiClient";
import { formatChartLabel, formatNumber, formatPercent } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

/**
 * Marketing-site traffic (handoff 339): visits, where they came from and how
 * many went on to sign up. Counted without identifying anyone.
 */

const RANGES: Array<{ value: SiteTrafficRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

function minutesSeconds(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function sourceLabel(source: string): string {
  return source === "direct" ? "Direct" : source;
}

/** Visits and unique visitors per day, as two lines on one scale. */
function DailyChart({ daily }: { daily: SiteTrafficSummary["daily"] }) {
  const w = 600;
  const h = 180;
  const padX = 8;
  const padY = 10;
  const max = Math.max(...daily.map((d) => Math.max(d.visits, d.uniqueVisitors)), 1);
  const step = (w - padX * 2) / Math.max(daily.length - 1, 1);
  const x = (i: number) => padX + i * step;
  const y = (v: number) => padY + (h - padY * 2) * (1 - v / max);
  const line = (pick: (d: SiteTrafficSummary["daily"][number]) => number) =>
    daily.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(pick(d)).toFixed(1)}`).join(" ");
  const series = [
    { label: "Visits", color: "var(--color-primary)", path: line((d) => d.visits) },
    { label: "Unique visitors", color: "var(--color-accent)", path: line((d) => d.uniqueVisitors) },
  ];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-ink-soft">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
        <span className="ms-auto tabular">Peak {formatNumber(max)}</span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: h }}
        role="img"
        aria-label="Visits and unique visitors per day"
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={w - padX}
            y1={padY + (h - padY * 2) * f}
            y2={padY + (h - padY * 2) * f}
            stroke="var(--color-line)"
            strokeDasharray="3 4"
            strokeWidth="1"
          />
        ))}
        {series.map((s) => (
          <path
            key={s.label}
            d={s.path}
            fill="none"
            stroke={s.color}
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {daily.map((d, i) => (
          <rect key={d.day} x={x(i) - step / 2} y={0} width={step} height={h} fill="transparent">
            <title>{`${formatChartLabel(d.day)}: ${formatNumber(d.visits)} visits, ${formatNumber(d.uniqueVisitors)} unique visitors`}</title>
          </rect>
        ))}
      </svg>
      <ChartAxis points={daily.map((d) => ({ label: formatChartLabel(d.day), value: d.visits }))} />
    </div>
  );
}

/** Visit → Clicked sign-up → Signed up, each with its share of the first step. */
function Funnel({ funnel }: { funnel: SiteTrafficSummary["funnel"] }) {
  const steps = [
    { label: "Visit", value: funnel.visit },
    { label: "Clicked sign-up", value: funnel.ctaClick },
    { label: "Signed up", value: funnel.signup },
  ];
  const first = funnel.visit;
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {steps.map((s, i) => {
        const share = first > 0 ? s.value / first : 0;
        return (
          <li key={s.label} className="rounded-[10px] border border-line bg-paper p-3">
            <p className="text-xs font-medium text-ink-soft">
              {i + 1}. {s.label}
            </p>
            <p className="tabular mt-1 text-xl font-semibold text-ink">{formatNumber(s.value)}</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line/60">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(share, 1) * 100}%` }} />
            </div>
            <p className="tabular mt-1 text-xs text-ink-soft">{first > 0 ? `${formatPercent(share * 100)} of visits` : "—"}</p>
          </li>
        );
      })}
    </ol>
  );
}

export function SiteTrafficPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("range");
  const range: SiteTrafficRange = raw === "7d" || raw === "30d" ? raw : "today";
  const { data, loading, error, refresh } = useAsync(() => adminSiteTrafficSummary(apiClient, range), [range]);

  const empty =
    !!data && data.visits === 0 && data.uniqueVisitors === 0 && data.funnel.visit === 0 && data.funnel.ctaClick === 0 && data.funnel.signup === 0;
  const shown = error
    ? new Error(error instanceof ApiError && error.status === 403 ? "This page needs a console permission" : "Something went wrong, try again")
    : null;

  return (
    <div>
      <PageHeader title="Site traffic" description="Visits to the marketing site, where they came from and how many signed up. No person is identified." />
      <FilterChips<SiteTrafficRange>
        className="mb-4"
        value={range}
        onChange={(r) => setParams(r === "today" ? {} : { range: r }, { replace: true })}
        options={RANGES}
      />
      <DataState loading={loading} error={shown} onRetry={() => void refresh()}>
        {data && (
          <div className="space-y-4">
            {!data.enabled && (
              <Alert variant="info">
                Site traffic collection is off on the server — these numbers are from before it was turned off
              </Alert>
            )}
            {empty ? (
              <EmptyBlock message="No visits in this period yet" />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <KpiCard label="Visits" value={formatNumber(data.visits)} />
                  <KpiCard label="Unique visitors" value={formatNumber(data.uniqueVisitors)} hint="A visitor is counted once per day" />
                  <KpiCard label="Average time on site" value={minutesSeconds(data.avgSecondsOnSite)} hint="Minutes : seconds" />
                </div>

                <Panel title="Funnel" description="Sessions that viewed a page, clicked a sign-up button, and signed up.">
                  <Funnel funnel={data.funnel} />
                </Panel>

                {data.daily.length > 1 && (
                  <Panel title="Per day" description="Days are UTC days.">
                    <DailyChart daily={data.daily} />
                  </Panel>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title="Top pages">
                    {data.topPages.length === 0 ? (
                      <p className="text-sm text-ink-soft">No page views in this period.</p>
                    ) : (
                      <HBarList
                        rows={data.topPages.map((p) => ({ label: p.path, value: p.visits }))}
                        format={(v) => `${formatNumber(v)} ${v === 1 ? "visit" : "visits"}`}
                      />
                    )}
                  </Panel>
                  <Panel title="Top sources">
                    {data.topSources.length === 0 ? (
                      <p className="text-sm text-ink-soft">No sessions in this period.</p>
                    ) : (
                      <HBarList
                        rows={data.topSources.map((s) => ({ label: sourceLabel(s.source), value: s.sessions }))}
                        format={(v) => `${formatNumber(v)} ${v === 1 ? "session" : "sessions"}`}
                        color="var(--color-accent)"
                      />
                    )}
                  </Panel>
                </div>
              </>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}

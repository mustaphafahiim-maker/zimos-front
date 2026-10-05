import { useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { BarChart, ChartAxis, HBarList } from "@/components/charts";
import { Panel } from "@/components/Panel";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import * as siteTrafficApi from "@/lib/siteTrafficApi";
import { SITE_TRAFFIC_RANGES, type SiteTrafficRange } from "@/lib/siteTrafficApi";
import { SITE_TRAFFIC_STRINGS, formatDuration } from "@/lib/siteTrafficStrings";
import { formatChartLabel, formatNumber } from "@/lib/format";

export function SiteTrafficPage() {
  const t = useT(SITE_TRAFFIC_STRINGS);
  const { locale } = useLocale();
  const [range, setRange] = useState<SiteTrafficRange>("7d");
  const { data, loading, error, refresh } = useAsync(() => siteTrafficApi.getSummary(range), [range]);

  const funnelRows = data
    ? [
        { label: t.funnelVisit, value: data.funnel.visit },
        { label: t.funnelCta, value: data.funnel.ctaClick },
        { label: t.funnelSignup, value: data.funnel.signup },
      ]
    : [];
  const points = data ? data.daily.map((d) => ({ label: formatChartLabel(d.day), value: d.visits })) : [];

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <div className="flex gap-1" role="group" aria-label={t.title}>
            {SITE_TRAFFIC_RANGES.map((r) => (
              <Button key={r} size="sm" variant={r === range ? "default" : "outline"} aria-pressed={r === range} onClick={() => setRange(r)}>
                {t[`range_${r}`]}
              </Button>
            ))}
          </div>
        }
      />

      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && (
          <div className="space-y-4">
            {!data.enabled && <Alert>{t.off}</Alert>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard label={t.visits} value={formatNumber(data.visits)} hint={t.visitsHint} />
              <KpiCard label={t.uniqueVisitors} value={formatNumber(data.uniqueVisitors)} hint={t.uniqueHint} />
              <KpiCard label={t.avgTime} value={formatDuration(data.avgSecondsOnSite, locale)} hint={t.avgTimeHint} />
            </div>

            <Panel title={t.daily} description={t.dailyHint}>
              <BarChart points={points} height={140} color="var(--color-primary)" format={(v) => fmt(t.views, { count: v })} />
              <ChartAxis points={points} />
            </Panel>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Panel title={t.funnel} description={t.funnelHint}>
                <HBarList rows={funnelRows} format={(v) => formatNumber(v)} />
              </Panel>
              <Panel title={t.topPages}>
                {data.topPages.length === 0 ? (
                  <p className="text-sm text-ink-soft">{t.none}</p>
                ) : (
                  <HBarList
                    rows={data.topPages.map((p) => ({ label: p.path, value: p.visits }))}
                    format={(v) => fmt(t.views, { count: formatNumber(v) })}
                  />
                )}
              </Panel>
              <Panel title={t.topSources}>
                {data.topSources.length === 0 ? (
                  <p className="text-sm text-ink-soft">{t.none}</p>
                ) : (
                  <HBarList
                    rows={data.topSources.map((s) => ({ label: s.source === "direct" ? t.direct : s.source, value: s.sessions }))}
                    format={(v) => fmt(t.sessions, { count: formatNumber(v) })}
                    color="var(--color-accent)"
                  />
                )}
              </Panel>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}

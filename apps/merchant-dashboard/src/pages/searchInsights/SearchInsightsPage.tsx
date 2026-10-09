import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IconPlus, IconSearch } from "@/components/icons";
import { Button, cn } from "@store-builder/ui";
import {
  searchInsightsGet,
  type SearchInsights,
  type SearchInsightsTopSearch,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatDate, formatPercentValue } from "@/lib/format";
import { formatCount, formatWindow, percentToRatio, rangeWindows, type AnalyticsRange } from "@/lib/analytics";
import { pluralOf } from "@/lib/plural";
import { fmt, useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/KpiCard";
import { RangeSwitch } from "@/components/RangeSwitch";
import { Section } from "@/components/Section";
import { AddSynonymDialog } from "./AddSynonymDialog";
import { SEARCH_STRINGS } from "./searchStrings";

/**
 * Analytics → Store search (handoff 211, analytics.view): how much shoppers
 * search, what they search for most, which searches find nothing — each with
 * «أضف مرادف» — and the products opened from a search.
 */
export function SearchInsightsPage() {
  const t = useT(SEARCH_STRINGS);
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const report = useAsync<SearchInsights>(
    () => searchInsightsGet(apiClient, workspaceId, rangeWindows(range).current),
    [workspaceId, range]
  );
  const data = report.data;
  const [adding, setAdding] = useState<string | null>(null);

  const num = (value: number | null | undefined) => <bdi dir="ltr">{formatCount(value)}</bdi>;
  const rate = (percent: number | null) => <bdi dir="ltr">{formatPercentValue(percentToRatio(percent))}</bdi>;

  const topColumns = useMemo<Column<SearchInsightsTopSearch>[]>(
    () => [
      {
        key: "query",
        header: t.colQuery,
        cell: (row) => (
          <span className="flex min-w-0 flex-col">
            <bdi dir="auto" className="font-medium text-ink">
              {row.query}
            </bdi>
            {row.servedAs && (
              <span className="text-xs font-normal text-ink-soft" title={t.servedAsTitle}>
                {fmt(t.servedAs, { term: row.servedAs })}
              </span>
            )}
          </span>
        ),
      },
      { key: "searches", header: t.colSearches, align: "end", cell: (row) => num(row.searches) },
      {
        key: "results",
        header: t.colResults,
        align: "end",
        cell: (row) => <span className={cn(row.avgResults === 0 && "font-medium text-danger")}>{num(row.avgResults)}</span>,
      },
      { key: "clicks", header: t.colClicks, align: "end", cell: (row) => num(row.clicks) },
      { key: "rate", header: t.colRate, align: "end", cell: (row) => rate(row.clickRate) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  const totals = data?.totals;
  const isEmpty = Boolean(totals && totals.searches === 0);

  return (
    <div className="min-w-0">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button asChild variant="outline" className="min-h-11 md:min-h-9">
            <Link to="/search-synonyms">{t.synonymsLink}</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <RangeSwitch value={range} onChange={setRange} compare={false} />
        {data && <span className="text-xs text-ink-soft">{formatWindow(data.range.from, data.range.to)}</span>}
      </div>

      <DataState loading={report.loading && !data} error={report.error} onRetry={() => void report.refresh()} skeleton="tiles">
        {data && totals && isEmpty ? (
          <EmptyState icon={<IconSearch aria-hidden />} title={t.emptyTitle} description={t.emptyHint} />
        ) : data && totals ? (
          <div className={cn("space-y-4 transition-opacity", report.loading && "opacity-60")}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard label={t.searches} value={formatCount(totals.searches)} />
              <KpiCard label={t.searchers} value={formatCount(totals.searchers)} />
              <KpiCard
                label={t.noResults}
                value={formatCount(totals.noResults)}
                hint={fmt(t.noResultsShare, { percent: formatPercentValue(totals.noResults / totals.searches, 0) })}
              />
              <KpiCard
                label={t.clickRate}
                value={formatPercentValue(percentToRatio(totals.clickRate))}
                hint={totals.clickRate === null ? t.clickRateNone : pluralOf(t, "clickRateHint", totals.clicks)}
              />
            </div>

            <Section title={t.topTitle} description={t.topHint} flush>
              <DataTable columns={topColumns} rows={data.topSearches} rowKey={(row) => row.query} minWidth="36rem" phoneCards={false} />
            </Section>

            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <Section title={t.noneTitle} description={t.noneHint}>
                {data.noResults.length === 0 ? (
                  <p className="text-sm text-ink-soft">{t.noneEmpty}</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {data.noResults.map((row) => (
                      <li key={row.query} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <bdi dir="auto" className="block truncate font-medium text-ink">
                            {row.query}
                          </bdi>
                          <p className="text-xs text-ink-soft">
                            {pluralOf(t, "times", row.searches)} · {fmt(t.lastOn, { date: formatDate(row.lastAt) })}
                          </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0 md:min-h-9" onClick={() => setAdding(row.query)}>
                          <IconPlus className="size-4" aria-hidden />
                          {t.addSynonym}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
              <Section title={t.clickedTitle} description={t.clickedHint}>
                {data.topClickedProducts.length === 0 ? (
                  <p className="text-sm text-ink-soft">{t.clickedEmpty}</p>
                ) : (
                  <ol className="divide-y divide-line">
                    {data.topClickedProducts.map((row) => (
                      <li key={row.productId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <Link
                          to={`/catalog/${row.productId}`}
                          className="inline-flex min-h-11 min-w-0 items-center font-medium text-ink hover:text-primary md:min-h-0"
                        >
                          <bdi className="truncate">{row.name}</bdi>
                        </Link>
                        <span className="shrink-0 text-sm text-ink-soft">{pluralOf(t, "opens", row.clicks)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>
            </div>

            <p className="text-xs text-ink-soft">{t.kept}</p>
          </div>
        ) : null}
      </DataState>

      <AddSynonymDialog query={adding} onClose={() => setAdding(null)} />
    </div>
  );
}

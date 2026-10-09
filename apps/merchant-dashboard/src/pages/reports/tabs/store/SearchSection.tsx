import { useState, type ReactNode } from "react";
import { searchInsightsGet, type SearchInsightsTopSearch } from "@store-builder/api-client";
import { Button, cn } from "@store-builder/ui";
import { IconArrowOut, IconPlus } from "@/components/icons";
import { ReportTable, useTabData, type ReportColumn } from "@/components/report";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { formatDate, formatPercentValue } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { AddSynonymDialog } from "@/pages/searchInsights/AddSynonymDialog";
import { SEARCH_STRINGS } from "@/pages/searchInsights/searchStrings";
import { csvRate, formatRate, type StoreRange } from "./model";
import { Num, SectionState } from "./parts";

/** One of the four totals of the store's search: a quiet label, the figure, and what it is a share or a count of. */
function SearchStat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[13px] leading-5 font-medium text-ink-soft" title={label}>
        {label}
      </dt>
      <dd className="mt-0.5 text-2xl leading-8 font-semibold tracking-tight text-ink tabular-nums">
        <bdi>{value}</bdi>
      </dd>
      {hint && <dd className="text-xs leading-4 text-pretty text-ink-soft">{hint}</dd>}
    </div>
  );
}

const SUBHEAD = "text-[15px] leading-6 font-semibold text-ink";
const SUBHINT = "mt-0.5 text-[13px] leading-5 text-pretty text-ink-soft";

/**
 * «البحث في المتجر» — the old `/analytics/search` screen as one block of the
 * store tab: how much shoppers search, what they search for most (a table that
 * sorts and exports), the searches that found nothing — each with «أضف
 * مرادف» — and the products opened from a search.
 *
 * It takes the hub's range in place of the screen's own (the API keeps
 * searches for 180 days, and says so at the foot). Asked for when the section
 * is opened; the words are the old screen's own (searchStrings.ts).
 */
export function SearchBody({ workspaceId, range }: { workspaceId: string; range: StoreRange }) {
  const t = useT(SEARCH_STRINGS);
  const report = useTabData("store:search", workspaceId, range, () =>
    searchInsightsGet(apiClient, workspaceId, { from: range.from, to: range.to })
  );
  // The search a synonym is being added for, while its dialog is open.
  const [adding, setAdding] = useState<string | null>(null);

  const data = report.data;
  const totals = data?.totals;

  const columns: ReportColumn<SearchInsightsTopSearch>[] = [
    {
      key: "query",
      header: t.colQuery,
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <bdi dir="auto" className="truncate">
            {row.query}
          </bdi>
          {row.servedAs && (
            <span className="truncate text-xs font-normal text-ink-soft" title={t.servedAsTitle}>
              {fmt(t.servedAs, { term: row.servedAs })}
            </span>
          )}
        </span>
      ),
      sortValue: (row) => row.query,
      csv: (row) => row.query,
    },
    {
      key: "searches",
      header: t.colSearches,
      align: "end",
      cell: (row) => formatCount(row.searches),
      sortValue: (row) => row.searches,
      csv: (row) => row.searches,
    },
    {
      key: "results",
      header: t.colResults,
      align: "end",
      // A search that finds nothing is the one to act on: its zero is in red.
      cell: (row) => <Num className={cn(row.avgResults === 0 && "font-medium text-danger")}>{formatCount(row.avgResults)}</Num>,
      sortValue: (row) => row.avgResults,
      csv: (row) => row.avgResults,
    },
    {
      key: "clicks",
      header: t.colClicks,
      align: "end",
      cell: (row) => formatCount(row.clicks),
      sortValue: (row) => row.clicks,
      csv: (row) => row.clicks,
    },
    {
      key: "rate",
      header: t.colRate,
      align: "end",
      cell: (row) => formatRate(row.clickRate),
      sortValue: (row) => row.clickRate,
      csv: (row) => csvRate(row.clickRate),
    },
  ];

  return (
    <SectionState loading={report.loading} error={report.error} onRetry={report.retry} lines={5}>
      {data && totals && totals.searches === 0 ? (
        <div className="px-4 py-5">
          <p className="text-sm font-semibold text-ink">{t.emptyTitle}</p>
          <p className="mt-1 text-sm leading-6 text-pretty text-ink-soft">{t.emptyHint}</p>
        </div>
      ) : data && totals ? (
        <div className="min-w-0">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-4 py-4 lg:grid-cols-4">
            <SearchStat label={t.searches} value={formatCount(totals.searches)} />
            <SearchStat label={t.searchers} value={formatCount(totals.searchers)} />
            <SearchStat
              label={t.noResults}
              value={formatCount(totals.noResults)}
              hint={fmt(t.noResultsShare, { percent: formatPercentValue(totals.noResults / totals.searches, 0) })}
            />
            <SearchStat
              label={t.clickRate}
              value={formatRate(totals.clickRate)}
              hint={totals.clickRate === null ? t.clickRateNone : pluralOf(t, "clickRateHint", totals.clicks)}
            />
          </dl>

          <div className="border-t border-line">
            <ReportTable<SearchInsightsTopSearch>
              embedded
              columns={columns}
              rows={data.topSearches}
              rowKey={(row) => row.query}
              defaultSort={{ key: "searches", dir: "desc" }}
              exportName="zimos-store-searches"
              range={range}
              caption={t.topTitle}
              // Embedded, the table keeps its title for screen readers only: here it is one of three blocks, so the title is shown.
              note={
                <>
                  <strong className={cn("block", SUBHEAD)}>{t.topTitle}</strong>
                  {t.topHint}
                </>
              }
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 border-t border-line xl:grid-cols-2">
            <div className="min-w-0 px-4 py-4">
              <h4 className={SUBHEAD}>{t.noneTitle}</h4>
              <p className={SUBHINT}>{t.noneHint}</p>
              {data.noResults.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-ink-soft">{t.noneEmpty}</p>
              ) : (
                <ul className="mt-2 divide-y divide-line">
                  {data.noResults.map((row) => (
                    <li key={row.query} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 last:pb-0">
                      <div className="min-w-0">
                        <bdi dir="auto" className="block truncate font-medium text-ink">
                          {row.query}
                        </bdi>
                        <p className="text-xs leading-5 text-ink-soft">
                          {pluralOf(t, "times", row.searches)} · {fmt(t.lastOn, { date: formatDate(row.lastAt) })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 shrink-0 rounded-full px-3.5 pointer-coarse:h-11"
                        onClick={() => setAdding(row.query)}
                      >
                        <IconPlus weight="bold" className="size-4" aria-hidden />
                        {t.addSynonym}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="min-w-0 border-line px-4 py-4 max-xl:border-t xl:border-s">
              <h4 className={SUBHEAD}>{t.clickedTitle}</h4>
              <p className={SUBHINT}>{t.clickedHint}</p>
              {data.topClickedProducts.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-ink-soft">{t.clickedEmpty}</p>
              ) : (
                <ol className="mt-2 divide-y divide-line">
                  {data.topClickedProducts.map((row) => (
                    <li key={row.productId} className="flex items-center justify-between gap-3">
                      <ViewLink
                        to={`/catalog/${row.productId}`}
                        className="inline-flex min-h-11 min-w-0 items-center rounded-md font-medium text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <bdi className="truncate">{row.name}</bdi>
                      </ViewLink>
                      <span className="shrink-0 text-sm text-ink-soft">{pluralOf(t, "opens", row.clicks)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-4 py-2">
            <p className="text-xs leading-5 text-ink-soft">{t.kept}</p>
            <ViewLink
              to="/search-synonyms"
              className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t.synonymsLink}
              <IconArrowOut weight="bold" className="size-3.5 shrink-0 rtl:-scale-x-100" aria-hidden />
            </ViewLink>
          </div>
        </div>
      ) : null}

      <AddSynonymDialog query={adding} onClose={() => setAdding(null)} />
    </SectionState>
  );
}

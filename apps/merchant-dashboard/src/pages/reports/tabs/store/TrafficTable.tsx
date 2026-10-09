import { useEffect, useMemo, useState } from "react";
import type {
  WebAnalyticsFilterKey,
  WebAnalyticsFilters,
  WebAnalyticsMetricType,
  WebAnalyticsMetrics,
  WebAnalyticsRangeParams,
  WebAnalyticsStats,
} from "@store-builder/api-client";
import { Card } from "@store-builder/ui";
import { SkeletonBar } from "@/components/DataState";
import { IconClose } from "@/components/icons";
import { ReportTable, useTabData, type ReportColumn } from "@/components/report";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { useDurationText, useStoreLabels, ValueText, type ShownValue } from "./labels";
import {
  csvRate,
  DIM_FILTER,
  filterEntries,
  filtersKey,
  formatRate,
  ROW_LIMIT,
  shareOf,
  TRAFFIC_ANCHOR,
  TRAFFIC_VIEWS,
  VIEW_DIMS,
  webParams,
  type FilterEntry,
  type StoreRange,
  type TrafficDim,
  type TrafficView,
} from "./model";
import { MiniStat, Num, RetryLine } from "./parts";
import { STORE_STRINGS } from "./strings";

// ---------------------------------------------------------------- the data --

interface TrafficData {
  rows: Array<{ x: string; visitors: number; entries: number | null; exits: number | null }>;
  /** Whether the pages people came in on / left from were read (the "path" breakdown only). */
  hasEntries: boolean;
  hasExits: boolean;
  /** True when the list was cut at ROW_LIMIT: there are more rows than these. */
  capped: boolean;
}

interface TrafficRow {
  x: string;
  visitors: number;
  entries: number | null;
  exits: number | null;
  shown: ShownValue;
}

/**
 * One breakdown of the visitors (web analytics "metrics": a value and the
 * distinct visitors that had it). Pages come with two more lists — the page a
 * visit began on and the one it ended on — joined by path, so the table can
 * say where people come in and where they leave. One of those two failing
 * costs its column, not the table.
 */
async function loadTraffic(workspaceId: string, dim: TrafficDim, params: WebAnalyticsRangeParams): Promise<TrafficData> {
  const ask = (type: WebAnalyticsMetricType) => apiClient.getWebAnalyticsMetrics(workspaceId, type, { ...params, limit: ROW_LIMIT });

  if (dim !== "path") {
    const list = await ask(dim);
    return {
      rows: list.rows.map((row) => ({ x: row.x, visitors: row.y, entries: null, exits: null })),
      hasEntries: false,
      hasExits: false,
      capped: list.rows.length >= ROW_LIMIT,
    };
  }

  const [pages, entry, exit] = await Promise.all([ask("path"), ask("entry").catch(() => null), ask("exit").catch(() => null)]);
  const reader = (list: WebAnalyticsMetrics | null) => {
    if (!list) return null;
    const complete = list.rows.length < ROW_LIMIT;
    const byPage = new Map(list.rows.map((row) => [row.x, row.y] as const));
    // A page missing from a complete list had nobody; missing from a cut one, its number is not known.
    return (page: string): number | null => byPage.get(page) ?? (complete ? 0 : null);
  };
  const entries = reader(entry);
  const exits = reader(exit);
  return {
    rows: pages.rows.map((row) => ({
      x: row.x,
      visitors: row.y,
      entries: entries ? entries(row.x) : null,
      exits: exits ? exits(row.x) : null,
    })),
    hasEntries: entries !== null,
    hasExits: exits !== null,
    capped: pages.rows.length >= ROW_LIMIT,
  };
}

// --------------------------------------------------------------- the styles --

/**
 * The first cell of a row that can be filtered on: the value is a button, and
 * its `::before` covers the whole cell (the cell is the positioned box: the
 * table keeps its first column sticky), so the target is the cell — 44px tall —
 * while the words still cut with an ellipsis. The focus ring is drawn on that
 * same box, inside the cell.
 */
const ROW_BUTTON =
  "block max-w-full cursor-pointer truncate text-start font-medium text-ink underline-offset-4 outline-none hover:underline " +
  "before:absolute before:inset-0 before:content-[''] " +
  "focus-visible:before:outline-2 focus-visible:before:-outline-offset-2 focus-visible:before:outline-primary";

// A filter chip: the list kit's chip (its pane on glass comes from glass/list.css through `zimos-chip`), 44px under a finger.
const CHIP =
  "zimos-chip inline-flex h-10 max-w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-full bg-paper-raised ps-3.5 pe-2.5 text-sm font-medium text-ink ring-1 ring-line select-none pointer-coarse:h-11 " +
  "transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100";

const CLEAR =
  "inline-flex h-10 shrink-0 cursor-pointer items-center rounded-full px-3 text-sm font-semibold text-primary pointer-coarse:h-11 " +
  "transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100";

// ------------------------------------------------------------- the filters --

/** The totals of the filtered visitors: what the old screen's headline figures became under a filter. */
export interface ScopedStats {
  data: WebAnalyticsStats | null;
  loading: boolean;
  error: unknown;
  retry: () => void;
}

/**
 * The web-analytics filters, above the table: one chip per filter — pressing
 * it takes the filter off — «امسح الكل», and under them what the filtered
 * visitors add up to (visitors, visits, page views, bounce rate, time).
 */
function FilterBar({
  entries,
  scoped,
  onRemove,
  onClear,
}: {
  entries: FilterEntry[];
  scoped: ScopedStats;
  onRemove: (key: WebAnalyticsFilterKey) => void;
  onClear: () => void;
}) {
  const t = useT(STORE_STRINGS);
  const labels = useStoreLabels();
  const duration = useDurationText();
  const stats = scoped.data;

  return (
    <div data-slot="store-filters" className="flex min-w-0 flex-col gap-2">
      <div role="group" aria-label={t.filtersLabel} className="flex min-w-0 flex-wrap items-center gap-2">
        <span aria-hidden className="px-1 text-[13px] leading-5 font-semibold text-ink-soft">
          {t.filtersLabel}
        </span>
        {entries.map(([key, raw]) => {
          const value = labels.shown(key, raw);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onRemove(key)}
              aria-label={fmt(t.removeFilter, { label: labels.filterLabel[key], value: value.text })}
              className={CHIP}
            >
              <span className="shrink-0 text-ink-soft">{labels.filterLabel[key]}:</span>
              <span className="min-w-0 truncate">
                <ValueText value={value} />
              </span>
              <IconClose weight="bold" className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
            </button>
          );
        })}
        <button type="button" onClick={onClear} className={CLEAR}>
          {t.clearFilters}
        </button>
      </div>

      {scoped.loading ? (
        <SkeletonBar className="mx-1 my-1 w-64 max-w-[80%]" />
      ) : scoped.error ? (
        // Not for this role: the chips stay, the totals are simply left out.
        isPermissionError(scoped.error) ? null : (
          <RetryLine message={t.filteredFailed} onRetry={scoped.retry} className="px-1" />
        )
      ) : stats ? (
        <dl className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1 px-1 text-[13px] leading-5">
          <MiniStat label={t.visitors}>
            <Num>{formatCount(stats.visitors)}</Num>
          </MiniStat>
          <MiniStat label={t.visits}>
            <Num>{formatCount(stats.visits)}</Num>
          </MiniStat>
          <MiniStat label={t.views}>
            <Num>{formatCount(stats.pageviews)}</Num>
          </MiniStat>
          <MiniStat label={t.bounce}>
            <Num>{formatRate(stats.bounceRate)}</Num>
          </MiniStat>
          <MiniStat label={t.duration}>
            <bdi className="tabular-nums">{duration(stats.avgVisitTime)}</bdi>
          </MiniStat>
        </dl>
      ) : null}
    </div>
  );
}

// --------------------------------------------------------------- the table --

const FIRST_DIM: Record<TrafficView, TrafficDim> = {
  pages: "path",
  sources: "referrer",
  devices: "device",
  countries: "country",
};

export interface TrafficBlockProps {
  workspaceId: string;
  range: StoreRange;
  /** The web-analytics filters in the address (`?device=mobile&country=EG`). */
  filters: WebAnalyticsFilters;
  /** Every visitor of the period, with no filter: what «من كل الزوار» is a share of. Null while it is not known. */
  visitors: number | null;
  /** The totals of the filtered visitors; its `data` is null while nothing is filtered. */
  scoped: ScopedStats;
  onFilter: (key: WebAnalyticsFilterKey, value: string) => void;
  onRemove: (key: WebAnalyticsFilterKey) => void;
  onClear: () => void;
  /** Called when the table has what it asked for (or was refused): the page below it has stopped moving. */
  onSettled?: () => void;
}

/**
 * The tab's ONE breakdown table: the visitors, switched between pages,
 * sources, devices and countries (the four panels of the old web-analytics
 * screen), each with the finer breakdowns that panel had in a select beside
 * the switch. Pages also say how many visitors came in on a page, how many
 * left from it, and the share of the page's visitors that left there.
 *
 * Pressing a row filters by it, as on the old screen. The filters live in the
 * address and show as removable chips above the table; they narrow this table
 * and the web-analytics sections of «تفاصيل أكتر» — not the funnel, which
 * the sales report counts for the whole store.
 *
 * Sorting and the CSV are the kit's: every row the API returned (up to 500) is
 * exported, in the order on screen.
 */
export function TrafficBlock({ workspaceId, range, filters, visitors, scoped, onFilter, onRemove, onClear, onSettled }: TrafficBlockProps) {
  const t = useT(STORE_STRINGS);
  const labels = useStoreLabels();
  const [view, setView] = useState<TrafficView>("pages");
  // Each view remembers the breakdown it was last on.
  const [dims, setDims] = useState<Record<TrafficView, TrafficDim>>(FIRST_DIM);
  const dim = dims[view];
  const entries = filterEntries(filters);
  const hasFilters = entries.length > 0;

  const table = useTabData<TrafficData>(
    "store:traffic",
    workspaceId,
    range,
    () => loadTraffic(workspaceId, dim, webParams(range, filters)),
    `${dim}|${filtersKey(filters)}`
  );

  const settled = !table.loading;
  useEffect(() => {
    if (settled) onSettled?.();
  }, [settled, onSettled]);

  const data = table.data;
  const filterKey = DIM_FILTER[dim];
  // Under a filter the shares are of the filtered visitors, as the old screen's were.
  const total = hasFilters ? (scoped.data?.visitors ?? null) : visitors;
  const hasEntries = Boolean(data?.hasEntries);
  const hasExits = Boolean(data?.hasExits);

  const rows = useMemo<TrafficRow[]>(
    () => (data?.rows ?? []).map((row) => ({ ...row, shown: labels.shown(dim, row.x) })),
    [data, dim, labels]
  );

  const columns = useMemo<ReportColumn<TrafficRow>[]>(() => {
    const list: ReportColumn<TrafficRow>[] = [
      {
        key: "name",
        header: labels.dimLabel[dim],
        cell: (row) =>
          filterKey && row.x !== "" ? (
            <button
              type="button"
              title={fmt(t.filterBy, { value: row.shown.text })}
              onClick={() => onFilter(filterKey, row.x)}
              className={ROW_BUTTON}
            >
              <ValueText value={row.shown} />
            </button>
          ) : (
            <ValueText value={row.shown} />
          ),
        sortValue: (row) => row.shown.text,
        csv: (row) => row.shown.text,
      },
      {
        key: "visitors",
        header: t.colVisitors,
        align: "end",
        cell: (row) => formatCount(row.visitors),
        sortValue: (row) => row.visitors,
        csv: (row) => row.visitors,
      },
      {
        key: "share",
        header: t.colShare,
        hint: t.colShareHint,
        align: "end",
        cell: (row) => formatRate(shareOf(row.visitors, total)),
        sortValue: (row) => shareOf(row.visitors, total),
        csv: (row) => csvRate(shareOf(row.visitors, total)),
      },
    ];
    if (dim === "path" && hasEntries) {
      list.push({
        key: "entries",
        header: t.colEntries,
        hint: t.colEntriesHint,
        align: "end",
        cell: (row) => formatCount(row.entries),
        sortValue: (row) => row.entries,
        csv: (row) => row.entries,
      });
    }
    if (dim === "path" && hasExits) {
      // Of the page's own visitors, the share whose visit ended on it.
      const exitRate = (row: TrafficRow) => (row.exits === null ? null : shareOf(row.exits, row.visitors));
      list.push(
        {
          key: "exits",
          header: t.colExits,
          hint: t.colExitsHint,
          align: "end",
          cell: (row) => formatCount(row.exits),
          sortValue: (row) => row.exits,
          csv: (row) => row.exits,
        },
        {
          key: "exitRate",
          header: t.colExitRate,
          hint: t.colExitRateHint,
          align: "end",
          cell: (row) => formatRate(exitRate(row)),
          sortValue: (row) => exitRate(row),
          csv: (row) => csvRate(exitRate(row)),
        }
      );
    }
    return list;
  }, [dim, filterKey, hasEntries, hasExits, labels, onFilter, t, total]);

  // Not for this role: the table, and the filters that belong to it, are left out.
  if (isPermissionError(table.error)) return null;

  const viewLabel: Record<TrafficView, string> = {
    pages: t.view_pages,
    sources: t.view_sources,
    devices: t.view_devices,
    countries: t.view_countries,
  };
  const viewTitle: Record<TrafficView, string> = {
    pages: t.title_pages,
    sources: t.title_sources,
    devices: t.title_devices,
    countries: t.title_countries,
  };

  const toolbar = (
    <>
      <Segmented
        value={view}
        onChange={setView}
        options={TRAFFIC_VIEWS.map((value) => ({ value, label: viewLabel[value] }))}
        label={t.viewLabel}
        size="sm"
        // On a phone the four segments take the whole row, with less padding so no name is cut.
        className="max-sm:w-full max-sm:[&_[role=radio]]:px-2"
      />
      <Select
        aria-label={t.dimLabel}
        value={dim}
        onChange={(event) => {
          const next = event.target.value as TrafficDim;
          setDims((current) => ({ ...current, [view]: next }));
        }}
        className="h-10 w-auto min-w-0 font-medium pointer-coarse:h-11"
      >
        {VIEW_DIMS[view].map((option) => (
          <option key={option} value={option}>
            {labels.dimLabel[option]}
          </option>
        ))}
      </Select>
    </>
  );

  const note = `${filterKey ? t.tableNoteFilter : t.tableNote}${data?.capped ? ` ${fmt(t.tableCapped, { n: ROW_LIMIT })}` : ""}`;

  return (
    <div id={TRAFFIC_ANCHOR} data-slot="store-traffic" className="flex min-w-0 scroll-mt-24 flex-col gap-3">
      {hasFilters && <FilterBar entries={entries} scoped={scoped} onRemove={onRemove} onClear={onClear} />}

      {table.error ? (
        // The switch stays, so another breakdown can be tried while this one is failing.
        <Card className="min-w-0 gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h3 className="text-[15px] leading-6 font-semibold text-ink">{viewTitle[view]}</h3>
            <div className="flex min-w-0 flex-wrap items-center gap-2">{toolbar}</div>
          </div>
          <RetryLine message={t.tableFailed} onRetry={table.retry} />
        </Card>
      ) : (
        <ReportTable<TrafficRow>
          // A new breakdown starts again from the most visitors, folded.
          key={dim}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.x}
          defaultSort={{ key: "visitors", dir: "desc" }}
          exportName={`zimos-store-${dim}`}
          range={range}
          caption={viewTitle[view]}
          note={note}
          toolbar={toolbar}
          empty={hasFilters ? t.tableEmptyFiltered : t.tableEmpty}
          loading={table.loading}
        />
      )}
    </div>
  );
}

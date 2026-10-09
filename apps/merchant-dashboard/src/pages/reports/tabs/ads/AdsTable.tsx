import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { funnelsList, type FunnelDto, type InsightsAttribution, type InsightsAttributionGroup } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { AdPlatformMark, AdSourceMark } from "@/components/AdPlatformMark";
import { SkeletonBar } from "@/components/DataState";
import { IconCaretRight, IconClose } from "@/components/icons";
import { ReportTable, useTabData, type ReportColumn, type ReportSort } from "@/components/report";
import { Segmented, type SegmentedOption } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { fmt, useT } from "@/i18n/LocaleContext";
import { AD_PLATFORM_NAMES, adPlatformName } from "@/lib/adPlatforms";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { countOf } from "@/lib/plural";
import type { ReportRange } from "@/lib/reportRange";
import { useCachedAsync } from "@/lib/useCachedAsync";
import {
  NO_FILTERS,
  attributionKey,
  attributionRows,
  loadAttribution,
  type AdsFilters,
  type AdsRow,
  type AdsTableMode,
  type AdsTouch,
} from "./adsData";
import { DASH, Figure, fill, formatRate, formatRoas, useAdsMoney } from "./adsFormat";
import { ADS_STRINGS } from "./adsStrings";
import { PartError } from "./parts";

/** The small ad-platform mark that fits a table row (the size AdPlatformLabel uses). */
const ROW_MARK = "h-5 w-7 text-[0.5625rem]";
const NO_ROWS: readonly AdsRow[] = [];
const BY_SPEND: ReportSort = { key: "spend", dir: "desc" };
const BY_SALES: ReportSort = { key: "sales", dir: "desc" };

// A control of the table's title line: 40px, 44px under a finger.
const CONTROL = "h-10 w-auto max-w-full font-medium pointer-coarse:h-11";
const CHIP =
  "inline-flex h-10 max-w-full cursor-pointer items-center gap-1.5 rounded-full bg-primary-soft ps-3.5 pe-2.5 text-[13px] font-medium text-primary pointer-coarse:h-11 " +
  "transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100";
/**
 * The first cell as a button. ReportTable cuts that cell's content to one line (a box that hides
 * what overflows), so the button cannot grow past its own 20px line there. Its ::before does instead:
 * the button itself is not positioned, so the ::before is laid out against the cell (the table's first
 * cell is `sticky`, hence positioned) and covers ALL of it — the whole cell, 44px tall, is the target,
 * and the focus ring is drawn on it, outside the box that clips.
 */
const DRILL =
  "flex w-full min-w-0 cursor-pointer items-center gap-1.5 text-start font-medium text-ink underline-offset-4 hover:underline focus-visible:outline-none " +
  "before:absolute before:inset-0 before:rounded-sm before:content-[''] focus-visible:before:outline-2 focus-visible:before:-outline-offset-2 focus-visible:before:outline-primary";

/**
 * The switch of what the table breaks down by. Five segments do not fit a
 * phone, so the track sits in a strip that scrolls sideways there (as the
 * hub's own tab bar does) and the chosen segment is brought into view — the
 * strip is moved, never the page.
 */
function ModeStrip({
  value,
  onChange,
  options,
  label,
}: {
  value: AdsTableMode;
  onChange: (mode: AdsTableMode) => void;
  options: ReadonlyArray<SegmentedOption<AdsTableMode>>;
  label: string;
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const strip = stripRef.current;
    const chosen = strip?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!strip || !chosen || strip.scrollWidth <= strip.clientWidth) return;
    const box = strip.getBoundingClientRect();
    const segment = chosen.getBoundingClientRect();
    if (segment.left >= box.left && segment.right <= box.right) return;
    const still = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollBy({ left: segment.left + segment.width / 2 - (box.left + box.width / 2), behavior: still ? "auto" : "smooth" });
  }, [value]);

  return (
    <div
      ref={stripRef}
      data-slot="report-mode-strip"
      // The padding keeps the thumb's glow from being cut by the strip's edge.
      className="-my-1 max-w-full min-w-0 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <Segmented value={value} onChange={onChange} options={options} label={label} size="sm" className="max-w-none" />
    </div>
  );
}

export interface AdsTableProps {
  workspaceId: string;
  range: ReportRange;
  /**
   * The campaigns that have spend, one row each (the tab works them out once,
   * for the chart, the sentence and this table). Null: there is no campaigns
   * view — spend is not for this role, or none is recorded in the range — and
   * only the UTM groups are offered.
   */
  campaigns: readonly AdsRow[] | null;
  /** The store's currency, from the tab's main request. */
  currency: string;
  /** The net profit column of the campaigns view: still on its way, readable, or left out. */
  profitColumn?: "loading" | "ready" | "off";
  /** Share of the delivered pieces that have a unit cost (a percentage), from the P&L. */
  costCoverage?: number | null;
  /** The P&L failed for a reason other than permission: an error line under the table asks again through this. */
  onRetryProfit?: () => void;
  /** No card of its own: for the table inside an AccordionSection (pass that section `flush`). */
  embedded?: boolean;
}

/**
 * The tab's ONE breakdown table.
 *
 * «الحملات» is the campaigns report: spend → orders → confirmed → delivered →
 * returned → delivered sales → cost per delivered order → return on spend →
 * net profit (when the P&L can be read and joined). The switch turns the SAME
 * table to the orders' own links — source, medium, link campaign, ad — from
 * the attribution report; those views have their own columns (visitors,
 * conversion, average order; no "returned"), and the caption says so.
 *
 * One `ReportTable` for every view (one row shape, `AdsRow`), never re-keyed:
 * the switch stays mounted, so its thumb slides, and a column the merchant
 * sorted by stays sorted wherever the next view has it too.
 *
 * In the UTM views: «آخر لمسة / أول لمسة», the sales-funnel filter, and
 * tap-to-narrow — a source opens its link campaigns, a link campaign its ads;
 * the filter stays as a chip, whatever UTM view the switch shows next, until it
 * is removed or the table goes back to the campaigns.
 *
 * Sources are asked for only when a UTM view is opened (and cached per view).
 */
export function AdsTable({
  workspaceId,
  range,
  campaigns,
  currency,
  profitColumn = "off",
  costCoverage = null,
  onRetryProfit,
  embedded = false,
}: AdsTableProps) {
  const t = useT(ADS_STRINGS);
  const allowAds = campaigns !== null;
  const [mode, setMode] = useState<AdsTableMode>(allowAds ? "ads" : "source");
  const [touch, setTouch] = useState<AdsTouch>("last");
  const [funnelId, setFunnelId] = useState("");
  const [filters, setFilters] = useState<AdsFilters>(NO_FILTERS);
  const [sourcesDenied, setSourcesDenied] = useState(false);
  const group: InsightsAttributionGroup | null = mode === "ads" ? null : mode;

  // ---- data ----
  // The hook is always called; on the campaigns view it asks for nothing.
  const attribution = useTabData<InsightsAttribution | null>(
    "ads:attribution",
    workspaceId,
    range,
    () => (group ? loadAttribution(workspaceId, range, { groupBy: group, touch, funnelId, filters }) : Promise.resolve(null)),
    group ? attributionKey({ groupBy: group, touch, funnelId, filters }) : "off"
  );
  const denied = group !== null && isPermissionError(attribution.error);
  const failed = group !== null && Boolean(attribution.error) && !denied;

  // Order sources are not for this role (a 403): back to the campaigns, and the UTM views are no longer offered.
  useEffect(() => {
    if (!denied || !allowAds) return;
    setSourcesDenied(true);
    setMode("ads");
    setFilters(NO_FILTERS);
  }, [denied, allowAds]);

  // The store's sales funnels, for the filter — asked for once a UTM view is open. No funnels, no filter.
  const wantsFunnels = group !== null;
  const funnels = useCachedAsync<FunnelDto[]>(
    wantsFunnels ? `report:ads:funnels:${workspaceId}` : null,
    () => (wantsFunnels ? funnelsList(apiClient, workspaceId).catch(() => []) : Promise.resolve([])),
    [workspaceId, wantsFunnels]
  );
  const funnelList = wantsFunnels ? (funnels.data ?? []) : [];

  const data = group ? attribution.data : null;
  const loading = group !== null && attribution.loading;
  const { money, csv } = useAdsMoney(data?.currency ?? currency);
  const sourceRows = useMemo(() => (data ? attributionRows(data) : NO_ROWS), [data]);
  const rows: readonly AdsRow[] = group === null ? (campaigns ?? NO_ROWS) : sourceRows;
  // Spend exists per source and per link campaign only, and only once some is recorded. While a view loads,
  // the columns are those it will most likely have, so the table does not change shape when it arrives.
  const spendExpected = (group === "source" || group === "campaign") && (campaigns?.length ?? 0) > 0;
  const hasSpend = group === null || (data ? data.totals.spend !== null : spendExpected);
  const filtered = Boolean(filters.source || filters.campaign);

  // ---- actions ----
  function changeMode(next: AdsTableMode) {
    setMode(next);
    // The filters belong to the UTM views: back on the campaigns they are let go.
    if (next === "ads") setFilters(NO_FILTERS);
  }

  const canDrill = mode === "source" || mode === "campaign";
  function drill(row: AdsRow) {
    if (mode === "source") {
      setFilters((current) => ({ ...current, source: row.name }));
      setMode("campaign");
    } else if (mode === "campaign") {
      setFilters((current) => ({ ...current, campaign: row.name }));
      setMode("content");
    }
  }

  // ---- columns ----
  const modeLabel: Record<AdsTableMode, string> = {
    ads: t.modeAds,
    source: t.modeSource,
    medium: t.modeMedium,
    campaign: t.modeCampaign,
    content: t.modeContent,
  };
  const nameHeader: Record<AdsTableMode, string> = {
    ads: t.colCampaign,
    source: t.colSource,
    medium: t.colMedium,
    campaign: t.colLinkCampaign,
    content: t.colContent,
  };
  const platformLabel = (platform: string | null) => (platform && AD_PLATFORM_NAMES[platform] ? adPlatformName(platform) : t.platformOther);

  function nameCell(row: AdsRow): ReactNode {
    if (group === null) {
      return (
        <span className="flex min-w-0 items-center gap-1.5">
          {row.platform && AD_PLATFORM_NAMES[row.platform] && <AdPlatformMark platform={row.platform} decorative className={ROW_MARK} />}
          <span className="min-w-0 truncate" dir="auto" title={row.name}>
            {row.name}
          </span>
        </span>
      );
    }
    if (!row.name) {
      return (
        <span className="block truncate font-normal text-ink-soft" title={t.untracked}>
          {t.untracked}
        </span>
      );
    }
    const label = (
      <>
        {/* A source that is an ad platform carries its mark. */}
        {group === "source" && <AdSourceMark source={row.name} />}
        <span className="min-w-0 truncate" dir="auto">
          {row.name}
        </span>
      </>
    );
    if (!canDrill) {
      return (
        <span className="flex min-w-0 items-center gap-1.5" title={row.name}>
          {label}
        </span>
      );
    }
    const hint = fmt(mode === "source" ? t.drillSource : t.drillCampaign, { name: row.name });
    return (
      <button type="button" onClick={() => drill(row)} title={hint} aria-label={hint} className={DRILL}>
        {label}
        <IconCaretRight weight="bold" className="size-3 shrink-0 text-ink-soft rtl:-scale-x-100" aria-hidden />
      </button>
    );
  }

  const name: ReportColumn<AdsRow> = {
    key: "name",
    header: nameHeader[mode],
    cell: nameCell,
    // Orders with no UTM sort last, whichever way the names run.
    sortValue: (row) => row.name || null,
    csv: (row) => row.name || t.untracked,
  };
  const platform: ReportColumn<AdsRow> = {
    key: "platform",
    header: t.colPlatform,
    cell: (row) => platformLabel(row.platform),
    sortValue: (row) => platformLabel(row.platform),
    // On a phone and a tablet the mark beside the name says it; the column is still exported.
    hideBelow: "lg",
  };
  const spend: ReportColumn<AdsRow> = {
    key: "spend",
    header: t.colSpend,
    hint: group === null ? undefined : t.hintSpendBy,
    align: "end",
    cell: (row) => money(row.spend),
    sortValue: (row) => row.spend,
    csv: (row) => csv(row.spend),
  };
  const orders: ReportColumn<AdsRow> = {
    key: "orders",
    header: t.colOrders,
    hint: group === null ? t.hintOrders : undefined,
    align: "end",
    cell: (row) => formatCount(row.orders),
    sortValue: (row) => row.orders,
  };
  const confirmed: ReportColumn<AdsRow> = {
    key: "confirmed",
    header: t.colConfirmed,
    hint: t.hintConfirmed,
    align: "end",
    cell: (row) => formatCount(row.confirmed),
    sortValue: (row) => row.confirmed,
  };
  const delivered: ReportColumn<AdsRow> = {
    key: "delivered",
    header: t.colDelivered,
    align: "end",
    cell: (row) => formatCount(row.delivered),
    sortValue: (row) => row.delivered,
  };
  const returned: ReportColumn<AdsRow> = {
    key: "returned",
    header: t.colReturned,
    hint: t.hintReturned,
    align: "end",
    cell: (row) => formatCount(row.returned),
    sortValue: (row) => row.returned,
  };
  const deliveredSales: ReportColumn<AdsRow> = {
    key: "deliveredSales",
    header: t.colDeliveredSales,
    align: "end",
    cell: (row) => money(row.deliveredSales),
    sortValue: (row) => row.deliveredSales,
    csv: (row) => csv(row.deliveredSales),
  };
  const costPerDelivered: ReportColumn<AdsRow> = {
    key: "cpd",
    header: t.colCpd,
    hint: t.hintCpd,
    align: "end",
    cell: (row) => money(row.costPerDelivered),
    sortValue: (row) => row.costPerDelivered,
    csv: (row) => csv(row.costPerDelivered),
  };
  const roas: ReportColumn<AdsRow> = {
    key: "roas",
    header: t.colRoas,
    hint: t.hintRoas,
    align: "end",
    // Below 1 the delivered sales do not even cover the ads: the figure says it, and so does its colour.
    cell: (row) => (
      <bdi dir="ltr" className={cn(row.roas !== null && row.roas < 1 && "font-medium text-danger")}>
        {formatRoas(row.roas)}
      </bdi>
    ),
    sortValue: (row) => row.roas,
  };
  const profit: ReportColumn<AdsRow> = {
    key: "profit",
    header: t.colProfit,
    hint: t.hintProfit,
    align: "end",
    cell: (row) => {
      if (profitColumn === "loading") return <SkeletonBar className="my-1 ms-auto w-16" />;
      if (row.profit === null) return <span title={t.profitUnreadable}>{DASH}</span>;
      // A loss carries its minus sign; the colour only repeats it.
      return (
        <bdi dir="ltr" className={cn("font-medium", row.profit < 0 ? "text-danger" : "text-success")}>
          {money(row.profit)}
        </bdi>
      );
    },
    sortValue: (row) => row.profit,
    csv: (row) => csv(row.profit),
  };
  const visitors: ReportColumn<AdsRow> = {
    key: "visitors",
    header: t.colVisitors,
    align: "end",
    cell: (row) => formatCount(row.visitors),
    sortValue: (row) => row.visitors,
  };
  const conversion: ReportColumn<AdsRow> = {
    key: "conversion",
    header: t.colConversion,
    hint: t.hintConversion,
    align: "end",
    cell: (row) => formatRate(row.conversionRate),
    sortValue: (row) => row.conversionRate,
  };
  const sales: ReportColumn<AdsRow> = {
    key: "sales",
    header: t.colSales,
    hint: t.hintSales,
    align: "end",
    cell: (row) => money(row.sales),
    sortValue: (row) => row.sales,
    csv: (row) => csv(row.sales),
  };
  const averageOrder: ReportColumn<AdsRow> = {
    key: "aov",
    header: t.colAov,
    align: "end",
    cell: (row) => money(row.averageOrderValue),
    sortValue: (row) => row.averageOrderValue,
    csv: (row) => csv(row.averageOrderValue),
  };

  const columns: ReportColumn<AdsRow>[] =
    group === null
      ? [
          name,
          platform,
          spend,
          orders,
          confirmed,
          delivered,
          returned,
          deliveredSales,
          costPerDelivered,
          roas,
          ...(profitColumn === "off" ? [] : [profit]),
        ]
      : [name, visitors, orders, conversion, sales, averageOrder, delivered, deliveredSales, ...(hasSpend ? [spend, costPerDelivered, roas] : [])];

  // ---- title line ----
  const options: Array<SegmentedOption<AdsTableMode>> = [];
  if (allowAds) options.push({ value: "ads", label: t.modeAds });
  if (!sourcesDenied) {
    options.push(
      { value: "source", label: t.modeSource },
      { value: "medium", label: t.modeMedium },
      { value: "campaign", label: t.modeCampaign },
      { value: "content", label: t.modeContent }
    );
  }

  const chip = (key: keyof AdsFilters, text: string) => (
    <button
      type="button"
      key={key}
      onClick={() => setFilters((current) => ({ ...current, [key]: "" }))}
      aria-label={fmt(t.chipClear, { label: text })}
      title={fmt(t.chipClear, { label: text })}
      className={CHIP}
    >
      <span className="min-w-0 truncate" dir="auto">
        {text}
      </span>
      <IconClose weight="bold" className="size-3.5 shrink-0" aria-hidden />
    </button>
  );

  const toolbar = (
    <>
      {options.length > 1 && <ModeStrip value={mode} onChange={changeMode} options={options} label={t.groupLabel} />}
      {group !== null && (
        <Select
          aria-label={t.touchLabel}
          title={t.touchLabel}
          value={touch}
          onChange={(event) => setTouch(event.target.value === "first" ? "first" : "last")}
          className={CONTROL}
        >
          <option value="last">{t.touchLast}</option>
          <option value="first">{t.touchFirst}</option>
        </Select>
      )}
      {group !== null && funnelList.length > 0 && (
        <Select
          aria-label={t.funnelLabel}
          title={t.funnelLabel}
          value={funnelId}
          onChange={(event) => setFunnelId(event.target.value)}
          className={cn(CONTROL, "sm:max-w-[14rem]")}
        >
          <option value="">{t.allStore}</option>
          {funnelList.map((funnel) => (
            <option key={funnel.id} value={funnel.id}>
              {funnel.name}
            </option>
          ))}
        </Select>
      )}
      {group !== null && filters.source && chip("source", fmt(t.chipSource, { name: filters.source }))}
      {group !== null && filters.campaign && chip("campaign", fmt(t.chipCampaign, { name: filters.campaign }))}
    </>
  );

  // What is counted, under the title — and, on a UTM view, the totals of everything it lists.
  let note: ReactNode;
  if (group === null) {
    const coverage = profitColumn === "ready" && costCoverage !== null && costCoverage < 100 ? costCoverage : null;
    note = (
      <>
        {t.tableNoteAds}
        {profitColumn === "ready" && <> {t.tableNoteProfit}</>}
        {coverage !== null && <> {fill(t.tableNoteCoverage, { rate: <Figure>{formatRate(coverage, 0)}</Figure> })}</>}
        {sourcesDenied && <> {t.attributionDenied}</>}
      </>
    );
  } else {
    note = (
      <>
        {touch === "first" ? t.tableNoteFirst : t.tableNoteLast}
        {data && (
          <span className="mt-1 block text-ink">
            {fill(t.totalsLine, {
              orders: countOf("order", data.totals.orders),
              sales: <Figure>{money(data.totals.sales)}</Figure>,
              delivered: <Figure>{money(data.totals.deliveredSales)}</Figure>,
            })}
            {data.totals.roas !== null && fill(t.totalsRoas, { roas: <Figure>{formatRoas(data.totals.roas)}</Figure> })}
          </span>
        )}
        {data && data.totals.spend === null && (group === "source" || group === "campaign") && <span className="mt-1 block">{t.noSpendHint}</span>}
      </>
    );
  }

  const dimension = modeLabel[mode];
  const empty = group === null ? t.emptyAds : denied ? t.attributionDenied : failed ? t.attributionFailed : filtered ? t.emptyFiltered : t.emptyBy;

  return (
    <>
      <ReportTable<AdsRow>
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        defaultSort={allowAds ? BY_SPEND : BY_SALES}
        exportName={group === null ? "zimos-ads-campaigns" : `zimos-ads-by-${group}`}
        range={range}
        title={group === null ? t.tableTitleAds : fmt(t.tableTitleBy, { dimension })}
        caption={group === null ? t.tableCaptionAds : fmt(t.tableCaptionBy, { dimension })}
        note={note}
        toolbar={toolbar}
        empty={empty}
        loading={loading}
        embedded={embedded}
      />
      {failed && <PartError message={t.attributionFailed} onRetry={attribution.retry} className={embedded ? "mx-3 mb-3" : undefined} />}
      {group === null && onRetryProfit && <PartError message={t.profitFailed} onRetry={onRetryProfit} className={embedded ? "mx-3 mb-3" : undefined} />}
    </>
  );
}

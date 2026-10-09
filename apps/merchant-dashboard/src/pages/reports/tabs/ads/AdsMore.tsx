import {
  profitGetPnl,
  profitListAdSpend,
  reportsGetSales,
  type InsightsAttribution,
  type ProfitAdSpendEntry,
  type ProfitAdSpendList,
  type ProfitCampaigns,
  type ProfitPnl,
  type ProfitRow,
  type ProfitStatement,
  type ReportsChannelRow,
  type ReportsSales,
} from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { BarChart, ComparisonLineChart, LineAreaChart } from "@/components/charts";
import { CopyButton } from "@/components/CopyButton";
import { ReportLegend, ReportTable, useTabData, type ReportColumn } from "@/components/report";
import { fmt, useT } from "@/i18n/LocaleContext";
import { AD_PLATFORM_NAMES, adPlatformName } from "@/lib/adPlatforms";
import { formatAxisDate, formatCount, formatWindow } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { formatDate } from "@/lib/format";
import { formatCompactMoney, type ReportRange } from "@/lib/reportRange";
import { DEFAULT_ATTRIBUTION, attributionKey, loadAttribution } from "./adsData";
import { formatRate, useAdsMoney } from "./adsFormat";
import { ADS_STRINGS } from "./adsStrings";
import { SectionLoad } from "./parts";

/**
 * The bodies of the ads tab's «تفاصيل أكتر»: everything else the old ad-spend,
 * sales-sources and profit screens showed for this subject. Each is the inside
 * of an `AccordionSection`, which does not mount its body until it is opened —
 * so a body that calls `useTabData` asks for its data on open, once per range.
 * The tables are `ReportTable`s without a card of their own (`embedded`):
 * sortable and exportable like the tab's main one.
 */

interface SectionProps {
  workspaceId: string;
  range: ReportRange;
}

// --------------------------------------------- campaigns without spend --

type Unmatched = ProfitCampaigns["withoutSpend"][number];

/** utm_campaign values that brought orders in the range but have no spend recorded (already in the tab's main answer). */
export function UnmatchedCampaigns({ rows, currency, range }: { rows: readonly Unmatched[]; currency: string; range: ReportRange }) {
  const t = useT(ADS_STRINGS);
  const { money, csv } = useAdsMoney(currency);
  const columns: ReportColumn<Unmatched>[] = [
    { key: "campaign", header: t.colCampaignInLink, cell: (row) => row.campaign, sortValue: (row) => row.campaign },
    { key: "orders", header: t.colOrders, align: "end", cell: (row) => formatCount(row.orders), sortValue: (row) => row.orders },
    { key: "delivered", header: t.colDelivered, align: "end", cell: (row) => formatCount(row.delivered), sortValue: (row) => row.delivered },
    {
      key: "sales",
      header: t.colSales,
      hint: t.hintSales,
      align: "end",
      cell: (row) => money(row.salesAmount),
      sortValue: (row) => row.salesAmount,
      csv: (row) => csv(row.salesAmount),
    },
  ];
  return (
    <ReportTable<Unmatched>
      embedded
      columns={columns}
      rows={rows}
      rowKey={(row) => row.campaign}
      defaultSort={{ key: "orders", dir: "desc" }}
      exportName="zimos-ads-campaigns-without-spend"
      range={range}
      caption={t.moreUnmatchedTitle}
    />
  );
}

// ------------------------------------------------- profit per campaign --

/**
 * The profit statement grouped by campaign, as the profit page shows it — every
 * row the P&L has, also those the main table could not join (orders with no
 * campaign, a campaign known to the P&L under another name). Both versions of
 * the profit sit side by side: what finished orders left, and what is expected
 * once the open ones arrive.
 */
export function ProfitByCampaign({ pnl, range }: { pnl: ProfitPnl; range: ReportRange }) {
  const t = useT(ADS_STRINGS);
  const { money, csv } = useAdsMoney(pnl.currency);
  // As on the profit page: a row with no order and no spend says nothing.
  const rows = pnl.rows.filter((row) => row.orders.delivered + row.orders.returned + row.orders.open > 0 || row.actual.adSpend > 0);
  const costs = (statement: ProfitStatement) =>
    statement.costOfGoods + statement.shipping + statement.returnShipping + statement.fees + statement.zimosFees;
  const label = (row: ProfitRow) => row.label || row.key || t.noCampaign;

  const columns: ReportColumn<ProfitRow>[] = [
    { key: "campaign", header: t.colCampaign, cell: label, sortValue: label },
    {
      key: "net",
      header: t.colProfit,
      hint: t.hintProfit,
      align: "end",
      cell: (row) => (
        <bdi dir="ltr" className={cn("font-medium", row.actual.netProfit < 0 ? "text-danger" : "text-ink")}>
          {money(row.actual.netProfit)}
        </bdi>
      ),
      sortValue: (row) => row.actual.netProfit,
      csv: (row) => csv(row.actual.netProfit),
    },
    { key: "margin", header: t.colMargin, align: "end", cell: (row) => formatRate(row.actual.margin), sortValue: (row) => row.actual.margin },
    {
      key: "revenue",
      header: t.colDeliveredSales,
      align: "end",
      cell: (row) => money(row.actual.revenue),
      sortValue: (row) => row.actual.revenue,
      csv: (row) => csv(row.actual.revenue),
    },
    {
      key: "costs",
      header: t.colCosts,
      hint: t.hintCosts,
      align: "end",
      cell: (row) => money(costs(row.actual)),
      sortValue: (row) => costs(row.actual),
      csv: (row) => csv(costs(row.actual)),
    },
    {
      key: "ads",
      header: t.colAdsCost,
      align: "end",
      cell: (row) => money(row.actual.adSpend),
      sortValue: (row) => row.actual.adSpend,
      csv: (row) => csv(row.actual.adSpend),
    },
    {
      key: "delivered",
      header: t.colDelivered,
      align: "end",
      cell: (row) => formatCount(Math.round(row.orders.delivered)),
      sortValue: (row) => row.orders.delivered,
    },
    {
      key: "returned",
      header: t.colReturned,
      align: "end",
      cell: (row) => formatCount(Math.round(row.orders.returned)),
      sortValue: (row) => row.orders.returned,
    },
    {
      key: "projected",
      header: t.colProjected,
      hint: t.hintProjected,
      align: "end",
      cell: (row) => money(row.projected.netProfit),
      sortValue: (row) => row.projected.netProfit,
      csv: (row) => csv(row.projected.netProfit),
    },
    {
      key: "maxCpa",
      header: t.colMaxCpa,
      hint: t.hintMaxCpa,
      align: "end",
      cell: (row) => money(row.maxCpa),
      sortValue: (row) => row.maxCpa,
      csv: (row) => csv(row.maxCpa),
    },
  ];

  return (
    <ReportTable<ProfitRow>
      embedded
      columns={columns}
      rows={rows}
      rowKey={(row) => row.key || "__none"}
      defaultSort={{ key: "net", dir: "desc" }}
      exportName="zimos-ads-profit-by-campaign"
      range={range}
      caption={t.moreProfitTitle}
      empty={t.moreProfitEmpty}
    />
  );
}

// ---------------------------------------------- spend and sales by day --

/**
 * Spend over time — the nearest the API comes to "spend against delivered
 * sales, day by day": the P&L's day rows. Each day carries the ad spend
 * recorded for it and the revenue of the orders PLACED that day that have
 * since been delivered — of the whole store, not of the ads alone (the note
 * says so, and that the last days' orders are still on the road).
 */
export function SpendByDay({ workspaceId, range }: SectionProps) {
  const days = useTabData<ProfitPnl>("ads:pnl-day", workspaceId, range, () =>
    profitGetPnl(apiClient, workspaceId, { from: range.from, to: range.to, groupBy: "day" })
  );
  return <SectionLoad query={days}>{(pnl) => <SpendByDayChart pnl={pnl} />}</SectionLoad>;
}

function SpendByDayChart({ pnl }: { pnl: ProfitPnl }) {
  const t = useT(ADS_STRINGS);
  const { money, shown } = useAdsMoney(pnl.currency);
  const points = pnl.rows.map((row) => ({ label: formatAxisDate(row.key), value: row.actual.revenue, previous: row.actual.adSpend }));

  if (points.every((point) => point.value === 0 && point.previous === 0)) {
    return <p className="py-6 text-center text-sm leading-6 text-pretty text-ink-soft">{t.dailyEmpty}</p>;
  }
  return (
    <div className="min-w-0">
      <p className="text-[13px] leading-5 text-pretty text-ink-soft">{t.dailyNote}</p>
      <div className="mt-2 mb-3">
        <ReportLegend
          items={[
            { label: t.dailySales, swatch: "primary" },
            { label: t.dailySpend, swatch: "neutral", dashed: true },
          ]}
        />
      </div>
      {/* The chart sets dir="ltr" on itself: a time axis runs left to right in Arabic too. */}
      <ComparisonLineChart
        points={points}
        format={(value) => money(value)}
        formatAxis={(value) => formatCompactMoney(shown(value))}
        height={220}
        summary={t.dailySummary}
        currentLabel={t.dailySales}
        previousLabel={t.dailySpend}
      />
    </div>
  );
}

// ------------------------------------------------------------ spend log --

/** Every recorded amount of the range, read-only. Adding, importing and deleting stay on the Ad spend page. */
export function SpendEntries({ workspaceId, range }: SectionProps) {
  // This endpoint takes days, not instants: the days picked in the hub's range.
  const entries = useTabData<ProfitAdSpendList>("ads:entries", workspaceId, range, () =>
    profitListAdSpend(apiClient, workspaceId, { from: range.fromDay, to: range.toDay, limit: 500 })
  );
  return (
    <SectionLoad query={entries} flush>
      {(list) => <SpendEntriesTable list={list} range={range} />}
    </SectionLoad>
  );
}

function SpendEntriesTable({ list, range }: { list: ProfitAdSpendList; range: ReportRange }) {
  const t = useT(ADS_STRINGS);
  const { money, csv } = useAdsMoney(list.currency);
  const entered: Record<ProfitAdSpendEntry["source"], string> = { manual: t.enteredManual, csv: t.enteredCsv, sync: t.enteredSync };
  const platformLabel = (platform: string) => (AD_PLATFORM_NAMES[platform] ? adPlatformName(platform) : t.platformOther);

  const columns: ReportColumn<ProfitAdSpendEntry>[] = [
    // Sorted and exported as the day itself (YYYY-MM-DD), shown in the viewer's words.
    { key: "day", header: t.colDay, cell: (entry) => formatDate(entry.day), sortValue: (entry) => entry.day },
    {
      key: "platform",
      header: t.colPlatform,
      cell: (entry) => platformLabel(entry.platform),
      sortValue: (entry) => platformLabel(entry.platform),
    },
    { key: "campaign", header: t.colCampaign, cell: (entry) => <bdi>{entry.campaignName}</bdi>, sortValue: (entry) => entry.campaignName },
    {
      key: "spend",
      header: t.colSpend,
      align: "end",
      cell: (entry) => money(entry.spendAmount),
      sortValue: (entry) => entry.spendAmount,
      csv: (entry) => csv(entry.spendAmount),
    },
    {
      key: "impressions",
      header: t.colImpressions,
      align: "end",
      cell: (entry) => formatCount(entry.impressions),
      sortValue: (entry) => entry.impressions,
    },
    { key: "clicks", header: t.colClicks, align: "end", cell: (entry) => formatCount(entry.clicks), sortValue: (entry) => entry.clicks },
    { key: "entered", header: t.colEntered, cell: (entry) => entered[entry.source], sortValue: (entry) => entered[entry.source] },
  ];

  return (
    <ReportTable<ProfitAdSpendEntry>
      embedded
      columns={columns}
      rows={list.entries}
      rowKey={(entry) => entry.id}
      defaultSort={{ key: "day", dir: "desc" }}
      exportName="zimos-ads-spend-log"
      range={range}
      caption={t.moreEntriesTitle}
      note={
        <>
          {t.entriesNote}
          {list.total > list.entries.length && <> {fmt(t.entriesCapped, { shown: list.entries.length, total: list.total })}</>}
        </>
      }
      empty={t.entriesEmpty}
    />
  );
}

// ------------------------------------------- visitors and sales by day --

/**
 * The two daily charts of the old sales-sources screen: the store's visitors
 * and its sales, day by day. They come with the attribution report — the same
 * answer the table's «المصدر» view uses, so it is usually already in the cache.
 */
export function TrafficByDay({ workspaceId, range }: SectionProps) {
  const sources = useTabData<InsightsAttribution>(
    "ads:attribution",
    workspaceId,
    range,
    () => loadAttribution(workspaceId, range, DEFAULT_ATTRIBUTION),
    attributionKey(DEFAULT_ATTRIBUTION)
  );
  return <SectionLoad query={sources}>{(data) => <TrafficCharts data={data} />}</SectionLoad>;
}

function TrafficCharts({ data }: { data: InsightsAttribution }) {
  const t = useT(ADS_STRINGS);
  const { money } = useAdsMoney(data.currency);
  const period = formatWindow(data.range.from, data.range.to);
  const caption = "mb-2 flex items-baseline justify-between gap-3 text-sm leading-5";
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
      <figure className="min-w-0">
        <figcaption className={caption}>
          <span className="font-medium text-ink">{t.visitorsChart}</span>
          <bdi dir="ltr" className="text-ink-soft tabular-nums">
            {formatCount(data.totals.visitors)}
          </bdi>
        </figcaption>
        <BarChart
          points={data.series.map((day) => ({ label: formatAxisDate(day.date), value: day.visitors }))}
          format={formatCount}
          height={180}
          summary={fmt(t.chartOf, { what: t.visitorsChart, window: period })}
        />
      </figure>
      <figure className="min-w-0">
        <figcaption className={caption}>
          <span className="font-medium text-ink">{t.salesChart}</span>
          <bdi dir="ltr" className="text-ink-soft tabular-nums">
            {money(data.totals.sales)}
          </bdi>
        </figcaption>
        <LineAreaChart
          points={data.series.map((day) => ({ label: formatAxisDate(day.date), value: day.sales }))}
          format={(value) => money(value)}
          height={180}
          summary={fmt(t.chartOf, { what: t.salesChart, window: period })}
        />
      </figure>
    </div>
  );
}

// ------------------------------------------------------ sales by channel --

/**
 * «المبيعات حسب القناة» of the old reports overview: source and medium as one
 * row, with sessions (the sales report counts sessions; the UTM views of the
 * main table count visitors and add what was delivered).
 */
export function SalesChannels({ workspaceId, range }: SectionProps) {
  const sales = useTabData<ReportsSales>("ads:channels", workspaceId, range, () =>
    // Only `channels` is read: no comparison window is asked for.
    reportsGetSales(apiClient, workspaceId, { from: range.from, to: range.to, compare: "none" })
  );
  return (
    <SectionLoad query={sales} flush>
      {(report) => <ChannelsTable report={report} range={range} />}
    </SectionLoad>
  );
}

function ChannelsTable({ report, range }: { report: ReportsSales; range: ReportRange }) {
  const t = useT(ADS_STRINGS);
  const { money, csv } = useAdsMoney(report.currency);
  const channel = (row: ReportsChannelRow) => {
    const source = row.source === "direct" ? t.direct : row.source;
    return row.medium ? `${source} · ${row.medium}` : source;
  };
  const columns: ReportColumn<ReportsChannelRow>[] = [
    { key: "channel", header: t.colChannel, cell: channel, sortValue: channel },
    {
      key: "sales",
      header: t.colSales,
      align: "end",
      cell: (row) => money(row.sales),
      sortValue: (row) => row.sales,
      csv: (row) => csv(row.sales),
    },
    { key: "orders", header: t.colOrders, align: "end", cell: (row) => formatCount(row.orders), sortValue: (row) => row.orders },
    {
      key: "conversion",
      header: t.colConversion,
      align: "end",
      cell: (row) => formatRate(row.conversionRate),
      sortValue: (row) => row.conversionRate,
    },
    { key: "sessions", header: t.colSessions, align: "end", cell: (row) => formatCount(row.sessions), sortValue: (row) => row.sessions },
  ];
  return (
    <ReportTable<ReportsChannelRow>
      embedded
      columns={columns}
      rows={report.channels}
      rowKey={(row) => `${row.source}|${row.medium ?? ""}`}
      defaultSort={{ key: "sales", dir: "desc" }}
      exportName="zimos-sales-by-channel"
      range={range}
      caption={t.moreChannelsTitle}
      empty={t.channelsEmpty}
    />
  );
}

// ------------------------------------------------------ link parameters --

const LINK_PLATFORMS = ["meta", "tiktok", "snapchat", "google"] as const;

/** The URL parameters to paste on each ad, so its orders are matched to the campaign by name — each with a copy button. */
export function AdLinkParameters({ parameters }: { parameters: ProfitCampaigns["suggestedUrlParameters"] }) {
  const t = useT(ADS_STRINGS);
  return (
    <div className="min-w-0">
      <p className="text-[13px] leading-5 text-pretty text-ink-soft">{t.urlDesc}</p>
      <ul className="mt-3 flex flex-col gap-3">
        {LINK_PLATFORMS.map((platform) => (
          <li key={platform} className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <bdi className="text-sm font-medium text-ink">{adPlatformName(platform)}</bdi>
              <CopyButton value={parameters[platform]} label={t.copy} />
            </div>
            <code dir="ltr" className="mt-1 block overflow-x-auto rounded-xl bg-paper-sunken px-3 py-2 text-start text-xs leading-5 text-ink-soft">
              {parameters[platform]}
            </code>
          </li>
        ))}
      </ul>
    </div>
  );
}

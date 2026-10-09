import { storeReportTax, type StoreReportTaxRow } from "@store-builder/api-client";
import { BarChart } from "@/components/charts";
import { EmptyState } from "@/components/EmptyState";
import { IconCoins, IconReceipt, IconScale, IconUndo } from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { ReportChartCard, ReportKpiStrip, ReportTable, type ReportColumn } from "@/components/report";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { placeName } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { useReport } from "@/lib/reportRange";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import {
  LongerPeriodButton,
  monthLabel,
  reportMoney,
  reportRangeRefused,
  StoreReportRangeBar,
  StoreReportShell,
  useStoreReportCsv,
  useStoreReportRange,
} from "./storeReportParts";
import { STORE_REPORT_STRINGS } from "./storeReportStrings";

const STRINGS = {
  en: {
    question: "How much tax did you collect?",
    description: "Tax on the orders that were delivered or paid. Cancelled and test orders are left out.",
    collected: "Tax collected",
    collectedHint: "on {amount} of taxable sales",
    refunded: "Refunded",
    refundedHint: "the refunds' share of the tax",
    net: "Net",
    netHint: "collected, less refunded",
    exempt: "Exempt sales",
    exemptNone: "no tax-exempt order",
    exemptHint_one: "1 tax-exempt order",
    exemptHint_other: "{n} tax-exempt orders",
    chart: "Net tax month by month",
    table: "By month and governorate",
    tableHint: "Months follow the store's time zone ({zone}).",
    month: "Month",
    place: "Governorate",
    noPlace: "No address",
    orders: "Orders",
    taxable: "Taxable sales",
    tax: "Tax",
    exemptOrders: "Exempt orders",
    emptyTitle: "No tax in this period",
    emptyHint: "An order is counted here once it is delivered or paid.",
  },
  ar: {
    question: "حصّلت ضريبة قد إيه؟",
    description: "الضريبة على الأوردرات اللي اتسلّمت أو اتدفعت. الملغي والتجريبي مش محسوبين.",
    collected: "الضريبة المحصّلة",
    collectedHint: "على مبيعات خاضعة للضريبة {amount}",
    refunded: "المرتجع",
    refundedHint: "نصيب الفلوس المرتجعة من الضريبة",
    net: "الصافي",
    netHint: "المحصّل ناقص المرتجع",
    exempt: "مبيعات معفاة",
    exemptNone: "مفيش أوردرات معفاة",
    exemptHint_one: "أوردر واحد معفي",
    exemptHint_two: "أوردرين معفيين",
    exemptHint_few: "{n} أوردرات معفاة",
    exemptHint_other: "{n} أوردر معفي",
    chart: "صافي الضريبة شهر بشهر",
    table: "شهر بشهر ومحافظة بمحافظة",
    tableHint: "الشهور بتوقيت المتجر ({zone}).",
    month: "الشهر",
    place: "المحافظة",
    noPlace: "من غير عنوان",
    orders: "أوردرات",
    taxable: "مبيعات خاضعة",
    tax: "الضريبة",
    exemptOrders: "أوردرات معفاة",
    emptyTitle: "مفيش ضريبة في الفترة دي",
    emptyHint: "الأوردر بيتحسب هنا أول ما يتسلّم أو يتدفع.",
  },
} satisfies Messages;

/**
 * Reports → «تقرير الضريبة» (handoff 238, financial_reports.view): the tax on
 * delivered or paid orders for a window of days — collected, the refunds'
 * share, net and tax-exempt sales as stat cards, net tax per month as bars,
 * then the same by month and governorate in the ONE table (every column
 * sorts; its export is the server's own CSV file).
 */
export function TaxReport() {
  const t = useT(STRINGS);
  const c = useT(STORE_REPORT_STRINGS);
  const workspaceId = useWorkspaceId();
  const range = useStoreReportRange();
  const state = useReport(() => storeReportTax(apiClient, workspaceId, range.days), [workspaceId, range.days.from, range.days.to]);
  const exportCsv = useStoreReportCsv("tax", range.days, `tax-report-${range.days.from}-${range.days.to}`);

  return (
    <StoreReportShell
      slug="tax"
      title={c.tax}
      description={t.description}
      question={t.question}
      note={t.description}
      controls={<StoreReportRangeBar range={range} refused={reportRangeRefused(state.error)} />}
      state={state}
    >
      {(data) => {
        if (data.rows.length === 0) {
          return (
            <EmptyState icon={<IconReceipt aria-hidden />} title={t.emptyTitle} description={t.emptyHint} action={<LongerPeriodButton range={range} />} />
          );
        }

        const money = (minor: string | number) => reportMoney(minor, data.currency);
        /** A zero in a column most rows leave empty is noise: a dash instead. */
        const moneyOrDash = (minor: string) => (Number(minor) === 0 ? "—" : money(minor));
        const columns: ReportColumn<StoreReportTaxRow>[] = [
          { key: "month", header: t.month, cell: (row) => monthLabel(row.month), sortValue: (row) => row.month },
          {
            key: "place",
            header: t.place,
            cell: (row) => (row.place === "—" ? <span className="text-ink-soft">{t.noPlace}</span> : <bdi>{placeName(row.place)}</bdi>),
            sortValue: (row) => (row.place === "—" ? null : placeName(row.place)),
          },
          { key: "orders", header: t.orders, align: "end", cell: (row) => formatCount(row.orders), sortValue: (row) => row.orders },
          { key: "taxable", header: t.taxable, align: "end", cell: (row) => money(row.taxable), sortValue: (row) => Number(row.taxable) },
          { key: "tax", header: t.tax, align: "end", cell: (row) => money(row.tax), sortValue: (row) => Number(row.tax) },
          {
            key: "refunded",
            header: t.refunded,
            align: "end",
            cell: (row) => moneyOrDash(row.taxRefunded),
            sortValue: (row) => Number(row.taxRefunded),
            hideBelow: "md",
          },
          {
            key: "net",
            header: t.net,
            align: "end",
            cell: (row) => <bdi className="font-semibold">{money(row.netTax)}</bdi>,
            sortValue: (row) => Number(row.netTax),
          },
          {
            key: "exemptOrders",
            header: t.exemptOrders,
            align: "end",
            cell: (row) => (row.exemptOrders === 0 ? "—" : formatCount(row.exemptOrders)),
            sortValue: (row) => row.exemptOrders,
            hideBelow: "lg",
          },
          {
            key: "exemptSales",
            header: t.exempt,
            align: "end",
            cell: (row) => moneyOrDash(row.exemptSales),
            sortValue: (row) => Number(row.exemptSales),
            hideBelow: "lg",
          },
        ];

        // Net tax of each month, every governorate together, oldest month first.
        const byMonth = new Map<string, number>();
        for (const row of data.rows) byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + Number(row.netTax));
        const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));

        return (
          <>
            <ReportKpiStrip sparkline={false}>
              <KpiCard
                label={t.collected}
                value={money(data.totals.tax)}
                hint={fmt(t.collectedHint, { amount: money(data.totals.taxable) })}
                icon={<IconReceipt />}
              />
              <KpiCard label={t.refunded} value={money(data.totals.taxRefunded)} hint={t.refundedHint} icon={<IconUndo />} />
              <KpiCard label={t.net} value={money(data.totals.netTax)} hint={t.netHint} icon={<IconScale />} />
              <KpiCard
                label={t.exempt}
                value={money(data.totals.exemptSales)}
                hint={data.totals.exemptOrders > 0 ? pluralOf(t, "exemptHint", data.totals.exemptOrders) : t.exemptNone}
                icon={<IconCoins />}
              />
            </ReportKpiStrip>

            {months.length > 1 && (
              <ReportChartCard title={t.chart} height={220}>
                {(height) => (
                  <BarChart points={months.map(([month, value]) => ({ label: monthLabel(month), value: Math.max(0, value) }))} format={money} height={height} summary={t.chart} />
                )}
              </ReportChartCard>
            )}

            <ReportTable
              columns={columns}
              rows={data.rows}
              rowKey={(row) => `${row.month}:${row.place}`}
              exportName="tax-report"
              onExport={exportCsv}
              caption={t.table}
              note={fmt(t.tableHint, { zone: data.timezone })}
            />
          </>
        );
      }}
    </StoreReportShell>
  );
}

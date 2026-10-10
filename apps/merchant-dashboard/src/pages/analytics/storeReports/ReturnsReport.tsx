import { storeReportReturns, type StoreReportReturnProduct } from "@store-builder/api-client";
import { HBarList } from "@/components/charts";
import { EmptyState } from "@/components/EmptyState";
import { IconCash, IconPercent, IconReturns } from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { ReportKpiStrip, ReportTable, type ReportColumn } from "@/components/report";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, getLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { humanize } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { useReport } from "@/lib/reportRange";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatRate, RateBar } from "../reports/parts";
import {
  LongerPeriodButton,
  reportMoney,
  reportRangeRefused,
  StoreReportCard,
  StoreReportRangeBar,
  StoreReportShell,
  useStoreReportCsv,
  useStoreReportRange,
} from "./storeReportParts";
import { STORE_REPORT_STRINGS } from "./storeReportStrings";

const STRINGS = {
  en: {
    question: "Why do orders come back?",
    description: "Why orders come back, and the products that come back most.",
    rate: "Return rate",
    rateHint: "pieces asked back out of pieces delivered, for orders of this period",
    requests: "Return requests",
    requestsHint: "{units} asked back",
    requestsNone: "nothing asked back",
    refunded: "Refunded",
    refundsNone: "no refund processed",
    refunds_one: "1 refund processed",
    refunds_other: "{n} refunds processed",
    reasons: "By reason",
    reasonsHint: "Return requests opened in this period.",
    reason_damaged: "Damaged",
    reason_defective: "Defective",
    reason_wrong_item: "Wrong item",
    reason_not_as_described: "Not as described",
    reason_no_longer_wanted: "No longer wanted",
    reason_arrived_late: "Arrived late",
    reason_other: "Other reason",
    requests_one: "1 request",
    requests_other: "{n} requests",
    reasonCaption: "{units} · {completed} received or refunded · {rejected} rejected",
    noReasons: "No return requests were opened in this period.",
    products: "By product",
    productsHint: "For orders placed in this period: pieces delivered, and pieces in return requests that were not rejected.",
    delivered: "Delivered",
    returned: "Returned",
    returnRate: "Return rate",
    reasonsColumn: "Reasons",
    noName: "Deleted product",
    high: "High",
    noProducts: "Nothing was delivered or asked back in this period.",
    emptyTitle: "No returns in this period",
    emptyHint: "Return requests and refunds appear here as they come in.",
  },
  ar: {
    question: "لماذا تُرجَع الطلبات؟",
    description: "أسباب إرجاع الطلبات، والمنتجات الأكثر إرجاعًا.",
    rate: "نسبة المرتجع",
    rateHint: "القطع المطلوب إرجاعها من القطع التي سُلّمت، لطلبات هذه الفترة",
    requests: "طلبات الإرجاع",
    requestsHint: "مطلوب إرجاع {units}",
    requestsNone: "لا شيء مطلوب إرجاعه",
    refunded: "مبالغ مستردّة",
    refundsNone: "لا توجد مبالغ مستردّة",
    refunds_one: "عملية استرداد واحدة",
    refunds_two: "عمليتا استرداد",
    refunds_few: "{n} عمليات استرداد",
    refunds_other: "{n} عملية استرداد",
    reasons: "بحسب السبب",
    reasonsHint: "طلبات الإرجاع التي فُتحت في هذه الفترة.",
    reason_damaged: "تالف",
    reason_defective: "عيب صناعة",
    reason_wrong_item: "منتج خاطئ",
    reason_not_as_described: "لا يطابق الوصف",
    reason_no_longer_wanted: "لم يعد مطلوبًا",
    reason_arrived_late: "وصل متأخرًا",
    reason_other: "سبب آخر",
    requests_one: "طلب إرجاع واحد",
    requests_two: "طلبا إرجاع",
    requests_few: "{n} طلبات إرجاع",
    requests_other: "{n} طلب إرجاع",
    reasonCaption: "{units} · {completed} استُلم أو استُرد مبلغه · {rejected} مرفوض",
    noReasons: "لم تُفتح طلبات إرجاع في هذه الفترة.",
    products: "بحسب المنتج",
    productsHint: "لطلبات هذه الفترة: القطع التي سُلّمت، والقطع التي في طلبات إرجاع لم تُرفض.",
    delivered: "سُلّم",
    returned: "أُرجع",
    returnRate: "نسبة المرتجع",
    reasonsColumn: "الأسباب",
    noName: "منتج محذوف",
    high: "مرتفعة",
    noProducts: "لم يُسلَّم شيء أو يُطلب إرجاعه في هذه الفترة.",
    emptyTitle: "لا توجد مرتجعات في هذه الفترة",
    emptyHint: "تظهر هنا طلبات الإرجاع والمبالغ المستردّة فور حدوثها.",
  },
} satisfies Messages;

/** The return rate reads as healthy up to here, and as a problem from HIGH_RATE (the Products tab's own limits). */
const GOOD_RATE = 15;
const HIGH_RATE = 30;

/**
 * Reports → «المرتجعات» (analytics.view): the return rate, the
 * requests and the money refunded as stat cards; a bar per reason; and the
 * products in the ONE table — delivered, asked back, the rate (a high one
 * named as well as coloured) and why. Its export is the server's own file.
 */
export function ReturnsReport() {
  const t = useT(STRINGS);
  const c = useT(STORE_REPORT_STRINGS);
  const workspaceId = useWorkspaceId();
  const range = useStoreReportRange();
  const state = useReport(() => storeReportReturns(apiClient, workspaceId, range.days), [workspaceId, range.days.from, range.days.to]);
  const exportCsv = useStoreReportCsv("returns", range.days, `returns-by-product-${range.days.from}-${range.days.to}`);

  /** A reason code in words; a code this screen does not know is shown as written. */
  const reasonLabel = (code: string) => (t as Record<string, string>)[`reason_${code}`] ?? humanize(code);
  const listJoin = getLocale() === "ar" ? "، " : ", ";

  return (
    <StoreReportShell
      slug="returns"
      title={c.returns}
      description={t.description}
      question={t.question}
      controls={<StoreReportRangeBar range={range} refused={reportRangeRefused(state.error)} />}
      state={state}
    >
      {(data) => {
        if (data.reasons.length === 0 && data.products.length === 0 && data.totals.refunds === 0) {
          return <EmptyState icon={<IconReturns aria-hidden />} title={t.emptyTitle} description={t.emptyHint} action={<LongerPeriodButton range={range} />} />;
        }

        const reasonsOf = (row: StoreReportReturnProduct) => row.reasons.map(reasonLabel).join(listJoin);
        const columns: ReportColumn<StoreReportReturnProduct>[] = [
          { key: "name", header: c.product, cell: (row) => row.name || t.noName, sortValue: (row) => row.name },
          { key: "delivered", header: t.delivered, align: "end", cell: (row) => formatCount(row.delivered), sortValue: (row) => row.delivered },
          { key: "returned", header: t.returned, align: "end", cell: (row) => formatCount(row.returned), sortValue: (row) => row.returned },
          {
            key: "rate",
            header: t.returnRate,
            cell: (row) => (
              <span className="inline-flex items-center gap-2">
                <RateBar percent={row.returnRate} good={GOOD_RATE} bad={HIGH_RATE} inverted />
                {/* The word says it too: a high rate is not left to the red bar alone. */}
                {row.returnRate !== null && row.returnRate >= HIGH_RATE && <StatusBadge value="high" tone="danger" text={t.high} />}
              </span>
            ),
            sortValue: (row) => row.returnRate,
            csv: (row) => row.returnRate,
          },
          {
            key: "reasons",
            header: t.reasonsColumn,
            cell: (row) => (row.reasons.length === 0 ? "—" : <span className="text-ink-soft">{reasonsOf(row)}</span>),
            csv: (row) => reasonsOf(row),
            hideBelow: "md",
          },
        ];

        return (
          <>
            <ReportKpiStrip sparkline={false}>
              <KpiCard label={t.rate} value={formatRate(data.totals.returnRate)} hint={t.rateHint} icon={<IconPercent />} goodWhen="down" />
              <KpiCard
                label={t.requests}
                value={formatCount(data.totals.requests)}
                hint={data.totals.units > 0 ? fmt(t.requestsHint, { units: countOf("piece", data.totals.units) }) : t.requestsNone}
                icon={<IconReturns />}
                to="/returns"
              />
              <KpiCard
                label={t.refunded}
                value={reportMoney(data.totals.refunded, data.currency)}
                hint={data.totals.refunds > 0 ? pluralOf(t, "refunds", data.totals.refunds) : t.refundsNone}
                icon={<IconCash />}
              />
            </ReportKpiStrip>

            <StoreReportCard title={t.reasons} note={t.reasonsHint}>
              <HBarList
                rows={data.reasons.map((row) => ({
                  label: reasonLabel(row.reason),
                  value: row.requests,
                  caption: fmt(t.reasonCaption, { units: countOf("piece", row.units), completed: row.completed, rejected: row.rejected }),
                }))}
                format={(value) => pluralOf(t, "requests", value)}
                emptyLabel={<p className="text-sm leading-6 text-ink-soft">{t.noReasons}</p>}
              />
            </StoreReportCard>

            <ReportTable
              columns={columns}
              rows={data.products}
              rowKey={(row) => row.productId ?? `gone:${row.name ?? ""}`}
              rowTo={(row) => (row.productId ? `/catalog/${row.productId}` : null)}
              defaultSort={{ key: "returned", dir: "desc" }}
              exportName="returns-by-product"
              onExport={exportCsv}
              caption={t.products}
              note={t.productsHint}
              empty={t.noProducts}
            />
          </>
        );
      }}
    </StoreReportShell>
  );
}

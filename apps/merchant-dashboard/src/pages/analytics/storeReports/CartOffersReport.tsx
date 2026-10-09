import { storeReportCartOffers, type StoreReportCartOfferRule } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { HBarList } from "@/components/charts";
import { EmptyState } from "@/components/EmptyState";
import { IconArrowUp, IconBag, IconGift } from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { ReportKpiStrip, ReportTable, type ReportColumn } from "@/components/report";
import { StatusBadge } from "@/components/StatusBadge";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { countOf, pluralOf } from "@/lib/plural";
import { useReport } from "@/lib/reportRange";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
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
    question: "What did each offer and gift bring?",
    description: "What each cart offer and each free gift brought. Cancelled and test orders are left out.",
    storeAverage: "Average order across the store",
    chart: "Offer sales",
    chartNote: "What the offered lines sold for, the largest first.",
    table: "Offer by offer",
    rule: "Offer",
    kind: "Kind",
    kind_cart_offer: "Cart offer",
    kind_free_gift: "Free gift",
    offerSales: "Offer sales",
    averageOrder: "Average order",
    higher: "higher than the store's average",
    note: "Only orders placed since offers are written on the order are counted — older orders carry no offer name.",
    emptyTitle: "No orders with an offer or a gift in this period",
    emptyHint: "An order shows here once a cart offer or a free gift is part of it. Orders from before offers were written on the order are not counted.",
  },
  ar: {
    question: "كل عرض وكل هدية جابوا إيه؟",
    description: "كل عرض سلة وكل هدية جابوا إيه. الملغي والتجريبي مش محسوبين.",
    storeAverage: "متوسط الأوردر في المتجر كله",
    chart: "مبيعات العروض",
    chartNote: "المنتجات اللي في العرض اتباعت بكام، الأكبر في الأول.",
    table: "عرض بعرض",
    rule: "العرض",
    kind: "النوع",
    kind_cart_offer: "عرض سلة",
    kind_free_gift: "هدية",
    offerSales: "مبيعات العرض",
    averageOrder: "متوسط الأوردر",
    higher: "أعلى من متوسط المتجر",
    note: "بيتحسب بس الأوردرات اللي اتعملت من ساعة ما اسم العرض بقى يتسجّل على الأوردر — الأقدم مفيهاش اسم العرض.",
    emptyTitle: "مفيش أوردرات فيها عرض أو هدية في الفترة دي",
    emptyHint: "الأوردر بيظهر هنا أول ما يبقى فيه عرض سلة أو هدية. الأوردرات اللي قبل ما اسم العرض يتسجّل على الأوردر مش محسوبة.",
  },
} satisfies Messages;

const CHART_ROWS = 6;

/**
 * Reports → «عروض السلة والهدايا» (handoff 256, analytics.view): the store's
 * own average order as the yardstick, what each rule's lines sold for as
 * bars, and a row per rule — orders, units, sales, and the average of the
 * orders that had it, marked when it beats the store's.
 */
export function CartOffersReport() {
  const t = useT(STRINGS);
  const c = useT(STORE_REPORT_STRINGS);
  const workspaceId = useWorkspaceId();
  const range = useStoreReportRange();
  const state = useReport(() => storeReportCartOffers(apiClient, workspaceId, range.days), [workspaceId, range.days.from, range.days.to]);
  const exportCsv = useStoreReportCsv("cart-offers", range.days, `cart-offers-${range.days.from}-${range.days.to}`);

  return (
    <StoreReportShell
      slug="cart-offers"
      title={c.cartOffers}
      description={t.description}
      question={t.question}
      note={t.description}
      controls={<StoreReportRangeBar range={range} refused={reportRangeRefused(state.error)} />}
      state={state}
    >
      {(data) => {
        if (data.rules.length === 0) {
          return <EmptyState icon={<IconGift aria-hidden />} title={t.emptyTitle} description={t.emptyHint} action={<LongerPeriodButton range={range} />} />;
        }

        const money = (minor: string | number) => reportMoney(minor, data.currency);
        const storeAverage = Number(data.store.averageOrder);
        const columns: ReportColumn<StoreReportCartOfferRule>[] = [
          { key: "name", header: t.rule, cell: (row) => row.name, sortValue: (row) => row.name },
          {
            key: "kind",
            header: t.kind,
            cell: (row) => <StatusBadge value={row.kind} tone={row.kind === "free_gift" ? "success" : "info"} text={t[`kind_${row.kind}`] ?? row.kind} />,
            sortValue: (row) => row.kind,
            csv: (row) => row.kind,
          },
          { key: "orders", header: c.orders, align: "end", cell: (row) => formatCount(row.orders), sortValue: (row) => row.orders },
          { key: "units", header: c.units, align: "end", cell: (row) => formatCount(row.units), sortValue: (row) => row.units },
          { key: "offerSales", header: t.offerSales, align: "end", cell: (row) => money(row.lineRevenue), sortValue: (row) => Number(row.lineRevenue) },
          {
            key: "averageOrder",
            header: t.averageOrder,
            align: "end",
            cell: (row) => {
              const higher = Number(row.averageOrder) > storeAverage;
              return (
                // Green and an arrow, and the words for a screen reader: never the colour alone.
                <span className={cn("inline-flex items-center gap-1 font-medium", higher ? "text-success" : "text-ink")}>
                  {higher && <IconArrowUp className="size-3.5" weight="bold" aria-hidden />}
                  <bdi>{money(row.averageOrder)}</bdi>
                  {higher && <span className="sr-only">{t.higher}</span>}
                </span>
              );
            },
            sortValue: (row) => Number(row.averageOrder),
          },
        ];

        const seen = new Map<string, number>();
        const bars = [...data.rules]
          .sort((a, b) => Number(b.lineRevenue) - Number(a.lineRevenue))
          .slice(0, CHART_ROWS)
          .map((row) => {
            // Two rules may share a name; the chart keys its rows by label.
            const times = (seen.get(row.name) ?? 0) + 1;
            seen.set(row.name, times);
            return {
              label: times > 1 ? `${row.name} (${formatCount(times)})` : row.name,
              value: Number(row.lineRevenue),
              caption: `${pluralOf(c, "ordersCount", row.orders)} · ${countOf("piece", row.units)}`,
            };
          });

        return (
          <>
            <ReportKpiStrip sparkline={false}>
              <KpiCard label={t.storeAverage} value={money(storeAverage)} hint={pluralOf(c, "ordersCount", data.store.orders)} icon={<IconBag />} />
            </ReportKpiStrip>

            <StoreReportCard title={t.chart} note={t.chartNote}>
              <HBarList rows={bars} format={money} />
            </StoreReportCard>

            <ReportTable
              columns={columns}
              rows={data.rules}
              rowKey={(row) => `${row.kind}:${row.name}`}
              defaultSort={{ key: "offerSales", dir: "desc" }}
              exportName="cart-offers"
              onExport={exportCsv}
              caption={t.table}
              note={t.note}
            />
          </>
        );
      }}
    </StoreReportShell>
  );
}

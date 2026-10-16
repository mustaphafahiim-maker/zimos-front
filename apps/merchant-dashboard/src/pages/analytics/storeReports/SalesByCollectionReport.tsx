import { storeReportSalesByCollection } from "@store-builder/api-client";
import { HBarList } from "@/components/charts";
import { EmptyState } from "@/components/EmptyState";
import { IconTree } from "@/components/icons";
import { ReportTable, type ReportColumn } from "@/components/report";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
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
    question: "Which collection sells?",
    description: "What each collection sold. Cancelled, rejected and test orders are left out.",
    chart: "Revenue by collection",
    chartHint: "The top {n} — the rest are in the table.",
    table: "Collections",
    collection: "Collection",
    products: "Products",
    orders: "Orders",
    units: "Units",
    revenue: "Revenue",
    delivered: "Delivered",
    uncollected: "Not in any collection",
    note: "A product in several collections counts in each, so the rows don't add up to the store's total.",
    emptyTitle: "No sales in this period",
    emptyHint: "Collections appear here once their products are ordered.",
  },
  ar: {
    question: "أي مجموعة تبيع أكثر؟",
    description: "مبيعات كل مجموعة. الملغاة والمرفوضة والتجريبية غير محتسبة.",
    chart: "المبيعات بحسب المجموعة",
    chartHint: "أعلى {n}، والباقي في الجدول.",
    table: "المجموعات",
    collection: "المجموعة",
    products: "منتجات",
    orders: "طلبات",
    units: "قطع",
    revenue: "مبيعات",
    delivered: "سُلّم فعلًا",
    uncollected: "منتجات بدون مجموعة",
    note: "المنتج الموجود في أكثر من مجموعة يُحتسب في كل منها، فمجموع الصفوف ليس إجمالي المتجر.",
    emptyTitle: "لا توجد مبيعات في هذه الفترة",
    emptyHint: "تظهر المجموعات هنا فور طلب منتجاتها.",
  },
} satisfies Messages;

/** A collection's line, or the closing line for products that are in none (no orders, products or delivered figure for it). */
interface Row {
  id: string;
  name: string;
  /** The "not in any collection" line. */
  rest: boolean;
  units: number;
  orders: number | null;
  products: number | null;
  revenue: string;
  deliveredRevenue: string | null;
}

const CHART_ROWS = 6;

/**
 * Reports → «المبيعات حسب المجموعة» (analytics.view): revenue of
 * the top collections as bars, then every collection in the ONE table —
 * products, orders, units, revenue and what of it was actually delivered —
 * with the products that sit in no collection as their own line.
 */
export function SalesByCollectionReport() {
  const t = useT(STRINGS);
  const c = useT(STORE_REPORT_STRINGS);
  const workspaceId = useWorkspaceId();
  const range = useStoreReportRange();
  const state = useReport(
    () => storeReportSalesByCollection(apiClient, workspaceId, range.days),
    [workspaceId, range.days.from, range.days.to]
  );
  const exportCsv = useStoreReportCsv("sales-by-collection", range.days, `sales-by-collection-${range.days.from}-${range.days.to}`);

  return (
    <StoreReportShell
      slug="sales-by-collection"
      title={c.collections}
      description={t.description}
      question={t.question}
      note={t.description}
      controls={<StoreReportRangeBar range={range} refused={reportRangeRefused(state.error)} />}
      state={state}
    >
      {(data) => {
        const hasRest = data.uncollected.units > 0 || Number(data.uncollected.revenue) > 0;
        if (data.collections.length === 0 && !hasRest) {
          return <EmptyState icon={<IconTree aria-hidden />} title={t.emptyTitle} description={t.emptyHint} action={<LongerPeriodButton range={range} />} />;
        }

        const money = (minor: string | number) => reportMoney(minor, data.currency);
        const rows: Row[] = data.collections.map((row) => ({ ...row, id: row.collectionId, rest: false }));
        if (hasRest) {
          rows.push({
            id: "rest",
            name: t.uncollected,
            rest: true,
            units: data.uncollected.units,
            orders: null,
            products: null,
            revenue: data.uncollected.revenue,
            deliveredRevenue: null,
          });
        }
        const count = (value: number | null) => (value === null ? "—" : formatCount(value));
        const columns: ReportColumn<Row>[] = [
          { key: "name", header: t.collection, cell: (row) => row.name, sortValue: (row) => row.name },
          { key: "products", header: t.products, align: "end", cell: (row) => count(row.products), sortValue: (row) => row.products, hideBelow: "md" },
          { key: "orders", header: t.orders, align: "end", cell: (row) => count(row.orders), sortValue: (row) => row.orders },
          { key: "units", header: t.units, align: "end", cell: (row) => formatCount(row.units), sortValue: (row) => row.units },
          {
            key: "revenue",
            header: t.revenue,
            align: "end",
            cell: (row) => <bdi className="font-semibold">{money(row.revenue)}</bdi>,
            sortValue: (row) => Number(row.revenue),
          },
          {
            key: "delivered",
            header: t.delivered,
            align: "end",
            cell: (row) => (row.deliveredRevenue === null ? "—" : money(row.deliveredRevenue)),
            sortValue: (row) => (row.deliveredRevenue === null ? null : Number(row.deliveredRevenue)),
          },
        ];

        // The API lists collections by revenue already; the chart takes the top of it, then what is outside every collection.
        const seen = new Map<string, number>();
        const bars = rows
          .filter((row) => !row.rest)
          .slice(0, CHART_ROWS)
          .concat(rows.filter((row) => row.rest))
          .map((row) => {
            // Two collections may share a name (under different parents); the chart keys its rows by label.
            const times = (seen.get(row.name) ?? 0) + 1;
            seen.set(row.name, times);
            return {
              label: times > 1 ? `${row.name} (${formatCount(times)})` : row.name,
              value: Number(row.revenue),
              caption: [countOf("piece", row.units), ...(row.orders === null ? [] : [pluralOf(c, "ordersCount", row.orders)])].join(" · "),
            };
          });

        return (
          <>
            <StoreReportCard title={t.chart} note={data.collections.length > CHART_ROWS ? fmt(t.chartHint, { n: CHART_ROWS }) : undefined}>
              <HBarList rows={bars} format={money} />
            </StoreReportCard>

            <ReportTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              exportName="sales-by-collection"
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

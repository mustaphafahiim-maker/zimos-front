import { useState } from "react";
import { storeReportOrderHeatmap, type StoreReportHeatmapCell } from "@store-builder/api-client";
import { BarChart, HBarList } from "@/components/charts";
import { EmptyState } from "@/components/EmptyState";
import { IconClock } from "@/components/icons";
import { ReportChartCard, ReportTable, ReportTakeaway, type ReportColumn } from "@/components/report";
import { Segmented } from "@/components/Segmented";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { pluralOf } from "@/lib/plural";
import { useReport } from "@/lib/reportRange";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatRate } from "../reports/parts";
import { OrderHeatmap, WEEK_ORDER } from "./OrderHeatmap";
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
    question: "When do your orders come in?",
    description: "The days and hours your orders are placed. Cancelled, rejected and test orders are left out.",
    metricLabel: "What the colours and bars count",
    metricOrders: "Orders",
    metricRevenue: "Revenue",
    busiest: "Your busiest time is {day} at {hour}: {orders}.",
    grid: "By day and hour",
    gridSummaryOrders: "Orders for each weekday and hour, Saturday to Friday.",
    gridSummaryRevenue: "Revenue for each weekday and hour, Saturday to Friday.",
    days: "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
    confirmation: "confirmation rate {rate}",
    hint: "Point at a square, tap it, or move with the arrow keys to see its numbers.",
    less: "Less",
    more: "More",
    byWeekday: "By weekday",
    byHour: "By hour",
    byHourSummaryOrders: "Orders by hour of the day",
    byHourSummaryRevenue: "Revenue by hour of the day",
    table: "The busiest times",
    tableNote: "Every day and hour with at least one order.",
    colSlot: "Day and hour",
    colOrders: "Orders",
    colRevenue: "Revenue",
    colConfirmation: "Confirmation rate",
    emptyTitle: "No orders in this period",
    emptyHint: "Pick a longer period to see when your orders come in.",
  },
  ar: {
    question: "متى تصل الطلبات؟",
    description: "الأيام والساعات التي تُنشأ فيها الطلبات. الملغاة والمرفوضة والتجريبية غير محتسبة.",
    metricLabel: "ما الذي تعدّه الألوان والأعمدة",
    metricOrders: "عدد الطلبات",
    metricRevenue: "المبيعات",
    busiest: "أكثر أوقاتك نشاطًا {day} الساعة {hour}: {orders}.",
    grid: "يومًا بيوم وساعة بساعة",
    gridSummaryOrders: "عدد الطلبات لكل يوم وساعة، من السبت إلى الجمعة.",
    gridSummaryRevenue: "المبيعات لكل يوم وساعة، من السبت إلى الجمعة.",
    days: "الأحد,الإثنين,الثلاثاء,الأربعاء,الخميس,الجمعة,السبت",
    confirmation: "نسبة التأكيد {rate}",
    hint: "قف على أي مربع، أو اضغط عليه، أو تحرّك بالأسهم لرؤية أرقامه.",
    less: "أقل",
    more: "أكثر",
    byWeekday: "بحسب اليوم",
    byHour: "بحسب الساعة",
    byHourSummaryOrders: "عدد الطلبات بحسب ساعة اليوم",
    byHourSummaryRevenue: "المبيعات بحسب ساعة اليوم",
    table: "أكثر الأوقات نشاطًا",
    tableNote: "كل يوم وساعة فيهما طلب واحد على الأقل.",
    colSlot: "اليوم والساعة",
    colOrders: "طلبات",
    colRevenue: "مبيعات",
    colConfirmation: "نسبة التأكيد",
    emptyTitle: "لا توجد طلبات في هذه الفترة",
    emptyHint: "اختر فترة أطول لترى متى تصل طلباتك.",
  },
} satisfies Messages;

type Metric = "orders" | "revenue";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/**
 * Reports → «أوقات الأوردرات» (analytics.view): the busiest slot
 * in one sentence, a weekday × hour heatmap of live orders in the store's
 * time zone (by count or by revenue), the same numbers as bars by weekday and
 * by hour, and the slots as the ONE table — sortable, its export the server's
 * file of the 168 cells.
 */
export function OrderTimesReport() {
  const t = useT(STRINGS);
  const c = useT(STORE_REPORT_STRINGS);
  const workspaceId = useWorkspaceId();
  const range = useStoreReportRange();
  const [metric, setMetric] = useState<Metric>("orders");
  const state = useReport(() => storeReportOrderHeatmap(apiClient, workspaceId, range.days), [workspaceId, range.days.from, range.days.to]);
  const exportCsv = useStoreReportCsv("order-heatmap", range.days, `order-times-${range.days.from}-${range.days.to}`);

  const dayNames = t.days.split(",");
  // «٩ م», "9 PM": the hour alone, in the dashboard's language.
  const hourFormat = new Intl.DateTimeFormat(getIntlLocale(), { hour: "numeric" });
  const hourLabel = (hour: number) => hourFormat.format(new Date(2000, 0, 1, hour));
  const dayName = (weekday: number) => dayNames[weekday] ?? "";

  return (
    <StoreReportShell
      slug="order-times"
      title={c.orderTimes}
      description={t.description}
      question={t.question}
      note={t.description}
      controls={
        <>
          <StoreReportRangeBar range={range} refused={reportRangeRefused(state.error)} />
          <Segmented
            size="sm"
            value={metric}
            onChange={setMetric}
            label={t.metricLabel}
            options={[
              { value: "orders", label: t.metricOrders },
              { value: "revenue", label: t.metricRevenue },
            ]}
          />
        </>
      }
      state={state}
    >
      {(data) => {
        const busiest = data.busiest;
        if (!busiest) {
          return <EmptyState icon={<IconClock aria-hidden />} title={t.emptyTitle} description={t.emptyHint} action={<LongerPeriodButton range={range} />} />;
        }

        const money = (minor: number | string) => reportMoney(minor, data.currency);
        const valueOf = (cell: StoreReportHeatmapCell) => (metric === "orders" ? cell.orders : Number(cell.revenue));
        const show = (value: number) => (metric === "orders" ? formatCount(value) : money(value));
        const slot = (cell: { weekday: number; hour: number }) => `${dayName(cell.weekday)} ${hourLabel(cell.hour)}`;
        const describe = (cell: StoreReportHeatmapCell) =>
          [
            slot(cell),
            pluralOf(c, "ordersCount", cell.orders),
            money(cell.revenue),
            ...(cell.confirmationRate === null ? [] : [fmt(t.confirmation, { rate: formatRate(cell.confirmationRate) })]),
          ].join(" · ");

        const byDay = WEEK_ORDER.map((weekday) => ({
          label: dayName(weekday),
          value:
            metric === "orders"
              ? (data.byWeekday[weekday] ?? 0)
              : data.cells.filter((cell) => cell.weekday === weekday).reduce((sum, cell) => sum + Number(cell.revenue), 0),
        }));
        const byHour = HOURS.map((hour) => ({
          label: hourLabel(hour),
          value:
            metric === "orders"
              ? (data.byHour[hour] ?? 0)
              : data.cells.filter((cell) => cell.hour === hour).reduce((sum, cell) => sum + Number(cell.revenue), 0),
        }));

        const columns: ReportColumn<StoreReportHeatmapCell>[] = [
          {
            key: "slot",
            header: t.colSlot,
            cell: (cell) => slot(cell),
            // Saturday first, then the hours of the day.
            sortValue: (cell) => WEEK_ORDER.findIndex((weekday) => weekday === cell.weekday) * 24 + cell.hour,
            csv: (cell) => slot(cell),
          },
          { key: "orders", header: t.colOrders, align: "end", cell: (cell) => formatCount(cell.orders), sortValue: (cell) => cell.orders },
          { key: "revenue", header: t.colRevenue, align: "end", cell: (cell) => money(cell.revenue), sortValue: (cell) => Number(cell.revenue) },
          {
            key: "confirmation",
            header: t.colConfirmation,
            align: "end",
            cell: (cell) => formatRate(cell.confirmationRate),
            sortValue: (cell) => cell.confirmationRate,
          },
        ];

        return (
          <>
            <ReportTakeaway tone="info">
              {fmt(t.busiest, { day: dayName(busiest.weekday), hour: hourLabel(busiest.hour), orders: pluralOf(c, "ordersCount", busiest.orders) })}
            </ReportTakeaway>

            <StoreReportCard title={t.grid} note={fmt(c.storeTime, { zone: data.timezone })}>
              <OrderHeatmap
                // A new window has a new busiest slot: the grid starts over from it.
                key={`${busiest.weekday}:${busiest.hour}`}
                start={busiest}
                cells={data.cells}
                valueOf={valueOf}
                dayNames={dayNames}
                hourLabel={hourLabel}
                describe={describe}
                summary={metric === "orders" ? t.gridSummaryOrders : t.gridSummaryRevenue}
                hint={t.hint}
                lessLabel={t.less}
                moreLabel={t.more}
              />
            </StoreReportCard>

            <div className="grid min-w-0 gap-[var(--bento-gap)] lg:grid-cols-2">
              <StoreReportCard title={t.byWeekday} note={metric === "orders" ? t.metricOrders : t.metricRevenue}>
                <HBarList rows={byDay} format={show} />
              </StoreReportCard>
              <ReportChartCard title={t.byHour} note={metric === "orders" ? t.metricOrders : t.metricRevenue} height={240}>
                {(height) => (
                  <BarChart points={byHour} format={show} height={height} summary={metric === "orders" ? t.byHourSummaryOrders : t.byHourSummaryRevenue} />
                )}
              </ReportChartCard>
            </div>

            <ReportTable
              columns={columns}
              rows={data.cells.filter((cell) => cell.orders > 0)}
              rowKey={(cell) => `${cell.weekday}:${cell.hour}`}
              defaultSort={{ key: "orders", dir: "desc" }}
              exportName="order-times"
              onExport={exportCsv}
              caption={t.table}
              note={t.tableNote}
            />
          </>
        );
      }}
    </StoreReportShell>
  );
}

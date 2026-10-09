import { useMemo } from "react";
import { reportsGetDelivery, type ReportsDelivery } from "@store-builder/api-client";
import { KpiCard } from "@/components/KpiCard";
import {
  IconCalendar,
  IconChart,
  IconClock,
  IconConfirm,
  IconDelivered,
  IconLostOrders,
  IconReturns,
  IconShipping,
} from "@/components/icons";
import {
  ReportChartCard,
  ReportKpiStrip,
  ReportLegend,
  ReportLinks,
  ReportTab,
  ReportTabState,
  useTabData,
  type ReportLinkItem,
  type ReportTabProps,
} from "@/components/report";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { countOf } from "@/lib/plural";
import { formatRate } from "@/pages/analytics/reports/parts";
import { REPORT_TAB_QUESTIONS } from "../reportTabs";
import { JourneyChart } from "./journey/JourneyChart";
import { JourneyMore, type JourneySpan } from "./journey/JourneyMore";
import { judgeJourney, weakStepOf } from "./journey/journeyRule";
import { useJourneyT } from "./journey/journeyStrings";
import { JourneyTable } from "./journey/JourneyTable";
import { JourneyTakeaway } from "./journey/JourneyTakeaway";

/**
 * «رحلة الأوردر» — «الأوردرات بتضيع مني فين؟» — the second tab of the reports hub.
 *
 * ONE source for the tab: `GET /analytics/reports/delivery`. Every figure is a
 * cohort — the orders PLACED in the range, at the state they are in now — and
 * the three rates are the API's own: confirmed ÷ cash-on-delivery orders,
 * delivered ÷ shipped, returned or failed ÷ shipped.
 *
 * No comparison: that report has none, and the sales report's
 * `kpis.confirmationRate.previous` is the period before at its state NOW — its
 * orders have had longer to be called and to arrive, so a chip built on it
 * would show a drop almost every day (docs/ux/needs-backend.md H25). Each card
 * says in words what its rate is counted from instead, and the tab's note says
 * why there is no chip. The hub's «قارن بـ» therefore changes nothing here, and
 * the request is kept under one key whatever it says.
 *
 * Anatomy (the hub's): the question → four stat cards → the journey as
 * connected bars → the table by governorate / by courier → the one sentence
 * (journey/journeyRule.ts) → «تفاصيل أكتر» → the links out.
 */
export default function JourneyTab({ workspaceId, range }: ReportTabProps) {
  const questions = useT(REPORT_TAB_QUESTIONS);
  const t = useJourneyT();

  const span = useMemo<JourneySpan>(
    () => ({ from: range.from, to: range.to, fromDay: range.fromDay, toDay: range.toDay, compare: "none" }),
    [range.from, range.to, range.fromDay, range.toDay]
  );
  const delivery = useTabData("journey", workspaceId, span, () =>
    reportsGetDelivery(apiClient, workspaceId, { from: span.from, to: span.to })
  );

  return (
    // The note describes the numbers: it has nothing to say to a role that may not read them.
    <ReportTab question={questions.journey} note={isPermissionError(delivery.error) ? undefined : t.note}>
      <ReportTabState loading={delivery.loading} error={delivery.error} onRetry={delivery.retry}>
        {delivery.data && <JourneyBody workspaceId={workspaceId} range={span} report={delivery.data} />}
      </ReportTabState>
    </ReportTab>
  );
}

function JourneyBody({ workspaceId, range, report }: { workspaceId: string; range: JourneySpan; report: ReportsDelivery }) {
  const t = useJourneyT();
  const { totals } = report;
  const verdict = useMemo(() => judgeJourney(report), [report]);
  const hasOrders = totals.orders > 0;

  // The fourth card: how long a confirmation takes, with the delivery time beside it in words.
  // A store with no confirmations (prepaid only) gets the delivery time as the figure instead.
  const hours = report.averageConfirmationHours;
  const days = report.averageDeliveryDays;
  const speed =
    hours !== null
      ? {
          label: t.confirmTime,
          value: countOf("hour", hours),
          hint: days !== null ? fmt(t.deliveryTimeHint, { days: countOf("day", days) }) : t.confirmTimeHint,
        }
      : days !== null
        ? { label: t.deliveryTime, value: countOf("day", days), hint: t.hintDays }
        : { label: t.confirmTime, value: "—", hint: t.confirmTimeNone };

  const chartNote = [
    fmt(t.chartNote, { orders: countOf("order", totals.orders) }),
    // «اتأكد» counts cash-on-delivery orders only: when some orders are prepaid, say how many are not.
    totals.codOrders < totals.orders ? fmt(t.chartCod, { orders: countOf("order", totals.codOrders) }) : null,
  ]
    .filter(Boolean)
    .join(" ");

  // The store reports count in days of the store's calendar and read them from the address: the same days go along.
  const sameDays = `?from=${range.fromDay}&to=${range.toDay}`;
  const links: ReportLinkItem[] = [
    { to: `/analytics/reports/returns${sameDays}`, title: t.linkReturnsReport, description: t.linkReturnsReportHint, icon: IconChart },
    { to: `/analytics/reports/order-times${sameDays}`, title: t.linkTimes, description: t.linkTimesHint, icon: IconCalendar },
    { to: "/confirmation-queue", title: t.linkConfirm, description: t.linkConfirmHint, icon: IconConfirm },
    { to: "/returns", title: t.linkReturns, description: t.linkReturnsHint, icon: IconReturns },
    { to: "/abandoned-carts", title: t.linkLost, description: t.linkLostHint, icon: IconLostOrders },
    { to: "/shipping", title: t.linkShipping, description: t.linkShippingHint, icon: IconShipping },
  ];

  return (
    <>
      {/* No sparkline: the API has no series of these rates. No chip: see the note at the top of the file. */}
      <ReportKpiStrip sparkline={false}>
        <KpiCard
          label={t.confirmationRate}
          value={formatRate(totals.confirmationRate)}
          hint={
            totals.codOrders > 0
              ? fmt(t.confirmationHint, { confirmed: totals.confirmed, orders: countOf("order", totals.codOrders) })
              : t.confirmationNone
          }
          to="/confirmation-queue"
          icon={<IconConfirm />}
        />
        <KpiCard
          label={t.deliveryRate}
          value={formatRate(totals.deliveryRate)}
          hint={
            totals.shipped > 0 ? fmt(t.deliveryHint, { delivered: totals.delivered, orders: countOf("order", totals.shipped) }) : t.shippedNone
          }
          icon={<IconDelivered />}
        />
        <KpiCard
          label={t.returnRate}
          value={formatRate(totals.returnRate)}
          hint={
            totals.shipped > 0 ? fmt(t.returnHint, { returned: totals.returned, orders: countOf("order", totals.shipped) }) : t.shippedNone
          }
          to="/returns"
          icon={<IconReturns />}
        />
        <KpiCard label={speed.label} value={speed.value} hint={speed.hint} icon={<IconClock />} />
      </ReportKpiStrip>

      <ReportChartCard
        title={t.chartTitle}
        note={hasOrders ? chartNote : undefined}
        legend={
          totals.shipped > 0 ? (
            <ReportLegend
              items={[
                { label: t.legendReturned, swatch: "danger" },
                { label: t.legendOnTheWay, swatch: "neutral", dashed: true },
              ]}
            />
          ) : undefined
        }
        empty={hasOrders ? null : t.chartEmpty}
      >
        {(height) => <JourneyChart report={report} height={height} weakStep={weakStepOf(verdict)} />}
      </ReportChartCard>

      <JourneyTable report={report} range={range} />

      <JourneyTakeaway verdict={verdict} />

      <JourneyMore workspaceId={workspaceId} range={range} report={report} />

      <ReportLinks items={links} />
    </>
  );
}

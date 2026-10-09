import { useState } from "react";
import type { ReportsDelivery, ReportsDeliveryNumbers } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { ReportTable, type ReportColumn } from "@/components/report";
import { Segmented } from "@/components/Segmented";
import { fmt, getIntlLocale } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { formatMinorMoney, placeName } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { useReportMoney } from "@/lib/reportCurrency";
import { formatRate } from "@/pages/analytics/reports/parts";
import { courierLabel, isolate, toMajorUnits } from "./journeyFormat";
import { HIGH_RETURN, MIN_SHIPPED, WEAK_CONFIRMATION, WEAK_DELIVERY } from "./journeyRule";
import { useJourneyT, type JourneyT } from "./journeyStrings";

type PlaceRow = ReportsDelivery["governorates"][number];
type CourierRow = ReportsDelivery["carriers"][number];
/** What the ONE table breaks the orders down by. */
type Breakdown = "place" | "courier";

/**
 * A rate in the table: a percentage. Red and bold when it is weak; quiet, with
 * the reason on hover, when it rests on fewer than MIN_SHIPPED orders — the
 * same floor the sentence under the table uses before it names a row.
 */
export function RateCell({ percent, weak, thin, thinTitle }: { percent: number | null; weak: boolean; thin: boolean; thinTitle: string }) {
  if (percent === null) return <span className="text-ink-soft">—</span>;
  return (
    <bdi dir="ltr" title={thin ? thinTitle : undefined} className={cn(thin ? "text-ink-soft" : weak && "font-semibold text-danger")}>
      {formatRate(percent)}
    </bdi>
  );
}

function countColumn<T>(key: string, header: string, hint: string, pick: (row: T) => number): ReportColumn<T> {
  return { key, header, hint, align: "end", cell: (row) => formatCount(pick(row)), sortValue: pick, csv: pick };
}

/** Orders, confirmed, shipped, delivered, returned — the same five counts for a governorate and for a courier. */
function countColumns<T extends ReportsDeliveryNumbers>(t: JourneyT): ReportColumn<T>[] {
  return [
    countColumn<T>("orders", t.colOrders, t.hintOrders, (row) => row.orders),
    countColumn<T>("confirmed", t.colConfirmed, t.hintConfirmed, (row) => row.confirmed),
    countColumn<T>("shipped", t.colShipped, t.hintShipped, (row) => row.shipped),
    countColumn<T>("delivered", t.colDelivered, t.hintDelivered, (row) => row.delivered),
    countColumn<T>("returned", t.colReturned, t.hintReturned, (row) => row.returned),
  ];
}

/**
 * The three rates, each from the API as it defines it: confirmed ÷ cash-on-delivery
 * orders, delivered ÷ shipped, returned or failed ÷ shipped. The heading's hint says which.
 */
function rateColumns<T extends ReportsDeliveryNumbers>(t: JourneyT, thinTitle: string): ReportColumn<T>[] {
  return [
    {
      key: "confirmationRate",
      header: t.colConfirmation,
      hint: t.hintConfirmation,
      align: "end",
      cell: (row) => (
        <RateCell
          percent={row.confirmationRate}
          weak={row.confirmationRate !== null && row.confirmationRate < WEAK_CONFIRMATION}
          thin={row.codOrders < MIN_SHIPPED}
          thinTitle={thinTitle}
        />
      ),
      sortValue: (row) => row.confirmationRate,
      csv: (row) => row.confirmationRate,
    },
    {
      key: "deliveryRate",
      header: t.colDelivery,
      hint: t.hintDelivery,
      align: "end",
      cell: (row) => (
        <RateCell
          percent={row.deliveryRate}
          weak={row.deliveryRate !== null && row.deliveryRate < WEAK_DELIVERY}
          thin={row.shipped < MIN_SHIPPED}
          thinTitle={thinTitle}
        />
      ),
      sortValue: (row) => row.deliveryRate,
      csv: (row) => row.deliveryRate,
    },
    {
      key: "returnRate",
      header: t.colReturn,
      hint: t.hintReturn,
      align: "end",
      cell: (row) => (
        <RateCell
          percent={row.returnRate}
          weak={row.returnRate !== null && row.returnRate >= HIGH_RETURN}
          thin={row.shipped < MIN_SHIPPED}
          thinTitle={thinTitle}
        />
      ),
      sortValue: (row) => row.returnRate,
      csv: (row) => row.returnRate,
    },
  ];
}

/**
 * The tab's ONE table: the period's orders by governorate, and — through the
 * switch on its title line — the same columns by courier (which adds the
 * average days a delivery takes). Sortable by every column; the export is the
 * table as shown, built in the browser.
 */
export function JourneyTable({ report, range }: { report: ReportsDelivery; range: { fromDay: string; toDay: string } }) {
  const t = useJourneyT();
  const inReport = useReportMoney();
  const [breakdown, setBreakdown] = useState<Breakdown>("place");

  const money = (minor: number) => formatMinorMoney(...inReport(minor, report.currency));
  const majorUnits = (minor: number) => {
    const [amount, currency] = inReport(minor, report.currency);
    return toMajorUnits(amount, currency);
  };
  const decimal = (value: number) => new Intl.NumberFormat(getIntlLocale(), { maximumFractionDigits: 1 }).format(value);
  const thinTitle = fmt(t.thinSample, { min: countOf("order", MIN_SHIPPED) });
  const note = (template: string) =>
    fmt(template, { delivered: isolate(money(report.totals.deliveredSales)), total: isolate(money(report.totals.sales)) });

  function salesColumn<T extends ReportsDeliveryNumbers>(): ReportColumn<T> {
    return {
      key: "deliveredSales",
      header: t.colSales,
      hint: t.hintSales,
      align: "end",
      cell: (row) => money(row.deliveredSales),
      sortValue: (row) => row.deliveredSales,
      csv: (row) => majorUnits(row.deliveredSales),
    };
  }

  const placeColumns: ReportColumn<PlaceRow>[] = [
    { key: "name", header: t.colPlace, cell: (row) => placeName(row.name), sortValue: (row) => placeName(row.name) },
    ...countColumns<PlaceRow>(t),
    ...rateColumns<PlaceRow>(t, thinTitle),
    salesColumn<PlaceRow>(),
  ];

  const courierColumns: ReportColumn<CourierRow>[] = [
    {
      key: "name",
      header: t.colCourier,
      cell: (row) => courierLabel(row.name, t.manualCourier),
      sortValue: (row) => courierLabel(row.name, t.manualCourier),
    },
    ...countColumns<CourierRow>(t),
    ...rateColumns<CourierRow>(t, thinTitle),
    {
      key: "averageDeliveryDays",
      header: t.colDays,
      hint: t.hintDays,
      align: "end",
      cell: (row) => (row.averageDeliveryDays === null ? "—" : decimal(row.averageDeliveryDays)),
      sortValue: (row) => row.averageDeliveryDays,
      csv: (row) => row.averageDeliveryDays,
    },
    salesColumn<CourierRow>(),
  ];

  const toolbar = (
    <Segmented
      value={breakdown}
      onChange={setBreakdown}
      label={t.tableSwitch}
      size="sm"
      options={[
        { value: "place", label: t.byPlace },
        { value: "courier", label: t.byCourier },
      ]}
    />
  );

  // No `key` on purpose: both breakdowns are ONE table to React, so the switch on its title line stays mounted —
  // its thumb slides and the keyboard keeps its place — and the chosen sort carries over (the columns share their keys).
  return breakdown === "place" ? (
    <ReportTable
      columns={placeColumns}
      rows={report.governorates}
      rowKey={(row) => row.name}
      defaultSort={{ key: "orders", dir: "desc" }}
      exportName="zimos-journey-governorates"
      caption={t.placeCaption}
      note={note(t.placeNote)}
      toolbar={toolbar}
      empty={t.placeEmpty}
      range={range}
    />
  ) : (
    <ReportTable
      columns={courierColumns}
      rows={report.carriers}
      rowKey={(row) => row.name}
      defaultSort={{ key: "orders", dir: "desc" }}
      exportName="zimos-journey-couriers"
      caption={t.courierCaption}
      note={note(t.courierNote)}
      toolbar={toolbar}
      empty={t.courierEmpty}
      range={range}
    />
  );
}

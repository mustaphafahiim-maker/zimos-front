import { useMemo } from "react";
import type { ReportsChannelRow, ReportsDeviceRow, ReportsSales } from "@store-builder/api-client";
import { HBarList } from "@/components/charts";
import { KpiCard } from "@/components/KpiCard";
import { ReportKpiStrip, ReportTable, useTabData, type ReportColumn } from "@/components/report";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { deltaBasisPoints, formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { formatPercentValue, humanize } from "@/lib/format";
import { countOf } from "@/lib/plural";
import type { ReportRange } from "@/lib/reportRange";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { formatConversion } from "@/components/report/rates";
import { OrdersHeatmap } from "@/pages/analytics/reports/parts";
import { AmountList, Num, PartState, fill, hourName, useSalesMoney, weekdayName, type AmountRow } from "./SalesParts";
import { MIN_COST_COVERAGE, MIN_ORDERS, busiestSlot, loadSummary } from "./salesData";
import { SALES_STRINGS, type SalesStrings } from "./salesStrings";

/*
 * The bodies of «تفاصيل أكتر» on the «المبيعات والربح» tab — everything else the
 * old reports overview and the old summary page showed for this subject. An
 * `AccordionSection` mounts its body when it is opened, so the two sections
 * that ask the old summary API (`CashSection`, `StatusSection`) send their
 * request then, not with the tab.
 */

const LINK =
  "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold text-primary ring-1 ring-line-strong transition-colors duration-(--dur-fade) ease-(--ease-out) hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none";

/** A name the strings may carry under `<prefix><key>` («pay_cod»); anything else is shown humanized. */
function named(t: SalesStrings, prefix: string, key: string): string {
  const id = `${prefix}${key}`;
  return id in t ? t[id as keyof SalesStrings] : humanize(key);
}

/* ------------------------------------------------------------------ *
 * How total sales add up (old overview: "Total sales breakdown")
 * ------------------------------------------------------------------ */

export function SalesBreakdown({ sales }: { sales: ReportsSales }) {
  const t = useT(SALES_STRINGS);
  const { money, signed } = useSalesMoney(sales.currency);
  const { kpis } = sales;
  const off = (minor: number | null) => signed(-(minor ?? 0));
  const rows: AmountRow[] = [
    { key: "gross", label: t.grossSales, value: money(kpis.grossSales.value) },
    { key: "discounts", label: t.discounts, value: off(kpis.discounts.value) },
    { key: "refunds", label: t.refunds, value: off(kpis.refunds.value) },
    { key: "net", label: t.netSales, value: money(kpis.netSales.value), strong: true },
    { key: "shipping", label: t.shippingCharged, value: money(kpis.shipping.value) },
    { key: "total", label: t.totalSales, value: money(kpis.totalSales.value), strong: true },
  ];
  return <AmountList rows={rows} />;
}

/* ------------------------------------------------------------------ *
 * Payment methods (old overview: "Sales by payment method")
 * ------------------------------------------------------------------ */

export function PaymentMethods({ sales }: { sales: ReportsSales }) {
  const t = useT(SALES_STRINGS);
  const { money } = useSalesMoney(sales.currency);
  const methods = [...sales.paymentMethods].sort((a, b) => b.sales - a.sales);
  const total = methods.reduce((sum, method) => sum + method.sales, 0);
  if (methods.length === 0) return <p className="text-sm leading-6 text-ink-soft">{t.payEmpty}</p>;
  return (
    <HBarList
      format={(value) => money(value)}
      rows={methods.map((method) => ({
        label: named(t, "pay_", method.method),
        value: method.sales,
        // How many orders paid this way (fetched before, never shown) and its share of the sales.
        caption: fmt(t.payCaption, {
          orders: countOf("order", method.orders),
          share: total > 0 ? formatPercentValue(method.sales / total, 0) : "—",
        }),
      }))}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Channels (old overview: "Sales by channel" — it had no export)
 * ------------------------------------------------------------------ */

export function ChannelsTable({ sales, range }: { sales: ReportsSales; range: { fromDay: string; toDay: string } }) {
  const t = useT(SALES_STRINGS);
  const { money, major } = useSalesMoney(sales.currency);
  const columns = useMemo<ReportColumn<ReportsChannelRow>[]>(
    () => [
      {
        key: "channel",
        header: t.colChannel,
        cell: (row) => {
          const source = row.source === "direct" ? t.direct : row.source;
          return row.medium ? `${source} · ${row.medium}` : source;
        },
        sortValue: (row) => (row.source === "direct" ? t.direct : row.source),
        csv: (row) => (row.medium ? `${row.source} / ${row.medium}` : row.source),
      },
      {
        key: "sales",
        header: t.colSales,
        align: "end",
        cell: (row) => money(row.sales),
        sortValue: (row) => row.sales,
        csv: (row) => major(row.sales),
      },
      {
        key: "orders",
        header: t.colOrders,
        align: "end",
        cell: (row) => formatCount(row.orders),
        sortValue: (row) => row.orders,
      },
      {
        key: "conversion",
        header: t.colConversion,
        hint: t.colConversionHint,
        align: "end",
        cell: (row) => formatConversion(row.conversionRate),
        sortValue: (row) => row.conversionRate,
      },
      {
        key: "visits",
        header: t.colVisits,
        align: "end",
        cell: (row) => formatCount(row.sessions),
        sortValue: (row) => row.sessions,
      },
    ],
    // `money` and `major` change together, with the report currency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, money]
  );
  return (
    <ReportTable
      embedded
      columns={columns}
      rows={sales.channels}
      rowKey={(row) => `${row.source}/${row.medium ?? ""}`}
      defaultSort={{ key: "sales", dir: "desc" }}
      exportName="zimos-channels"
      range={range}
      caption={t.secChannels}
      empty={t.channelsEmpty}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Devices (old overview: "Sessions by device" — orders, sales and
 * conversion per device were fetched and never shown)
 * ------------------------------------------------------------------ */

export function DevicesTable({ sales, range }: { sales: ReportsSales; range: { fromDay: string; toDay: string } }) {
  const t = useT(SALES_STRINGS);
  const { money, major } = useSalesMoney(sales.currency);
  const columns = useMemo<ReportColumn<ReportsDeviceRow>[]>(
    () => [
      {
        key: "device",
        header: t.colDevice,
        cell: (row) => named(t, "dev_", row.device),
        sortValue: (row) => named(t, "dev_", row.device),
        csv: (row) => row.device,
      },
      {
        key: "visits",
        header: t.colVisits,
        align: "end",
        cell: (row) => formatCount(row.sessions),
        sortValue: (row) => row.sessions,
      },
      {
        key: "orders",
        header: t.colOrders,
        align: "end",
        cell: (row) => formatCount(row.orders),
        sortValue: (row) => row.orders,
      },
      {
        key: "sales",
        header: t.colSales,
        align: "end",
        cell: (row) => money(row.sales),
        sortValue: (row) => row.sales,
        csv: (row) => major(row.sales),
      },
      {
        key: "conversion",
        header: t.colConversion,
        hint: t.colConversionHint,
        align: "end",
        cell: (row) => formatConversion(row.conversionRate),
        sortValue: (row) => row.conversionRate,
      },
    ],
    // `money` and `major` change together, with the report currency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, money]
  );
  return (
    <ReportTable
      embedded
      columns={columns}
      rows={sales.devices}
      rowKey={(row) => row.device}
      defaultSort={{ key: "visits", dir: "desc" }}
      exportName="zimos-devices"
      range={range}
      caption={t.secDevices}
      empty={t.channelsEmpty}
    />
  );
}

/* ------------------------------------------------------------------ *
 * When orders come in (old overview: the order heatmap)
 * ------------------------------------------------------------------ */

/** «أزحم وقت: السبت ٩ م» — only once there are enough orders for a busiest hour to mean something. */
export function busiestLine(t: SalesStrings, sales: ReportsSales): string | null {
  if ((sales.kpis.orders.value ?? 0) < MIN_ORDERS) return null;
  const slot = busiestSlot(sales.heatmap);
  return slot ? fmt(t.timesPeak, { day: weekdayName(slot.dow), hour: hourName(slot.hour) }) : null;
}

export function OrderTimes({ sales }: { sales: ReportsSales }) {
  const t = useT(SALES_STRINGS);
  if (sales.heatmap.length === 0) return <p className="text-sm leading-6 text-ink-soft">{t.timesEmpty}</p>;
  // Indexed by weekday, 0 = Sunday, as the heatmap's cells are.
  const days = Array.from({ length: 7 }, (_, dow) => weekdayName(dow));
  const busiest = busiestLine(t, sales);
  return (
    <div>
      {busiest && <p className="text-[15px] leading-6 font-semibold text-ink">{busiest}</p>}
      <p className="mb-3 text-[13px] leading-5 text-ink-soft">{t.timesHint}</p>
      <OrdersHeatmap cells={sales.heatmap} dayLabels={days} summary={t.secTimes} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The old summary: cash collected, gross profit, orders by status
 * ------------------------------------------------------------------ */

type TabRange = Pick<ReportRange, "from" | "to" | "compare" | "fromDay" | "toDay">;

/**
 * The store summary (`GET /analytics/summary`) for the range, and for the
 * comparison window of the sales report when there is one. The two sections
 * that read it share one remembered answer.
 */
function useSummary(workspaceId: string, range: TabRange, sales: ReportsSales) {
  const previousRange = sales.previousRange;
  return useTabData("sales:summary", workspaceId, range, () => loadSummary(workspaceId, range.from, range.to, previousRange));
}

/**
 * «اتحصّل كام فعلاً؟» — the figures only the old summary page showed: cash
 * collected, gross profit, orders delivered and visitors, each with its change
 * against the hub's comparison window (a second summary call over that window;
 * no window, no chip), where the money stands, and what the couriers still hold.
 */
export function CashSection({
  workspaceId,
  range,
  sales,
  finance,
}: {
  workspaceId: string;
  range: TabRange;
  sales: ReportsSales;
  /** False when the role may not read money reports: the couriers' line is left out. */
  finance: boolean;
}) {
  const t = useT(SALES_STRINGS);
  const summary = useSummary(workspaceId, range, sales);
  const pair = summary.error ? null : summary.data;
  const { money, signed } = useSalesMoney(pair?.current.currency ?? sales.currency);

  return (
    <PartState loading={summary.loading} error={summary.error} onRetry={summary.retry}>
      {pair &&
        (() => {
          const { current, previous } = pair;
          const deltaLabel = sales.compare === "year" ? t.vsYear : undefined;
          const delta = (now: number, before: number | undefined) => (previous ? deltaBasisPoints(now, before) : null);
          const coverage = current.profit.costCoverage;
          const delivered = current.orders.delivered > 0;
          // The home's floor: with too few costed pieces, what is left is not called profit.
          const profitHidden = delivered && coverage !== null && coverage < MIN_COST_COVERAGE;
          const profitPartial = delivered && coverage !== null && coverage < 100;
          const rows: AmountRow[] = [
            { key: "gross", label: t.rowGross, sub: t.rowGrossSub, value: money(current.revenue.gross) },
            { key: "delivered", label: t.rowDelivered, sub: t.rowDeliveredSub, value: money(current.revenue.delivered) },
            { key: "collected", label: t.rowCollected, sub: t.rowCollectedSub, value: money(current.revenue.collected) },
            { key: "refunded", label: t.rowRefunded, sub: t.rowRefundedSub, value: signed(-current.revenue.refunded) },
            { key: "discounts", label: t.rowDiscounts, sub: t.rowDiscountsSub, value: signed(-current.revenue.discounts) },
            { key: "shipping", label: t.rowShipping, sub: t.rowShippingSub, value: money(current.revenue.shippingCharged) },
          ];
          return (
            <div className="flex flex-col gap-4">
              <ReportKpiStrip sparkline={false}>
                <KpiCard
                  label={t.collected}
                  value={money(current.revenue.collected)}
                  deltaBasisPoints={delta(current.revenue.collected, previous?.revenue.collected)}
                  deltaLabel={deltaLabel}
                  hint={t.collectedHint}
                />
                {profitHidden ? (
                  <KpiCard label={t.grossProfit} value="—" hint={t.grossProfitMissing} to="/profit/costs" />
                ) : (
                  <KpiCard
                    label={t.grossProfit}
                    value={signed(current.profit.grossProfit)}
                    // An incomplete figure gets no change chip: its line says what is missing instead.
                    deltaBasisPoints={profitPartial ? null : delta(current.profit.grossProfit, previous?.profit.grossProfit)}
                    deltaLabel={deltaLabel}
                    hint={
                      profitPartial && coverage !== null
                        ? fmt(t.grossProfitPartial, { pct: formatPercentValue(coverage / 100, 0) })
                        : t.grossProfitHint
                    }
                  />
                )}
                <KpiCard
                  label={t.deliveredOrders}
                  value={formatCount(current.orders.delivered)}
                  deltaBasisPoints={delta(current.orders.delivered, previous?.orders.delivered)}
                  deltaLabel={deltaLabel}
                  hint={t.deliveredOrdersHint}
                  // The one figure of the old summary that came with a daily series.
                  trend={current.series.map((day) => day.delivered)}
                  previousTrend={previous?.series.map((day) => day.delivered)}
                />
                {current.traffic && (
                  <KpiCard
                    label={t.visitors}
                    value={formatCount(current.traffic.visitors)}
                    deltaBasisPoints={delta(current.traffic.visitors, previous?.traffic?.visitors)}
                    deltaLabel={deltaLabel}
                    hint={t.visitorsHint}
                  />
                )}
              </ReportKpiStrip>
              <p className="text-[13px] leading-5 text-pretty text-ink-soft">{t.cashNote}</p>

              <div>
                <h4 className="text-[13px] leading-5 font-semibold text-ink-soft">{t.cashBreakdown}</h4>
                <AmountList rows={rows} className="mt-1" />
                <p className="mt-2 text-xs leading-5 text-pretty text-ink-soft">{t.summarySource}</p>
              </div>

              {finance && <CourierCash workspaceId={workspaceId} currency={current.currency} />}
            </div>
          );
        })()}
    </PartState>
  );
}

/**
 * What the couriers still hold (`GET /settlements/summary`): everything
 * delivered and not settled so far — a standing figure, not the period's, and
 * the line says so. Refused for this role: left out. The work itself is on
 * `/settlements`.
 */
function CourierCash({ workspaceId, currency }: { workspaceId: string; currency: string }) {
  const t = useT(SALES_STRINGS);
  const held = useCachedAsync(
    workspaceId ? `report:sales:couriers:${workspaceId}` : null,
    () => apiClient.getSettlementSummary(workspaceId),
    [workspaceId]
  );
  // The settlement summary names no currency: it is the store's own, the one the reports add up in.
  const { money } = useSalesMoney(currency);
  if (isPermissionError(held.error)) return null;
  const summary = held.error ? null : held.data;
  return (
    <div className="border-t border-line pt-4">
      <h4 className="text-[13px] leading-5 font-semibold text-ink-soft">{t.heldTitle}</h4>
      <PartState
        loading={held.loading}
        error={held.error}
        onRetry={() => void held.refresh()}
        failed={t.heldFailed}
        className="mt-2"
      >
        {summary && (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="min-w-0 flex-1 basis-56 text-sm leading-6 text-pretty text-ink">
              {summary.unsettledOrders > 0
                ? fill(t.heldSome, {
                    amount: <Num>{money(summary.dueFromCouriers)}</Num>,
                    orders: countOf("order", summary.unsettledOrders),
                  })
                : t.heldNone}
            </p>
            <ViewLink to="/settlements" className={LINK}>
              {t.openSettlements}
            </ViewLink>
          </div>
        )}
      </PartState>
    </div>
  );
}

/** «الأوردرات حسب الحالة» — the old summary's status breakdown: postponed, no answer and rejected are only here. */
export function StatusSection({ workspaceId, range, sales }: { workspaceId: string; range: TabRange; sales: ReportsSales }) {
  const t = useT(SALES_STRINGS);
  const summary = useSummary(workspaceId, range, sales);
  const orders = summary.error ? null : summary.data?.current.orders;
  return (
    <PartState loading={summary.loading} error={summary.error} onRetry={summary.retry}>
      {orders &&
        (orders.placed > 0 ? (
          <div>
            <p className="mb-3 text-[13px] leading-5 text-ink-soft">{t.statusNote}</p>
            <HBarList
              format={(value) => formatCount(value)}
              rows={[
                { label: t.statusPending, value: orders.pending },
                { label: t.statusConfirmed, value: orders.confirmed },
                { label: t.statusPostponed, value: orders.postponed },
                { label: t.statusUnreachable, value: orders.unreachable },
                { label: t.statusRejected, value: orders.rejected },
                { label: t.statusCancelled, value: orders.cancelled },
                { label: t.statusDelivered, value: orders.delivered },
                { label: t.statusReturned, value: orders.returned },
              ]}
            />
          </div>
        ) : (
          <p className="text-sm leading-6 text-ink-soft">{t.statusEmpty}</p>
        ))}
    </PartState>
  );
}

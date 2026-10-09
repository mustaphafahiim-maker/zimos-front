import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  insightsGetAttribution,
  reportsGetInsights,
  reportsGetProducts,
  reportsGetSales,
  storeReportReturns,
  type InsightsAttributionRow,
  type ReportsDelivery,
  type ReportsInsight,
  type ReportsInsightKey,
  type ReportsProductRow,
} from "@store-builder/api-client";
import { Button, cn } from "@store-builder/ui";
import { AccordionSection } from "@/components/Accordion";
import { AdSourceMark } from "@/components/AdPlatformMark";
import { HBarList } from "@/components/charts";
import { SkeletonBar } from "@/components/DataState";
import {
  IconAttribution,
  IconCaretLeft,
  IconClock,
  IconLostOrders,
  IconNoAnswer,
  IconPlace,
  IconProducts,
  IconReturns,
  IconTip,
  IconTrendDown,
  IconTrendUp,
  IconWarning,
  type IconComponent,
} from "@/components/icons";
import { ReportMore, ReportTable, useTabData, type ReportColumn } from "@/components/report";
import { ViewLink } from "@/components/ViewLink";
import { fmt, getIntlLocale, getLocale } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { formatMinorMoney, humanize, placeName } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { useReportMoney } from "@/lib/reportCurrency";
import type { ReportRange } from "@/lib/reportRange";
import { formatRate, OrdersHeatmap, SplitBar } from "@/pages/analytics/reports/parts";
import { courierLabel, isolate, tenth, toMajorUnits } from "./journeyFormat";
import { HIGH_RETURN, MIN_SHIPPED, WEAK_DELIVERY } from "./journeyRule";
import { RateCell } from "./JourneyTable";
import { useJourneyT } from "./journeyStrings";

/** The hub's range as the tab's requests use it (the comparison is fixed: this tab has none). */
export type JourneySpan = Pick<ReportRange, "from" | "to" | "compare" | "fromDay" | "toDay">;

/** The sections of «تفاصيل أكتر» that ask for data of their own — each can be refused on its own. */
type PartKey = "open" | "products" | "sources" | "returns" | "lost" | "times" | "notes";

interface PartProps {
  workspaceId: string;
  range: JourneySpan;
  /** Called when the section's request is refused for this role: the section is then left out. */
  onDenied: (part: PartKey) => void;
}

interface PartQuery<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  retry: () => void;
}

/**
 * The gate of one section's own request: bones while it loads; a line with
 * «جرّب تاني» when it failed (the rest of the tab stays as it is); and nothing
 * at all — the whole section is then removed — when the role may not read it.
 */
function Part<T>({
  query,
  part,
  onDenied,
  flush = false,
  children,
}: {
  query: PartQuery<T>;
  part: PartKey;
  onDenied: (part: PartKey) => void;
  /** The section's body has no padding of its own (a table): the states bring theirs. */
  flush?: boolean;
  children: (data: T) => ReactNode;
}) {
  const t = useJourneyT();
  const denied = isPermissionError(query.error);
  useEffect(() => {
    if (denied) onDenied(part);
  }, [denied, onDenied, part]);

  if (denied) return null;
  if (query.error) {
    return (
      <div role="alert" className={cn("flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft", flush && "px-4 py-3")}>
        <span>{t.partError}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => query.retry()} className="h-10 rounded-full px-4 pointer-coarse:h-11">
          {t.retry}
        </Button>
      </div>
    );
  }
  if (query.loading || query.data === null) {
    return (
      <div role="status" aria-live="polite" className={cn("space-y-3", flush ? "px-4 py-4" : "py-1")}>
        <span className="sr-only">{t.partLoading}</span>
        <SkeletonBar className="w-2/3" />
        <SkeletonBar className="w-1/2" />
        <SkeletonBar className="w-3/5" />
      </div>
    );
  }
  return <>{children(query.data)}</>;
}

/** Label → figure rows, one under the other. */
function Facts({ rows }: { rows: ReadonlyArray<readonly [label: string, value: string]> }) {
  return (
    <dl className="divide-y divide-line text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 py-2.5">
          <dt className="min-w-0 text-ink-soft">{label}</dt>
          <dd className="shrink-0 font-medium text-ink tabular-nums">
            <bdi>{value}</bdi>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The one place a section leads to: a small pill, 44px under a thumb. */
function PartLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <ViewLink
      to={to}
      data-slot="journey-link"
      className="mt-3 inline-flex min-h-10 max-w-full items-center gap-1 rounded-full bg-paper-raised px-4 text-sm font-semibold text-ink ring-1 ring-line transition-[scale,background-color] duration-(--dur-fade) ease-(--ease-out) hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:min-h-11"
    >
      <span className="truncate">{children}</span>
      <IconCaretLeft weight="bold" aria-hidden className="size-3.5 shrink-0 ltr:rotate-180" />
    </ViewLink>
  );
}

const QUIET = "text-sm leading-6 text-pretty text-ink-soft";
/** A small heading between two lists of one section. */
const SUBHEAD = "mt-5 mb-2.5 text-[13px] leading-5 font-semibold text-ink-soft";

// ------------------------------------------------------------- the stages --

const STAGE_ORDER = [
  "pending_confirmation",
  "needs_follow_up",
  "awaiting_payment",
  "ready_to_ship",
  "shipped",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "returned",
  "cancelled",
] as const;

const STAGE_TONE: Record<string, string> = {
  pending_confirmation: "bg-accent",
  needs_follow_up: "bg-accent-dark",
  awaiting_payment: "bg-line-strong",
  ready_to_ship: "bg-primary/50",
  shipped: "bg-primary/75",
  out_for_delivery: "bg-primary",
  delivered: "bg-success",
  delivery_failed: "bg-danger/70",
  returned: "bg-danger",
  cancelled: "bg-ink-soft/50",
};

/** «الأوردرات دلوقتي فين»: every order of the period by the stage it is in today — from the tab's own request. */
function NowSection({ report }: { report: ReportsDelivery }) {
  const t = useJourneyT();
  const words = t as Record<string, string>;
  const known = new Set<string>(STAGE_ORDER);
  // The journey's own order first; a stage this screen does not know yet goes last, named as the API names it.
  const rows = [
    ...STAGE_ORDER.flatMap((stage) => report.stages.filter((row) => row.stage === stage)),
    ...report.stages.filter((row) => !known.has(row.stage)),
  ].filter((row) => row.orders > 0);
  if (rows.length === 0) return <p className={QUIET}>{t.nowEmpty}</p>;
  return (
    <SplitBar
      parts={rows.map((row) => ({
        label: words[`stage_${row.stage}`] ?? humanize(row.stage),
        value: row.orders,
        display: formatCount(row.orders),
        className: STAGE_TONE[row.stage] ?? "bg-primary",
      }))}
    />
  );
}

// -------------------------------------------------- what was not confirmed --

/**
 * «اللي ما اتأكدش حصل فيه إيه»: not called yet, no answer, postponed, refused —
 * the split only GET /analytics/summary has. That summary counts test orders
 * too, so the section says where its count comes from. Why a customer refused
 * is not recorded anywhere (docs/ux/needs-backend.md), so no reason is shown.
 */
function OpenSection({ workspaceId, range, onDenied }: PartProps) {
  const t = useJourneyT();
  const summary = useTabData("journey:summary", workspaceId, range, () =>
    apiClient.getAnalyticsSummary(workspaceId, { from: range.from, to: range.to })
  );
  return (
    <Part query={summary} part="open" onDenied={onDenied}>
      {(data) => {
        const rows = [
          { label: t.openPending, value: Number(data.orders.pending) || 0 },
          { label: t.openUnreachable, value: Number(data.orders.unreachable) || 0 },
          { label: t.openPostponed, value: Number(data.orders.postponed) || 0 },
          { label: t.openRejected, value: Number(data.orders.rejected) || 0 },
        ];
        if (rows.every((row) => row.value <= 0)) return <p className={QUIET}>{t.openEmpty}</p>;
        return (
          <>
            <HBarList rows={rows} format={(value) => countOf("order", value)} />
            <p className="mt-3 text-xs leading-5 text-pretty text-ink-soft">{t.openSource}</p>
            <PartLink to="/confirmation-queue">{t.openAction}</PartLink>
          </>
        );
      }}
    </Part>
  );
}

// -------------------------------------------------------------- by product --

/** «بالمنتج»: what reaches the customer and what comes back, product by product (GET /analytics/reports/products). */
function ProductsSection({ workspaceId, range, onDenied }: PartProps) {
  const t = useJourneyT();
  const products = useTabData("journey:products", workspaceId, range, () =>
    reportsGetProducts(apiClient, workspaceId, { from: range.from, to: range.to, limit: 50 })
  );
  const thinTitle = fmt(t.thinSample, { min: countOf("piece", MIN_SHIPPED) });
  const columns: ReportColumn<ReportsProductRow>[] = [
    { key: "name", header: t.colProduct, cell: (row) => row.name, sortValue: (row) => row.name },
    { key: "orders", header: t.colOrders, align: "end", cell: (row) => formatCount(row.orders), sortValue: (row) => row.orders },
    { key: "units", header: t.colUnits, align: "end", cell: (row) => formatCount(row.units), sortValue: (row) => row.units },
    {
      key: "deliveryRate",
      header: t.colDelivery,
      align: "end",
      cell: (row) => (
        <RateCell
          percent={row.deliveryRate}
          weak={row.deliveryRate !== null && row.deliveryRate < WEAK_DELIVERY}
          thin={row.units < MIN_SHIPPED}
          thinTitle={thinTitle}
        />
      ),
      sortValue: (row) => row.deliveryRate,
    },
    {
      key: "returnRate",
      header: t.colReturn,
      align: "end",
      cell: (row) => (
        <RateCell
          percent={row.returnRate}
          weak={row.returnRate !== null && row.returnRate >= HIGH_RETURN}
          thin={row.units < MIN_SHIPPED}
          thinTitle={thinTitle}
        />
      ),
      sortValue: (row) => row.returnRate,
    },
  ];
  return (
    <Part query={products} part="products" onDenied={onDenied} flush>
      {(data) => (
        <ReportTable
          embedded
          columns={columns}
          rows={data.products}
          rowKey={(row) => row.productId || row.name}
          rowTo={(row) => (row.productId ? `/catalog/${row.productId}` : null)}
          defaultSort={{ key: "orders", dir: "desc" }}
          exportName="zimos-journey-products"
          caption={t.productsCaption}
          note={t.productsNote}
          empty={t.productsEmpty}
          range={range}
        />
      )}
    </Part>
  );
}

// --------------------------------------------------------------- by source --

/**
 * «بالمصدر»: the orders each source brought, how many were confirmed and how
 * many were delivered (GET /analytics/attribution, last touch). The API gives
 * counts per source and no rate, so none is shown (docs/ux/needs-backend.md).
 */
function SourcesSection({ workspaceId, range, onDenied }: PartProps) {
  const t = useJourneyT();
  const inReport = useReportMoney();
  const sources = useTabData("journey:sources", workspaceId, range, () =>
    insightsGetAttribution(apiClient, workspaceId, { from: range.from, to: range.to, groupBy: "source" })
  );
  return (
    <Part query={sources} part="sources" onDenied={onDenied} flush>
      {(data) => {
        const name = (row: InsightsAttributionRow) => row.key || t.sourceNone;
        const columns: ReportColumn<InsightsAttributionRow>[] = [
          {
            key: "source",
            header: t.colSource,
            cell: (row) => (
              <span className="inline-flex max-w-full items-center gap-2 align-middle">
                {/* A source that is an ad platform carries its mark. */}
                <AdSourceMark source={row.key} />
                <span dir="auto" className={cn("truncate", !row.key && "font-normal text-ink-soft")}>
                  {name(row)}
                </span>
              </span>
            ),
            sortValue: name,
            csv: name,
          },
          { key: "orders", header: t.colOrders, align: "end", cell: (row) => formatCount(row.orders), sortValue: (row) => row.orders },
          {
            key: "confirmed",
            header: t.colConfirmed,
            hint: t.hintConfirmed,
            align: "end",
            cell: (row) => formatCount(row.confirmed),
            sortValue: (row) => row.confirmed,
          },
          { key: "delivered", header: t.colDelivered, align: "end", cell: (row) => formatCount(row.delivered), sortValue: (row) => row.delivered },
          {
            key: "deliveredSales",
            header: t.colSales,
            align: "end",
            cell: (row) => formatMinorMoney(...inReport(row.deliveredSales, data.currency)),
            sortValue: (row) => row.deliveredSales,
            csv: (row) => {
              const [amount, currency] = inReport(row.deliveredSales, data.currency);
              return toMajorUnits(amount, currency);
            },
          },
        ];
        return (
          <ReportTable
            embedded
            columns={columns}
            // Visits that brought no order are not part of an order's journey.
            rows={data.rows.filter((row) => row.orders > 0)}
            rowKey={(row) => row.key || "__none"}
            defaultSort={{ key: "orders", dir: "desc" }}
            exportName="zimos-journey-sources"
            caption={t.sourcesCaption}
            note={t.sourcesNote}
            empty={t.sourcesEmpty}
            range={range}
          />
        );
      }}
    </Part>
  );
}

// ------------------------------------------------------------ return reasons --

/**
 * «المرتجعات بترجع ليه»: the returns opened in the period by reason, and the
 * money refunded (the returns store report, asked for the same days). Its own
 * return rate counts pieces, not orders, so it stays in the full report — this
 * tab shows one return rate, the order one above.
 */
function ReturnsSection({ workspaceId, range, onDenied }: PartProps) {
  const t = useJourneyT();
  const inReport = useReportMoney();
  const returns = useTabData("journey:returns", workspaceId, range, () =>
    storeReportReturns(apiClient, workspaceId, { from: range.fromDay, to: range.toDay })
  );
  const reportLink = `/analytics/reports/returns?from=${range.fromDay}&to=${range.toDay}`;
  const words = t as Record<string, string>;
  /** A reason code in words; a code this screen does not know is shown as written. */
  const reason = (code: string) => words[`reason_${code}`] ?? humanize(code);
  const listJoin = getLocale() === "ar" ? "، " : ", ";
  return (
    <Part query={returns} part="returns" onDenied={onDenied}>
      {(data) => {
        // The five products with the most pieces asked back (the report sends them most returned first).
        // The list is keyed by its labels, so two products of one name are told apart by a number.
        const seen = new Map<string, number>();
        const mostReturned = data.products
          .filter((row) => row.returned > 0)
          .slice(0, 5)
          .map((row) => {
            const name = row.name || t.returnsUnnamed;
            const times = (seen.get(name) ?? 0) + 1;
            seen.set(name, times);
            return { ...row, label: times === 1 ? name : fmt("{name} ({n})", { name, n: times }) };
          });
        if (data.reasons.length === 0 && data.totals.requests === 0 && data.totals.refunds === 0) {
          return (
            <>
              <p className={QUIET}>{t.returnsEmpty}</p>
              <PartLink to={reportLink}>{t.returnsOpen}</PartLink>
            </>
          );
        }
        return (
          <>
            <Facts
              rows={[
                [t.returnsRequests, formatCount(data.totals.requests)],
                [t.returnsPieces, formatCount(data.totals.units)],
                [t.returnsRefunded, formatMinorMoney(...inReport(Number(data.totals.refunded) || 0, data.currency))],
                [t.returnsRefundCount, formatCount(data.totals.refunds)],
              ]}
            />
            <h4 className={SUBHEAD}>{t.returnsByReason}</h4>
            <HBarList
              rows={data.reasons.map((row) => ({
                label: reason(row.reason),
                value: row.requests,
                caption: fmt(t.reasonCaption, { units: countOf("piece", row.units), completed: row.completed, rejected: row.rejected }),
              }))}
              format={(value) => pluralOf(t, "returns", value)}
              emptyLabel={<p className={QUIET}>{t.returnsEmpty}</p>}
            />
            {mostReturned.length > 0 && (
              <>
                <h4 className={SUBHEAD}>{t.returnsTopProducts}</h4>
                <HBarList
                  rows={mostReturned.map((row) => ({
                    label: row.label,
                    value: row.returned,
                    caption: row.reasons.length > 0 ? row.reasons.map(reason).join(listJoin) : undefined,
                  }))}
                  format={(value) => countOf("piece", value)}
                />
              </>
            )}
            <PartLink to={reportLink}>{t.returnsOpen}</PartLink>
          </>
        );
      }}
    </Part>
  );
}

// ------------------------------------------------ lost orders, order times --

/** The sales report, asked for once and shared by the two sections that read it (unfinished orders, order times). */
function useSalesPart(workspaceId: string, range: JourneySpan) {
  return useTabData("journey:sales", workspaceId, range, () =>
    reportsGetSales(apiClient, workspaceId, { from: range.from, to: range.to, compare: "none" })
  );
}

/** «أوردرات ما كملتش»: orders lost before they were ever placed — checkouts started and left, and the ones won back. */
function LostSection({ workspaceId, range, onDenied }: PartProps) {
  const t = useJourneyT();
  const inReport = useReportMoney();
  const sales = useSalesPart(workspaceId, range);
  return (
    <Part query={sales} part="lost" onDenied={onDenied}>
      {(data) => (
        <>
          <Facts
            rows={[
              [t.lostAbandoned, formatCount(data.kpis.abandonedCheckouts.value)],
              [t.lostValue, formatMinorMoney(...inReport(data.kpis.abandonedValue.value, data.currency))],
              [t.lostRecovered, formatCount(data.kpis.recoveredCheckouts.value)],
              [t.lostRecoveryRate, formatRate(data.kpis.recoveryRate.value)],
              [t.lostUncontacted, formatCount(data.kpis.uncontactedCheckouts.value)],
            ]}
          />
          <PartLink to="/abandoned-carts">{t.lostOpen}</PartLink>
        </>
      )}
    </Part>
  );
}

/** «الأوردرات بتيجي إمتى»: orders by weekday and hour, for timing the confirmation calls. */
function TimesSection({ workspaceId, range, onDenied }: PartProps) {
  const t = useJourneyT();
  const sales = useSalesPart(workspaceId, range);
  const reportLink = `/analytics/reports/order-times?from=${range.fromDay}&to=${range.toDay}`;
  return (
    <Part query={sales} part="times" onDenied={onDenied}>
      {(data) => {
        const cells = data.heatmap;
        const days = t.days.split(",");
        // The busiest cell the API sent; between two equal ones, the first.
        const peak = cells.reduce<(typeof cells)[number] | null>((best, cell) => (best === null || cell.orders > best.orders ? cell : best), null);
        if (peak === null || peak.orders <= 0) {
          return (
            <>
              <p className={QUIET}>{t.timesEmpty}</p>
              <PartLink to={reportLink}>{t.timesOpen}</PartLink>
            </>
          );
        }
        // The same clock as the heatmap's own labels («٦ م», "6 PM"), not a bare 18.
        const hour = new Intl.DateTimeFormat(getIntlLocale(), { hour: "numeric" }).format(new Date(2000, 0, 1, peak.hour));
        return (
          <>
            <p className={cn(QUIET, "mb-3")}>{t.timesHint}</p>
            <OrdersHeatmap cells={cells} dayLabels={days} summary={t.timesTitle} />
            <p className="mt-3 text-sm leading-6 text-pretty text-ink">
              {fmt(t.timesPeak, { day: days[peak.dow] ?? "", hour: isolate(hour), orders: countOf("order", peak.orders) })}
            </p>
            <PartLink to={reportLink}>{t.timesOpen}</PartLink>
          </>
        );
      }}
    </Part>
  );
}

// ------------------------------------------------------ what the numbers say --

/** The server's insight lines that belong to an order's journey; the others live on their own tabs. */
const JOURNEY_NOTES: readonly ReportsInsightKey[] = [
  "low_confirmation",
  "weak_governorate",
  "strong_governorate",
  "carrier_gap",
  "abandoned_uncontacted",
  "peak_time",
];

const NOTE_TONE: Record<ReportsInsight["tone"], { icon: IconComponent; ink: string }> = {
  good: { icon: IconTrendUp, ink: "text-success" },
  bad: { icon: IconTrendDown, ink: "text-danger" },
  warn: { icon: IconWarning, ink: "text-accent-dark" },
  info: { icon: IconTip, ink: "text-primary" },
};

/**
 * «الأرقام بتقول إيه كمان»: the lines GET /analytics/reports/insights works out
 * for the period, worded here — rates as «٥ من كل ١٠», names in the screen's
 * language. The sentence above the section is this tab's own rule; these are
 * the server's, all of them at once.
 */
function NotesSection({ workspaceId, range, onDenied }: PartProps) {
  const t = useJourneyT();
  const inReport = useReportMoney();
  const insights = useTabData("journey:insights", workspaceId, range, () =>
    reportsGetInsights(apiClient, workspaceId, { from: range.from, to: range.to })
  );
  return (
    <Part query={insights} part="notes" onDenied={onDenied}>
      {(data) => {
        const days = t.days.split(",");

        function sentence(insight: ReportsInsight): string | null {
          const number = (key: string) => Number(insight.params[key] ?? 0) || 0;
          const text = (key: string) => String(insight.params[key] ?? "");
          const courier = (key: string) => isolate(courierLabel(text(key), t.manualCourier));
          switch (insight.key) {
            case "low_confirmation":
              return fmt(t.note_low_confirmation, { share: tenth(t, number("rate")), orders: countOf("order", number("orders")) });
            case "weak_governorate":
              return fmt(t.note_weak_governorate, {
                name: isolate(placeName(text("name"))),
                share: tenth(t, number("rate")),
                average: tenth(t, number("average")),
                orders: countOf("order", number("orders")),
              });
            case "strong_governorate":
              return fmt(t.note_strong_governorate, {
                name: isolate(placeName(text("name"))),
                share: tenth(t, number("rate")),
                average: tenth(t, number("average")),
              });
            case "carrier_gap":
              return fmt(t.note_carrier_gap, {
                best: courier("best"),
                bestShare: tenth(t, number("bestRate")),
                worst: courier("worst"),
                worstShare: tenth(t, number("worstRate")),
              });
            case "abandoned_uncontacted":
              return fmt(t.note_abandoned_uncontacted, {
                orders: countOf("order", number("count")),
                value: isolate(formatMinorMoney(...inReport(number("value"), data.currency))),
              });
            case "peak_time":
              return fmt(t.note_peak_time, {
                day: days[number("dow")] ?? "",
                hour: isolate(new Intl.DateTimeFormat(getIntlLocale(), { hour: "numeric" }).format(new Date(2000, 0, 1, number("hour")))),
              });
            default:
              return null;
          }
        }

        const notes = data.insights
          .filter((insight) => JOURNEY_NOTES.includes(insight.key))
          .flatMap((insight) => {
            const said = sentence(insight);
            return said ? [{ insight, said }] : [];
          });
        if (notes.length === 0) return <p className={QUIET}>{t.notesEmpty}</p>;
        return (
          <ul className="space-y-3">
            {notes.map(({ insight, said }) => {
              const tone = NOTE_TONE[insight.tone] ?? NOTE_TONE.info;
              const ToneIcon = tone.icon;
              return (
                <li key={insight.key} className="flex items-start gap-3">
                  <ToneIcon weight="fill" aria-hidden className={cn("mt-0.5 size-5 shrink-0", tone.ink)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-6 text-pretty text-ink">{said}</p>
                    {insight.key === "abandoned_uncontacted" && <PartLink to="/abandoned-carts">{t.lostOpen}</PartLink>}
                  </div>
                </li>
              );
            })}
          </ul>
        );
      }}
    </Part>
  );
}

// ---------------------------------------------------------------- the group --

/**
 * «تفاصيل أكتر» of the journey tab: everything else the old screens said
 * about an order's way to the customer, one closed row each. A section that
 * needs data of its own asks for it when it is first opened (its body is not
 * mounted before that) and keeps it for the range (`useTabData`).
 *
 * A section whose request the role may not read is taken out; any other
 * failure stays inside its own section, with a retry.
 */
export function JourneyMore({ workspaceId, range, report }: { workspaceId: string; range: JourneySpan; report: ReportsDelivery }) {
  const t = useJourneyT();
  const [denied, setDenied] = useState<ReadonlySet<PartKey>>(() => new Set<PartKey>());
  const deny = useCallback((part: PartKey) => {
    setDenied((before) => (before.has(part) ? before : new Set<PartKey>([...before, part])));
  }, []);
  const part = { workspaceId, range, onDenied: deny };

  return (
    <ReportMore>
      <AccordionSection title={t.nowTitle} summary={t.nowSummary} icon={IconPlace} persistKey="reports:journey:now">
        <NowSection report={report} />
      </AccordionSection>
      {!denied.has("open") && (
        <AccordionSection title={t.openTitle} summary={t.openSummary} icon={IconNoAnswer} persistKey="reports:journey:open">
          <OpenSection {...part} />
        </AccordionSection>
      )}
      {!denied.has("products") && (
        <AccordionSection title={t.productsTitle} summary={t.productsSummary} icon={IconProducts} persistKey="reports:journey:products" flush>
          <ProductsSection {...part} />
        </AccordionSection>
      )}
      {!denied.has("sources") && (
        <AccordionSection title={t.sourcesTitle} summary={t.sourcesSummary} icon={IconAttribution} persistKey="reports:journey:sources" flush>
          <SourcesSection {...part} />
        </AccordionSection>
      )}
      {!denied.has("returns") && (
        <AccordionSection title={t.returnsTitle} summary={t.returnsSummary} icon={IconReturns} persistKey="reports:journey:returns">
          <ReturnsSection {...part} />
        </AccordionSection>
      )}
      {!denied.has("lost") && (
        <AccordionSection title={t.lostTitle} summary={t.lostSummary} icon={IconLostOrders} persistKey="reports:journey:lost">
          <LostSection {...part} />
        </AccordionSection>
      )}
      {!denied.has("times") && (
        <AccordionSection title={t.timesTitle} summary={t.timesSummary} icon={IconClock} persistKey="reports:journey:times">
          <TimesSection {...part} />
        </AccordionSection>
      )}
      {!denied.has("notes") && (
        <AccordionSection title={t.notesTitle} summary={t.notesSummary} icon={IconTip} persistKey="reports:journey:notes">
          <NotesSection {...part} />
        </AccordionSection>
      )}
    </ReportMore>
  );
}

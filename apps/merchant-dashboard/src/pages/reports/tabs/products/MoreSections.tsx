import {
  storeReportReturns,
  type ProfitPnl,
  type ProfitRow,
  type ProfitStatement,
  type ReportsLandingRow,
  type ReportsProductRow,
  type StockForecast,
  type StockForecastVariant,
  type StoreReportReturnProduct,
} from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { AccordionSection } from "@/components/Accordion";
import { IconCoins, IconEye, IconPage, IconReturns, IconStockLow, IconWarning } from "@/components/icons";
import { ReportTable, useTabData, type ReportColumn } from "@/components/report";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { humanize } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import type { ReportRange } from "@/lib/reportRange";
import { formatDay } from "@/lib/wholeNumber";
import { formatRate, RateBar } from "@/pages/analytics/reports/parts";
import { FORECAST_STATUS_KEY, FORECAST_STATUS_TONE, FORECAST_STRINGS } from "@/pages/inventory/forecast/forecastStrings";
import { variantDetail, variantFullName } from "@/pages/inventory/inventoryText";
import { GOOD_RETURN_RATE, HIGH_RETURN_RATE, isProductId, summarizeStock, type Side } from "./model";
import { Figure, NameInText, PartDenied, PartError, rateInWords, readablePath, rich, useMoney } from "./parts";
import { PRODUCTS_TAB_STRINGS } from "./strings";

/**
 * The sections of the tab's «تفاصيل أكتر»: everything else the old screens
 * showed about products, each one closed row until it is opened. Four of them
 * are drawn from what the tab already holds; «طلبات الإرجاع حسب المنتج» asks
 * for its own report only when it is opened.
 */

/** The picked days, for a file name and for the reads that take days. */
type Period = Pick<ReportRange, "from" | "to" | "compare" | "fromDay" | "toDay">;

/** Rows a list inside a section shows before it stops: the table above has them all. */
const FLAGGED_TOP = 5;
const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

// ------------------------------------------------------- needs a look --

const FLAG_LINK =
  "inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-[13px] font-semibold whitespace-nowrap text-primary transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none";

/**
 * «منتجات محتاجة نظرة»: every product the two product insights of the old
 * reports screen would name — the ones that keep coming back, and the ones
 * people look at and do not buy — each with what to check and a way to the
 * product. The tab's sentence names only the first of them.
 */
export function FlaggedSection({
  returners,
  weak,
  average,
  linked,
}: {
  returners: readonly ReportsProductRow[];
  weak: readonly ReportsProductRow[];
  /** The conversion the weak sellers are measured against, in percent. */
  average: number | null;
  linked: boolean;
}) {
  const t = useT(PRODUCTS_TAB_STRINGS);
  const total = returners.length + weak.length;
  if (total === 0) return null;

  const open = (product: ReportsProductRow) =>
    linked ? (
      <ViewLink to={`/catalog/${product.productId}`} className={FLAG_LINK}>
        {t.openProduct}
      </ViewLink>
    ) : null;

  return (
    <AccordionSection
      title={t.moreFlagged}
      summary={pluralOf(t, "products", total)}
      icon={IconWarning}
      persistKey="reports:products:flagged"
      flush
    >
      <ul className="divide-y divide-line">
        {returners.slice(0, FLAGGED_TOP).map((product) => (
          <li key={`return:${product.productId}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2">
            <p className="flex min-w-0 flex-1 basis-64 items-start gap-2 py-1.5 text-sm leading-6 text-pretty text-ink">
              <IconReturns aria-hidden weight="fill" className="mt-1 size-4 shrink-0 text-danger" />
              <span className="min-w-0">
                {rich(t.flaggedReturn, {
                  name: <NameInText name={product.name} />,
                  rate: rateInWords(product.returnRate ?? 0, t),
                  pct: <Figure>{formatRate(product.returnRate)}</Figure>,
                })}
              </span>
            </p>
            {open(product)}
          </li>
        ))}
        {weak.slice(0, FLAGGED_TOP).map((product) => (
          <li key={`weak:${product.productId}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2">
            <p className="flex min-w-0 flex-1 basis-64 items-start gap-2 py-1.5 text-sm leading-6 text-pretty text-ink">
              <IconEye aria-hidden weight="fill" className="mt-1 size-4 shrink-0 text-accent-dark" />
              <span className="min-w-0">
                {rich(t.flaggedWeak, {
                  name: <NameInText name={product.name} />,
                  views: pluralOf(t, "times", product.views),
                  rate: rateInWords(product.conversionRate ?? 0, t),
                  average: <Figure>{formatRate(average)}</Figure>,
                })}
              </span>
            </p>
            {open(product)}
          </li>
        ))}
      </ul>
    </AccordionSection>
  );
}

// -------------------------------------------------- profit per product --

/** Everything a finished order cost except ads: the product, both shipping legs, the fees. */
const costsOf = (statement: ProfitStatement) =>
  statement.costOfGoods + statement.shipping + statement.returnShipping + statement.fees + statement.zimosFees;

/**
 * «ربح كل منتج»: the old profit page's "by product" table — net profit, margin,
 * delivered revenue, costs, orders delivered and returned, and the most an
 * order can cost in ads — now sortable and exportable. Left out for a role
 * that may not read the P&L.
 */
export function ProfitSection({
  pnl,
  period,
  linked,
  onRetry,
}: {
  pnl: Side<ProfitPnl>;
  period: Period;
  linked: boolean;
  onRetry: () => void;
}) {
  const t = useT(PRODUCTS_TAB_STRINGS);
  const money = useMoney(pnl.state === "ok" ? pnl.data.currency : "EGP");
  if (pnl.state === "denied" || pnl.state === "loading") return null;

  if (pnl.state === "failed") {
    return (
      <AccordionSection title={t.moreProfit} icon={IconCoins} persistKey="reports:products:profit">
        <PartError onRetry={onRetry} />
      </AccordionSection>
    );
  }

  const rows = pnl.data.rows.filter((row) => row.orders.delivered + row.orders.returned + row.orders.open > 0);
  const nameOf = (row: ProfitRow) => row.label || (isProductId(row.key) ? "" : row.key) || t.deletedProduct;

  const columns: ReportColumn<ProfitRow>[] = [
    { key: "name", header: t.colProduct, cell: nameOf, sortValue: nameOf },
    {
      key: "net",
      header: t.colNet,
      align: "end",
      cell: (row) => (
        <Figure className={cn("font-medium", row.actual.netProfit < 0 ? "text-danger" : "text-ink")}>
          {money.format(row.actual.netProfit)}
        </Figure>
      ),
      sortValue: (row) => row.actual.netProfit,
      csv: (row) => money.major(row.actual.netProfit),
    },
    {
      key: "margin",
      header: t.colMargin,
      align: "end",
      cell: (row) => formatRate(row.actual.margin),
      sortValue: (row) => row.actual.margin,
    },
    {
      key: "revenue",
      header: t.colRevenue,
      align: "end",
      cell: (row) => money.format(row.actual.revenue),
      sortValue: (row) => row.actual.revenue,
      csv: (row) => money.major(row.actual.revenue),
    },
    {
      key: "costs",
      header: t.colCosts,
      hint: t.colCostsHint,
      align: "end",
      cell: (row) => money.format(costsOf(row.actual)),
      sortValue: (row) => costsOf(row.actual),
      csv: (row) => money.major(costsOf(row.actual)),
    },
    {
      key: "delivered",
      header: t.colDeliveredOrders,
      hint: t.colOrderShareHint,
      align: "end",
      cell: (row) => formatCount(Math.round(row.orders.delivered)),
      sortValue: (row) => row.orders.delivered,
    },
    {
      key: "returned",
      header: t.colReturnedOrders,
      hint: t.colOrderShareHint,
      align: "end",
      cell: (row) => formatCount(Math.round(row.orders.returned)),
      sortValue: (row) => row.orders.returned,
    },
    {
      key: "maxCpa",
      header: t.colMaxCpa,
      hint: t.colMaxCpaHint,
      align: "end",
      cell: (row) => money.format(row.maxCpa),
      sortValue: (row) => row.maxCpa,
      csv: (row) => money.major(row.maxCpa),
    },
  ];

  return (
    <AccordionSection
      title={t.moreProfit}
      summary={rows.length > 0 ? pluralOf(t, "products", rows.length) : t.pnlEmpty}
      icon={IconCoins}
      persistKey="reports:products:profit"
      flush
    >
      <ReportTable
        embedded
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key || "__none"}
        rowTo={(row) => (linked && isProductId(row.key) ? `/catalog/${row.key}` : null)}
        defaultSort={{ key: "net", dir: "desc" }}
        caption={t.moreProfit}
        note={t.moreProfitNote}
        empty={t.pnlEmpty}
        exportName="zimos-profit-by-product"
        range={period}
      />
    </AccordionSection>
  );
}

// ------------------------------------------------------ stock running out --

const STATUS_ORDER: Record<StockForecastVariant["status"], number> = { out: 0, reorder_now: 1, soon: 2, ok: 3, no_sales: 4 };

/**
 * «خلص أو قرّب يخلص»: the variants behind the tab's stock figure — what is
 * left, how fast it sells, when it runs out and by when to reorder, in the
 * stock forecast's own words. Drawn only when something is out or running low;
 * ordering is done on the inventory page, one link below.
 */
export function StockSection({ stock, linked, onRetry }: { stock: Side<StockForecast>; linked: boolean; onRetry: () => void }) {
  const t = useT(PRODUCTS_TAB_STRINGS);
  const f = useT(FORECAST_STRINGS);
  if (stock.state === "denied" || stock.state === "loading") return null;

  if (stock.state === "failed") {
    return (
      <AccordionSection title={t.moreStock} icon={IconStockLow} persistKey="reports:products:stock">
        <PartError onRetry={onRetry} />
      </AccordionSection>
    );
  }

  const rows = summarizeStock(stock.data).urgent;
  if (rows.length === 0) return null;

  const nameOf = (row: StockForecastVariant) => variantFullName(row.productName, variantDetail(row.optionValues, row.sku));
  const day = (value: string | null) => formatDay(value, DAY) || "—";

  const columns: ReportColumn<StockForecastVariant>[] = [
    { key: "name", header: t.colVariant, cell: nameOf, sortValue: nameOf },
    {
      key: "status",
      header: t.colStatus,
      cell: (row) => <StatusBadge value={row.status} tone={FORECAST_STATUS_TONE[row.status]} text={f[FORECAST_STATUS_KEY[row.status]]} />,
      sortValue: (row) => STATUS_ORDER[row.status],
      csv: (row) => f[FORECAST_STATUS_KEY[row.status]],
    },
    {
      key: "available",
      header: t.colAvailable,
      align: "end",
      cell: (row) => formatCount(row.available),
      sortValue: (row) => row.available,
    },
    {
      key: "perDay",
      header: t.colPerDay,
      align: "end",
      cell: (row) => (row.perDay > 0 ? formatCount(row.perDay) : "—"),
      sortValue: (row) => row.perDay,
    },
    {
      key: "daysLeft",
      header: t.colDaysLeft,
      align: "end",
      cell: (row) => (row.daysLeft === null ? "—" : countOf("day", row.daysLeft)),
      sortValue: (row) => row.daysLeft,
    },
    { key: "runsOut", header: t.colRunsOut, cell: (row) => day(row.runsOutOn), sortValue: (row) => row.runsOutOn },
    { key: "reorderBy", header: t.colReorderBy, cell: (row) => day(row.reorderBy), sortValue: (row) => row.reorderBy },
    {
      key: "suggested",
      header: t.colSuggested,
      align: "end",
      cell: (row) => (row.suggested > 0 ? formatCount(row.suggested) : "—"),
      sortValue: (row) => row.suggested,
    },
  ];

  return (
    <AccordionSection
      title={t.moreStock}
      summary={pluralOf(t, "variants", rows.length)}
      icon={IconStockLow}
      persistKey="reports:products:stock"
      flush
    >
      <ReportTable
        embedded
        columns={columns}
        rows={rows}
        rowKey={(row) => row.variantId}
        rowTo={(row) => (linked ? `/catalog/${row.productId}` : null)}
        caption={t.moreStock}
        note={fmt(t.moreStockNote, { window: countOf("day", stock.data.settings.windowDays) })}
        exportName="zimos-stock-running-low"
      />
    </AccordionSection>
  );
}

// ------------------------------------------------ return requests by product --

type ReturnLine = StoreReportReturnProduct & { rowId: string };

/** The body of the returns section. It is mounted when the section is opened, so the report is asked for only then. */
function ReturnsByProduct({ workspaceId, period, linked }: { workspaceId: string; period: Period; linked: boolean }) {
  const t = useT(PRODUCTS_TAB_STRINGS);
  // The store reports take DAYS, both included (the hub's picked days), not instants.
  const report = useTabData("products:returns", workspaceId, period, () =>
    storeReportReturns(apiClient, workspaceId, { from: period.fromDay, to: period.toDay })
  );

  if (report.error) {
    return isPermissionError(report.error) ? (
      <PartDenied className="px-4 py-4" />
    ) : (
      <PartError onRetry={report.retry} className="px-4 py-2" />
    );
  }

  const reasonLabel = (code: string) => (t as Record<string, string>)[`reason_${code}`] ?? humanize(code);
  const rows: ReturnLine[] = (report.data?.products ?? []).map((product, index) => ({
    ...product,
    rowId: product.productId ?? `row-${index}`,
  }));
  const reasonsOf = (row: ReturnLine) => row.reasons.map(reasonLabel).join(t.listJoin);
  const nameOf = (row: ReturnLine) => row.name || t.deletedProduct;

  const columns: ReportColumn<ReturnLine>[] = [
    { key: "name", header: t.colProduct, cell: nameOf, sortValue: nameOf },
    {
      key: "delivered",
      header: t.colDeliveredUnits,
      align: "end",
      cell: (row) => formatCount(row.delivered),
      sortValue: (row) => row.delivered,
    },
    {
      key: "returned",
      header: t.colAskedBack,
      align: "end",
      cell: (row) => formatCount(row.returned),
      sortValue: (row) => row.returned,
    },
    {
      key: "rate",
      header: t.colRequestRate,
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <RateBar percent={row.returnRate} good={GOOD_RETURN_RATE} bad={HIGH_RETURN_RATE} inverted />
          {/* The word says it too: a high rate is not left to the red bar alone. */}
          {row.returnRate !== null && row.returnRate >= HIGH_RETURN_RATE && <StatusBadge value="high" tone="danger" text={t.high} />}
        </span>
      ),
      sortValue: (row) => row.returnRate,
    },
    {
      key: "reasons",
      header: t.colReasons,
      cell: (row) => (row.reasons.length === 0 ? "—" : <span className="text-ink-soft">{reasonsOf(row)}</span>),
      csv: reasonsOf,
    },
  ];

  return (
    <ReportTable
      embedded
      loading={report.loading}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.rowId}
      rowTo={(row) => (linked && row.productId ? `/catalog/${row.productId}` : null)}
      defaultSort={{ key: "returned", dir: "desc" }}
      caption={t.moreReturns}
      note={t.moreReturnsNote}
      empty={t.returnsEmpty}
      exportName="zimos-returns-by-product"
      range={period}
    />
  );
}

/**
 * «طلبات الإرجاع حسب المنتج»: the returns store report's product table — what
 * customers asked to send back after delivery, and why. A different count from
 * the table's «المرتجع» (parcels that came back with the courier), and it says so.
 */
export function ReturnsSection(props: { workspaceId: string; period: Period; linked: boolean }) {
  const t = useT(PRODUCTS_TAB_STRINGS);
  return (
    <AccordionSection
      title={t.moreReturns}
      summary={t.moreReturnsSummary}
      icon={IconReturns}
      persistKey="reports:products:returns"
      flush
    >
      <ReturnsByProduct {...props} />
    </AccordionSection>
  );
}

// ----------------------------------------------------------- landing pages --

/** «صفحات الهبوط»: the first page of each visit and what those visits bought — the old reports screen's second table. */
export function LandingSection({
  pages,
  currency,
  period,
}: {
  pages: readonly ReportsLandingRow[];
  currency: string;
  period: Period;
}) {
  const t = useT(PRODUCTS_TAB_STRINGS);
  const money = useMoney(currency);

  const columns: ReportColumn<ReportsLandingRow>[] = [
    {
      key: "path",
      header: t.colPage,
      cell: (row) => <bdi dir="auto">{readablePath(row.path)}</bdi>,
      sortValue: (row) => readablePath(row.path),
    },
    {
      key: "sessions",
      header: t.colSessions,
      align: "end",
      cell: (row) => formatCount(row.sessions),
      sortValue: (row) => row.sessions,
    },
    { key: "orders", header: t.colOrders, align: "end", cell: (row) => formatCount(row.orders), sortValue: (row) => row.orders },
    {
      key: "conversion",
      header: t.colConversion,
      align: "end",
      cell: (row) => formatRate(row.conversionRate),
      sortValue: (row) => row.conversionRate,
    },
    {
      key: "sales",
      header: t.colSales,
      align: "end",
      cell: (row) => money.format(row.sales),
      sortValue: (row) => row.sales,
      csv: (row) => money.major(row.sales),
    },
  ];

  return (
    <AccordionSection
      title={t.moreLanding}
      summary={t.moreLandingSummary}
      icon={IconPage}
      persistKey="reports:products:landing"
      flush
    >
      <ReportTable
        embedded
        columns={columns}
        rows={pages}
        rowKey={(row) => row.path}
        defaultSort={{ key: "sessions", dir: "desc" }}
        caption={t.moreLanding}
        empty={t.landingEmpty}
        exportName="zimos-landing-pages"
        range={period}
      />
    </AccordionSection>
  );
}

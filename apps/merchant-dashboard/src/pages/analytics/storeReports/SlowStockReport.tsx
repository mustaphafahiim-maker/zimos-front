import { useSearchParams } from "react-router-dom";
import { Button, cn } from "@store-builder/ui";
import {
  STORE_REPORT_SLOW_DAYS,
  storeReportSlowStock,
  type StoreReportSlowDays,
  type StoreReportSlowVariant,
} from "@store-builder/api-client";
import { EmptyState } from "@/components/EmptyState";
import { IconCheck, IconCoins, IconHourglass, IconPackageSearch } from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { ReportKpiStrip, ReportTable, type ReportColumn } from "@/components/report";
import { Segmented } from "@/components/Segmented";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { formatDate, formatOptions } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { useReport } from "@/lib/reportRange";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { reportMoney, StoreReportNote, StoreReportShell, useAddressValue, useStoreReportCsv } from "./storeReportParts";
import { STORE_REPORT_STRINGS } from "./storeReportStrings";

const STRINGS = {
  en: {
    question: "Which stock is sitting still?",
    description: "Products with stock free to sell that have not sold for a while, the most money tied up first.",
    daysLabel: "No sale in the last",
    days: "{n} days",
    includeNew: "With products added in that time",
    tiedUp: "Money tied up",
    tiedUpHint: "{units} · {products}, at cost",
    neverSold: "Never sold",
    neverSoldHint: "products nobody has ordered yet",
    table: "No sale in the last {n} days",
    freeUnits: "Free units",
    value: "Value",
    lastSold: "Last sold",
    daysAgo: "Days ago",
    actions: "Way out",
    capped: "The list and its totals stop at the {n} products with the most money tied up.",
    emptyTitle: "Nothing is sitting still",
    emptyHint: "Every product with stock has sold in the last {n} days.",
    emptyNewHint: "Products added in that time are left out as too new to judge.",
    emptyAction: "Show the new products too",
  },
  ar: {
    question: "إيه البضاعة اللي واقفة؟",
    description: "منتجات عندها مخزون متاح وبقالها فترة مش بتتباع، الأكتر فلوس محبوسة في الأول.",
    daysLabel: "مفيش بيع في آخر",
    days: "{n} يوم",
    includeNew: "ومعاها المنتجات اللي اتضافت في المدة دي",
    tiedUp: "فلوس محبوسة في المخزون",
    tiedUpHint: "{units} · {products}، بسعر التكلفة",
    neverSold: "عمرها ما اتباعت",
    neverSoldHint: "منتجات محدش طلبها لسه",
    table: "مفيش بيع في آخر {n} يوم",
    freeUnits: "قطع متاحة",
    value: "القيمة",
    lastSold: "آخر بيع",
    daysAgo: "من كام يوم",
    actions: "الحل",
    capped: "القائمة وأرقامها بتقف عند أكتر {n} منتج فلوسه محبوسة.",
    emptyTitle: "مفيش بضاعة راكدة",
    emptyHint: "كل منتج عنده مخزون اتباع في آخر {n} يوم.",
    emptyNewHint: "المنتجات اللي اتضافت في المدة دي مش محسوبة عشان لسه جديدة.",
    emptyAction: "اعرض المنتجات الجديدة كمان",
  },
} satisfies Messages;

const DEFAULT_DAYS: StoreReportSlowDays = 60;
/** What the report lists at most (the API's default `limit`): its totals cover these rows only. */
const LIST_LIMIT = 500;
type DaysChoice = "30" | "60" | "90" | "180";

/**
 * Reports → «البضاعة الراكدة» (handoff 240, analytics.view): variants with
 * free stock and no sale in the last 30 / 60 / 90 / 180 days — the money they
 * tie up and the ones that never sold as stat cards, then the ONE table,
 * where a row opens its product and offers its way out: a scheduled sale.
 */
export function SlowStockReport() {
  const t = useT(STRINGS);
  const c = useT(STORE_REPORT_STRINGS);
  const workspaceId = useWorkspaceId();
  const [params, setParams] = useSearchParams();
  const days = STORE_REPORT_SLOW_DAYS.find((value) => String(value) === params.get("days")) ?? DEFAULT_DAYS;
  const includeNew = params.get("new") === "1";
  const state = useReport(
    () => storeReportSlowStock(apiClient, workspaceId, { days, includeNew: includeNew || undefined }),
    [workspaceId, days, includeNew]
  );
  const exportCsv = useStoreReportCsv(
    "slow-stock",
    { days, includeNew: includeNew || undefined },
    `slow-stock-${days}d-${new Date().toISOString().slice(0, 10)}`
  );

  function change(apply: (next: URLSearchParams) => void) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        apply(next);
        return next;
      },
      { replace: true }
    );
  }
  // The switch and the toggle answer at once; the address (and the report) follow.
  const [daysPicked, pickDays] = useAddressValue<StoreReportSlowDays>(days, (value) =>
    change((next) => {
      if (value === DEFAULT_DAYS) next.delete("days");
      else next.set("days", String(value));
    })
  );
  const [newTicked, tickNew] = useAddressValue(includeNew, (ticked) =>
    change((next) => {
      if (ticked) next.set("new", "1");
      else next.delete("new");
    })
  );

  return (
    <StoreReportShell
      slug="slow-stock"
      title={c.slowStock}
      description={t.description}
      question={t.question}
      note={t.description}
      controls={
        <>
          <Segmented
            size="sm"
            value={String(daysPicked) as DaysChoice}
            onChange={(value) => pickDays(STORE_REPORT_SLOW_DAYS.find((option) => String(option) === value) ?? DEFAULT_DAYS)}
            label={t.daysLabel}
            options={STORE_REPORT_SLOW_DAYS.map((value) => ({ value: String(value) as DaysChoice, label: fmt(t.days, { n: value }) }))}
          />
          <button
            type="button"
            aria-pressed={newTicked}
            onClick={() => tickNew(!newTicked)}
            className={cn(
              "zimos-chip inline-flex h-9 max-w-full cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium select-none pointer-coarse:h-11",
              "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
              newTicked ? "bg-primary text-primary-foreground" : "bg-paper-raised text-ink ring-1 ring-line hover:bg-paper-sunken"
            )}
          >
            {newTicked && <IconCheck className="size-4 shrink-0" weight="bold" aria-hidden />}
            <span className="min-w-0 truncate">{t.includeNew}</span>
          </button>
        </>
      }
      state={state}
    >
      {(data) => {
        if (data.variants.length === 0) {
          return (
            <EmptyState
              icon={<IconHourglass aria-hidden />}
              tone="success"
              title={t.emptyTitle}
              description={`${fmt(t.emptyHint, { n: data.days })}${includeNew ? "" : ` ${t.emptyNewHint}`}`}
              action={
                includeNew ? undefined : (
                  <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" onClick={() => tickNew(true)}>
                    {t.emptyAction}
                  </Button>
                )
              }
            />
          );
        }

        const money = (minor: string | number) => reportMoney(minor, data.currency);
        const columns: ReportColumn<StoreReportSlowVariant>[] = [
          {
            key: "product",
            header: c.product,
            cell: (row) => {
              const detail = formatOptions(row.options);
              return (
                <span className="block">
                  <bdi className="block truncate">{row.productName || "—"}</bdi>
                  {(detail || row.sku) && (
                    <span className="block truncate text-xs font-normal text-ink-soft">
                      {detail && <bdi>{detail}</bdi>}
                      {detail && row.sku && " · "}
                      {row.sku && <bdi dir="ltr">{row.sku}</bdi>}
                    </span>
                  )}
                </span>
              );
            },
            sortValue: (row) => row.productName,
            csv: (row) => [row.productName, formatOptions(row.options), row.sku].filter(Boolean).join(" · "),
          },
          { key: "freeUnits", header: t.freeUnits, align: "end", cell: (row) => formatCount(row.freeUnits), sortValue: (row) => row.freeUnits },
          {
            key: "value",
            header: t.value,
            align: "end",
            cell: (row) =>
              row.valueTiedUp === null ? (
                <StatusBadge value="no_cost" tone="warning" text={c.noCostBadge} />
              ) : (
                <bdi className="font-semibold">{money(row.valueTiedUp)}</bdi>
              ),
            sortValue: (row) => (row.valueTiedUp === null ? null : Number(row.valueTiedUp)),
          },
          {
            key: "lastSold",
            header: t.lastSold,
            cell: (row) => (row.lastSoldAt ? formatDate(row.lastSoldAt) : <StatusBadge value="never_sold" tone="neutral" text={t.neverSold} />),
            sortValue: (row) => (row.lastSoldAt ? Date.parse(row.lastSoldAt) : null),
            csv: (row) => row.lastSoldAt,
            hideBelow: "md",
          },
          {
            key: "daysAgo",
            header: t.daysAgo,
            align: "end",
            cell: (row) => (row.daysSinceSale === null ? "—" : formatCount(row.daysSinceSale)),
            sortValue: (row) => row.daysSinceSale,
          },
          {
            key: "actions",
            header: t.actions,
            align: "end",
            // Handoff 240: a slow product's way out is a sale with a start and an end (item 227).
            cell: (row) => (
              <ViewLink
                to={`/offers/scheduled-sales/new?product=${row.productId}`}
                className="-my-3 inline-flex min-h-11 items-center rounded-sm font-semibold whitespace-nowrap text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {c.scheduleSale}
              </ViewLink>
            ),
            csv: () => "",
          },
        ];

        return (
          <>
            <ReportKpiStrip sparkline={false}>
              <KpiCard
                label={t.tiedUp}
                value={money(data.totals.valueTiedUp)}
                hint={fmt(t.tiedUpHint, {
                  units: countOf("piece", data.totals.units),
                  products: pluralOf(c, "productsCount", data.totals.variants),
                })}
                icon={<IconCoins />}
              />
              <KpiCard label={t.neverSold} value={formatCount(data.totals.neverSold)} hint={t.neverSoldHint} icon={<IconPackageSearch />} />
            </ReportKpiStrip>

            {data.totals.withoutCost > 0 && (
              <StoreReportNote>
                <p className="font-semibold">{pluralOf(c, "noCost", data.totals.withoutCost)}</p>
              </StoreReportNote>
            )}

            <ReportTable
              columns={columns}
              rows={data.variants}
              rowKey={(row) => row.variantId}
              // The first cell opens the product: «اعرض المنتج» of the old row.
              rowTo={(row) => `/catalog/${row.productId}`}
              pageSize={25}
              exportName="slow-stock"
              onExport={exportCsv}
              caption={fmt(t.table, { n: data.days })}
              note={data.variants.length >= LIST_LIMIT ? fmt(t.capped, { n: LIST_LIMIT }) : undefined}
            />
          </>
        );
      }}
    </StoreReportShell>
  );
}

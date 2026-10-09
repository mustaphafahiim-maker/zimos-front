import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { storeReportInventoryValue, type StoreReportInventoryValue, type StoreReportInventoryVariant } from "@store-builder/api-client";
import { AccordionSection } from "@/components/Accordion";
import { EmptyState } from "@/components/EmptyState";
import { IconBoxes, IconCoins, IconLock, IconPlace } from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { ChipRow, type ChipItem } from "@/components/list";
import { ReportKpiStrip, ReportMore, ReportTable, type ReportColumn } from "@/components/report";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { formatOptions } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { useReport } from "@/lib/reportRange";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { reportMoney, StoreReportNote, StoreReportShell, useAddressValue, useStoreReportCsv } from "./storeReportParts";
import { STORE_REPORT_STRINGS } from "./storeReportStrings";

const STRINGS = {
  en: {
    question: "What is your stock worth?",
    description: "What the stock on your shelves is worth at cost, as of now.",
    value: "Stock value at cost",
    valueHint: "free to sell: {amount}",
    reserved: "Of which reserved",
    reservedHint: "promised to open orders, still on the shelf",
    units: "Units",
    variants_one: "in 1 variant",
    variants_other: "in {n} variants",
    locationFilter: "Stock location",
    allLocations: "All locations",
    locations: "By location",
    locationsHint: "Units and value at cost in each stock location",
    location: "Location",
    table: "Products in stock",
    tableHint: "Units on hand × the variant's cost.",
    onHand: "On hand",
    reservedColumn: "Reserved",
    free: "Free",
    unitCost: "Unit cost",
    valueColumn: "Value",
    noCostHelp: "Open a product and add its cost to count it:",
    more_one: "and 1 more",
    more_other: "and {n} more",
    showLess: "Show fewer",
    emptyTitle: "No stock to value",
    emptyHint: "Products that track stock and have units on hand appear here.",
    emptyAction: "Open the products",
    emptyLocation: "This location holds no stock.",
  },
  ar: {
    question: "البضاعة اللي عندك تساوي كام؟",
    description: "البضاعة اللي على الرف تساوي كام بسعر التكلفة، دلوقتي.",
    value: "قيمة المخزون بالتكلفة",
    valueHint: "المتاح للبيع: {amount}",
    reserved: "منها محجوز لأوردرات",
    reservedHint: "متوعود بيه لأوردرات مفتوحة ولسه على الرف",
    units: "قطع",
    variants_one: "في نوع واحد",
    variants_two: "في نوعين",
    variants_few: "في {n} أنواع",
    variants_other: "في {n} نوع",
    locationFilter: "مكان التخزين",
    allLocations: "كل الأماكن",
    locations: "حسب المكان",
    locationsHint: "القطع وقيمتها بالتكلفة في كل مكان تخزين",
    location: "المكان",
    table: "المنتجات اللي في المخزون",
    tableHint: "القطع الموجودة × تكلفة النوع.",
    onHand: "موجود",
    reservedColumn: "محجوز",
    free: "متاح",
    unitCost: "تكلفة القطعة",
    valueColumn: "القيمة",
    noCostHelp: "افتح المنتج واكتب تكلفته عشان يتحسب:",
    more_one: "وواحد كمان",
    more_two: "واتنين كمان",
    more_few: "و{n} كمان",
    more_other: "و{n} كمان",
    showLess: "اعرض أقل",
    emptyTitle: "مفيش مخزون يتحسب",
    emptyHint: "المنتجات اللي بتتابع مخزونها وعندها قطع موجودة بتظهر هنا.",
    emptyAction: "افتح المنتجات",
    emptyLocation: "المكان ده مفيهوش مخزون.",
  },
} satisfies Messages;

type Strings = Record<keyof (typeof STRINGS)["en"], string>;
type LocationRow = NonNullable<StoreReportInventoryValue["locations"]>[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Products named in the warning before «و٥ كمان». */
const NAMED_WITHOUT_COST = 6;
/** The chip that shows every location. */
const ALL = "";

/**
 * «N منتج من غير سعر تكلفة — مش داخلين في الحساب»: the variants the totals
 * leave out, each a link to its product, where the cost is typed.
 */
function WithoutCostWarning({ data, t }: { data: StoreReportInventoryValue; t: Strings }) {
  const c = useT(STORE_REPORT_STRINGS);
  const [open, setOpen] = useState(false);
  // `withoutCost` names the variant only; the variants list has its product.
  const productOf = new Map(data.variants.map((variant) => [variant.variantId, variant.productId]));
  const named = open ? data.withoutCost : data.withoutCost.slice(0, NAMED_WITHOUT_COST);
  const left = data.withoutCost.length - named.length;
  return (
    <StoreReportNote>
      <p className="font-semibold">{pluralOf(c, "noCost", data.totals.withoutCost)}</p>
      <p className="text-[13px] leading-5 text-ink-soft">{t.noCostHelp}</p>
      <ul className="mt-1 flex flex-wrap gap-x-4">
        {named.map((item) => {
          const productId = productOf.get(item.variantId);
          return (
            <li key={item.variantId} className="inline-flex min-h-11 items-center gap-1.5 pointer-fine:min-h-8">
              {productId ? (
                <ViewLink to={`/catalog/${productId}`} className="font-medium text-ink underline underline-offset-2">
                  <bdi>{item.productName}</bdi>
                </ViewLink>
              ) : (
                <bdi className="font-medium">{item.productName}</bdi>
              )}
              {/* Two variants of one product read the same without it. */}
              {item.sku && (
                <bdi dir="ltr" className="text-xs text-ink-soft">
                  {item.sku}
                </bdi>
              )}
            </li>
          );
        })}
        {left > 0 && <li className="inline-flex min-h-11 items-center text-ink-soft pointer-fine:min-h-8">{pluralOf(t, "more", left)}</li>}
      </ul>
      {data.withoutCost.length > NAMED_WITHOUT_COST && (
        <Button type="button" variant="ghost" size="sm" className="-ms-2 mt-1 min-h-11 rounded-full px-3 pointer-fine:min-h-8" onClick={() => setOpen((value) => !value)}>
          {open ? t.showLess : fmt(c.showAll, { n: data.withoutCost.length })}
        </Button>
      )}
    </StoreReportNote>
  );
}

/**
 * Reports → «قيمة المخزون» (handoff 239, financial_reports.view): on-hand
 * units × cost and the part promised to open orders as stat cards, a chip per
 * stock location when the store has locations, the variants without a cost —
 * which the totals leave out — as a note that links to their products, every
 * variant in the ONE table, and the locations behind «تفاصيل أكتر».
 */
export function InventoryValueReport() {
  const t = useT(STRINGS);
  const c = useT(STORE_REPORT_STRINGS);
  const workspaceId = useWorkspaceId();
  const [params, setParams] = useSearchParams();
  const wanted = params.get("location") ?? "";
  const locationId = UUID.test(wanted) ? wanted : "";
  const state = useReport(
    () => storeReportInventoryValue(apiClient, workspaceId, { locationId: locationId || undefined }),
    [workspaceId, locationId]
  );
  const locations = state.data?.locations ?? null;
  const exportCsv = useStoreReportCsv(
    "inventory-value",
    { locationId: locationId || undefined },
    `inventory-value-${new Date().toISOString().slice(0, 10)}`
  );

  function selectLocation(id: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("location", id);
        else next.delete("location");
        return next;
      },
      { replace: true }
    );
  }

  // The chips answer at once; the address (and the report) follow.
  const [picked, pick] = useAddressValue<string>(locationId, selectLocation);

  // A location from an old link that the store no longer has is no filter.
  const unknownLocation = Boolean(locationId && locations && !locations.some((location) => location.locationId === locationId));
  useEffect(() => {
    if (unknownLocation) selectLocation("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unknownLocation]);

  const chips: ChipItem<string>[] = [
    { value: ALL, label: t.allLocations },
    ...(locations ?? []).map((location) => ({ value: location.locationId, label: location.name })),
  ];

  return (
    <StoreReportShell
      slug="inventory-value"
      title={c.inventoryValue}
      description={t.description}
      question={t.question}
      note={t.description}
      controls={
        locations && locations.length > 0 ? (
          <ChipRow items={chips} value={picked} onChange={pick} label={t.locationFilter} collapseEmpty={false} className="min-w-0 flex-1" />
        ) : undefined
      }
      state={state}
    >
      {(data) => {
        if (data.variants.length === 0 && !locationId) {
          return (
            <EmptyState
              icon={<IconBoxes aria-hidden />}
              title={t.emptyTitle}
              description={t.emptyHint}
              action={
                <Button asChild className="min-h-11 rounded-full px-5">
                  <ViewLink to="/catalog">{t.emptyAction}</ViewLink>
                </Button>
              }
            />
          );
        }

        const money = (minor: string | number) => reportMoney(minor, data.currency);
        const reservedValue = Math.max(0, Number(data.totals.value) - Number(data.totals.freeValue));
        const locationName = new Map((data.locations ?? []).map((location) => [location.locationId, location.name]));

        const columns: ReportColumn<StoreReportInventoryVariant>[] = [
          {
            key: "product",
            header: c.product,
            cell: (row) => {
              const detail = formatOptions(row.options);
              // Where the units are, when the store has more than one place and none is picked.
              const places =
                !locationId && row.locations && row.locations.length > 1
                  ? row.locations.map((place) => `${locationName.get(place.locationId) ?? "—"}: ${formatCount(place.units)}`).join(" · ")
                  : "";
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
                  {places && <span className="block truncate text-xs font-normal text-ink-soft">{places}</span>}
                </span>
              );
            },
            sortValue: (row) => row.productName,
            csv: (row) => [row.productName, formatOptions(row.options), row.sku].filter(Boolean).join(" · "),
          },
          { key: "onHand", header: t.onHand, align: "end", cell: (row) => formatCount(row.onHand), sortValue: (row) => row.onHand },
          {
            key: "reserved",
            header: t.reservedColumn,
            align: "end",
            cell: (row) => (row.reserved === 0 ? "—" : formatCount(row.reserved)),
            sortValue: (row) => row.reserved,
            hideBelow: "md",
          },
          { key: "free", header: t.free, align: "end", cell: (row) => formatCount(row.free), sortValue: (row) => row.free, hideBelow: "md" },
          {
            key: "unitCost",
            header: t.unitCost,
            align: "end",
            cell: (row) => (row.unitCost === null ? <StatusBadge value="no_cost" tone="warning" text={c.noCostBadge} /> : money(row.unitCost)),
            sortValue: (row) => (row.unitCost === null ? null : Number(row.unitCost)),
          },
          {
            key: "value",
            header: t.valueColumn,
            align: "end",
            cell: (row) => (row.value === null ? "—" : <bdi className="font-semibold">{money(row.value)}</bdi>),
            sortValue: (row) => (row.value === null ? null : Number(row.value)),
          },
        ];

        const locationColumns: ReportColumn<LocationRow>[] = [
          { key: "name", header: t.location, cell: (row) => row.name, sortValue: (row) => row.name },
          { key: "units", header: t.units, align: "end", cell: (row) => formatCount(row.units), sortValue: (row) => row.units },
          { key: "value", header: t.valueColumn, align: "end", cell: (row) => money(row.value), sortValue: (row) => Number(row.value) },
        ];

        return (
          <>
            <ReportKpiStrip sparkline={false}>
              <KpiCard
                label={t.value}
                value={money(data.totals.value)}
                hint={fmt(t.valueHint, { amount: money(data.totals.freeValue) })}
                icon={<IconCoins />}
              />
              <KpiCard label={t.reserved} value={money(reservedValue)} hint={t.reservedHint} icon={<IconLock />} />
              <KpiCard label={t.units} value={formatCount(data.totals.units)} hint={pluralOf(t, "variants", data.totals.variants)} icon={<IconBoxes />} />
            </ReportKpiStrip>

            {data.totals.withoutCost > 0 && <WithoutCostWarning data={data} t={t} />}

            <ReportTable
              columns={columns}
              rows={data.variants}
              rowKey={(row) => row.variantId}
              rowTo={(row) => `/catalog/${row.productId}`}
              defaultSort={{ key: "value", dir: "desc" }}
              pageSize={25}
              exportName="inventory-value"
              onExport={exportCsv}
              caption={t.table}
              note={t.tableHint}
              empty={t.emptyLocation}
            />

            {data.locations && data.locations.length > 0 && (
              <ReportMore>
                <AccordionSection title={t.locations} summary={t.locationsHint} icon={IconPlace} persistKey="store-report:inventory:locations" flush>
                  <ReportTable
                    embedded
                    columns={locationColumns}
                    rows={data.locations}
                    rowKey={(row) => row.locationId}
                    exportName="inventory-value-locations"
                    caption={t.locations}
                  />
                </AccordionSection>
              </ReportMore>
            )}
          </>
        );
      }}
    </StoreReportShell>
  );
}

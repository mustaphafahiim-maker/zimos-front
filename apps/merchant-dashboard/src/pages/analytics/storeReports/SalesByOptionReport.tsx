import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { storeReportSalesByOption, type StoreReportOptionGroup, type StoreReportOptionValue } from "@store-builder/api-client";
import { EmptyState } from "@/components/EmptyState";
import { IconRuler } from "@/components/icons";
import { ChipRow, type ChipItem } from "@/components/list";
import { ReportTable, type ReportColumn } from "@/components/report";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { countOf, pluralOf } from "@/lib/plural";
import { useReport } from "@/lib/reportRange";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import {
  formatShare,
  LongerPeriodButton,
  reportMoney,
  reportRangeRefused,
  StoreReportCard,
  StoreReportRangeBar,
  StoreReportShell,
  useAddressValue,
  useStoreReportCsv,
  useStoreReportRange,
} from "./storeReportParts";
import { STORE_REPORT_STRINGS } from "./storeReportStrings";

const STRINGS = {
  en: {
    question: "How many of each size and colour sold?",
    description: "Use it when ordering from your supplier: how many of each size.",
    filterLabel: "Option",
    allOptions: "All options",
    valueShare: "{value} — {share}",
    table: "Every value",
    colOption: "Option",
    colValue: "Value",
    colShare: "Share",
    colProducts: "Products",
    note: "Capitals and spaces around a name don't count (“M” and “ m ” are one value); different words stay apart (“Color” and “Colour”). Cancelled, rejected and test orders are left out.",
    emptyTitle: "Nothing sold with options in this period",
    emptyHint: "Sizes and colours appear here once products that have them are ordered.",
  },
  ar: {
    question: "كم بيع من كل مقاس ولون؟",
    description: "استخدمه عند الطلب من المورّد: الكمية من كل مقاس.",
    filterLabel: "الخيار",
    allOptions: "كل الخيارات",
    valueShare: "{value} — {share}",
    table: "كل القيم",
    colOption: "الخيار",
    colValue: "القيمة",
    colShare: "النسبة",
    colProducts: "منتجات",
    note: "لا فرق بين الحروف الكبيرة والصغيرة ولا بالمسافات حول الاسم («M» و« m » قيمة واحدة)، لكن الكلمات المختلفة تبقى منفصلة («Color» و«Colour»). الملغاة والمرفوضة والتجريبية غير محتسبة.",
    emptyTitle: "لا توجد مبيعات بخيارات في هذه الفترة",
    emptyHint: "تظهر المقاسات والألوان هنا فور طلب المنتجات التي لها خيارات.",
  },
} satisfies Messages;

/** How many values a card lists before «اعرض الكل». */
const VALUES_SHOWN = 8;
/** The chip that shows every option. An option's own name is never empty. */
const ALL = "";

/** Option names are one when only capitals and outer spaces differ, as the report itself matches them. */
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A file name may not carry these. */
const forFileName = (text: string) => text.trim().replace(/[\\/:*?"<>|\s]+/g, "-");

/**
 * Reports → «المبيعات حسب المقاس واللون» (analytics.view): a chip
 * per option name (Size, Colour…), a card per option with a bar per value and
 * its share of that option's pieces, and every value in the ONE table —
 * sortable, its export the server's file under the same filter.
 */
export function SalesByOptionReport() {
  const t = useT(STRINGS);
  const c = useT(STORE_REPORT_STRINGS);
  const workspaceId = useWorkspaceId();
  const range = useStoreReportRange();
  const [params, setParams] = useSearchParams();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const state = useReport(
    () => storeReportSalesByOption(apiClient, workspaceId, range.days),
    [workspaceId, range.days.from, range.days.to]
  );

  const groups = state.data?.options ?? [];
  // The filter follows the window: an option nothing sold with is no filter at all.
  const wanted = params.get("option") ?? "";
  const selected = groups.find((group) => sameName(group.option, wanted))?.option ?? ALL;

  // The chips answer at once; the address follows.
  const [picked, pick] = useAddressValue<string>(selected, (option) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (option) next.set("option", option);
        else next.delete("option");
        return next;
      },
      { replace: true }
    )
  );
  const exportCsv = useStoreReportCsv(
    "sales-by-option",
    { ...range.days, option: selected || undefined },
    `sales-by-option-${selected ? `${forFileName(selected)}-` : ""}${range.days.from}-${range.days.to}`
  );

  const chips: ChipItem<string>[] = [{ value: ALL, label: t.allOptions }, ...groups.map((group) => ({ value: group.option, label: group.option }))];

  return (
    <StoreReportShell
      slug="sales-by-option"
      title={c.options}
      description={t.description}
      question={t.question}
      note={t.description}
      controls={<StoreReportRangeBar range={range} refused={reportRangeRefused(state.error)} />}
      state={state}
    >
      {(data) => {
        if (data.options.length === 0) {
          return <EmptyState icon={<IconRuler aria-hidden />} title={t.emptyTitle} description={t.emptyHint} action={<LongerPeriodButton range={range} />} />;
        }
        const shown = picked ? data.options.filter((group) => group.option === picked) : data.options;
        const money = (minor: string | number) => reportMoney(minor, data.currency);

        const card = (group: StoreReportOptionGroup) => {
          const open = expanded.has(group.option);
          const values = open ? group.values : group.values.slice(0, VALUES_SHOWN);
          return (
            <StoreReportCard key={group.option} title={group.option} note={countOf("piece", group.units)}>
              <ul className="space-y-3">
                {values.map((value) => (
                  <li key={value.value}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium text-ink">
                        <bdi>{fmt(t.valueShare, { value: value.value, share: formatShare(value.share) })}</bdi>
                      </span>
                      <span className="shrink-0 text-sm text-ink tabular-nums">{countOf("piece", value.units)}</span>
                    </div>
                    {/* The bar is the share itself: 83% fills 83% of the track. */}
                    <div aria-hidden className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-paper-sunken">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, value.share))}%` }} />
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                      {pluralOf(c, "ordersCount", value.orders)} · {pluralOf(c, "productsCount", value.products)} · <bdi>{money(value.revenue)}</bdi>
                    </p>
                  </li>
                ))}
              </ul>
              {group.values.length > VALUES_SHOWN && !open && (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-3 min-h-11 rounded-full px-4 text-primary"
                  onClick={() => setExpanded((prev) => new Set(prev).add(group.option))}
                >
                  {fmt(c.showAll, { n: group.values.length })}
                </Button>
              )}
            </StoreReportCard>
          );
        };

        const rows: StoreReportOptionValue[] = shown.flatMap((group) => group.values);
        const columns: ReportColumn<StoreReportOptionValue>[] = [
          { key: "value", header: t.colValue, cell: (row) => row.value, sortValue: (row) => row.value },
          ...(picked
            ? []
            : [{ key: "option", header: t.colOption, cell: (row: StoreReportOptionValue) => row.option, sortValue: (row: StoreReportOptionValue) => row.option }]),
          { key: "units", header: c.units, align: "end", cell: (row) => formatCount(row.units), sortValue: (row) => row.units },
          { key: "share", header: t.colShare, align: "end", cell: (row) => formatShare(row.share), sortValue: (row) => row.share },
          { key: "orders", header: c.orders, align: "end", cell: (row) => formatCount(row.orders), sortValue: (row) => row.orders },
          { key: "products", header: t.colProducts, align: "end", cell: (row) => formatCount(row.products), sortValue: (row) => row.products, hideBelow: "md" },
          { key: "revenue", header: c.revenue, align: "end", cell: (row) => money(row.revenue), sortValue: (row) => Number(row.revenue) },
        ];

        return (
          <>
            {data.options.length > 1 && <ChipRow items={chips} value={picked} onChange={pick} label={t.filterLabel} collapseEmpty={false} />}
            <div className={shown.length > 1 ? "grid min-w-0 items-start gap-[var(--bento-gap)] lg:grid-cols-2" : "min-w-0"}>{shown.map(card)}</div>
            <ReportTable
              columns={columns}
              rows={rows}
              rowKey={(row) => `${row.option}:${row.value}`}
              defaultSort={{ key: "units", dir: "desc" }}
              exportName="sales-by-option"
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

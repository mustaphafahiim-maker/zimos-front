import type { ReportsCustomers } from "@store-builder/api-client";
import { ReportTable, type ReportColumn } from "@/components/report";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { cohortLabel, formatRate } from "./helpers";
import { CUSTOMERS_TAB_STRINGS } from "./strings";

type CohortRow = ReportsCustomers["cohorts"][number];

/** The deepest tint a cell takes: ink stays readable on it in both themes. */
const HEAT_MAX = 45;

/**
 * One month of a cohort: the share that ordered again, on a tint of the brand
 * that deepens with the share (the number is always written — the tint only
 * helps the eye find the strong months). A month the cohort has not reached
 * yet is a quiet dot.
 */
function HeatCell({ value, notYet }: { value: number | null | undefined; notYet: string }) {
  if (value === null || value === undefined) {
    return (
      <span className="text-ink-soft">
        <span aria-hidden>·</span>
        <span className="sr-only">{notYet}</span>
      </span>
    );
  }
  return (
    <span
      style={{ backgroundColor: `color-mix(in srgb, var(--color-primary) ${Math.min(HEAT_MAX, 6 + value * 0.9)}%, transparent)` }}
      className="inline-flex min-w-14 justify-center rounded-md px-2 py-1 text-ink"
    >
      <bdi dir="ltr">{formatRate(value)}</bdi>
    </span>
  );
}

/**
 * «العملاء بيرجعوا؟»: the cohort retention grid of the old customers report
 * (pages/analytics/reports/DetailTabs.tsx), as a table inside «تفاصيل أكتر».
 * One row per month of first order — how many customers started that month,
 * then the share of them that ordered again one month later, two months
 * later, and so on (`retention[i]` is month i + 1).
 *
 * It is the store's last months whatever period the hub shows: the API builds
 * the cohorts from every order, not from the picked range — the note says so.
 * Drawn with the kit's table, so it sorts, exports and keeps its first column
 * in place on a phone like the tab's main table.
 */
export function CohortTable({ cohorts }: { cohorts: ReportsCustomers["cohorts"] }) {
  const t = useT(CUSTOMERS_TAB_STRINGS);
  const months = Math.max(0, ...cohorts.map((row) => row.retention.length));

  const columns: ReportColumn<CohortRow>[] = [
    {
      key: "cohort",
      header: t.cohort,
      cell: (row) => cohortLabel(row.cohort),
      // "2026-05" sorts by time as it is written.
      sortValue: (row) => row.cohort,
      csv: (row) => row.cohort,
    },
    {
      key: "size",
      header: t.cohortSize,
      hint: t.cohortSizeHint,
      align: "end",
      cell: (row) => formatCount(row.size),
      sortValue: (row) => row.size,
    },
    ...Array.from(
      { length: months },
      (_, index): ReportColumn<CohortRow> => ({
        key: `month-${index + 1}`,
        header: fmt(t.cohortMonth, { n: index + 1 }),
        hint: fmt(t.cohortMonthHint, { n: index + 1 }),
        align: "end",
        cell: (row) => <HeatCell value={row.retention[index]} notYet={t.cohortNotYet} />,
        // A month not reached yet has no value: it sorts last and is an empty cell in the file.
        sortValue: (row) => row.retention[index] ?? null,
        csv: (row) => row.retention[index] ?? null,
      })
    ),
  ];

  return (
    <ReportTable
      embedded
      columns={columns}
      rows={cohorts}
      rowKey={(row) => row.cohort}
      exportName="zimos-customer-cohorts"
      caption={t.cohorts}
      note={t.cohortsNote}
      empty={t.cohortsEmpty}
    />
  );
}

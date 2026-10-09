import type { ReactNode } from "react";
import type { ReportRange } from "@/lib/reportRange";

/**
 * What the reports hub (pages/reports/ReportsHubPage.tsx) hands to every tab:
 * the store, the ONE range of the hub (`useReportRange`: `from` / `to` are ISO
 * instants with `to` exclusive, `fromDay` / `toDay` the picked days, `compare`
 * what to compare with) and the viewer's role key. The "now" tab ignores the
 * range.
 */
export interface ReportTabProps {
  workspaceId: string;
  range: ReportRange;
  role: string | null | undefined;
}

/** What a column sorts by. Null, undefined, NaN and "" always sort last, whatever the direction. */
export type ReportSortValue = number | string | null | undefined;

/** One column of a `ReportTable`. */
export interface ReportColumn<T> {
  /** Stable key: the React key of the cell and the `key` of a `ReportSort`. */
  key: string;
  /** The column heading, already translated. Also the heading of the CSV column. */
  header: string;
  /** A longer explanation of the figure («من الأوردرات اللي اتطلبت في الفترة»), shown as the heading's tooltip. */
  hint?: string;
  /** What the cell shows. Format numbers for the viewer here (`formatCount`, `formatRate`, money). */
  cell: (row: T) => ReactNode;
  /** Makes the column sortable: the raw value to order by (a number for figures, a string for names). */
  sortValue?: (row: T) => ReportSortValue;
  /**
   * The value written to the CSV. A number is written as plain Latin digits.
   * Left out: `sortValue(row)` is used, and failing that the cell's own text
   * when `cell` returns a string or a number.
   */
  csv?: (row: T) => string | number | null | undefined;
  /** `"end"` for figures: end-aligned, so the digits line up. */
  align?: "start" | "end";
  /** A CSS width for the column (`"8rem"`). Left out, the column takes what its content needs. */
  width?: string;
  /** Hides the column below that breakpoint (it is still exported). */
  hideBelow?: "md" | "lg";
}

/** Which column a table is ordered by, and which way. */
export interface ReportSort {
  key: string;
  dir: "asc" | "desc";
}

/** What a takeaway says: good news, bad news, something to watch, or plain information. */
export type ReportTone = "good" | "bad" | "warn" | "info";

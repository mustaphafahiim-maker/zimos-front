import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Card, cn } from "@store-builder/ui";
import { SkeletonBar } from "@/components/DataState";
import { IconCaretDown, IconCaretUp, IconCaretUpDown, IconDownload } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { isPermissionError } from "@/lib/errors";
import { downloadCsv, type CsvCell } from "./csv";
import type { ReportColumn, ReportSort, ReportSortValue } from "./types";

const STRINGS = {
  en: {
    export: "Export CSV",
    exportFailed: "We couldn't prepare the file. Try again.",
    exportDenied: "Exporting this report isn't part of your role.",
    showAll: "Show all ({n})",
    showLess: "Show less",
    empty: "Nothing to show for this period.",
    loading: "Loading the table…",
    sortable: "Press a column heading to sort by it.",
  },
  ar: {
    export: "تصدير CSV",
    exportFailed: "تعذّر تجهيز الملف. حاول مرة أخرى.",
    exportDenied: "تصدير هذا التقرير ليس ضمن صلاحياتك.",
    showAll: "عرض الكل ({n})",
    showLess: "عرض أقل",
    empty: "لا يوجد ما يُعرض في هذه الفترة.",
    loading: "جارٍ تحميل الجدول…",
    sortable: "اضغط على عنوان أي عمود للترتيب به.",
  },
} satisfies Messages;

export interface ReportTableProps<T> {
  columns: ReadonlyArray<ReportColumn<T>>;
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** The order the table opens in. Left out: the order of `rows`. */
  defaultSort?: ReportSort;
  /** The file name of the export, without ".csv" (`"zimos-governorates"`). */
  exportName: string;
  /** Names the table for screen readers; also the card's visible title unless `title` is given. */
  caption: string;
  /** The card's visible title, when it should differ from the caption. */
  title?: string;
  /** A quiet line under the title: which orders are counted, how a rate is worked out. */
  note?: ReactNode;
  /** On the title line, before the export button: a `Segmented` that switches what the table breaks down by. */
  toolbar?: ReactNode;
  /** The sentence shown in place of the table when there are no rows. */
  empty?: string;
  /** Makes the first cell of a row a link (a customer, a product). Return null for a row with nowhere to go. */
  rowTo?: (row: T) => string | null | undefined;
  /** Rows shown before «اعرض الكل». Default 10. */
  pageSize?: number;
  /** Draws skeleton rows in place of the body. */
  loading?: boolean;
  /**
   * A server export in place of the one built in the browser. A promise keeps
   * the button busy until it settles; if it rejects, the table says the file
   * could not be prepared (or that the role may not export it, on a 403).
   */
  onExport?: () => void | Promise<void>;
  /** Adds the picked days to the file name: `<exportName>-<fromDay>-<toDay>.csv`. Pass the tab's `range`. */
  range?: { fromDay: string; toDay: string };
  /**
   * For a secondary table inside an `AccordionSection` (pass that section `flush`): no card of its
   * own, and the title is kept for screen readers only — the section already says it.
   */
  embedded?: boolean;
  className?: string;
}

// The head's tint as a solid colour, so the cell that stays put while the table scrolls matches the rest of the head.
const HEAD_FILL = "bg-[color-mix(in_srgb,var(--color-paper-sunken)_60%,var(--color-paper-raised))]";
const TH = `border-b border-line px-3 py-3 text-xs leading-4 font-medium whitespace-nowrap first:ps-4 last:pe-4 ${HEAD_FILL}`;
const TD = "border-b border-line px-3 py-3 whitespace-nowrap text-ink tabular-nums first:ps-4 last:pe-4";
/**
 * The first column stays at the start edge while the rest scrolls sideways. A
 * hairline at its end shows once the table has been scrolled (data-scrolled on
 * the scrolling box). glass/reports.css gives the cell its fill on glass.
 */
const STICKY =
  "zimos-report-sticky sticky start-0 z-[1] after:pointer-events-none after:absolute after:inset-y-0 after:end-0 after:w-px after:bg-line-strong after:opacity-0 after:transition-opacity after:duration-[var(--dur-fade)] after:ease-[var(--ease-out)] after:content-[''] motion-reduce:after:transition-none [[data-scrolled]_&]:after:opacity-100";
/** Solid only while there is something to scroll under it; the second fill is the row under the pointer. */
const STICKY_BODY =
  "[[data-overflow]_&]:bg-paper-raised [[data-overflow]_&]:group-hover/row:bg-[color-mix(in_srgb,var(--color-paper-sunken)_70%,var(--color-paper-raised))]";
const HIDE = { md: "max-md:hidden", lg: "max-lg:hidden" } as const;
/** The first column is one line, cut with an ellipsis: narrow on a phone, so the figures keep their room. */
const FIRST_WIDTH = "max-w-[9.5rem] sm:max-w-[16rem] lg:max-w-[22rem]";
// Skeleton cells: the widths rotate so no two rows match.
const BONE_WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-2/5", "w-5/6"] as const;

function isBlank(value: ReportSortValue): boolean {
  return value === null || value === undefined || value === "" || (typeof value === "number" && Number.isNaN(value));
}

/** Rows in the chosen order. Blank values go last either way; equal values keep the order they came in. */
function sortRows<T>(rows: readonly T[], column: ReportColumn<T> | undefined, dir: ReportSort["dir"], locale: string): T[] {
  const pick = column?.sortValue;
  if (!pick) return [...rows];
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  const keyed = rows.map((row, index) => ({ row, index, value: pick(row) }));
  keyed.sort((a, b) => {
    const aBlank = isBlank(a.value);
    const bBlank = isBlank(b.value);
    if (aBlank || bBlank) return aBlank === bBlank ? a.index - b.index : aBlank ? 1 : -1;
    const order =
      typeof a.value === "number" && typeof b.value === "number"
        ? a.value - b.value
        : collator.compare(String(a.value), String(b.value));
    if (!order) return a.index - b.index;
    return dir === "asc" ? order : -order;
  });
  return keyed.map((entry) => entry.row);
}

/** A first press sorts figures from the largest and names from the start of the alphabet. */
function firstDirection<T>(column: ReportColumn<T>, rows: readonly T[]): ReportSort["dir"] {
  for (const row of rows) {
    const value = column.sortValue?.(row);
    if (!isBlank(value)) return typeof value === "string" ? "asc" : "desc";
  }
  return "desc";
}

function csvValue<T>(column: ReportColumn<T>, row: T): CsvCell {
  if (column.csv) return column.csv(row);
  if (column.sortValue) return column.sortValue(row);
  const shown = column.cell(row);
  return typeof shown === "string" || typeof shown === "number" ? shown : "";
}

/**
 * The tab's ONE breakdown table, in a card.
 *
 * - **Sortable**: a column with `sortValue` has a button for a heading. A press
 *   sorts by it, the next press turns the order round; the `th` carries
 *   `aria-sort`, a caret shows the direction and the heading goes to full ink.
 * - **Exportable**: «صدّر CSV» on the title line writes ALL rows (not only the
 *   ones shown), in the order on screen, every column included — also those
 *   hidden on a small screen — through `downloadCsv`; or calls `onExport`.
 * - **Folds**: rows past `pageSize` wait behind «اعرض الكل (n)».
 * - **Reads on a phone**: the table scrolls sideways inside the card and its
 *   first column stays put; figures are tabular and end-aligned.
 *
 * The sort is kept while the rows change. To start again from `defaultSort`
 * (after a switch that changes what the rows are), give the table a `key`.
 */
export function ReportTable<T>({
  columns,
  rows,
  rowKey,
  defaultSort,
  exportName,
  caption,
  title,
  note,
  toolbar,
  empty,
  rowTo,
  pageSize = 10,
  loading = false,
  onExport,
  range,
  embedded = false,
  className,
}: ReportTableProps<T>) {
  const t = useT(STRINGS);
  const toast = useToast();
  const { intlLocale } = useLocale();
  const titleId = useId();
  const tableId = useId();
  const [sort, setSort] = useState<ReportSort | null>(defaultSort ?? null);
  const [expanded, setExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const footRef = useRef<HTMLDivElement>(null);

  // Whether the table is wider than its card, and whether it has been scrolled: the first
  // column only needs a fill of its own, and its edge line, when something passes beneath it.
  useEffect(() => {
    if (!scroller) return;
    const measure = () => {
      setOverflowing(scroller.scrollWidth > scroller.clientWidth + 1);
      // Negative in a right-to-left page.
      setScrolled(Math.abs(scroller.scrollLeft) > 1);
    };
    measure();
    scroller.addEventListener("scroll", measure, { passive: true });
    if (typeof ResizeObserver === "undefined") {
      return () => scroller.removeEventListener("scroll", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    return () => {
      scroller.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [scroller]);

  const sortColumn = sort ? columns.find((column) => column.key === sort.key && column.sortValue) : undefined;
  const direction = sort?.dir ?? "desc";
  const sorted = useMemo(() => sortRows(rows, sortColumn, direction, intlLocale), [rows, sortColumn, direction, intlLocale]);

  const perPage = Math.max(1, Math.floor(pageSize));
  const folds = sorted.length > perPage;
  const shown = folds && !expanded ? sorted.slice(0, perPage) : sorted;
  const isEmpty = !loading && rows.length === 0;
  const hasSortable = columns.some((column) => column.sortValue);
  const canExport = !loading && !exporting && rows.length > 0;
  const fileName = range ? `${exportName}-${range.fromDay}-${range.toDay}.csv` : `${exportName}.csv`;

  function toggleSort(column: ReportColumn<T>) {
    setSort((previous) =>
      previous && previous.key === column.key
        ? { key: column.key, dir: previous.dir === "desc" ? "asc" : "desc" }
        : { key: column.key, dir: firstDirection(column, rows) }
    );
  }

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    // Folding a long table takes the page out from under the reader: bring the end of the table back.
    if (!next) window.requestAnimationFrame(() => footRef.current?.scrollIntoView({ block: "nearest" }));
  }

  async function exportNow() {
    if (onExport) {
      setExporting(true);
      try {
        await onExport();
      } catch (error) {
        toast.error(isPermissionError(error) ? t.exportDenied : t.exportFailed);
      } finally {
        setExporting(false);
      }
      return;
    }
    downloadCsv(
      fileName,
      columns.map((column) => column.header),
      sorted.map((row) => columns.map((column) => csvValue(column, row)))
    );
  }

  const body = (
    <>
      <div className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h3 id={titleId} className={embedded ? "sr-only" : "text-[15px] leading-6 font-semibold text-ink"}>
            {title ?? caption}
          </h3>
          {note && <p className="mt-0.5 text-[13px] leading-5 text-pretty text-ink-soft">{note}</p>}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {toolbar}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void exportNow()}
            disabled={!canExport}
            aria-busy={exporting || undefined}
            className="h-10 rounded-full px-3.5 pointer-coarse:h-11"
          >
            <IconDownload className="size-4" aria-hidden />
            {t.export}
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <p data-slot="report-table-empty" className="px-4 pt-4 pb-10 text-center text-sm leading-6 text-pretty text-ink-soft">
          {empty ?? t.empty}
        </p>
      ) : (
        <>
          {loading && (
            <span role="status" className="sr-only">
              {t.loading}
            </span>
          )}
          <div
            ref={setScroller}
            data-slot="report-table-scroll"
            data-overflow={overflowing ? "" : undefined}
            data-scrolled={scrolled ? "" : undefined}
            // A box that scrolls must be reachable from the keyboard — only while it does scroll.
            role={overflowing ? "region" : undefined}
            aria-labelledby={overflowing ? titleId : undefined}
            tabIndex={overflowing ? 0 : undefined}
            className="overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            <table id={tableId} aria-busy={loading || undefined} className="w-full border-separate border-spacing-0 text-sm">
              <caption className="sr-only">
                {caption}
                {hasSortable && <span> {t.sortable}</span>}
              </caption>
              <thead>
                <tr>
                  {columns.map((column, index) => {
                    const active = sortColumn?.key === column.key;
                    const end = column.align === "end";
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={column.sortValue ? (active ? (direction === "asc" ? "ascending" : "descending") : "none") : undefined}
                        data-sorted={active ? "" : undefined}
                        style={column.width ? { width: column.width, minWidth: column.width } : undefined}
                        className={cn(
                          TH,
                          end ? "text-end" : "text-start",
                          // The heading of the sorted column in full ink.
                          active ? "text-ink" : "text-ink-soft",
                          index === 0 && STICKY,
                          column.hideBelow && HIDE[column.hideBelow]
                        )}
                      >
                        {column.sortValue ? (
                          <button
                            type="button"
                            title={column.hint}
                            onClick={() => toggleSort(column)}
                            className={cn(
                              "relative inline-flex cursor-pointer items-center gap-1 rounded-sm font-medium select-none hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
                              // The whole heading cell is the target, 44px tall.
                              "before:absolute before:-inset-x-3 before:-inset-y-3.5 before:content-['']",
                              // The caret goes on the inner side of a figure column, so the heading stays in line with its digits.
                              end && "flex-row-reverse"
                            )}
                          >
                            <span>{column.header}</span>
                            {active ? (
                              direction === "asc" ? (
                                <IconCaretUp className="size-3 shrink-0 text-primary" aria-hidden />
                              ) : (
                                <IconCaretDown className="size-3 shrink-0 text-primary" aria-hidden />
                              )
                            ) : (
                              <IconCaretUpDown className="size-3 shrink-0 opacity-60" aria-hidden />
                            )}
                          </button>
                        ) : (
                          <span title={column.hint}>{column.header}</span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              {/* No line under the last row: the card ends there. */}
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {loading
                  ? Array.from({ length: Math.min(perPage, 5) }, (_, r) => (
                      <tr key={r} aria-hidden className="group/row">
                        {columns.map((column, c) => (
                          <td
                            key={column.key}
                            className={cn(TD, c === 0 && STICKY, c === 0 && STICKY_BODY, column.hideBelow && HIDE[column.hideBelow])}
                          >
                            {/* A 12px bar with 4px above and below: the 20px line of a real cell. */}
                            <SkeletonBar
                              className={cn("my-1", BONE_WIDTHS[(r + c) % BONE_WIDTHS.length], column.align === "end" && "ms-auto")}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  : shown.map((row) => {
                      const to = rowTo?.(row);
                      return (
                        <tr key={rowKey(row)} className="group/row">
                          {columns.map((column, c) => {
                            const content = column.cell(row);
                            const hidden = column.hideBelow && HIDE[column.hideBelow];
                            if (c > 0) {
                              const figure = column.align === "end" && (typeof content === "string" || typeof content === "number");
                              return (
                                <td key={column.key} className={cn(TD, column.align === "end" && "text-end", hidden)}>
                                  {/* <bdi>: a figure, its sign and its currency keep their own order inside an Arabic row. */}
                                  {figure ? <bdi>{content}</bdi> : content}
                                </td>
                              );
                            }
                            const plain = typeof content === "string" ? content : undefined;
                            return (
                              <td key={column.key} className={cn(TD, STICKY, STICKY_BODY, column.align === "end" && "text-end", hidden)}>
                                {to ? (
                                  // The padding is the link's own, so the target is 44px tall without making the row taller.
                                  <ViewLink
                                    to={to}
                                    title={plain}
                                    className={cn(
                                      "-my-3 block truncate rounded-md py-3 font-medium text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary",
                                      FIRST_WIDTH
                                    )}
                                  >
                                    {content}
                                  </ViewLink>
                                ) : (
                                  <div title={plain} className={cn("truncate font-medium", FIRST_WIDTH)}>
                                    {content}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {!loading && folds && (
            <div ref={footRef} data-slot="report-table-foot" className="flex scroll-mb-24 justify-center border-t border-line px-4 py-1.5">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={tableId}
                onClick={toggleExpanded}
                className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-primary transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                {expanded ? t.showLess : fmt(t.showAll, { n: sorted.length })}
                <IconCaretDown
                  className={cn(
                    "size-3.5 shrink-0 transition-transform duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                    expanded && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
            </div>
          )}
        </>
      )}
    </>
  );

  return embedded ? (
    <div data-report-table="" className={cn("min-w-0", className)}>
      {body}
    </div>
  ) : (
    <Card data-report-table="" className={cn("min-w-0 gap-0 p-0", className)}>
      {body}
    </Card>
  );
}

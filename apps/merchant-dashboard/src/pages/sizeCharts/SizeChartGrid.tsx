import { Fragment } from "react";
import { IconDelete, IconPlus } from "@/components/icons";
import { Button, Input, cn } from "@store-builder/ui";
import { SIZE_CHART_LIMITS } from "@store-builder/api-client";
import { fmt, useT } from "@/i18n/LocaleContext";
import { SIZE_CHART_STRINGS } from "./sizeChartStrings";

/** A column's two headings as the form holds them (both strings, either may be empty). */
export interface GridColumn {
  ar: string;
  en: string;
}

const removeButton =
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius)] text-ink-soft hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-soft";

/**
 * The chart as a grid of text boxes: a heading in Arabic and in English over
 * every column, one row per size, and the buttons that add or remove a row or
 * a column (1–12 columns, 1–40 rows). On a narrow screen the grid scrolls
 * sideways inside its card.
 *
 * A CSS grid, not a <table>: the dashboard's table styles are for lists that
 * are read (tall rows, a tint under the pointer), not for boxes that are typed
 * in. Every box carries its own name ("Row 2, column 3") instead.
 */
export function SizeChartGrid({
  columns,
  rows,
  onChange,
  headingError,
  disabled,
}: {
  columns: GridColumn[];
  rows: string[][];
  onChange: (next: { columns: GridColumn[]; rows: string[][] }) => void;
  /** Shown under the grid, and marks the columns with no heading. */
  headingError?: string | null;
  disabled?: boolean;
}) {
  const t = useT(SIZE_CHART_STRINGS);
  const canAddColumn = columns.length < SIZE_CHART_LIMITS.columns;
  const canAddRow = rows.length < SIZE_CHART_LIMITS.rows;

  const setHeading = (index: number, lang: "ar" | "en", value: string) =>
    onChange({ columns: columns.map((c, i) => (i === index ? { ...c, [lang]: value } : c)), rows });
  const setCell = (r: number, c: number, value: string) =>
    onChange({ columns, rows: rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row)) });
  const addColumn = () => onChange({ columns: [...columns, { ar: "", en: "" }], rows: rows.map((row) => [...row, ""]) });
  const removeColumn = (index: number) =>
    onChange({ columns: columns.filter((_, i) => i !== index), rows: rows.map((row) => row.filter((_, i) => i !== index)) });
  const addRow = () => onChange({ columns, rows: [...rows, columns.map(() => "")] });
  const removeRow = (index: number) => onChange({ columns, rows: rows.filter((_, i) => i !== index) });

  return (
    <div>
      {/* The padding keeps the boxes' focus rings inside the scrolling area. */}
      <div className="-mx-1 overflow-x-auto px-1 py-1">
        <div
          className="grid items-center gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${columns.length}, minmax(7.5rem, 1fr)) 2.75rem`,
            minWidth: `${columns.length * 7.5 + 2.75 + (columns.length * 0.375)}rem`,
          }}
        >
          {columns.map((column, index) => {
            const missing = Boolean(headingError) && !column.ar.trim() && !column.en.trim();
            return (
              <div key={index} className="space-y-1.5 self-stretch rounded-[var(--radius)] bg-paper-sunken p-1.5">
                <Input
                  dir="rtl"
                  lang="ar"
                  value={column.ar}
                  maxLength={SIZE_CHART_LIMITS.heading}
                  disabled={disabled}
                  placeholder={t.arPlaceholder}
                  aria-label={fmt(t.headingAr, { n: index + 1 })}
                  aria-invalid={missing || undefined}
                  onChange={(e) => setHeading(index, "ar", e.target.value)}
                  className="h-10 bg-paper-raised font-semibold"
                />
                <Input
                  dir="ltr"
                  lang="en"
                  value={column.en}
                  maxLength={SIZE_CHART_LIMITS.heading}
                  disabled={disabled}
                  placeholder={t.enPlaceholder}
                  aria-label={fmt(t.headingEn, { n: index + 1 })}
                  aria-invalid={missing || undefined}
                  onChange={(e) => setHeading(index, "en", e.target.value)}
                  className="h-10 bg-paper-raised font-semibold"
                />
                <button
                  type="button"
                  disabled={disabled || columns.length <= 1}
                  onClick={() => removeColumn(index)}
                  aria-label={fmt(t.removeColumn, { n: index + 1 })}
                  title={fmt(t.removeColumn, { n: index + 1 })}
                  className={cn(removeButton, "h-11 w-full md:h-9")}
                >
                  <IconDelete className="size-4" aria-hidden />
                </button>
              </div>
            );
          })}
          <span aria-hidden />

          {rows.map((row, r) => (
            <Fragment key={r}>
              {row.map((cell, c) => (
                <Input
                  key={c}
                  dir="auto"
                  value={cell}
                  maxLength={SIZE_CHART_LIMITS.cell}
                  disabled={disabled}
                  aria-label={fmt(t.cell, { row: r + 1, column: c + 1 })}
                  onChange={(e) => setCell(r, c, e.target.value)}
                  className={cn("h-11", c === 0 && "font-semibold")}
                />
              ))}
              <button
                type="button"
                disabled={disabled || rows.length <= 1}
                onClick={() => removeRow(r)}
                aria-label={fmt(t.removeRow, { n: r + 1 })}
                title={fmt(t.removeRow, { n: r + 1 })}
                className={cn(removeButton, "size-11")}
              >
                <IconDelete className="size-4" aria-hidden />
              </button>
            </Fragment>
          ))}
        </div>
      </div>

      {headingError && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {headingError}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={disabled || !canAddRow} onClick={addRow}>
          <IconPlus className="size-4" aria-hidden />
          {t.addRow}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={disabled || !canAddColumn} onClick={addColumn}>
          <IconPlus className="size-4" aria-hidden />
          {t.addColumn}
        </Button>
        {(!canAddRow || !canAddColumn) && (
          <p className="text-xs text-ink-soft">
            {!canAddRow ? fmt(t.maxRows, { max: SIZE_CHART_LIMITS.rows }) : fmt(t.maxColumns, { max: SIZE_CHART_LIMITS.columns })}
          </p>
        )}
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";

export interface Column<T> {
  /** Stable key; also the React key for the cell. */
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** Right-aligns in LTR, left in RTL — for money and counts. */
  align?: "start" | "end";
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: ReadonlyArray<Column<T>>;
  rows: readonly T[];
  rowKey: (row: T, index: number) => string;
  /** Makes the whole row clickable; cells that stop propagation still work. */
  onRowClick?: (row: T) => void;
  /** Minimum width before the table scrolls horizontally, e.g. "48rem". */
  minWidth?: string;
  className?: string;
  /** Rendered instead of the table body when there are no rows. */
  empty?: ReactNode;
  footer?: ReactNode;
}

/**
 * The dashboard's one table. Pages describe their columns and rows; the
 * header style, row separators, hover and horizontal scrolling live here so
 * every list looks the same and only has to be fixed once.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  minWidth = "48rem",
  className,
  empty,
  footer,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-line text-xs text-ink-soft">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-3 py-2.5 font-medium",
                    col.align === "end" ? "text-end" : "text-start",
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-line last:border-0",
                  onRowClick && "cursor-pointer hover:bg-paper"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-3 py-2.5", col.align === "end" && "text-end", col.className)}
                  >
                    {col.cell(row, i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}

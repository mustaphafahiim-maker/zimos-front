import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import type { QuickLookRowProps } from "@/components/QuickLook";

export interface DeskHeadCell {
  label: string;
  /** Sits at the end of its column: money, the actions. */
  end?: boolean;
}

export interface DeskListProps {
  /**
   * The columns, as ONE Tailwind class written out in full
   * (`grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_max-content_max-content_max-content]`).
   * The head and every row are subgrids of it, so a column that sizes to its
   * content (a status chip, the actions) is as wide as its widest row and
   * still lines up down the sheet.
   */
  columns: string;
  head: ReadonlyArray<DeskHeadCell>;
  /** Names the list for screen readers. */
  label: string;
  children: ReactNode;
}

/**
 * The lists of Returns and Protection from a wide screen up (./useScreen.ts):
 * one sheet, a quiet head and a line per row — the desktop face of what is a
 * `ListRowCard` on the phone. A list (ul / li), not a table: a row is one
 * target with its own controls laid over it, which a table row cannot be.
 *
 * The sheet is the pane `ListSkeleton` holds room with (`zimos-list-sheet`,
 * glass/list.css); the head, the hairlines and a row under the pointer get
 * their material in glass/returns-protection.css.
 */
export function DeskList({ columns, head, label, children }: DeskListProps) {
  return (
    <div
      data-slot="queue-sheet"
      className={cn(
        "zimos-list-sheet grid gap-x-4 overflow-hidden rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line",
        columns
      )}
    >
      {/* What a sighted reader scans down; each cell under it names itself, so the head is decoration to a screen reader. */}
      <div
        aria-hidden
        data-slot="queue-head"
        className="col-span-full grid h-10 grid-cols-subgrid items-center border-b border-line bg-paper-sunken/60 px-4 text-xs font-medium text-ink-soft"
      >
        {head.map((cell, index) => (
          <span key={index} className={cn("min-w-0 truncate", cell.end && "text-end")}>
            {cell.label}
          </span>
        ))}
      </div>
      <ul aria-label={label} className="col-span-full grid grid-cols-subgrid">
        {children}
      </ul>
    </div>
  );
}

export interface DeskRowProps {
  /** A press anywhere on the row that is not one of its own controls: open Quick Look. Left out, the row is only a row. */
  onOpen?: () => void;
  /** What that press does, for a screen reader: «معاينة مرتجع أحمد». */
  openLabel?: string;
  /** `rowKeyProps(...)`: Space peeks, Enter opens the row's page. */
  keyProps?: QuickLookRowProps;
  /** The row whose preview is open. */
  current?: boolean;
  menu?: ReadonlyArray<ContextMenuItem>;
  menuLabel?: string;
  className?: string;
  /** One element per column, in the order of the head. */
  children: ReactNode;
}

/**
 * One line of the sheet, at least 60px tall. The row's button is laid over the
 * whole line; links and buttons inside the cells are lifted above it and stay
 * their own Tab stops. Right-click, a long press or Shift+F10 gives `menu`.
 */
export function DeskRow({ onOpen, openLabel, keyProps, current = false, menu, menuLabel, className, children }: DeskRowProps) {
  return (
    <ContextMenu items={menu ?? []} label={menuLabel}>
      <li
        data-slot="queue-row"
        data-current={current ? "" : undefined}
        data-pressable={onOpen ? "" : undefined}
        className={cn(
          "relative col-span-full grid min-h-[3.75rem] grid-cols-subgrid items-center border-b border-line px-4 py-2 text-sm text-ink last:border-b-0",
          "transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
          onOpen && "hover:bg-paper-sunken/60 has-[[data-row-open]:focus-visible]:bg-paper-sunken/60",
          current && "bg-primary-soft/50",
          "[&_a]:relative [&_a]:z-10 [&_button]:relative [&_button]:z-10",
          className
        )}
      >
        {onOpen && (
          <div
            role="button"
            aria-haspopup="dialog"
            aria-label={openLabel}
            data-row-open=""
            {...keyProps}
            tabIndex={0}
            onClick={onOpen}
            className="absolute inset-0 cursor-pointer outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          />
        )}
        {children}
      </li>
    </ContextMenu>
  );
}

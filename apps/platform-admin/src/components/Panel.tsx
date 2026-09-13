import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Alert, TableCell, TableHead, cn } from "@store-builder/ui";
import type { WorkspaceListResult } from "@/mock/types";

/** Bordered surface with an optional header. Used instead of Card where padding must be controlled. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  flush = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** No body padding (tables, lists). */
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised shadow-[var(--shadow-card)]",
        className
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-soft">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && "px-5 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export type SortDir = "asc" | "desc";
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <TableHead className={cn("h-10 bg-paper/60 px-4 text-start text-xs font-medium tracking-wide text-ink-soft uppercase", className)}>
      {children}
    </TableHead>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <TableCell colSpan={colSpan} className={cn("px-4 py-3 text-ink", className)}>
      {children}
    </TableCell>
  );
}

export function SortHead<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (next: SortState<K>) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("h-10 bg-paper/60 px-4 text-start", className)}
    >
      <button
        type="button"
        onClick={() => onSort({ key: sortKey, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 text-xs font-medium tracking-wide uppercase hover:text-ink",
          active ? "text-ink" : "text-ink-soft"
        )}
      >
        {label}
        <Icon className="size-3" aria-hidden />
      </button>
    </TableHead>
  );
}

export function compareValues(a: string | number, b: string | number, dir: SortDir): number {
  const r = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
  return dir === "asc" ? r : -r;
}

/** Shown when the real workspaces endpoint failed and demo rows are displayed. */
export function SourceNotice({ result }: { result: Pick<WorkspaceListResult, "source" | "apiError"> }) {
  if (result.source === "api") return null;
  return (
    <Alert variant="warning" className="mb-4">
      Couldn't load GET /admin/workspaces ({result.apiError ?? "unknown error"}). Showing demo workspaces so the console
      stays usable — changes are stored locally.
    </Alert>
  );
}

export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre
      className={cn(
        "scroll-thin max-h-80 overflow-auto rounded-[10px] border border-line bg-paper p-3 font-mono text-xs leading-relaxed text-ink",
        className
      )}
    >
      {value === null || value === undefined ? "null" : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={cn("rounded bg-primary-soft px-1.5 py-0.5 font-mono text-xs text-ink", className)}>{children}</code>;
}

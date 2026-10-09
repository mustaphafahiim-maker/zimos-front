import { cn } from "@store-builder/ui";
import { IconClose } from "@/components/icons";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { label: "Filters in effect", remove: "Remove the filter: {filter}", clearAll: "Clear all" },
  ar: { label: "الفلاتر الشغّالة", remove: "شيل الفلتر: {filter}", clearAll: "امسح الكل" },
} satisfies Messages;

export interface ActiveFilter {
  id: string;
  /** What is being filtered on, in words: «من العميل», «محظور من: الأوردر». */
  label: string;
  onRemove: () => void;
}

const PRESS =
  "cursor-pointer select-none transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";

/**
 * The filters in effect, under the toolbar: one chip each — a press takes that
 * filter off — and «امسح الكل» at the end. Draws nothing while no filter is
 * set, so the list keeps its place right under the chips.
 *
 * A chip is the small pane of the list kit (`zimos-chip`, glass/list.css).
 */
export function ActiveFilters({ filters, onClearAll, className }: { filters: ReadonlyArray<ActiveFilter>; onClearAll: () => void; className?: string }) {
  const t = useT(STRINGS);
  if (filters.length === 0) return null;
  return (
    <div role="group" aria-label={t.label} data-slot="active-filters" className={cn("flex flex-wrap items-center gap-2", className)}>
      {filters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={filter.onRemove}
          aria-label={fmt(t.remove, { filter: filter.label })}
          className={cn(
            "zimos-chip inline-flex h-9 max-w-full items-center gap-1.5 rounded-full bg-paper-raised ps-3.5 pe-2.5 text-[13px] font-medium text-ink ring-1 ring-line hover:bg-paper-sunken pointer-coarse:h-11",
            PRESS
          )}
        >
          <span className="min-w-0 truncate">{filter.label}</span>
          <IconClose className="size-3.5 shrink-0 text-ink-soft" weight="bold" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        data-slot="active-filters-clear"
        className={cn("inline-flex h-9 items-center rounded-full px-3 text-[13px] font-semibold text-primary hover:bg-primary-soft pointer-coarse:h-11", PRESS)}
      >
        {t.clearAll}
      </button>
    </div>
  );
}

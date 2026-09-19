import { cn } from "@store-builder/ui";

export interface FilterTab<T extends string> {
  value: T;
  label: string;
}

interface FilterTabsProps<T extends string> {
  tabs: ReadonlyArray<FilterTab<T>>;
  value: T;
  /** NoInfer keeps T pinned to `tabs`/`value`, so a plain setState may be
   * passed here without widening T to `string`. */
  onChange: (value: NoInfer<T>) => void;
  /** Names the filter for screen readers, e.g. "Filter reviews by status". */
  label: string;
  className?: string;
}

/**
 * Segmented single-choice filter — the pill row used above moderation lists.
 * Toggle buttons rather than tabs: nothing is tabbed between, the choice just
 * re-queries the list below.
 */
export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: FilterTabsProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-[0.5rem] border border-line bg-paper-raised p-1",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          aria-pressed={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "cursor-pointer rounded-[0.375rem] px-3 py-1.5 text-sm font-medium transition-colors",
            value === tab.value
              ? "bg-primary-soft text-primary-dark dark:text-primary"
              : "text-ink-soft hover:text-ink"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

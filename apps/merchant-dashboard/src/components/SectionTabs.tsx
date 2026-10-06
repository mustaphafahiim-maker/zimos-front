import { useEffect, useRef, type KeyboardEvent } from "react";
import { cn } from "@store-builder/ui";
import type { FilterTab } from "@/components/FilterTabs";

interface SectionTabsProps<T extends string> {
  tabs: ReadonlyArray<FilterTab<T>>;
  value: T;
  onChange: (value: NoInfer<T>) => void;
  /** Names the set of sections for screen readers, e.g. "Settings sections". */
  label: string;
  className?: string;
}

/**
 * The sections of one page (Settings, Store settings, Shipping) as real tabs:
 * `role="tablist"`, one tab in the Tab order, ← → Home End to move between
 * them. On a phone they stay on one row that scrolls sideways, with the
 * current one scrolled into view, instead of wrapping into 2–4 rows before
 * any content (re-audit N-17). Every tab is 44 px tall.
 *
 * FilterTabs stays for filters that re-query a list (toggle buttons).
 */
export function SectionTabs<T extends string>({ tabs, value, onChange, label, className }: SectionTabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the current section visible in the scrolling row (deep links land on a later tab).
  useEffect(() => {
    const current = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [value]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.value === value);
    if (index < 0) return;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key as "ArrowRight" | "ArrowLeft"];
    let next: number | null = null;
    if (step !== undefined) next = (index + step + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].value);
    // By position: the page may re-render the selection a moment later.
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cn(
              "inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              selected
                ? "bg-primary-soft font-semibold text-primary-dark dark:text-primary"
                : "text-ink-soft ring-1 ring-line ring-inset hover:bg-paper-sunken hover:text-ink"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

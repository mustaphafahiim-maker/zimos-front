import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { IconClose, IconFilter, IconSearch } from "@/components/icons";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { pluralOf } from "@/lib/plural";

const STRINGS = {
  en: {
    filters: "Filters",
    clearSearch: "Clear search",
    filtersOn: "{label}, {count}",
    on_one: "1 filter on",
    on_other: "{n} filters on",
  },
  ar: {
    filters: "الفلاتر",
    clearSearch: "مسح البحث",
    filtersOn: "{label}، {count}",
    on_one: "فلتر واحد مفعّل",
    on_two: "فلتران مفعّلان",
    on_few: "{n} فلاتر مفعّلة",
    on_other: "{n} فلترًا مفعّلًا",
  },
} satisfies Messages;

export interface ListToolbarProps {
  search?: { value: string; onChange: (value: string) => void; placeholder: string; label: string; hint?: string };
  /** The one Filters button: opens the page's FilterSheet. `count` = filters in effect. */
  filters?: { count: number; onOpen: () => void; label?: string };
  /** Controls at the end of the row: a view switch, a sort select, a refresh button. */
  children?: ReactNode;
  className?: string;
}

function shown(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== "";
}

/**
 * The row over every list: a search pill that takes the free width, the one
 * Filters button, then whatever the page adds (a view switch, a sort, a
 * refresh) — all 44px tall.
 *
 * On a narrow screen the search keeps the first line; Filters and the page's
 * controls move to a second line together, and only when they do not fit
 * beside it (Filters alone always does).
 *
 * The field is controlled and never waits: every keystroke goes straight to
 * `search.onChange`. Debounce the request, not the typing. Escape empties it.
 *
 * Material (the two small panes, the brand badge) is in glass/list.css;
 * without the glass layer they are solid raised pills with a hairline.
 */
export function ListToolbar({ search, filters, children, className }: ListToolbarProps) {
  const t = useT(STRINGS);
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const hasText = search !== undefined && search.value !== "";
  const filterCount = filters ? Math.max(0, filters.count) : 0;
  const filtersLabel = filters?.label ?? t.filters;

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
    if (!search || search.value === "") return;
    // Escape empties the field first; with nothing in it the key belongs to the sheet or the page around.
    event.preventDefault();
    event.stopPropagation();
    search.onChange("");
  }

  return (
    <div data-slot="list-toolbar" className={cn("flex flex-wrap items-start gap-2", className)}>
      {search && (
        // 12rem is the least the field is worth: below that the controls after it take their own line.
        <div className="min-w-0 flex-[1_1_12rem]">
          {/* A label, so a press anywhere on the pill — the glyph, the padding — lands in the field. */}
          <label
            data-slot="list-search"
            className={cn(
              "zimos-list-search flex h-11 cursor-text items-center rounded-full bg-paper-raised text-ink ring-1 ring-line",
              "transition-[background-color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
              "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-primary"
            )}
          >
            <IconSearch className="ms-4 size-4 shrink-0 text-ink-soft" aria-hidden />
            <input
              ref={inputRef}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={search.placeholder}
              aria-label={search.label}
              aria-describedby={search.hint ? hintId : undefined}
              className={cn(
                // The native clear cross is hidden: the round button after the field is the one way to clear.
                "h-full min-w-0 flex-1 appearance-none bg-transparent ps-2.5 text-sm text-ink outline-none placeholder:text-ink-soft pointer-coarse:text-base [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
                hasText ? "pe-1" : "pe-4"
              )}
            />
            {hasText && (
              <button
                type="button"
                aria-label={t.clearSearch}
                title={t.clearSearch}
                onClick={() => {
                  search.onChange("");
                  inputRef.current?.focus();
                }}
                // 36px to the eye, 44px to the thumb: the ring of air around it is part of the target.
                className="relative me-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] before:absolute before:-inset-1 hover:bg-ink/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <IconClose className="size-4" aria-hidden />
              </button>
            )}
          </label>
          {search.hint && (
            <p id={hintId} data-slot="list-search-hint" className="mt-1.5 px-4 text-xs leading-4 text-ink-soft">
              {search.hint}
            </p>
          )}
        </div>
      )}

      {(filters || shown(children)) && (
        // One item for the wrap: Filters and the controls of the page stay together, beside the search or under it.
        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
          {filters && (
            <button
              type="button"
              onClick={filters.onOpen}
              aria-haspopup="dialog"
              // With filters in effect the name says how many, in words; otherwise the label is the name.
              aria-label={
                filterCount > 0 ? fmt(t.filtersOn, { label: filtersLabel, count: pluralOf(t, "on", filterCount) }) : undefined
              }
              data-slot="list-filters"
              data-active={filterCount > 0 ? "" : undefined}
              className={cn(
                "zimos-list-filters inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-paper-raised ps-4 text-sm font-medium whitespace-nowrap text-ink ring-1 ring-line select-none",
                "transition-[scale,background-color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                "hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100",
                filterCount > 0 ? "pe-2.5" : "pe-4"
              )}
            >
              <IconFilter className="size-4 shrink-0" aria-hidden />
              <span>{filtersLabel}</span>
              {filterCount > 0 && (
                // Keyed by the number, so the badge pops again each time it changes.
                <span
                  key={filterCount}
                  aria-hidden
                  className="zimos-list-badge inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs leading-none font-semibold text-primary-foreground tabular-nums motion-safe:animate-[list-badge-pop_var(--dur-pop)_var(--ease-pop)_both]"
                >
                  {fmt("{n}", { n: filterCount })}
                </span>
              )}
            </button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

import { useId, useMemo, useState } from "react";
import { IconSearch } from "@/components/icons";
import { Input } from "@store-builder/ui";
import { SkeletonBar } from "@/components/DataState";
import { useErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { useT } from "@/i18n/LocaleContext";
import { SIZE_CHART_STRINGS } from "./sizeChartStrings";

export interface AttachItem {
  id: string;
  name: string;
}

/**
 * One list of things a chart can be attached to (the store's products, or its
 * collections): tick boxes with a search above them once the list is long.
 * What is ticked sorts first when the list opens, so a long list shows the
 * chart's own products without scrolling.
 */
export function AttachList({
  title,
  items,
  selected,
  onChange,
  max,
  loading,
  error,
  searchLabel,
  emptyText,
  note,
  disabled,
}: {
  title: string;
  items: AttachItem[] | null;
  selected: string[];
  onChange: (next: string[]) => void;
  max: number;
  loading: boolean;
  error: unknown;
  searchLabel: string;
  emptyText: string;
  /** A line under the list, e.g. that only the newest products are listed. */
  note?: string | null;
  disabled?: boolean;
}) {
  const t = useT(SIZE_CHART_STRINGS);
  const errorMessage = useErrorMessage();
  const headingId = useId();
  const [search, setSearch] = useState("");
  // The order is fixed when the items arrive: ticking a box must not make its row jump.
  const [first] = useState(() => new Set(selected));
  const ordered = useMemo(
    () => [...(items ?? [])].sort((a, b) => Number(first.has(b.id)) - Number(first.has(a.id))),
    [items, first]
  );
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? ordered.filter((item) => item.name.toLowerCase().includes(q)) : ordered;
  }, [ordered, search]);
  const full = selected.length >= max;

  function toggle(id: string, on: boolean) {
    onChange(on ? (selected.includes(id) ? selected : [...selected, id]) : selected.filter((x) => x !== id));
  }

  return (
    <fieldset className="min-w-0 space-y-2" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-sm font-semibold text-ink">
          {title}
        </h3>
        <p className="text-xs text-ink-soft">{selected.length === 0 ? t.noneChosen : pluralOf(t, "chosen", selected.length)}</p>
      </div>

      {loading ? (
        <div role="status" aria-busy="true" aria-label={title} className="space-y-3 rounded-[1rem] px-3 py-3 ring-1 ring-line">
          <SkeletonBar className="w-3/5" />
          <SkeletonBar className="w-2/5" />
          <SkeletonBar className="w-1/2" />
        </div>
      ) : error ? (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(error)}
        </p>
      ) : ordered.length === 0 ? (
        <p className="rounded-[var(--radius)] bg-paper-sunken px-3 py-3 text-sm text-ink-soft">{emptyText}</p>
      ) : (
        <>
          {ordered.length > 8 && (
            <div className="relative">
              <IconSearch aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
              <Input
                type="search"
                aria-label={searchLabel}
                placeholder={searchLabel}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 ps-9"
              />
            </div>
          )}
          {shown.length === 0 ? (
            <p className="px-1 py-2 text-sm text-ink-soft">{t.noMatch}</p>
          ) : (
            <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-[1rem] ring-1 ring-line">
              {shown.map((item) => {
                const on = selected.includes(item.id);
                return (
                  <li key={item.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm text-ink hover:bg-paper-sunken has-[:disabled]:cursor-default has-[:disabled]:opacity-60">
                      <input
                        type="checkbox"
                        className="size-5 shrink-0 cursor-pointer accent-primary"
                        checked={on}
                        disabled={disabled || (!on && full)}
                        onChange={(e) => toggle(item.id, e.target.checked)}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <bdi>{item.name}</bdi>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {note && <p className="text-xs text-ink-soft">{note}</p>}
        </>
      )}
    </fieldset>
  );
}

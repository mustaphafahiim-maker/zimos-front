import { useEffect, useState } from "react";
import { cn } from "@store-builder/ui";
import { IconChecklist, IconGridView, IconListView } from "@/components/icons";
import { ListToolbar } from "@/components/list";
import { Segmented } from "@/components/Segmented";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { SEARCH_MAX } from "./useCatalogQuery";
import type { CatalogView } from "./useCatalogView";

const STRINGS = {
  en: {
    searchLabel: "Search products",
    searchPlaceholder: "Search all products by name",
    view: "How the products are shown",
    listView: "List",
    gridView: "Grid",
    select: "Select",
    selectHint: "Tick products to change them together",
  },
  ar: {
    searchLabel: "البحث في المنتجات",
    searchPlaceholder: "دوّر في كل المنتجات بالاسم",
    view: "شكل عرض المنتجات",
    listView: "قائمة",
    gridView: "شبكة",
    select: "حدّد",
    selectHint: "علّم على منتجات عشان تغيّرها مع بعض",
  },
} satisfies Messages;

const SEARCH_DEBOUNCE_MS = 300;

/** `value`, once it has stopped changing for `delayMs`. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/**
 * The one toolbar of the products list: the search, the Filters button, and at
 * its end the grid ↔ list switch (and, where rows have no tick box of their
 * own — a phone, the grid — the «حدّد» toggle that brings them out).
 *
 * The search looks through every product's name on the server. What is typed
 * stays here and is drawn at once — the request is what waits (300 ms after
 * the last key), so typing never stutters and only this toolbar re-renders
 * per key.
 */
export function CatalogToolbar({
  q,
  onSearch,
  filterCount,
  onOpenFilters,
  view,
  onView,
  selecting,
  onSelecting,
}: {
  /** The search in the URL (`?q=`). */
  q: string;
  /** Write the search to the URL; null takes it off. */
  onSearch: (next: string | null) => void;
  /** Filters in effect inside the sheet. */
  filterCount: number;
  onOpenFilters: () => void;
  view: CatalogView;
  onView: (next: CatalogView) => void;
  /** The tick boxes are out. Left out where every row already has one (the desktop table): no toggle then. */
  selecting?: boolean;
  onSelecting?: (next: boolean) => void;
}) {
  const t = useT(STRINGS);

  // What's typed, ahead of the debounce.
  const [draft, setDraft] = useState(q);
  // Back/forward or a shared link changed the query under us: adopt it, unless it's just what the draft already says.
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    if (draft.trim() !== q) setDraft(q);
  }

  const debounced = useDebouncedValue(draft.trim(), SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    if (debounced !== q) onSearch(debounced || null);
    // Only a settled draft should write the URL — not every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <ListToolbar
      search={{
        value: draft,
        onChange: (value) => {
          const next = value.slice(0, SEARCH_MAX);
          setDraft(next);
          // Emptied (the clear button, Escape, or by hand): the list answers at once, not after the wait.
          if (next.trim() === "" && q) onSearch(null);
        },
        placeholder: t.searchPlaceholder,
        label: t.searchLabel,
      }}
      filters={{ count: filterCount, onOpen: onOpenFilters }}
    >
      {onSelecting && (
        <button
          type="button"
          aria-pressed={selecting === true}
          title={t.selectHint}
          onClick={() => onSelecting(!selecting)}
          data-slot="catalog-select"
          data-active={selecting ? "" : undefined}
          className={cn(
            "zimos-list-filters inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-medium whitespace-nowrap ring-1 select-none",
            "transition-[scale,background-color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100",
            selecting ? "bg-primary-soft text-primary-dark ring-primary/40 dark:text-primary" : "bg-paper-raised text-ink ring-line hover:bg-paper-sunken"
          )}
        >
          <IconChecklist className="size-4 shrink-0" weight={selecting ? "fill" : "regular"} aria-hidden />
          <span>{t.select}</span>
        </button>
      )}
      <Segmented
        value={view}
        onChange={onView}
        options={[
          { value: "list", label: t.listView, icon: IconListView },
          { value: "grid", label: t.gridView, icon: IconGridView },
        ]}
        label={t.view}
        // The glyphs say it: the words stay for screen readers, so the switch is two 44px segments.
        className="zimos-catalog-view shrink-0 [&_[role=radio]]:px-3.5 [&_[role=radio]>span]:sr-only"
      />
    </ListToolbar>
  );
}

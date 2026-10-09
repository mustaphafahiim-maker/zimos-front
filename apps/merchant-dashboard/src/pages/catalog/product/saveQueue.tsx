import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SaveBar } from "@/components/SaveBar";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { pluralOf } from "@/lib/plural";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useProductGroup } from "./groupContext";
import type { GroupKey } from "./groups";

/**
 * One look for saving on the product page. Every section that saves on demand
 * keeps its own save (its own call, its own payload) and hands the button to
 * `SectionSaveBar`. The page shows ONE bar at a time — the first unsaved
 * section's, in reading order — pinned above the dock on a phone and at the
 * bottom edge from md up, wherever the merchant has scrolled to. It names the
 * section, says how many others are waiting, and once that section is saved
 * the next one's bar takes its place.
 *
 * The bar is drawn by the section (so it always calls the section's current
 * save) into a slot at the end of the page column (so it stays in reach when
 * the section itself is off screen, or folded on a phone).
 */

const STRINGS = {
  en: {
    unsaved: "Unsaved changes in {section}",
    more_one: "and {n} more section",
    more_two: "and {n} more sections",
    more_few: "and {n} more sections",
    more_many: "and {n} more sections",
    more_other: "and {n} more sections",
    waiting: "Not saved yet. The bar at the bottom saves “{first}” first, then this.",
    showSection: "Go to {section}",
  },
  ar: {
    unsaved: "تغييرات في {section} لسه ما اتحفظتش",
    more_one: "وكمان قسم واحد",
    more_two: "وكمان قسمين",
    more_few: "وكمان {n} أقسام",
    more_many: "وكمان {n} قسم",
    more_other: "وكمان {n} قسم",
    waiting: "التغييرات هنا لسه ما اتحفظتش. الشريط اللي تحت بيحفظ «{first}» الأول، وبعدها ده.",
    showSection: "روح لـ{section}",
  },
} satisfies Messages;

interface DirtyEntry {
  group: GroupKey | null;
  label: string;
  /** A node at the section's place in the page: reading order is DOM order. */
  anchor: HTMLElement | null;
}

interface SaveQueueValue {
  slot: HTMLElement | null;
  setSlot: (node: HTMLElement | null) => void;
  report: (id: string, entry: DirtyEntry | null) => void;
  /** The section whose bar is showing. */
  activeId: string | null;
  activeLabel: string | null;
  has: (id: string) => boolean;
  count: number;
  dirtyGroups: ReadonlySet<GroupKey>;
}

const SaveQueueContext = createContext<SaveQueueValue | null>(null);

function byPlaceInPage(a: DirtyEntry, b: DirtyEntry): number {
  if (!a.anchor || !b.anchor || a.anchor === b.anchor) return 0;
  return a.anchor.compareDocumentPosition(b.anchor) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

export function SaveQueueProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ReadonlyMap<string, DirtyEntry>>(() => new Map<string, DirtyEntry>());
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  const report = useCallback((id: string, entry: DirtyEntry | null) => {
    setEntries((prev) => {
      const had = prev.get(id);
      if (!entry) {
        if (!had) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      }
      if (had && had.group === entry.group && had.label === entry.label && had.anchor === entry.anchor) return prev;
      const next = new Map(prev);
      next.set(id, entry);
      return next;
    });
  }, []);

  const value = useMemo<SaveQueueValue>(() => {
    const ordered = [...entries.entries()].sort(([, a], [, b]) => byPlaceInPage(a, b));
    const first = ordered[0];
    const dirtyGroups = new Set<GroupKey>();
    for (const [, entry] of ordered) if (entry.group) dirtyGroups.add(entry.group);
    return {
      slot,
      setSlot,
      report,
      activeId: first ? first[0] : null,
      activeLabel: first ? first[1].label : null,
      has: (id: string) => entries.has(id),
      count: entries.size,
      dirtyGroups,
    };
  }, [entries, slot, report]);

  return <SaveQueueContext.Provider value={value}>{children}</SaveQueueContext.Provider>;
}

const NO_GROUPS: ReadonlySet<GroupKey> = new Set<GroupKey>();

/** The groups that hold an unsaved edit: the index and the group heads mark them. */
export function useDirtyGroups(): ReadonlySet<GroupKey> {
  return useContext(SaveQueueContext)?.dirtyGroups ?? NO_GROUPS;
}

/**
 * Where the one bar is drawn: the last thing in the page column. It has no box
 * of its own (`contents`), so the bar sticks to the bottom of the column, not
 * of this element.
 */
export function SaveSlot() {
  const queue = useContext(SaveQueueContext);
  return <div ref={queue?.setSlot} data-slot="product-save" className="contents" />;
}

interface SectionSaveBarProps {
  /** The section as it reads inside «تغييرات في … لسه ما اتحفظتش»: «الأساسيات», «شكل الخيارات». */
  section: string;
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  /** Puts the saved values back. */
  onDiscard?: () => void;
  disabled?: boolean;
  /** Why the last save did not go through: said on the bar, where the button is. */
  error?: string | null;
}

/**
 * The save affordance of one section of the product page. It tells the leave
 * guard the section is dirty, takes its place in the page's queue, and draws
 * the shared `SaveBar` when it is this section's turn. Outside the product
 * page (no queue) it is simply a `SaveBar` at the end of the section.
 */
export function SectionSaveBar({ section, dirty, saving = false, onSave, onDiscard, disabled, error }: SectionSaveBarProps) {
  const t = useT(STRINGS);
  const id = useId();
  const queue = useContext(SaveQueueContext);
  const group = useProductGroup();
  const groupKey = group?.group ?? null;
  const anchor = useRef<HTMLSpanElement>(null);
  const live = dirty || saving;

  // Leaving the page (a link, a reload) asks first while this section is unsaved.
  useReportDirty(dirty);

  const report = queue?.report;
  useEffect(() => {
    report?.(id, live ? { group: groupKey, label: section, anchor: anchor.current } : null);
  }, [report, id, live, groupKey, section]);
  // A section that goes away takes its turn with it.
  useEffect(() => {
    return () => report?.(id, null);
  }, [report, id]);

  // Until the queue has heard of this section (one render), it shows its bar only if nothing else is waiting.
  const mine = !queue || queue.activeId === id || (!queue.has(id) && queue.count === 0);
  const others = queue ? Math.max(0, queue.count - (queue.has(id) ? 1 : 0)) : 0;

  const said = fmt(t.unsaved, { section });
  const message = error ? (
    <span role="alert" className="text-danger">
      {error}
    </span>
  ) : (
    <>
      {group ? (
        // The section may be a screen away, or folded: the sentence takes the merchant to it.
        <button
          type="button"
          onClick={group.reveal}
          title={fmt(t.showSection, { section })}
          className="cursor-pointer rounded-md text-start underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {said}
        </button>
      ) : (
        said
      )}
      {others > 0 && <span className="ms-1.5 font-normal whitespace-nowrap text-ink-soft">· {pluralOf(t, "more", others)}</span>}
    </>
  );

  const bar =
    live && mine ? (
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={onSave}
        onDiscard={onDiscard}
        disabled={disabled}
        message={message}
        className="zimos-product-savebar"
      />
    ) : null;

  return (
    <>
      <span ref={anchor} hidden data-save-anchor="" />
      {bar && (queue?.slot ? createPortal(bar, queue.slot) : bar)}
      {live && !mine && queue?.activeLabel && (
        <p role="status" className="zimos-product-waiting mt-4 flex items-start gap-2 text-[13px] leading-5 font-medium text-accent-dark">
          <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
          {fmt(t.waiting, { first: queue.activeLabel })}
        </p>
      )}
    </>
  );
}

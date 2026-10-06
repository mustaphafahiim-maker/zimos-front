import { Fragment, useEffect, useRef } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronDown, Megaphone, PanelBottom, PanelTop, Pin, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@store-builder/ui";
import type { PageSection } from "@store-builder/api-client";
import { SectionCard } from "./SectionCard";
import { editorUi, useEditorLocale } from "./editorLocale";
import type { ShellPart } from "./storeShell";

/**
 * The page's sections as a collapsible layer list — the editor's original
 * sortable outline (SectionCard + dnd-kit), now sitting beside the live
 * preview instead of standing in for it. Drag to reorder, click to select, and
 * a "+" between any two rows to add a section exactly there.
 *
 * Only the selected row shows its element summary; the rest stay one line so
 * a long page still fits the pane.
 *
 * The store's fixed parts bracket the list — the announcement bar and header
 * above it, the footer below — so the outline reads top to bottom like the
 * page does. They open their own panels, and can't be dragged or deleted:
 * they are the same on every page.
 */
export function LayerList({
  sections,
  selectedId,
  insertIndex,
  onSelect,
  onDelete,
  onMove,
  onInsertAt,
  open,
  onOpenChange,
  selectedShell = null,
  onSelectShell,
  announcementOn = false,
}: {
  sections: PageSection[];
  selectedId: string | null;
  /** The slot "add a section here" is pointing at, highlighted until a block is picked. */
  insertIndex: number | null;
  onSelect: (sectionId: string) => void;
  onDelete: (section: PageSection) => void;
  onMove: (from: number, to: number) => void;
  onInsertAt: (index: number) => void;
  /** Folded to its header or not — owned by the editor so the pane split can make way. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which fixed part is open in the inspector, if any. */
  selectedShell?: ShellPart | null;
  /** Shows the fixed rows when given. */
  onSelectShell?: (part: ShellPart) => void;
  /** Whether the announcement bar is switched on — its row says so. */
  announcementOn?: boolean;
}) {
  const ui = editorUi(useEditorLocale());
  const rows = useRef(new Map<string, HTMLElement>());

  const sensors = useSensors(
    // A small distance threshold so a click on the handle still selects rather
    // than starting a phantom drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onMove(
      sections.findIndex((s) => s.id === active.id),
      sections.findIndex((s) => s.id === over.id)
    );
  }

  // A section picked in the preview may be far down the list: bring it into view.
  useEffect(() => {
    if (!selectedId || !open) return;
    rows.current.get(selectedId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId, open]);

  const slot = (index: number) => (
    <button
      type="button"
      onClick={() => onInsertAt(index)}
      aria-label={ui.addHere}
      title={ui.addHere}
      className={cn(
        "cursor-pointer group flex h-4 w-full items-center gap-1 rounded focus-visible:outline-none",
        insertIndex === index ? "opacity-100" : "opacity-0 hover:opacity-100 focus-visible:opacity-100"
      )}
    >
      <span className="h-0.5 flex-1 rounded-full bg-primary/60" />
      <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Plus className="size-3" aria-hidden />
      </span>
      <span className="h-0.5 flex-1 rounded-full bg-primary/60" />
    </button>
  );

  return (
    <div className={cn("flex min-h-0 flex-col", open ? "flex-1" : "shrink-0 border-b border-line")}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={open ? ui.hideLayers : ui.showLayers}
        className="cursor-pointer flex w-full items-center justify-between gap-2 px-4 py-3 text-start hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
      >
        <span className="min-w-0">
          <span className="block font-display text-sm font-medium text-ink">
            {ui.layersTitle}
            <span className="ms-1.5 text-xs font-normal text-ink-soft">({sections.length})</span>
          </span>
          <span className="block text-xs text-ink-soft">{ui.layersHint}</span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-ink-soft transition-transform", !open && "-rotate-90 rtl:rotate-90")}
          aria-hidden
        />
      </button>

      {open && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {onSelectShell && (
            <div className="space-y-1.5 pb-1">
              <FixedRow
                icon={Megaphone}
                label={ui.announcementBar}
                hint={announcementOn ? ui.shellFixedHint : ui.announcementOff}
                muted={!announcementOn}
                selected={selectedShell === "announcement"}
                onSelect={() => onSelectShell("announcement")}
              />
              <FixedRow
                icon={PanelTop}
                label={ui.shellHeader}
                hint={ui.shellFixedHint}
                selected={selectedShell === "header"}
                onSelect={() => onSelectShell("header")}
              />
            </div>
          )}
          {sections.length === 0 ? (
            <p className="rounded-[0.5rem] border border-dashed border-line px-3 py-4 text-center text-xs text-ink-soft">
              {ui.emptyPage}
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div>
                  {slot(0)}
                  {sections.map((section, index) => (
                    <Fragment key={section.id}>
                      <div
                        ref={(el) => {
                          if (el) rows.current.set(section.id, el);
                          else rows.current.delete(section.id);
                        }}
                      >
                        <SectionCard
                          section={section}
                          selected={section.id === selectedId}
                          showSummary={section.id === selectedId}
                          onSelect={() => onSelect(section.id)}
                          onDelete={() => onDelete(section)}
                        />
                      </div>
                      {slot(index + 1)}
                    </Fragment>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          {onSelectShell && (
            <div className="pt-1">
              <FixedRow
                icon={PanelBottom}
                label={ui.shellFooter}
                hint={ui.shellFixedHint}
                selected={selectedShell === "footer"}
                onSelect={() => onSelectShell("footer")}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One of the store's fixed parts in the outline: selectable like a section,
 * with a pin where a section has its drag grip and nothing where it has its
 * delete button — the shape says it stays put.
 */
function FixedRow({
  icon: Glyph,
  label,
  hint,
  selected,
  muted = false,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  selected: boolean;
  muted?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "cursor-pointer flex w-full items-center gap-2 rounded-[var(--radius-card)] border border-dashed px-2.5 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        selected ? "border-primary bg-primary-soft/60 ring-1 ring-primary/30" : "border-line bg-paper hover:border-primary/50"
      )}
    >
      <Pin className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
      <Glyph className={cn("size-4 shrink-0", muted ? "text-ink-soft" : "text-primary")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-medium", muted ? "text-ink-soft" : "text-ink")}>{label}</span>
        <span className="block truncate text-[11px] text-ink-soft">{hint}</span>
      </span>
    </button>
  );
}

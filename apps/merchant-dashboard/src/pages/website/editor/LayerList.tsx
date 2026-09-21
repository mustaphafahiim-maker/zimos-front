import { Fragment, useEffect, useRef, useState } from "react";
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
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@store-builder/ui";
import type { PageSection } from "@store-builder/api-client";
import { SectionCard } from "./SectionCard";
import { editorUi, useEditorLocale } from "./editorLocale";

/**
 * The page's sections as a collapsible layer list — the editor's original
 * sortable outline (SectionCard + dnd-kit), now sitting beside the live
 * preview instead of standing in for it. Drag to reorder, click to select, and
 * a "+" between any two rows to add a section exactly there.
 *
 * Only the selected row shows its element summary; the rest stay one line so
 * a long page still fits the pane.
 */
export function LayerList({
  sections,
  selectedId,
  insertIndex,
  onSelect,
  onDelete,
  onMove,
  onInsertAt,
}: {
  sections: PageSection[];
  selectedId: string | null;
  /** The slot "add a section here" is pointing at, highlighted until a block is picked. */
  insertIndex: number | null;
  onSelect: (sectionId: string) => void;
  onDelete: (section: PageSection) => void;
  onMove: (from: number, to: number) => void;
  onInsertAt: (index: number) => void;
}) {
  const ui = editorUi(useEditorLocale());
  const [open, setOpen] = useState(true);
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
      <span className="flex size-4 items-center justify-center rounded-full bg-primary text-white">
        <Plus className="size-3" aria-hidden />
      </span>
      <span className="h-0.5 flex-1 rounded-full bg-primary/60" />
    </button>
  );

  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
        <div className="max-h-[40vh] overflow-y-auto px-3 pb-3">
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
        </div>
      )}
    </div>
  );
}

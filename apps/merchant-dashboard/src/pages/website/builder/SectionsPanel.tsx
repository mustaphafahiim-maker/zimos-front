import { useState, type Dispatch } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ClipboardCopy, Copy, Eye, EyeOff, GripVertical, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@store-builder/ui";
import { fmt } from "@/i18n/LocaleContext";
import type { NodePath, RendererLocale, Tree, TreeSection } from "@store-builder/store-renderer";
import { sectionLabel, type EditorAction } from "./editorState";
import { ELEMENT_LABELS } from "./elementLibrary";
import { useBuilderT } from "./strings";

function SortableSection({
  section,
  selected,
  picked,
  selection,
  uiLocale,
  dispatch,
  onDelete,
}: {
  section: TreeSection;
  selected: boolean;
  picked: boolean;
  selection: NodePath | null;
  uiLocale: RendererLocale;
  dispatch: Dispatch<EditorAction>;
  onDelete: (path: NodePath) => void;
}) {
  const t = useBuilderT();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const [renaming, setRenaming] = useState(false);
  const label = sectionLabel(section);
  const hidden = !!section.settings?.hidden;
  const iconBtn = "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted hover:bg-primary-soft hover:text-primary";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("rounded-lg border bg-paper-raised", picked ? "border-[#2563eb] bg-[#2563eb]/5 ring-1 ring-[#2563eb]" : selected ? "border-[#2563eb] ring-1 ring-[#2563eb]" : "border-line", isDragging && "relative z-10 shadow-pop")}
    >
      <div className="group flex items-center gap-1 px-1 py-1">
        <button ref={setActivatorNodeRef} type="button" className={cn(iconBtn, "cursor-grab active:cursor-grabbing")} aria-label={fmt(t.dragHandle, { name: label })} {...attributes} {...listeners}>
          <GripVertical className="size-4" aria-hidden />
        </button>
        {renaming ? (
          <input
            autoFocus
            dir="auto"
            defaultValue={label}
            aria-label={t.rename}
            className="min-w-0 flex-1 rounded-md border border-primary bg-paper px-2 py-1 text-sm outline-none"
            onBlur={(e) => {
              dispatch({ type: "updateSettings", path: section.id, patch: { label: e.target.value.trim().slice(0, 60) } });
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={(e) => dispatch(e.shiftKey || e.ctrlKey || e.metaKey ? { type: "toggleMulti", sectionId: section.id } : { type: "select", path: section.id })}
            aria-pressed={picked || selected}
            onDoubleClick={() => setRenaming(true)}
            className={cn("min-w-0 flex-1 cursor-pointer truncate rounded-md px-1.5 py-1 text-start text-sm", hidden ? "text-ink-muted line-through" : "text-ink", selected && "font-semibold")}
            dir="auto"
          >
            {label}
          </button>
        )}
        {hidden && <span className="rounded bg-line px-1.5 text-[10px] font-semibold text-ink-soft">{t.hiddenBadge}</span>}
        <div className={cn("flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100", selected && "opacity-100")}>
          <button type="button" className={iconBtn} title={t.rename} aria-label={t.rename} onClick={() => setRenaming(true)}>
            <Pencil className="size-3.5" aria-hidden />
          </button>
          <button type="button" className={iconBtn} title={hidden ? t.show : t.hide} aria-label={hidden ? t.show : t.hide} onClick={() => dispatch({ type: "toggleHidden", sectionId: section.id })}>
            {hidden ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
          </button>
          <button type="button" className={iconBtn} title={t.duplicate} aria-label={t.duplicate} onClick={() => dispatch({ type: "duplicateSection", sectionId: section.id })}>
            <Copy className="size-3.5" aria-hidden />
          </button>
          <button type="button" className={cn(iconBtn, "hover:bg-danger-soft hover:text-danger")} title={t.delete} aria-label={t.delete} onClick={() => onDelete(section.id)}>
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
      {selected && !picked && (
        <ul className="space-y-0.5 border-t border-line px-2 py-1.5">
          {section.rows.map((r) =>
            r.columns.map((c) =>
              c.elements.map((e) => {
                const path = `${section.id}/${r.id}/${c.id}/${e.id}`;
                const text = typeof e.props?.text === "string" ? e.props.text : typeof e.props?.label === "string" ? e.props.label : "";
                return (
                  <li key={path}>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "select", path })}
                      className={cn("flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-start text-xs", selection === path ? "bg-[#2563eb]/10 font-semibold text-[#2563eb]" : "text-ink-soft hover:bg-primary-soft")}
                    >
                      <span className="shrink-0">{ELEMENT_LABELS[e.type]?.[uiLocale] ?? e.type}</span>
                      {text && (
                        <span dir="auto" className="truncate text-ink-muted">
                          {text}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )
          )}
        </ul>
      )}
    </li>
  );
}

export function SectionsPanel({
  tree,
  selection,
  dispatch,
  multi,
  uiLocale,
  onDelete,
  onDeleteMany,
  onCopy,
}: {
  tree: Tree;
  selection: NodePath | null;
  multi: string[];
  dispatch: Dispatch<EditorAction>;
  uiLocale: RendererLocale;
  onDelete: (path: NodePath) => void;
  onDeleteMany: (ids: string[]) => void;
  onCopy: (ids: string[]) => void;
}) {
  const t = useBuilderT();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const selectedSection = selection?.split("/")[0] ?? null;

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = tree.sections.findIndex((s) => s.id === active.id);
    const to = tree.sections.findIndex((s) => s.id === over.id);
    dispatch({ type: "moveSection", from, to });
  }

  return (
    <div className="space-y-2 p-3">
      {multi.length > 1 ? (
        <div role="toolbar" aria-label={fmt(t.selectedCount, { n: multi.length })} className="sticky top-0 z-20 flex items-center gap-1 rounded-lg bg-[#2563eb] px-2 py-1 text-white shadow">
          <span className="flex-1 text-xs font-semibold">{fmt(t.selectedCount, { n: multi.length })}</span>
          {(() => {
            const allHidden = multi.every((id) => tree.sections.find((s) => s.id === id)?.settings?.hidden);
            const bulk = "flex size-7 cursor-pointer items-center justify-center rounded-md hover:bg-white/20";
            return (
              <>
                <button type="button" className={bulk} title={allHidden ? t.show : t.hide} aria-label={allHidden ? t.show : t.hide} onClick={() => dispatch({ type: "setHiddenMany", ids: multi, hidden: !allHidden })}>
                  {allHidden ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
                </button>
                <button type="button" className={bulk} title={t.duplicate} aria-label={t.duplicate} onClick={() => dispatch({ type: "duplicateSections", ids: multi })}>
                  <Copy className="size-3.5" aria-hidden />
                </button>
                <button type="button" className={bulk} title={t.copy} aria-label={t.copy} onClick={() => onCopy(multi)}>
                  <ClipboardCopy className="size-3.5" aria-hidden />
                </button>
                <button type="button" className={bulk} title={t.delete} aria-label={t.delete} onClick={() => onDeleteMany(multi)}>
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
                <button type="button" className={bulk} title={t.clearSelection} aria-label={t.clearSelection} onClick={() => dispatch({ type: "clearMulti" })}>
                  <X className="size-3.5" aria-hidden />
                </button>
              </>
            );
          })()}
        </div>
      ) : (
        <p className="text-xs text-ink-soft">
          {t.sectionsHint}
          <span className="mt-0.5 block text-ink-muted">{t.multiHint}</span>
        </p>
      )}
      {tree.sections.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-ink-muted">{t.noSections}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd}>
          <SortableContext items={tree.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul aria-label={t.tabSections} className="space-y-1.5">
              {tree.sections.map((s) => (
                <SortableSection key={s.id} section={s} selected={s.id === selectedSection} picked={multi.length > 1 && multi.includes(s.id)} selection={selection} uiLocale={uiLocale} dispatch={dispatch} onDelete={onDelete} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

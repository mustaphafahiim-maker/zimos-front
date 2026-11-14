import type { PageElement, PageSection } from "@store-builder/api-client";
import { stepEdit, type CanvasEdit, type CanvasStep } from "@/lib/canvasDrag";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import { createSection, insertSection, moveSection, sectionLabel, type BlockPreset } from "../blocks";
import { applyCanvasEdit, nudgeElement } from "../canvasEdits";
import { cloneElement, duplicateElement, duplicateSection, replaceDeepAddress, sectionHidden, setElementText, setSectionHidden } from "../canvasTools";
import { useEditorLocale } from "../editorLocale";
import { SHELL_STRINGS } from "./shellStrings";
import { setElementField } from "./treeTools";
import type { EditorDocument } from "./useEditorDocument";

/** What the small bar on a selected section can ask for (StorefrontPreview's onSectionAction). */
export type SectionActionKind = "up" | "down" | "duplicate" | "hide" | "delete";

/** Where a copied section or element waits to be pasted — on this page, another page, or another store's editor. */
const CLIPBOARD_KEY = "zimos:editor-clipboard";

/**
 * Every edit the shell makes to the open page's sections — from the canvas,
 * the section list, the library and the inspector. Each goes through the
 * document's `setSections`, so each is one undo step (a burst of typing in
 * one section, or of arrow keys on one handle, folds into one).
 *
 * `onSelect` is told which section an edit produced or landed in (a new
 * block, a copy, the section an element was dragged into); `onDeselect` that
 * the selected one is gone.
 */
export function useSectionEdits({
  doc,
  selectedSectionId,
  onSelect,
  onDeselect,
}: {
  doc: EditorDocument;
  selectedSectionId: string | null;
  onSelect: (sectionId: string, how: { scroll: boolean }) => void;
  onDeselect: () => void;
}) {
  const locale = useEditorLocale();
  const t = useT(SHELL_STRINGS);
  const toast = useToast();
  const { sections, setSections } = doc;

  /** A drag or resize released on the canvas: one tree edit, one undo step. */
  function applyCanvas(edit: CanvasEdit, key?: string) {
    setSections((prev) => applyCanvasEdit(prev, edit), key);
    // Keep the moved element's section in the inspector.
    if (edit.kind === "move-element") {
      const owner = sections.find((s) =>
        (s.rows ?? []).some((r) => (r.columns ?? []).some((c) => c.id === edit.columnId))
      );
      if (owner && owner.id !== selectedSectionId) onSelect(owner.id, { scroll: false });
    }
  }

  /**
   * One arrow-key press on a canvas handle. Repeated presses on the same
   * handle fold into one undo step, like a burst of typing.
   */
  function stepCanvas(step: CanvasStep) {
    if (step.kind === "element") {
      setSections((prev) => nudgeElement(prev, step.sectionId, step.elementId, step.delta));
      return;
    }
    const edit = stepEdit(step);
    if (edit) applyCanvas(edit, `canvas:${step.kind}:${step.sectionId}`);
  }

  /** Double-click text editing on the page (canvasTools.ts): one undo step per edit. */
  function editText(elementId: string, text: string, match?: { was: string; nth: number }) {
    setSections((prev) => setElementText(prev, elementId, text, match));
  }

  /** A picture of a many-pictured band replaced from the page (canvasTools.ts): one undo step. */
  function replacePicture(elementId: string, was: string, nth: number, url: string) {
    setSections((prev) => replaceDeepAddress(prev, elementId, was, nth, url));
  }

  // --- copy and paste ------------------------------------------------------------
  //
  // Kept in the browser's own storage rather than in memory, so what was copied on one page (or in one
  // store's editor) pastes on another. A pasted node gets new ids throughout, like a duplicate.

  const elementsOf = (section: PageSection): PageElement[] =>
    (section.rows ?? []).flatMap((row) => (row.columns ?? []).flatMap((column) => column.elements ?? []));

  /** Copies the selected element, or else the selected section. False when nothing is selected. */
  function copy(sectionId: string | null, elementId: string | null): boolean {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return false;
    const element = elementId ? elementsOf(section).find((el) => el.id === elementId) : undefined;
    try {
      window.localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(element ? { kind: "element", node: element } : { kind: "section", node: section }));
    } catch {
      return false;
    }
    toast.success(element ? t.copiedElement : t.copiedSection);
    return true;
  }

  /** Pastes what was copied: a section under the selected one (or at the end), an element after the selected one. */
  function paste(sectionId: string | null, elementId: string | null): boolean {
    let clip: { kind?: unknown; node?: unknown } | null = null;
    try {
      clip = JSON.parse(window.localStorage.getItem(CLIPBOARD_KEY) ?? "null");
    } catch {
      clip = null;
    }
    const node = clip?.node as { id?: unknown; type?: unknown } | undefined;
    if (!clip || !node || typeof node.id !== "string" || typeof node.type !== "string") {
      toast.error(t.nothingToPaste);
      return false;
    }
    if (clip.kind === "section" && node.type === "section") {
      const fresh = duplicateSection(node as PageSection);
      const at = sections.findIndex((s) => s.id === sectionId);
      setSections((prev) => insertSection(prev, fresh, at === -1 ? prev.length : at + 1));
      onSelect(fresh.id, { scroll: true });
      toast.success(t.pastedSection);
      return true;
    }
    if (clip.kind !== "element") return false;
    const target = sections.find((s) => s.id === sectionId);
    if (!target) {
      toast.error(t.pasteNeedsSection);
      return false;
    }
    const fresh = cloneElement(node as PageElement);
    let placed = false;
    const rows = (target.rows ?? []).map((row, r) => ({
      ...row,
      columns: (row.columns ?? []).map((column, c) => {
        const elements = column.elements ?? [];
        const index = elementId ? elements.findIndex((el) => el.id === elementId) : -1;
        // After the selected element; with none selected, at the end of the section's first column.
        const here = elementId ? index !== -1 : r === 0 && c === 0;
        if (placed || !here) return column;
        placed = true;
        const at = index === -1 ? elements.length : index + 1;
        return { ...column, elements: [...elements.slice(0, at), fresh, ...elements.slice(at)] };
      }),
    }));
    if (!placed) return false;
    update({ ...target, rows });
    toast.success(t.pastedElement);
    return true;
  }

  /** A copy of the selected element right after it, or else of the selected section. */
  function duplicateSelected(sectionId: string | null, elementId: string | null): boolean {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return false;
    if (elementId) update(duplicateElement(section, elementId));
    else duplicate(section.id);
    return true;
  }

  /** Creates a section from `preset` and drops it at `index`, then selects and scrolls to it. */
  function addPreset(preset: BlockPreset, index: number) {
    const section = createSection(preset, locale);
    setSections((prev) => insertSection(prev, section, index));
    onSelect(section.id, { scroll: true });
  }

  /** A ready-made section (from the saved ones) at `index`; the end of the page when null. */
  function addSection(section: PageSection, index: number | null) {
    setSections((prev) => insertSection(prev, section, index ?? prev.length));
    onSelect(section.id, { scroll: true });
  }

  /** The list's drag and drop. */
  function move(from: number, to: number) {
    setSections((prev) => moveSection(prev, from, to));
  }

  /** Up / down from the canvas or the section's own bar — reorder without opening the list. */
  function moveBy(sectionId: string, direction: "up" | "down") {
    setSections((prev) => {
      const from = prev.findIndex((s) => s.id === sectionId);
      if (from === -1) return prev;
      return moveSection(prev, from, direction === "up" ? from - 1 : from + 1);
    });
  }

  /** The inspector's changes: one undo step per burst of typing in a section, not per keystroke. */
  function update(next: PageSection) {
    setSections((prev) => prev.map((s) => (s.id === next.id ? next : s)), `section:${next.id}`);
  }

  function duplicate(sectionId: string) {
    const source = sections.find((s) => s.id === sectionId);
    if (!source) return;
    const copy = duplicateSection(source);
    setSections((prev) => insertSection(prev, copy, prev.findIndex((s) => s.id === source.id) + 1));
    onSelect(copy.id, { scroll: true });
  }

  /**
   * Deleting a section is one undo step, so it is not asked about: it goes,
   * and a toast offers to put it back where it was (Ctrl/⌘+Z does the same).
   */
  function remove(section: PageSection) {
    const index = sections.findIndex((s) => s.id === section.id);
    if (index === -1) return;
    setSections((prev) => prev.filter((s) => s.id !== section.id));
    if (selectedSectionId === section.id) onDeselect();
    toast.undo(fmt(t.sectionDeleted, { name: sectionLabel(section, locale) }), () => {
      // Already back (an undo from the keyboard): nothing to do.
      setSections((prev) => (prev.some((s) => s.id === section.id) ? prev : insertSection(prev, section, index)));
    });
  }

  /**
   * Hide / show. The tree has no hidden flag on a section; canvasTools.ts
   * hides every element in it the way the Style tab's "hide on this device"
   * does on the base device, which the store obeys.
   */
  function toggleHidden(sectionId: string) {
    const target = sections.find((s) => s.id === sectionId);
    if (!target) return;
    const hide = !sectionHidden(target);
    if (setSectionHidden(target, hide) === target) return;
    setSections((prev) => prev.map((s) => (s.id === sectionId ? setSectionHidden(s, hide) : s)));
    if (!hide) return;
    toast.undo(fmt(t.sectionHidden, { name: sectionLabel(target, locale) }), () => {
      setSections((prev) => prev.map((s) => (s.id === sectionId && sectionHidden(s) ? target : s)));
    });
  }

  /** The small bar a selected section carries in the preview. */
  function act(sectionId: string, action: SectionActionKind) {
    const target = sections.find((s) => s.id === sectionId);
    if (!target) return;
    switch (action) {
      case "up":
      case "down":
        moveBy(sectionId, action);
        break;
      case "duplicate":
        duplicate(sectionId);
        break;
      case "hide":
        toggleHidden(sectionId);
        break;
      case "delete":
        remove(target);
        break;
    }
  }

  /** The picture a click on the canvas replaces: the same tree edit a field change makes, one undo step. */
  function setImage(target: { sectionId: string; elementId: string; field: string }, url: string) {
    setSections((prev) => setElementField(prev, target.sectionId, target.elementId, target.field, url));
  }

  return { replacePicture, copy, paste, duplicateSelected, applyCanvas, stepCanvas, editText, addPreset, addSection, move, moveBy, update, duplicate, remove, toggleHidden, act, setImage };
}

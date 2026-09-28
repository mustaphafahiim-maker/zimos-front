import type { PageElement, PageSection } from "@store-builder/api-client";
import type { CanvasEdit } from "@/lib/canvasDrag";
import { moveElement, moveSection, replaceElement } from "./blocks";

/**
 * The tree edits that drag and resize on the preview make (lib/canvasDrag.ts
 * decides WHICH edit; this applies it). All immutable, and each returns the
 * very same array when nothing would change, so a drop in place records no
 * undo step and posts no preview.
 *
 * New keys, both optional and absent from every page written before them:
 *  - `section.settings.minHeight` — px; the storefront gives the section at
 *    least that height (page-renderer/layout.ts `sectionMinHeight`).
 *  - `image.props.width` — percent of its column (10–99); the storefront caps
 *    the picture at that width, centred (elements.tsx `ImageElement`). It
 *    replaces the named `size`, so the two are never set together.
 *
 * Neither is per breakpoint: the page tree has no per-breakpoint values, so a
 * size set in the tablet or phone preview applies at every width.
 */

export function sectionMinHeight(section: PageSection): number | null {
  const raw = (section.settings as Record<string, unknown> | undefined)?.minHeight;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
}

/** Sets or clears a section's minimum height, dropping `settings` when it empties. */
export function setSectionMinHeight(section: PageSection, px: number | null): PageSection {
  if (sectionMinHeight(section) === px) return section;
  const settings: Record<string, unknown> = { ...(section.settings ?? {}) };
  if (px === null) delete settings.minHeight;
  else settings.minHeight = px;
  const next: PageSection = { ...section };
  if (Object.keys(settings).length === 0) delete next.settings;
  else next.settings = settings;
  return next;
}

/** Sets the spans of two neighbouring columns in one row. */
export function setColumnSpans(section: PageSection, rowId: string, index: number, spans: [number, number]): PageSection {
  let changed = false;
  const rows = (section.rows ?? []).map((row) => {
    if (row.id !== rowId) return row;
    const columns = row.columns ?? [];
    const a = columns[index];
    const b = columns[index + 1];
    if (!a || !b || (a.span === spans[0] && b.span === spans[1])) return row;
    changed = true;
    return {
      ...row,
      columns: columns.map((col, i) => (i === index ? { ...col, span: spans[0] } : i === index + 1 ? { ...col, span: spans[1] } : col)),
    };
  });
  return changed ? { ...section, rows } : section;
}

function findElement(section: PageSection, elementId: string): PageElement | null {
  for (const row of section.rows ?? []) {
    for (const col of row.columns ?? []) {
      const found = (col.elements ?? []).find((el) => el.id === elementId);
      if (found) return found;
    }
  }
  return null;
}

/** An image's width in percent of its column, or null for the full width (which also clears `size`). */
export function setImageWidth(section: PageSection, elementId: string, pct: number | null): PageSection {
  const element = findElement(section, elementId);
  if (!element || element.type !== "image") return section;
  const props = (element.props ?? {}) as Record<string, unknown>;
  const current = typeof props.width === "number" ? props.width : null;
  if (current === pct && props.size === undefined) return section;
  const nextProps = { ...props };
  delete nextProps.size;
  if (pct === null) delete nextProps.width;
  else nextProps.width = pct;
  return replaceElement(section, elementId, { ...element, props: nextProps });
}

/**
 * Moves an element to `index` in the column `columnId`, anywhere on the page
 * — within its own column, to another column of its section, or into another
 * section. `index` counts the target column as it is before the move, the way
 * the frame measured it.
 */
export function moveElementTo(sections: PageSection[], elementId: string, columnId: string, index: number): PageSection[] {
  let moving: PageElement | null = null;
  let fromColumn: string | null = null;
  let fromIndex = -1;
  let hasTarget = false;
  for (const section of sections) {
    for (const row of section.rows ?? []) {
      for (const col of row.columns ?? []) {
        if (col.id === columnId) hasTarget = true;
        const i = (col.elements ?? []).findIndex((el) => el.id === elementId);
        if (i !== -1) {
          moving = col.elements[i];
          fromColumn = col.id;
          fromIndex = i;
        }
      }
    }
  }
  if (!moving || !hasTarget) return sections;
  // Dropping into its own slot, or the one just after it, changes nothing.
  if (fromColumn === columnId && (index === fromIndex || index === fromIndex + 1)) return sections;
  const target = fromColumn === columnId && fromIndex < index ? index - 1 : index;
  const element = moving;

  return sections.map((section) => {
    let touched = false;
    const rows = (section.rows ?? []).map((row) => {
      let rowTouched = false;
      const columns = (row.columns ?? []).map((col) => {
        const isSource = col.id === fromColumn;
        const isTarget = col.id === columnId;
        if (!isSource && !isTarget) return col;
        rowTouched = true;
        let elements = col.elements ?? [];
        if (isSource) elements = elements.filter((el) => el.id !== elementId);
        if (isTarget) {
          elements = elements.slice();
          elements.splice(Math.min(elements.length, Math.max(0, target)), 0, element);
        }
        return { ...col, elements };
      });
      if (!rowTouched) return row;
      touched = true;
      return { ...row, columns };
    });
    return touched ? { ...section, rows } : section;
  });
}

/** Applies one edit from the canvas; the same array back when it changes nothing. */
export function applyCanvasEdit(sections: PageSection[], edit: CanvasEdit): PageSection[] {
  const updateSection = (sectionId: string, update: (s: PageSection) => PageSection) => {
    let changed = false;
    const next = sections.map((s) => {
      if (s.id !== sectionId) return s;
      const updated = update(s);
      if (updated !== s) changed = true;
      return updated;
    });
    return changed ? next : sections;
  };

  switch (edit.kind) {
    case "move-section": {
      const from = sections.findIndex((s) => s.id === edit.sectionId);
      return from === -1 ? sections : moveSection(sections, from, edit.to);
    }
    case "move-element":
      return moveElementTo(sections, edit.elementId, edit.columnId, edit.index);
    case "section-height":
      return updateSection(edit.sectionId, (s) => setSectionMinHeight(s, edit.px));
    case "column-spans":
      return updateSection(edit.sectionId, (s) => setColumnSpans(s, edit.rowId, edit.index, edit.spans));
    case "image-width":
      return updateSection(edit.sectionId, (s) => setImageWidth(s, edit.elementId, edit.pct));
  }
}

/** One arrow-key press on an element's grip: up or down a place within its own column. */
export function nudgeElement(sections: PageSection[], sectionId: string, elementId: string, delta: -1 | 1): PageSection[] {
  let changed = false;
  const next = sections.map((s) => {
    if (s.id !== sectionId) return s;
    const moved = moveElement(s, elementId, delta);
    if (JSON.stringify(moved.rows) !== JSON.stringify(s.rows)) changed = true;
    return moved;
  });
  return changed ? next : sections;
}

import type { PageElement, PageSection } from "@store-builder/api-client";

/**
 * Item 95 (SPEC §9.3), shared by the website and funnel page editors:
 * duplicating a section or an element, and the text a double-click on the
 * canvas edits in place (the storefront's PreviewBridge posts
 * `zimos:edit-text`).
 */

/** A fresh id for a copy: the original's, with an earlier copy's suffix swapped for a new one. */
function copyId(id: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 6)
      : Math.random().toString(36).slice(2, 8);
  const base = (id || "n").replace(/-c[0-9a-z]{6}$/, "");
  return `${base}-c${rand}`;
}

function cloneElement(element: PageElement): PageElement {
  const copy = JSON.parse(JSON.stringify(element)) as PageElement;
  return { ...copy, id: copyId(element.id) };
}

/** The section and everything in it, each node with a new id. Its look and any saved-section link come along. */
export function duplicateSection(section: PageSection): PageSection {
  const copy = JSON.parse(JSON.stringify(section)) as PageSection;
  return {
    ...copy,
    id: copyId(section.id),
    rows: (copy.rows ?? []).map((row) => ({
      ...row,
      id: copyId(row.id),
      columns: (row.columns ?? []).map((column) => ({
        ...column,
        id: copyId(column.id),
        elements: (column.elements ?? []).map(cloneElement),
      })),
    })),
  };
}

/**
 * A copy of one element, right after it in its column. An HTML block's copy
 * names the same code (customCode/htmlBlocks.js): editing either changes both.
 */
export function duplicateElement(section: PageSection, elementId: string): PageSection {
  let done = false;
  const rows = (section.rows ?? []).map((row) => ({
    ...row,
    columns: (row.columns ?? []).map((column) => {
      const elements = column.elements ?? [];
      const index = elements.findIndex((el) => el.id === elementId);
      if (index < 0 || done) return column;
      done = true;
      return { ...column, elements: [...elements.slice(0, index + 1), cloneElement(elements[index]), ...elements.slice(index + 1)] };
    }),
  }));
  return done ? { ...section, rows } : section;
}

/** The prop a double-click edits, per element type — plain text the renderer shows as it is. */
export const INLINE_TEXT_KEY: Record<string, string> = {
  heading: "text",
  text: "text",
  rich_text: "text",
  button: "label",
  text_link: "text",
};

function boundKeys(element: PageElement): Record<string, unknown> {
  const bindings = (element.props as Record<string, unknown> | undefined)?.bindings;
  return bindings && typeof bindings === "object" && !Array.isArray(bindings) ? (bindings as Record<string, unknown>) : {};
}

/** The elements whose text can be edited on the canvas: those types, unless the text is bound to live data. */
export function inlineTextIds(sections: PageSection[]): string[] {
  const ids: string[] = [];
  for (const section of sections) {
    for (const row of section.rows ?? []) {
      for (const column of row.columns ?? []) {
        for (const element of column.elements ?? []) {
          const key = INLINE_TEXT_KEY[element.type];
          if (key && !boundKeys(element)[key]) ids.push(element.id);
        }
      }
    }
  }
  return ids;
}

/** The element's text set from the canvas; the same array when nothing changes. */
export function setElementText(sections: PageSection[], elementId: string, text: string): PageSection[] {
  let changed = false;
  const next = sections.map((section) => {
    let touched = false;
    const rows = (section.rows ?? []).map((row) => ({
      ...row,
      columns: (row.columns ?? []).map((column) => ({
        ...column,
        elements: (column.elements ?? []).map((element) => {
          const key = INLINE_TEXT_KEY[element.type];
          if (element.id !== elementId || !key || boundKeys(element)[key]) return element;
          const props = (element.props ?? {}) as Record<string, unknown>;
          if (props[key] === text) return element;
          touched = true;
          return { ...element, props: { ...props, [key]: text } };
        }),
      })),
    }));
    if (!touched) return section;
    changed = true;
    return { ...section, rows };
  });
  return changed ? next : sections;
}

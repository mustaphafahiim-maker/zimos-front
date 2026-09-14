/**
 * The page tree contract, mirrored from the backend
 * (zimos-main/src/modules/pages/pageTree.js). Structurally compatible with
 * `PageTree` in @store-builder/api-client, but declared here so this package
 * has no dependency on the API client.
 *
 * Backend rules (enforced on every draft write and on publish):
 *  - tree: object; `version` integer when present; `globalStyles` object when present
 *  - `sections` array; section → rows → columns → elements
 *  - every node has a non-empty string `id`
 *  - section.type === "section", row.type === "row", column.type === "column"
 *  - column.span, when present, integer 1..12
 *  - element.type ∈ ALLOWED_ELEMENT_TYPES
 *  - element.props / element.settings, when present, plain objects —
 *    their CONTENTS are never inspected (any keys are stored as-is)
 *  - section/row/column extra keys (e.g. `settings`) are not inspected at all
 *  - at most 10 000 nodes
 *  - publishing additionally requires ≥1 section and ≥1 element
 */

export const ALLOWED_ELEMENT_TYPES = [
  "heading",
  "text",
  "rich_text",
  "image",
  "gallery",
  "button",
  "video",
  "embed",
  "spacer",
  "divider",
  "icon",
  "list",
  "accordion",
  "faq",
  "testimonial",
  "countdown",
  "form",
  "map",
  "social_icons",
  "product_card",
  "product_list",
  "collection_list",
  "cart",
] as const;

export type ElementType = (typeof ALLOWED_ELEMENT_TYPES)[number];
export const MAX_NODES = 10000;
export const MAX_COLUMN_SPAN = 12;

export type NodeSettings = Record<string, unknown>;

export interface TreeElement {
  id: string;
  type: ElementType;
  props?: Record<string, unknown>;
  settings?: NodeSettings;
}

export interface TreeColumn {
  id: string;
  type: "column";
  span?: number;
  settings?: NodeSettings;
  elements: TreeElement[];
}

export interface TreeRow {
  id: string;
  type: "row";
  settings?: NodeSettings;
  columns: TreeColumn[];
}

export interface TreeSection {
  id: string;
  type: "section";
  settings?: NodeSettings;
  rows: TreeRow[];
}

export interface Tree {
  version?: number;
  globalStyles?: Record<string, unknown>;
  sections: TreeSection[];
}

export interface TreeValidationError {
  field: string;
  message: string;
}

export interface TreeValidationResult {
  ok: boolean;
  errors: TreeValidationError[];
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const ALLOWED = new Set<string>(ALLOWED_ELEMENT_TYPES);

function idCheck(node: Record<string, unknown>, field: string, errors: TreeValidationError[]) {
  if (typeof node.id !== "string" || node.id.trim() === "") {
    errors.push({ field: `${field}.id`, message: 'Every node needs a non-empty string "id"' });
  }
}

/**
 * Same checks, same field paths and messages as the backend. Returns a result
 * instead of throwing so the builder can show problems inline.
 */
export function validatePageTree(data: unknown, opts: { requireContent?: boolean } = {}): TreeValidationResult {
  const errors: TreeValidationError[] = [];
  if (typeof data === "string") {
    return { ok: false, errors: [{ field: "data", message: "Page content must be a structured section tree, not a raw HTML string" }] };
  }
  if (!isObj(data)) {
    return { ok: false, errors: [{ field: "data", message: 'Page content must be an object with a "sections" array' }] };
  }
  if (data.version !== undefined && !Number.isInteger(data.version)) {
    errors.push({ field: "data.version", message: '"version" must be an integer when present' });
  }
  if (data.globalStyles !== undefined && !isObj(data.globalStyles)) {
    errors.push({ field: "data.globalStyles", message: '"globalStyles" must be an object when present' });
  }
  const sections = data.sections;
  if (!Array.isArray(sections)) {
    errors.push({ field: "data.sections", message: '"sections" must be an array' });
    return { ok: false, errors };
  }

  let nodes = 0;
  let elementCount = 0;

  sections.forEach((section, si) => {
    const sf = `data.sections[${si}]`;
    nodes += 1;
    if (!isObj(section)) {
      errors.push({ field: sf, message: "A section must be an object, not a string" });
      return;
    }
    idCheck(section, sf, errors);
    if (section.type !== "section") errors.push({ field: `${sf}.type`, message: 'A section node must have type "section"' });
    if (!Array.isArray(section.rows)) {
      errors.push({ field: `${sf}.rows`, message: 'A section must have a "rows" array' });
      return;
    }
    section.rows.forEach((row: unknown, ri: number) => {
      const rf = `${sf}.rows[${ri}]`;
      nodes += 1;
      if (!isObj(row)) {
        errors.push({ field: rf, message: "A row must be an object" });
        return;
      }
      idCheck(row, rf, errors);
      if (row.type !== "row") errors.push({ field: `${rf}.type`, message: 'A row node must have type "row"' });
      if (!Array.isArray(row.columns)) {
        errors.push({ field: `${rf}.columns`, message: 'A row must have a "columns" array' });
        return;
      }
      row.columns.forEach((col: unknown, ci: number) => {
        const cf = `${rf}.columns[${ci}]`;
        nodes += 1;
        if (!isObj(col)) {
          errors.push({ field: cf, message: "A column must be an object" });
          return;
        }
        idCheck(col, cf, errors);
        if (col.type !== "column") errors.push({ field: `${cf}.type`, message: 'A column node must have type "column"' });
        if (col.span !== undefined && (!Number.isInteger(col.span) || (col.span as number) < 1 || (col.span as number) > MAX_COLUMN_SPAN)) {
          errors.push({ field: `${cf}.span`, message: `"span" must be an integer between 1 and ${MAX_COLUMN_SPAN}` });
        }
        if (!Array.isArray(col.elements)) {
          errors.push({ field: `${cf}.elements`, message: 'A column must have an "elements" array' });
          return;
        }
        elementCount += col.elements.length;
        col.elements.forEach((el: unknown, ei: number) => {
          const ef = `${cf}.elements[${ei}]`;
          nodes += 1;
          if (typeof el === "string") {
            errors.push({ field: ef, message: "An element must be a structured node object, not a raw HTML/text string" });
            return;
          }
          if (!isObj(el)) {
            errors.push({ field: ef, message: "An element must be an object" });
            return;
          }
          idCheck(el, ef, errors);
          if (typeof el.type !== "string" || el.type.trim() === "") {
            errors.push({ field: `${ef}.type`, message: 'Element is missing a "type"' });
          } else if (!ALLOWED.has(el.type)) {
            errors.push({ field: `${ef}.type`, message: `Unknown element type "${el.type}". Raw HTML blocks are not allowed; use a structured element type.` });
          }
          if (el.props !== undefined && !isObj(el.props)) errors.push({ field: `${ef}.props`, message: '"props" must be an object when present' });
          if (el.settings !== undefined && !isObj(el.settings)) errors.push({ field: `${ef}.settings`, message: '"settings" must be an object when present' });
        });
      });
    });
  });

  if (nodes > MAX_NODES) errors.push({ field: "data", message: `Page tree is too large (${nodes} nodes, max ${MAX_NODES})` });

  if (opts.requireContent) {
    if (sections.length === 0) {
      errors.push({ field: "data.sections", message: "Cannot publish an empty page — add at least one section with content before publishing" });
    } else if (elementCount === 0) {
      errors.push({ field: "data.sections", message: "This page has sections but no content elements — add text, an image or another element before publishing" });
    }
  }

  return { ok: errors.length === 0, errors };
}

/** All node ids in a tree, in document order (duplicates kept). */
export function collectIds(tree: Tree): string[] {
  const ids: string[] = [];
  for (const s of tree.sections) {
    ids.push(s.id);
    for (const r of s.rows) {
      ids.push(r.id);
      for (const c of r.columns) {
        ids.push(c.id);
        for (const e of c.elements) ids.push(e.id);
      }
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Node paths — how the builder addresses a node. Id-based so they survive
// reordering: "sectionId", "sectionId/rowId/columnId/elementId".
// ---------------------------------------------------------------------------

export type NodePath = string;

export function nodePath(...ids: Array<string | undefined>): NodePath {
  return ids.filter((x): x is string => typeof x === "string" && x !== "").join("/");
}

// ---------------------------------------------------------------------------
// Builders used by the section library and themes.
// ---------------------------------------------------------------------------

export type IdFactory = (kind: string) => string;

/**
 * Unique ids per call. Pass a `prefix` for deterministic output (themes,
 * tests); omit it and a random prefix keeps two inserts of the same preset
 * from colliding inside one page.
 */
export function createIdFactory(prefix?: string): IdFactory {
  const p = prefix ?? Math.random().toString(36).slice(2, 8);
  let n = 0;
  return (kind) => `${p}-${kind}-${(n += 1)}`;
}

export function el(id: IdFactory, type: ElementType, props: Record<string, unknown> = {}, settings?: NodeSettings): TreeElement {
  return settings ? { id: id(type), type, props, settings } : { id: id(type), type, props };
}

export function col(id: IdFactory, elements: TreeElement[], span = 12, settings?: NodeSettings): TreeColumn {
  return { id: id("col"), type: "column", span, settings: settings ?? {}, elements };
}

export function row(id: IdFactory, columns: TreeColumn[], settings?: NodeSettings): TreeRow {
  return { id: id("row"), type: "row", settings: settings ?? {}, columns };
}

export function section(id: IdFactory, rows: TreeRow[], settings: NodeSettings = {}): TreeSection {
  return { id: id("sec"), type: "section", settings, rows };
}
